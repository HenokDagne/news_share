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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CaseStatus, ReportReason, ReportTargetType } from '@prisma/client';
import { ReportCasesService } from './report-cases.service';
import { RequirePermissions } from '../../permissions/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../permissions/permissions.guard';
import { CaseDecisionDto } from './dto/case-decision.dto';
import { ActionReasonDto } from '../users/dto/user-management.dto';

@ApiTags('Admin Report Cases')
@ApiBearerAuth('JWT')
@Controller('admin')
export class ReportCasesController {
  constructor(private readonly casesService: ReportCasesService) {}

  @Get('report-cases')
  @RequirePermissions('REPORTS_VIEW')
  @ApiOperation({ summary: 'List and filter report cases with priority sorting' })
  @ApiQuery({ name: 'status', required: false, enum: CaseStatus })
  @ApiQuery({ name: 'targetType', required: false, enum: ReportTargetType })
  @ApiQuery({ name: 'reason', required: false, enum: ReportReason })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of report cases' })
  getCases(
    @Query('status') status?: CaseStatus,
    @Query('targetType') targetType?: ReportTargetType,
    @Query('reason') reason?: ReportReason,
    @Query('priority') priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    @Query('assignedTo') assignedTo?: string,
    @Query('q') q?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.casesService.getCases({
      status,
      targetType,
      reason,
      priority,
      assignedTo,
      q,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      sort,
      order,
    });
  }

  @Get('report-cases/:id')
  @RequirePermissions('REPORTS_VIEW')
  @ApiOperation({ summary: 'Get complete review dossier for a report case' })
  @ApiResponse({ status: 200, description: 'Case review details' })
  getCase(@Param('id', ParseUUIDPipe) id: string) {
    return this.casesService.getCase(id);
  }

  @Post('report-cases/:id/claim')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('REPORTS_MODERATE')
  @ApiOperation({ summary: 'Atomically claim a report case for review' })
  claimCase(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.casesService.claimCase(actor, id);
  }

  @Post('report-cases/:id/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('REPORTS_MODERATE')
  @ApiOperation({ summary: 'Submit a multi-action moderation decision for a case' })
  makeDecision(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CaseDecisionDto,
  ) {
    return this.casesService.makeDecision(actor, id, dto);
  }

  @Post('report-cases/:id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('REPORTS_MODERATE')
  @ApiOperation({ summary: 'Reopen a previously closed report case' })
  reopenCase(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionReasonDto,
  ) {
    return this.casesService.reopenCase(actor, id, dto.reason);
  }

  @Post('posts/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('POSTS_REMOVE')
  @ApiOperation({ summary: 'Restore a removed post back to active status' })
  restorePost(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionReasonDto,
  ) {
    return this.casesService.restorePost(actor, id, dto.reason);
  }
}
