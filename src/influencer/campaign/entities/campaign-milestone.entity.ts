import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignEntity, Platform } from './campaign.entity';

@Entity('campaign_milestones')
export class CampaignMilestoneEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Content Creation Title
  @Column()
  contentTitle: string;

  // Platform (Facebook, YouTube, TikTok, Instagram)
  @Column({
    type: 'varchar',
    length: 50,
  })
  platform: string;

  // Content Quantity (e.g., "1 Sponsored Video", "2 Posts")
  @Column()
  contentQuantity: string;

  // Delivery Timeline in Days
  @Column({ type: 'int' })
  deliveryDays: number;

  // Expected Metrics
  @Column({ type: 'int', nullable: true })
  expectedReach: number;

  @Column({ type: 'int', nullable: true })
  expectedViews: number;

  @Column({ type: 'int', nullable: true })
  expectedLikes: number;

  @Column({ type: 'int', nullable: true })
  expectedComments: number;

  // Milestone Status
  @Column({ default: 'pending' }) // pending, in_progress, completed, approved
  status: string;

  // Order/Sequence of milestone
  @Column({ type: 'int', default: 0 })
  order: number;

  // ============================================
  // Relationships
  // ============================================
  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.milestones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignEntity;

  // ============================================
  // Timestamps
  // ============================================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
