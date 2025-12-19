import { UserEntity } from 'src/influencer/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';

@Entity('login_logs')
export class LoginLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  device: string; // e.g., "iPhone 13 Pro", "Windows 10 PC"

  @Column({ nullable: true })
  browser: string; // e.g., "Chrome", "Safari"

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  location: string; // e.g., "Dhaka, BD"

  @Column({ default: 'success' })
  status: string; // 'success' | 'failed' | 'password_changed'

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user: UserEntity;
}
