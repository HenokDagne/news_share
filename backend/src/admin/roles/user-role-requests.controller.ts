import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../permissions/permissions.guard';
import { RoleManagementService } from './role-management.service';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';

@ApiTags('User Role Requests (Section 1.1)')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('me/role-requests')
export class UserRoleRequestsController {
  constructor(private readonly roleManagement: RoleManagementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a role-change request for privileged access (Requirement 4)' })
  @ApiResponse({ status: 201, description: 'Role change request submitted' })
  submitRequest(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleRequestDto) {
    return this.roleManagement.submitRoleChangeRequest(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'View status of your submitted role change requests' })
  getMyRequests(@CurrentUser('id') userId: string) {
    return this.roleManagement.getMyRoleRequests(userId);
  }
}
