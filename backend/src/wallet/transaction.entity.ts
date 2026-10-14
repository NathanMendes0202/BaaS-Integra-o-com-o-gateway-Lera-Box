import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('transactions')
@Index(['userId', 'gatewayId'], { unique: true })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 80 })
  gatewayId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  type: string | null;

  @Column({ type: 'varchar', length: 12 })
  status: string;

  @Column({ type: 'bigint', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  amountCents: number;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  externalReference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'datetime', nullable: true })
  occurredAt: Date | null;

  @Column({ type: 'json', nullable: true })
  raw: Record<string, unknown> | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
