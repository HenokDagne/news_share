import { Injectable } from '@nestjs/common';
import { CaseStatus, ModerationActionType, PostStatus, Prisma, RestrictionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async getQueue() {
    const cases = await this.prisma.reportCase.findMany({
      where: {
        status: { in: [CaseStatus.PENDING, CaseStatus.UNDER_REVIEW] },
      },
      orderBy: [
        { priorityScore: 'desc' },
        { lastReportedAt: 'desc' },
      ],
      include: {
        targetUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        targetPost: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
          },
        },
      },
    });

    const now = Date.now();

    return cases.map((c) => {
      const ageHours = Math.round((now - c.firstReportedAt.getTime()) / 3_600_000);
      let slaStatus: 'ON_TRACK' | 'WARNING' | 'BREACHED' = 'ON_TRACK';
      if (ageHours > 48) slaStatus = 'BREACHED';
      else if (ageHours > 24) slaStatus = 'WARNING';

      let priorityLevel = 'LOW';
      if (c.priorityScore >= 20) priorityLevel = 'CRITICAL';
      else if (c.priorityScore >= 10) priorityLevel = 'HIGH';
      else if (c.priorityScore >= 5) priorityLevel = 'MEDIUM';

      return {
        id: c.id,
        targetKey: c.targetKey,
        targetType: c.targetType,
        targetUser: {
          id: c.targetUser.id,
          username: c.targetUser.profile?.username || 'user',
          avatarUrl: c.targetUser.profile?.avatarUrl,
        },
        targetPost: c.targetPost,
        status: c.status,
        priorityScore: c.priorityScore,
        priorityLevel,
        reportCount: c.reportCount,
        topReason: c.topReason,
        firstReportedAt: c.firstReportedAt,
        lastReportedAt: c.lastReportedAt,
        ageHours,
        slaStatus,
        assignedToId: c.assignedToId,
      };
    });
  }

  async getActiveRestrictions() {
    const restrictions = await this.prisma.userRestriction.findMany({
      where: {
        status: RestrictionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return restrictions.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.profile?.username || 'user',
      avatarUrl: r.user.profile?.avatarUrl,
      email: r.user.email,
      type: r.type,
      status: r.status,
      reason: r.reason,
      publicReason: r.publicReason,
      policyRef: r.policyRef,
      evidenceRef: r.evidenceRef,
      imposedById: r.imposedById,
      startsAt: r.startsAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  async getRemovedPosts() {
    return this.prisma.post.findMany({
      where: {
        status: PostStatus.REMOVED,
      },
      orderBy: { removedAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async getModerationActions(params: {
    targetUserId?: string;
    performedById?: string;
    type?: ModerationActionType;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(params.page || 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.ModerationActionWhereInput = {
      ...(params.targetUserId ? { targetUserId: params.targetUserId } : {}),
      ...(params.performedById ? { performedById: params.performedById } : {}),
      ...(params.type ? { type: params.type } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.moderationAction.count({ where }),
      this.prisma.moderationAction.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          targetUser: {
            select: {
              id: true,
              profile: {
                select: {
                  username: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((i) => ({
        id: i.id,
        type: i.type,
        caseId: i.caseId,
        targetUserId: i.targetUserId,
        targetUsername: i.targetUser.profile?.username || 'user',
        performedById: i.performedById,
        reason: i.reason,
        publicReason: i.publicReason,
        policyRef: i.policyRef,
        evidenceRef: i.evidenceRef,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
