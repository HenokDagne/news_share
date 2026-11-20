import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminStaffService } from './admin-staff.service';
import { RequirePermissions } from '../../permissions/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../permissions/permissions.guard';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff-management.dto';

@ApiTags('Admin Staff')
@ApiBearerAuth('JWT')
@Controller('admin')
export class AdminStaffController {
  constructor(private readonly staffService: AdminStaffService) {}

  @Get('permissions')
  @RequirePermissions('ADMINS_MANAGE')
  @ApiOperation({ summary: 'Get permissions catalog, descriptions, and role presets' })
  @ApiResponse({ status: 200, description: 'Permissions catalog' })
  getPermissionsCatalog() {
    return this.staffService.getPermissionsCatalog();
  }

  @Get('admins')
  @RequirePermissions('ADMINS_MANAGE')
  @ApiOperation({ summary: 'List all staff members and their active permissions' })
  @ApiResponse({ status: 200, description: 'Staff directory' })
  getStaff() {
    return this.staffService.getStaff();
  }

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('ADMINS_MANAGE')
  @ApiOperation({ summary: 'Create or invite a new staff member' })
  @ApiResponse({ status: 201, description: 'Staff member created' })
  createStaff(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateStaffDto,
  ) {
    return this.staffService.createStaff(actor, dto);
  }

  @Patch('admins/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ADMINS_MANAGE')
  @ApiOperation({ summary: 'Update staff member role and granted permissions' })
  @ApiResponse({ status: 200, description: 'Staff member updated' })
  updateStaff(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.updateStaff(actor, id, dto);
  }
}
