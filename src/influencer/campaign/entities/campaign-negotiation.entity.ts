import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';

// Who sent the negotiation message
export enum NegotiationSender {
  CLIENT = 'client',
  ADMIN = 'admin',
  AGENCY = 'agency',
}

// Negotiation action type
export enum NegotiationAction {
  REQUEST = 'request', // Admin sends quote
  COUNTER_OFFER = 'counter_offer', // Counter-offer with different price
  ACCEPT = 'accept', // Accept the current terms
  REJECT = 'reject', // Reject the campaign
  MESSAGE = 'message', // General message/comment
}

@Entity('campaign_negotiations')
export class CampaignNegotiationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Who sent this negotiation entry
  @Column({
    type: 'varchar',
    length: 20,
  })
  sender: string;

  // Action type
  @Column({
    type: 'varchar',
    length: 30,
  })
  action: string;

  // Message/Comment from sender
  @Column({ type: 'text', nullable: true })
  message: string;

  // ============================================
  // Proposed Price Quote
  // ============================================
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  proposedBaseBudget: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  proposedVatAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  proposedTotalBudget: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  proposedServiceFeePercent: number;

  @Column({ type: 'varchar', nullable: true })
  clientProposedServiceFee: string;
  // ============================================
  // Read Status
  // ============================================
  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  // ============================================
  // Relationships
  // ============================================
  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.negotiations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignEntity;

  // User ID of the sender (for tracking)
  @Column({ type: 'uuid', nullable: true, name: 'sender_id' })
  senderId: string;

  // ============================================
  // Timestamps
  // ============================================
  @CreateDateColumn()
  createdAt: Date;
}
