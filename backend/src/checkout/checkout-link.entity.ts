import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CardBrand, LinkStatus, PaymentMethod } from './checkout.constants';

export const decimalToNumber = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** Link/sessão de checkout criado pelo lojista. */
@Entity('checkout_links')
export class CheckoutLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador público usado na URL de pagamento. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'varchar', length: 10 })
  method: PaymentMethod;

  /** Valor cobrado, em centavos. */
  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  brand: CardBrand | null;

  @Column({ type: 'int', nullable: true })
  installments: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, transformer: decimalToNumber })
  feePercent: number | null;

  @Column({ type: 'int', default: 0 })
  feeCents: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  externalReference: string;

  @Index()
  @Column({ type: 'varchar', length: 12, default: 'ACTIVE' })
  status: LinkStatus;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
