import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly user = process.env.AUTH_USER;
  private readonly pass = process.env.AUTH_PASS;

  constructor(private jwtService: JwtService) {}

  async validateLocal(username: string, password: string) {
    if (username === this.user && password === this.pass) return { username };
    return null;
  }

  async login(username: string, password: string) {
    if (username !== this.user || password !== this.pass) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { username };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
