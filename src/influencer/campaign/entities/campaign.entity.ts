import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientProfileEntity } from 'src/influencer/client/entities/client-profile.entity';
import { InfluencerProfileEntity } from 'src/influencer/influencer/entities/influencer-profile.entity';
import { CampaignMilestoneEntity } from './campaign-milestone.entity';
import { CampaignAssetEntity } from './campaign-asset.entity';
import { CampaignNegotiationEntity } from './campaign-negotiation.entity';
import { CampaignAssignmentEntity } from './campaign-assignment.entity';

// Campaign Type
export enum CampaignType {
  PAID_AD = 'paid_ad',
  INFLUENCER_PROMOTION = 'influencer_promotion',
}

// Campaign Status
export enum CampaignStatus {
  NEEDS_QUOTE = 'needs_quote',       // Default - waiting for admin to provide quote
  ACTIVE = 'active',                  // Campaign is active/running
  PENDING_INVITATION = 'pending_invitation', // Waiting for influencer responses
  COMPLETED = 'completed',            // Campaign completed successfully
  PAID = 'paid',                      // Payment completed
  CANCELLED = 'cancelled',            // Campaign cancelled
}

// Platform Types for reference
export enum Platform {
  FACEBOOK = 'facebook',
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
}

@Entity('campaigns')
export class CampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ============================================
  // STEP 1: Basic Campaign Information
  // ============================================
  @Column()
  campaignName: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  campaignType: string;

  // ============================================
  // STEP 2: Targeting & Influencer Preferences
  // ============================================
  @Column({ nullable: true })
  productType: string;

  @Column({ nullable: true })
  campaignNiche: string;

  // Preferred Influencers (Many-to-Many)
  @ManyToMany(() => InfluencerProfileEntity)
  @JoinTable({
    name: 'campaign_preferred_influencers',
    joinColumn: { name: 'campaignId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'influencerId', referencedColumnName: 'id' },
  })
  preferredInfluencers: InfluencerProfileEntity[];

  // Not Preferable Influencers (Many-to-Many)
  @ManyToMany(() => InfluencerProfileEntity)
  @JoinTable({
    name: 'campaign_not_preferable_influencers',
    joinColumn: { name: 'campaignId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'influencerId', referencedColumnName: 'id' },
  })
  notPreferableInfluencers: InfluencerProfileEntity[];

  // ============================================
  // STEP 3: Campaign Details
  // ============================================
  @Column({ type: 'text', nullable: true })
  campaignGoals: string;

  @Column({ type: 'text', nullable: true })
  productServiceDetails: string;

  @Column({ type: 'text', nullable: true })
  reportingRequirements: string;

  @Column({ type: 'text', nullable: true })
  usageRights: string;

  @Column({ type: 'date', nullable: true })
  startingDate: Date;

  @Column({ type: 'int', nullable: true })
  duration: number; // Duration in days

  // ============================================
  // STEP 4: Budget & Campaign Milestones
  // ============================================
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  baseBudget: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  vatAmount: number; // 15% VAT

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalBudget: number; // baseBudget + VAT

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  netPayableAmount: number; // Final amount

  // Milestones (One-to-Many)
  @OneToMany(() => CampaignMilestoneEntity, (milestone) => milestone.campaign, {
    cascade: true,
    eager: true,
  })
  milestones: CampaignMilestoneEntity[];

  // ============================================
  // STEP 5: Content Assets & Final Setup
  // ============================================
  // Assets (One-to-Many)
  @OneToMany(() => CampaignAssetEntity, (asset) => asset.campaign, {
    cascade: true,
    eager: true,
  })
  assets: CampaignAssetEntity[];

  @Column({ default: false })
  needSampleProduct: boolean;

  // ============================================
  // Campaign Status & Tracking
  // ============================================
  @Column({
    type: 'varchar',
    length: 30,
    default: 'needs_quote',
  })
  status: string;

  // Track which step the client is on (1-5)
  @Column({ type: 'int', default: 1 })
  currentStep: number;

  // Track if campaign is finalized/placed
  @Column({ default: false })
  isPlaced: boolean;

  @Column({ type: 'timestamp', nullable: true })
  placedAt: Date;

  // ============================================
  // Negotiation
  // ============================================
  @OneToMany(() => CampaignNegotiationEntity, (negotiation) => negotiation.campaign, {
    cascade: true,
  })
  negotiations: CampaignNegotiationEntity[];

  // Track whose turn it is to respond: 'client' or 'admin'
  @Column({ type: 'varchar', nullable: true })
  negotiationTurn: 'client' | 'admin' | null;

  // ============================================
  // Assignments (Influencers assigned to this campaign)
  // ============================================
  @OneToMany(() => CampaignAssignmentEntity, (assignment) => assignment.campaign, {
    cascade: true,
  })
  assignments: CampaignAssignmentEntity[];

  // ============================================
  // Relationships
  // ============================================
  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => ClientProfileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: ClientProfileEntity;

  // Admin who is handling this campaign (optional)
  @Column({ type: 'uuid', nullable: true })
  assignedAdminId: string;

  // ============================================
  // Timestamps
  // ============================================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
