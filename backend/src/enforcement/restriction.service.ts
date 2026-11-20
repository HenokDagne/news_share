import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RestrictionStatus, RestrictionType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EVENTS } from '../common/events/events';

const STATUS_FOR: Record<RestrictionType, UserStatus> = {
  DEACTIVATION: UserStatus.DEACTIVATED,
  SUSPENSION: UserStatus.SUSPENDED,
  BAN: UserStatus.BANNED,
};

const SEVERITY: Record<RestrictionType, number> = {
  DEACTIVATION: 1,
  SUSPENSION: 2,
  BAN: 3,
};

@Injectable()
export class RestrictionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  /**
   * Applies an administrative restriction inside a transaction.
   * If a weaker active restriction exists, it is superseded and lifted.
   * If a stricter active restriction exists, a conflict is thrown.
   */
  async apply(
    tx: Prisma.TransactionClient,
    p: {
      userId: string;
      type: RestrictionType;
      reason: string;
      publicReason?: string;
      evidenceRef?: string;
      policyRef?: string;
      imposedById: string;
      caseId?: string;
      expiresAt?: Date | null;
    },
  ) {
    if (p.type === RestrictionType.SUSPENSION && !p.expiresAt) {
      throw new BadRequestException('A temporary suspension requires an expiration date (expiresAt)');
    }
    if (p.type !== RestrictionType.SUSPENSION && p.expiresAt) {
      throw new BadRequestException('Only suspensions can have an expiration date');
    }

    // Serialize restrictions on this user using PostgreSQL advisory transaction lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'restriction:' + p.userId}))`;

    const active = await tx.userRestriction.findFirst({
      where: { userId: p.userId, status: RestrictionStatus.ACTIVE },
    });

    if (active) {
      if (SEVERITY[active.type] > SEVERITY[p.type]) {
        throw new ConflictException('A more severe restriction is already active on this user');
      }
      // Supersede current active restriction
      await tx.userRestriction.update({
        where: { id: active.id },
        data: {
          status: RestrictionStatus.LIFTED,
          liftedAt: new Date(),
          liftedById: p.imposedById,
          liftReason: 'Superseded by higher or updated restriction',
        },
      });
    }

    const restriction = await tx.userRestriction.create({
      data: {
        userId: p.userId,
        type: p.type,
        status: RestrictionStatus.ACTIVE,
        reason: p.reason,
        publicReason: p.publicReason || null,
        evidenceRef: p.evidenceRef || null,
        policyRef: p.policyRef || null,
        imposedById: p.imposedById,
        caseId: p.caseId || null,
        startsAt: new Date(),
        expiresAt: p.expiresAt ?? null,
      },
    });

    // Update User.status cache
    await tx.user.update({
      where: { id: p.userId },
      data: {
        status: STATUS_FOR[p.type],
        statusUpdatedAt: new Date(),
      },
    });

    // Record UserActivity notice for the user
    await tx.userActivity.create({
      data: {
        userId: p.userId,
        type: 'RESTRICTION_APPLIED',
        refType: 'restriction',
        refId: restriction.id,
        title:
          p.type === RestrictionType.BAN
            ? 'Your account was permanently banned'
            : p.type === RestrictionType.SUSPENSION
            ? 'Your account was temporarily suspended'
            : 'Your account was placed on administrative hold',
        body: p.publicReason || 'An administrative restriction was applied.',
        metadata: {
          expiresAt: p.expiresAt ?? null,
          type: p.type,
        },
      },
    });

    return restriction;
  }

  /**
   * Lifts an active restriction inside a transaction.
   */
  async lift(
    tx: Prisma.TransactionClient,
    p: {
      userId: string;
      liftedById: string | null;
      reason: string;
      status?: 'LIFTED' | 'EXPIRED';
    },
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'restriction:' + p.userId}))`;

    const active = await tx.userRestriction.findFirst({
      where: { userId: p.userId, status: RestrictionStatus.ACTIVE },
    });

    if (!active) {
      throw new NotFoundException('No active restriction found for this user');
    }

    const updated = await tx.userRestriction.update({
      where: { id: active.id },
      data: {
        status: p.status === 'EXPIRED' ? RestrictionStatus.EXPIRED : RestrictionStatus.LIFTED,
        liftedAt: new Date(),
        liftedById: p.liftedById,
        liftReason: p.reason,
      },
    });

    await tx.user.update({
      where: { id: p.userId },
      data: {
        status: UserStatus.ACTIVE,
        statusUpdatedAt: new Date(),
      },
    });

    await tx.userActivity.create({
      data: {
        userId: p.userId,
        type: 'RESTRICTION_LIFTED',
        refType: 'restriction',
        refId: active.id,
        title: 'Your account access has been restored',
        body: 'The previous restriction on your account has ended or was lifted.',
      },
    });

    return updated;
  }

  /**
   * Handles expiry of a temporary suspension (called by sweep or lazy check).
   */
  async expire(restrictionId: string) {
    const r = await this.prisma.userRestriction.findUnique({
      where: { id: restrictionId },
    });

    if (!r || r.status !== RestrictionStatus.ACTIVE || !r.expiresAt || r.expiresAt > new Date()) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lift(tx, {
        userId: r.userId,
        liftedById: null,
        reason: 'Temporary suspension expired automatically',
        status: 'EXPIRED',
      });

      await this.audit.logInTx(tx, {
        category: 'SYSTEM_EVENT',
        action: 'RESTRICTION_EXPIRED',
        userId: r.userId,
        resource: `restriction:${r.id}`,
        payload: { restrictionId: r.id, userId: r.userId, type: r.type },
      });
    });

    this.events.emit(EVENTS.RESTRICTION_LIFTED, { userId: r.userId });
  }
}
