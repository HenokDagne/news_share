import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session.service';

export interface JwtPayload {
  sub: string;
  email?: string;
  sid?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
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
      return {
        id: session.userId,
        email: session.user.email,
        sid: session.id,
      };
    }

    // 2. Fallback check for tokens without sid (e.g. legacy/testing)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, lockedUntil: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    return {
      id: user.id,
      email: user.email,
    };
  }
}
