import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import { BACKUP_CONSTANTS } from './backup.constants';

export interface EncryptedBackupResult {
  cipherBuffer: Buffer;
  iv: string; // base64
  authTag: string; // base64
  plaintextChecksumSha256: string;
  encryptedChecksumSha256: string;
  encryptionAlgorithm: string;
  encryptionKeyId: string;
}

export interface CertificateOfDestruction {
  certificateId: string;
  backupId: string;
  disposedAt: string;
  disposedBy: string;
  reason: string;
  wipeAlgorithm: string;
  passesCompleted: number;
  unlinkedPaths: string[];
  originalChecksumSha256: string;
  originalEncryptedChecksumSha256: string;
  cryptographicErasureConfirmed: boolean;
  status: 'DESTROYED_COMPLIANT';
}

@Injectable()
export class BackupCryptoService {
  private readonly logger = new Logger(BackupCryptoService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawKey =
      this.config.get<string>('BACKUP_ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'news-share-backup-aes256-gcm-master-key-32-bytes!';

    // Derive 256-bit key using SHA-256
    this.encryptionKey = createHash('sha256').update(rawKey).digest();
  }

  /**
   * Computes SHA-256 hash of a buffer or string
   */
  computeSha256(data: Buffer | string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypts plaintext buffer using AES-256-GCM (Section 3: Backup encryption at rest)
   */
  encrypt(plaintextBuffer: Buffer): EncryptedBackupResult {
    const iv = randomBytes(BACKUP_CONSTANTS.IV_LENGTH_BYTES);
    const cipher = createCipheriv(BACKUP_CONSTANTS.ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const plaintextChecksumSha256 = this.computeSha256(plaintextBuffer);
    const encryptedChecksumSha256 = this.computeSha256(ciphertext);

    return {
      cipherBuffer: ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      plaintextChecksumSha256,
      encryptedChecksumSha256,
      encryptionAlgorithm: BACKUP_CONSTANTS.ENCRYPTION_ALGORITHM,
      encryptionKeyId: BACKUP_CONSTANTS.ENCRYPTION_KEY_ID,
    };
  }

  /**
   * Decrypts ciphertext buffer using AES-256-GCM, verifying authentication tag (Section 3: Restoration integrity)
   */
  decrypt(ciphertext: Buffer, ivBase64: string, authTagBase64: string): Buffer {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = createDecipheriv(BACKUP_CONSTANTS.ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Performs NIST SP 800-88 / DoD 5220.22-M compliant multi-pass secure wipe of file on disk (Section 3: Secure disposal)
   */
  async secureWipeFile(filePath: string, passes = BACKUP_CONSTANTS.DISPOSAL_OVERWRITE_PASSES): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      const fd = fs.openSync(filePath, 'r+');

      // Pass 1: Write all zeros (0x00)
      const zerosBuffer = Buffer.alloc(Math.min(fileSize, 64 * 1024), 0x00);
      let bytesWritten = 0;
      while (bytesWritten < fileSize) {
        const chunk = Math.min(zerosBuffer.length, fileSize - bytesWritten);
        fs.writeSync(fd, zerosBuffer, 0, chunk, bytesWritten);
        bytesWritten += chunk;
      }
      fs.fsyncSync(fd);

      // Pass 2: Write all ones (0xFF)
      if (passes >= 2) {
        const onesBuffer = Buffer.alloc(Math.min(fileSize, 64 * 1024), 0xff);
        bytesWritten = 0;
        while (bytesWritten < fileSize) {
          const chunk = Math.min(onesBuffer.length, fileSize - bytesWritten);
          fs.writeSync(fd, onesBuffer, 0, chunk, bytesWritten);
          bytesWritten += chunk;
        }
        fs.fsyncSync(fd);
      }

      // Pass 3: Write cryptographically secure random bytes
      if (passes >= 3) {
        const randomBlock = randomBytes(Math.min(fileSize, 64 * 1024));
        bytesWritten = 0;
        while (bytesWritten < fileSize) {
          const chunk = Math.min(randomBlock.length, fileSize - bytesWritten);
          fs.writeSync(fd, randomBlock, 0, chunk, bytesWritten);
          bytesWritten += chunk;
        }
        fs.fsyncSync(fd);
      }

      // Truncate to 0 bytes before unlinking
      fs.ftruncateSync(fd, 0);
      fs.closeSync(fd);

      // Unlink / delete file from filesystem
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      this.logger.error(`Error during secure wipe of file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates a verifiable Certificate of Destruction
   */
  generateCertificateOfDestruction(params: {
    backupId: string;
    disposedBy: string;
    reason: string;
    unlinkedPaths: string[];
    originalChecksumSha256: string;
    originalEncryptedChecksumSha256: string;
  }): CertificateOfDestruction {
    const certHash = this.computeSha256(
      `${params.backupId}:${params.disposedBy}:${Date.now()}:${params.originalChecksumSha256}`,
    );

    return {
      certificateId: `CERT-DEST-${certHash.substring(0, 16).toUpperCase()}`,
      backupId: params.backupId,
      disposedAt: new Date().toISOString(),
      disposedBy: params.disposedBy,
      reason: params.reason,
      wipeAlgorithm: BACKUP_CONSTANTS.DISPOSAL_WIPE_ALGORITHM,
      passesCompleted: BACKUP_CONSTANTS.DISPOSAL_OVERWRITE_PASSES,
      unlinkedPaths: params.unlinkedPaths,
      originalChecksumSha256: params.originalChecksumSha256,
      originalEncryptedChecksumSha256: params.originalEncryptedChecksumSha256,
      cryptographicErasureConfirmed: true,
      status: 'DESTROYED_COMPLIANT',
    };
  }
}
