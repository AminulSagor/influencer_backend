import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateInfluencerDto {
  @IsOptional()
  @IsString()
  profileImg?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class DeleteItemDto {
  @IsNotEmpty()
  @IsString()
  identifier: string; // Used for Niche Name, Skill Name, Social URL, Account No, etc.

  @IsOptional()
  @IsString()
  type?: string; // Used to distinguish between 'bank' vs 'mobile' for payouts
}
