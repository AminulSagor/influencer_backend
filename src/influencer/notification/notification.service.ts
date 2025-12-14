import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { UserRole } from '../user/entities/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifRepo: Repository<NotificationEntity>,
  ) {}

  // 1. Send Notification (Internal Use)
  async createNotification(
    userId: string,
    role: UserRole,
    title: string,
    message: string,
    type = 'system',
  ) {
    const notif = this.notifRepo.create({
      userId,
      userRole: role,
      title,
      message,
      type,
    });
    return this.notifRepo.save(notif);
  }

  // 2. Get Notifications (For User)
  async getUserNotifications(userId: string, page = 1, limit = 10) {
    const [data, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    // Count unread
    const unreadCount = await this.notifRepo.count({
      where: { userId, isRead: false },
    });

    return { data, meta: { total, unreadCount, page, limit } };
  }

  // 3. Mark as Read
  async markAsRead(notificationId: string) {
    await this.notifRepo.update(notificationId, { isRead: true });
    return { success: true };
  }

  // 4. Mark All as Read
  async markAllAsRead(userId: string) {
    await this.notifRepo.update({ userId }, { isRead: true });
    return { success: true };
  }
}
