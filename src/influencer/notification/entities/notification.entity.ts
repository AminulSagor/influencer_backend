import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../influencer/user/entities/user.entity';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string; // Who receives the notification

  @Column({ type: 'enum', enum: UserRole })
  userRole: UserRole; // Role of receiver

  @Column()
  title: string; // Short title (e.g., "Niche Rejected")

  @Column()
  message: string; // Detailed message (e.g., "Reason: Duplicate entry")

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: 'system' })
  type: string; // 'system' | 'verification' | 'payment'

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;
}
