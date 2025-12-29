import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { UserEntity, UserRole } from '../user/entities/user.entity';
import { FcmService } from './fcm.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly fcmService: FcmService,
  ) {}

  // =========================================================
  // NEW METHOD: Helper to send notification easily
  // =========================================================
  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: any },
  ) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['role'],
    });

    if (!user) {
      console.warn(`Notification skipped: User ${userId} not found.`);
      return;
    }

    return this.createNotification(
      userId,
      user.role, // Fetched Role
      payload.title,
      payload.body,
      payload.data?.type || 'general', // Default type
      payload.data,
    );
  }

  // 1. Create Notification (DB + Push)
  async createNotification(
    userId: string,
    role: UserRole,
    title: string,
    message: string,
    type: string,
    metadata?: any,
  ) {
    // A. Save to Database
    const notification = this.notificationRepo.create({
      userId,
      userRole: role,
      title,
      message,
      type,
      metadata,
    });

    // Save to DB
    await this.notificationRepo.save(notification);

    // B. Send Push Notification via FCM
    // (We wrap this in a try-catch to prevent blocking if FCM fails)
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['fcmToken'],
      });

      if (user?.fcmToken) {
        await this.fcmService.sendNotification(user.fcmToken, title, message, {
          type,
          ...metadata,
        });
      }
    } catch (error) {
      console.error('FCM Error:', error);
    }

    return notification;
  }

  // 2. Save FCM Token (Called from Frontend)
  async saveFcmToken(userId: string, token: string) {
    await this.userRepo.update(userId, { fcmToken: token });
    return { success: true, message: 'Device token updated' };
  }

  // 2. Get Notifications (For User)
  async getUserNotifications(userId: string, page = 1, limit = 10) {
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    // Count unread
    const unreadCount = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });

    return { data, meta: { total, unreadCount, page, limit } };
  }

  // 3. Mark as Read
  async markAsRead(notificationId: string) {
    await this.notificationRepo.update(notificationId, { isRead: true });
    return { success: true };
  }

  // 4. Mark All as Read
  async markAllAsRead(userId: string) {
    await this.notificationRepo.update({ userId }, { isRead: true });
    return { success: true };
  }
}
