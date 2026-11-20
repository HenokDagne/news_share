import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ModerationActionType } from '@prisma/client';
import { AdminModerationService } from './admin-moderation.service';
import { RequirePermissions } from '../../permissions/require-permissions.decorator';

@ApiTags('Admin Moderation Hub')
@ApiBearerAuth('JWT')
@Controller('admin/moderation')
export class AdminModerationController {
  constructor(private readonly moderationService: AdminModerationService) {}

  @Get('queue')
  @RequirePermissions('REPORTS_VIEW')
  @ApiOperation({ summary: 'Get prioritized open cases queue with SLA tracking' })
  @ApiResponse({ status: 200, description: 'Moderation queue' })
  getQueue() {
    return this.moderationService.getQueue();
  }

  @Get('restrictions')
  @RequirePermissions('USERS_VIEW')
  @ApiOperation({ summary: 'List all currently active user restrictions, suspensions & bans' })
  @ApiResponse({ status: 200, description: 'Active restrictions' })
  getActiveRestrictions() {
    return this.moderationService.getActiveRestrictions();
  }

  @Get('removed-posts')
  @RequirePermissions('REPORTS_VIEW')
  @ApiOperation({ summary: 'List all soft-removed posts with reasons' })
  @ApiResponse({ status: 200, description: 'Removed posts list' })
  getRemovedPosts() {
    return this.moderationService.getRemovedPosts();
  }

  @Get('actions')
  @RequirePermissions('REPORTS_VIEW')
  @ApiOperation({ summary: 'Historical log of all moderation decisions and actions' })
  @ApiQuery({ name: 'targetUserId', required: false, type: String })
  @ApiQuery({ name: 'performedById', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ModerationActionType })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Moderation action logs' })
  getActions(
    @Query('targetUserId') targetUserId?: string,
    @Query('performedById') performedById?: string,
    @Query('type') type?: ModerationActionType,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.moderationService.getModerationActions({
      targetUserId,
      performedById,
      type,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }
}
