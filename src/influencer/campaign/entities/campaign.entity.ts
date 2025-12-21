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
import { ClientProfileEntity } from '../../client/entities/client-profile.entity';
import { InfluencerProfileEntity } from '../../influencer/entities/influencer-profile.entity';
import { AgencyProfileEntity } from '../../agency/entities/agency-profile.entity';
import { CampaignMilestoneEntity } from './campaign-milestone.entity';
import { CampaignAssetEntity } from './campaign-asset.entity';
import { CampaignNegotiationEntity } from './campaign-negotiation.entity';
import { CampaignAssignmentEntity } from './campaign-assignment.entity';

// Matches "Step 1" UI
export enum CampaignType {
  PAID_AD = 'paid_ad',
  INFLUENCER_PROMOTION = 'influencer_promotion',
}

// Matches "Overview" Tabs
export enum CampaignStatus {
  DRAFT = 'draft',
  RECEIVED = 'received', // "Needs Quote"
  QUOTED = 'quoted', // "Quote Received"
  NEGOTIATING = 'negotiating', // Client requested change
  ACCEPTED = 'accepted', // Client accepted (Waiting Payment)
  ACTIVE = 'active', // "Active" / "Promoting"
  COMPLETED = 'completed', // "Completed"
  CANCELLED = 'cancelled', // "Canceled"
  IN_REVIEW = 'in_review',

  // Internal Agency States (mapped to 'Active' for client view usually)

  PENDING_AGENCY = 'pending_agency',
  AGENCY_ACCEPTED = 'agency_accepted',
  PROMOTING = 'promoting',

  // Funding Statuses
  PARTIAL_PAID = 'partial_paid', // Added
  PAID = 'paid', // Added
  AGENCY_NEGOTIATING = 'agency_negotiating',
}

// Payment Status Enum
export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  FULL = 'full',
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

  // --- Step 1 ---
  @Column()
  campaignName: string;

  @Column({ type: 'enum', enum: CampaignType })
  campaignType: CampaignType;

  // --- Step 2 ---
  @Column({ type: 'varchar', nullable: true })
  productType: string | null;

  @Column({ type: 'varchar', nullable: true })
  campaignNiche: string | null;

  @ManyToMany(() => InfluencerProfileEntity)
  @JoinTable({ name: 'campaign_preferred_influencers' })
  preferredInfluencers: InfluencerProfileEntity[];

  @ManyToMany(() => InfluencerProfileEntity)
  @JoinTable({ name: 'campaign_not_preferable_influencers' })
  notPreferableInfluencers: InfluencerProfileEntity[];

  @Column({ type: 'uuid', nullable: true }) agencyId: string | null;
  @ManyToOne(() => AgencyProfileEntity, { nullable: true })
  @JoinColumn({ name: 'agencyId' })
  agency: AgencyProfileEntity | null;

  // ============================================
  // ADMIN: Platform Profit & Vendor Management
  // ============================================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformFee: number; // The amount Admin keeps (Profit)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  availableForVendor: number; // The remaining amount for Influencers/Agencies

  // --- Step 3 ---
  @Column({ type: 'text', nullable: true }) campaignGoals: string | null;
  @Column({ type: 'text', nullable: true }) productServiceDetails:
    | string
    | null;
  @Column({ type: 'text', nullable: true }) dos: string | null;
  @Column({ type: 'text', nullable: true }) donts: string | null;
  @Column({ type: 'text', nullable: true }) reportingRequirements:
    | string
    | null;
  @Column({ type: 'text', nullable: true }) usageRights: string | null;
  @Column({ type: 'date', nullable: true }) startingDate: Date | null;
  @Column({ type: 'int', nullable: true }) duration: number | null;

  // --- Step 4 (Budget & Targets) ---
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  clientBudget: number | null;

  @Column({ type: 'int', nullable: true }) targetReach: number | null;
  @Column({ type: 'int', nullable: true }) targetViews: number | null;
  @Column({ type: 'int', nullable: true }) targetLikes: number | null;
  @Column({ type: 'int', nullable: true }) targetComments: number | null;

  // --- Admin/Agency Financials (Required for CampaignService) ---
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  baseBudget: number; // ✅ Added back

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  vatAmount: number; // ✅ Added back

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalBudget: number; // ✅ Added back

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  netPayableAmount: number; // ✅ Added back

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  quotedBaseBudget: number | null; // Added

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  quotedVatAmount: number | null; // Added

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  quotedTotalBudget: number | null;

  // ✅ NEW: Payment Status Column
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  // --- Assets & Milestones ---
  @OneToMany(() => CampaignMilestoneEntity, (m) => m.campaign, {
    cascade: true,
  })
  milestones: CampaignMilestoneEntity[];

  @OneToMany(() => CampaignAssetEntity, (a) => a.campaign, { cascade: true })
  assets: CampaignAssetEntity[];

  @Column({ default: false }) needSampleProduct: boolean;

  // --- Status & System ---
  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ type: 'int', default: 1 }) currentStep: number;
  @Column({ default: false }) isPlaced: boolean;
  @Column({ type: 'timestamp', nullable: true }) placedAt: Date;

  // --- Negotiation & Workflow ---
  @OneToMany(() => CampaignNegotiationEntity, (n) => n.campaign, {
    cascade: true,
  })
  negotiations: CampaignNegotiationEntity[]; // ✅ Added back

  @Column({ type: 'varchar', nullable: true })
  negotiationTurn: 'client' | 'admin' | 'agency' | null; // ✅ Added back

  @OneToMany(() => CampaignAssignmentEntity, (a) => a.campaign, {
    cascade: true,
  })
  assignments: CampaignAssignmentEntity[];

  // --- Relations ---
  @Column({ type: 'uuid' }) clientId: string;
  @ManyToOne(() => ClientProfileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: ClientProfileEntity;

  @Column({ type: 'uuid', nullable: true }) assignedAdminId: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   ManyToOne,
//   OneToMany,
//   ManyToMany,
//   JoinTable,
//   JoinColumn,
//   CreateDateColumn,
//   UpdateDateColumn,
// } from 'typeorm';
// import { ClientProfileEntity } from 'src/influencer/client/entities/client-profile.entity';
// import { InfluencerProfileEntity } from 'src/influencer/influencer/entities/influencer-profile.entity';
// import { CampaignMilestoneEntity } from './campaign-milestone.entity';
// import { CampaignAssetEntity } from './campaign-asset.entity';
// import { CampaignNegotiationEntity } from './campaign-negotiation.entity';
// import { CampaignAssignmentEntity } from './campaign-assignment.entity';

// // Campaign Type
// export enum CampaignType {
//   PAID_AD = 'paid_ad',
//   INFLUENCER_PROMOTION = 'influencer_promotion',
// }

// // Campaign Status - Proper Flow
// export enum CampaignStatus {
//   RECEIVED = 'received',             // Client created, Admin received it
//   QUOTED = 'quoted',                 // Admin sent quote to client
//   PAID = 'paid',                     // Client paid for the campaign
//   PROMOTING = 'promoting',           // Active - Influencers working on it
//   COMPLETED = 'completed',           // Campaign completed successfully
//   CANCELLED = 'cancelled',           // Campaign cancelled
// }

// // Legacy alias for backward compatibility
// export const CampaignStatusLegacy = {
//   NEEDS_QUOTE: 'received',
//   ACTIVE: 'promoting',
//   PENDING_INVITATION: 'promoting',
// };

// // Platform Types for reference
// export enum Platform {
//   FACEBOOK = 'facebook',
//   YOUTUBE = 'youtube',
//   TIKTOK = 'tiktok',
//   INSTAGRAM = 'instagram',
// }

// @Entity('campaigns')
// export class CampaignEntity {
//   @PrimaryGeneratedColumn('uuid')
//   id: string;

//   // ============================================
//   // STEP 1: Basic Campaign Information
//   // ============================================
//   @Column()
//   campaignName: string;

//   @Column({
//     type: 'varchar',
//     length: 50,
//   })
//   campaignType: string;

//   // ============================================
//   // STEP 2: Targeting & Influencer Preferences
//   // ============================================
//   @Column({ nullable: true })
//   productType: string;

//   @Column({ nullable: true })
//   campaignNiche: string;

//   // Preferred Influencers (Many-to-Many)
//   @ManyToMany(() => InfluencerProfileEntity)
//   @JoinTable({
//     name: 'campaign_preferred_influencers',
//     joinColumn: { name: 'campaignId', referencedColumnName: 'id' },
//     inverseJoinColumn: { name: 'influencerId', referencedColumnName: 'id' },
//   })
//   preferredInfluencers: InfluencerProfileEntity[];

//   // Not Preferable Influencers (Many-to-Many)
//   @ManyToMany(() => InfluencerProfileEntity)
//   @JoinTable({
//     name: 'campaign_not_preferable_influencers',
//     joinColumn: { name: 'campaignId', referencedColumnName: 'id' },
//     inverseJoinColumn: { name: 'influencerId', referencedColumnName: 'id' },
//   })
//   notPreferableInfluencers: InfluencerProfileEntity[];

//   // ============================================
//   // STEP 3: Campaign Details
//   // ============================================
//   @Column({ type: 'text', nullable: true })
//   campaignGoals: string;

//   @Column({ type: 'text', nullable: true })
//   productServiceDetails: string;

//   @Column({ type: 'text', nullable: true })
//   reportingRequirements: string;

//   @Column({ type: 'text', nullable: true })
//   usageRights: string;

//   @Column({ type: 'date', nullable: true })
//   startingDate: Date;

//   @Column({ type: 'int', nullable: true })
//   duration: number; // Duration in days

//   // ============================================
//   // STEP 4: Budget & Campaign Milestones
//   // ============================================
//   @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
//   baseBudget: number;

//   @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
//   vatAmount: number; // 15% VAT

//   @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
//   totalBudget: number; // baseBudget + VAT

//   @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
//   netPayableAmount: number; // Final amount

//   // Milestones (One-to-Many)
//   @OneToMany(() => CampaignMilestoneEntity, (milestone) => milestone.campaign, {
//     cascade: true,
//     eager: true,
//   })
//   milestones: CampaignMilestoneEntity[];

//   // ============================================
//   // STEP 5: Content Assets & Final Setup
//   // ============================================
//   // Assets (One-to-Many)
//   @OneToMany(() => CampaignAssetEntity, (asset) => asset.campaign, {
//     cascade: true,
//     eager: true,
//   })
//   assets: CampaignAssetEntity[];

//   @Column({ default: false })
//   needSampleProduct: boolean;

//   // ============================================
//   // Campaign Status & Tracking
//   // ============================================
//   @Column({
//     type: 'varchar',
//     length: 30,
//     default: 'received',
//   })
//   status: string;

//   // Track which step the client is on (1-5)
//   @Column({ type: 'int', default: 1 })
//   currentStep: number;

//   // Track if campaign is finalized/placed
//   @Column({ default: false })
//   isPlaced: boolean;

//   @Column({ type: 'timestamp', nullable: true })
//   placedAt: Date;

//   // ============================================
//   // Negotiation
//   // ============================================
//   @OneToMany(() => CampaignNegotiationEntity, (negotiation) => negotiation.campaign, {
//     cascade: true,
//   })
//   negotiations: CampaignNegotiationEntity[];

//   // Track whose turn it is to respond: 'client' or 'admin'
//   @Column({ type: 'varchar', nullable: true })
//   negotiationTurn: 'client' | 'admin' | null;

//   // ============================================
//   // Assignments (Influencers assigned to this campaign)
//   // ============================================
//   @OneToMany(() => CampaignAssignmentEntity, (assignment) => assignment.campaign, {
//     cascade: true,
//   })
//   assignments: CampaignAssignmentEntity[];

//   // ============================================
//   // Relationships
//   // ============================================
//   @Column({ type: 'uuid' })
//   clientId: string;

//   @ManyToOne(() => ClientProfileEntity, { onDelete: 'CASCADE' })
//   @JoinColumn({ name: 'clientId' })
//   client: ClientProfileEntity;

//   // Admin who is handling this campaign (optional)
//   @Column({ type: 'uuid', nullable: true })
//   assignedAdminId: string;

//   // ============================================
//   // Timestamps
//   // ============================================
//   @CreateDateColumn()
//   createdAt: Date;

//   @UpdateDateColumn()
//   updatedAt: Date;
// }
