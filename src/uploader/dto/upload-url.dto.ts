import { IsNotEmpty, IsString } from 'class-validator';

// DTO for incoming request from Frontend
export class GetUploadUrlDto {
  @IsNotEmpty()
  @IsString()
  fileName: string; // e.g., 'avatar.jpg'

  @IsNotEmpty()
  @IsString()
  fileType: string; // e.g., 'image/jpeg'

  @IsNotEmpty()
  @IsString()
  module: string; // Determines the S3 path prefix
}
