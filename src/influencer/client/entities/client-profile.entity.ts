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

@Entity('client_profiles')
export class ClientProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Basic Profile Details ---
  @Column()
  brandName: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  profileImg: string; // S3 URL

  // Email and Phone are on the User entity, but we store them here for convenience
  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  // --- Location (After Phone Verification) ---
  @Column({ nullable: true })
  thana: string;

  @Column({ nullable: true })
  zila: string;

  @Column({ nullable: true })
  fullAddress: string;

  // --- Website (Optional) ---
  @Column({ nullable: true })
  website: string;

  // --- Social Media Links ---
  // Stores multiple social media platforms with their profile URLs and verification status
  @Column('jsonb', { nullable: true })
  socialLinks: { platform: string; profileUrl: string; status?: string }[];

  // --- NID Information ---
  @Column({ nullable: true })
  nidNumber: string;

  @Column({ nullable: true })
  nidFrontImg: string; // S3 URL

  @Column({ nullable: true })
  nidBackImg: string; // S3 URL

  @Column({ default: 'unverified' }) // unverified, pending, verified, rejected
  nidStatus: string;

  // --- Trade License Information ---
  @Column({ nullable: true })
  tradeLicenseNumber: string;

  @Column({ nullable: true })
  tradeLicenseImg: string; // S3 URL

  @Column({ default: 'unverified' }) // unverified, pending, verified, rejected
  tradeLicenseStatus: string;

  // --- Profile Completion Status ---
  @Column({ default: false })
  isOnboardingComplete: boolean;

  // --- Verification Steps Tracking ---
  @Column('jsonb', {
    default: {
      profileDetails: 'unverified', // brandName, firstName, lastName, email, phone
      phoneVerification: 'unverified',
      addressDetails: 'unverified', // thana, zila, fullAddress
      socialLinks: 'unverified',
      nidVerification: 'unverified',
      tradeLicense: 'unverified',
    },
  })
  verificationSteps: {
    profileDetails: string;
    phoneVerification: string;
    addressDetails: string;
    socialLinks: string;
    nidVerification: string;
    tradeLicense: string;
  };

  // --- Foreign Key to User ---
  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @OneToOne(() => UserEntity, (user) => user.clientProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
