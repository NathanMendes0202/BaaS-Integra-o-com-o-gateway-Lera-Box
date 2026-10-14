import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { Order } from '../checkout/order.entity';
import { OrdersService } from '../checkout/orders.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { Withdrawal } from '../withdrawals/withdrawal.entity';

const BATCH = 50;
const NO_GATEWAY_REF_MS = 5 * 60_000;
const LATE_PAYMENT_WINDOW_MS = 2 * 60 * 60_000;
const MAX_POLL_AGE_MS = 7 * 24 * 60 * 60_000;

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly intervalMs: number;
  private readonly pixTtlMs: number;

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Withdrawal) private readonly withdrawals: Repository<Withdrawal>,
    private readonly ordersService: OrdersService,
    private readonly withdrawalsService: WithdrawalsService,
    config: ConfigService,
  ) {
    this.intervalMs = Number(config.get<string>('RECONCILE_INTERVAL_SECONDS', '60')) * 1000;
    this.pixTtlMs = Number(config.get<string>('PIX_EXPIRES_MINUTES', '30')) * 60_000;
  }

  onModuleInit() {
    if (!(this.intervalMs > 0)) return;
    this.timer = setInterval(() => void this.run(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcileOrders();
      await this.reconcileWithdrawals();
    } catch (err) {
      this.logger.error(`Conciliação falhou: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async reconcileOrders() {
    const pending = await this.orders.find({
      where: { status: 'PENDING', createdAt: MoreThan(new Date(Date.now() - MAX_POLL_AGE_MS)) },
      order: { createdAt: 'ASC' },
      take: BATCH,
    });
    const late = await this.orders.find({
      where: { status: 'EXPIRED', method: 'PIX', updatedAt: MoreThan(new Date(Date.now() - LATE_PAYMENT_WINDOW_MS)) },
      order: { updatedAt: 'DESC' },
      take: BATCH,
    });

    for (const order of [...pending, ...late]) {
      try {
        await this.reconcileOrder(order);
      } catch (err) {
        this.logger.warn(`Pedido ${order.externalReference}: ${(err as Error).message}`);
      }
    }
  }

  private async reconcileOrder(order: Order) {
    const age = Date.now() - order.createdAt.getTime();
    const hasRef = !!(order.gatewayPaymentId ?? order.gatewayTxid);

    if (hasRef) {
      try {
        await this.ordersService.reconcile(order);
      } catch (err) {
        this.logger.warn(`Pedido ${order.externalReference}: ${(err as Error).message}`);
      }
    } else if (order.status === 'PENDING' && age > NO_GATEWAY_REF_MS) {
      await this.ordersService.applyStatus(order.userId, {
        orderId: order.id,
        status: 'DENIED',
        reason: 'O pagamento não chegou a ser enviado ao gateway',
      });
      return;
    }

    if (order.status === 'PENDING' && order.method === 'PIX' && age > this.pixTtlMs) {
      const fresh = await this.orders.findOneBy({ id: order.id });
      if (fresh?.status === 'PENDING') {
        await this.ordersService.applyStatus(order.userId, {
          orderId: order.id,
          status: 'EXPIRED',
          reason: 'Pix não pago dentro do prazo',
        });
      }
    }
  }

  private async reconcileWithdrawals() {
    const pending = await this.withdrawals.find({
      where: { status: 'PENDING', gatewayId: Not(IsNull()) },
      order: { createdAt: 'ASC' },
      take: BATCH,
    });
    for (const w of pending) {
      try {
        await this.withdrawalsService.get(w.userId, w.id); // consulta o gateway e atualiza o status
      } catch (err) {
        this.logger.warn(`Saque ${w.externalReference}: ${(err as Error).message}`);
      }
    }
  }
}
