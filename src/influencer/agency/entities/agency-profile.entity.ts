import { UserEntity } from 'src/influencer/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agency_profiles')
export class AgencyProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  agencyName: string;

  @Column()
  ownerFirstName: string;

  @Column()
  ownerLastName: string;

  @Column()
  secondaryPhone: string;

  @Column({ nullable: true })
  logo: string; // S3 URL

  @Column({ type: 'text', nullable: true })
  agencyBio: string;

  @Column({ nullable: true })
  website: string;

  // Location
  @Column('jsonb', { nullable: true })
  address: {
    addressLine: string;
    city: string;
    country: string;
  };

  // Social Links
  @Column('jsonb', { nullable: true })
  socialLinks: { platform: string; url: string; status: string }[];

  @Column({ nullable: true })
  nidNumber: string;

  @Column({ nullable: true })
  nidFrontImg: string; // S3 URL

  @Column({ nullable: true })
  nidBackImg: string; // S3 URL

  @Column('jsonb', { nullable: true })
  nidVerification: { nidStatus: string; nidRejectReason: string };

  @Column({ nullable: true })
  tradeLicenseNumber: string;

  @Column({ nullable: true })
  tradeLicenseImage: string; // S3 URL

  @Column({ nullable: true })
  tradeLicenseStatus: string;

  @Column({ nullable: true })
  tinNumber: string;

  @Column({ nullable: true })
  tinImage: string; // S3 URL

  @Column({ nullable: true })
  tinStatus: string;

  @Column({ nullable: true })
  binNumber: string;

  // --- Payments (Array of payouts) ---
  // Stores multiple payouts like Bank, Bkash, Nagad
  @Column('jsonb', { nullable: true })
  payouts: {
    bank: Array<{
      bankName: string;
      bankAccHolderName: string;
      bankAccNo: string;
      bankBranchName: string;
      bankRoutingNo: string;
      accStatus: string;
    }>;
    mobileBanking: Array<{
      accountNo: string;
      accountHolderName: string;
      accountType: string;
      accStatus: string;
    }>;
  };

  // Foreign Key
  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @OneToOne(() => UserEntity, (user) => user.agencyProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
