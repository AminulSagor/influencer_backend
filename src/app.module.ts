import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './lead-manager/auth/auth.module';
import { B2bModule } from './lead-manager/b2b/b2b.module';
import { B2CModule } from './lead-manager/b2c/b2c.module';
import { UploaderModule } from './uploader/uploader.module';
import { InfluencerModule } from './influencer/influencer/influencer.module';
import { AuthInfluecerModule } from './influencer/auth/auth.module';
import { AdminModule } from './influencer/admin/admin.module';
import { CommonModule } from './common/common.module';
import { ClientModule } from './influencer/client/client.module';
import { CampaignModule } from './influencer/campaign/campaign.module';
import { NotificationModule } from './influencer/notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
      // ssl: {
      //   rejectUnauthorized: false,
      // },
    }),
    AuthModule,
    B2bModule,
    B2CModule,
    UploaderModule,
    InfluencerModule,
    AuthInfluecerModule,
    NotificationModule,
    CommonModule,
    AdminModule,
    ClientModule,
    CampaignModule,
  ],
})
export class AppModule {}
