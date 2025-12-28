import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { JwtModule } from '@nestjs/jwt';
// import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { UserEntity } from '../user/entities/user.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { CampaignEntity } from '../campaign/entities/campaign.entity';
import { CampaignAssignmentEntity } from '../campaign/entities/campaign-assignment.entity';
import { SystemSettingEntity } from './entities/system-setting.entity';
import { MasterDataEntity } from './entities/master-data.entity';
import { LoginLogEntity } from './entities/login-log.entity';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import { NotificationModule } from '../notification/notification.module';
import { AgencyModule } from '../agency/agency.module';
import { MilestoneSubmissionEntity } from '../campaign/entities/milestone-submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      InfluencerProfileEntity,
      ClientProfileEntity,
      CampaignEntity,
      CampaignAssignmentEntity,
      SystemSettingEntity, // Register
      MasterDataEntity, // Register
      LoginLogEntity, // Register
      AgencyProfileEntity,
      MilestoneSubmissionEntity,
    ]), // Register Repos
    PassportModule,
    NotificationModule,
    AgencyModule,
    // JwtModule.registerAsync({
    //   imports: [ConfigModule],
    //   useFactory: async (configService: ConfigService) => ({
    //     secret: configService.get<string>('BRANDGURU_JWT_SECRET'),
    //     signOptions: { expiresIn: '15d' }, // Admin token expiry
    //   }),
    //   inject: [ConfigService],
    // }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
