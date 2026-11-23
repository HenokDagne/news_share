import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateConsentRecordDto, CreatePrivacyRequestDto } from './dto/governance.dto';

@ApiTags('User Privacy & Safety')
@Controller()
export class GovernanceUserController {
  constructor(private readonly governance: GovernanceService) {}

  // ===================== PUBLIC ACTIVE POLICIES =====================

  @Get('policies/active')
  @ApiOperation({ summary: 'Get active public policies (Terms, Privacy Policy, AUP)' })
  getActivePolicies() {
    return this.governance.getActivePolicies();
  }

  // ===================== DATA SUBJECT PRIVACY RIGHTS =====================

  @Get('me/privacy/requests')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List your submitted personal data access/correction/deletion requests' })
  getMyRequests(@CurrentUser('id') userId: string) {
    return this.governance.getUserPrivacyRequests(userId);
  }

  @Post('me/privacy/requests')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit a personal data access, correction, or account deletion request' })
  submitRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePrivacyRequestDto,
  ) {
    return this.governance.createUserPrivacyRequest(userId, dto);
  }

  @Get('me/privacy/export-data')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Download personal data archive (Right of Access / Proclamation 1321/2024)' })
  exportMyData(@CurrentUser('id') userId: string) {
    return this.governance.exportUserData(userId);
  }

  @Post('me/privacy/consent')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Record user consent preference' })
  recordConsent(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConsentRecordDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.governance.recordConsent(userId, dto, ipAddress, userAgent);
  }

  @Get('me/privacy/consents')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user active consent records' })
  getMyConsents(@CurrentUser('id') userId: string) {
    return this.governance.getUserConsents(userId);
  }

  // ===================== SAFETY & BLOCKING =====================

  @Get('me/blocks')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List blocked accounts' })
  listBlocked(@CurrentUser('id') userId: string) {
    return this.governance.listBlockedUsers(userId);
  }

  @Post('users/:id/block')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Block a user' })
  blockUser(
    @CurrentUser('id') userId: string,
    @Param('id') targetUserId: string,
    @Body('reason') reason?: string,
  ) {
    return this.governance.blockUser(userId, targetUserId, reason);
  }

  @Delete('users/:id/block')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Unblock a user' })
  unblockUser(
    @CurrentUser('id') userId: string,
    @Param('id') targetUserId: string,
  ) {
    return this.governance.unblockUser(userId, targetUserId);
  }
}
