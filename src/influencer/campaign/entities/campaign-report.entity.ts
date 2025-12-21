import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';

@Entity('campaign_reports')
export class CampaignReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => CampaignEntity)
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignEntity;

  @Column({ type: 'uuid' })
  reporterId: string; // Who reported it

  @Column()
  reason: string; // The report text

  @Column({ default: 'pending' }) // pending, resolved
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
