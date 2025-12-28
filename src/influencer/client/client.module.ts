import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { ClientProfileEntity } from './entities/client-profile.entity';
import { UserEntity } from '../user/entities/user.entity';
import { CommonModule } from 'src/common/common.module';
import { AgencyModule } from '../agency/agency.module';
import { CampaignEntity } from '../campaign';
import { MilestoneSubmissionEntity } from '../campaign/entities/milestone-submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientProfileEntity,
      UserEntity,
      CampaignEntity,
      MilestoneSubmissionEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    CommonModule,
    AgencyModule,
  ],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
