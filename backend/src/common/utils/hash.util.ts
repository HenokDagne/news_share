import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

let argon2: any;
try {
  argon2 = require('argon2');
} catch {
  argon2 = null;
}

export async function hashPassword(password: string): Promise<string> {
  if (argon2) {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
      });
    } catch {
      // Fallback to bcrypt if argon2 native addon fails
      return bcrypt.hash(password, 10);
    }
  }
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  // Check if hash is bcrypt ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: valid }; // Needs rehash to argon2id on successful login
  }

  // Otherwise verify with argon2
  if (argon2 && storedHash.startsWith('$argon2')) {
    try {
      const valid = await argon2.verify(storedHash, password);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Fallback check
  try {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: true };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
