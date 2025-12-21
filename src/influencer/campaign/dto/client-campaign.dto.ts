import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsNumber,
  Min,
  IsDateString,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignType } from '../entities/campaign.entity';
import { AssetType } from '../entities/campaign-asset.entity';

// ==========================================
// STEP 1: Get Started
// ==========================================
export class CreateCampaignStep1Dto {
  @IsString()
  @IsNotEmpty()
  campaignName: string;

  @IsEnum(CampaignType)
  campaignType: CampaignType;
}

// ==========================================
// STEP 2: Preferences (Influencer or Agency)
// ==========================================
export class UpdateCampaignStep2Dto {
  @IsString()
  @IsOptional()
  productType?: string;

  @IsString()
  @IsOptional()
  campaignNiche?: string;

  // For "Influencer Promotion" Flow
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  preferredInfluencerIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  notPreferableInfluencerIds?: string[];

  // For "Paid Ad" Flow (Agency Selection)
  @IsUUID()
  @IsOptional()
  agencyId?: string;
}

// ==========================================
// STEP 3: Details & Guidelines
// ==========================================
export class UpdateCampaignStep3Dto {
  @IsString() @IsOptional() campaignGoals?: string;
  @IsString() @IsOptional() productServiceDetails?: string;

  // ✅ Matches Figma "Do's & Don't" Section
  @IsString() @IsOptional() dos?: string;
  @IsString() @IsOptional() donts?: string;

  @IsString() @IsOptional() reportingRequirements?: string;
  @IsString() @IsOptional() usageRights?: string;

  @IsDateString() @IsOptional() startingDate?: string;
  @IsNumber() @Min(1) @IsOptional() duration?: number; // Days
}

// ==========================================
// STEP 4: Budget & Targets
// ==========================================
export class MilestoneDto {
  @IsString() contentTitle: string;
  @IsString() platform: string;
  @IsString() contentQuantity: string;
  @IsNumber() deliveryDays: number;
}

export class UpdateCampaignStep4Dto {
  @IsNumber()
  @Min(0)
  clientBudget: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones: MilestoneDto[];

  // ✅ Matches Figma "Promotion Target" Section
  @IsNumber() @IsOptional() targetReach?: number;
  @IsNumber() @IsOptional() targetViews?: number;
  @IsNumber() @IsOptional() targetLikes?: number;
  @IsNumber() @IsOptional() targetComments?: number;
}

// ==========================================
// STEP 5: Assets
// ==========================================
export class AssetDto {
  @IsEnum(AssetType) assetType: AssetType;
  @IsString() fileName: string;
  @IsString() fileUrl: string;
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

// ==========================================
// SEARCH / FILTER
// ==========================================
export class SearchCampaignDto {
  // Maps to Dashboard Tabs: "Active", "Budgeting & Quoting", "Completed", "Draft", "Canceled"
  @IsString()
  @IsOptional()
  tab?: string;
}

export class FundCampaignDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
