import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SentMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  token?: string;
  sentAt: Date;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transport?: nodemailer.Transporter;
  private readonly from: string;
  private readonly appBaseUrl: string;

  // In-memory outbox for testing, local development, and offline operation
  public readonly outbox: SentMail[] = [];

  constructor(private readonly config: ConfigService) {
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      this.config.get<string>('SMTP_FROM') ||
      'News Share <noreply@newsshare.local>';
    this.appBaseUrl = this.config.get<string>('APP_BASE_URL', 'http://localhost:3000');

    const host = this.config.get<string>('MAIL_HOST') || this.config.get<string>('SMTP_HOST');
    const portRaw = this.config.get<string | number>('MAIL_PORT') ?? this.config.get<string | number>('SMTP_PORT', 587);
    const port = Number(portRaw);
    const user = this.config.get<string>('MAIL_USER') || this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('MAIL_PASSWORD') || this.config.get<string>('SMTP_PASS');

    if (host) {
      try {
        this.transport = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: user && pass ? { user, pass } : undefined,
        });
      } catch (err) {
        this.logger.warn(`Failed to initialize SMTP transport: ${(err as Error).message}`);
      }
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.verify();
        this.logger.log(`SMTP transport initialized and verified successfully for ${this.from}`);
      } catch (err) {
        this.logger.warn(`SMTP transport verification failed: ${(err as Error).message}. Will fallback to outbox.`);
      }
    } else {
      this.logger.log('SMTP transport not configured. Mail will be stored in outbox only.');
    }
  }

  async sendRaw(to: string, subject: string, text: string, html?: string, token?: string): Promise<void> {
    const mailRecord: SentMail = {
      to,
      subject,
      text,
      html,
      token,
      sentAt: new Date(),
    };
    this.outbox.push(mailRecord);
    this.logger.log(`[MailService] Sent mail to ${to} with subject "${subject}"`);

    if (this.transport) {
      try {
        await this.transport.sendMail({
          from: this.from,
          to,
          subject,
          text,
          html: html || undefined,
        });
        this.logger.log(`[MailService] Email delivered successfully to ${to} via SMTP`);
      } catch (err) {
        this.logger.warn(`SMTP delivery failed for ${to}: ${(err as Error).message}. Mail recorded in outbox.`);
      }
    }
  }

  async sendVerification(to: string, token: string): Promise<void> {
    const verifyLink = `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const text =
      `Welcome to News Share!\n\n` +
      `Your account verification code is:\n\n` +
      `   ${token}\n\n` +
      `Or verify your email by clicking the link below:\n` +
      `${verifyLink}\n\n` +
      `This token is valid for 24 hours. If you did not register, please ignore this email.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your News Share account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; border: 1px solid #e5e9f0;">
          <tr>
            <td style="background-color: #0d6efd; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">News Share</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1e293b;">Welcome to News Share!</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Thank you for signing up. Please verify your email address to activate your account and start sharing and exploring news.
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600;">Verification Code</p>
                <span style="font-size: 24px; font-family: monospace; font-weight: 700; color: #0d6efd; letter-spacing: 2px;">${token}</span>
              </div>

              <div style="text-align: center; margin-bottom: 28px;">
                <a href="${verifyLink}" style="display: inline-block; background-color: #0d6efd; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 32px; border-radius: 6px;">Verify Account</a>
              </div>

              <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                This code and link are valid for <strong>24 hours</strong>. If you did not create an account with News Share, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e9f0; font-size: 12px; color: #94a3b8;">
              &copy; ${new Date().getFullYear()} News Share. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.sendRaw(to, 'Verify your News Share account', text, html, token);
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetLink = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const text =
      `News Share Password Reset Request\n\n` +
      `Your password reset token is:\n\n` +
      `   ${token}\n\n` +
      `Or reset your password by clicking the link below:\n` +
      `${resetLink}\n\n` +
      `This token is valid for 30 minutes and can only be used once.\n` +
      `If you did not request a password reset, your account is safe and you can ignore this email.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your News Share password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; border: 1px solid #e5e9f0;">
          <tr>
            <td style="background-color: #0d6efd; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">News Share</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1e293b;">Password Reset Request</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                We received a request to reset the password for your News Share account. You can reset your password using the single-use token or button below.
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600;">Reset Token</p>
                <span style="font-size: 20px; font-family: monospace; font-weight: 700; color: #0d6efd; letter-spacing: 1px; word-break: break-all;">${token}</span>
              </div>

              <div style="text-align: center; margin-bottom: 28px;">
                <a href="${resetLink}" style="display: inline-block; background-color: #0d6efd; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 32px; border-radius: 6px;">Reset Password</a>
              </div>

              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  <strong>Important:</strong> This link and token expire in <strong>30 minutes</strong> and can only be used once.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                If you did not request a password reset, please ignore this email or contact support if you have concerns. Your account remains secure.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e9f0; font-size: 12px; color: #94a3b8;">
              &copy; ${new Date().getFullYear()} News Share. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.sendRaw(to, 'Reset your News Share password', text, html, token);
  }

  async sendLockNotice(to: string): Promise<void> {
    const resetLink = `${this.appBaseUrl}/reset-password`;
    const text =
      `News Share Account Security Notice\n\n` +
      `Your News Share account has been temporarily locked after 5 consecutive failed sign-in attempts.\n\n` +
      `For your security, sign-in is disabled for 15 minutes.\n` +
      `The account will unlock automatically after 15 minutes, or you can unlock it immediately by resetting your password at:\n` +
      `${resetLink}\n\n` +
      `If you did not make these attempts, someone may be trying to guess your password. We strongly recommend resetting your password immediately.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Temporarily Locked</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; border: 1px solid #e5e9f0;">
          <tr>
            <td style="background-color: #dc3545; padding: 25px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Security Alert: Account Temporarily Locked</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                We detected <strong>5 consecutive failed login attempts</strong> for your News Share account.
              </p>
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; margin-bottom: 24px; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.5;">
                  Your account has been temporarily locked for <strong>15 minutes</strong> to protect against unauthorized access.
                </p>
              </div>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Your account will unlock automatically once the 15-minute lockout period expires. Alternatively, you can unlock your account immediately by initiating a secure password reset.
              </p>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${resetLink}" style="display: inline-block; background-color: #0d6efd; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px;">Reset Password Now</a>
              </div>
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                If you did not perform these login attempts, your account credentials may be compromised. Please reset your password immediately once your account is unlocked.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 18px; text-align: center; border-top: 1px solid #e5e9f0; font-size: 12px; color: #94a3b8;">
              &copy; ${new Date().getFullYear()} News Share Security Team
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.sendRaw(to, 'Security Alert: News Share account temporarily locked', text, html);
  }

  async sendAccountExists(to: string): Promise<void> {
    const text =
      `Someone attempted to register a News Share account using this email address, but an account already exists.\n\n` +
      `If this was you, please use the "Forgot Password" feature or sign in at ${this.appBaseUrl}/login.`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; padding: 20px;">
  <h2>News Share Registration Notice</h2>
  <p>Someone attempted to register a News Share account using this email address, but an account already exists.</p>
  <p>If this was you, please use the <strong>Forgot Password</strong> feature or sign in to your existing account.</p>
  <p style="color: #888; font-size: 12px;">If this was not you, no further action is required.</p>
</body>
</html>`;

    await this.sendRaw(to, 'News Share registration notice', text, html);
  }

  async sendSecurityNotice(to: string, notice: string): Promise<void> {
    const text =
      `Security Notice for your News Share account:\n\n` +
      `${notice}\n\n` +
      `If this was not you, please reset your password immediately.`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; padding: 20px;">
  <h2>News Share Security Notice</h2>
  <p>${notice}</p>
  <p style="color: #d9534f; font-weight: bold;">If this was not you, please reset your password immediately.</p>
</body>
</html>`;

    await this.sendRaw(to, 'News Share Security Notice', text, html);
  }

  getLatestToken(to: string): string | undefined {
    const matching = this.outbox.filter((m) => m.to.toLowerCase() === to.toLowerCase() && m.token);
    return matching.length > 0 ? matching[matching.length - 1].token : undefined;
  }
}
