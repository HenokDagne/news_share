import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleRequestStatus } from '@prisma/client';
import { RequirePermissions } from '../../permissions/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../permissions/permissions.guard';
import { RoleManagementService } from './role-management.service';
import { AccessReviewService } from './access-review.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ReviewRoleRequestDto } from './dto/review-role-request.dto';
import { CreateCampaignDto, RecordDecisionDto } from './dto/access-review.dto';

@ApiTags('Admin RBAC & Access Reviews (Section 1.1)')
@ApiBearerAuth('JWT')
@Controller('admin/roles')
export class AdminRolesController {
  constructor(
    private readonly roleManagement: RoleManagementService,
    private readonly accessReview: AccessReviewService,
  ) {}

  // ==========================================
  // 1. ROLE ASSIGNMENT & REVOCATION (Requirements 1, 2, 3)
  // ==========================================

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ROLES_MANAGE')
  @ApiOperation({ summary: 'Assign, modify, or revoke user roles with audit trail (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role successfully assigned/revoked' })
  assignRole(@CurrentUser() actor: AuthUser, @Body() dto: AssignRoleDto) {
    return this.roleManagement.assignRole(actor, dto);
  }

  // ==========================================
  // 2. ROLE CHANGE REQUESTS & SEPARATION OF DUTIES (Requirements 4, 5)
  // ==========================================

  @Get('requests')
  @RequirePermissions('ROLES_VIEW')
  @ApiOperation({ summary: 'List privileged role change requests for administrative review' })
  getRoleRequests(@Query('status') status?: RoleRequestStatus) {
    return this.roleManagement.getRoleRequests(status);
  }

  @Post('requests/:id/review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ROLES_MANAGE')
  @ApiOperation({ summary: 'Approve or reject a role change request (enforces Separation of Duties)' })
  reviewRoleRequest(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRoleRequestDto,
  ) {
    return this.roleManagement.reviewRoleRequest(actor, id, dto);
  }

  // ==========================================
  // 3. ROLE AUDIT TRAIL (Requirement 6)
  // ==========================================

  @Get('audit')
  @RequirePermissions('ROLES_VIEW')
  @ApiOperation({ summary: 'Inspect complete audit trail for role assignments, revocations, and requests' })
  getRoleAuditTrail(@Query('userId') userId?: string) {
    return this.roleManagement.getRoleAuditTrail(userId);
  }

  // ==========================================
  // 4. PERIODIC ACCESS REVIEWS (Requirement 8)
  // ==========================================

  @Post('access-reviews/campaigns')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('ACCESS_REVIEWS_MANAGE')
  @ApiOperation({ summary: 'Start a quarterly periodic access review campaign (Requirement 8)' })
  startReviewCampaign(@CurrentUser() actor: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.accessReview.startCampaign(actor, dto);
  }

  @Get('access-reviews/campaigns')
  @RequirePermissions('ROLES_VIEW')
  @ApiOperation({ summary: 'List all quarterly access review campaigns' })
  listReviewCampaigns() {
    return this.accessReview.listCampaigns();
  }

  @Get('access-reviews/campaigns/:id')
  @RequirePermissions('ROLES_VIEW')
  @ApiOperation({ summary: 'Get details of access review campaign and privileged user candidates' })
  getCampaignDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.accessReview.getCampaignDetails(id);
  }

  @Post('access-reviews/campaigns/:id/decisions')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ACCESS_REVIEWS_MANAGE')
  @ApiOperation({ summary: 'Record access review decision (MAINTAIN, REVOKE, MODIFY) for a privileged user' })
  recordReviewDecision(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordDecisionDto,
  ) {
    return this.accessReview.recordDecision(actor, id, dto);
  }

  @Post('access-reviews/campaigns/:id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ACCESS_REVIEWS_MANAGE')
  @ApiOperation({ summary: 'Finalize and complete a quarterly access review campaign' })
  completeReviewCampaign(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accessReview.completeCampaign(actor, id);
  }
}
