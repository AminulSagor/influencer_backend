import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { CampaignMilestoneEntity } from './campaign-milestone.entity';
import { SubmissionReportEntity } from './submission-report.entity';

@Entity('milestone_submissions')
export class MilestoneSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  submissionDescription: string | null;

  // ✅ FIX: Allow string[] | null
  @Column({ type: 'simple-array', nullable: true })
  submissionAttachments: string[] | null;

  // ✅ New Field: Live Links
  @Column({ type: 'simple-array', nullable: true })
  submissionLiveLinks: string[] | null;

  // ✅ New Field: Payment Request Amount
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  requestedAmount: number | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  // --- Client Feedback ---
  // @Column({ type: 'text', nullable: true })
  // clientReport: string | null;

  @Column({ type: 'boolean', default: false })
  isClientApproved: boolean;

  @Column({ type: 'int', nullable: true })
  achievedReach: number;

  @Column({ type: 'int', nullable: true })
  achievedViews: number;

  @Column({ type: 'int', nullable: true })
  achievedLikes: number;

  @Column({ type: 'int', nullable: true })
  achievedComments: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidToAgencyAmount: number;

  @Column({ default: 'unpaid' }) // unpaid, paid
  paymentStatus: string;

  @Column({ type: 'text', nullable: true })
  adminFeedback: string | null; //  পেমেন্ট নোট

  @Column({ default: 'pending' }) // pending, approved, declined
  status: string;

  // @Column({ type: 'uuid' })
  // milestoneId: string;

  @ManyToOne(() => CampaignMilestoneEntity, (m) => m.submissions)
  @JoinColumn({ name: 'milestoneId' })
  milestone: CampaignMilestoneEntity;

  @RelationId((s: MilestoneSubmissionEntity) => s.milestone)
  milestoneId: string;

  @OneToMany(() => SubmissionReportEntity, (report) => report.submission)
  reports: SubmissionReportEntity[];

  @CreateDateColumn()
  createdAt: Date;
}
