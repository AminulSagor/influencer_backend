import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MilestoneSubmissionEntity } from './milestone-submission.entity';

@Entity('submission_reports')
export class SubmissionReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string; // The report/comment text

  @Column()
  authorRole: string; // 'client' | 'admin' | 'agency'

  @Column()
  authorId: string; // User ID of the commenter

  @Column({ nullable: true })
  actionTaken: string; // 'approve', 'decline', 'comment'

  @ManyToOne(() => MilestoneSubmissionEntity, (s) => s.reports, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'submissionId' })
  submission: MilestoneSubmissionEntity;

  @Column()
  submissionId: string;

  @CreateDateColumn()
  createdAt: Date;
}
