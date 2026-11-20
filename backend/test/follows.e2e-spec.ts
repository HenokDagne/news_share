import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Follows e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let aliceToken = '';
  let aliceId = '';
  let bobToken = '';
  let bobId = '';

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://postgres:pass3685@localhost:5432/news_store_test?schema=public';

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

    // Clean test database
    await prisma.notification.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.post.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();

    // Register Alice
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'Password123!',
        username: 'alice_w',
      });
    aliceToken = resA.body.accessToken;
    aliceId = resA.body.profile.id;

    // Register Bob
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'bob@example.com',
        password: 'Password123!',
        username: 'bob_b',
      });
    bobToken = resB.body.accessToken;
    bobId = resB.body.profile.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-17: Following yourself returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${aliceId}/follow`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(400);
  });

  it('AC-17: Follow is idempotent and updates counters +1', async () => {
    // Alice follows Bob
    const res1 = await request(app.getHttpServer())
      .post(`/api/v1/users/${bobId}/follow`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res1.body).toEqual({ following: true });

    // Repeat follow
    const res2 = await request(app.getHttpServer())
      .post(`/api/v1/users/${bobId}/follow`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res2.body).toEqual({ following: true });

    // Check counters: Alice following=1, Bob followers=1
    const aliceProfile = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(aliceProfile.body.followingCount).toBe(1);

    const bobProfile = await request(app.getHttpServer())
      .get(`/api/v1/users/${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(bobProfile.body.followersCount).toBe(1);
  });

  it('Follow status check', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${bobId}/follow-status`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(res.body).toEqual({ isFollowing: true, isFollowedBy: false });
  });

  it('AC-18: Unfollow decrements both counters once; repeating changes nothing', async () => {
    // Alice unfollows Bob
    const res1 = await request(app.getHttpServer())
      .delete(`/api/v1/users/${bobId}/follow`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res1.body).toEqual({ following: false });

    // Repeat unfollow
    const res2 = await request(app.getHttpServer())
      .delete(`/api/v1/users/${bobId}/follow`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res2.body).toEqual({ following: false });

    // Check counters: Alice following=0, Bob followers=0
    const aliceProfile = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(aliceProfile.body.followingCount).toBe(0);

    const bobProfile = await request(app.getHttpServer())
      .get(`/api/v1/users/${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(bobProfile.body.followersCount).toBe(0);
  });
});
