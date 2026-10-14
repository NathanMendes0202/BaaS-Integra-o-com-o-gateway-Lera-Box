import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
