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

// Assignment Status
export enum AssignmentStatus {
  PENDING = 'pending',           // Offer sent, waiting for influencer response
  ACCEPTED = 'accepted',         // Influencer accepted the offer
  REJECTED = 'rejected',         // Influencer rejected the offer
  CANCELLED = 'cancelled',       // Admin cancelled the assignment
  IN_PROGRESS = 'in_progress',   // Work is in progress
  COMPLETED = 'completed',       // Assignment completed
  EXPIRED = 'expired',           // Offer expired without response
}

@Entity('campaign_assignments')
export class CampaignAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ============================================
  // Relationships
  // ============================================
  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignEntity;

  @Column({ type: 'uuid' })
  influencerId: string;

  @ManyToOne(() => InfluencerProfileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'influencerId' })
  influencer: InfluencerProfileEntity;

  // Admin who assigned this
  @Column({ type: 'uuid' })
  assignedBy: string;

  // ============================================
  // Offer Details
  // ============================================
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  offeredAmount: number; // Amount offered to this influencer

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  offerMessage: string; // Custom message to influencer

  @Column({ type: 'text', nullable: true })
  offerTerms: string; // Specific terms for this influencer

  // Specific milestones/deliverables for this influencer (JSON)
  @Column({ type: 'jsonb', nullable: true })
  assignedMilestones: {
    contentTitle: string;
    platform: string;
    contentQuantity: string;
    deliveryDays: number;
    expectedReach?: number;
    expectedViews?: number;
    expectedLikes?: number;
    expectedComments?: number;
  }[];

  // ============================================
  // Status & Tracking
  // ============================================
  @Column({
    type: 'varchar',
    length: 30,
    default: AssignmentStatus.PENDING,
  })
  status: string;

  @Column({ type: 'date', nullable: true })
  offerExpiresAt: Date; // When the offer expires

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date; // When influencer responded

  @Column({ type: 'text', nullable: true })
  responseMessage: string; // Influencer's response message

  @Column({ type: 'text', nullable: true })
  rejectionReason: string; // If rejected, reason why

  // ============================================
  // Progress Tracking
  // ============================================
  @Column({ type: 'int', default: 0 })
  completedMilestones: number;

  @Column({ type: 'int', default: 0 })
  totalMilestones: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  // ============================================
  // Timestamps
  // ============================================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
