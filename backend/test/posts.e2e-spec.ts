import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Posts e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let createdPostId = '';

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

    // Register User 1
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user1@example.com',
        password: 'Password123!',
        username: 'user_one',
      });
    user1Token = res1.body.accessToken;
    user1Id = res1.body.profile.id;

    // Register User 2
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user2@example.com',
        password: 'Password123!',
        username: 'user_two',
      });
    user2Token = res2.body.accessToken;
    user2Id = res2.body.profile.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-11: Post with no title, content or image returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({})
      .expect(400);
  });

  it('AC-12: Create post with title and content', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${user1Token}`)
      .field('title', 'First Post')
      .field('content', 'Content of first post')
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('First Post');
    expect(res.body.content).toBe('Content of first post');
    expect(res.body.author.username).toBe('user_one');
    expect(res.body).not.toHaveProperty('imagePublicId');

    createdPostId = res.body.id;
  });

  it('AC-13: User 2 cannot update User 1 post (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .field('title', 'Hacked Title')
      .expect(403);
  });

  it('AC-13: User 2 cannot delete User 1 post (403)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(403);
  });

  it('Global timeline and user posts list the created post', async () => {
    const timelineRes = await request(app.getHttpServer())
      .get('/api/v1/posts')
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    expect(timelineRes.body.data.length).toBeGreaterThanOrEqual(1);

    const userPostsRes = await request(app.getHttpServer())
      .get(`/api/v1/users/${user1Id}/posts`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    expect(userPostsRes.body.data.length).toBe(1);
    expect(userPostsRes.body.data[0].id).toBe(createdPostId);
  });

  it('Author can update post', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .field('title', 'Updated First Post')
      .expect(200);

    expect(res.body.title).toBe('Updated First Post');
  });

  it('AC-15: Author can delete post', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(404);
  });
});
