import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  IsArray,
  IsEnum,
  ValidateNested,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus } from '../entities/campaign.entity';

// --- List Filters ---
export class AdminSearchCampaignDto {
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus; // Filter by: received (Needs Quote), active, completed

  @IsString()
  @IsOptional()
  search?: string; // Search by Campaign Name or Client Name

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}

// --- Action: Send Quote ---
export class AdminSendQuoteDto {
  @IsNumber()
  @Min(0)
  baseBudget: number; // Admin inputs Base, System calculates VAT/Total
}

// ============================================
// PLATFORM PROFIT MANAGEMENT
// ============================================
export class UpdatePlatformFeeDto {
  @IsNumber()
  @Min(0)
  feeAmount: number; // Admin sets the profit amount directly
}

// ============================================
// ASSIGNMENT WITH SPLITS (Influencer/Agency)
// ============================================
export class AssignmentSplitDto {
  @IsUUID()
  entityId: string; // InfluencerID or AgencyID

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number; // e.g., 33.33%

  @IsNumber()
  @Min(0)
  offerAmount: number; // e.g., 30,000
}

export class AdminAssignVendorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentSplitDto)
  assignments: AssignmentSplitDto[];
}

// ============================================
// EXECUTION: REVIEW WORK
// ============================================
export class AdminReviewMilestoneDto {
  @IsEnum(['accepted', 'declined'])
  status: string;

  @IsString()
  @IsOptional()
  declineReason?: string; // Required if declined
}

// --- Action: Search Entities (Agency/Influencer) ---
export class AdminSearchEntityDto {
  @IsString()
  @IsOptional()
  search?: string; // Name search
}

// --- Action: Invite Agency ---
export class AdminInviteAgencyDto {
  @IsUUID()
  agencyId: string;
}

// --- Action: Assign Influencers ---
export class AdminInviteInfluencersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  influencerIds: string[];
}
