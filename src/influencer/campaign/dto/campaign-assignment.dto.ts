import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  Min,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JobStatus } from '../entities/campaign-assignment.entity';

// ============================================
// SIMPLE ASSIGNMENT WORKFLOW
// ============================================
// Admin assigns → Influencer sees in "New Offers"
// Influencer accepts → Goes to "Pending" (accepted but not started)
// Influencer starts → Goes to "Active" (work in progress)
// Influencer completes → Goes to "Completed"
// Influencer declines → Goes to "Declined"
// ============================================

// ============================================
// Admin: Assign Campaign to Influencer(s)
// ============================================
export class AssignCampaignDto {
  @IsUUID()
  campaignId: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @Type(() => String)
  influencerIds: string[];
}

// ============================================
// Admin: Update Assignment (set payment, message)
// ============================================
export class UpdateAssignmentDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  offeredAmount?: number;

  @IsString()
  @IsOptional()
  message?: string;
}

// ============================================
// Influencer: Accept Job
// ============================================
export class AcceptJobDto {
  @IsNumber()
  @IsOptional()
  addressId?: number; // Index of address from influencer's address list (0-based)
}

// ============================================
// Influencer: Decline Job
// ============================================
export class DeclineJobDto {
  @IsString()
  @IsOptional()
  reason?: string; // Optional reason for declining
}

// ============================================
// Search/Filter Assignments
// ============================================
export class SearchAssignmentDto {
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

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

// Re-export JobStatus for convenience
export { JobStatus } from '../entities/campaign-assignment.entity';
