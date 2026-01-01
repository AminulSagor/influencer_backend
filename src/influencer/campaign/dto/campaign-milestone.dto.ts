import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ApproveMilestoneDto {
  @IsUUID()
  milestoneId: string;
}

// ============================================
// Get Negotiation History DTO
// ============================================
export class GetNegotiationHistoryDto {
  @IsUUID()
  campaignId: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class UpdateMilestoneAmountDto {
  @IsNumber()
  amount: number;
}

export class ReviewMilestoneDto {
  @IsEnum([
    'approve',
    'decline',
    'comment',
    'client_approved',
    'client_declined',
  ])
  @IsOptional()
  action?:
    | 'approve'
    | 'decline'
    | 'comment'
    | 'client_approved'
    | 'client_declined';

  @IsString()
  @IsOptional()
  report?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class AdminPayMilestoneDto {
  @IsNumber()
  @Min(1)
  amount: number;
}

export class UpdateMilestoneResultDto {
  @IsOptional()
  @IsNumber()
  achievedViews?: number;

  @IsOptional()
  @IsNumber()
  achievedReach?: number;

  @IsOptional()
  @IsNumber()
  achievedLikes?: number;
}
