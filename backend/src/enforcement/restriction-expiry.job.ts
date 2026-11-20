import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RestrictionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RestrictionService } from './restriction.service';

@Injectable()
export class RestrictionExpiryJob {
  private readonly logger = new Logger(RestrictionExpiryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly restrictions: RestrictionService,
  ) {}

  /**
   * Sweeps expired suspensions every minute.
   */
  @Cron('* * * * *')
  async sweep() {
    try {
      const due = await this.prisma.userRestriction.findMany({
        where: {
          status: RestrictionStatus.ACTIVE,
          expiresAt: { lte: new Date() },
        },
        select: { id: true, userId: true },
        take: 200,
      });

      for (const item of due) {
        await this.restrictions.expire(item.id);
        this.logger.log(`Auto-expired restriction ${item.id} for user ${item.userId}`);
      }
    } catch (err: any) {
      this.logger.error(`Error during restriction expiry sweep: ${err?.message}`);
    }
  }
}
