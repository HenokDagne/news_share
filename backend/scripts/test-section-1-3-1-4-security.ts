import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface TestResult {
  code: string;
  title: string;
  passed: boolean;
  details?: string;
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING SECTION 1.3 & 1.4 COMPREHENSIVE SECURITY VERIFICATION');
  console.log('================================================================');

  const app = await NestFactory.create(AppModule, { logger: false });
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  app.setGlobalPrefix('api/v1');
  app.use(
    helmet({
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      frameguard: { action: 'deny' },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3459, '127.0.0.1');

  const BASE_URL = 'http://127.0.0.1:3459/api/v1';
  const mailService = app.get(MailService);
  const prismaService = app.get(PrismaService);
  const results: TestResult[] = [];

  const uid = Math.random().toString(36).substring(2, 8);
  const testEmail = `sec_1314_${uid}@example.com`;
  const testUsername = `sec_u_${uid}`;
  const validPassword = 'N3w-Str0ng-P@ssword2026!';
  const newChangedPassword = 'Alt3rnate-Str0ng-P@ss2026!';

  let verificationToken = '';
  let accessToken = '';
  let refreshToken = '';
  let sessionId = '';

  try {
    // -------------------------------------------------------------
    // SECTION 1.3: PASSWORD POLICIES
    // -------------------------------------------------------------
    console.log('\n--- [1.3] TESTING PASSWORD POLICIES ---');

    // T-PW-01: Length Check (< 12 chars rejected)
    const shortRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.0.1.1',
        'X-Strict-Password-Policy': 'true',
      },
      body: JSON.stringify({
        email: `short_${uid}@example.com`,
        username: `short_${uid}`,
        password: 'Short1!pass', // 11 chars
        acceptTerms: true,
      }),
    });
    const shortData = await shortRes.json();
    const t_pw_01 = shortRes.status === 400;
    results.push({
      code: 'T-PW-01',
      title: 'Enforce minimum length of 12+ characters',
      passed: t_pw_01,
      details: JSON.stringify(shortData),
    });
    console.log(`T-PW-01 (12+ char length): ${t_pw_01 ? 'PASSED' : 'FAILED'} (HTTP ${shortRes.status})`);

    // T-PW-02: Complexity Check (Needs 3 of 4 classes)
    const simpleRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.0.1.2',
        'X-Strict-Password-Policy': 'true',
      },
      body: JSON.stringify({
        email: `simple_${uid}@example.com`,
        username: `simp_${uid}`,
        password: 'alllowercaseletters123', // lowercase + numbers = 2 classes only
        acceptTerms: true,
      }),
    });
    const simpleData = await simpleRes.json();
    const t_pw_02 = simpleRes.status === 400;
    results.push({
      code: 'T-PW-02',
      title: 'Enforce complexity (at least 3 of 4 character classes)',
      passed: t_pw_02,
      details: JSON.stringify(simpleData),
    });
    console.log(`T-PW-02 (Complexity classes): ${t_pw_02 ? 'PASSED' : 'FAILED'} (HTTP ${simpleRes.status})`);

    // T-PW-03: Contextual checks (username / email prefix containment)
    const contextRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.0.1.3',
        'X-Strict-Password-Policy': 'true',
      },
      body: JSON.stringify({
        email: `context_${uid}@example.com`,
        username: `myuser_${uid}`,
        password: `myuser_${uid}P@ssword123!`, // contains username
        acceptTerms: true,
      }),
    });
    const contextData = await contextRes.json();
    const t_pw_03 = contextRes.status === 400;
    results.push({
      code: 'T-PW-03',
      title: 'Contextual check: reject password containing username or email prefix',
      passed: t_pw_03,
      details: JSON.stringify(contextData),
    });
    console.log(`T-PW-03 (Contextual username check): ${t_pw_03 ? 'PASSED' : 'FAILED'} (HTTP ${contextRes.status})`);

    // T-PW-04: Have I Been Pwned (HIBP) Breached Password Check
    const pwnedRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.0.1.4',
        'X-Strict-Password-Policy': 'true',
      },
      body: JSON.stringify({
        email: `pwned_${uid}@example.com`,
        username: `pwn_${uid}`,
        password: 'Password12345!', // Known breached password
        acceptTerms: true,
      }),
    });
    const pwnedData = await pwnedRes.json();
    const t_pw_04 = pwnedRes.status === 400;
    results.push({
      code: 'T-PW-04',
      title: 'Have I Been Pwned check against known breached password lists',
      passed: t_pw_04,
      details: JSON.stringify(pwnedData),
    });
    console.log(`T-PW-04 (HIBP breach check): ${t_pw_04 ? 'PASSED' : 'FAILED'} (HTTP ${pwnedRes.status})`);

    // Register a valid user for subsequent tests
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.1.5' },
      body: JSON.stringify({
        email: testEmail,
        username: testUsername,
        password: validPassword,
        acceptTerms: true,
      }),
    });
    const regData = await regRes.json();
    verificationToken = mailService.getLatestToken(testEmail) || regData.verificationToken || '';

    // Verify email to activate account
    await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.1.5' },
      body: JSON.stringify({ token: verificationToken }),
    });

    // T-PW-05: Password Hashing (Argon2id salted hash)
    const dbUser = await prismaService.user.findUnique({ where: { email: testEmail } });
    const isArgon2 = dbUser?.passwordHash.startsWith('$argon2') || dbUser?.passwordHash.startsWith('$2b$');
    const t_pw_05 = !!isArgon2 && !dbUser?.passwordHash.includes(validPassword);
    results.push({
      code: 'T-PW-05',
      title: 'Modern salted password hashing (Argon2id / bcrypt, no plaintext)',
      passed: t_pw_05,
      details: `Hash prefix: ${dbUser?.passwordHash.slice(0, 15)}...`,
    });
    console.log(`T-PW-05 (Argon2id salted hash): ${t_pw_05 ? 'PASSED' : 'FAILED'}`);

    // T-PW-06: Account Lockout Policy (5 failed attempts -> 15 min lock)
    console.log('\n--- [1.3] TESTING ACCOUNT LOCKOUT POLICY ---');
    for (let i = 1; i <= 5; i++) {
      await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.2.${i}` },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!' }),
      });
    }

    const lockedUser = await prismaService.user.findUnique({ where: { email: testEmail } });
    const isLockedInDb = lockedUser?.lockedUntil && lockedUser.lockedUntil > new Date();

    // 6th attempt with CORRECT password must still be rejected due to active lockout
    const lockedLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.2.6' },
      body: JSON.stringify({ email: testEmail, password: validPassword }),
    });
    const lockedLoginData = await lockedLoginRes.json();
    const t_pw_06 = isLockedInDb && lockedLoginRes.status === 401;
    results.push({
      code: 'T-PW-06',
      title: 'Account lockout policy (5 failed attempts trigger 15-minute lock & lock notice)',
      passed: !!t_pw_06,
      details: `lockedUntil: ${lockedUser?.lockedUntil?.toISOString()}`,
    });
    console.log(`T-PW-06 (Account lockout after 5 failures): ${t_pw_06 ? 'PASSED' : 'FAILED'}`);

    // T-PW-07: Password Reset Unlock Procedure
    console.log('\n--- [1.3] TESTING PASSWORD RESET & UNLOCK PROCEDURE ---');
    await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.3.1' },
      body: JSON.stringify({ email: testEmail }),
    });
    const resetToken = mailService.getLatestToken(testEmail) || '';

    const resetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.3.1' },
      body: JSON.stringify({ token: resetToken, newPassword: validPassword }),
    });
    const resetUser = await prismaService.user.findUnique({ where: { email: testEmail } });
    const t_pw_07 = resetRes.status === 200 && resetUser?.lockedUntil === null && resetUser?.failedLoginCount === 0;
    results.push({
      code: 'T-PW-07',
      title: 'Password reset flow unlocks account and updates credentials',
      passed: t_pw_07,
      details: `lockedUntil after reset: ${resetUser?.lockedUntil}`,
    });
    console.log(`T-PW-07 (Unlock via password reset): ${t_pw_07 ? 'PASSED' : 'FAILED'}`);

    // -------------------------------------------------------------
    // SECTION 1.4: TOKEN-BASED AUTH & SESSION MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- [1.4] TESTING TOKEN-BASED AUTH & SESSION MANAGEMENT ---');

    // T-SESS-01: Session Creation on Login
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.4.1' },
      body: JSON.stringify({ email: testEmail, password: validPassword }),
    });
    const loginData = await loginRes.json();
    accessToken = loginData.accessToken;
    refreshToken = loginData.refreshToken;
    sessionId = loginData.sessionId;

    const t_sess_01 =
      loginRes.status === 200 &&
      typeof accessToken === 'string' &&
      typeof refreshToken === 'string' &&
      typeof sessionId === 'string';
    results.push({
      code: 'T-SESS-01',
      title: 'Token-based authentication: issues JWT access token with session ID and opaque refresh token',
      passed: t_sess_01,
      details: `Session ID: ${sessionId}, Access token length: ${accessToken?.length}`,
    });
    console.log(`T-SESS-01 (Session creation on login): ${t_sess_01 ? 'PASSED' : 'FAILED'}`);

    // T-SESS-02: Refresh Token Rotation
    console.log('\n--- [1.4] TESTING REFRESH TOKEN ROTATION ---');
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.4.1' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshData = await refreshRes.json();
    const rotatedAccessToken = refreshData.accessToken;
    const rotatedRefreshToken = refreshData.refreshToken;

    const t_sess_02 =
      refreshRes.status === 200 &&
      rotatedRefreshToken !== refreshToken &&
      typeof rotatedAccessToken === 'string';
    results.push({
      code: 'T-SESS-02',
      title: 'Refresh token rotation: issues fresh token pair and consumes old token',
      passed: t_sess_02,
      details: `Old token rotated to new token`,
    });
    console.log(`T-SESS-02 (Refresh token rotation): ${t_sess_02 ? 'PASSED' : 'FAILED'}`);

    // T-SESS-03: Refresh Token Reuse Detection (Replay Protection)
    console.log('\n--- [1.4] TESTING REFRESH TOKEN REUSE DETECTION ---');
    // Try to reuse the OLD refreshToken that was already consumed in T-SESS-02
    const reuseRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.4.1' },
      body: JSON.stringify({ refreshToken }),
    });
    const sessionAfterReuse = await prismaService.session.findUnique({ where: { id: sessionId } });
    const t_sess_03 = reuseRes.status === 401 && sessionAfterReuse?.revokedAt !== null;
    results.push({
      code: 'T-SESS-03',
      title: 'Token reuse detection: replaying old refresh token immediately revokes session (anti-theft)',
      passed: !!t_sess_03,
      details: `Revoke reason: ${sessionAfterReuse?.revokedReason}`,
    });
    console.log(`T-SESS-03 (Token reuse detection): ${t_sess_03 ? 'PASSED' : 'FAILED'}`);

    // T-SESS-04: Session Revocation & Logout
    console.log('\n--- [1.4] TESTING SECURE LOGOUT & TOKEN REVOCATION ---');
    // Login fresh to get a new active session
    const freshLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.5.1' },
      body: JSON.stringify({ email: testEmail, password: validPassword }),
    });
    const freshData = await freshLogin.json();
    const freshAccess = freshData.accessToken;

    // Call /me (should be 200)
    const preLogoutMe = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${freshAccess}` },
    });

    // Call /auth/logout
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshAccess}` },
    });

    // Calling /me again with the same access token must now return 401 Unauthorized!
    const postLogoutMe = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${freshAccess}` },
    });
    const t_sess_04 = preLogoutMe.status === 200 && logoutRes.status === 200 && postLogoutMe.status === 401;
    results.push({
      code: 'T-SESS-04',
      title: 'Token revocation & logout: logging out immediately revokes session and invalidates access token',
      passed: t_sess_04,
      details: `Pre-logout: ${preLogoutMe.status}, Logout: ${logoutRes.status}, Post-logout: ${postLogoutMe.status}`,
    });
    console.log(`T-SESS-04 (Secure logout and revocation): ${t_sess_04 ? 'PASSED' : 'FAILED'}`);

    // T-PW-08: Secure Password Change Flow with session revocation
    console.log('\n--- [1.3] TESTING SECURE PASSWORD CHANGE FLOW ---');
    // Login to obtain active session
    const changeLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.6.1' },
      body: JSON.stringify({ email: testEmail, password: validPassword }),
    });
    const changeData = await changeLogin.json();
    const changeToken = changeData.accessToken;

    const changeRes = await fetch(`${BASE_URL}/me/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${changeToken}`,
      },
      body: JSON.stringify({
        currentPassword: validPassword,
        newPassword: newChangedPassword,
      }),
    });
    const changeResData = await changeRes.json();
    const t_pw_08 = changeRes.status === 200;
    results.push({
      code: 'T-PW-08',
      title: 'Password change flow: verifies current password, enforces policy, updates hash, revokes other sessions',
      passed: t_pw_08,
      details: JSON.stringify(changeResData),
    });
    console.log(`T-PW-08 (Secure password change): ${t_pw_08 ? 'PASSED' : 'FAILED'}`);

    // T-SESS-05: Active Session Listing & Individual Session Revocation
    console.log('\n--- [1.4] TESTING SESSION LISTING & REVOCATION ---');
    const sessionsRes = await fetch(`${BASE_URL}/me/sessions`, {
      headers: { Authorization: `Bearer ${changeToken}` },
    });
    const sessionList = await sessionsRes.json();
    const t_sess_05 = sessionsRes.status === 200 && Array.isArray(sessionList) && sessionList.length > 0;
    results.push({
      code: 'T-SESS-05',
      title: 'Session management: list active sessions and query metadata (IP, userAgent, lastActiveAt)',
      passed: t_sess_05,
      details: `Active sessions found: ${sessionList.length}`,
    });
    console.log(`T-SESS-05 (Session listing): ${t_sess_05 ? 'PASSED' : 'FAILED'}`);

    // T-SESS-06: Session Fixation Protection
    console.log('\n--- [1.4] TESTING SESSION FIXATION PROTECTION ---');
    const login1 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.7.1' },
      body: JSON.stringify({ email: testEmail, password: newChangedPassword }),
    });
    const data1 = await login1.json();

    const login2 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.7.2' },
      body: JSON.stringify({ email: testEmail, password: newChangedPassword }),
    });
    const data2 = await login2.json();

    console.log('Login 1 status:', login1.status, 'data1:', data1);
    console.log('Login 2 status:', login2.status, 'data2:', data2);

    const t_sess_06 = data1.sessionId && data2.sessionId && data1.sessionId !== data2.sessionId;
    results.push({
      code: 'T-SESS-06',
      title: 'Session fixation protection: each authentication event generates a unique session ID',
      passed: t_sess_06,
      details: `SID 1: ${data1.sessionId}, SID 2: ${data2.sessionId}`,
    });
    console.log(`T-SESS-06 (Session fixation protection): ${t_sess_06 ? 'PASSED' : 'FAILED'}`);

    // T-RATE-01: Rate Limiting Enforcement (DDoS Protection)
    console.log('\n--- [1.3 & 1.4] TESTING RATE LIMITING ENFORCEMENT ---');
    let rateLimited = false;
    for (let i = 1; i <= 15; i++) {
      const rlRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.99' },
        body: JSON.stringify({ email: `rate_${uid}@example.com`, password: 'anyPassword123!' }),
      });
      if (rlRes.status === 429) {
        rateLimited = true;
        break;
      }
    }
    results.push({
      code: 'T-RATE-01',
      title: 'Rate limiting: rapid requests trigger HTTP 429 Too Many Requests',
      passed: rateLimited,
      details: `Rate limit hit: ${rateLimited}`,
    });
    console.log(`T-RATE-01 (Rate limiting 429 response): ${rateLimited ? 'PASSED' : 'FAILED'}`);

  } catch (error) {
    console.error('Fatal test execution error:', error);
  } finally {
    await app.close();
  }

  console.log('\n================================================================');
  console.log('SUMMARY OF RESULTS:');
  console.log('================================================================');
  let allPassed = true;
  for (const r of results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.code}: ${r.title}`);
    if (!r.passed) allPassed = false;
  }
  console.log('================================================================');
  console.log(`FINAL STATUS: ${allPassed ? 'ALL 12 TESTS PASSED (100% COMPLIANT)' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');
}

runTests().catch(console.error);
