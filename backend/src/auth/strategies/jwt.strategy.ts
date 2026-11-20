import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Permission, Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session.service';
import { AccountStatusService } from '../../enforcement/account-status.service';

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: Role;
  sid?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  sid?: string;
  permissions?: Permission[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly accountStatus: AccountStatusService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // 1. Session check: if token carries a session ID (sid), validate against active sessions table
    if (payload.sid) {
      const session = await this.sessions.touch(payload.sid, payload.sub);
      if (!session) {
        throw new UnauthorizedException('Session expired, revoked, or account locked');
      }

      // Enforcement point: assert account status
      await this.accountStatus.assertCanAuthenticate(session.user);

      return {
        id: session.userId,
        email: session.user.email,
        role: session.user.role || Role.USER,
        sid: session.id,
        permissions: session.user.permissions?.map((p: any) => p.permission) || [],
      };
    }

    // 2. Fallback check for tokens without sid (e.g. legacy/testing)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        deletedAt: true,
        lockedUntil: true,
        permissions: { select: { permission: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    await this.accountStatus.assertCanAuthenticate(user);

    return {
      id: user.id,
      email: user.email,
      role: user.role || Role.USER,
      permissions: user.permissions?.map((p: any) => p.permission) || [],
    };
  }
}

