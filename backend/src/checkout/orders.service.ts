import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { normalizeStatus, OrderStatus, pick, str, unwrap } from '../common/gateway-utils';
import { canonicalBrand } from '../gateway/fees.mapper';
import { GatewayClient } from '../gateway/gateway.client';
import { GatewaySessionService } from '../gateway/gateway-session.service';
import { detectBrand, ORDER_TO_LINK } from './checkout.constants';
import { PayCardDto, PayPixDto } from './checkout.dto';
import { CheckoutLink } from './checkout-link.entity';
import { LinksService } from './links.service';
import { Order } from './order.entity';

/** Tentativas máximas de pagamento por link (a primeira mais as repetições após uma negativa). */
export const MAX_ATTEMPTS = 5;

/**
 * Transições permitidas: PENDING vai para qualquer status final.
 * Exceção: um Pix marcado como EXPIRED localmente pode ser aprovado depois, se o dinheiro
 * chegar tarde (webhook ou conciliação). Todo o resto é final e não muda mais.
 */
function canTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === 'PENDING') return next !== 'PENDING';
  return current === 'EXPIRED' && next === 'APPROVED';
}

export interface StatusUpdate {
  orderId?: string;
  externalReference?: string | null;
  gatewayId?: string | null;
  status: OrderStatus;
  reason?: string | null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(CheckoutLink) private readonly links: Repository<CheckoutLink>,
    private readonly linksService: LinksService,
    private readonly session: GatewaySessionService,
    private readonly client: GatewayClient,
    private readonly dataSource: DataSource,
  ) {}

  async payPix(code: string, dto: PayPixDto) {
    const link = await this.linksService.findByCode(code);
    if (link.method !== 'PIX') throw new BadRequestException('Este link não é de Pix');
    const order = await this.reserve(link, dto.payerName, dto.payerDocument);

    try {
      const raw = await this.session.call(link.userId, (token) =>
        this.client.createPix(token, {
          amount: link.amountCents, // centavos
          externalReference: order.externalReference,
          description: link.description,
          payerDocument: dto.payerDocument,
        }),
      );
      const data = unwrap(raw);
      order.gatewayPaymentId = str(pick(data, 'id', 'paymentId'));
      order.gatewayTxid = str(pick(data, 'txid'));
      order.pixEmv = str(
        pick(data, 'emv', 'qrCode', 'pixCopiaECola', 'copyPaste', 'pixCopyPaste', 'brCode', 'payload', 'qrCodeText'),
      );
      order.pixQrCodeBase64 = str(pick(data, 'qrCodeBase64', 'qrCodeImage', 'qrCodeBase64Image', 'qrcodeBase64'));
      // Pix é assíncrono por natureza: o pagador ainda precisa pagar. O pedido fica PENDING
      // (para exibir o QR Code) e o resultado definitivo vem por webhook ou pelo "Já paguei".
      await this.orders.save(order);
    } catch (err) {
      await this.markAttemptFailed(link, order, err);
      throw err;
    }
    return this.linksService.publicView(code);
  }

  async payCard(code: string, dto: PayCardDto) {
    const link = await this.linksService.findByCode(code);
    if (link.method !== 'CARD' || !link.installments || link.feePercent === null) {
      throw new BadRequestException('Este link não é de cartão');
    }
    const detected = detectBrand(dto.number);
    if (detected && link.brand && detected !== canonicalBrand(link.brand)) {
      throw new BadRequestException(
        `A bandeira do cartão (${detected}) é diferente da bandeira deste link (${link.brand})`,
      );
    }
    const order = await this.reserve(link, dto.holderName);

    try {
      // Dados do cartão só passam pela memória desta requisição: nunca são gravados nem logados.
      const raw = await this.session.call(link.userId, (token) =>
        this.client.createCard(token, {
          amount: link.amountCents, // centavos
          installments: link.installments, // parcelas escolhidas na criação do link
          feePercent: link.feePercent, // taxa persistida, vinda de GET /fees
          externalReference: order.externalReference,
          description: link.description,
          cardNumber: dto.number,
          cardHolder: dto.holderName,
          expiryMonth: String(dto.expMonth).padStart(2, '0'),
          expiryYear: String(dto.expYear),
          cvv: dto.cvv,
        }),
      );
      const data = unwrap(raw);
      order.gatewayPaymentId = str(pick(data, 'id', 'paymentId'));
      await this.orders.save(order);
      await this.applyImmediateStatus(order, data);
    } catch (err) {
      await this.markAttemptFailed(link, order, err);
      throw err;
    }
    return this.linksService.publicView(code);
  }

  /**
   * Aplica o resultado de um pagamento (vindo de webhook ou consulta ao gateway).
   * Idempotente: um pedido que já saiu de PENDING não muda mais.
   * Sempre filtra por userId para respeitar o isolamento entre contas.
   */
  async applyStatus(userId: string, update: StatusUpdate): Promise<Order | null> {
    const where: FindOptionsWhere<Order>[] = [];
    if (update.orderId) where.push({ id: update.orderId, userId });
    if (update.externalReference) where.push({ externalReference: update.externalReference, userId });
    if (update.gatewayId) {
      where.push({ gatewayPaymentId: update.gatewayId, userId }, { gatewayTxid: update.gatewayId, userId });
    }
    if (!where.length) return null;

    const found = await this.orders.findOne({ where });
    if (!found) return null;
    if (!canTransition(found.status, update.status)) return found;

    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: found.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order || !canTransition(order.status, update.status)) return order ?? found;

      order.status = update.status;
      if (update.status === 'APPROVED') {
        order.paidAt = new Date();
        order.failureReason = null;
      } else order.failureReason = update.reason ? String(update.reason).slice(0, 255) : order.failureReason;
      await manager.save(order);

      const linkStatus = ORDER_TO_LINK[update.status];
      if (linkStatus) {
        await manager.update(
          CheckoutLink,
          { id: order.linkId },
          update.status === 'APPROVED' ? { status: linkStatus, paidAt: order.paidAt } : { status: linkStatus },
        );
      }
      this.logger.log(`Pedido ${order.externalReference} -> ${update.status}`);
      return order;
    });
  }

  /** Consulta o gateway (GET /payments/:id) e aplica o status. Útil quando o webhook não chega. */
  async sync(userId: string, orderId: string) {
    const order = await this.orders.findOneBy({ id: orderId, userId });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    const gatewayRef = order.gatewayPaymentId ?? order.gatewayTxid;
    if (order.status === 'PENDING' && gatewayRef) {
      const raw = await this.session.call(userId, (token) => this.client.getPayment(token, gatewayRef));
      const data = unwrap(raw);
      await this.applyStatus(userId, {
        orderId,
        status: normalizeStatus(pick(data, 'status')),
        reason: str(pick(data, 'failureReason', 'reason', 'message')),
      });
    }
    const fresh = await this.orders.findOneBy({ id: orderId });
    return { id: fresh?.id, status: fresh?.status, externalReference: fresh?.externalReference };
  }

  /**
   * Usado pelo job de conciliação: consulta o gateway (GET /payments/:id) e aplica o status,
   * inclusive para um Pix já marcado como expirado que acabou sendo pago.
   */
  async reconcile(order: Order) {
    const gatewayRef = order.gatewayPaymentId ?? order.gatewayTxid;
    if (!gatewayRef) return;
    const raw = await this.session.call(order.userId, (token) => this.client.getPayment(token, gatewayRef));
    const data = unwrap(raw);
    await this.applyStatus(order.userId, {
      orderId: order.id,
      status: normalizeStatus(pick(data, 'status')),
      reason: str(pick(data, 'failureReason', 'reason', 'message')),
    });
  }

  async checkByCode(code: string) {
    const link = await this.linksService.findByCode(code);
    const order = await this.linksService.latestOrder(link.id);
    const gatewayRef = order?.gatewayPaymentId ?? order?.gatewayTxid;
    if (order && order.status === 'PENDING' && gatewayRef) {
      const raw = await this.session.call(link.userId, (token) => this.client.getPayment(token, gatewayRef));
      const data = unwrap(raw);
      await this.applyStatus(link.userId, {
        orderId: order.id,
        status: normalizeStatus(pick(data, 'status')),
        reason: str(pick(data, 'failureReason', 'reason', 'message')),
      });
    }
    return this.linksService.publicView(code);
  }

  private async reserve(link: CheckoutLink, payerName: string, payerDocument?: string) {
    if (link.status !== 'ACTIVE' && link.status !== 'FAILED') {
      const reasons: Record<string, string> = {
        PROCESSING: 'Já existe um pagamento em andamento para este link',
        PAID: 'Este link já foi pago',
        EXPIRED: 'Este link expirou',
        CANCELLED: 'Este link foi cancelado',
      };
      throw new ConflictException(reasons[link.status] ?? 'Link indisponível');
    }
    if (link.status === 'FAILED') {
      if (link.expiresAt.getTime() < Date.now()) throw new ConflictException('Este link expirou');
      if ((await this.orders.count({ where: { linkId: link.id } })) >= MAX_ATTEMPTS) {
        throw new ConflictException('Limite de tentativas atingido. Solicite um novo link');
      }
    }
    const res = await this.links.update({ id: link.id, status: In(['ACTIVE', 'FAILED']) }, { status: 'PROCESSING' });
    if (!res.affected) throw new ConflictException('Este link não está mais disponível para pagamento');

    const attempt = (await this.orders.count({ where: { linkId: link.id } })) + 1;
    return this.orders.save(
      this.orders.create({
        linkId: link.id,
        userId: link.userId,
        externalReference: `${link.externalReference}-${attempt}`,
        method: link.method,
        amountCents: link.amountCents,
        installments: link.installments,
        feePercent: link.feePercent,
        status: 'PENDING',
        payerName: payerName.trim(),
        payerDocument: payerDocument ?? null,
      }),
    );
  }

  private async applyImmediateStatus(order: Order, data: any) {
    const status = normalizeStatus(pick(data, 'status'));
    if (status !== 'PENDING') {
      await this.applyStatus(order.userId, {
        orderId: order.id,
        status,
        reason: str(pick(data, 'failureReason', 'reason', 'message')),
      });
    }
  }

  private async markAttemptFailed(link: CheckoutLink, order: Order, err: unknown) {
    order.status = 'DENIED';
    order.failureReason = (err instanceof Error ? err.message : 'Erro ao processar pagamento').slice(0, 255);
    await this.orders.save(order);
    await this.links.update({ id: link.id, status: 'PROCESSING' }, { status: 'ACTIVE' });
  }
}
