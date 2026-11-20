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
    // Invalidate/delete previous unused tokens of the same type for this user
    await this.prisma.oneTimeToken.deleteMany({
      where: {
        userId,
        type,
        usedAt: null,
      },
    });

    const raw = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(raw);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

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
    const rec = await this.prisma.oneTimeToken.findUnique({
      where: { tokenHash },
    });

    if (!rec || rec.type !== type || rec.usedAt !== null || rec.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Mark as used atomically
    const res = await this.prisma.oneTimeToken.updateMany({
      where: { id: rec.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (res.count !== 1) {
      throw new BadRequestException('Invalid or expired token');
    }

    return rec.userId;
  }
}
