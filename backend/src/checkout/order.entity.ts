import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '../common/gateway-utils';
import { PaymentMethod } from './checkout.constants';
import { decimalToNumber } from './checkout-link.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  linkId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  externalReference: string;

  @Column({ type: 'varchar', length: 10 })
  method: PaymentMethod;

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'int', nullable: true })
  installments: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, transformer: decimalToNumber })
  feePercent: number | null;

  @Index()
  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: OrderStatus;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  gatewayPaymentId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  gatewayTxid: string | null;

  @Column({ type: 'text', nullable: true })
  pixEmv: string | null;

  @Column({ type: 'mediumtext', nullable: true })
  pixQrCodeBase64: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  payerName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  payerDocument: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason: string | null;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
