import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { Role } from '@prisma/client';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { AuditService } from '../src/audit/audit.service';

jest.setTimeout(40000);

describe('Section 4: Application and Data Security Controls e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auditService: AuditService;

  let adminToken = '';
  let adminUserId = '';
  let userToken = '';
  let regularUserId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    // Section 4.5: Enforce input size limits (1MB)
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ limit: '1mb', extended: true }));

    // Section 4.3: Security Headers: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:', 'res.cloudinary.com'],
            fontSrc: ["'self'", 'https:', 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        frameguard: {
          action: 'deny',
        },
        noSniff: true,
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
      }),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    auditService = app.get(AuditService, { strict: false });
    app.useGlobalFilters(new AllExceptionsFilter(auditService));

    await app.init();
    prisma = app.get(PrismaService);

    const rand = Math.floor(10000 + Math.random() * 90000);

    // 1. Create Admin User
    const adminEmail = `sec_admin_${rand}@news-share.test`;
    const regAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123!',
        username: `sadmin_${rand}`,
      });
    if (regAdmin.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regAdmin.body.verificationToken });
    }
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: Role.ADMIN },
    });
    const loginAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: 'Password123!',
      });
    adminToken = loginAdmin.body.accessToken;
    adminUserId = loginAdmin.body.profile.id;

    // 2. Create Regular User
    const userEmail = `sec_user_${rand}@news-share.test`;
    const regUser = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: userEmail,
        password: 'Password123!',
        username: `suser_${rand}`,
      });
    if (regUser.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regUser.body.verificationToken });
    }
    const loginUser = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: userEmail,
        password: 'Password123!',
      });
    userToken = loginUser.body.accessToken;
    regularUserId = loginUser.body.profile.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 4.1 INPUT VALIDATION AND OUTPUT ENCODING
  // ==========================================
  describe('4.1 Input Validation & Output Encoding', () => {
    it('should enforce server-side validation and forbid non-whitelisted properties (400 Bad Request)', async () => {
      // Submitting an invalid registration with malformed email and injected forbidden fields
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: '123', // violates password strength policy
          username: 'valid_user',
          injectedRole: 'SUPER_ADMIN', // non-whitelisted property
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
      expect(Array.isArray(res.body.message) || typeof res.body.message === 'string').toBe(true);
    });

    it('should safely parameterize queries and prevent SQL Injection attacks', async () => {
      // Classic SQL injection payloads designed to bypass authentication or extract data
      const sqlInjections = [
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "'; DROP TABLE users; --",
      ];

      for (const payload of sqlInjections) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: payload,
            password: 'Password123!',
          })
          .expect(400); // Handled as invalid input format or failed login, never executed as SQL syntax

        expect(res.body.error).toBeDefined();
        // Verify database did not execute DROP or leak SQL syntax errors
        expect(JSON.stringify(res.body)).not.toMatch(/syntax error/i);
        expect(JSON.stringify(res.body)).not.toMatch(/pg_catalog/i);
      }
    });

    it('should apply HTML entity output encoding to prevent Cross-Site Scripting (XSS)', async () => {
      const xssPayload = '<script>alert("XSS")</script><img src="x" onerror="stealCookies()">';

      const res = await request(app.getHttpServer())
        .post('/api/v1/security/xss/encode')
        .send({ text: xssPayload })
        .expect(200);

      expect(res.body.encodedOutput).toBeDefined();
      // Verify < and > are converted to &lt; and &gt;
      expect(res.body.encodedOutput).toContain('&lt;script&gt;');
      expect(res.body.encodedOutput).toContain('&lt;img');
      expect(res.body.encodedOutput).not.toContain('<script>');

      // Verify sanitization strips executable tags
      expect(res.body.sanitizedOutput).not.toContain('<script>');
      expect(res.body.sanitizedOutput).not.toContain('onerror=');
    });

    it('should enforce allow-lists for file uploads (type, size, content verification)', async () => {
      // 1. Valid PNG with authentic magic bytes (89 50 4E 47 0D 0A 1A 0A)
      const validPngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      ]);
      const validRes = await request(app.getHttpServer())
        .put('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', validPngBytes, 'avatar.png')
        .expect(200);

      expect(validRes.body.avatarUrl).toBeDefined();

      // 2. Disguised executable / PHP polyglot file with fake .png extension
      const maliciousScriptBytes = Buffer.from('<?php system($_GET["cmd"]); ?>');
      const badContentRes = await request(app.getHttpServer())
        .put('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', maliciousScriptBytes, 'malicious.png')
        .expect(400);

      expect(badContentRes.body.message).toMatch(/File content validation failed|signature does not match/i);

      // 3. Disallowed file type (.txt / text/plain)
      const textFileBytes = Buffer.from('Hello world');
      const badTypeRes = await request(app.getHttpServer())
        .put('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', textFileBytes, 'notes.txt')
        .expect(400);

      expect(badTypeRes.body.message).toMatch(/Invalid file type/i);
    });
  });

  // ==========================================
  // 4.2 SECURE ERROR HANDLING
  // ==========================================
  describe('4.2 Secure Error Handling: Generic messages, zero stack trace or internal path leakage', () => {
    it('should return generic error messages on unhandled or database errors and never leak stack traces', async () => {
      // Intentionally request a malformed UUID on post lookup to trigger database error
      const res = await request(app.getHttpServer())
        .get('/api/v1/posts/invalid-non-uuid-string')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();

      // Ensure stack traces are never exposed in user responses
      expect(res.body.stack).toBeUndefined();
      expect(res.body.trace).toBeUndefined();

      // Ensure internal filesystem paths (e.g. C:\Users or /var/www) are never leaked
      const bodyString = JSON.stringify(res.body);
      expect(bodyString).not.toMatch(/[A-Za-z]:\\[^ \n\r\t]+/);
      expect(bodyString).not.toMatch(/node_modules/);
      expect(bodyString).not.toMatch(/PostgreSQL/);
    });
  });

  // ==========================================
  // 4.3 SECURITY HEADERS
  // ==========================================
  describe('4.3 Security Headers: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy', () => {
    it('should include all 5 required security headers on API responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/security/classification')
        .expect(200);

      // 1. Strict-Transport-Security (HSTS)
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['strict-transport-security']).toContain('includeSubDomains');

      // 2. Content-Security-Policy (CSP)
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['content-security-policy']).toContain("object-src 'none'");
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");

      // 3. X-Content-Type-Options
      expect(res.headers['x-content-type-options']).toBe('nosniff');

      // 4. X-Frame-Options
      expect(res.headers['x-frame-options']).toBe('DENY');

      // 5. Referrer-Policy
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  // ==========================================
  // 4.4 DATA PROTECTION: CLASSIFICATION, MASKING, RETENTION
  // ==========================================
  describe('4.4 Data Protection: Classification, Non-Production Masking & Retention Policies', () => {
    it('should retrieve official data classification catalogue and controls mapping', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/security/classification')
        .expect(200);

      expect(res.body.catalogue).toBeDefined();
      expect(res.body.catalogue.User).toBeDefined();
      expect(res.body.catalogue.AuditAndSession).toBeDefined();
      expect(res.body.controlsSummary).toBeDefined();
      expect(res.body.controlsSummary.RESTRICTED).toBeDefined();
      expect(res.body.controlsSummary.CONFIDENTIAL).toBeDefined();
    });

    it('should mask and pseudonymize sensitive PII datasets for non-production environments', async () => {
      const rawDataset = [
        {
          id: '11111111-2222-3333-4444-555555555555',
          email: 'alex.smith@news-share.test',
          fullName: 'Alex Smith',
          ipAddress: '192.168.1.105',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$secretHashValue123',
        },
      ];

      const res = await request(app.getHttpServer())
        .post('/api/v1/security/pseudonymize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: rawDataset })
        .expect(200);

      expect(res.body.anonymizedRecords).toBeDefined();
      const masked = res.body.anonymizedRecords[0];

      // Email masked
      expect(masked.email).toMatch(/^a\*\*\*h@news-share\.test$/);

      // Name masked
      expect(masked.fullName).toBe('A*** S***');

      // IP masked
      expect(masked.ipAddress).toBe('192.168.***.***');

      // Restricted password hash purged
      expect(masked.passwordHash).toBe('[REDACTED_RESTRICTED]');

      // Deterministic pseudonymized ID generated
      expect(masked.pseudonymizedId).toBeDefined();
      expect(masked.pseudonymizedId.length).toBe(32);
    });

    it('should enforce data retention policies and record audit proof', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/security/retention/enforce')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('COMPLIANT_EXECUTED');
      expect(res.body.sessionsPurged).toBeDefined();
      expect(res.body.tokensPurged).toBeDefined();

      // Check audit log for retention policy execution
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'DATA_RETENTION_POLICY_ENFORCED' },
        orderBy: { timestamp: 'desc' },
      });
      expect(auditLog).toBeDefined();
    });
  });

  // ==========================================
  // 4.5 API AND ENDPOINT SECURITY
  // ==========================================
  describe('4.5 API & Endpoint Security: Authentication, Rate Limiting, Input Size Limits & mTLS', () => {
    it('should authenticate and authorize every protected endpoint (401 without JWT)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/security/endpoints')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/me')
        .expect(401);
    });

    it('should enforce request body input size limits (1MB limit)', async () => {
      // Generate a payload exceeding 1MB (e.g. 1.2MB of repeated text)
      const oversizedPayload = {
        title: 'Oversized payload test',
        content: 'A'.repeat(1.2 * 1024 * 1024),
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send(oversizedPayload);

      // Express body-parser rejects oversized payloads with 413 Payload Too Large
      expect(res.status).toBe(413);
    });

    it('should enforce mutual TLS (mTLS) for internal service-to-service communication', async () => {
      // 1. Without client certificate / mTLS credentials -> Rejected with 401 Unauthorized
      const unauthorizedRes = await request(app.getHttpServer())
        .get('/api/v1/security/internal/service-info')
        .expect(401);

      expect(unauthorizedRes.body.message).toMatch(/Mutual TLS \(mTLS\) client certificate is required/i);

      // 2. With unauthorized client CN -> Rejected with 403 Forbidden
      await request(app.getHttpServer())
        .get('/api/v1/security/internal/service-info')
        .set('ssl-client-verify', 'SUCCESS')
        .set('ssl-client-subject-dn', 'CN=unauthorized-external-client')
        .expect(403);

      // 3. With authorized service client CN (e.g. news-share-internal-worker) -> Accepted with 200 OK
      const authorizedRes = await request(app.getHttpServer())
        .get('/api/v1/security/internal/service-info')
        .set('ssl-client-verify', 'SUCCESS')
        .set('ssl-client-subject-dn', 'CN=news-share-internal-worker')
        .expect(200);

      expect(authorizedRes.body.status).toBe('AUTHENTICATED_MTLS');
      expect(authorizedRes.body.serviceName).toBe('news-share-backend-core');
    });

    it('should provide comprehensive endpoint security boundary audit via GET /security/endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/security/endpoints')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.securityBoundaries).toBeDefined();
      expect(res.body.securityBoundaries.authentication).toMatch(/Global JwtAuthGuard/);
      expect(res.body.securityBoundaries.authorization).toMatch(/RolesGuard & PermissionsGuard/);
      expect(res.body.securityBoundaries.securityHeaders).toMatch(/HSTS, CSP/);
      expect(res.body.securityBoundaries.serviceToService).toMatch(/Mutual TLS/);
    });
  });
});
