import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_events')
@Index(['accountId', 'eventKey'], { unique: true })
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  accountId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  eventKey: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  eventType: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  gatewayStatus: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', length: 12, default: 'RECEIVED' })
  status: 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';

  @Column({ type: 'boolean', default: false })
  signatureValid: boolean;

  @Column({ type: 'json' })
  payload: unknown;

  @Column({ type: 'varchar', length: 255, nullable: true })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  processedAt: Date | null;
}
