import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { AUDIT_CONSTANTS } from './audit.constants';

export interface IntegrityVerificationReport {
  isValid: boolean;
  totalRecordsVerified: number;
  genesisHash: string;
  chainHeadHash: string | null;
  verifiedAt: string;
  tamperedRecord?: {
    sequenceNumber: string;
    id: string;
    timestamp: string;
    action: string;
    expectedHash: string;
    actualHash: string;
    reason: string;
  };
}

@Injectable()
export class AuditCryptoService {
  private readonly logger = new Logger(AuditCryptoService.name);
  private readonly encryptionKey: Buffer;

  // Sensitive keys that must be redacted before storage
  private readonly redactedKeys = new Set([
    'password',
    'currentpassword',
    'newpassword',
    'confirmpassword',
    'passwordhash',
    'token',
    'tokenhash',
    'refreshtoken',
    'accesstoken',
    'authorization',
    'cookie',
    'secret',
    'apikey',
    'creditcard',
    'cvv',
    'ssn',
  ]);

  constructor(private readonly config: ConfigService) {
    const rawKey =
      this.config.get<string>('AUDIT_LOG_ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'audit-trails-default-secret-encryption-key-32-chars!';

    // Derive 256-bit key using SHA-256
    this.encryptionKey = createHash('sha256').update(rawKey).digest();
  }

  /**
   * Recursively sanitizes objects to remove/mask credentials and sensitive keys
   */
  sanitize(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '');
      if (this.redactedKeys.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Hashes payload with SHA-256
   */
  hashPayload(data: any): string {
    if (data === null || data === undefined) return '';
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Encrypts log data with AES-256-GCM (Section 2.3: Encrypt stored logs)
   * Format: ivHex:authTagHex:ciphertextHex
   */
  encryptPayload(data: any): { encryptedData: string; dataHash: string } {
    if (data === null || data === undefined) {
      return { encryptedData: '', dataHash: '' };
    }

    const sanitized = this.sanitize(data);
    const jsonString = JSON.stringify(sanitized);
    const dataHash = this.hashPayload(jsonString);

    const iv = randomBytes(12); // 96-bit IV standard for GCM
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let ciphertext = cipher.update(jsonString, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const encryptedData = `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
    return { encryptedData, dataHash };
  }

  /**
   * Decrypts AES-256-GCM encrypted payload
   */
  decryptPayload(encryptedString: string | null | undefined): any {
    if (!encryptedString) return null;

    try {
      const parts = encryptedString.split(':');
      if (parts.length !== 3) {
        // Fallback for unencrypted / legacy
        try {
          return JSON.parse(encryptedString);
        } catch {
          return encryptedString;
        }
      }

      const [ivHex, authTagHex, ciphertextHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (err: any) {
      this.logger.error(`Decryption error: ${err.message}`);
      return '[ENCRYPTED DATA - DECRYPTION ERROR]';
    }
  }

  /**
   * Computes tamper-evident SHA-256 hash for cryptographic chaining (Section 2.3)
   * recordHash = SHA256(sequenceNumber:timestamp:category:action:username:ipAddress:resource:statusCode:dataHash:previousHash)
   */
  computeRecordHash(record: {
    sequenceNumber: bigint | number;
    timestamp: Date | string;
    category: string;
    action: string;
    username?: string | null;
    ipAddress?: string | null;
    resource?: string | null;
    statusCode?: number | null;
    dataHash?: string | null;
    previousHash: string;
  }): string {
    const ts =
      record.timestamp instanceof Date
        ? record.timestamp.toISOString()
        : new Date(record.timestamp).toISOString();

    const components = [
      record.sequenceNumber.toString(),
      ts,
      record.category || '',
      record.action || '',
      record.username || '',
      record.ipAddress || '',
      record.resource || '',
      record.statusCode?.toString() || '',
      record.dataHash || '',
      record.previousHash || AUDIT_CONSTANTS.GENESIS_HASH,
    ];

    const message = components.join('|');
    return createHash('sha256').update(message).digest('hex');
  }
}
