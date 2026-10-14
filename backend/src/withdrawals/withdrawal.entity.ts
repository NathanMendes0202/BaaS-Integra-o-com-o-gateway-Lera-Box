import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '../common/gateway-utils';

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  externalReference: string;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  gatewayId: string | null;

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 10 })
  destinationType: 'PIX' | 'BANK';

  @Column({ type: 'json' })
  destination: Record<string, unknown>;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
