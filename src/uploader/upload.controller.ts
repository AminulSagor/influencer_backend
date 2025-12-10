import { Body, Controller, Post, UseGuards } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
import { S3Service } from './s3.service';
import { GetUploadUrlDto } from './dto/upload-url.dto';

// @UseGuards(AuthGuard('jwt'))
@Controller('upload') // Final endpoint: /upload
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('signed-url')
  async getSignedUrl(@Body() dto: GetUploadUrlDto) {
    // 1. Determine a unique file path (Key)
    // In a real app, you would use the user ID from JWT payload (req.user)
    // For now, let's use a dynamic path based on module and a unique ID (e.g., UUID or current timestamp)

    // Example path: 'influencer/profile-images/unique-id-avatar.jpg'
    const timestamp = Date.now();
    const key = `${dto.module}/${dto.fileName}-${timestamp}`;

    // In a real app: const userId = req.user.id; const key = `${dto.module}/${userId}/${dto.fileName}`;

    // 2. Generate the Pre-Signed URL
    const result = await this.s3Service.generateUploadUrl(key, dto.fileType);

    // 3. Return the URL and metadata to the Frontend
    return {
      success: true,
      message: 'Signed URL generated successfully',
      ...result,
    };
  }
}
