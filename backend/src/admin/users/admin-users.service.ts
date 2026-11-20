import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ModerationActionType,
  Prisma,
  RestrictionType,
  Role,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RestrictionService } from '../../enforcement/restriction.service';
import { AuditService } from '../../audit/audit.service';
import { SessionService } from '../../auth/session.service';
import { AuthUser } from '../../permissions/permissions.guard';
import { RANK } from '../../permissions/permissions.catalog';
import { BanUserDto, DeleteUserDto, WarnUserDto } from './dto/user-management.dto';
import { EVENTS } from '../../common/events/events';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restrictions: RestrictionService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly events: EventEmitter2,
  ) {}

  private assertCanTarget(actor: AuthUser, target: { id: string; role: Role }) {
    if (actor.id === target.id) {
      throw new ForbiddenException('You cannot perform administrative actions on yourself');
    }
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin accounts cannot be modified here');
    }
    if (actor.role !== Role.SUPER_ADMIN && RANK[actor.role] <= RANK[target.role]) {
      throw new ForbiddenException('You lack the authority/rank to act on this staff member');
    }
  }

  async getUsers(params: {
    q?: string;
    status?: UserStatus;
    role?: Role;
    registeredFrom?: Date;
    registeredTo?: Date;
    hasReports?: boolean;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const page = Math.max(params.page || 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      status: { not: UserStatus.DELETED },
      ...(params.status ? { status: params.status } : {}),
      ...(params.role ? { role: params.role } : {}),
      ...(params.registeredFrom || params.registeredTo
        ? {
            createdAt: {
              ...(params.registeredFrom ? { gte: params.registeredFrom } : {}),
              ...(params.registeredTo ? { lte: params.registeredTo } : {}),
            },
          }
        : {}),
      ...(params.q
        ? {
            OR: [
              { email: { contains: params.q, mode: 'insensitive' } },
              { profile: { username: { contains: params.q, mode: 'insensitive' } } },
              { profile: { fullName: { contains: params.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [params.sort || 'createdAt']: params.order || 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          lastActiveAt: true,
          createdAt: true,
          profile: {
            select: {
              username: true,
              fullName: true,
              avatarUrl: true,
              _count: {
                select: {
                  posts: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Aggregate report counts against these users efficiently
    const userIds = users.map((u) => u.id);
    const casesGroup = await this.prisma.reportCase.groupBy({
      by: ['targetUserId'],
      where: { targetUserId: { in: userIds } },
      _sum: { reportCount: true },
    });

    const reportCountMap = new Map<string, number>();
    for (const g of casesGroup) {
      reportCountMap.set(g.targetUserId, g._sum.reportCount || 0);
    }

    const items = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      username: u.profile?.username || 'user',
      fullName: u.profile?.fullName,
      avatarUrl: u.profile?.avatarUrl,
      postCount: u.profile?._count?.posts || 0,
      reportsAgainst: reportCountMap.get(u.id) || 0,
      lastActiveAt: u.lastActiveAt,
      createdAt: u.createdAt,
    }));

    const finalItems = params.hasReports ? items.filter((i) => i.reportsAgainst > 0) : items;

    return {
      items: finalItems,
      data: finalItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUser(id: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            _count: {
              select: {
                posts: true,
              },
            },
          },
        },
        restrictions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        warnings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        actionsAgainst: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        casesAgainst: {
          orderBy: { lastReportedAt: 'desc' },
          take: 5,
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            ip: true,
            userAgent: true,
            createdAt: true,
            lastActiveAt: true,
          },
        },
        _count: {
          select: {
            reportsFiled: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Write audit event
    await this.audit.log({
      category: 'ADMIN_ACTION',
      action: 'ADMIN_VIEWED_USER',
      userId: actor.id,
      resource: `user:${id}`,
      payload: { viewedUserId: id, username: user.profile?.username },
    });

    return user;
  }

  async activateUser(actor: AuthUser, id: string, reason: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanTarget(actor, target);

    return this.prisma.$transaction(async (tx) => {
      await this.restrictions.lift(tx, {
        userId: id,
        liftedById: actor.id,
        reason,
        status: 'LIFTED',
      });

      await tx.moderationAction.create({
        data: {
          type: ModerationActionType.ACTIVATE_USER,
          targetUserId: id,
          performedById: actor.id,
          reason,
          publicReason: 'Account reactivated by administrator',
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'USER_ACTIVATED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: { reason, targetUserId: id },
      });

      return { status: 'ACTIVE' };
    });
  }

  async deactivateUser(actor: AuthUser, id: string, reason: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanTarget(actor, target);

    const result = await this.prisma.$transaction(async (tx) => {
      const r = await this.restrictions.apply(tx, {
        userId: id,
        type: RestrictionType.DEACTIVATION,
        reason,
        publicReason: 'Your account was placed on administrative hold.',
        imposedById: actor.id,
      });

      await tx.moderationAction.create({
        data: {
          type: ModerationActionType.DEACTIVATE_USER,
          targetUserId: id,
          performedById: actor.id,
          reason,
          restrictionId: r.id,
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'USER_DEACTIVATED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: { reason, targetUserId: id, restrictionId: r.id },
      });

      return r;
    });

    await this.sessions.revokeAllForUser(id, 'ACCOUNT_DEACTIVATED');
    this.events.emit(EVENTS.RESTRICTION_APPLIED, { userId: id, type: 'DEACTIVATION' });
    return result;
  }

  async warnUser(actor: AuthUser, id: string, dto: WarnUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanTarget(actor, target);

    return this.prisma.$transaction(async (tx) => {
      const warning = await tx.userWarning.create({
        data: {
          userId: id,
          issuedById: actor.id,
          message: dto.message,
          policyRef: dto.policyRef || null,
        },
      });

      await tx.userActivity.create({
        data: {
          userId: id,
          type: 'WARNING_RECEIVED',
          refType: 'warning',
          refId: warning.id,
          title: 'You received a community guidelines warning',
          body: dto.message,
          metadata: { policyRef: dto.policyRef },
        },
      });

      await tx.moderationAction.create({
        data: {
          type: ModerationActionType.WARN_USER,
          targetUserId: id,
          performedById: actor.id,
          reason: dto.reason || dto.message,
          publicReason: dto.message,
          policyRef: dto.policyRef,
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'USER_WARNED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: { warningId: warning.id, message: dto.message, policyRef: dto.policyRef },
      });

      return warning;
    });
  }

  async banUser(actor: AuthUser, id: string, dto: BanUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanTarget(actor, target);

    const isSuspension = Boolean(dto.durationDays && dto.durationDays > 0);
    const expiresAt = isSuspension
      ? new Date(Date.now() + dto.durationDays! * 86_400_000)
      : null;

    const restrictionType = isSuspension ? RestrictionType.SUSPENSION : RestrictionType.BAN;

    const result = await this.prisma.$transaction(async (tx) => {
      const r = await this.restrictions.apply(tx, {
        userId: id,
        type: restrictionType,
        reason: dto.reason,
        publicReason: dto.publicReason || (isSuspension ? 'Suspended for policy violation' : 'Permanently banned for policy violation'),
        evidenceRef: dto.evidenceRef,
        policyRef: dto.policyRef,
        imposedById: actor.id,
        expiresAt,
      });

      await tx.moderationAction.create({
        data: {
          type: isSuspension ? ModerationActionType.SUSPEND_USER : ModerationActionType.BAN_USER,
          targetUserId: id,
          performedById: actor.id,
          reason: dto.reason,
          publicReason: dto.publicReason,
          evidenceRef: dto.evidenceRef,
          policyRef: dto.policyRef,
          restrictionId: r.id,
          expiresAt,
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: isSuspension ? 'USER_SUSPENDED' : 'USER_BANNED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: {
          reason: dto.reason,
          publicReason: dto.publicReason,
          durationDays: dto.durationDays,
          expiresAt,
        },
      });

      return r;
    });

    await this.sessions.revokeAllForUser(id, isSuspension ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_BANNED');
    this.events.emit(EVENTS.RESTRICTION_APPLIED, { userId: id, type: restrictionType });
    return result;
  }

  async unbanUser(actor: AuthUser, id: string, reason: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanTarget(actor, target);

    return this.prisma.$transaction(async (tx) => {
      await this.restrictions.lift(tx, {
        userId: id,
        liftedById: actor.id,
        reason,
        status: 'LIFTED',
      });

      await tx.moderationAction.create({
        data: {
          type: ModerationActionType.UNBAN_USER,
          targetUserId: id,
          performedById: actor.id,
          reason,
          publicReason: 'Account ban lifted by administrator',
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'USER_UNBANNED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: { reason, targetUserId: id },
      });

      return { status: 'ACTIVE' };
    });
  }

  async deleteUser(actor: AuthUser, id: string, dto: DeleteUserDto) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!target) throw new NotFoundException('User not found');
    this.assertCanTarget(actor, target);

    if (target.profile?.username.toLowerCase() !== dto.confirmUsername.trim().toLowerCase()) {
      throw new BadRequestException('Confirmation username does not match');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.DELETED,
          deletedAt: now,
          deletedById: actor.id,
        },
      });

      // Soft-remove all user posts
      await tx.post.updateMany({
        where: { userId: id },
        data: {
          status: 'REMOVED',
          removedAt: now,
          removedById: actor.id,
          removalReason: 'Account deleted',
        },
      });

      await tx.moderationAction.create({
        data: {
          type: ModerationActionType.DELETE_USER,
          targetUserId: id,
          performedById: actor.id,
          reason: dto.reason,
          publicReason: 'Account deleted per administrator request',
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'USER_DELETED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: { reason: dto.reason, username: target.profile?.username },
      });
    });

    await this.sessions.revokeAllForUser(id, 'ACCOUNT_DELETED');
    return { status: 'DELETED' };
  }

  async restoreUser(actor: AuthUser, id: string, reason: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.status !== UserStatus.DELETED) {
      throw new NotFoundException('User is not in deleted state');
    }

    // Verify 30-day grace period
    if (target.deletedAt && Date.now() - target.deletedAt.getTime() > 30 * 86_400_000) {
      throw new BadRequestException('The 30-day restoration window has expired');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          deletedById: null,
          statusUpdatedAt: new Date(),
        },
      });

      // Restore posts that were removed due to account deletion
      await tx.post.updateMany({
        where: { userId: id, removalReason: 'Account deleted' },
        data: {
          status: 'ACTIVE',
          removedAt: null,
          removedById: null,
          removalReason: null,
        },
      });

      await tx.moderationAction.create({
        data: {
          type: ModerationActionType.RESTORE_USER,
          targetUserId: id,
          performedById: actor.id,
          reason,
          publicReason: 'Account restored from deletion',
        },
      });

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'USER_RESTORED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: { reason, targetUserId: id },
      });

      return { status: 'ACTIVE' };
    });
  }
}
