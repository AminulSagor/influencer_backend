import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './services/sms.service';
import { SeederService } from './services/seeder.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientProfileEntity } from 'src/influencer/client/entities/client-profile.entity';
import { InfluencerProfileEntity } from 'src/influencer/influencer/entities/influencer-profile.entity';
import { AgencyProfileEntity } from 'src/influencer/agency/entities/agency-profile.entity';
import { UserEntity } from 'src/influencer/user/entities/user.entity';
import { SeederController } from './seeder.controller';

@Global() // Optional: Makes SmsService available everywhere without importing CommonModule in every file
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ClientProfileEntity,
      InfluencerProfileEntity,
      AgencyProfileEntity,
    ]),
    ConfigModule,
  ], // SmsService needs ConfigService for API keys
  controllers: [SeederController],
  providers: [SmsService, SeederService],
  exports: [SmsService, SeederService],
  // <--- EXPORT IT so other modules can use it
})
export class CommonModule {}
