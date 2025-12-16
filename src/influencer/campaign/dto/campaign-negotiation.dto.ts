import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
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
