import { InfluencerProfileEntity } from 'src/influencer/influencer/entities/influencer-profile.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  INFLUENCER = 'influencer',
  CLIENT = 'client',
  AGENCY = 'agency',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column({ select: false }) // Don't return password by default
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.INFLUENCER })
  role: UserRole;

  @Column({ default: false })
  isVerified: boolean; // Global verification status

  @Column({ default: false })
  isPhoneVerified: boolean;

  // Status for Screen 08 "Admin Approval"
  @Column({ default: false })
  isEmailVerified: boolean;

  // Temporary OTP fields (Hidden from API responses)
  @Column({ nullable: true, select: false })
  otpCode: string | null; // Store hashed ideally, or plain for simple MVP

  @Column({ nullable: true, select: false })
  otpExpires: Date | null;

  // --- Password Reset Fields ---
  @Column({ nullable: true, select: false }) // Hidden by default
  resetPasswordToken: string | null;

  @Column({ nullable: true, select: false }) // Hidden by default
  resetPasswordExpires: Date | null;

  // One-to-One: A User HAS ONE Influencer Profile
  @OneToOne(() => InfluencerProfileEntity, (profile) => profile.user)
  influencerProfile: InfluencerProfileEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
