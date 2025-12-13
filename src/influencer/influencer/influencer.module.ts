import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfluencerController } from './influencer.controller';
import { InfluencerService } from './influencer.service';
import { InfluencerProfileEntity } from './entities/influencer-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InfluencerProfileEntity])],
  controllers: [InfluencerController],
  providers: [InfluencerService],
  exports: [InfluencerService],
})
export class InfluencerModule {}
