import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt-brandguru')) // Or 'jwt-influencer' etc based on your strategy naming
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('device-token')
  async updateDeviceToken(@Request() req, @Body('token') token: string) {
    return this.notificationService.saveFcmToken(req.user.userId, token);
  }

  @Get()
  async getMyNotifications(
    @Request() req,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.notificationService.getUserNotifications(
      req.user.userId,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }

  @Patch('read-all')
  async markAllRead(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.userId);
  }
}
