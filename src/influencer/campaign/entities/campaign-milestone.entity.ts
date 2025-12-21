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

export enum MilestoneStatus {
  PENDING = 'pending', // "To Do"
  IN_REVIEW = 'in_review', // "In Review"
  ACCEPTED = 'accepted', // "Completed"
  DECLINED = 'declined', // "Declined"
}

export enum MilestonePaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial_paid',
  PAID = 'paid',
}

@Entity('campaign_milestones')
export class CampaignMilestoneEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column() contentTitle: string;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Column() contentQuantity: string;
  @Column({ type: 'int' }) deliveryDays: number;

  @Column({ type: 'int', nullable: true }) expectedReach: number;
  @Column({ type: 'int', nullable: true }) expectedViews: number;
  @Column({ type: 'int', nullable: true }) expectedLikes: number;
  @Column({ type: 'int', nullable: true }) expectedComments: number;

  // Execution
  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    default: MilestoneStatus.PENDING,
  })
  status: string;

  @Column({
    type: 'enum',
    enum: MilestonePaymentStatus,
    default: MilestonePaymentStatus.UNPAID,
  })
  paymentStatus: MilestonePaymentStatus;

  @Column({ type: 'text', nullable: true })
  submissionDescription: string | null;
  @Column({ type: 'simple-array', nullable: true })
  submissionAttachments: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  liveLinks: string[] | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  requestedAmount: number | null;

  // ✅ FIX: This is the specific one causing your error
  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  // Actuals
  @Column({ type: 'int', nullable: true, default: 0 }) actualReach: number;
  @Column({ type: 'int', nullable: true, default: 0 }) actualViews: number;
  @Column({ type: 'int', nullable: true, default: 0 }) actualLikes: number;
  @Column({ type: 'int', nullable: true, default: 0 }) actualComments: number;

  @Column({ type: 'int', default: 0 }) order: number;

  // ✅ Relations
  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.milestones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignEntity;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   ManyToOne,
//   JoinColumn,
//   CreateDateColumn,
//   UpdateDateColumn,
// } from 'typeorm';
// import { CampaignEntity, Platform } from './campaign.entity';

// @Entity('campaign_milestones')
// export class CampaignMilestoneEntity {
//   @PrimaryGeneratedColumn('uuid')
//   id: string;

//   // Content Creation Title
//   @Column()
//   contentTitle: string;

//   // Platform (Facebook, YouTube, TikTok, Instagram)
//   @Column({
//     type: 'varchar',
//     length: 50,
//   })
//   platform: string;

//   // Content Quantity (e.g., "1 Sponsored Video", "2 Posts")
//   @Column()
//   contentQuantity: string;

//   // Delivery Timeline in Days
//   @Column({ type: 'int' })
//   deliveryDays: number;

//   // Expected Metrics
//   @Column({ type: 'int', nullable: true })
//   expectedReach: number;

//   @Column({ type: 'int', nullable: true })
//   expectedViews: number;

//   @Column({ type: 'int', nullable: true })
//   expectedLikes: number;

//   @Column({ type: 'int', nullable: true })
//   expectedComments: number;

//   // Milestone Status
//   @Column({ default: 'pending' }) // pending, in_progress, completed, approved
//   status: string;

//   // Order/Sequence of milestone
//   @Column({ type: 'int', default: 0 })
//   order: number;

//   // ============================================
//   // Relationships
//   // ============================================
//   @Column({ type: 'uuid' })
//   campaignId: string;

//   @ManyToOne(() => CampaignEntity, (campaign) => campaign.milestones, {
//     onDelete: 'CASCADE',
//   })
//   @JoinColumn({ name: 'campaignId' })
//   campaign: CampaignEntity;

//   // ============================================
//   // Timestamps
//   // ============================================
//   @CreateDateColumn()
//   createdAt: Date;

//   @UpdateDateColumn()
//   updatedAt: Date;
// }
