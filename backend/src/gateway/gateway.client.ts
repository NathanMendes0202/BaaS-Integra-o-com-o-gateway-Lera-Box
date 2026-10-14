import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCorrelationId } from '../common/request-context';
import { pick, str, unwrap } from '../common/gateway-utils';
import { canonicalBrand, FeeRow, normalizeFees } from './fees.mapper';
import { GatewayError } from './gateway.error';

interface RequestOptions {
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface GatewayLogin {
  token: string;
  clientCode: string | null;
  storeKey: string | null;
}

@Injectable()
export class GatewayClient {
  private readonly logger = new Logger(GatewayClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('GATEWAY_BASE_URL', 'https://api.branchpay.com.br/api')
      .replace(/\/$/, '');
  }

  async request<T = any>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const correlationId = getCorrelationId();
    if (correlationId) headers['X-Correlation-Id'] = correlationId;

    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`${method} ${url.pathname} falhou: ${(err as Error).message}`);
      throw new GatewayError(502, 'Gateway indisponível. Tente novamente em instantes.');
    }

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text.slice(0, 200) };
    }
    this.logger.log(`${method} ${url.pathname} -> ${res.status} (${Date.now() - started}ms)`);

    if (!res.ok) {
      const message = Array.isArray(data?.message)
        ? data.message.join('; ')
        : (data?.message ?? data?.error ?? `Gateway respondeu ${res.status}`);
      throw new GatewayError(res.status, String(message), data);
    }
    return data as T;
  }

  // ---- Conta ----
  register(body: Record<string, unknown>) {
    return this.request('POST', '/users', { body });
  }

  async login(document: string, password: string): Promise<GatewayLogin> {
    const raw = await this.request('POST', '/auth/login', { body: { document, password } });
    const data = unwrap(raw);
    const token = pick(data, 'accessToken', 'access_token', 'token');
    if (!token) throw new GatewayError(502, 'Resposta de login do gateway sem token');
    return {
      token: String(token),
      clientCode: str(pick(data, 'CodigoCliente', 'codigoCliente', 'clientCode')),
      storeKey: str(pick(data, 'ChaveLoja', 'chaveLoja', 'storeKey')),
    };
  }

  // ---- Taxas ----
  async fees(brand?: string): Promise<FeeRow[]> {
    const raw = await this.request('GET', '/fees');
    const all = normalizeFees(raw);
    if (!all.length) {
      throw new GatewayError(
        502,
        `Não foi possível interpretar a tabela de taxas do gateway: ${JSON.stringify(raw).slice(0, 300)}`,
        raw,
      );
    }
    if (!brand) return all;
    const wanted = canonicalBrand(brand);
    const rows = all.filter((r) => r.brand === wanted);
    if (!rows.length) {
      const found = [...new Set(all.map((r) => r.brand))].join(', ');
      throw new GatewayError(422, `Sem taxas para a bandeira ${brand}. Bandeiras encontradas: ${found}`);
    }
    return rows;
  }

  // ---- Carteira ----
  wallet(token: string) {
    return this.request('GET', '/wallet', { token });
  }

  walletTransactions(token: string, query: { status?: string; type?: string; limit?: number }) {
    return this.request('GET', '/wallet/transactions', { token, query });
  }

  // ---- Pagamentos ----
  createPix(token: string, body: Record<string, unknown>) {
    return this.request('POST', '/payments/pix', { token, body });
  }

  createCard(token: string, body: Record<string, unknown>) {
    return this.request('POST', '/payments/card', { token, body });
  }

  getPayment(token: string, id: string) {
    return this.request('GET', `/payments/${encodeURIComponent(id)}`, { token });
  }

  // ---- Saques ----
  createWithdrawal(token: string, body: Record<string, unknown>) {
    return this.request('POST', '/withdrawals', { token, body });
  }

  getWithdrawal(token: string, id: string) {
    return this.request('GET', `/withdrawals/${encodeURIComponent(id)}`, { token });
  }

  // ---- Webhooks ----
  listWebhooks(token: string) {
    return this.request('GET', '/webhooks', { token });
  }

  createWebhook(token: string, body: Record<string, unknown>) {
    return this.request('POST', '/webhooks', { token, body });
  }

  deleteWebhook(token: string, id: string) {
    return this.request('DELETE', `/webhooks/${encodeURIComponent(id)}`, { token });
  }
}
