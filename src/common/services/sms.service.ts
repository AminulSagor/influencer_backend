import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// SMS API Response interfaces
interface SmsApiResponse {
  error: number;
  msg: string;
  data?: {
    request_id?: number;
  };
}

interface SmsReportResponse {
  error: number;
  msg: string;
  data?: {
    request_id: number;
    request_status: string;
    request_charge: string;
    recipients: Array<{
      number: string;
      charge: string;
      status: string;
    }>;
  };
}

interface SmsBalanceResponse {
  error: number;
  msg: string;
  data?: {
    balance: string;
  };
}

// SMS Error codes mapping
const SMS_ERROR_CODES: Record<number, string> = {
  0: 'Success',
  400: 'Missing or invalid parameter',
  403: 'Permission denied',
  404: 'Resource not found',
  405: 'Authorization required',
  409: 'Server error',
  410: 'Account expired',
  411: 'Reseller account expired or suspended',
  412: 'Invalid schedule',
  413: 'Invalid Sender ID',
  414: 'Message is empty',
  415: 'Message is too long',
  416: 'No valid number found',
  417: 'Insufficient balance',
  420: 'Content blocked',
  421: 'Can only send SMS to registered phone until first recharge',
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.sms.net.bd';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SMS_API_KEY') || '';
  }

  /**
   * Send OTP verification code to a phone number
   * @param phone - Phone number (with or without country code)
   * @param otp - OTP code to send
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const message = `Your verification code is ${otp}. This code will expire in 5 minutes.`;
    return this.sendSms(phone, message);
  }

  /**
   * Send a custom SMS message
   * @param phone - Phone number (with or without country code)
   * @param message - Message content
   * @param options - Optional parameters (schedule, senderId, contentId)
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendSms(
    phone: string,
    message: string,
    options?: {
      schedule?: string; // Format: Y-m-d H:i:s (e.g., 2025-12-14 11:44:09)
      senderId?: string;
      contentId?: string;
    },
  ): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.error('[SMS Service] API key not configured');
      throw new InternalServerErrorException('SMS service not configured');
    }

    // Normalize phone number (ensure it starts with 880 for Bangladesh)
    const normalizedPhone = this.normalizePhoneNumber(phone);

    try {
      const formData = new URLSearchParams();
      formData.append('api_key', this.apiKey);
      formData.append('msg', message);
      formData.append('to', normalizedPhone);

      // Add optional parameters
      if (options?.schedule) {
        formData.append('schedule', options.schedule);
      }
      if (options?.senderId) {
        formData.append('sender_id', options.senderId);
      }
      if (options?.contentId) {
        formData.append('content_id', options.contentId);
      }

      const response = await axios.post<SmsApiResponse>(
        `${this.baseUrl}/sendsms`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (response.data.error === 0) {
        this.logger.log(
          `[SMS Service] Message sent to ${normalizedPhone}, Request ID: ${response.data.data?.request_id}`,
        );
        return true;
      } else {
        const errorMessage =
          SMS_ERROR_CODES[response.data.error] || response.data.msg;
        this.logger.error(`[SMS Service] Error: ${errorMessage}`);
        throw new BadRequestException(`SMS Error: ${errorMessage}`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`[SMS Service] Failed: ${error.message}`);
      throw new InternalServerErrorException('SMS Gateway Error');
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   * @param phones - Array of phone numbers
   * @param message - Message content
   * @param contentId - Required content ID for bulk SMS
   * @returns Promise<boolean>
   */
  async sendBulkSms(
    phones: string[],
    message: string,
    contentId: string,
  ): Promise<boolean> {
    if (!contentId) {
      throw new BadRequestException('Content ID is required for bulk SMS');
    }

    const normalizedPhones = phones
      .map((phone) => this.normalizePhoneNumber(phone))
      .join(',');

    return this.sendSms(normalizedPhones, message, { contentId });
  }

  /**
   * Get SMS delivery report by request ID
   * @param requestId - The request ID from send SMS response
   * @returns Promise with report data
   */
  async getReport(requestId: number): Promise<SmsReportResponse['data']> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('SMS service not configured');
    }

    try {
      const response = await axios.get<SmsReportResponse>(
        `${this.baseUrl}/report/request/${requestId}/?api_key=${this.apiKey}`,
      );

      if (response.data.error === 0) {
        return response.data.data;
      } else {
        const errorMessage =
          SMS_ERROR_CODES[response.data.error] || response.data.msg;
        throw new BadRequestException(`SMS Report Error: ${errorMessage}`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`[SMS Service] Report fetch failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch SMS report');
    }
  }

  /**
   * Get account balance
   * @returns Promise with balance amount
   */
  async getBalance(): Promise<string> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('SMS service not configured');
    }

    try {
      const response = await axios.get<SmsBalanceResponse>(
        `${this.baseUrl}/user/balance/?api_key=${this.apiKey}`,
      );

      if (response.data.error === 0) {
        this.logger.log(
          `[SMS Service] Balance: ${response.data.data?.balance}`,
        );
        return response.data.data?.balance || '0';
      } else {
        const errorMessage =
          SMS_ERROR_CODES[response.data.error] || response.data.msg;
        throw new BadRequestException(`Balance Error: ${errorMessage}`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `[SMS Service] Balance fetch failed: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to fetch SMS balance');
    }
  }

  /**
   * Send password reset OTP
   * @param phone - Phone number
   * @param otp - OTP code
   * @returns Promise<boolean>
   */
  async sendPasswordResetOtp(phone: string, otp: string): Promise<boolean> {
    const message = `Your password reset code is ${otp}. This code will expire in 5 minutes. If you did not request this, please ignore.`;
    return this.sendSms(phone, message);
  }

  /**
   * Send welcome message after successful registration
   * @param phone - Phone number
   * @param name - User's name
   * @returns Promise<boolean>
   */
  async sendWelcomeMessage(phone: string, name: string): Promise<boolean> {
    const message = `Welcome ${name}! Your account has been successfully created. Thank you for joining us.`;
    return this.sendSms(phone, message);
  }

  /**
   * Send verification success notification
   * @param phone - Phone number
   * @returns Promise<boolean>
   */
  async sendVerificationSuccess(phone: string): Promise<boolean> {
    const message = `Your phone number has been successfully verified. You can now access all features of your account.`;
    return this.sendSms(phone, message);
  }

  /**
   * Normalize phone number to Bangladesh format (880XXXXXXXXXX)
   * @param phone - Phone number in various formats
   * @returns Normalized phone number
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove any spaces, dashes, or special characters
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

    // Remove leading + if present
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // If starts with 01X (Bangladesh local format), add 880
    if (cleaned.startsWith('01') && cleaned.length === 11) {
      cleaned = '880' + cleaned;
    }

    // If starts with just 1X, add 8801
    if (cleaned.startsWith('1') && cleaned.length === 10) {
      cleaned = '8801' + cleaned.substring(1);
    }

    return cleaned;
  }
}
