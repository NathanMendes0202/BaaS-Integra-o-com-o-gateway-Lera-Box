import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { FindOptionsWhere, In, LessThan, Repository } from 'typeorm';
import { percentOfCents } from '../common/money';
import { GatewayClient } from '../gateway/gateway.client';
import { GatewaySessionService } from '../gateway/gateway-session.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { LINK_TO_UI, UI_TO_LINK } from './checkout.constants';
import { CreateLinkDto, SendLinkEmailDto } from './checkout.dto';
import { renderLinkEmail } from './link-email';
import { CheckoutLink } from './checkout-link.entity';
import { Order } from './order.entity';

@Injectable()
export class LinksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LinksService.name);
  private timer?: NodeJS.Timeout;
  private readonly webUrl: string;
  private readonly emailSends = new Map<string, number[]>();
  private static readonly EMAILS_PER_HOUR = 20;

  constructor(
    @InjectRepository(CheckoutLink) private readonly links: Repository<CheckoutLink>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly session: GatewaySessionService,
    private readonly client: GatewayClient,
    private readonly users: UsersService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.get<string>('PUBLIC_WEB_URL', 'http://localhost:5173').replace(/\/$/, '');
  }

  onModuleInit() {
    this.timer = setInterval(() => this.expireDue().catch((e) => this.logger.error(e.message)), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async expireDue() {
    await this.links.update({ status: 'ACTIVE', expiresAt: LessThan(new Date()) }, { status: 'EXPIRED' });
  }

  async create(userId: string, dto: CreateLinkDto) {
    await this.session.getAccount(userId);

    let brand: CheckoutLink['brand'] = null;
    let installments: number | null = null;
    let feePercent: number | null = null;
    let feeCents = 0;

    if (dto.method === 'CARD') {
      if (!dto.brand) throw new BadRequestException('Informe a bandeira para links de cartão');
      brand = dto.brand;
      installments = dto.installments ?? 1;
      const fees = await this.client.fees(brand);
      const row = fees.find((f) => f.brand === brand && f.installments === installments);
      if (!row) throw new BadRequestException(`Sem taxa cadastrada para ${brand} em ${installments}x`);
      feePercent = row.feePercent;
      feeCents = percentOfCents(dto.amountCents, feePercent);
    }

    const code = randomBytes(9).toString('base64url');
    const link = await this.links.save(
      this.links.create({
        code,
        userId,
        description: dto.description.trim(),
        method: dto.method,
        amountCents: dto.amountCents,
        brand,
        installments,
        feePercent,
        feeCents,
        externalReference: `LNK-${code}`,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + (dto.expiresInMinutes ?? 1440) * 60_000),
        paidAt: null,
      }),
    );
    return this.toView(link);
  }

  async sendByEmail(userId: string, id: string, dto: SendLinkEmailDto) {
    const link = await this.links.findOneBy({ id, userId });
    if (!link) throw new NotFoundException('Link não encontrado');
    if (link.status !== 'ACTIVE' || link.expiresAt.getTime() < Date.now()) {
      throw new ConflictException('Só é possível enviar por e-mail links ativos');
    }
    this.throttleEmails(userId);

    const merchant = await this.users.findById(userId);
    const message = renderLinkEmail({
      merchantName: merchant?.name ?? null,
      description: link.description,
      amountCents: link.amountCents,
      url: `${this.webUrl}/pagar/${link.code}`,
      expiresAt: link.expiresAt,
      note: dto.message,
    });
    await this.mail.send({ to: dto.email, ...message });
    return { sent: true, to: dto.email };
  }

  private throttleEmails(userId: string) {
    const hourAgo = Date.now() - 3_600_000;
    const recent = (this.emailSends.get(userId) ?? []).filter((t) => t > hourAgo);
    if (recent.length >= LinksService.EMAILS_PER_HOUR) {
      throw new HttpException('Limite de envios por e-mail atingido. Tente novamente em instantes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(Date.now());
    this.emailSends.set(userId, recent);
  }

  async list(userId: string) {
    await this.expireDue();
    const links = await this.links.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
    return links.map((l) => this.toView(l));
  }

  async cancel(userId: string, id: string) {
    const link = await this.links.findOneBy({ id, userId });
    if (!link) throw new NotFoundException('Link não encontrado');
    const res = await this.links.update({ id, userId, status: 'ACTIVE' }, { status: 'CANCELLED' });
    if (!res.affected) {
      throw new ConflictException('Só é possível cancelar links ativos e ainda sem pagamento em andamento');
    }
    return this.toView((await this.links.findOneBy({ id })) as CheckoutLink);
  }

  async findByCode(code: string): Promise<CheckoutLink> {
    const link = await this.links.findOneBy({ code });
    if (!link) throw new NotFoundException('Link de pagamento não encontrado');
    if (link.status === 'ACTIVE' && link.expiresAt.getTime() < Date.now()) {
      link.status = 'EXPIRED';
      await this.links.update({ id: link.id, status: 'ACTIVE' }, { status: 'EXPIRED' });
    }
    return link;
  }

  async publicView(code: string) {
    const link = await this.findByCode(code);
    const [order, merchant] = await Promise.all([this.latestOrder(link.id), this.users.findById(link.userId)]);
    return {
      code: link.code,
      description: link.description,
      method: link.method,
      amountCents: link.amountCents,
      brand: link.brand,
      installments: link.installments,
      feePercent: link.feePercent,
      status: link.status,
      expiresAt: link.expiresAt,
      merchantName: merchant?.name ?? null,
      order: order
        ? {
            status: order.status,
            pixEmv: order.status === 'PENDING' ? order.pixEmv : null,
            pixQrCodeBase64: order.status === 'PENDING' ? order.pixQrCodeBase64 : null,
            failureReason: order.failureReason,
          }
        : null,
    };
  }

  async receipt(code: string) {
    const link = await this.findByCode(code);
    const order = await this.latestOrder(link.id);
    if (link.status !== 'PAID' || !order || order.status !== 'APPROVED') {
      throw new NotFoundException('Comprovante disponível apenas para pagamentos aprovados');
    }
    const merchant = await this.users.findById(link.userId);
    return {
      code: link.code,
      merchantName: merchant?.name ?? null,
      description: link.description,
      method: link.method,
      amountCents: link.amountCents,
      installments: link.installments,
      payerName: order.payerName,
      reference: order.externalReference,
      paidAt: order.paidAt,
    };
  }

  async listTransactions(userId: string, uiStatus?: keyof typeof UI_TO_LINK, limit = 50) {
    await this.expireDue();
    const where: FindOptionsWhere<CheckoutLink> = { userId };
    if (uiStatus) {
      const statuses = UI_TO_LINK[uiStatus];
      where.status = statuses.length === 1 ? statuses[0] : In(statuses);
    }
    const links = await this.links.find({ where, order: { createdAt: 'DESC' }, take: Math.min(limit, 200) });
    const orders = links.length
      ? await this.orders.find({ where: { linkId: In(links.map((l) => l.id)) }, order: { createdAt: 'DESC' } })
      : [];
    const latest = new Map<string, Order>();
    for (const o of orders) if (!latest.has(o.linkId)) latest.set(o.linkId, o);

    return links.map((l) => {
      const o = latest.get(l.id);
      return {
        id: l.id,
        code: l.code,
        description: l.description,
        method: l.method,
        brand: l.brand,
        amountCents: l.amountCents,
        installments: l.installments,
        feePercent: l.feePercent,
        feeCents: l.feeCents,
        status: LINK_TO_UI[l.status],
        linkStatus: l.status,
        externalReference: l.externalReference,
        createdAt: l.createdAt,
        paidAt: l.paidAt,
        orderId: o?.id ?? null,
        orderStatus: o?.status ?? null,
        failureReason: o?.failureReason ?? null,
      };
    });
  }

  latestOrder(linkId: string) {
    return this.orders.findOne({ where: { linkId }, order: { createdAt: 'DESC' } });
  }

  private toView(l: CheckoutLink) {
    return {
      id: l.id,
      code: l.code,
      checkoutUrl: `${this.webUrl}/pagar/${l.code}`,
      description: l.description,
      method: l.method,
      brand: l.brand,
      amountCents: l.amountCents,
      installments: l.installments,
      feePercent: l.feePercent,
      feeCents: l.feeCents,
      externalReference: l.externalReference,
      status: l.status,
      uiStatus: LINK_TO_UI[l.status],
      expiresAt: l.expiresAt,
      paidAt: l.paidAt,
      createdAt: l.createdAt,
    };
  }
}
