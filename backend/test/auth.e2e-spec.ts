import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Auth e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const testUser = {
    email: 'ada@example.com',
    password: 'S3cure-password!',
    username: 'ada_l',
    fullName: 'Ada Lovelace',
  };

  let refreshToken = '';
  let accessToken = '';

  it('AC-01: Registering returns 201 with profile, tokens, and no passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body).toHaveProperty('profile');
    expect(res.body.profile.email).toBe(testUser.email);
    expect(res.body.profile.username).toBe(testUser.username);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body.profile).not.toHaveProperty('passwordHash');

    refreshToken = res.body.refreshToken;
    accessToken = res.body.accessToken;
  });

  it('AC-02: Registering with existing email returns 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        ...testUser,
        username: 'other_user',
      })
      .expect(409);
  });

  it('AC-02: Registering with existing username (case-insensitive) returns 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'other@example.com',
        password: 'S3cure-password!',
        username: 'ADA_L',
      })
      .expect(409);
  });

  it('AC-03: Invalid username returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid@example.com',
        password: 'S3cure-password!',
        username: 'ab',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid2@example.com',
        password: 'S3cure-password!',
        username: 'a b!',
      })
      .expect(400);
  });

  it('AC-04: Wrong email and wrong password both return 401 with same message', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'wrong' })
      .expect(401);

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'wrong-password' })
      .expect(401);

    expect(res1.body.message).toBe(res2.body.message);
  });

  it('AC-05: Refreshing returns a new pair and revokes the old one', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    const newRefreshToken = res.body.refreshToken;
    expect(newRefreshToken).not.toBe(refreshToken);

    // Old refresh token must be rejected
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    refreshToken = newRefreshToken;
  });

  it('AC-06: Non-auth endpoint without token returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
  });

  it('GET /me with valid token returns user profile with email', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(testUser.email);
    expect(res.body.username).toBe(testUser.username);
  });
});
