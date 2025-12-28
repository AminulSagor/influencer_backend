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
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CampaignType, Platform } from '../entities/campaign.entity';
import { AssetCategory } from '../entities/campaign-asset.entity';

// ============================================
// STEP 1: Basic Campaign Information
// ============================================
export class CreateCampaignStep1Dto {
  @IsString()
  @IsNotEmpty()
  campaignName: string;

  @IsEnum(CampaignType)
  campaignType: CampaignType;
}

// ============================================
// STEP 2: Targeting & Influencer Preferences
// ============================================
export class UpdateCampaignStep2Dto {
  @IsString()
  @IsOptional()
  productType?: string;

  @IsString()
  @IsNotEmpty()
  campaignNiche: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  preferredInfluencerIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  notPreferableInfluencerIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  agencyId?: string[]; // For selected Ad Agency

  // // Use this if the design allows multiple recommended agencies
  // @IsArray()
  // @IsUUID('all', { each: true })
  // @IsOptional()
  // otherAgencyIds?: string[];
}

// ============================================
// STEP 3: Campaign Details
// ============================================
export class UpdateCampaignStep3Dto {
  @IsString()
  @IsNotEmpty()
  campaignGoals: string;

  @IsString()
  @IsNotEmpty()
  productServiceDetails: string;

  @IsString()
  @IsOptional()
  reportingRequirements?: string;

  @IsString()
  @IsOptional()
  usageRights?: string;

  @IsDate()
  @Type(() => Date)
  startingDate: Date;

  @IsNumber()
  @Min(1)
  duration: number; // Duration in days

  @IsString()
  @IsOptional()
  dos?: string; // ✅ Added

  @IsString()
  @IsOptional()
  donts?: string; // ✅ Added
}

// ============================================
// STEP 4: Budget & Milestones
// ============================================
export class MilestoneDto {
  @IsString()
  @IsNotEmpty()
  contentTitle: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsString()
  @IsNotEmpty()
  contentQuantity: string;

  @IsString()
  @IsOptional()
  promotionGoal?: string;

  @IsNumber()
  @Min(1)
  deliveryDays: number;

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

export class UpdateCampaignStep4Dto {
  @IsNumber()
  @Min(0)
  baseBudget: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  @ArrayMinSize(1, { message: 'At least one milestone is required' })
  milestones: MilestoneDto[];
}

// ============================================
// STEP 5: Content Assets & Final Setup
// ============================================
export class AssetDto {
  // @IsEnum(AssetType)
  @IsString()
  @IsNotEmpty()
  assetType: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AssetCategory)
  category: AssetCategory;
}

export class UpdateCampaignStep5Dto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetDto)
  @IsOptional()
  assets?: AssetDto[];

  @IsBoolean()
  needSampleProduct: boolean;
}

// ============================================
// Combined Create Campaign DTO (Full Creation)
// ============================================
export class CreateCampaignDto {
  // Step 1
  @IsString()
  @IsNotEmpty()
  campaignName: string;

  @IsEnum(CampaignType)
  campaignType: CampaignType;

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
  @Type(() => MilestoneDto)
  @IsOptional()
  milestones?: MilestoneDto[];

  // Step 5
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetDto)
  @IsOptional()
  assets?: AssetDto[];

  @IsBoolean()
  @IsOptional()
  needSampleProduct?: boolean;
}

// ============================================
// Place Campaign DTO (Finalize)
// ============================================
export class PlaceCampaignDto {
  @IsUUID()
  campaignId: string;
}
