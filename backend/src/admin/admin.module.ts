import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { AdminMeController } from './admin-me.controller';
import { DashboardRepository } from './dashboard/dashboard.repository';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminStaffService } from './admins/admin-staff.service';
import { AdminStaffController } from './admins/admin-staff.controller';
import { ReportCasesService } from './cases/report-cases.service';
import { ReportCasesController } from './cases/report-cases.controller';
import { AdminModerationService } from './moderation/admin-moderation.service';
import { AdminModerationController } from './moderation/admin-moderation.controller';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminAuditController } from './audit/admin-audit.controller';
import { RoleManagementService } from './roles/role-management.service';
import { AccessReviewService } from './roles/access-review.service';
import { AdminRolesController } from './roles/admin-roles.controller';
import { UserRoleRequestsController } from './roles/user-role-requests.controller';
import { AdminGateway } from './realtime/admin.gateway';
import { UserGateway } from './realtime/user.gateway';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    MailModule,
    EnforcementModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminMeController,
    DashboardController,
    AdminUsersController,
    AdminStaffController,
    ReportCasesController,
    AdminModerationController,
    AdminAuditController,
    AdminRolesController,
    UserRoleRequestsController,
  ],
  providers: [
    DashboardRepository,
    DashboardService,
    AdminUsersService,
    AdminStaffService,
    ReportCasesService,
    AdminModerationService,
    AdminAuditService,
    RoleManagementService,
    AccessReviewService,
    AdminGateway,
    UserGateway,
  ],
  exports: [
    DashboardService,
    AdminUsersService,
    AdminStaffService,
    ReportCasesService,
    AdminModerationService,
    AdminAuditService,
    RoleManagementService,
    AccessReviewService,
    UserGateway,
  ],
})
export class AdminModule {}
