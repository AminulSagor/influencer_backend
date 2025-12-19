import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FcmService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Prevent re-initialization
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
          clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          // Handle newlines in private key for .env files
          privateKey: this.configService
            .get<string>('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: any,
  ) {
    if (!token) return;

    try {
      await admin.messaging().send({
        token: token,
        notification: {
          title,
          body,
        },
        // Data payload must be strings
        data: data ? this.formatData(data) : {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: {
            aps: { sound: 'default' },
          },
        },
      });
      console.log(`FCM sent to ${token}`);
    } catch (error) {
      console.error('Error sending FCM:', error.message);
      // Optional: Logic to remove invalid tokens from DB
    }
  }

  // Helper to ensure all data values are strings (FCM requirement)
  private formatData(data: any): Record<string, string> {
    const formatted = {};
    for (const key in data) {
      formatted[key] = String(data[key]);
    }
    return formatted;
  }
}
