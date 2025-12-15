import { InfluencerProfileEntity } from 'src/influencer/influencer/entities/influencer-profile.entity';
import { ClientProfileEntity } from 'src/influencer/client/entities/client-profile.entity';
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

  @Column({ unique: true, nullable: true }) // Phone might be null initially for some roles
  phone: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.INFLUENCER })
  role: UserRole;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  // --- FIX: Added explicit 'type' ---
  @Column({ type: 'varchar', nullable: true, select: false })
  otpCode: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  otpExpires: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  resetPasswordExpires: Date | null;
  // ----------------------------------

  @OneToOne(() => InfluencerProfileEntity, (profile) => profile.user)
  influencerProfile: InfluencerProfileEntity;

  @OneToOne(() => ClientProfileEntity, (profile) => profile.user)
  clientProfile: ClientProfileEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
