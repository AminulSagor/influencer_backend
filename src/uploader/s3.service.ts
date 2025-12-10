import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly expirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME')!;
    this.expirySeconds =
      this.configService.get<number>('S3_UPLOAD_EXPIRY_SECONDS') || 600;

    // AWS SDK automatically picks up credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
    });

    console.log('AWS_REGION: ', this.s3Client);
  }

  async generateUploadUrl(key: string, contentType: string) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        // Optional: ACL configuration if you need files to be publicly readable
        // ACL: 'public-read',
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.expirySeconds,
      });

      // Construct the public URL assuming default S3 public access structure
      const publicUrl = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;

      return {
        signedUrl,
        fileKey: key,
        publicUrl,
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new InternalServerErrorException(
        'Could not generate file upload URL',
      );
    }
  }
}
