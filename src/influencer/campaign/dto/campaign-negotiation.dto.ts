import { IsString, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// Admin: Send Quote DTO
// ============================================
export class SendQuoteDto {
  @IsUUID()
  campaignId: string;

  @IsNumber()
  @Min(0)
  proposedBaseBudget: number;
}

// ============================================
// Client: Counter Offer DTO
// ============================================
export class CounterOfferDto {
  @IsUUID()
  campaignId: string;

  @IsNumber()
  @Min(0)
  proposedBaseBudget: number;

  @IsOptional()
  @IsString()
  clientProposedServiceFee?: string;
}

// ============================================
// Accept Negotiation DTO
// ============================================
export class AcceptNegotiationDto {
  @IsUUID()
  campaignId: string;
}

// ============================================
// Reject Campaign DTO
// ============================================
export class RejectCampaignDto {
  @IsUUID()
  campaignId: string;

  @IsString()
  reason: string;
}

// ============================================
// Mark Negotiation as Read DTO
// ============================================
export class MarkNegotiationReadDto {
  @IsUUID()
  negotiationId: string;
}
