import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignMilestoneEntity } from './entities/campaign-milestone.entity';
import { CampaignAssetEntity } from './entities/campaign-asset.entity';
import { CampaignNegotiationEntity } from './entities/campaign-negotiation.entity';
import { CampaignAssignmentEntity } from './entities/campaign-assignment.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import { SystemSettingEntity } from '../admin/entities/system-setting.entity';
import { MilestoneSubmissionEntity } from './entities/milestone-submission.entity';
import { UserEntity } from '../user/entities/user.entity';
import { SubmissionReportEntity } from './entities/submission-report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignMilestoneEntity,
      CampaignAssetEntity,
      CampaignNegotiationEntity,
      CampaignAssignmentEntity,
      UserEntity,
      ClientProfileEntity,
      InfluencerProfileEntity,
      AgencyProfileEntity,
      SystemSettingEntity,
      MilestoneSubmissionEntity,
      SubmissionReportEntity,
    ]),
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
