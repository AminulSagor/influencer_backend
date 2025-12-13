import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

// --- Auth DTO ---
export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

// --- Verification DTOs ---
export enum ApprovalStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
  UNVERIFIED = 'unverified',
}

// For approving items inside arrays (Niches, Skills, Socials)
export class UpdateItemStatusDto {
  @IsNotEmpty()
  @IsString()
  identifier: string; // The Name or URL of the item

  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;
}

// For Payouts
export class UpdatePayoutStatusDto {
  @IsNotEmpty()
  @IsString()
  accountNo: string;

  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;
}

// For Single Sections (NID)
export class UpdateSectionStatusDto {
  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;
}

export class UpdateNidStatusDto {
  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  nidStatus: ApprovalStatus;
}
