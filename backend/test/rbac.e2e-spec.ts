import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

jest.setTimeout(45000);

describe('Section 1.1: Role-Based Access Control (RBAC) e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let superAdminToken = '';
  let superAdminId = '';
  let admin1Token = '';
  let admin1Id = '';
  let admin2Token = '';
  let admin2Id = '';
  let userToken = '';
  let userId = '';

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

    // 1. Create Super Admin
    const saEmail = `rbac_sa_${rand}@news-share.test`;
    const regSA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: saEmail, password: 'Password123!', username: `sa_${rand}` });
    if (regSA.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regSA.body.verificationToken });
    }
    await prisma.user.update({
      where: { email: saEmail },
      data: { role: Role.SUPER_ADMIN },
    });
    const loginSA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: saEmail, password: 'Password123!' });
    superAdminToken = loginSA.body.accessToken;
    superAdminId = loginSA.body.profile.id;

    // 2. Create Admin 1
    const a1Email = `rbac_admin1_${rand}@news-share.test`;
    const regA1 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: a1Email, password: 'Password123!', username: `a1_${rand}` });
    if (regA1.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regA1.body.verificationToken });
    }
    await prisma.user.update({
      where: { email: a1Email },
      data: { role: Role.ADMIN },
    });
    const loginA1 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: a1Email, password: 'Password123!' });
    admin1Token = loginA1.body.accessToken;
    admin1Id = loginA1.body.profile.id;

    // 3. Create Admin 2 (for Separation of Duties testing)
    const a2Email = `rbac_admin2_${rand}@news-share.test`;
    const regA2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: a2Email, password: 'Password123!', username: `a2_${rand}` });
    if (regA2.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regA2.body.verificationToken });
    }
    await prisma.user.update({
      where: { email: a2Email },
      data: { role: Role.ADMIN },
    });
    const loginA2 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: a2Email, password: 'Password123!' });
    admin2Token = loginA2.body.accessToken;
    admin2Id = loginA2.body.profile.id;

    // 4. Create Regular User
    const uEmail = `rbac_user_${rand}@news-share.test`;
    const regU = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: uEmail, password: 'Password123!', username: `u_${rand}` });
    if (regU.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regU.body.verificationToken });
    }
    const loginU = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: uEmail, password: 'Password123!' });
    userToken = loginU.body.accessToken;
    userId = loginU.body.profile.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 1. PRIMARY ROLES ENFORCEMENT & LEAST PRIVILEGE
  // ==========================================
  describe('1. Two Primary Roles & Least-Privilege Access Control', () => {
    it('should strictly deny regular users from administrative endpoints (403 Forbidden)', async () => {
      // User attempts to access staff admin directory
      await request(app.getHttpServer())
        .get('/api/v1/admin/admins')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // User attempts to access user population management
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // User attempts to access role management
      await request(app.getHttpServer())
        .get('/api/v1/admin/roles/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow authorized admin to access administrative endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ==========================================
  // 2. ROLE ASSIGNMENT, MODIFICATION & REVOCATION
  // ==========================================
  describe('2. Role Assignment, Modification, and Revocation', () => {
    let targetUserEmail = '';
    let targetUserId = '';
    let targetUserToken = '';

    beforeAll(async () => {
      const rand = Math.floor(10000 + Math.random() * 90000);
      targetUserEmail = `target_${rand}@news-share.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: targetUserEmail, password: 'Password123!', username: `target_${rand}` });
      if (reg.body.verificationToken) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/verify-email')
          .send({ token: reg.body.verificationToken });
      }
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: targetUserEmail, password: 'Password123!' });
      targetUserToken = login.body.accessToken;
      targetUserId = login.body.profile.id;
    });

    it('should promote a regular USER to ADMIN with audit trail', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/roles/assign')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userId: targetUserId,
          role: 'ADMIN',
          reason: 'Promoted to support platform moderation queue',
        })
        .expect(200);

      expect(res.body.user.role).toBe('ADMIN');

      // Verify database persistence
      const dbUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: { permissions: true },
      });
      expect(dbUser!.role).toBe('ADMIN');
      expect(dbUser!.permissions.length).toBeGreaterThan(0);

      // Verify audit log entry
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'ROLE_ASSIGNED',
          resource: `users/${targetUserId}`,
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(auditLog).toBeDefined();
    });

    it('should revoke ADMIN role and demote user back to USER (stripping all permissions)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/roles/assign')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userId: targetUserId,
          role: 'USER',
          reason: 'Revoking administrative role following project conclusion',
        })
        .expect(200);

      expect(res.body.user.role).toBe('USER');

      // Verify database reflects revoked status and 0 administrative permissions
      const dbUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: { permissions: true },
      });
      expect(dbUser!.role).toBe('USER');
      expect(dbUser!.permissions.length).toBe(0);

      // Verify audit trail for revocation
      const revokeLog = await prisma.auditLog.findFirst({
        where: {
          action: 'ROLE_REVOKED',
          resource: `users/${targetUserId}`,
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(revokeLog).toBeDefined();
    });

    it('should block privilege escalation (Admin cannot promote anyone to SUPER_ADMIN)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/roles/assign')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          userId: targetUserId,
          role: 'SUPER_ADMIN',
          reason: 'Attempted unauthorized privilege escalation',
        })
        .expect(403);
    });
  });

  // ==========================================
  // 3. ROLE CHANGE REQUEST WORKFLOW & SEPARATION OF DUTIES
  // ==========================================
  describe('3. Role Change Request Workflow & Separation of Duties', () => {
    let requestId = '';

    it('should allow a regular user to submit a role-change request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/me/role-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          requestedRole: 'ADMIN',
          justification: 'Assisting with community content verification and moderation.',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.currentRole).toBe('USER');
      expect(res.body.requestedRole).toBe('ADMIN');
      expect(res.body.status).toBe('PENDING');

      requestId = res.body.id;

      // Verify user can inspect their own requests
      const myReqs = await request(app.getHttpServer())
        .get('/api/v1/me/role-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(myReqs.body.length).toBeGreaterThan(0);
      expect(myReqs.body[0].id).toBe(requestId);
    });

    it('should prevent duplicate pending requests from the same user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/me/role-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          requestedRole: 'ADMIN',
          justification: 'Duplicate request attempt.',
        })
        .expect(409);
    });

    it('should strictly ENFORCE SEPARATION OF DUTIES: requester cannot approve their own request', async () => {
      // Temporarily give user ADMIN permissions to simulate a rogue insider trying to approve their own request
      await prisma.user.update({
        where: { id: userId },
        data: { role: Role.ADMIN },
      });

      // The requester attempts to approve their own request -> MUST BE BLOCKED
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/roles/requests/${requestId}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          action: 'APPROVE',
          reviewNotes: 'Self-approval attempt',
        })
        .expect(403);

      expect(res.body.message).toMatch(/Separation of duties violation/i);

      // Verify security alert was recorded in audit log
      const violationLog = await prisma.auditLog.findFirst({
        where: { action: 'SEPARATION_OF_DUTIES_VIOLATION' },
        orderBy: { timestamp: 'desc' },
      });
      expect(violationLog).toBeDefined();

      // Reset user role back to USER for clean testing
      await prisma.user.update({
        where: { id: userId },
        data: { role: Role.USER },
      });
    });

    it('should allow a distinct authorized administrator to approve the request (Dual Control)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/roles/requests/${requestId}/review`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          action: 'APPROVE',
          reviewNotes: 'Approved following management review and background check.',
        })
        .expect(200);

      expect(res.body.request.status).toBe('APPROVED');
      expect(res.body.request.reviewedById).toBe(admin2Id);

      // Verify the user is now an ADMIN in the database
      const promotedUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(promotedUser!.role).toBe('ADMIN');

      // Verify audit log entry
      const approvedLog = await prisma.auditLog.findFirst({
        where: { action: 'ROLE_CHANGE_APPROVED' },
        orderBy: { timestamp: 'desc' },
      });
      expect(approvedLog).toBeDefined();
    });

    it('should support rejecting role-change requests with review notes', async () => {
      // Create another request to test rejection
      const rand = Math.floor(10000 + Math.random() * 90000);
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: `reject_${rand}@news-share.test`, password: 'Password123!', username: `rej_${rand}` });
      if (reg.body.verificationToken) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/verify-email')
          .send({ token: reg.body.verificationToken });
      }
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `reject_${rand}@news-share.test`, password: 'Password123!' });

      const reqRes = await request(app.getHttpServer())
        .post('/api/v1/me/role-requests')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          requestedRole: 'MODERATOR',
          justification: 'Applying for moderator position.',
        })
        .expect(201);

      const toRejectId = reqRes.body.id;

      // Admin rejects request
      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/admin/roles/requests/${toRejectId}/review`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          action: 'REJECT',
          reviewNotes: 'Candidate does not meet required account age threshold.',
        })
        .expect(200);

      expect(rejectRes.body.request.status).toBe('REJECTED');
    });
  });

  // ==========================================
  // 4. PERIODIC ACCESS REVIEWS (QUARTERLY REVIEWS)
  // ==========================================
  describe('4. Periodic Access Reviews: Review existing assignments & record review decisions', () => {
    let campaignId = '';

    it('should start a quarterly access review campaign', async () => {
      const quarter = `Q${Math.floor(1 + Math.random() * 4)}-2026`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/roles/access-reviews/campaigns')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          quarter,
          year: 2026,
          name: `${quarter} Privilege Access Review`,
          notes: 'Quarterly review to detect stale or unnecessary administrative access.',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.quarter).toBe(quarter);
      expect(res.body.status).toBe('IN_PROGRESS');

      campaignId = res.body.id;
    });

    it('should list privileged users and flag inactive accounts in campaign details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/roles/access-reviews/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.privilegedUsers).toBeDefined();
      expect(Array.isArray(res.body.privilegedUsers)).toBe(true);
      expect(res.body.privilegedUsers.length).toBeGreaterThan(0);

      const firstUser = res.body.privilegedUsers[0];
      expect(firstUser).toHaveProperty('inactiveDays');
      expect(firstUser).toHaveProperty('isInactiveRisk');
    });

    it('should record review decision to MAINTAIN access for an active administrator', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/roles/access-reviews/campaigns/${campaignId}/decisions`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userId: admin1Id,
          decision: 'MAINTAIN',
          decisionReason: 'Active staff member in good standing with weekly operations.',
        })
        .expect(200);

      expect(res.body.decision.decision).toBe('MAINTAIN');

      // Verify user maintains ADMIN role
      const user = await prisma.user.findUnique({ where: { id: admin1Id } });
      expect(user!.role).toBe(Role.ADMIN);
    });

    it('should record review decision to REVOKE access for an unneeded or inactive account', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/roles/access-reviews/campaigns/${campaignId}/decisions`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userId: admin2Id,
          decision: 'REVOKE',
          decisionReason: 'Account inactive for > 30 days. Access revoked per least-privilege policy.',
        })
        .expect(200);

      expect(res.body.decision.decision).toBe('REVOKE');

      // Verify user was demoted to USER and permissions stripped immediately
      const revokedUser = await prisma.user.findUnique({
        where: { id: admin2Id },
        include: { permissions: true },
      });
      expect(revokedUser!.role).toBe(Role.USER);
      expect(revokedUser!.permissions.length).toBe(0);
    });

    it('should complete the quarterly access review campaign', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/roles/access-reviews/campaigns/${campaignId}/complete`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.campaign.status).toBe('COMPLETED');
      expect(res.body.campaign.completedAt).toBeDefined();

      // Verify audit log for campaign completion
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'ACCESS_REVIEW_COMPLETED' },
        orderBy: { timestamp: 'desc' },
      });
      expect(auditLog).toBeDefined();
    });
  });

  // ==========================================
  // 5. ROLE AUDIT TRAIL VERIFICATION
  // ==========================================
  describe('5. Complete Role Audit Trail (Requirement 6)', () => {
    it('should return role audit history via GET /admin/roles/audit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/roles/audit')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const actions = res.body.map((log: any) => log.action);
      expect(actions).toContain('ROLE_ASSIGNED');
      expect(actions).toContain('ROLE_REVOKED');
      expect(actions).toContain('ROLE_CHANGE_REQUESTED');
      expect(actions).toContain('ROLE_CHANGE_APPROVED');
      expect(actions).toContain('SEPARATION_OF_DUTIES_VIOLATION');
    });
  });
});
