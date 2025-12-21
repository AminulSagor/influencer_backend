import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignMilestoneEntity } from './entities/campaign-milestone.entity';
import { CampaignAssetEntity } from './entities/campaign-asset.entity';
import { CampaignNegotiationEntity } from './entities/campaign-negotiation.entity';
import { CampaignAssignmentEntity } from './entities/campaign-assignment.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { ClientCampaignController } from './client-campaign.controller';
import { ClientCampaignService } from './client-campaign.service';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import { CampaignReportEntity } from './entities/campaign-report.entity';
import { AdminCampaignService } from './admin-campaign.service';
import { AdminCampaignController } from './admin-campaign.controller';
import { AgencyCampaignService } from './agency-campaign.service';
import { AgencyCampaignController } from './agency-campaign.controller';
import { InfluencerCampaignController } from './influencer-campaign.controller';
import { InfluencerCampaignService } from './influencer-campaign.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignMilestoneEntity,
      CampaignAssetEntity,
      CampaignNegotiationEntity,
      CampaignAssignmentEntity,
      ClientProfileEntity,
      InfluencerProfileEntity,
      AgencyProfileEntity,
      CampaignReportEntity,
    ]),
  ],
  controllers: [
    ClientCampaignController,
    AdminCampaignController,
    AgencyCampaignController,
    InfluencerCampaignController,
  ],
  providers: [
    ClientCampaignService,
    AdminCampaignService,
    AgencyCampaignService,
    InfluencerCampaignService,
  ],
  exports: [ClientCampaignService, AdminCampaignService, AgencyCampaignService],
})
export class CampaignModule {}
