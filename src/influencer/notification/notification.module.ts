import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationEntity } from './entities/notification.entity';
import { FcmService } from './fcm.service';
import { UserEntity } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, UserEntity]),
    ConfigModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, FcmService],
  exports: [NotificationService],
})
export class NotificationModule {}
