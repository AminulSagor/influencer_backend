import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsNumber,
  IsDate,
  IsEnum,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Platform } from '../entities/campaign.entity';
import { AssignmentStatus } from '../entities/campaign-assignment.entity';

// ============================================
// Assigned Milestone DTO
// ============================================
export class AssignedMilestoneDto {
  @IsString()
  contentTitle: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsString()
  contentQuantity: string;

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
}

// ============================================
// Single Influencer Assignment
// ============================================
export class InfluencerAssignmentDto {
  @IsUUID()
  influencerId: string;

  @IsNumber()
  @Min(0)
  offeredAmount: number;

  @IsString()
  @IsOptional()
  offerMessage?: string;

  @IsString()
  @IsOptional()
  offerTerms?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignedMilestoneDto)
  @IsOptional()
  assignedMilestones?: AssignedMilestoneDto[];

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  offerExpiresAt?: Date;
}

// ============================================
// Assign Campaign to Influencers (Admin)
// ============================================
export class AssignCampaignDto {
  @IsUUID()
  campaignId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InfluencerAssignmentDto)
  @ArrayMinSize(1)
  assignments: InfluencerAssignmentDto[];

  @IsString()
  @IsOptional()
  globalOfferMessage?: string; // Default message for all influencers
}

// ============================================
// Update Assignment (Admin)
// ============================================
export class UpdateAssignmentDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  offeredAmount?: number;

  @IsString()
  @IsOptional()
  offerMessage?: string;

  @IsString()
  @IsOptional()
  offerTerms?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignedMilestoneDto)
  @IsOptional()
  assignedMilestones?: AssignedMilestoneDto[];

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  offerExpiresAt?: Date;

  @IsEnum(AssignmentStatus)
  @IsOptional()
  status?: AssignmentStatus;
}

// ============================================
// Influencer Response to Assignment
// ============================================
export class RespondAssignmentDto {
  @IsEnum(AssignmentStatus, {
    message: 'Response must be either "accepted" or "rejected"',
  })
  response: AssignmentStatus.ACCEPTED | AssignmentStatus.REJECTED;

  @IsString()
  @IsOptional()
  responseMessage?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string; // Required if rejected
}

// ============================================
// Search/Filter Assignments
// ============================================
export class SearchAssignmentDto {
  @IsEnum(AssignmentStatus)
  @IsOptional()
  status?: AssignmentStatus;

  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @IsUUID()
  @IsOptional()
  influencerId?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}
