import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  AcceptPolicyDto,
  CancelPrivacyRequestDto,
  CreateConsentRecordDto,
  CreatePrivacyRequestDto,
  UpdatePrivacyPreferencesDto,
} from './dto/governance.dto';

@ApiTags('User Privacy & Safety')
@Controller()
export class GovernanceUserController {
  constructor(private readonly governance: GovernanceService) {}

  // ===================== PUBLIC ACTIVE POLICIES =====================

  @Public()
  @Get('policies/active')
  @ApiOperation({ summary: 'Get active public policies (Terms, Privacy Policy, AUP, etc.)' })
  getActivePolicies() {
    return this.governance.getActivePolicies();
  }

  @Public()
  @Get('policies/:code')
  @ApiOperation({ summary: 'Get a specific active policy by policy code (e.g., POL-PRIVACY, POL-TERMS)' })
  getPolicyByCode(@Param('code') code: string) {
    return this.governance.getPolicyByCode(code);
  }

  @Post('policies/:id/accept')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Record user acceptance of a specific policy version' })
  acceptPolicy(
    @CurrentUser('id') userId: string,
    @Param('id') policyId: string,
    @Body() dto: AcceptPolicyDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.governance.acceptPolicy(userId, policyId, dto.versionNumber, ipAddress, userAgent);
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

  @Post('me/privacy/deletion/cancel')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Cancel pending account deletion request during the 30-day grace period' })
  cancelAccountDeletion(
    @CurrentUser('id') userId: string,
    @Body() dto: CancelPrivacyRequestDto,
  ) {
    return this.governance.cancelAccountDeletion(userId, dto?.reason);
  }

  @Delete('me/privacy/requests/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Cancel a pending privacy request' })
  cancelRequest(
    @CurrentUser('id') userId: string,
    @Param('id') requestId: string,
    @Body() dto: CancelPrivacyRequestDto,
  ) {
    return this.governance.cancelPrivacyRequest(userId, requestId, dto?.reason);
  }

  @Get('me/privacy/export-data')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Download personal data archive (Right of Access / Proclamation 1321/2024)' })
  exportMyData(@CurrentUser('id') userId: string) {
    return this.governance.exportUserData(userId);
  }

  // ===================== PRIVACY PREFERENCES & CONSENT =====================

  @Get('me/privacy/preferences')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Retrieve persistent database-backed user privacy preferences across devices' })
  getPreferences(@CurrentUser('id') userId: string) {
    return this.governance.getPrivacyPreferences(userId);
  }

  @Put('me/privacy/preferences')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update persistent user privacy preferences and append to consent history' })
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePrivacyPreferencesDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.governance.updatePrivacyPreferences(userId, dto, ipAddress, userAgent);
  }

  @Post('me/privacy/consent')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Record single user consent preference (backwards compatible)' })
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
  @ApiOperation({ summary: 'Get user active consent audit history' })
  getMyConsents(@CurrentUser('id') userId: string) {
    return this.governance.getUserConsents(userId);
  }

  @Get('me/security/checkup')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Run comprehensive user security checkup (sessions, password age, telemetry)' })
  getSecurityCheckup(@CurrentUser('id') userId: string) {
    return this.governance.getSecurityCheckup(userId);
  }

  @Post('me/privacy/contacts/match')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Match contacts against registered platform users' })
  matchContacts(
    @CurrentUser('id') userId: string,
    @Body('hashes') hashes: string[],
  ) {
    return this.governance.matchContacts(userId, hashes || []);
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
  @ApiOperation({ summary: 'Block a user (severs all follows and restricts interaction)' })
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
