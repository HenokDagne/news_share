import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Notifications e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken = '';
  let userAId = '';
  let userBToken = '';
  let userBId = '';

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

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userA@example.com',
        password: 'Password123!',
        username: 'user_a',
      });
    userAToken = resA.body.accessToken;
    userAId = resA.body.profile.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userB@example.com',
        password: 'Password123!',
        username: 'user_b',
      });
    userBToken = resB.body.accessToken;
    userBId = resB.body.profile.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-19: Follow creates a follow notification for target', async () => {
    // User A follows User B
    await request(app.getHttpServer())
      .post(`/api/v1/users/${userBId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    // Wait a brief moment for async event listener
    await new Promise((r) => setTimeout(r, 100));

    // User B checks notifications
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].type).toBe('follow');
    expect(res.body.data[0].actor.username).toBe('user_a');
  });

  it('AC-19: Creating a post notifies followers', async () => {
    // User B posts something
    await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userBToken}`)
      .field('title', 'Notification Post')
      .field('content', 'Testing follower notification')
      .expect(201);

    // Wait for async event
    await new Promise((r) => setTimeout(r, 100));

    // User A (follower of User B) should receive a new_post notification
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].type).toBe('new_post');
    expect(res.body.data[0].actor.username).toBe('user_b');
  });

  it('AC-20: User A marking User B notification as read returns 404', async () => {
    // Get User B's notification ID
    const bNotifs = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    const bNotifId = bNotifs.body.data[0].id;

    // User A tries to mark it as read
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${bNotifId}/read`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);
  });

  it('AC-21: unread-count and read-all functionality', async () => {
    // User B unread count should be 1
    const countRes = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(countRes.body.count).toBe(1);

    // Read all
    const readAllRes = await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(readAllRes.body.updated).toBe(1);

    // Count should now be 0
    const countAfter = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(countAfter.body.count).toBe(0);
  });
});
