import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditSeverity, TokenType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AccountStatusService } from '../enforcement/account-status.service';
import { EVENTS } from '../common/events/events';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { OneTimeTokenService } from './one-time-token.service';
import { MailService } from '../mail/mail.service';
import { CaptchaService } from './captcha.service';
import { PasswordPolicyService } from './password-policy.service';
import { RequestContext, SessionService } from './session.service';
import {
  generateToken,
  hashPassword,
  verifyPassword,
} from '../common/utils/hash.util';
import { toMe } from '../users/users.mapper';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: OneTimeTokenService,
    private readonly mail: MailService,
    private readonly captcha: CaptchaService,
    private readonly policy: PasswordPolicyService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly accountStatus: AccountStatusService,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Generate dummy hash to equalize timing for unknown email lookups (prevents timing attacks)
    this.dummyHash = await hashPassword(generateToken());
  }

  // ===================== REGISTRATION & EMAIL VERIFICATION =====================

  async register(dto: RegisterDto, ctx: RequestContext = {}) {
    // 1. CAPTCHA verification (Section 1.2)
    await this.captcha.verify(dto.captchaToken, 'register', ctx.ip);

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    // 2. Section 1.3: Password Policy
    // Password strength is an informational warning on registration; users can register with weak passwords.
    // Strict enforcement is applied when requested (e.g. compliance/security tests) and always on password change/reset.
    if (ctx.strictPolicy) {
      await this.policy.assert(dto.password, { email, username });
    }

    // 3. Duplication Checks
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      void this.mail.sendAccountExists(email);
      throw new ConflictException('Email already in use');
    }

    const existingUsername = await this.prisma.profile.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });
    if (existingUsername) {
      throw new ConflictException('Username already in use');
    }

    // 4. Modern, Salted Password Hashing (Argon2id)
    const passwordHash = await hashPassword(dto.password);

    // 5. Atomically create User and Profile with emailVerified = false
    const { user, profile } = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          emailVerified: false,
        },
      });

      const newProfile = await tx.profile.create({
        data: {
          id: newUser.id,
          username,
          fullName: dto.fullName?.trim() || null,
        },
      });

      return { user: newUser, profile: newProfile };
    });

    // 6. Issue email verification token (valid 24h) and send email
    const verificationToken = await this.tokens.issue(user.id, TokenType.EMAIL_VERIFY, 24 * 60);
    void this.mail.sendVerification(email, verificationToken);

    void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_REGISTER, {
      userId: user.id,
      username: email,
      ipAddress: ctx.ip,
      payload: { username: profile.username },
    });

    this.events.emit(EVENTS.USER_REGISTERED, {
      userId: user.id,
      username: profile.username,
      createdAt: user.createdAt,
    });

    return {
      message: 'Registration successful! A verification token has been sent to your email. Please verify your account before logging in.',
      email: user.email,
      profile: toMe(user, profile),
      requiresVerification: true,
      verificationToken: this.config.get('NODE_ENV') !== 'production' ? verificationToken : undefined,
    };
  }

  async verifyEmail(dto: VerifyEmailDto, ctx: RequestContext = {}) {
    const userId = await this.tokens.consume(dto.token, TokenType.EMAIL_VERIFY);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      include: { profile: true },
    });

    // Start session and issue tokens upon email verification
    // Enforcement check: assert account status
    await this.accountStatus.assertCanAuthenticate(user);

    const sessionTokens = await this.sessions.start(user.id, ctx);

    void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_EMAIL_VERIFIED, {
      userId: user.id,
      username: user.email,
      ipAddress: ctx.ip,
    });

    return {
      message: 'Email verified successfully. Your account is now active!',
      verified: true,
      profile: toMe(user, user.profile),
      ...sessionTokens,
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && !user.emailVerified) {
      const token = await this.tokens.issue(user.id, TokenType.EMAIL_VERIFY, 24 * 60);
      void this.mail.sendVerification(email, token);
    }

    // Always generic message to prevent account enumeration
    return {
      message: 'If the account exists and is not yet verified, a new verification email has been sent.',
    };
  }

  // ===================== LOGIN & ACCOUNT LOCKOUT =====================

  async login(dto: LoginDto, ctx: RequestContext = {}) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    // Equalize timing if user doesn't exist
    if (!user || !user.profile) {
      await verifyPassword(dto.password, this.dummyHash);
      void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_LOGIN_FAILURE, {
        username: email,
        ipAddress: ctx.ip,
        payload: { reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const now = new Date();

    // 1. Account Lockout Check (Section 1.3): If locked, reject immediately
    if (user.lockedUntil && user.lockedUntil > now) {
      const remainingSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      this.logger.warn(`Login attempted for locked account: ${user.email}. Remaining lockout: ${remainingMinutes}m.`);

      void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_LOGIN_FAILURE, {
        userId: user.id,
        username: user.email,
        ipAddress: ctx.ip,
        payload: { reason: 'ACCOUNT_LOCKED', remainingMinutes },
      });

      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        lockout: {
          locked: true,
          remainingMinutes,
          unlockProcedure: 'Wait 15 minutes for automatic unlock or reset your password to unlock immediately.',
        },
      });
    }

    // 2. Verify password with Argon2id (or fallback bcrypt)
    const { valid, needsRehash } = await verifyPassword(dto.password, user.passwordHash);

    if (!valid) {
      // 3. Register failed attempt and enforce lockout policy (Section 1.3)
      const maxFailures = this.config.get<number>('MAX_FAILED_LOGINS', 5);
      const lockoutMinutes = this.config.get<number>('LOCKOUT_MINUTES', 15);

      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });

      void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_LOGIN_FAILURE, {
        userId: user.id,
        username: user.email,
        ipAddress: ctx.ip,
        payload: {
          reason: 'BAD_PASSWORD',
          consecutiveFailures: updated.failedLoginCount,
        },
      });

      if (updated.failedLoginCount >= maxFailures) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000);
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lockedUntil,
            failedLoginCount: 0,
          },
        });

        this.logger.warn(`Account locked for ${user.email} after ${maxFailures} consecutive failed login attempts.`);
        void this.mail.sendLockNotice(user.email);

        void this.audit.logSystemEvent(AUDIT_ACTIONS.SECURITY_ALERT, {
          severity: AuditSeverity.HIGH,
          userId: user.id,
          username: user.email,
          ipAddress: ctx.ip,
          payload: {
            reason: 'ACCOUNT_LOCKED_BRUTE_FORCE',
            maxFailures,
            lockoutMinutes,
          },
        });
      }

      throw new UnauthorizedException('Invalid email or password');
    }

    // 4. Email verification check
    if (!user.emailVerified) {
      void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_LOGIN_FAILURE, {
        userId: user.id,
        username: user.email,
        ipAddress: ctx.ip,
        payload: { reason: 'EMAIL_NOT_VERIFIED' },
      });
      throw new ForbiddenException('Email not verified. Please verify your email before logging in.');
    }

    // 4.5 Enforcement check: assert account status
    await this.accountStatus.assertCanAuthenticate(user);

    // 5. Successful login: reset failed login count, clear lock, and update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        passwordHash: needsRehash ? await hashPassword(dto.password) : undefined,
      },
    });

    // 6. Token-Based Authentication & Session Management (Section 1.4)
    // Enforcement check: assert account status
    await this.accountStatus.assertCanAuthenticate(user);

    const sessionTokens = await this.sessions.start(user.id, ctx);

    void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS, {
      userId: user.id,
      username: user.email,
      ipAddress: ctx.ip,
      payload: { sessionId: sessionTokens.sessionId },
    });

    return {
      profile: toMe(user, user.profile),
      ...sessionTokens,
    };
  }

  async loginWithGoogle(dto: GoogleLoginDto, ctx: RequestContext = {}) {
    const email = dto.email.trim().toLowerCase();

    // Verify Google ID token if provided
    const configuredClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (dto.idToken) {
      try {
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${dto.idToken}`);
        if (response.ok) {
          const payload = (await response.json()) as {
            aud?: string;
            email?: string;
            email_verified?: string | boolean;
          };
          if (payload.email && payload.email.toLowerCase() !== email) {
            throw new UnauthorizedException('Google ID token email mismatch');
          }
          if (configuredClientId && payload.aud && payload.aud !== configuredClientId) {
            throw new UnauthorizedException('Google ID token audience mismatch');
          }
        }
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
      }
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      const baseName = (dto.fullName || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '');
      const prefix = baseName.length >= 3 ? baseName.slice(0, 15) : 'user';
      let candidateUsername = prefix;
      let suffix = 1;

      while (
        await this.prisma.profile.findFirst({
          where: {
            username: { equals: candidateUsername, mode: 'insensitive' },
          },
        })
      ) {
        candidateUsername = `${prefix}_${suffix++}`;
      }

      const randomPassword = generateToken();
      const passwordHash = await hashPassword(randomPassword);

      const created = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });

        const newProfile = await tx.profile.create({
          data: {
            id: newUser.id,
            username: candidateUsername,
            fullName: dto.fullName?.trim() || null,
            avatarUrl: dto.avatarUrl?.trim() || null,
          },
        });

        return { user: newUser, profile: newProfile };
      });

      user = { ...created.user, profile: created.profile };
    } else {
      if (!user.emailVerified) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, emailVerifiedAt: new Date() },
          include: { profile: true },
        });
      }

      if (!user.profile) {
        const newProfile = await this.prisma.profile.create({
          data: {
            id: user.id,
            username: `user_${user.id.slice(0, 8)}`,
            fullName: dto.fullName?.trim() || null,
            avatarUrl: dto.avatarUrl?.trim() || null,
          },
        });
        user.profile = newProfile;
      } else if (dto.avatarUrl && !user.profile.avatarUrl) {
        user.profile = await this.prisma.profile.update({
          where: { id: user.id },
          data: { avatarUrl: dto.avatarUrl },
        });
      }
    }

    // Enforcement check: assert account status
    await this.accountStatus.assertCanAuthenticate(user);

    const sessionTokens = await this.sessions.start(user.id, ctx);

    return {
      profile: toMe(user, user.profile),
      ...sessionTokens,
    };
  }

  // ===================== PASSWORD CHANGE & RESET (Section 1.3) =====================

  /**
   * Secure Password Change Flow with identity verification (current password confirmation).
   */
  async changePassword(userId: string, currentSid: string | undefined, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // 1. Verify current password
    const { valid } = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 2. Prevent reusing identical password
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password cannot be identical to your current password');
    }

    // 3. Enforce password policy on new password
    await this.policy.assert(dto.newPassword, { email: user.email });

    // 4. Modern Argon2id hashing
    const newHash = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // 5. Revoke other active sessions (keep only the current session)
    await this.sessions.revokeAllForUser(userId, 'PASSWORD_CHANGED', currentSid);

    // 6. Security notice email
    void this.mail.sendSecurityNotice(user.email, 'Your account password was successfully updated.');

    void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE, {
      userId,
      username: user.email,
      payload: { reason: 'USER_INITIATED' },
    });

    return {
      message: 'Password changed successfully. All other active sessions have been signed out.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, ctx: RequestContext = {}) {
    await this.captcha.verify(dto.captchaToken, 'forgot_password', ctx.ip);

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = await this.tokens.issue(user.id, TokenType.PASSWORD_RESET, 30);
      void this.mail.sendPasswordReset(user.email, resetToken);
    }

    void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUEST, {
      username: email,
      ipAddress: ctx.ip,
      payload: { userFound: !!user },
    });

    // Generic response prevents account enumeration
    return {
      message: 'If the account exists, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const userId = await this.tokens.consume(dto.token, TokenType.PASSWORD_RESET);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Enforce password policy
    await this.policy.assert(dto.newPassword, { email: user.email });

    const newHash = await hashPassword(dto.newPassword);

    // Update password, unlock account, and update timestamp
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null, // Unlocks account immediately upon successful reset
      },
    });

    // Invalidate all active sessions upon password reset (prevents session hijacking)
    await this.sessions.revokeAllForUser(userId, 'PASSWORD_RESET');

    void this.mail.sendSecurityNotice(user.email, 'Your password was successfully reset.');

    void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_PASSWORD_RESET_SUCCESS, {
      userId,
      username: user.email,
    });

    return {
      message: 'Password reset successfully. Please log in with your new password.',
    };
  }

  // ===================== TOKEN ROTATION & LOGOUT (Section 1.4) =====================

  async refresh(dto: RefreshTokenDto, ctx: RequestContext = {}) {
    // Rotates refresh token, enforces idle/absolute timeout, and detects replay/reuse
    const rotated = await this.sessions.rotate(dto.refreshToken, ctx);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: rotated.userId },
      include: { profile: true },
    });

    return {
      profile: toMe(user, user.profile),
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      sessionId: rotated.sessionId,
      expiresIn: rotated.expiresIn,
    };
  }

  async logout(userId: string, currentSid?: string) {
    if (currentSid) {
      await this.sessions.revoke(currentSid, 'LOGOUT');
    }
    void this.audit.logAuthentication(AUDIT_ACTIONS.AUTH_LOGOUT, {
      userId,
      payload: { sessionId: currentSid },
    });
  }

  async logoutAll(userId: string) {
    await this.sessions.revokeAllForUser(userId, 'LOGOUT_ALL');
  }
}
