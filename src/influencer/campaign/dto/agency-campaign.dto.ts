import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// --- Dashboard Filter ---
export class AgencySearchCampaignDto {
  // Matches Figma Tabs: "new_offer", "quoted", "active", "completed", "pending_payment", "declined"
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

// --- Action: Negotiate / Requote ---
export class AgencyRequoteDto {
  @IsNumber()
  @Min(0)
  proposedAmount: number; // Agency proposes new total for vendor
}

// --- Action: Decline Invite ---
export class AgencyDeclineDto {
  @IsString()
  reason: string;
}
