import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AgencySearchCampaignDto {
  @IsString()
  @IsOptional()
  tab?: 'new_offer' | 'active' | 'completed' | 'declined';

  @IsOptional()
  @IsString()
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @Type(() => Number) // 👈 This converts "1" (string) to 1 (number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number) // 👈 This converts "10" (string) to 10 (number)
  @IsNumber()
  limit?: number;
}

// export class AgencyRequoteDto {
//   @IsNumber()
//   @Min(1)
//   proposedTotalBudget: number;
// }
