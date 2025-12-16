import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus } from 'src/influencer/campaign/entities/campaign.entity';
import { MasterDataType } from '../entities/master-data.entity';

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

  @IsOptional()
  @IsString()
  rejectReason?: string;
}

// For Payouts
export class UpdatePayoutStatusDto {
  @IsNotEmpty()
  @IsString()
  accountNo: string;

  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @IsOptional()
  @IsString()
  rejectReason?: string; // Add this
}

export class UpdateSectionStatusDto {
  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @IsOptional()
  @IsString()
  rejectReason?: string; // Add this
}

export class UpdateNidStatusDto {
  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  nidStatus: ApprovalStatus;

  @IsOptional()
  @IsString()
  rejectReason?: string; // Add this
}

// --- Client Verification DTOs ---
export class UpdateClientNidStatusDto {
  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  nidStatus: ApprovalStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class UpdateClientTradeLicenseStatusDto {
  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  tradeLicenseStatus: ApprovalStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class UpdateClientSocialStatusDto {
  @IsNotEmpty()
  @IsString()
  profileUrl: string; // The URL of the social link to update

  @IsNotEmpty()
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;
}

// --- Campaign Management DTOs ---
export class GetCampaignsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid client ID format' })
  clientId?: string;

  @IsOptional()
  @IsString()
  search?: string; // Search by campaign name

  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  startDateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  startDateTo?: string;
}

// Response interface for campaign list
export interface AdminCampaignListItem {
  id: string;
  // Campaign Info
  campaignName: string;
  campaignType: string;
  campaignNiche: string;
  // Client Info
  client: {
    id: string;
    brandName: string;
    fullName: string;
  };
  // Timeline
  timeline: {
    startingDate: Date | null;
    endDate: Date | null; // Calculated from startingDate + duration
    duration: number | null; // in days
  };
  // Financials
  financials: {
    clientBudget: number | null; // baseBudget from client
    finalQuoteAmount: number | null; // totalBudget after negotiation
  };
  // Assigned Personals
  assignedPersonals: {
    count: number;
    influencers: {
      id: string;
      name: string;
      status: string;
    }[];
  };
  // Status
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- General Settings ---
export class UpdateFeesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  platformFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatTax?: number;
}

// --- Master Data (Lists) ---
export class AddMasterDataDto {
  @IsNotEmpty()
  @IsEnum(MasterDataType)
  type: MasterDataType;

  @IsNotEmpty()
  @IsString()
  name: string;
}

// --- Security ---
export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
