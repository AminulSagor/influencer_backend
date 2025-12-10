import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './s3.service';
import { UploadController } from './upload.controller';

@Module({
  imports: [ConfigModule],
  providers: [S3Service],
  controllers: [UploadController],
  exports: [S3Service], // Export the service so other modules can inject it
})
export class UploaderModule {}
