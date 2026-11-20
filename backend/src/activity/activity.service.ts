import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, CaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STATUS_DISPLAY_MAP: Record<CaseStatus, string> = {
  PENDING: 'Received',
  UNDER_REVIEW: 'Under review',
  ACTION_TAKEN: 'Action taken',
  REJECTED: 'No violation found',
  RESOLVED: 'Resolved',
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivity(
    userId: string,
    params: {
      type?: ActivityType;
      unread?: boolean;
      limit?: number;
      cursor?: string;
    },
  ) {
    const take = Math.min(Math.max(params.limit || 20, 1), 50);

    const where: Prisma.UserActivityWhereInput = {
      userId,
      ...(params.type ? { type: params.type } : {}),
      ...(params.unread !== undefined ? { isRead: !params.unread } : {}),
    };

    const activities = await this.prisma.userActivity.findMany({
      where,
      take: take + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor: string | null = null;
    let items = activities;

    if (activities.length > take) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id || null;
    }

    return {
      data: items,
      nextCursor,
      hasMore: nextCursor !== null,
    };
  }

  async getMyReports(userId: string, limit = 20, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), 50);

    const reports = await this.prisma.report.findMany({
      where: { reporterId: userId },
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        case: {
          select: {
            id: true,
            status: true,
            targetType: true,
            firstReportedAt: true,
            closedAt: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    let items = reports;

    if (reports.length > take) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id || null;
    }

    return {
      data: items.map((r) => ({
        id: r.id,
        targetKey: r.targetKey,
        targetType: r.case.targetType,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        status: STATUS_DISPLAY_MAP[r.case.status] || 'Received',
        rawStatus: r.case.status,
      })),
      nextCursor,
      hasMore: nextCursor !== null,
    };
  }

  async getMyWarnings(userId: string) {
    return this.prisma.userWarning.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        policyRef: true,
        createdAt: true,
        readAt: true,
      },
    });
  }

  async getAccountStatus(userId: string) {
    const warningCount = await this.prisma.userWarning.count({
      where: { userId },
    });

    return {
      standing: warningCount > 0 ? 'WARNED' : 'GOOD',
      warningCount,
      activeRestriction: null,
    };
  }

  async markRead(userId: string, id: string) {
    const act = await this.prisma.userActivity.findFirst({
      where: { id, userId },
    });

    if (!act) {
      throw new NotFoundException('Activity record not found');
    }

    return this.prisma.userActivity.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.userActivity.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}
