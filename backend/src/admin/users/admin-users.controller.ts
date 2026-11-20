import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import { AdminUsersService } from './admin-users.service';
import { RequirePermissions } from '../../permissions/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../permissions/permissions.guard';
import {
  ActionReasonDto,
  BanUserDto,
  DeleteUserDto,
  WarnUserDto,
} from './dto/user-management.dto';

@ApiTags('Admin Users')
@ApiBearerAuth('JWT')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @RequirePermissions('USERS_VIEW')
  @ApiOperation({ summary: 'List and filter users with pagination' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'hasReports', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'User directory' })
  getUsers(
    @Query('q') q?: string,
    @Query('status') status?: UserStatus,
    @Query('role') role?: Role,
    @Query('hasReports') hasReports?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.usersService.getUsers({
      q,
      status,
      role,
      hasReports: hasReports === 'true',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      sort,
      order,
    });
  }

  @Get(':id')
  @RequirePermissions('USERS_VIEW')
  @ApiOperation({ summary: 'Get full user dossier with restriction and report history' })
  @ApiResponse({ status: 200, description: 'User details' })
  getUser(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.getUser(id, actor);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('USERS_MANAGE')
  @ApiOperation({ summary: 'Lift administrative hold on a user' })
  activate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionReasonDto,
  ) {
    return this.usersService.activateUser(actor, id, dto.reason);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('USERS_MANAGE')
  @ApiOperation({ summary: 'Place a user on administrative hold' })
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionReasonDto,
  ) {
    return this.usersService.deactivateUser(actor, id, dto.reason);
  }

  @Post(':id/warn')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('USERS_MANAGE')
  @ApiOperation({ summary: 'Issue a formal guideline warning to a user' })
  warn(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WarnUserDto,
  ) {
    return this.usersService.warnUser(actor, id, dto);
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('USERS_BAN')
  @ApiOperation({ summary: 'Impose temporary suspension or permanent ban on a user' })
  ban(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BanUserDto,
  ) {
    return this.usersService.banUser(actor, id, dto);
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('USERS_BAN')
  @ApiOperation({ summary: 'Lift active suspension or ban on a user' })
  unban(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionReasonDto,
  ) {
    return this.usersService.unbanUser(actor, id, dto.reason);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('USERS_DELETE')
  @ApiOperation({ summary: 'Soft-delete a user account (with 30-day grace period)' })
  deleteUser(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteUserDto,
  ) {
    return this.usersService.deleteUser(actor, id, dto);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('USERS_DELETE')
  @ApiOperation({ summary: 'Restore a soft-deleted user account within 30-day window' })
  restoreUser(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionReasonDto,
  ) {
    return this.usersService.restoreUser(actor, id, dto.reason);
  }
}
