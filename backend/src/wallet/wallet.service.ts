import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In, Repository } from 'typeorm';
import { CheckoutLink } from '../checkout/checkout-link.entity';
import { Order } from '../checkout/order.entity';
import { normalizeStatus, pick, str, toList, unwrap } from '../common/gateway-utils';
import { GatewayClient } from '../gateway/gateway.client';
import { GatewaySessionService } from '../gateway/gateway-session.service';
import { Withdrawal } from '../withdrawals/withdrawal.entity';
import { Transaction } from './transaction.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Transaction) private readonly mirror: Repository<Transaction>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(CheckoutLink) private readonly links: Repository<CheckoutLink>,
    @InjectRepository(Withdrawal) private readonly withdrawals: Repository<Withdrawal>,
    private readonly session: GatewaySessionService,
    private readonly client: GatewayClient,
  ) {}

  async balance(userId: string) {
    const raw = await this.session.call(userId, (t) => this.client.wallet(t));
    const data = unwrap(raw);
    const value = pick(data, 'balance', 'balanceCents', 'saldo', 'availableBalance');
    return { balanceCents: Number(value ?? 0) };
  }

  async statement(userId: string, query: { status?: string; type?: string; limit?: number }) {
    const raw = await this.session.call(userId, (t) =>
      this.client.walletTransactions(t, { status: query.status, type: query.type, limit: query.limit ?? 50 }),
    );

    const items = toList(raw).map((t) => {
      const occurred = new Date(pick(t, 'createdAt', 'date', 'occurredAt') ?? NaN);
      return {
        gatewayId: String(
          pick(t, 'id', 'transactionId', 'uuid') ?? createHash('sha1').update(JSON.stringify(t)).digest('hex'),
        ),
        type: str(pick(t, 'type', 'kind'))?.toUpperCase() ?? null,
        status: normalizeStatus(pick(t, 'status')),
        amountCents: Number(pick(t, 'amount', 'amountCents', 'value') ?? 0),
        externalReference: str(pick(t, 'externalReference', 'external_reference')),
        description: str(pick(t, 'description', 'descricao'))?.slice(0, 255) ?? null,
        occurredAt: Number.isNaN(occurred.getTime()) ? null : occurred,
        raw: t as Record<string, unknown>,
      };
    });

    if (items.length) {
      await this.mirror.upsert(
        items.map((i) => ({ ...i, userId, raw: i.raw as any })),
        ['userId', 'gatewayId'],
      );
    }

    const refs = [...new Set(items.map((i) => i.externalReference).filter((r): r is string => !!r))];
    const orders = refs.length ? await this.orders.find({ where: { userId, externalReference: In(refs) } }) : [];
    const withdrawals = refs.length
      ? await this.withdrawals.find({ where: { userId, externalReference: In(refs) } })
      : [];
    const links = orders.length ? await this.links.find({ where: { id: In(orders.map((o) => o.linkId)) } }) : [];
    const codeByLink = new Map(links.map((l) => [l.id, l.code]));
    const orderByRef = new Map(orders.map((o) => [o.externalReference, o]));
    const withdrawalByRef = new Map(withdrawals.map((w) => [w.externalReference, w]));

    return items.map(({ raw: _raw, ...i }) => {
      const order = i.externalReference ? orderByRef.get(i.externalReference) : undefined;
      const withdrawal = i.externalReference ? withdrawalByRef.get(i.externalReference) : undefined;
      return {
        ...i,
        reconciled: !!(order || withdrawal),
        local: order
          ? { kind: 'ORDER', id: order.id, linkCode: codeByLink.get(order.linkId) ?? null, status: order.status }
          : withdrawal
            ? { kind: 'WITHDRAWAL', id: withdrawal.id, status: withdrawal.status }
            : null,
      };
    });
  }
}
