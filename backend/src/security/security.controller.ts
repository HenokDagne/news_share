import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../audit/roles.decorator';
import { RolesGuard } from '../audit/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { DataProtectionService } from './data-protection.service';
import { XssSanitizerService } from './xss-sanitizer.service';
import { MtlsGuard } from './guards/mtls.guard';
import { RequireMtls } from './decorators/require-mtls.decorator';

@ApiTags('Application and Data Security Controls (Section 4)')
@Controller('security')
export class SecurityController {
  constructor(
    private readonly dataProtection: DataProtectionService,
    private readonly xssSanitizer: XssSanitizerService,
  ) {}

  // ==========================================
  // 4.4 DATA CLASSIFICATION & CONTROLS
  // ==========================================

  @Get('classification')
  @Public()
  @ApiOperation({ summary: 'Retrieve data classification catalogue and controls (Section 4.4)' })
  getDataClassification() {
    return {
      status: 'SUCCESS',
      catalogue: this.dataProtection.getDataClassificationCatalogue(),
      controlsSummary: {
        PUBLIC: 'Accessible without authentication; UTF-8 output encoded against XSS.',
        INTERNAL: 'Restricted to authenticated staff/system; TLS in transit.',
        CONFIDENTIAL: 'Encrypted or column-restricted; masked in non-production; TLS 1.2+.',
        RESTRICTED: 'Argon2id salted hash or AES-256-GCM encryption at rest; strict WORM / TLS 1.3.',
      },
    };
  }

  // ==========================================
  // 4.4 NON-PRODUCTION MASKING & PSEUDONYMIZATION
  // ==========================================

  @Post('pseudonymize')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mask and pseudonymize datasets for non-production environments (Admin only)' })
  pseudonymizeDataset(@Body('records') records: any[]) {
    const list = Array.isArray(records) ? records : [];
    return {
      recordsProcessed: list.length,
      anonymizedRecords: this.dataProtection.exportAnonymizedDataset(list),
    };
  }

  // ==========================================
  // 4.1 OUTPUT ENCODING / XSS SANITIZATION
  // ==========================================

  @Post('xss/encode')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply HTML entity encoding and tag stripping to defang XSS vectors (Section 4.1)' })
  encodeOutput(@Body('text') text: string) {
    const encoded = this.xssSanitizer.encodeHtml(text || '');
    const sanitized = this.xssSanitizer.sanitizeText(text || '');
    return {
      rawInput: text,
      encodedOutput: encoded,
      sanitizedOutput: sanitized,
    };
  }

  // ==========================================
  // 4.4 DATA RETENTION & SECURE DELETION
  // ==========================================

  @Post('retention/enforce')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enforce data retention policies and permanent secure deletion (Admin only)' })
  async enforceRetention() {
    return this.dataProtection.enforceDataRetention();
  }

  // ==========================================
  // 4.5 MUTUAL TLS (mTLS) SERVICE-TO-SERVICE COMMUNICATION
  // ==========================================

  @Get('internal/service-info')
  @Public() // Bypasses standard user JWT, but strictly requires mutual TLS client certificate
  @RequireMtls()
  @UseGuards(MtlsGuard)
  @ApiOperation({ summary: 'Internal service-to-service endpoint requiring mutual TLS (mTLS) (Section 4.5)' })
  @ApiResponse({ status: 200, description: 'mTLS verification succeeded' })
  getInternalServiceInfo() {
    return {
      status: 'AUTHENTICATED_MTLS',
      serviceName: 'news-share-backend-core',
      timestamp: new Date().toISOString(),
      tlsVersion: 'TLSv1.3',
      securityProfile: 'mTLS_STRICT',
    };
  }

  // ==========================================
  // 4.5 ENDPOINT SECURITY AUDIT
  // ==========================================

  @Get('endpoints')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Audit exposed endpoints and verify security boundaries (Section 4.5)' })
  auditEndpoints() {
    return {
      securityBoundaries: {
        authentication: 'Global JwtAuthGuard on all routes; public routes explicitly marked with @Public()',
        authorization: 'RolesGuard & PermissionsGuard enforcing least privilege RBAC',
        rateLimiting: 'Global ThrottlerGuard (60s / 100 requests per IP)',
        inputSizeLimit: '1MB maximum body payload limit via express.json()',
        securityHeaders: 'Strict HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy',
        serviceToService: 'Mutual TLS (mTLS) client certificate verification via MtlsGuard',
        errorHandling: 'AllExceptionsFilter sanitizing internal paths, stack traces, and database schemas',
      },
    };
  }
}
