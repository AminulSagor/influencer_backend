import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString } from 'class-validator';

class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }
}
