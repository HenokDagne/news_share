export const BACKUP_CONSTANTS = {
  // RPO & RTO definitions (Section 3: Regular backups with defined RPO/RTO)
  DEFAULT_FULL_RPO_HOURS: 24, // Full backup every 24h
  DEFAULT_INCREMENTAL_RPO_MINUTES: 60, // Incremental delta backup every 60 min
  DEFAULT_RTO_MINUTES: 15, // Target maximum Recovery Time Objective: 15 minutes

  // 3-2-1 Rule Requirements (Section 3: Offsite and immutable copies)
  MIN_REQUIRED_COPIES: 3, // 3 copies (Primary live DB, Primary backup copy, Secondary/Offsite copy)
  MIN_MEDIA_TYPES: 2, // 2 different media types (Local disk storage, Offsite vault / Object storage)
  MIN_OFFSITE_COPIES: 1, // At least 1 copy offsite

  // Storage Media Types
  MEDIA_TYPES: {
    LOCAL_DISK: 'LOCAL_DISK',
    SECONDARY_STORAGE: 'SECONDARY_STORAGE',
    OFFSITE_VAULT: 'OFFSITE_VAULT',
  },

  // Encryption at Rest & in Transit (Section 3: Backup encryption)
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  ENCRYPTION_KEY_ID: 'master-backup-aes256-gcm-v1',
  IV_LENGTH_BYTES: 12, // 96 bits for AES-GCM
  AUTH_TAG_LENGTH_BYTES: 16, // 128 bits authentication tag

  // Immutability / Ransomware Resistance (Section 3: Immutable copy)
  DEFAULT_RETENTION_LOCK_DAYS: 30, // 30-day WORM retention lock by default

  // Secure Disposal Standards (Section 3: Secure disposal)
  DISPOSAL_WIPE_ALGORITHM: 'NIST_SP_800_88_REV1_3PASS',
  DISPOSAL_OVERWRITE_PASSES: 3,
} as const;

export const BACKUP_AUDIT_ACTIONS = {
  BACKUP_CREATED: 'BACKUP_CREATED',
  BACKUP_SCHEDULED: 'BACKUP_SCHEDULED',
  BACKUP_FAILED: 'BACKUP_FAILED',
  BACKUP_DOWNLOADED: 'BACKUP_DOWNLOADED',
  BACKUP_ACCESSED: 'BACKUP_ACCESSED',
  BACKUP_LOCKED_IMMUTABLE: 'BACKUP_LOCKED_IMMUTABLE',
  BACKUP_LEGAL_HOLD_TOGGLED: 'BACKUP_LEGAL_HOLD_TOGGLED',
  BACKUP_RESTORE_TEST_STARTED: 'BACKUP_RESTORE_TEST_STARTED',
  BACKUP_RESTORE_TEST_SUCCESS: 'BACKUP_RESTORE_TEST_SUCCESS',
  BACKUP_RESTORE_TEST_FAILED: 'BACKUP_RESTORE_TEST_FAILED',
  BACKUP_RESTORE_EXECUTED: 'BACKUP_RESTORE_EXECUTED',
  BACKUP_DISPOSED_SECURELY: 'BACKUP_DISPOSED_SECURELY',
} as const;
