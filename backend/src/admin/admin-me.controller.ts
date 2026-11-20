import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../permissions/permissions.guard';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Controller('admin')
export class AdminMeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current administrative user profile, role, and permission array' })
  @ApiResponse({ status: 200, description: 'Staff profile and permissions' })
  async getAdminMe(@CurrentUser() user: AuthUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        mustChangePassword: true,
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
    });

    const isSuperAdmin = profile?.role === Role.SUPER_ADMIN;

    return {
      id: profile?.id,
      email: profile?.email,
      username: profile?.profile?.username || 'Staff',
      fullName: profile?.profile?.fullName || '',
      avatarUrl: profile?.profile?.avatarUrl || null,
      role: profile?.role,
      status: profile?.status,
      mustChangePassword: profile?.mustChangePassword || false,
      permissions: isSuperAdmin
        ? [
            'DASHBOARD_VIEW',
            'USERS_VIEW',
            'USERS_MANAGE',
            'USERS_BAN',
            'USERS_DELETE',
            'REPORTS_VIEW',
            'REPORTS_MODERATE',
            'POSTS_REMOVE',
            'ADMINS_MANAGE',
            'AUDIT_VIEW',
            'AUDIT_EXPORT',
          ]
        : profile?.permissions.map((p) => p.permission) || [],
    };
  }
}
