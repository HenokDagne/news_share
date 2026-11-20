import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CaseStatus, PostStatus, Prisma, ReportTargetType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { REASON_WEIGHT, REPORT_REASONS } from './report-reasons';
import { EVENTS } from '../common/events/events';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  getReasons() {
    return REPORT_REASONS;
  }

  async report(
    me: string,
    t: { type: 'POST' | 'USER'; id: string },
    dto: CreateReportDto,
  ) {
    if (dto.reason === 'OTHER' && (!dto.details || dto.details.trim().length === 0)) {
      throw new BadRequestException('Details are required when selecting "Other" as the reason');
    }

    let targetUserId: string;
    let targetPostId: string | null = null;
    let snapshot: Prisma.InputJsonValue;

    if (t.type === 'POST') {
      const post = await this.prisma.post.findFirst({
        where: { id: t.id, status: PostStatus.ACTIVE },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!post) {
        throw new NotFoundException('Post not found or has been removed');
      }

      if (post.userId === me) {
        throw new BadRequestException('You cannot report your own post');
      }

      targetUserId = post.userId;
      targetPostId = post.id;
      snapshot = {
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        author: post.author,
      };
    } else {
      const profile = await this.prisma.profile.findFirst({
        where: {
          id: t.id,
          user: { status: { not: UserStatus.DELETED } },
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
          bio: true,
        },
      });

      if (!profile) {
        throw new NotFoundException('User profile not found');
      }

      if (profile.id === me) {
        throw new BadRequestException('You cannot report your own profile');
      }

      targetUserId = profile.id;
      snapshot = { ...profile };
    }

    const targetKey = `${t.type}:${t.id}`;
    const weight = REASON_WEIGHT[dto.reason] || 1;

    const out = await this.prisma.$transaction(async (tx) => {
      // Serialize reports on this target
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${targetKey}))`;

      // Check existing reports by this user on this target
      const last = await tx.report.findFirst({
        where: { reporterId: me, targetKey },
        orderBy: { createdAt: 'desc' },
        include: { case: { select: { status: true } } },
      });

      if (last) {
        const isOpen =
          last.case.status === CaseStatus.PENDING ||
          last.case.status === CaseStatus.UNDER_REVIEW;
        const coolingPeriod =
          t.type === 'USER' &&
          Date.now() - last.createdAt.getTime() < 30 * 86_400_000;

        if (isOpen || t.type === 'POST' || coolingPeriod) {
          throw new ConflictException('You have already reported this');
        }
      }

      let reportCase = await tx.reportCase.findFirst({
        where: {
          targetKey,
          status: { in: [CaseStatus.PENDING, CaseStatus.UNDER_REVIEW] },
        },
      });

      const now = new Date();

      if (!reportCase) {
        const priorViolations = await tx.reportCase.count({
          where: {
            targetUserId,
            status: CaseStatus.ACTION_TAKEN,
            closedAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
          },
        });

        reportCase = await tx.reportCase.create({
          data: {
            targetKey,
            targetType: t.type === 'POST' ? ReportTargetType.POST : ReportTargetType.USER,
            targetPostId,
            targetUserId,
            snapshot,
            priorityScore: priorViolations * 5,
            topReason: dto.reason,
            firstReportedAt: now,
            lastReportedAt: now,
            status: CaseStatus.PENDING,
          },
        });
      }

      const report = await tx.report.create({
        data: {
          caseId: reportCase.id,
          reporterId: me,
          targetKey,
          reason: dto.reason,
          details: dto.details?.trim() || null,
        },
      });

      const currentTopWeight = reportCase.topReason
        ? REASON_WEIGHT[reportCase.topReason]
        : 0;

      reportCase = await tx.reportCase.update({
        where: { id: reportCase.id },
        data: {
          reportCount: { increment: 1 },
          priorityScore: { increment: weight },
          lastReportedAt: now,
          ...(weight > currentTopWeight ? { topReason: dto.reason } : {}),
        },
      });

      await tx.userActivity.create({
        data: {
          userId: me,
          type: 'REPORT_SUBMITTED',
          refType: 'report',
          refId: report.id,
          title: t.type === 'POST' ? 'You reported a post' : 'You reported an account',
          body: 'We received your report and our moderation team will review it.',
          metadata: {
            targetType: t.type,
            reason: dto.reason,
          },
        },
      });

      return { report, reportCase };
    });

    this.events.emit(EVENTS.REPORT_CREATED, {
      caseId: out.reportCase.id,
      targetType: t.type,
      priority: out.reportCase.priorityScore,
    });

    return {
      id: out.report.id,
      status: 'RECEIVED',
    };
  }
}
