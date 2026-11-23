import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrivacyRequestStatus } from '@prisma/client';
import { GovernanceService } from './governance.service';
import { RequirePermissions } from '../permissions/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateChangeRequestDto,
  CreateDataBreachDto,
  CreateIncidentDto,
  CreateLegalObligationDto,
  CreateRiskDto,
  CreateSecurityFindingDto,
  CreateSecurityPolicyDto,
  CreateSecurityReviewDto,
  ImplementChangeRequestDto,
  PublishPolicyVersionDto,
  ResolvePrivacyRequestDto,
  ReviewChangeRequestDto,
  UpdateIncidentDto,
  UpdateLegalObligationDto,
  UpdateRiskDto,
  UpdateSecurityFindingDto,
  UpdateSecurityPolicyDto,
  UpdateSecurityReviewDto,
} from './dto/governance.dto';

@ApiTags('Compliance & Governance (Admin)')
@ApiBearerAuth('JWT')
@Controller('admin/governance')
export class GovernanceAdminController {
  constructor(private readonly governance: GovernanceService) {}

  // ===================== DASHBOARD SUMMARY =====================

  @Get('summary')
  @RequirePermissions('COMPLIANCE_VIEW')
  @ApiOperation({ summary: 'Get aggregated compliance & governance KPI summary' })
  getSummary() {
    return this.governance.getSummary();
  }

  // ===================== LEGAL & COMPLIANCE =====================

  @Get('legal')
  @RequirePermissions('COMPLIANCE_VIEW')
  @ApiOperation({ summary: 'List all legal and regulatory compliance obligations' })
  listLegal() {
    return this.governance.listLegalObligations();
  }

  @Post('legal')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Record a new legal compliance obligation' })
  createLegal(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateLegalObligationDto,
  ) {
    return this.governance.createLegalObligation(adminId, dto);
  }

  @Patch('legal/:id')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Update a legal compliance obligation' })
  updateLegal(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLegalObligationDto,
  ) {
    return this.governance.updateLegalObligation(adminId, id, dto);
  }

  @Delete('legal/:id')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Delete a legal compliance obligation' })
  deleteLegal(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
  ) {
    return this.governance.deleteLegalObligation(adminId, id);
  }

  // ===================== SECURITY POLICIES =====================

  @Get('policies')
  @RequirePermissions('COMPLIANCE_VIEW')
  @ApiOperation({ summary: 'List security and acceptable use policies' })
  listPolicies() {
    return this.governance.listPolicies(true);
  }

  @Post('policies')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Create a new security policy draft' })
  createPolicy(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateSecurityPolicyDto,
  ) {
    return this.governance.createPolicy(adminId, dto);
  }

  @Patch('policies/:id')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Update a security policy' })
  updatePolicy(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSecurityPolicyDto,
  ) {
    return this.governance.updatePolicy(adminId, id, dto);
  }

  @Post('policies/:id/versions')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Publish a new policy version with change summary' })
  publishPolicyVersion(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: PublishPolicyVersionDto,
  ) {
    return this.governance.publishPolicyVersion(adminId, id, dto);
  }

  // ===================== PRIVACY & DATA PROTECTION =====================

  @Get('privacy/requests')
  @RequirePermissions('PRIVACY_MANAGE')
  @ApiOperation({ summary: 'List data subject access/rectification/erasure requests' })
  @ApiQuery({ name: 'status', required: false, enum: PrivacyRequestStatus })
  listPrivacyRequests(@Query('status') status?: PrivacyRequestStatus) {
    return this.governance.listPrivacyRequests(status);
  }

  @Patch('privacy/requests/:id')
  @RequirePermissions('PRIVACY_MANAGE')
  @ApiOperation({ summary: 'Fulfill, reject, or complete a privacy request' })
  resolvePrivacyRequest(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ResolvePrivacyRequestDto,
  ) {
    return this.governance.resolvePrivacyRequest(adminId, id, dto);
  }

  @Get('privacy/breaches')
  @RequirePermissions('PRIVACY_MANAGE')
  @ApiOperation({ summary: 'List recorded data breaches' })
  listBreaches() {
    return this.governance.listDataBreaches();
  }

  @Post('privacy/breaches')
  @RequirePermissions('PRIVACY_MANAGE')
  @ApiOperation({ summary: 'Log a personal data breach' })
  createBreach(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateDataBreachDto,
  ) {
    return this.governance.recordDataBreach(adminId, dto);
  }

  // ===================== SECURITY REVIEWS & AUDITS =====================

  @Get('reviews')
  @RequirePermissions('COMPLIANCE_VIEW')
  @ApiOperation({ summary: 'List security reviews and periodic audits' })
  listReviews() {
    return this.governance.listSecurityReviews();
  }

  @Post('reviews')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Schedule a new security review or audit' })
  createReview(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateSecurityReviewDto,
  ) {
    return this.governance.createSecurityReview(adminId, dto);
  }

  @Patch('reviews/:id')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Update a security review' })
  updateReview(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSecurityReviewDto,
  ) {
    return this.governance.updateSecurityReview(adminId, id, dto);
  }

  @Post('reviews/:id/findings')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Record an audit finding with assigned remediation' })
  addFinding(
    @CurrentUser('id') adminId: string,
    @Param('id') reviewId: string,
    @Body() dto: CreateSecurityFindingDto,
  ) {
    return this.governance.addFindingToReview(adminId, reviewId, dto);
  }

  @Patch('findings/:id')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Update finding remediation status' })
  updateFinding(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSecurityFindingDto,
  ) {
    return this.governance.updateFinding(adminId, id, dto);
  }

  // ===================== RISK REGISTER =====================

  @Get('risks')
  @RequirePermissions('COMPLIANCE_VIEW')
  @ApiOperation({ summary: 'List all registered security risks' })
  listRisks() {
    return this.governance.listRisks();
  }

  @Post('risks')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Record a new security risk' })
  createRisk(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateRiskDto,
  ) {
    return this.governance.createRisk(adminId, dto);
  }

  @Patch('risks/:id')
  @RequirePermissions('COMPLIANCE_MANAGE')
  @ApiOperation({ summary: 'Update a security risk entry' })
  updateRisk(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRiskDto,
  ) {
    return this.governance.updateRisk(adminId, id, dto);
  }

  // ===================== INCIDENT MANAGEMENT =====================

  @Get('incidents')
  @RequirePermissions('INCIDENTS_MANAGE')
  @ApiOperation({ summary: 'List security incidents' })
  listIncidents() {
    return this.governance.listIncidents();
  }

  @Post('incidents')
  @RequirePermissions('INCIDENTS_MANAGE')
  @ApiOperation({ summary: 'Report and log a new security incident' })
  createIncident(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.governance.createIncident(adminId, dto);
  }

  @Patch('incidents/:id')
  @RequirePermissions('INCIDENTS_MANAGE')
  @ApiOperation({ summary: 'Update incident containment, root-cause, or status' })
  updateIncident(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.governance.updateIncident(adminId, id, dto);
  }

  // ===================== CHANGE MANAGEMENT =====================

  @Get('changes')
  @RequirePermissions('CHANGES_MANAGE')
  @ApiOperation({ summary: 'List change requests (RFCs)' })
  listChanges() {
    return this.governance.listChangeRequests();
  }

  @Post('changes')
  @RequirePermissions('CHANGES_MANAGE')
  @ApiOperation({ summary: 'Submit a new RFC' })
  createChange(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateChangeRequestDto,
  ) {
    return this.governance.createChangeRequest(adminId, dto);
  }

  @Patch('changes/:id/review')
  @RequirePermissions('CHANGES_MANAGE')
  @ApiOperation({ summary: 'Approve or reject a change request' })
  reviewChange(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ReviewChangeRequestDto,
  ) {
    return this.governance.reviewChangeRequest(adminId, id, dto);
  }

  @Patch('changes/:id/implement')
  @RequirePermissions('CHANGES_MANAGE')
  @ApiOperation({ summary: 'Record implementation or rollback of an approved change' })
  implementChange(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ImplementChangeRequestDto,
  ) {
    return this.governance.implementChangeRequest(adminId, id, dto);
  }
}
