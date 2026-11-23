import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CaseStatus,
  ModerationActionType,
  Prisma,
  ReportReason,
  ReportTargetType,
  RestrictionType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RestrictionService } from '../../enforcement/restriction.service';
import { SessionService } from '../../auth/session.service';
import { AuthUser } from '../../permissions/permissions.guard';
import { hasPermission, RANK } from '../../permissions/permissions.catalog';
import { CaseDecisionDto, DecisionOutcome, ModerationDecisionActionType } from './dto/case-decision.dto';
import { EVENTS } from '../../common/events/events';

@Injectable()
export class ReportCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly restrictions: RestrictionService,
    private readonly sessions: SessionService,
    private readonly events: EventEmitter2,
  ) {}

  async getCases(params: {
    status?: CaseStatus;
    targetType?: ReportTargetType;
    reason?: ReportReason;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignedTo?: string;
    q?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const page = Math.max(params.page || 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReportCaseWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.targetType ? { targetType: params.targetType } : {}),
      ...(params.reason ? { topReason: params.reason } : {}),
      ...(params.assignedTo ? { assignedToId: params.assignedTo } : {}),
      ...(params.from || params.to
        ? {
            firstReportedAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    if (params.priority) {
      if (params.priority === 'LOW') where.priorityScore = { lt: 5 };
      else if (params.priority === 'MEDIUM') where.priorityScore = { gte: 5, lt: 10 };
      else if (params.priority === 'HIGH') where.priorityScore = { gte: 10, lt: 20 };
      else if (params.priority === 'CRITICAL') where.priorityScore = { gte: 20 };
    }

    if (params.q) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.q);
      where.OR = [
        ...(isUuid ? [{ id: params.q }] : []),
        { targetKey: { contains: params.q, mode: 'insensitive' } },
        { targetUser: { profile: { username: { contains: params.q, mode: 'insensitive' } } } },
        { targetPost: { title: { contains: params.q, mode: 'insensitive' } } },
        { targetPost: { content: { contains: params.q, mode: 'insensitive' } } },
      ];
    }

    // Fetch matching cases
    const cases = await this.prisma.reportCase.findMany({
      where,
      orderBy: [
        { lastReportedAt: 'desc' },
        { priorityScore: 'desc' },
      ],
      include: {
        targetUser: {
          select: {
            id: true,
            email: true,
            status: true,
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
            content: true,
            imageUrl: true,
            status: true,
            createdAt: true,
            author: {
              select: {
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        reports: {
          select: {
            id: true,
            reason: true,
            details: true,
            createdAt: true,
            reporter: {
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
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Group by targetKey so each target appears only ONCE
    const targetMap = new Map<string, any>();

    for (const c of cases) {
      const key = c.targetKey;
      if (!targetMap.has(key)) {
        targetMap.set(key, {
          id: c.id, // Primary case ID
          caseIds: [c.id],
          targetKey: c.targetKey,
          targetType: c.targetType,
          targetPostId: c.targetPostId,
          targetUserId: c.targetUserId,
          targetUser: c.targetUser,
          targetUsername:
            c.targetUser?.profile?.username ||
            (c.snapshot as any)?.username ||
            (c.snapshot as any)?.author?.username ||
            'user',
          targetUserAvatar:
            c.targetUser?.profile?.avatarUrl ||
            (c.snapshot as any)?.avatarUrl ||
            (c.snapshot as any)?.author?.avatarUrl,
          targetPost: c.targetPost,
          targetTitle: c.targetPost?.title || (c.snapshot as any)?.title || null,
          targetContent: c.targetPost?.content || (c.snapshot as any)?.content || null,
          targetImageUrl: c.targetPost?.imageUrl || (c.snapshot as any)?.imageUrl || null,
          snapshot: c.snapshot,
          priorityScore: c.priorityScore,
          status: c.status,
          firstReportedAt: c.firstReportedAt,
          lastReportedAt: c.lastReportedAt,
          assignedToId: c.assignedToId,
          reports: [...c.reports],
          reasonsMap: {} as Record<string, number>,
        });
        for (const r of c.reports) {
          if (r.reason) {
            targetMap.get(key).reasonsMap[r.reason] =
              (targetMap.get(key).reasonsMap[r.reason] || 0) + 1;
          }
        }
      } else {
        const existing = targetMap.get(key);
        existing.caseIds.push(c.id);
        // Merge reports without duplicate IDs
        for (const rep of c.reports) {
          if (!existing.reports.some((r: any) => r.id === rep.id)) {
            existing.reports.push(rep);
            if (rep.reason) {
              existing.reasonsMap[rep.reason] =
                (existing.reasonsMap[rep.reason] || 0) + 1;
            }
          }
        }
        // If this case is open/pending, prefer its ID and status
        if (
          c.status === CaseStatus.PENDING ||
          (c.status === CaseStatus.UNDER_REVIEW && existing.status !== CaseStatus.PENDING)
        ) {
          existing.id = c.id;
          existing.status = c.status;
          existing.assignedToId = c.assignedToId;
        }
        existing.priorityScore = Math.max(existing.priorityScore, c.priorityScore);
        if (new Date(c.firstReportedAt) < new Date(existing.firstReportedAt)) {
          existing.firstReportedAt = c.firstReportedAt;
        }
        if (new Date(c.lastReportedAt) > new Date(existing.lastReportedAt)) {
          existing.lastReportedAt = c.lastReportedAt;
        }
      }
    }

    // Build finalized array of grouped targets
    let groupedList = Array.from(targetMap.values()).map((target) => {
      const reasonsBreakdown = Object.entries(target.reasonsMap)
        .map(([reason, count]) => ({ reason, count: count as number }))
        .sort((a, b) => b.count - a.count);

      const topReason = reasonsBreakdown.length > 0 ? reasonsBreakdown[0].reason : 'GENERAL';
      const totalReportsCount = Math.max(target.reports.length, 1);

      let priorityLevel = 'LOW';
      if (target.priorityScore >= 20) priorityLevel = 'CRITICAL';
      else if (target.priorityScore >= 10) priorityLevel = 'HIGH';
      else if (target.priorityScore >= 5) priorityLevel = 'MEDIUM';

      return {
        id: target.id,
        targetKey: target.targetKey,
        targetType: target.targetType,
        targetUserId: target.targetUserId,
        targetUsername: target.targetUsername,
        targetUserAvatar: target.targetUserAvatar,
        targetUser: target.targetUser,
        targetPost: target.targetPost,
        targetTitle: target.targetTitle,
        targetContent: target.targetContent,
        targetImageUrl: target.targetImageUrl,
        status: target.status,
        priorityScore: target.priorityScore,
        priorityLevel,
        reportCount: totalReportsCount,
        totalReportsCount,
        topReason,
        reasonsBreakdown,
        firstReportedAt: target.firstReportedAt,
        lastReportedAt: target.lastReportedAt,
        assignedToId: target.assignedToId,
        recentReporters: target.reports.slice(0, 5).map((r: any) => r.reporter?.profile?.username || 'reporter'),
      };
    });

    // Sort grouped targets
    if (params.sort === 'reportCount') {
      groupedList.sort((a, b) =>
        params.order === 'asc' ? a.reportCount - b.reportCount : b.reportCount - a.reportCount,
      );
    } else if (params.sort === 'firstReportedAt') {
      groupedList.sort((a, b) => {
        const diff = new Date(a.firstReportedAt).getTime() - new Date(b.firstReportedAt).getTime();
        return params.order === 'asc' ? diff : -diff;
      });
    } else if (params.sort === 'priorityScore') {
      groupedList.sort((a, b) =>
        params.order === 'asc' ? a.priorityScore - b.priorityScore : b.priorityScore - a.priorityScore,
      );
    } else {
      // Default: lastReportedAt desc
      groupedList.sort((a, b) => {
        const diff = new Date(a.lastReportedAt).getTime() - new Date(b.lastReportedAt).getTime();
        return params.order === 'asc' ? diff : -diff;
      });
    }

    const total = groupedList.length;
    const paginatedItems = groupedList.slice(skip, skip + pageSize);

    return {
      items: paginatedItems,
      data: paginatedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getCase(id: string) {
    const kase = await this.prisma.reportCase.findUnique({
      where: { id },
      include: {
        targetUser: {
          include: {
            profile: true,
            restrictions: {
              where: { status: 'ACTIVE' },
              take: 5,
            },
            warnings: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        targetPost: {
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
        },
        reports: {
          include: {
            reporter: {
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
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        actions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!kase) {
      throw new NotFoundException('Report case not found');
    }

    // Fetch all reports matching this targetKey across all cases
    const allReportsForTarget = await this.prisma.report.findMany({
      where: { targetKey: kase.targetKey },
      include: {
        reporter: {
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
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const reportMap = new Map<string, any>();
    for (const r of [...kase.reports, ...allReportsForTarget]) {
      reportMap.set(r.id, {
        id: r.id,
        caseId: r.caseId,
        reporterId: r.reporterId,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        status: kase.status,
        reporter: r.reporter,
      });
    }
    const combinedReports = Array.from(reportMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const reasonsCountMap: Record<string, number> = {};
    for (const r of combinedReports) {
      if (r.reason) {
        reasonsCountMap[r.reason] = (reasonsCountMap[r.reason] || 0) + 1;
      }
    }
    const reasonsBreakdown = Object.entries(reasonsCountMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const firstReportedAt =
      combinedReports.length > 0
        ? combinedReports[combinedReports.length - 1].createdAt
        : kase.firstReportedAt;
    const lastReportedAt =
      combinedReports.length > 0 ? combinedReports[0].createdAt : kase.lastReportedAt;

    // Earlier / related cases for this target
    const relatedCases = await this.prisma.reportCase.findMany({
      where: {
        targetKey: kase.targetKey,
        id: { not: kase.id },
      },
      orderBy: { firstReportedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        priorityScore: true,
        reportCount: true,
        topReason: true,
        outcomeNote: true,
        closedAt: true,
      },
    });

    return {
      ...kase,
      reports: combinedReports,
      totalReportsCount: combinedReports.length,
      reportCount: combinedReports.length,
      reasonsBreakdown,
      firstReportedAt,
      lastReportedAt,
      relatedCases,
    };
  }

  async claimCase(actor: AuthUser, id: string) {
    const kase = await this.prisma.reportCase.findUnique({ where: { id } });
    if (!kase) throw new NotFoundException('Report case not found');

    if (kase.status !== CaseStatus.PENDING && kase.assignedToId && kase.assignedToId !== actor.id) {
      throw new ConflictException('Case is already claimed by another moderator');
    }

    const updated = await this.prisma.reportCase.update({
      where: { id },
      data: {
        status: CaseStatus.UNDER_REVIEW,
        assignedToId: actor.id,
      },
    });

    await this.audit.log({
      category: 'ADMIN_ACTION',
      action: 'CASE_CLAIMED',
      userId: actor.id,
      resource: `case:${id}`,
      payload: { caseId: id },
    });

    this.events.emit(EVENTS.CASE_UPDATED, { caseId: id, status: 'UNDER_REVIEW' });
    return updated;
  }

  async makeDecision(actor: AuthUser, id: string, dto: CaseDecisionDto) {
    const kase = await this.prisma.reportCase.findUnique({
      where: { id },
      include: {
        targetUser: { select: { id: true, role: true } },
        reports: { select: { reporterId: true } },
      },
    });

    if (!kase) throw new NotFoundException('Report case not found');

    if (kase.targetUserId === actor.id) {
      throw new ForbiddenException('Conflict of interest: You cannot decide a case filed against yourself');
    }

    if (actor.role !== Role.SUPER_ADMIN && RANK[actor.role] <= RANK[kase.targetUser.role]) {
      throw new ForbiddenException('Insufficient rank to take action against this user');
    }

    // Verify per-action permissions
    if (dto.outcome === DecisionOutcome.ACTION && dto.actions) {
      for (const act of dto.actions) {
        if (act.type === ModerationDecisionActionType.REMOVE_POST && !hasPermission(actor, 'POSTS_REMOVE')) {
          throw new ForbiddenException('Missing permission: POSTS_REMOVE');
        }
        if (act.type === ModerationDecisionActionType.WARN_USER && !hasPermission(actor, 'USERS_MANAGE')) {
          throw new ForbiddenException('Missing permission: USERS_MANAGE');
        }
        if (
          (act.type === ModerationDecisionActionType.SUSPEND_USER ||
            act.type === ModerationDecisionActionType.BAN_USER) &&
          !hasPermission(actor, 'USERS_BAN')
        ) {
          throw new ForbiddenException('Missing permission: USERS_BAN');
        }
      }
    }

    const mappedCaseStatus: CaseStatus =
      dto.outcome === DecisionOutcome.ACTION
        ? CaseStatus.ACTION_TAKEN
        : dto.outcome === DecisionOutcome.DISMISS
        ? CaseStatus.REJECTED
        : CaseStatus.RESOLVED;

    const now = new Date();
    let shouldRevokeSessions = false;
    let revokeReason = '';

    await this.prisma.$transaction(async (tx) => {
      // Atomic claim & status update for this target's open cases
      const claimResult = await tx.reportCase.updateMany({
        where: {
          OR: [
            { id },
            { targetKey: kase.targetKey },
          ],
          status: { in: [CaseStatus.PENDING, CaseStatus.UNDER_REVIEW] },
        },
        data: {
          status: mappedCaseStatus,
          assignedToId: actor.id,
          closedAt: now,
          closedById: actor.id,
          outcomeNote: dto.note,
        },
      });

      if (claimResult.count < 1) {
        throw new ConflictException('Case has already been decided or updated by another administrator');
      }

      // Execute actions if ACTION outcome
      if (dto.outcome === DecisionOutcome.ACTION && dto.actions) {
        for (const act of dto.actions) {
          if (act.type === ModerationDecisionActionType.REMOVE_POST && kase.targetPostId) {
            await tx.post.update({
              where: { id: kase.targetPostId },
              data: {
                status: 'REMOVED',
                removedAt: now,
                removedById: actor.id,
                removalReason: act.publicReason || 'Violated community guidelines',
              },
            });

            await tx.moderationAction.create({
              data: {
                type: ModerationActionType.REMOVE_POST,
                caseId: id,
                targetUserId: kase.targetUserId,
                targetPostId: kase.targetPostId,
                performedById: actor.id,
                reason: dto.note,
                publicReason: act.publicReason || 'Post removed for guideline violation',
                policyRef: dto.policyRef,
              },
            });

            await tx.userActivity.create({
              data: {
                userId: kase.targetUserId,
                type: 'POST_REMOVED',
                refType: 'post',
                refId: kase.targetPostId,
                title: 'Your post was removed',
                body: act.publicReason || 'Your post was removed for violating community standards.',
                metadata: { policyRef: dto.policyRef },
              },
            });

            await this.audit.logInTx(tx, {
              category: 'ADMIN_ACTION',
              action: 'POST_REMOVED',
              userId: actor.id,
              resource: `post:${kase.targetPostId}`,
              payload: { caseId: id, reason: dto.note, policyRef: dto.policyRef },
            });
          } else if (act.type === ModerationDecisionActionType.WARN_USER) {
            const warning = await tx.userWarning.create({
              data: {
                userId: kase.targetUserId,
                issuedById: actor.id,
                caseId: id,
                message: act.message || 'You received a warning for violating community guidelines.',
                policyRef: dto.policyRef,
              },
            });

            await tx.moderationAction.create({
              data: {
                type: ModerationActionType.WARN_USER,
                caseId: id,
                targetUserId: kase.targetUserId,
                performedById: actor.id,
                reason: dto.note,
                publicReason: act.message || 'Administrative warning issued',
                policyRef: dto.policyRef,
              },
            });

            await tx.userActivity.create({
              data: {
                userId: kase.targetUserId,
                type: 'WARNING_RECEIVED',
                refType: 'warning',
                refId: warning.id,
                title: 'Community Guidelines Warning',
                body: act.message || 'You received a warning for violating guidelines.',
                metadata: { policyRef: dto.policyRef },
              },
            });

            await this.audit.logInTx(tx, {
              category: 'ADMIN_ACTION',
              action: 'WARNING_ISSUED',
              userId: actor.id,
              resource: `user:${kase.targetUserId}`,
              payload: { caseId: id, warningId: warning.id, policyRef: dto.policyRef },
            });
          } else if (
            act.type === ModerationDecisionActionType.SUSPEND_USER ||
            act.type === ModerationDecisionActionType.BAN_USER
          ) {
            const isSuspension = act.type === ModerationDecisionActionType.SUSPEND_USER;
            const expiresAt = isSuspension
              ? new Date(Date.now() + (act.durationDays || 7) * 86_400_000)
              : null;
            const rType = isSuspension ? RestrictionType.SUSPENSION : RestrictionType.BAN;

            const restriction = await this.restrictions.apply(tx, {
              userId: kase.targetUserId,
              type: rType,
              reason: dto.note,
              publicReason: act.publicReason || (isSuspension ? 'Suspension imposed' : 'Permanent ban imposed'),
              evidenceRef: act.evidenceRef || `case:${id}`,
              policyRef: dto.policyRef,
              imposedById: actor.id,
              caseId: id,
              expiresAt,
            });

            await tx.moderationAction.create({
              data: {
                type: isSuspension ? ModerationActionType.SUSPEND_USER : ModerationActionType.BAN_USER,
                caseId: id,
                targetUserId: kase.targetUserId,
                performedById: actor.id,
                reason: dto.note,
                publicReason: act.publicReason,
                evidenceRef: act.evidenceRef || `case:${id}`,
                policyRef: dto.policyRef,
                restrictionId: restriction.id,
                expiresAt,
              },
            });

            await this.audit.logInTx(tx, {
              category: 'ADMIN_ACTION',
              action: isSuspension ? 'USER_SUSPENDED' : 'USER_BANNED',
              userId: actor.id,
              resource: `user:${kase.targetUserId}`,
              payload: { caseId: id, restrictionId: restriction.id, expiresAt },
            });

            shouldRevokeSessions = true;
            revokeReason = isSuspension ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_BANNED';
          }
        }
      }

      // Notify all reporters in this case with mapped status
      const mappedNoticeText =
        dto.outcome === DecisionOutcome.ACTION
          ? 'We reviewed your report and took appropriate action.'
          : dto.outcome === DecisionOutcome.DISMISS
          ? 'We reviewed your report and determined no violation occurred.'
          : 'The reported matter has been resolved.';

      for (const rep of kase.reports) {
        await tx.userActivity.create({
          data: {
            userId: rep.reporterId,
            type: 'REPORT_STATUS_CHANGED',
            refType: 'report',
            refId: id,
            title: 'Update on your report',
            body: mappedNoticeText,
            metadata: {
              caseId: id,
              outcome: dto.outcome,
            },
          },
        });
      }

      // Audit overall report decision
      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'REPORT_DECISION',
        userId: actor.id,
        resource: `case:${id}`,
        payload: {
          caseId: id,
          outcome: dto.outcome,
          note: dto.note,
          policyRef: dto.policyRef,
        },
      });
    });

    if (shouldRevokeSessions) {
      await this.sessions.revokeAllForUser(kase.targetUserId, revokeReason);
      this.events.emit(EVENTS.RESTRICTION_APPLIED, {
        userId: kase.targetUserId,
        type: revokeReason,
      });
    }

    this.events.emit(EVENTS.CASE_UPDATED, { caseId: id, status: mappedCaseStatus });
    this.events.emit(EVENTS.MODERATION_ACTION, { caseId: id, outcome: dto.outcome });

    return { status: mappedCaseStatus };
  }

  async reopenCase(actor: AuthUser, id: string, reason: string) {
    const kase = await this.prisma.reportCase.findUnique({ where: { id } });
    if (!kase) throw new NotFoundException('Report case not found');

    const updated = await this.prisma.reportCase.update({
      where: { id },
      data: {
        status: CaseStatus.UNDER_REVIEW,
        assignedToId: actor.id,
        closedAt: null,
        closedById: null,
      },
    });

    await this.audit.log({
      category: 'ADMIN_ACTION',
      action: 'CASE_REOPENED',
      userId: actor.id,
      resource: `case:${id}`,
      payload: { caseId: id, reason },
    });

    this.events.emit(EVENTS.CASE_UPDATED, { caseId: id, status: 'UNDER_REVIEW' });
    return updated;
  }

  async restorePost(actor: AuthUser, postId: string, reason: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.status !== 'REMOVED') {
      throw new NotFoundException('Post is not in removed state');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: {
          status: 'ACTIVE',
          removedAt: null,
          removedById: null,
          removalReason: null,
        },
      });

      await tx.moderationAction.create({
        data: {
          type: ModerationActionType.RESTORE_POST,
          targetUserId: post.userId,
          targetPostId: postId,
          performedById: actor.id,
          reason,
          publicReason: 'Post restored by moderation team',
        },
      });

      await tx.userActivity.create({
        data: {
          userId: post.userId,
          type: 'POST_RESTORED',
          refType: 'post',
          refId: postId,
          title: 'Your post was restored',
          body: 'Following further review, your post has been restored.',
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'POST_RESTORED',
        userId: actor.id,
        resource: `post:${postId}`,
        payload: { postId, reason },
      });

      return { status: 'ACTIVE' };
    });
  }
}
