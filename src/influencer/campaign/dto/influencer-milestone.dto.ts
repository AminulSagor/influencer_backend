import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class InfluencerSubmitMilestoneDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  liveLinks?: string[];

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  proofAttachments?: string[];

  // performance metrics
  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedViews?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedReach?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedLikes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedComments?: number;

  // optional, if you pay per milestone
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedAmount?: number;
}

export class InfluencerResubmitSubmissionDto extends InfluencerSubmitMilestoneDto {}

export class InfluencerUpdateSubmissionMetricsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedViews?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedReach?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedLikes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  achievedComments?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  proofAttachments?: string[];
}
