import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class PayDueDto {
  @IsUUID()
  campaignId: string;

  @IsNumber()
  @Min(1)
  amount: number;
}

export class PayCampaignDto {
  @IsNotEmpty()
  @IsUUID()
  campaignId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;
}

export class PayBonusDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
