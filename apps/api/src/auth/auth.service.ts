import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse } from '@lexigram/shared';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { formatStandardDateTime } from '../common/time.util';

import { LoginDto } from './dto-login.dto';
import { RegisterDto } from './dto-register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new BadRequestException({
        message: '邮箱已被注册',
        errorCode: 'EMAIL_ALREADY_EXISTS'
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash
      }
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException({
        message: '邮箱或密码错误',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const matched = await bcrypt.compare(dto.password, user.passwordHash);

    if (!matched) {
      throw new UnauthorizedException({
        message: '邮箱或密码错误',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<{ id: string; email: string; createdAt: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException({
        message: '用户会话无效',
        errorCode: 'INVALID_SESSION'
      });
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: formatStandardDateTime(user.createdAt)
    };
  }

  private buildAuthResponse(user: User): AuthResponse {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        createdAt: formatStandardDateTime(user.createdAt)
      }
    };
  }
}
