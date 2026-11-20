import { Injectable } from '@nestjs/common';
import { CaseStatus, PostStatus, ReportTargetType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardRepository, DashboardTable } from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: DashboardRepository,
  ) {}

  async getSummary() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000);

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      suspendedUsers,
      deactivatedUsers,
      totalPosts,
      reportedPostsGroup,
      pendingReports,
      underReviewReports,
      resolvedReports,
      newRegCurrent,
      newRegPrevious,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: UserStatus.DELETED } } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.BANNED } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { status: UserStatus.DEACTIVATED } }),
      this.prisma.post.count({ where: { status: PostStatus.ACTIVE } }),
      this.prisma.reportCase.groupBy({
        by: ['targetPostId'],
        where: {
          targetType: ReportTargetType.POST,
          targetPostId: { not: null },
        },
      }),
      this.prisma.reportCase.count({ where: { status: CaseStatus.PENDING } }),
      this.prisma.reportCase.count({ where: { status: CaseStatus.UNDER_REVIEW } }),
      this.prisma.reportCase.count({
        where: {
          status: { in: [CaseStatus.ACTION_TAKEN, CaseStatus.REJECTED, CaseStatus.RESOLVED] },
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
    ]);

    const registrationGrowth =
      newRegPrevious > 0
        ? Math.round(((newRegCurrent - newRegPrevious) / newRegPrevious) * 100)
        : newRegCurrent > 0
        ? 100
        : 0;

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
      suspendedUsers,
      deactivatedUsers,
      totalPosts,
      reportedPosts: reportedPostsGroup.length,
      pendingReports,
      underReviewReports,
      resolvedReports,
      newRegistrations: newRegCurrent,
      registrationGrowth,
      updatedAt: now.toISOString(),
    };
  }

  async getTimeseries(metric = 'registrations', range = '30d') {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);

    const metricTableMap: Record<string, DashboardTable> = {
      registrations: 'users',
      posts: 'posts',
      reports: 'report_cases',
      moderation: 'moderation_actions',
    };

    const table = metricTableMap[metric] || 'users';
    return this.repo.dailyCounts(table, from, now);
  }

  async getRecent() {
    const [registrations, cases, adminActions] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: { not: UserStatus.DELETED } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          profile: {
            select: {
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.reportCase.findMany({
        orderBy: { lastReportedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          targetKey: true,
          targetType: true,
          status: true,
          priorityScore: true,
          reportCount: true,
          topReason: true,
          firstReportedAt: true,
          lastReportedAt: true,
        },
      }),
      this.prisma.moderationAction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          reason: true,
          publicReason: true,
          policyRef: true,
          createdAt: true,
          performedById: true,
        },
      }),
    ]);

    return {
      recentRegistrations: registrations.map((r) => ({
        id: r.id,
        email: r.email,
        username: r.profile?.username || 'user',
        fullName: r.profile?.fullName,
        avatarUrl: r.profile?.avatarUrl,
        role: r.role,
        status: r.status,
        createdAt: r.createdAt,
      })),
      recentCases: cases,
      recentActions: adminActions,
    };
  }

  async getDistribution() {
    const [statusDist, roleDist] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    return {
      status: statusDist.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      roles: roleDist.map((r) => ({
        role: r.role,
        count: r._count.id,
      })),
    };
  }
}
