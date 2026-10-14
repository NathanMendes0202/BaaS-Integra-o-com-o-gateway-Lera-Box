import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { OrdersService } from '../checkout/orders.service';
import { CryptoService } from '../common/crypto.service';
import { isRecognizedStatus, normalizeStatus, pick, str, toList } from '../common/gateway-utils';
import { GatewayAccount } from '../gateway/gateway-account.entity';
import { GatewayClient } from '../gateway/gateway.client';
import { GatewaySessionService } from '../gateway/gateway-session.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { WebhookEvent } from './webhook-event.entity';

export const WEBHOOK_EVENTS = ['PAYMENT_PIX', 'PAYMENT_CARD', 'WITHDRAWAL'] as const;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(GatewayAccount) private readonly accounts: Repository<GatewayAccount>,
    @InjectRepository(WebhookEvent) private readonly events: Repository<WebhookEvent>,
    private readonly orders: OrdersService,
    private readonly withdrawals: WithdrawalsService,
    private readonly session: GatewaySessionService,
    private readonly client: GatewayClient,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  // ---------------- Recepção ----------------
  async receive(token: string, rawBody: Buffer | undefined, signature: string | undefined, body: any) {
    const account = await this.accounts.findOneBy({ webhookToken: token });
    if (!account) throw new NotFoundException();

    const raw = rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    const secret = this.crypto.decrypt(account.encryptedWebhookSecret);
    let signatureValid = false;
    if (secret) {
      if (!signature || !this.verifySignature(raw, secret, signature)) {
        this.logger.warn(`Webhook rejeitado (assinatura inválida) conta=${account.id}`);
        throw new UnauthorizedException('Assinatura inválida');
      }
      signatureValid = true;
    }

    const eventKey = String(pick(body, 'eventId', 'event_id') ?? createHash('sha256').update(raw).digest('hex')).slice(0, 64);
    const eventType = str(pick(body, 'event', 'type', 'eventType'))?.toUpperCase().slice(0, 40) ?? null;
    const eventData = body?.data && typeof body.data === 'object' ? body.data : (body?.payload ?? body);
    const gatewayStatus = str(pick(eventData, 'status'))?.toUpperCase().slice(0, 30) ?? null;
    const reference = str(pick(eventData, 'externalReference', 'external_reference'))?.slice(0, 80) ?? null;

    let event = await this.events.findOneBy({ accountId: account.id, eventKey });
    if (event) {
      if (event.status !== 'FAILED') return { received: true, duplicate: true };
    } else {
      try {
        event = await this.events.save(
          this.events.create({
            accountId: account.id,
            userId: account.userId,
            eventKey,
            eventType,
            gatewayStatus,
            reference,
            status: 'RECEIVED',
            signatureValid,
            payload: body ?? {},
            error: null,
            processedAt: null,
          }),
        );
      } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY' || err?.driverError?.code === 'ER_DUP_ENTRY') {
          return { received: true, duplicate: true };
        }
        throw err;
      }
    }

    try {
      const result = await this.process(account.userId, eventType, body);
      event.status = result.ok ? 'PROCESSED' : 'IGNORED';
      event.error = result.note;
    } catch (err) {
      event.status = 'FAILED';
      event.error = (err instanceof Error ? err.message : 'Erro').slice(0, 255);
      event.processedAt = new Date();
      await this.events.save(event);
      throw err; 
    }
    event.processedAt = new Date();
    await this.events.save(event);
    return { received: true };
  }

  private verifySignature(raw: Buffer, secret: string, signature: string): boolean {
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const given = signature.trim().replace(/^sha256=/i, '').toLowerCase();
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async process(
    userId: string,
    eventType: string | null,
    body: any,
  ): Promise<{ ok: boolean; note: string | null }> {
    const data = body?.data && typeof body.data === 'object' ? body.data : (body?.payload ?? body);
    const rawStatus = pick(data, 'status');
    const status = normalizeStatus(rawStatus);
    if (!isRecognizedStatus(rawStatus)) {
      return { ok: false, note: `Status não reconhecido: ${String(rawStatus)}`.slice(0, 255) };
    }
    const externalReference = str(pick(data, 'externalReference', 'external_reference'));
    const reason = str(pick(data, 'failureReason', 'reason', 'message'));
    const gatewayId = str(pick(data, 'id', 'paymentId', 'withdrawalId', 'txid'));
    const txid = str(pick(data, 'txid'));

    const record = eventType?.startsWith('WITHDRAWAL')
      ? await this.withdrawals.applyStatus(userId, { externalReference, gatewayId, status, reason })
      : await this.orders.applyStatus(userId, { externalReference, gatewayId: gatewayId ?? txid, status, reason });

    if (!record) return { ok: false, note: 'Registro local não encontrado para este evento' };
    if (status !== 'PENDING' && record.status !== status) {
      return { ok: true, note: `Já estava ${record.status}; o status ${status} do evento não foi aplicado` };
    }
    return { ok: true, note: null };
  }

  // ---------------- Gestão (lojista autenticado) ----------------

  async config_(userId: string, baseUrl?: string) {
    const account = await this.session.getAccount(userId);
    const callbackUrl = this.urlFor(account, baseUrl);
    const raw = await this.session.call(userId, (t) => this.client.listWebhooks(t));
    const hooks = toList(raw).map((w) => ({
      id: String(pick(w, 'id', 'webhookId') ?? ''),
      url: str(pick(w, 'url')),
      event: str(pick(w, 'event', 'type')),
    }));
    return { callbackUrl, events: WEBHOOK_EVENTS, hooks };
  }

  async register(userId: string, baseUrl?: string) {
    const account = await this.session.getAccount(userId);
    const url = this.urlFor(account, baseUrl);
    const secret = this.crypto.decrypt(account.encryptedWebhookSecret);
    const existing = toList(await this.session.call(userId, (t) => this.client.listWebhooks(t)));

    const results: { event: string; status: string }[] = [];
    for (const event of WEBHOOK_EVENTS) {
      const found = existing.find(
        (w) => pick(w, 'url') === url && String(pick(w, 'event', 'type') ?? '').toUpperCase() === event,
      );
      if (found) {
        results.push({ event, status: 'JA_CADASTRADO' });
        continue;
      }
      await this.session.call(userId, (t) => this.client.createWebhook(t, { url, event, secret }));
      results.push({ event, status: 'CADASTRADO' });
    }
    const warning = this.isLocalUrl(url)
      ? 'A URL cadastrada aponta para um endereço local: o gateway não consegue chamá-la. Use um túnel público (ngrok, cloudflared) ou um domínio.'
      : undefined;
    return { callbackUrl: url, results, warning };
  }

  async remove(userId: string, id: string) {
    await this.session.call(userId, (t) => this.client.deleteWebhook(t, id));
  }

  async listEvents(userId: string, limit = 30) {
    const items = await this.events.find({ where: { userId }, order: { createdAt: 'DESC' }, take: Math.min(limit, 100) });
    return items.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      status: e.status,
      signatureValid: e.signatureValid,
      error: e.error,
      gatewayStatus: e.gatewayStatus,
      reference: e.reference,
      createdAt: e.createdAt,
      processedAt: e.processedAt,
    }));
  }

  private urlFor(account: GatewayAccount, baseUrl?: string): string {
    const base = (baseUrl ?? this.config.get<string>('PUBLIC_API_URL', 'http://localhost:3000')).replace(/\/$/, '');
    this.assertNotGateway(base);
    return `${base}/api/webhooks/gateway/${account.webhookToken}`;
  }

  private assertNotGateway(base: string) {
    const gatewayHost = new URL(
      this.config.get<string>('GATEWAY_BASE_URL', 'https://api.branchpay.com.br/api'),
    ).host;
    let host: string;
    try {
      host = new URL(base).host;
    } catch {
      throw new BadRequestException('URL pública inválida');
    }
    if (host === gatewayHost) {
      throw new BadRequestException(
        'A URL informada é a do próprio gateway. Informe a URL pública da SUA API (ex.: um túnel ngrok apontando para a porta 3000).',
      );
    }
  }

  private isLocalUrl(url: string): boolean {
    const h = new URL(url).hostname;
    return (
      h === 'localhost' ||
      h === '0.0.0.0' ||
      h.endsWith('.local') ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    );
  }
}
