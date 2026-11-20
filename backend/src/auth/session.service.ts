import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestContext {
  ip?: string;
  ua?: string;
  strictPolicy?: boolean;
}

export interface SessionListDto {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  isCurrent?: boolean;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly idleMs: number;
  private readonly absoluteMs: number;
  private readonly accessTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    const idleMinutes = this.config.get<number>('SESSION_IDLE_MINUTES', 30);
    const absoluteDays = this.config.get<number>('SESSION_ABSOLUTE_DAYS', 30);
    this.idleMs = idleMinutes * 60_000;
    this.absoluteMs = absoluteDays * 24 * 60 * 60_000;
    this.accessTtl = this.config.get<number>('JWT_ACCESS_TTL_SECONDS', 600); // 10 minutes default
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Starts a brand new session upon successful authentication.
   * Protects against session fixation by always creating a new session ID.
   */
  async start(userId: string, ctx: RequestContext = {}) {
    const expiresAt = new Date(Date.now() + this.absoluteMs);
    const session = await this.prisma.session.create({
      data: {
        userId,
        ip: ctx.ip || null,
        userAgent: ctx.ua ? ctx.ua.slice(0, 255) : null,
        expiresAt,
        lastActiveAt: new Date(),
      },
    });

    return this.issuePair(session.id, userId, expiresAt);
  }

  /**
   * Issues a short-lived JWT access token (with session ID) and a cryptographically secure refresh token.
   */
  private async issuePair(sessionId: string, userId: string, expiresAt: Date) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      { expiresIn: this.accessTtl },
    );

    // 48 bytes random hex string for refresh token
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        sessionId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      sessionId,
      expiresIn: this.accessTtl,
    };
  }

  /**
   * Rotates a refresh token.
   * Implements reuse detection: if an already-used token is submitted, the whole session is revoked.
   */
  async rotate(rawRefreshToken: string, ctx: RequestContext = {}) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const rec = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });

    if (!rec) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = rec.session;
    const now = Date.now();

    // 1. REUSE DETECTION: If token was already rotated/used, flag token theft and revoke session!
    if (rec.usedAt) {
      this.logger.warn(
        `[SECURITY ALERT] Refresh token reuse detected for session ${rec.sessionId || 'unknown'}! Revoking session.`,
      );
      if (session) {
        await this.revoke(session.id, 'REFRESH_REUSE_DETECTED');
      }
      throw new UnauthorizedException('Token reuse detected. The session has been revoked for security.');
    }

    // 2. Validate session existence and expiration
    if (!session || session.revokedAt || session.expiresAt.getTime() < now || rec.expiresAt.getTime() < now) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // 3. Enforce idle timeout (e.g. 30 minutes)
    if (now - session.lastActiveAt.getTime() > this.idleMs) {
      await this.revoke(session.id, 'IDLE_TIMEOUT');
      throw new UnauthorizedException('Session expired due to inactivity');
    }

    // 4. Mark token as consumed atomically
    const updateResult = await this.prisma.refreshToken.updateMany({
      where: { id: rec.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (updateResult.count !== 1) {
      throw new UnauthorizedException('Refresh token rotation failed. Please log in again.');
    }

    // 5. Update session activity and IP
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastActiveAt: new Date(),
        ip: ctx.ip || session.ip,
      },
    });

    // 6. Issue fresh token pair
    const pair = await this.issuePair(session.id, session.userId, session.expiresAt);
    return {
      userId: session.userId,
      ...pair,
    };
  }

  /**
   * Validates and updates activity for an active session. Called on authenticated requests.
   */
  async touch(sid: string, userId: string) {
    if (!sid) return null;

    const session = await this.prisma.session.findUnique({
      where: { id: sid },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            emailVerified: true,
            emailVerifiedAt: true,
            lockedUntil: true,
            status: true,
            deletedAt: true,
            permissions: {
              select: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const now = Date.now();
    if (!session || session.userId !== userId || session.revokedAt || session.expiresAt.getTime() < now) {
      return null;
    }

    // Enforce idle timeout
    if (now - session.lastActiveAt.getTime() > this.idleMs) {
      await this.revoke(sid, 'IDLE_TIMEOUT');
      return null;
    }

    // Check account lockout
    if (session.user.lockedUntil && session.user.lockedUntil.getTime() > now) {
      return null;
    }

    // Update lastActiveAt periodically (avoid writing on every single request if < 60s)
    if (now - session.lastActiveAt.getTime() > 60_000) {
      await this.prisma.$transaction([
        this.prisma.session.update({
          where: { id: sid },
          data: { lastActiveAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { lastActiveAt: new Date() },
        }),
      ]);
    }

    return session;
  }

  /**
   * Revokes a specific session.
   */
  async revoke(sid: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sid, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  /**
   * Revokes all active sessions for a user, optionally keeping the current session active.
   */
  async revokeAllForUser(userId: string, reason: string, exceptSid?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSid ? { NOT: { id: exceptSid } } : {}),
      },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  /**
   * Lists all active sessions for a user.
   */
  async list(userId: string, currentSid?: string): Promise<SessionListDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSid,
    }));
  }
}
