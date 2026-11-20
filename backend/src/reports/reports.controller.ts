import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reports')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Public()
  @Get('report-reasons')
  @ApiOperation({ summary: 'Get list of report reason codes, labels, and descriptions' })
  @ApiResponse({ status: 200, description: 'List of supported report reasons' })
  getReasons() {
    return this.reportsService.getReasons();
  }

  @Post('posts/:id/report')
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 3600_000 } }) // 10 reports per hour
  @ApiOperation({ summary: 'Submit a report against a post' })
  @ApiResponse({ status: 201, description: 'Report successfully received' })
  @ApiResponse({ status: 400, description: 'Self-reporting or invalid reason' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 409, description: 'Already reported' })
  reportPost(
    @CurrentUser('id') me: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.report(me, { type: 'POST', id: postId }, dto);
  }

  @Post('users/:id/report')
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 3600_000 } }) // 10 reports per hour
  @ApiOperation({ summary: 'Submit a report against a user profile' })
  @ApiResponse({ status: 201, description: 'Report successfully received' })
  @ApiResponse({ status: 400, description: 'Self-reporting or invalid reason' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Already reported' })
  reportUser(
    @CurrentUser('id') me: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.report(me, { type: 'USER', id: userId }, dto);
  }
}
