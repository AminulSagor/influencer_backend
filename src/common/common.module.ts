import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './services/sms.service';

@Global() // Optional: Makes SmsService available everywhere without importing CommonModule in every file
@Module({
  imports: [ConfigModule], // SmsService needs ConfigService for API keys
  providers: [SmsService],
  exports: [SmsService], // <--- EXPORT IT so other modules can use it
})
export class CommonModule {}
