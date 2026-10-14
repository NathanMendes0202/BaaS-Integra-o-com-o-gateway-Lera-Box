import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Vínculo do lojista com a conta no gateway.
 * Senha, token e secret de webhook ficam criptografados (AES-256-GCM).
 */
@Entity('gateway_accounts')
export class GatewayAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  document: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  clientCode: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  storeKey: string | null;

  @Column({ type: 'text' })
  encryptedPassword: string;

  @Column({ type: 'text', nullable: true })
  encryptedToken: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  webhookToken: string;

  @Column({ type: 'text' })
  encryptedWebhookSecret: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
