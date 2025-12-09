import { IsOptional, IsString } from 'class-validator';

export class SearchB2CDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  subSector?: string;

  @IsOptional()
  @IsString()
  skills?: string;

  @IsOptional()
  @IsString()
  highestDegree?: string;

  @IsOptional()
  @IsString()
  hobbies?: string;

  @IsOptional()
  @IsString()
  organizations?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  income?: string;

  @IsOptional()
  @IsString()
  salary?: string;
}
