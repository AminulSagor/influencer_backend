import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { CampaignStatus } from '../entities/campaign.entity';

// --- Dashboard Filter ---
export class InfluencerSearchCampaignDto {
  // Matches Tabs: "new_request", "active", "completed", "cancelled"
  @IsString()
  @IsOptional()
  tab?: string;

  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  limit?: number = 10;
}

// --- Action: Decline Invite ---
export class InfluencerDeclineDto {
  @IsString()
  reason: string;
}

// --- Action: Delivery Address (For Product Campaigns) ---
export class AddDeliveryAddressDto {
  @IsString() address: string;
  @IsString() city: string;
  @IsString() phone: string;
}

// --- Action: Withdrawal Request ---
export class WithdrawalRequestDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsUUID()
  campaignId: string; // Optional: if withdrawing per campaign
}
