import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';

// Influencer/Agency Submits Work
export class SubmitMilestoneDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  attachments?: string[]; // Screenshots/Videos

  // ✅ New: Matches "Add Live Links" input
  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  liveLinks?: string[];

  // ✅ New: Matches "Request Payment Amount" input
  @IsNumber()
  @IsOptional()
  requestedAmount?: number;

  @IsNumber() @IsOptional() actualReach?: number;
  @IsNumber() @IsOptional() actualViews?: number;
  @IsNumber() @IsOptional() actualLikes?: number;
  @IsNumber() @IsOptional() actualComments?: number;
}

// Client/Admin Reviews Work
export class ReviewMilestoneDto {
  @IsString()
  action: 'accept' | 'decline';

  @IsString()
  @IsOptional()
  rejectionReason?: string; // Required if declined
}

// Reporting an Issue
export class CreateReportDto {
  @IsUUID()
  campaignId: string;

  @IsString()
  reason: string;
}

// Sending a Bonus
export class SendBonusDto {
  @IsUUID()
  campaignId: string;

  @IsNumber()
  @Min(1)
  amount: number;
}

// Rating the Experience
export class RateCampaignDto {
  @IsUUID()
  campaignId: string;

  @IsNumber()
  @Min(1)
  rating: number; // 1-5

  @IsString()
  @IsOptional()
  review?: string;
}
