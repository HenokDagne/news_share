import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessReviewAction, AuditCategory, AuditSeverity, Permission, ReviewCampaignStatus, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SessionService } from '../../auth/session.service';
import { AuthUser } from '../../permissions/permissions.guard';
import { PRESETS } from '../../permissions/permissions.catalog';
import { CreateCampaignDto, RecordDecisionDto } from './dto/access-review.dto';

@Injectable()
export class AccessReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  // ==========================================
  // 1. START QUARTERLY ACCESS REVIEW CAMPAIGN (Section 1.1 Requirement 8)
  // ==========================================

  async startCampaign(actor: AuthUser, dto: CreateCampaignDto) {
    const existingActive = await this.prisma.accessReviewCampaign.findFirst({
      where: {
        quarter: dto.quarter,
        year: dto.year,
        status: ReviewCampaignStatus.IN_PROGRESS,
      },
    });

    if (existingActive) {
      throw new ConflictException(
        `An active access review campaign for ${dto.quarter} (${dto.year}) is already in progress.`,
      );
    }

    const campaignName = dto.name || `${dto.quarter} (${dto.year}) Periodic Privilege Access Review`;

    const campaign = await this.prisma.accessReviewCampaign.create({
      data: {
        name: campaignName,
        quarter: dto.quarter,
        year: dto.year,
        status: ReviewCampaignStatus.IN_PROGRESS,
        conductedById: actor.id,
        notes: dto.notes,
      },
      include: {
        conductedBy: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true } },
          },
        },
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'ACCESS_REVIEW_STARTED',
      severity: AuditSeverity.HIGH,
      userId: actor.id,
      resource: `access_review_campaigns/${campaign.id}`,
      payload: {
        campaignId: campaign.id,
        quarter: dto.quarter,
        year: dto.year,
        startedBy: actor.id,
      },
    });

    return campaign;
  }

  // ==========================================
  // 2. LIST & INSPECT CAMPAIGNS AND PRIVILEGED USERS
  // ==========================================

  async listCampaigns() {
    const campaigns = await this.prisma.accessReviewCampaign.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        conductedBy: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true } },
          },
        },
        _count: {
          select: { decisions: true },
        },
      },
    });

    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      quarter: c.quarter,
      year: c.year,
      status: c.status,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      conductedBy: c.conductedBy.profile?.username || c.conductedBy.email,
      decisionsCount: c._count.decisions,
      notes: c.notes,
    }));
  }

  async getCampaignDetails(campaignId: string) {
    const campaign = await this.prisma.accessReviewCampaign.findUnique({
      where: { id: campaignId },
      include: {
        conductedBy: {
          select: { id: true, email: true, profile: { select: { username: true } } },
        },
        decisions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { username: true, fullName: true, avatarUrl: true } },
              },
            },
            reviewedBy: {
              select: { id: true, email: true, profile: { select: { username: true } } },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Access review campaign with ID ${campaignId} not found.`);
    }

    // Discover all current privileged users
    const privilegedUsers = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.MODERATOR, Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR] },
        status: { not: UserStatus.DELETED },
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        lastActiveAt: true,
        profile: { select: { username: true, fullName: true, avatarUrl: true } },
        permissions: { select: { permission: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    const evaluatedUsers = privilegedUsers.map((u) => {
      const lastActive = u.lastActiveAt || u.lastLoginAt;
      const inactiveDays = lastActive ? Math.round((now - lastActive.getTime()) / 86400000) : 999;
      const decision = campaign.decisions.find((d) => d.userId === u.id);

      return {
        id: u.id,
        email: u.email,
        username: u.profile?.username || 'user',
        fullName: u.profile?.fullName,
        avatarUrl: u.profile?.avatarUrl,
        role: u.role,
        permissions: u.permissions.map((p) => p.permission),
        lastLoginAt: u.lastLoginAt,
        lastActiveAt: u.lastActiveAt,
        inactiveDays,
        isInactiveRisk: inactiveDays >= 30, // flagged for quarterly review if inactive >= 30 days
        reviewDecision: decision
          ? {
              decision: decision.decision,
              decisionReason: decision.decisionReason,
              reviewedAt: decision.createdAt,
              reviewedBy: decision.reviewedBy.profile?.username || decision.reviewedBy.email,
            }
          : null,
      };
    });

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        quarter: campaign.quarter,
        year: campaign.year,
        status: campaign.status,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        notes: campaign.notes,
        conductedBy: campaign.conductedBy.profile?.username || campaign.conductedBy.email,
      },
      privilegedUsersCount: evaluatedUsers.length,
      decisionsRecordedCount: campaign.decisions.length,
      privilegedUsers: evaluatedUsers,
    };
  }

  // ==========================================
  // 3. RECORD ACCESS REVIEW DECISION (Section 1.1 Requirement 8)
  // ==========================================

  async recordDecision(actor: AuthUser, campaignId: string, dto: RecordDecisionDto) {
    const campaign = await this.prisma.accessReviewCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Access review campaign with ID ${campaignId} not found.`);
    }

    if (campaign.status === ReviewCampaignStatus.COMPLETED) {
      throw new BadRequestException('Cannot record decisions on a completed access review campaign.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { permissions: true, profile: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`Target user with ID ${dto.userId} not found.`);
    }

    const currentPermissions = targetUser.permissions.map((p) => p.permission);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Delete prior decision in this campaign if re-evaluating
      await tx.accessReviewDecision.deleteMany({
        where: { campaignId, userId: dto.userId },
      });

      // 2. Create decision record
      const decisionRecord = await tx.accessReviewDecision.create({
        data: {
          campaignId,
          userId: dto.userId,
          roleAtReview: targetUser.role,
          permissionsAtReview: currentPermissions,
          lastActiveAt: targetUser.lastActiveAt,
          decision: dto.decision,
          decisionReason: dto.decisionReason,
          reviewedById: actor.id,
          executedAt: new Date(),
        },
      });

      // 3. Execute enforcement if decision is REVOKE
      if (dto.decision === AccessReviewAction.REVOKE) {
        await tx.user.update({
          where: { id: targetUser.id },
          data: { role: Role.USER },
        });
        await tx.userPermission.deleteMany({ where: { userId: targetUser.id } });
      }

      // 4. Execute enforcement if decision is MODIFY
      if (dto.decision === AccessReviewAction.MODIFY) {
        const newRole = dto.newRole || targetUser.role;
        const newPerms: Permission[] =
          dto.newPermissions && dto.newPermissions.length > 0
            ? dto.newPermissions
            : PRESETS[newRole as 'MODERATOR' | 'ADMIN'] || [];

        await tx.user.update({
          where: { id: targetUser.id },
          data: { role: newRole },
        });

        await tx.userPermission.deleteMany({ where: { userId: targetUser.id } });
        if (newPerms.length > 0) {
          await tx.userPermission.createMany({
            data: newPerms.map((p) => ({
              userId: targetUser.id,
              permission: p,
              grantedById: actor.id,
            })),
          });
        }
      }

      // 5. Audit trail for review decision
      await this.audit.logInTx(tx, {
        category: AuditCategory.ADMIN_ACTION,
        action: 'ACCESS_REVIEW_DECISION_RECORDED',
        severity: AuditSeverity.HIGH,
        userId: actor.id,
        resource: `access_review_decisions/${decisionRecord.id}`,
        payload: {
          campaignId,
          targetUserId: targetUser.id,
          targetUsername: targetUser.profile?.username,
          previousRole: targetUser.role,
          decision: dto.decision,
          decisionReason: dto.decisionReason,
        },
      });

      return decisionRecord;
    });

    // Revoke sessions if revoked or modified for instant effect
    if (dto.decision === AccessReviewAction.REVOKE || dto.decision === AccessReviewAction.MODIFY) {
      await this.sessions.revokeAllForUser(targetUser.id, `ACCESS_REVIEW_${dto.decision}`);
    }

    return {
      message: `Access review decision [${dto.decision}] recorded for ${targetUser.profile?.username || targetUser.email}`,
      decision: result,
    };
  }

  // ==========================================
  // 4. FINALIZE & COMPLETE CAMPAIGN
  // ==========================================

  async completeCampaign(actor: AuthUser, campaignId: string) {
    const campaign = await this.prisma.accessReviewCampaign.findUnique({
      where: { id: campaignId },
      include: { decisions: true },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found.`);
    }

    if (campaign.status === ReviewCampaignStatus.COMPLETED) {
      throw new BadRequestException('Campaign is already completed.');
    }

    const updated = await this.prisma.accessReviewCampaign.update({
      where: { id: campaignId },
      data: {
        status: ReviewCampaignStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'ACCESS_REVIEW_COMPLETED',
      severity: AuditSeverity.HIGH,
      userId: actor.id,
      resource: `access_review_campaigns/${campaignId}`,
      payload: {
        campaignId,
        quarter: campaign.quarter,
        decisionsTotal: campaign.decisions.length,
        completedBy: actor.id,
      },
    });

    return {
      message: `Access review campaign ${campaign.quarter} (${campaign.year}) successfully completed.`,
      campaign: updated,
    };
  }
}
