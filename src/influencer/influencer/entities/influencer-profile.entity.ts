import { UserEntity } from 'src/influencer/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('influencer_profiles')
export class InfluencerProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // @Column({ nullable: true })
  // fullName: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  profileImage: string; // S3 URL

  // Location should be an array (multiple addresses home/office/studio, etc.)
  // --- Location (Array of Addresses) ---
  // Stores multiple addresses like Home, Office, Studio
  @Column('jsonb', { nullable: true })
  addresses: {
    addressName: string; // e.g., "Home", "Studio"
    thana: string;
    zilla: string;
    fullAddress: string;
  }[];

  // Figma: "Niches" (Stored as array of strings for simplicity, or separate table if strictly relational)
  @Column('jsonb', { nullable: true })
  niches: { niche: string; status: string }[];

  @Column('jsonb', { nullable: true })
  skills: { skill: string; status: string }[];

  @Column({ nullable: true })
  website: string;
  // Figma: "Social Links" (Storing as JSON is efficient for flexible platforms)
  @Column('jsonb', { nullable: true })
  socialLinks: { platform: string; url: string; status: string }[];

  // Figma: "NID Info" & Documents (S3 URLs)
  @Column({ nullable: true })
  nidNumber: string;

  @Column({ nullable: true })
  nidFrontImg: string; // S3 URL

  @Column({ nullable: true })
  nidBackImg: string; // S3 URL

  @Column('jsonb', { nullable: true })
  nidVerification: { nidStatus: string; nidRejectReason: string };

  @Column({ nullable: true })
  profileImg: string; // S3 URL

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

  // Verification Status specific to profile completion. it should be multifield like (social profile verification, phone no verification, payment setup, nid, trade license, TIN, BIN, Email)
  // @Column({ default: 'unverified' }) // unverified, verified, inreview
  // verificationStatus: string;

  // --- Verification Status (Detailed) ---
  // Tracks individual steps: 'unverified' | 'pending' | 'verified' | 'rejected'
  // @Column('jsonb', {
  //   default: {
  //     // nid: 'unverified',
  //     socialProfile: 'unverified',
  //     // paymentSetup: 'unverified',
  //     tradeLicense: 'unverified', // Optional for individual
  //     tin: 'unverified',
  //     bin: 'unverified',
  //   },
  // })
  // verificationSteps: {
  //   // nid: string;
  //   socialProfile: string;
  //   // paymentSetup: string;
  //   tradeLicense: string;
  //   tin: string;
  //   bin: string;
  // };

  // Foreign Key to User
  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @OneToOne(() => UserEntity, (user) => user.influencerProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
