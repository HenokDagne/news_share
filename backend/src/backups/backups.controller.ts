import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../audit/roles.decorator';
import { RolesGuard } from '../audit/roles.guard';
import { BackupsService } from './backups.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { BackupQueryDto } from './dto/backup-query.dto';
import { RestoreTestDto } from './dto/restore-test.dto';
import { UpdateImmutabilityDto } from './dto/immutability.dto';
import { DisposeBackupDto } from './dto/dispose-backup.dto';

@ApiTags('Data Backups (Section 3)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  // ==========================================
  // 1. REGULAR & SCHEDULED BACKUPS (Section 3.1)
  // ==========================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a full or incremental backup (Admin only)' })
  @ApiResponse({ status: 201, description: 'Backup archive created and encrypted' })
  async createBackup(
    @Body() dto: CreateBackupDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.backupsService.createBackup(dto, {
      id: user?.id || user?.sub || 'admin',
      email: user?.email || 'admin@news-share.local',
      role: user?.role || Role.ADMIN,
      ipAddress: ip || '127.0.0.1',
    });
  }

  // ==========================================
  // 2. QUERY & METRICS (Section 3.1 & 3.4)
  // ==========================================

  @Get()
  @ApiOperation({ summary: 'List backup archives and status (Admin only)' })
  async listBackups(@Query() query: BackupQueryDto) {
    return this.backupsService.listBackups(query);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Retrieve RPO, RTO, and 3-2-1 compliance metrics (Admin only)' })
  async getMetrics() {
    return this.backupsService.getRpoRtoMetrics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get backup archive details and manifest by ID (Admin only)' })
  async getBackupById(@Param('id') id: string) {
    return this.backupsService.getBackupById(id);
  }

  // ==========================================
  // 3. IN-TRANSIT ENCRYPTION & DOWNLOAD (Section 3.2)
  // ==========================================

  @Get(':id/download')
  @ApiOperation({ summary: 'Download encrypted backup archive over TLS (Admin only)' })
  async downloadBackup(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Ip() ip: string,
    @Res() res: Response,
  ) {
    const download = await this.backupsService.getEncryptedBackupDownload(id, {
      id: user.id,
      email: user.email,
      role: user.role,
      ipAddress: ip,
    });

    res.setHeader('Content-Type', download.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
    res.setHeader('X-Backup-Encrypted-SHA256', download.encryptedChecksumSha256);
    res.setHeader('X-Backup-Encryption', 'AES-256-GCM');

    return res.send(download.fileBuffer);
  }

  // ==========================================
  // 4. RESTORATION TESTING (Section 3.5)
  // ==========================================

  @Post(':id/restore-test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute restoration verification test in isolated sandbox (Admin only)' })
  @ApiResponse({ status: 200, description: 'Restoration test succeeded' })
  async testRestoration(
    @Param('id') id: string,
    @Body() dto: RestoreTestDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.backupsService.testRestoration(id, dto, {
      id: user.id,
      email: user.email,
      role: user.role,
      ipAddress: ip,
    });
  }

  // ==========================================
  // 5. IMMUTABILITY & LEGAL HOLD (Section 3.3)
  // ==========================================

  @Patch(':id/immutability')
  @ApiOperation({ summary: 'Update retention lock or legal hold on backup archive (Admin only)' })
  async updateImmutability(
    @Param('id') id: string,
    @Body() dto: UpdateImmutabilityDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.backupsService.updateImmutability(id, dto, {
      id: user.id,
      email: user.email,
      role: user.role,
      ipAddress: ip,
    });
  }

  // ==========================================
  // 6. SECURE DISPOSAL (Section 3.7)
  // ==========================================

  @Delete(':id/dispose')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Securely wipe and destroy backup media at end of life (NIST SP 800-88 compliant)' })
  @ApiResponse({ status: 200, description: 'Backup media securely wiped and Certificate of Destruction issued' })
  async disposeBackup(
    @Param('id') id: string,
    @Body() dto: DisposeBackupDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.backupsService.disposeBackup(id, dto, {
      id: user.id,
      email: user.email,
      role: user.role,
      ipAddress: ip,
    });
  }
}
