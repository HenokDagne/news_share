import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditCategory, AuditSeverity, Permission, Role, RoleRequestStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SessionService } from '../../auth/session.service';
import { AuthUser } from '../../permissions/permissions.guard';
import { hasPermission, PRESETS, RANK, SENSITIVE } from '../../permissions/permissions.catalog';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { ReviewAction, ReviewRoleRequestDto } from './dto/review-role-request.dto';

@Injectable()
export class RoleManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  // ==========================================
  // 1. DIRECT ROLE ASSIGNMENT, MODIFICATION & REVOCATION (Section 1.1)
  // ==========================================

  private assertCanManageRole(actor: AuthUser, target: { id: string; role: Role }, targetRole: Role) {
    if (actor.id === target.id) {
      throw new ForbiddenException('You cannot modify or assign your own role or permissions.');
    }
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin accounts cannot be modified or revoked.');
    }
    if (targetRole === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin roles can only be granted via database seed or system bootstrap.');
    }
    if (actor.role !== Role.SUPER_ADMIN) {
      if (RANK[actor.role] <= RANK[target.role]) {
        throw new ForbiddenException('You lack rank to modify or revoke a user of equal or higher rank.');
      }
      if (RANK[actor.role] <= RANK[targetRole]) {
        throw new ForbiddenException('You cannot grant a role at or above your own rank.');
      }
    }
  }

  async assignRole(actor: AuthUser, dto: AssignRoleDto) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { profile: true, permissions: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    if (targetUser.status === UserStatus.DELETED) {
      throw new BadRequestException('Cannot assign roles to a deleted user account.');
    }

    this.assertCanManageRole(actor, targetUser, dto.role);

    const previousRole = targetUser.role;
    const isRevocation = dto.role === Role.USER && previousRole !== Role.USER;
    const isModification = previousRole !== Role.USER && dto.role !== Role.USER && previousRole !== dto.role;
    const action = isRevocation ? 'ROLE_REVOKED' : isModification ? 'ROLE_MODIFIED' : 'ROLE_ASSIGNED';

    const permsToGrant: Permission[] =
      dto.role === Role.USER
        ? []
        : dto.permissions && dto.permissions.length > 0
          ? dto.permissions
          : PRESETS[dto.role as 'MODERATOR' | 'ADMIN'] || [];

    // Verify sensitive permissions
    for (const p of permsToGrant) {
      if (SENSITIVE.includes(p) && actor.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(`Only a super admin can grant sensitive permission ${p}`);
      }
      if (!hasPermission(actor, p)) {
        throw new ForbiddenException(`You cannot grant permission ${p} because you do not hold it`);
      }
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      // 1. Update user role
      const user = await tx.user.update({
        where: { id: targetUser.id },
        data: { role: dto.role },
        include: { profile: true },
      });

      // 2. Overwrite permissions
      await tx.userPermission.deleteMany({ where: { userId: targetUser.id } });
      if (permsToGrant.length > 0) {
        await tx.userPermission.createMany({
          data: permsToGrant.map((p) => ({
            userId: targetUser.id,
            permission: p,
            grantedById: actor.id,
          })),
        });
      }

      // 3. Complete audit trail (Section 1.1 Requirement 6)
      await this.audit.logInTx(tx, {
        category: AuditCategory.ADMIN_ACTION,
        action,
        severity: AuditSeverity.HIGH,
        userId: actor.id,
        resource: `users/${targetUser.id}`,
        payload: {
          affectedUserId: targetUser.id,
          affectedUsername: targetUser.profile?.username,
          previousRole,
          newRole: dto.role,
          permissions: permsToGrant,
          reason: dto.reason,
          action,
        },
      });

      return user;
    });

    // 4. Revoke all active sessions so role change takes effect immediately (Section 1.1)
    await this.sessions.revokeAllForUser(targetUser.id, `ROLE_CHANGED_TO_${dto.role}`);

    return {
      message: `Role ${dto.role} successfully assigned to user ${targetUser.profile?.username || targetUser.email}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.profile?.username,
        role: updatedUser.role,
        permissions: permsToGrant,
      },
    };
  }

  // ==========================================
  // 2. ROLE CHANGE REQUEST WORKFLOW (Section 1.1 Requirement 4)
  // ==========================================

  async submitRoleChangeRequest(requester: AuthUser, dto: CreateRoleRequestDto) {
    if (requester.role === dto.requestedRole) {
      throw new BadRequestException(`You already possess the role ${dto.requestedRole}`);
    }

    if (dto.requestedRole === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin role cannot be requested through the workflow.');
    }

    // Check for an existing pending request
    const existingPending = await this.prisma.roleChangeRequest.findFirst({
      where: {
        userId: requester.id,
        status: RoleRequestStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException(
        `You already have an active pending role change request for ${existingPending.requestedRole}. Please wait for review.`,
      );
    }

    const request = await this.prisma.roleChangeRequest.create({
      data: {
        userId: requester.id,
        targetUserId: requester.id,
        currentRole: requester.role,
        requestedRole: dto.requestedRole,
        justification: dto.justification,
        status: RoleRequestStatus.PENDING,
      },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true, fullName: true } },
          },
        },
      },
    });

    // Audit log request
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'ROLE_CHANGE_REQUESTED',
      severity: AuditSeverity.MEDIUM,
      userId: requester.id,
      resource: `role_change_requests/${request.id}`,
      payload: {
        requestId: request.id,
        currentRole: requester.role,
        requestedRole: dto.requestedRole,
        justification: dto.justification,
      },
    });

    return request;
  }

  async getRoleRequests(status?: RoleRequestStatus) {
    const whereClause = status ? { status } : {};
    return this.prisma.roleChangeRequest.findMany({
      where: whereClause,
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true, fullName: true, avatarUrl: true } },
          },
        },
        reviewer: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyRoleRequests(userId: string) {
    return this.prisma.roleChangeRequest.findMany({
      where: { userId },
      include: {
        reviewer: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 3. REVIEW ROLE REQUEST & SEPARATION OF DUTIES (Section 1.1 Requirement 5)
  // ==========================================

  async reviewRoleRequest(actor: AuthUser, requestId: string, dto: ReviewRoleRequestDto) {
    const request = await this.prisma.roleChangeRequest.findUnique({
      where: { id: requestId },
      include: { requester: { include: { profile: true } } },
    });

    if (!request) {
      throw new NotFoundException(`Role change request ${requestId} not found.`);
    }

    if (request.status !== RoleRequestStatus.PENDING) {
      throw new BadRequestException(`This request has already been ${request.status.toLowerCase()}.`);
    }

    // =========================================================================
    // CRITICAL SECURITY RULE: SEPARATION OF DUTIES (Section 1.1 Requirement 5)
    // The person who requested a privileged role change must NOT approve their own request!
    // =========================================================================
    if (request.userId === actor.id || request.targetUserId === actor.id) {
      await this.audit.log({
        category: AuditCategory.SECURITY_ALERT,
        action: 'SEPARATION_OF_DUTIES_VIOLATION',
        severity: AuditSeverity.HIGH,
        userId: actor.id,
        resource: `role_change_requests/${requestId}`,
        payload: {
          attemptedBy: actor.id,
          requestId,
          violation: 'Self-approval of privileged role change request blocked.',
        },
      });

      throw new ForbiddenException(
        'Separation of duties violation: The person who requested a privileged role change must not approve their own request.',
      );
    }

    // Verify actor has sufficient rank to grant the requested role
    if (actor.role !== Role.SUPER_ADMIN && RANK[actor.role] <= RANK[request.requestedRole]) {
      throw new ForbiddenException('You lack administrative rank to approve this requested role.');
    }

    const reviewedAt = new Date();

    if (dto.action === ReviewAction.REJECT) {
      const rejected = await this.prisma.roleChangeRequest.update({
        where: { id: requestId },
        data: {
          status: RoleRequestStatus.REJECTED,
          reviewedById: actor.id,
          reviewedAt,
          reviewNotes: dto.reviewNotes,
        },
      });

      await this.audit.log({
        category: AuditCategory.ADMIN_ACTION,
        action: 'ROLE_CHANGE_REJECTED',
        severity: AuditSeverity.MEDIUM,
        userId: actor.id,
        resource: `role_change_requests/${requestId}`,
        payload: {
          requestId,
          requesterId: request.userId,
          rejectedRole: request.requestedRole,
          reviewNotes: dto.reviewNotes,
        },
      });

      return {
        message: 'Role change request rejected.',
        request: rejected,
      };
    }

    // If APPROVE:
    const permsToGrant: Permission[] =
      dto.customPermissions && dto.customPermissions.length > 0
        ? dto.customPermissions
        : PRESETS[request.requestedRole as 'MODERATOR' | 'ADMIN'] || [];

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update user role
      await tx.user.update({
        where: { id: request.userId },
        data: { role: request.requestedRole },
      });

      // 2. Grant permissions
      await tx.userPermission.deleteMany({ where: { userId: request.userId } });
      if (permsToGrant.length > 0) {
        await tx.userPermission.createMany({
          data: permsToGrant.map((p) => ({
            userId: request.userId,
            permission: p,
            grantedById: actor.id,
          })),
        });
      }

      // 3. Mark request as APPROVED
      const approvedRequest = await tx.roleChangeRequest.update({
        where: { id: requestId },
        data: {
          status: RoleRequestStatus.APPROVED,
          reviewedById: actor.id,
          reviewedAt,
          reviewNotes: dto.reviewNotes,
        },
      });

      // 4. Complete Audit Trail (Requirement 6)
      await this.audit.logInTx(tx, {
        category: AuditCategory.ADMIN_ACTION,
        action: 'ROLE_CHANGE_APPROVED',
        severity: AuditSeverity.HIGH,
        userId: actor.id,
        resource: `role_change_requests/${requestId}`,
        payload: {
          requestId,
          affectedUserId: request.userId,
          previousRole: request.currentRole,
          newRole: request.requestedRole,
          reviewNotes: dto.reviewNotes,
          permissions: permsToGrant,
        },
      });

      return approvedRequest;
    });

    // 5. Revoke sessions for immediate effect
    await this.sessions.revokeAllForUser(request.userId, `ROLE_PROMOTED_TO_${request.requestedRole}`);

    return {
      message: `Role change request approved. User promoted to ${request.requestedRole}.`,
      request: result,
    };
  }

  // ==========================================
  // 4. ROLE AUDIT TRAIL (Section 1.1 Requirement 6)
  // ==========================================

  async getRoleAuditTrail(userId?: string) {
    const roleActions = [
      'ROLE_ASSIGNED',
      'ROLE_MODIFIED',
      'ROLE_REVOKED',
      'ROLE_CHANGE_REQUESTED',
      'ROLE_CHANGE_APPROVED',
      'ROLE_CHANGE_REJECTED',
      'ADMIN_CREATED',
      'PERMISSIONS_CHANGED',
      'SEPARATION_OF_DUTIES_VIOLATION',
    ];

    const whereClause: any = {
      action: { in: roleActions },
    };

    if (userId) {
      whereClause.OR = [
        { userId },
        { resource: { contains: userId } },
      ];
    }

    return this.prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}
