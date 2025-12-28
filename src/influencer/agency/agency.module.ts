import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyProfileEntity } from './entities/agency-profile.entity';
import { AgencyController } from './agency.controller';
import { AgencyService } from './agency.service';
import { MilestoneSubmissionEntity } from '../campaign/entities/milestone-submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgencyProfileEntity, MilestoneSubmissionEntity]),
  ],
  controllers: [AgencyController],
  providers: [AgencyService],
  exports: [AgencyService], // Export so AuthModule can use the Repo/Service
})
export class AgencyModule {}
