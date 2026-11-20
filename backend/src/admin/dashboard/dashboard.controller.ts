import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../../permissions/require-permissions.decorator';

@ApiTags('Admin Dashboard')
@ApiBearerAuth('JWT')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions('DASHBOARD_VIEW')
  @ApiOperation({ summary: 'Get overall dashboard statistics & KPI numbers' })
  @ApiResponse({ status: 200, description: 'Summary metrics' })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('timeseries')
  @RequirePermissions('DASHBOARD_VIEW')
  @ApiOperation({ summary: 'Get timeseries trends for registrations, posts, reports, moderation' })
  @ApiQuery({ name: 'metric', required: false, enum: ['registrations', 'posts', 'reports', 'moderation'] })
  @ApiQuery({ name: 'range', required: false, enum: ['7d', '30d', '90d'] })
  @ApiResponse({ status: 200, description: 'Zero-filled timeseries array' })
  getTimeseries(
    @Query('metric') metric?: string,
    @Query('range') range?: string,
  ) {
    return this.dashboardService.getTimeseries(metric, range);
  }

  @Get('recent')
  @RequirePermissions('DASHBOARD_VIEW')
  @ApiOperation({ summary: 'Get latest registrations, cases, and administrative decisions' })
  @ApiResponse({ status: 200, description: 'Recent activity feeds' })
  getRecent() {
    return this.dashboardService.getRecent();
  }

  @Get('distribution')
  @RequirePermissions('DASHBOARD_VIEW')
  @ApiOperation({ summary: 'Get account status and role distributions' })
  @ApiResponse({ status: 200, description: 'Distribution statistics' })
  getDistribution() {
    return this.dashboardService.getDistribution();
  }
}
