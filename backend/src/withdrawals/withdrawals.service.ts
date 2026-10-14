import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { FindOptionsWhere, Repository } from 'typeorm';
import { normalizeStatus, OrderStatus, pick, str, unwrap } from '../common/gateway-utils';
import { GatewayClient } from '../gateway/gateway.client';
import { GatewaySessionService } from '../gateway/gateway-session.service';
import { CreateWithdrawalDto } from './withdrawals.dto';
import { Withdrawal } from './withdrawal.entity';

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    @InjectRepository(Withdrawal) private readonly repo: Repository<Withdrawal>,
    private readonly session: GatewaySessionService,
    private readonly client: GatewayClient,
  ) {}

  async create(userId: string, dto: CreateWithdrawalDto) {
    await this.session.getAccount(userId);
    const destination: Record<string, unknown> = { pixKey: dto.pixKey, document: dto.document };

    const withdrawal = await this.repo.save(
      this.repo.create({
        userId,
        externalReference: `WDR-${randomBytes(9).toString('base64url')}`,
        amountCents: dto.amountCents,
        destinationType: 'PIX',
        destination,
        status: 'PENDING',
        gatewayId: null,
        failureReason: null,
      }),
    );

    try {
      const raw = await this.session.call(userId, (token) =>
        this.client.createWithdrawal(token, {
          amount: dto.amountCents, // centavos
          externalReference: withdrawal.externalReference,
          ...destination,
        }),
      );
      const data = unwrap(raw);
      withdrawal.gatewayId = str(pick(data, 'id', 'withdrawalId'));
      const status = normalizeStatus(pick(data, 'status'));
      if (status !== 'PENDING') {
        withdrawal.status = status;
        withdrawal.failureReason = str(pick(data, 'failureReason', 'reason', 'message'));
      }
      await this.repo.save(withdrawal);
    } catch (err) {
      withdrawal.status = 'DENIED';
      withdrawal.failureReason = (err instanceof Error ? err.message : 'Erro ao solicitar saque').slice(0, 255);
      await this.repo.save(withdrawal);
      throw err;
    }
    return this.toView(withdrawal);
  }

  async list(userId: string) {
    const items = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
    return items.map((w) => this.toView(w));
  }

  async get(userId: string, id: string) {
    const withdrawal = await this.repo.findOneBy({ id, userId });
    if (!withdrawal) throw new NotFoundException('Saque não encontrado');
    if (withdrawal.status === 'PENDING' && withdrawal.gatewayId) {
      const raw = await this.session.call(userId, (token) =>
        this.client.getWithdrawal(token, withdrawal.gatewayId as string),
      );
      const data = unwrap(raw);
      await this.applyStatus(userId, {
        id,
        status: normalizeStatus(pick(data, 'status')),
        reason: str(pick(data, 'failureReason', 'reason', 'message')),
      });
      return this.toView((await this.repo.findOneBy({ id })) as Withdrawal);
    }
    return this.toView(withdrawal);
  }

  async applyStatus(
    userId: string,
    update: { id?: string; externalReference?: string | null; gatewayId?: string | null; status: OrderStatus; reason?: string | null },
  ): Promise<Withdrawal | null> {
    const where: FindOptionsWhere<Withdrawal>[] = [];
    if (update.id) where.push({ id: update.id, userId });
    if (update.externalReference) where.push({ externalReference: update.externalReference, userId });
    if (update.gatewayId) where.push({ gatewayId: update.gatewayId, userId });
    if (!where.length) return null;

    const withdrawal = await this.repo.findOne({ where });
    if (!withdrawal) return null;
    if (withdrawal.status !== 'PENDING' || update.status === 'PENDING') return withdrawal;

    const res = await this.repo.update(
      { id: withdrawal.id, status: 'PENDING' },
      { status: update.status, failureReason: update.reason ? String(update.reason).slice(0, 255) : null },
    );
    if (res.affected) this.logger.log(`Saque ${withdrawal.externalReference} -> ${update.status}`);
    return this.repo.findOneBy({ id: withdrawal.id });
  }

  private toView(w: Withdrawal) {
    return {
      id: w.id,
      externalReference: w.externalReference,
      amountCents: w.amountCents,
      destinationType: w.destinationType,
      destination: w.destination,
      status: w.status,
      failureReason: w.failureReason,
      createdAt: w.createdAt,
    };
  }
}
