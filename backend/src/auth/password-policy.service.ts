import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface PasswordContext {
  email?: string;
  username?: string;
}

@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  /**
   * Asserts that a password complies with Section 1.3 security policies:
   * - Minimum 12 characters, maximum 128 characters
   * - Mix of at least 3 of 4 character classes: lowercase, uppercase, numbers, symbols
   * - Must not contain username or email prefix
   * - Checks against Have I Been Pwned (HIBP) breach list via k-anonymity
   */
  async assert(password: string, ctx: PasswordContext = {}): Promise<void> {
    const problems: string[] = [];

    // 1. Length enforcement (12 - 128 characters)
    if (!password || password.length < 12) {
      problems.push('must be at least 12 characters long');
    }
    if (password && password.length > 128) {
      problems.push('must not exceed 128 characters');
    }

    if (password) {
      // 2. Complexity: at least 3 of 4 character classes
      const hasLower = /[a-z]/.test(password);
      const hasUpper = /[A-Z]/.test(password);
      const hasDigit = /[0-9]/.test(password);
      const hasSymbol = /[^A-Za-z0-9]/.test(password);
      const classCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

      if (classCount < 3) {
        problems.push('must include at least 3 of: lowercase letters, uppercase letters, numbers, and special symbols');
      }

      const lowerPassword = password.toLowerCase();

      // 3. Contextual checks (username and email prefix)
      if (ctx.username && ctx.username.trim().length >= 3) {
        const cleanUser = ctx.username.trim().toLowerCase();
        if (lowerPassword.includes(cleanUser)) {
          problems.push('must not contain your username');
        }
      }

      if (ctx.email) {
        const emailPrefix = ctx.email.split('@')[0]?.trim().toLowerCase();
        if (emailPrefix && emailPrefix.length >= 3 && lowerPassword.includes(emailPrefix)) {
          problems.push('must not contain your email address prefix');
        }
      }
    }

    if (problems.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Password does not meet security requirements: ${problems.join('; ')}.`,
        guidance:
          'Create a strong password of at least 12 characters mixing uppercase, lowercase, numbers, and symbols without including your name or username.',
      });
    }

    // 4. Have I Been Pwned (HIBP) Breached Password Check
    const isCompromised = await this.isBreached(password);
    if (isCompromised) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'This password appears in known global data breaches (Have I Been Pwned). For your security, choose a different password.',
        guidance: 'Avoid commonly compromised passwords such as dictionary words, repeated patterns, or previously leaked credentials.',
      });
    }
  }

  /**
   * Performs k-anonymity check against Have I Been Pwned Range API.
   * Only the first 5 characters of the SHA-1 hash leave the server.
   */
  private async isBreached(password: string): Promise<boolean> {
    if (process.env.HIBP_ENABLED === 'false') {
      return false;
    }

    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(`HIBP range API returned HTTP ${response.status}. Skipping breach check.`);
        return false;
      }

      const body = await response.text();
      const lines = body.split('\n');

      return lines.some((line) => {
        const [hashSuffix, countStr] = line.trim().split(':');
        return hashSuffix === suffix && parseInt(countStr || '0', 10) > 0;
      });
    } catch (err) {
      // Fail open so network issues do not prevent users from registering/changing passwords
      this.logger.warn(`HIBP check skipped due to network/timeout error: ${(err as Error).message}`);
      return false;
    }
  }
}
