import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';
import { ActivityService } from './activity.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Personal Activity & History')
@ApiBearerAuth('JWT')
@Controller('me')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('activity')
  @ApiOperation({ summary: 'Get current user personal activity & notifications' })
  @ApiQuery({ name: 'type', required: false, enum: ActivityType })
  @ApiQuery({ name: 'unread', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'User personal activities' })
  getActivity(
    @CurrentUser('id') me: string,
    @Query('type') type?: ActivityType,
    @Query('unread') unread?: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.activityService.getActivity(me, {
      type,
      unread: unread !== undefined ? unread === 'true' : undefined,
      limit: limit ? Number(limit) : 20,
      cursor,
    });
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get reports filed by current user and mapped statuses' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Reports filed by user' })
  getMyReports(
    @CurrentUser('id') me: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.activityService.getMyReports(me, limit ? Number(limit) : 20, cursor);
  }

  @Get('warnings')
  @ApiOperation({ summary: 'Get administrative warnings issued to current user' })
  @ApiResponse({ status: 200, description: 'List of warnings' })
  getMyWarnings(@CurrentUser('id') me: string) {
    return this.activityService.getMyWarnings(me);
  }

  @Get('account-status')
  @ApiOperation({ summary: 'Get current account standing and warning count' })
  @ApiResponse({ status: 200, description: 'Account status overview' })
  getAccountStatus(@CurrentUser('id') me: string) {
    return this.activityService.getAccountStatus(me);
  }

  @Post('activity/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an activity item as read' })
  markRead(@CurrentUser('id') me: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.activityService.markRead(me, id);
  }

  @Post('activity/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all activities as read' })
  markAllRead(@CurrentUser('id') me: string) {
    return this.activityService.markAllRead(me);
  }
}
