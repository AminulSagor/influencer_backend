import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('ALPHA_SMS_API_KEY'); // Add this to your .env
    const apiUrl = 'https://api.sms.net.bd/sendsms';

    const message = `Your verification code is ${otp}.`;

    try {
      // Alpha SMS uses a POST request (or GET)
      const response = await axios.post(apiUrl, {
        api_key: apiKey,
        msg: message,
        to: phone,
      });

      // Check Alpha SMS response format: { "error": 0, "msg": "Success", ... }
      if (response.data.error === 0) {
        this.logger.log(`[Alpha SMS] Sent to ${phone}: ${otp}`);
        return true;
      } else {
        this.logger.error(`[Alpha SMS] Error: ${response.data.msg}`);
        return false; // Or throw error
      }
    } catch (error) {
      this.logger.error(`[Alpha SMS] Failed: ${error.message}`);
      // In development, you might want to return true to bypass SMS failure
      // return true;
      throw new InternalServerErrorException('SMS Gateway Error');
    }
  }
}
