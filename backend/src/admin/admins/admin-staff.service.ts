import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Permission, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SessionService } from '../../auth/session.service';
import { MailService } from '../../mail/mail.service';
import { OneTimeTokenService } from '../../auth/one-time-token.service';
import { AuthUser } from '../../permissions/permissions.guard';
import {
  hasPermission,
  PERMISSION_LABELS,
  PRESETS,
  RANK,
  SENSITIVE,
} from '../../permissions/permissions.catalog';
import { hashPassword } from '../../common/utils/hash.util';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff-management.dto';
import { EVENTS } from '../../common/events/events';

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly tokens: OneTimeTokenService,
    private readonly events: EventEmitter2,
  ) {}

  getPermissionsCatalog() {
    return {
      permissions: Object.keys(PERMISSION_LABELS).map((p) => ({
        code: p,
        label: PERMISSION_LABELS[p as Permission],
        sensitive: SENSITIVE.includes(p as Permission),
      })),
      presets: PRESETS,
    };
  }

  private assertCanManage(actor: AuthUser, target: { id: string; role: Role }) {
    if (actor.id === target.id) {
      throw new ForbiddenException('You cannot change your own staff permissions or role');
    }
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin accounts cannot be modified through the API');
    }
    if (actor.role !== Role.SUPER_ADMIN && RANK[actor.role] <= RANK[target.role]) {
      throw new ForbiddenException('You lack rank to manage a staff member of equal or higher rank');
    }
  }

  private assertGrantable(actor: AuthUser, role: Role, perms: Permission[]) {
    if (role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admins can only be provisioned via database seed/CLI');
    }
    if (actor.role !== Role.SUPER_ADMIN && RANK[actor.role] <= RANK[role]) {
      throw new ForbiddenException('You cannot grant a role at or above your own rank');
    }
    for (const p of perms) {
      if (!hasPermission(actor, p)) {
        throw new ForbiddenException(`You cannot grant permission ${p} because you do not hold it`);
      }
      if (SENSITIVE.includes(p) && actor.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(`Only a super admin can grant sensitive permission ${p}`);
      }
    }
  }

  async getStaff() {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.MODERATOR, Role.ADMIN, Role.SUPER_ADMIN] },
        status: { not: UserStatus.DELETED },
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        lastActiveAt: true,
        createdAt: true,
        profile: {
          select: {
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        permissions: {
          select: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return staff.map((s) => ({
      id: s.id,
      email: s.email,
      username: s.profile?.username || 'staff',
      fullName: s.profile?.fullName,
      avatarUrl: s.profile?.avatarUrl,
      role: s.role,
      status: s.status,
      permissions: s.permissions.map((p) => p.permission),
      lastLoginAt: s.lastLoginAt,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
    }));
  }

  async createStaff(actor: AuthUser, dto: CreateStaffDto) {
    const permsToGrant =
      dto.permissions && dto.permissions.length > 0
        ? dto.permissions
        : PRESETS[dto.role as 'MODERATOR' | 'ADMIN'] || [];

    this.assertGrantable(actor, dto.role, permsToGrant);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    return this.prisma.$transaction(async (tx) => {
      let userId: string;
      let username: string;

      if (existing) {
        if (existing.status !== UserStatus.ACTIVE) {
          throw new BadRequestException('Target user account is not active');
        }
        if (existing.role === Role.SUPER_ADMIN) {
          throw new ForbiddenException('Cannot modify a super admin account');
        }

        const updated = await tx.user.update({
          where: { id: existing.id },
          data: {
            role: dto.role,
            createdById: actor.id,
          },
        });
        userId = updated.id;
        username = existing.profile?.username || 'staff';
      } else {
        const tempPassword = `Invited_${Date.now()}_${Math.random().toString(36)}`;
        const passwordHash = await hashPassword(tempPassword);

        let candidateUsername = (dto.username || email.split('@')[0])
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .substring(0, 20);

        let counter = 1;
        while (await tx.profile.findUnique({ where: { username: candidateUsername } })) {
          candidateUsername = `${candidateUsername.substring(0, 15)}_${counter++}`;
        }
        username = candidateUsername;

        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            role: dto.role,
            status: UserStatus.ACTIVE,
            mustChangePassword: true,
            createdById: actor.id,
            profile: {
              create: {
                username,
              },
            },
          },
        });
        userId = created.id;
      }

      // Overwrite permissions
      await tx.userPermission.deleteMany({ where: { userId } });
      await tx.userPermission.createMany({
        data: permsToGrant.map((p) => ({
          userId,
          permission: p,
          grantedById: actor.id,
        })),
      });

      // Write audit log
      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'ADMIN_CREATED',
        userId: actor.id,
        resource: `user:${userId}`,
        payload: {
          targetEmail: email,
          role: dto.role,
          permissions: permsToGrant,
        },
      });

      return {
        id: userId,
        email,
        username,
        role: dto.role,
        permissions: permsToGrant,
      };
    });
  }

  async updateStaff(actor: AuthUser, id: string, dto: UpdateStaffDto) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { permissions: true },
    });

    if (!target) throw new NotFoundException('Staff member not found');
    this.assertCanManage(actor, target);

    const targetRole = dto.role || target.role;
    const targetPerms = dto.permissions || target.permissions.map((p) => p.permission);

    this.assertGrantable(actor, targetRole, targetPerms);

    await this.prisma.$transaction(async (tx) => {
      if (dto.role) {
        await tx.user.update({
          where: { id },
          data: { role: dto.role },
        });
      }

      if (dto.permissions) {
        await tx.userPermission.deleteMany({ where: { userId: id } });
        await tx.userPermission.createMany({
          data: dto.permissions.map((p) => ({
            userId: id,
            permission: p,
            grantedById: actor.id,
          })),
        });
      }

      await this.audit.logInTx(tx, {
        category: 'ADMIN_ACTION',
        action: 'PERMISSIONS_CHANGED',
        userId: actor.id,
        resource: `user:${id}`,
        payload: {
          previousRole: target.role,
          newRole: targetRole,
          permissions: targetPerms,
        },
      });
    });

    // Revoke sessions so new permissions take effect immediately
    await this.sessions.revokeAllForUser(id, 'PERMISSIONS_CHANGED');
    return { id, role: targetRole, permissions: targetPerms };
  }
}
