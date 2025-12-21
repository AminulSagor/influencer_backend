import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { InfluencerProfileEntity } from 'src/influencer/influencer/entities/influencer-profile.entity';

export enum JobStatus {
  NEW_OFFER = 'new_offer', // Campaign assigned, waiting for response
  PENDING = 'pending', // Accepted, but not started yet
  ACTIVE = 'active', // Work in progress
  COMPLETED = 'completed', // Job finished
  DECLINED = 'declined', // Influencer declined
  CANCELLED = 'cancelled',
}

@Entity('campaign_assignments')
export class CampaignAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignEntity;

  @Column({ type: 'uuid' })
  influencerId: string;

  @ManyToOne(() => InfluencerProfileEntity)
  @JoinColumn({ name: 'influencerId' })
  influencer: InfluencerProfileEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  offeredAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  percentage: number;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.NEW_OFFER })
  status: JobStatus;

  @Column()
  assignedBy: string; // 'admin' or 'agency'

  // ✅ ADDED: Fields for Product Delivery & Payments
  @Column({ type: 'text', nullable: true })
  deliveryAddress: string;

  @Column({ default: 'pending' }) // pending, shipped, received
  deliveryStatus: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;
  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
