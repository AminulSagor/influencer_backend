import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilterDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by Campaign Name

  @IsOptional()
  @IsEnum(['Pending', 'Resolved'])
  status?: 'Pending' | 'Resolved';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

// Admin এর জন্য আলাদা ফিল্টার (Tab Filter)
export class AdminReportFilterDto extends ReportFilterDto {
  @IsOptional()
  @IsEnum(['AGENCY', 'CLIENT'])
  userType?: 'AGENCY' | 'CLIENT';
}
