import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

jest.setTimeout(30000);

describe('Reporting & Not Interested e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let authorToken = '';
  let authorUserId = '';
  let reporterToken = '';
  let reporterUserId = '';
  let testPostId = '';

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
    // Register & Login Author
    const authorReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `auth${rand}@test.com`,
        password: 'Password123!',
        username: `auth_${rand}`,
      });
    if (authorReg.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: authorReg.body.verificationToken });
    }
    const authorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `auth${rand}@test.com`,
        password: 'Password123!',
      });
    authorToken = authorLogin.body.accessToken;
    authorUserId = authorLogin.body.profile.id;

    // Register & Login Reporter
    const reporterReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `rep${rand}@test.com`,
        password: 'Password123!',
        username: `rep_${rand}`,
      });
    if (reporterReg.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: reporterReg.body.verificationToken });
    }
    const reporterLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `rep${rand}@test.com`,
        password: 'Password123!',
      });
    reporterToken = reporterLogin.body.accessToken;
    reporterUserId = reporterLogin.body.profile.id;

    // Author creates a post
    const postRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Reportable Test Post',
        content: 'This post is created to test reporting and not-interested functionality.',
      });
    testPostId = postRes.body.id;
  });

  afterAll(async () => {
    try {
      if (testPostId) {
        await prisma.report.deleteMany({ where: { targetKey: `POST:${testPostId}` } });
        await prisma.reportCase.deleteMany({ where: { targetPostId: testPostId } });
        await prisma.notInterested.deleteMany({ where: { postId: testPostId } });
        await prisma.post.deleteMany({ where: { id: testPostId } });
      }
      if (authorUserId) {
        await prisma.userActivity.deleteMany({ where: { userId: authorUserId } });
        await prisma.profile.deleteMany({ where: { id: authorUserId } });
        await prisma.user.deleteMany({ where: { id: authorUserId } });
      }
      if (reporterUserId) {
        await prisma.userActivity.deleteMany({ where: { userId: reporterUserId } });
        await prisma.profile.deleteMany({ where: { id: reporterUserId } });
        await prisma.user.deleteMany({ where: { id: reporterUserId } });
      }
    } catch (_) {}
    await app.close();
  });

  describe('GET /api/v1/report-reasons', () => {
    it('returns standard report reasons defined in the specification', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/report-reasons')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const codes = res.body.map((r: any) => r.code);
      expect(codes).toContain('HARASSMENT_BULLYING');
      expect(codes).toContain('HATE_SPEECH');
      expect(codes).toContain('VIOLENCE');
      expect(codes).toContain('SPAM_SCAM');
      expect(codes).toContain('SEXUAL_CONTENT');
      expect(codes).toContain('OTHER');
    });
  });

  describe('Not Interested Flow', () => {
    it('allows a user to mark a post as not interested', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/posts/${testPostId}/not-interested`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .expect(204);

      const savedPref = await prisma.notInterested.findUnique({
        where: {
          userId_postId: {
            userId: reporterUserId,
            postId: testPostId,
          },
        },
      });
      expect(savedPref).not.toBeNull();
    });

    it('prevents author from marking own post as not interested', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${testPostId}/not-interested`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(400);

      expect(res.body.message).toContain('own post');
    });

    it('allows a user to undo not interested (DELETE)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/posts/${testPostId}/not-interested`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .expect(204);

      const deletedPref = await prisma.notInterested.findUnique({
        where: {
          userId_postId: {
            userId: reporterUserId,
            postId: testPostId,
          },
        },
      });
      expect(deletedPref).toBeNull();
    });
  });

  describe('Reporting Flow', () => {
    it('prevents author from reporting their own post', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${testPostId}/report`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          reason: 'SPAM_SCAM',
          details: 'Self test',
        })
        .expect(400);

      expect(res.body.message).toContain('own post');
    });

    it('allows a user to submit a report against another user post', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${testPostId}/report`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          reason: 'HARASSMENT_BULLYING',
          details: 'This post contains targeted harassment.',
        })
        .expect(201);

      expect(res.body.status).toBe('RECEIVED');
      expect(res.body.id).toBeDefined();

      // Verify PostgreSQL persistence
      const report = await prisma.report.findUnique({
        where: { id: res.body.id },
      });
      expect(report).not.toBeNull();
      expect(report!.reporterId).toBe(reporterUserId);
      expect(report!.reason).toBe('HARASSMENT_BULLYING');
      expect(report!.details).toBe('This post contains targeted harassment.');

      // Verify report case grouping in PostgreSQL
      const kase = await prisma.reportCase.findFirst({
        where: { targetPostId: testPostId },
      });
      expect(kase).not.toBeNull();
      expect(kase!.reportCount).toBeGreaterThanOrEqual(1);
      expect(kase!.targetUserId).toBe(authorUserId);
    });

    it('rejects duplicate report from same user on the same post with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${testPostId}/report`)
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          reason: 'VIOLENCE',
        })
        .expect(409);

      expect(res.body.message).toContain('already reported');
    });
  });
});
