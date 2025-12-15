import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsNumber,
  IsDate,
  IsBoolean,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignType, CampaignStatus, Platform } from '../entities/campaign.entity';
import { AssetType } from '../entities/campaign-asset.entity';

// ============================================
// Update Milestone DTO
// ============================================
export class UpdateMilestoneDto {
  @IsUUID()
  @IsOptional()
  id?: string; // For updating existing milestone

  @IsString()
  @IsOptional()
  contentTitle?: string;

  @IsEnum(Platform)
  @IsOptional()
  platform?: Platform;

  @IsString()
  @IsOptional()
  contentQuantity?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  deliveryDays?: number;

  @IsNumber()
  @IsOptional()
  expectedReach?: number;

  @IsNumber()
  @IsOptional()
  expectedViews?: number;

  @IsNumber()
  @IsOptional()
  expectedLikes?: number;

  @IsNumber()
  @IsOptional()
  expectedComments?: number;

  @IsNumber()
  @IsOptional()
  order?: number;
}

// ============================================
// Update Asset DTO
// ============================================
export class UpdateAssetDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsEnum(AssetType)
  @IsOptional()
  assetType?: AssetType;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

// ============================================
// General Update Campaign DTO
// ============================================
export class UpdateCampaignDto {
  // Step 1
  @IsString()
  @IsOptional()
  campaignName?: string;

  @IsEnum(CampaignType)
  @IsOptional()
  campaignType?: CampaignType;

  // Step 2
  @IsString()
  @IsOptional()
  productType?: string;

  @IsString()
  @IsOptional()
  campaignNiche?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  preferredInfluencerIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  notPreferableInfluencerIds?: string[];

  // Step 3
  @IsString()
  @IsOptional()
  campaignGoals?: string;

  @IsString()
  @IsOptional()
  productServiceDetails?: string;

  @IsString()
  @IsOptional()
  reportingRequirements?: string;

  @IsString()
  @IsOptional()
  usageRights?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startingDate?: Date;

  @IsNumber()
  @Min(1)
  @IsOptional()
  duration?: number;

  // Step 4
  @IsNumber()
  @Min(0)
  @IsOptional()
  baseBudget?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMilestoneDto)
  @IsOptional()
  milestones?: UpdateMilestoneDto[];

  // Step 5
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAssetDto)
  @IsOptional()
  assets?: UpdateAssetDto[];

  @IsBoolean()
  @IsOptional()
  needSampleProduct?: boolean;

  // Current step tracking
  @IsNumber()
  @IsOptional()
  currentStep?: number;
}

// ============================================
// Admin Update Campaign Status DTO
// ============================================
export class UpdateCampaignStatusDto {
  @IsEnum(CampaignStatus)
  status: CampaignStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

// ============================================
// Search/Filter Campaigns DTO
// ============================================
export class SearchCampaignDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @IsEnum(CampaignType)
  @IsOptional()
  campaignType?: CampaignType;

  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDateFrom?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDateTo?: Date;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
