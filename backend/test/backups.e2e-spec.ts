import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { Role } from '@prisma/client';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { BACKUP_AUDIT_ACTIONS, BACKUP_CONSTANTS } from '../src/backups/backup.constants';

jest.setTimeout(40000);

describe('Section 3: Data Backups (3-2-1 Rule, AES-256-GCM, Restoration Testing, WORM, Disposal)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken = '';
  let adminUserId = '';
  let userToken = '';
  let regularUserId = '';

  let fullBackupId = '';
  let incrementalBackupId = '';
  let disposableBackupId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const rand = Math.floor(10000 + Math.random() * 90000);

    // 1. Create Admin User
    const adminEmail = `backup_admin_${rand}@news-share.test`;
    const regAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123!',
        username: `badmin_${rand}`,
      });
    if (regAdmin.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regAdmin.body.verificationToken });
    }
    // Elevate to ADMIN in database
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
    const userEmail = `regular_user_${rand}@news-share.test`;
    const regUser = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: userEmail,
        password: 'Password123!',
        username: `reguser_${rand}`,
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
  // 1. ACCESS CONTROL (Section 3: Access Control)
  // ==========================================
  describe('1. Access Control: Restrict backup access to authorized administrators only', () => {
    it('should deny unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/backups')
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/backups')
        .send({ backupType: 'FULL' })
        .expect(401);
    });

    it('should deny regular users with 403 Forbidden and log role violation', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/backups')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.message).toMatch(/Access denied/i);

      // Verify that access denied is recorded in audit logs
      const auditLog = await prisma.auditLog.findFirst({
        where: { userId: regularUserId, action: 'AUTHZ_ROLE_VIOLATION' },
        orderBy: { timestamp: 'desc' },
      });
      expect(auditLog).toBeDefined();
    });

    it('should grant access to authorized admin user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/backups')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  // ==========================================
  // 2. REGULAR FULL & INCREMENTAL BACKUPS (Section 3: Regular backups, RPO/RTO)
  // ==========================================
  describe('2. Regular Backups: Schedule automated full & incremental backups (RPO/RTO)', () => {
    it('should create a FULL encrypted backup according to RPO/RTO targets', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/backups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          backupType: 'FULL',
          note: 'E2E Full Database Snapshot',
          retentionDays: 30,
          rpoTargetMinutes: 1440,
          rtoTargetMinutes: 15,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.backupType).toBe('FULL');
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.rpoTargetMinutes).toBe(1440);
      expect(res.body.rtoTargetMinutes).toBe(15);
      expect(res.body.encryptionAlgorithm).toBe('AES-256-GCM');
      expect(res.body.checksumSha256).toBeDefined();
      expect(res.body.encryptedChecksumSha256).toBeDefined();
      expect(res.body.iv).toBeDefined();
      expect(res.body.authTag).toBeDefined();
      expect(res.body.isImmutable).toBe(true);

      fullBackupId = res.body.id;

      // Verify manifest contents
      expect(res.body.manifest).toBeDefined();
      expect(res.body.manifest.tablesIncluded).toContain('users');
      expect(res.body.manifest.tablesIncluded).toContain('posts');
      expect(res.body.manifest.tablesIncluded).toContain('profiles');
    });

    it('should create an INCREMENTAL backup referencing the parent FULL backup', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/backups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          backupType: 'INCREMENTAL',
          note: 'E2E Hourly Delta Backup',
          rpoTargetMinutes: 60,
          rtoTargetMinutes: 15,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.backupType).toBe('INCREMENTAL');
      expect(res.body.parentBackupId).toBe(fullBackupId);
      expect(res.body.rpoTargetMinutes).toBe(60);

      incrementalBackupId = res.body.id;
    });

    it('should report RPO and RTO compliance SLA metrics via GET /backups/metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/backups/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.rpo).toBeDefined();
      expect(res.body.rpo.full.isCompliant).toBe(true);
      expect(res.body.rpo.full.targetMinutes).toBe(1440);
      expect(res.body.rpo.incremental.isCompliant).toBe(true);
      expect(res.body.rpo.incremental.targetMinutes).toBe(60);

      expect(res.body.rto).toBeDefined();
      expect(res.body.rto.targetMinutes).toBe(15);

      expect(res.body.rule321).toBeDefined();
      expect(res.body.rule321.status).toBe('COMPLIANT_3_2_1');
      expect(res.body.rule321.copiesPerBackup).toBe(3);
      expect(res.body.rule321.mediaTypesCount).toBe(2);
      expect(res.body.rule321.offsiteCopyRequired).toBe(true);
    });
  });

  // ==========================================
  // 3. BACKUP ENCRYPTION AT REST & IN TRANSIT (Section 3: Backup encryption)
  // ==========================================
  describe('3. Backup Encryption: Encrypt backups at rest and in transit', () => {
    it('should verify backup is encrypted at rest on disk (AES-256-GCM ciphertext, not plaintext JSON)', async () => {
      const backup = await prisma.backupArchive.findUnique({
        where: { id: fullBackupId },
      });
      expect(backup).toBeDefined();

      const diskBuffer = fs.readFileSync(backup!.primaryLocation);

      // Verify that disk file is NOT plain JSON
      const firstBytes = diskBuffer.slice(0, 10).toString('utf-8');
      expect(firstBytes.startsWith('{')).toBe(false);
      expect(firstBytes.includes('"users"')).toBe(false);

      // Verify 96-bit IV (12 bytes) and 128-bit auth tag (16 bytes) in Base64
      const ivBuffer = Buffer.from(backup!.iv, 'base64');
      const tagBuffer = Buffer.from(backup!.authTag, 'base64');
      expect(ivBuffer.length).toBe(12);
      expect(tagBuffer.length).toBe(16);
    });

    it('should stream encrypted archive over TLS in transit with verification headers', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/backups/${fullBackupId}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['x-backup-encryption']).toBe('AES-256-GCM');
      expect(res.headers['x-backup-encrypted-sha256']).toBeDefined();
      expect(res.body).toBeInstanceOf(Buffer);

      // Check audit log for download event
      const downloadLog = await prisma.auditLog.findFirst({
        where: {
          action: BACKUP_AUDIT_ACTIONS.BACKUP_DOWNLOADED,
          userId: adminUserId,
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(downloadLog).toBeDefined();
    });
  });

  // ==========================================
  // 4. OFFSITE & IMMUTABLE COPIES: 3-2-1 RULE (Section 3: Offsite and immutable copies)
  // ==========================================
  describe('4. 3-2-1 Rule & Ransomware Resistance: 3 copies, 2 media types, 1 offsite, immutable WORM', () => {
    it('should verify all 3 copies exist across local disk, secondary, and offsite vault', async () => {
      const backup = await prisma.backupArchive.findUnique({
        where: { id: fullBackupId },
      });

      expect(backup!.copiesCount).toBe(3);
      expect(backup!.mediaTypesCount).toBe(2);
      expect(backup!.hasOffsiteCopy).toBe(true);

      // Verify physical existence of Copy 1 (Primary)
      expect(fs.existsSync(backup!.primaryLocation)).toBe(true);

      // Verify physical existence of Copy 2 (Secondary)
      expect(fs.existsSync(backup!.secondaryLocation!)).toBe(true);

      // Verify physical existence of Copy 3 (Offsite vault)
      expect(fs.existsSync(backup!.offsiteLocation!)).toBe(true);
    });

    it('should block premature disposal when WORM retention lock is active (Ransomware Defense)', async () => {
      // Attempting to delete/wipe an active immutable backup
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/backups/${fullBackupId}/dispose`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Attempted premature deletion' })
        .expect(403);

      expect(res.body.message).toMatch(/WORM retention policy/i);

      // Verify that security alert was triggered for blocked ransomware / unauthorized deletion
      const alert = await prisma.securityAlert.findFirst({
        where: { alertType: 'RANSOMWARE_MUTATION_BLOCKED' },
        orderBy: { timestamp: 'desc' },
      });
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe('CRITICAL');
    });

    it('should block disposal when Legal Hold is enabled', async () => {
      // Toggle legal hold
      await request(app.getHttpServer())
        .patch(`/api/v1/backups/${fullBackupId}/immutability`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ legalHold: true })
        .expect(200);

      // Temporarily expire retention date to test legal hold in isolation
      await prisma.backupArchive.update({
        where: { id: fullBackupId },
        data: { retentionLockUntil: new Date(Date.now() - 1000) },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/backups/${fullBackupId}/dispose`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Attempted deletion while under legal hold' })
        .expect(403);

      expect(res.body.message).toMatch(/Legal Hold/i);

      // Re-enable retention lock
      await prisma.backupArchive.update({
        where: { id: fullBackupId },
        data: {
          retentionLockUntil: new Date(Date.now() + 30 * 86400000),
          legalHold: false,
        },
      });
    });
  });

  // ==========================================
  // 5. RESTORATION TESTING (Section 3: Restoration testing)
  // ==========================================
  describe('5. Restoration Testing: Verify integrity, decryption, schema, and recoverability', () => {
    it('should successfully execute restoration test in isolated sandbox', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/backups/${fullBackupId}/restore-test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testEnvironment: 'ISOLATED_SANDBOX',
          verifyDataRows: true,
        })
        .expect(200);

      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.integrityVerified).toBe(true);
      expect(res.body.decryptionVerified).toBe(true);
      expect(res.body.schemaVerified).toBe(true);
      expect(res.body.dataRowsVerified).toBeGreaterThan(0);
      expect(res.body.actualRtoSeconds).toBeDefined();
      expect(res.body.actualRtoSeconds).toBeLessThan(res.body.targetRtoSeconds);

      // Verify audit log for restore test success
      const restoreLog = await prisma.auditLog.findFirst({
        where: {
          action: BACKUP_AUDIT_ACTIONS.BACKUP_RESTORE_TEST_SUCCESS,
          userId: adminUserId,
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(restoreLog).toBeDefined();
    });

    it('should detect file tampering and trigger CRITICAL alert during restoration test', async () => {
      // Create a temporary backup to tamper with
      const tempBackup = await request(app.getHttpServer())
        .post('/api/v1/backups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ backupType: 'FULL', note: 'Tamper Test Backup' });

      const tempId = tempBackup.body.id;
      const targetArchive = await prisma.backupArchive.findUnique({ where: { id: tempId } });

      // Intentionally tamper with the file on disk by flipping bytes
      const originalBytes = fs.readFileSync(targetArchive!.primaryLocation);
      originalBytes[10] ^= 0xff; // flip bits to corrupt ciphertext
      fs.writeFileSync(targetArchive!.primaryLocation, originalBytes);

      // Attempt restoration test on tampered archive
      await request(app.getHttpServer())
        .post(`/api/v1/backups/${tempId}/restore-test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      // Verify failed restore test record
      const testRecord = await prisma.backupRestoreTest.findFirst({
        where: { backupId: tempId },
        orderBy: { startedAt: 'desc' },
      });
      expect(testRecord!.status).toBe('FAILED');
      expect(testRecord!.errorMessage).toMatch(/checksum mismatch|corruption|tamper/i);

      // Verify CRITICAL alert triggered
      const alert = await prisma.securityAlert.findFirst({
        where: { alertType: 'BACKUP_RESTORE_FAILURE' },
        orderBy: { timestamp: 'desc' },
      });
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe('CRITICAL');
    });
  });

  // ==========================================
  // 6. SECURE DISPOSAL (Section 3: Secure disposal & Audit logging)
  // ==========================================
  describe('6. Secure Disposal: NIST SP 800-88 multi-pass wipe and Certificate of Destruction', () => {
    it('should create an expired backup and execute secure multi-pass wipe at end of life', async () => {
      // Create a backup with retention lock in the past to simulate end-of-life
      const created = await request(app.getHttpServer())
        .post('/api/v1/backups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ backupType: 'FULL', note: 'End of Life Archive' })
        .expect(201);

      disposableBackupId = created.body.id;

      // Fast-forward retention lock into the past
      await prisma.backupArchive.update({
        where: { id: disposableBackupId },
        data: { retentionLockUntil: new Date(Date.now() - 1000) },
      });

      const backupBefore = await prisma.backupArchive.findUnique({
        where: { id: disposableBackupId },
      });
      expect(fs.existsSync(backupBefore!.primaryLocation)).toBe(true);
      expect(fs.existsSync(backupBefore!.secondaryLocation!)).toBe(true);
      expect(fs.existsSync(backupBefore!.offsiteLocation!)).toBe(true);

      // Execute secure disposal (Section 3: Secure disposal)
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/backups/${disposableBackupId}/dispose`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Retention period expired. Compliant end of life destruction.' })
        .expect(200);

      expect(res.body.certificate).toBeDefined();
      expect(res.body.certificate.certificateId).toMatch(/^CERT-DEST-/);
      expect(res.body.certificate.wipeAlgorithm).toBe('NIST_SP_800_88_REV1_3PASS');
      expect(res.body.certificate.passesCompleted).toBe(3);
      expect(res.body.certificate.cryptographicErasureConfirmed).toBe(true);
      expect(res.body.certificate.status).toBe('DESTROYED_COMPLIANT');

      // Verify files were securely wiped and unlinked from all 3 locations
      expect(fs.existsSync(backupBefore!.primaryLocation)).toBe(false);
      expect(fs.existsSync(backupBefore!.secondaryLocation!)).toBe(false);
      expect(fs.existsSync(backupBefore!.offsiteLocation!)).toBe(false);

      // Verify archive status is DISPOSED
      const backupAfter = await prisma.backupArchive.findUnique({
        where: { id: disposableBackupId },
      });
      expect(backupAfter!.status).toBe('DISPOSED');

      // Verify subsequent download is blocked
      await request(app.getHttpServer())
        .get(`/api/v1/backups/${disposableBackupId}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Verify audit log entry
      const disposalLog = await prisma.auditLog.findFirst({
        where: {
          action: BACKUP_AUDIT_ACTIONS.BACKUP_DISPOSED_SECURELY,
          userId: adminUserId,
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(disposalLog).toBeDefined();
    });
  });
});
