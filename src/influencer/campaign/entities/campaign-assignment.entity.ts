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

// ============================================
// Job Status - Simple 5-Stage Workflow
// ============================================
// NEW_OFFER  → Influencer receives offer (can accept or decline)
// PENDING    → Accepted but work not started yet
// ACTIVE     → Work in progress
// COMPLETED  → Job finished successfully
// DECLINED   → Influencer declined the offer
// ============================================
export enum JobStatus {
  NEW_OFFER = 'new_offer',   // Campaign assigned, waiting for response
  PENDING = 'pending',       // Accepted, but not started yet
  ACTIVE = 'active',         // Work in progress
  COMPLETED = 'completed',   // Job finished
  DECLINED = 'declined',     // Influencer declined
}

// Keep old enum for backward compatibility (alias)
export const AssignmentStatus = JobStatus;
export type AssignmentStatus = JobStatus;

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
  // Payment Details (Auto-calculated from campaign budget)
  // ============================================
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentage: number; // e.g., 33.33 for 33.33%

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  offeredAmount: number; // Calculated: campaign.baseBudget * (percentage / 100)

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalAmount: number;

  // ============================================
  // Job Details (Simple)
  // ============================================
  @Column({ type: 'text', nullable: true })
  message: string | null; // Optional message to influencer

  @Column({ type: 'text', nullable: true })
  declineReason: string | null; // If declined, why

  // ============================================
  // Influencer Delivery Address (Captured on job acceptance)
  // ============================================
  @Column({ type: 'varchar', length: 100, nullable: true })
  influencerAddressName: string | null; // e.g., "Home", "Studio"

  @Column({ type: 'varchar', length: 255, nullable: true })
  influencerStreet: string | null; // Street address

  @Column({ type: 'varchar', length: 100, nullable: true })
  influencerThana: string | null; // Thana/Police station

  @Column({ type: 'varchar', length: 100, nullable: true })
  influencerZilla: string | null; // District/City

  @Column({ type: 'text', nullable: true })
  influencerFullAddress: string | null; // Complete formatted address

  // ============================================
  // Job Status - 5 Stages
  // ============================================
  @Column({
    type: 'varchar',
    length: 20,
    default: JobStatus.NEW_OFFER,
  })
  status: JobStatus;

  // ============================================
  // Timeline Tracking
  // ============================================
  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date; // When influencer accepted

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date; // When work started

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // When job completed

  @Column({ type: 'timestamp', nullable: true })
  declinedAt: Date; // When declined

  // ============================================
  // Timestamps
  // ============================================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
