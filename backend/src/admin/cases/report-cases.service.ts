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
      ];
    }

    const orderBy: Prisma.ReportCaseOrderByWithRelationInput =
      params.sort === 'reportCount'
        ? { reportCount: params.order || 'desc' }
        : params.sort === 'lastReportedAt'
        ? { lastReportedAt: params.order || 'desc' }
        : { priorityScore: params.order || 'desc' };

    const [total, cases] = await Promise.all([
      this.prisma.reportCase.count({ where }),
      this.prisma.reportCase.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [orderBy, { lastReportedAt: 'desc' }],
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
              content: true,
              imageUrl: true,
              status: true,
            },
          },
          reports: {
            select: {
              id: true,
              reason: true,
              reporter: {
                select: {
                  id: true,
                  profile: {
                    select: {
                      username: true,
                    },
                  },
                },
              },
            },
            take: 3,
          },
        },
      }),
    ]);

    const items = cases.map((c) => {
      let priorityLevel = 'LOW';
      if (c.priorityScore >= 20) priorityLevel = 'CRITICAL';
      else if (c.priorityScore >= 10) priorityLevel = 'HIGH';
      else if (c.priorityScore >= 5) priorityLevel = 'MEDIUM';

      return {
        id: c.id,
        targetKey: c.targetKey,
        targetType: c.targetType,
        targetUserId: c.targetUserId,
        targetUsername: c.targetUser?.profile?.username || 'user',
        targetUserAvatar: c.targetUser?.profile?.avatarUrl,
        targetPost: c.targetPost,
        status: c.status,
        priorityScore: c.priorityScore,
        priorityLevel,
        reportCount: c.reportCount,
        topReason: c.topReason,
        firstReportedAt: c.firstReportedAt,
        lastReportedAt: c.lastReportedAt,
        assignedToId: c.assignedToId,
        recentReporters: c.reports.map((r) => r.reporter.profile?.username || 'reporter'),
      };
    });

    return {
      items,
      data: items,
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
            author: true,
          },
        },
        reports: {
          include: {
            reporter: {
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

    // Earlier cases about the same target
    const earlierCases = await this.prisma.reportCase.findMany({
      where: {
        targetKey: kase.targetKey,
        id: { not: kase.id },
      },
      orderBy: { firstReportedAt: 'desc' },
      take: 5,
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
      earlierCases,
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
      // Atomic claim & status update
      const claimResult = await tx.reportCase.updateMany({
        where: {
          id,
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

      if (claimResult.count !== 1) {
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
