import { apiRequest } from './api';

export interface BackupArchive {
  id: string;
  backupType: 'FULL' | 'INCREMENTAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'DISPOSED';
  filename: string;
  fileSizeBytes: number;
  plainChecksumSha256: string;
  encryptedChecksumSha256: string;
  primaryLocation: string;
  secondaryLocation?: string | null;
  offsiteLocation?: string | null;
  encryptionAlgorithm: string;
  isEncrypted: boolean;
  isImmutable: boolean;
  retentionLockUntil: string;
  legalHold: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  disposedAt?: string | null;
  parentBackupId?: string | null;
  restoreTests?: BackupRestoreTest[];
  disposalRecord?: BackupDisposalRecord | null;
}

export interface BackupRestoreTest {
  id: string;
  backupId: string;
  status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt?: string | null;
  actualRtoSeconds?: number | null;
  verifiedTableCount?: number | null;
  verifiedRowCount?: number | null;
  plainChecksumMatched: boolean;
  sandboxTargetSchema: string;
  errorMessage?: string | null;
  logs?: string | null;
}

export interface BackupDisposalRecord {
  id: string;
  backupId: string;
  disposedAt: string;
  disposedByUserId: string;
  disposalMethod: string;
  passesCompleted: number;
  certificateOfDestruction: any;
  reason: string;
}

export interface BackupMetrics {
  rpo: {
    full: {
      targetMinutes: number;
      actualAgeMinutes: number | null;
      isCompliant: boolean;
      lastBackupAt: string | null;
    };
    incremental: {
      targetMinutes: number;
      actualAgeMinutes: number | null;
      isCompliant: boolean;
      lastBackupAt: string | null;
    };
  };
  rto: {
    targetMinutes: number;
    targetSeconds: number;
    averageRecoverySeconds: number | null;
    maxRecoverySeconds: number | null;
    isCompliant: boolean;
    successfulTestsCount: number;
  };
  rule321: {
    activeArchivesCount: number;
    copiesPerBackup: number;
    mediaTypesCount: number;
    offsiteCopyRequired: boolean;
    status: string;
  };
  encryption: {
    algorithm: string;
    atRest: string;
    inTransit: string;
  };
}

export interface ListBackupsResponse {
  items: BackupArchive[];
  nextCursor?: string | null;
}

export interface CreateBackupDto {
  backupType?: 'FULL' | 'INCREMENTAL';
  note?: string;
  retentionDays?: number;
  rpoTargetMinutes?: number;
  rtoTargetMinutes?: number;
}

export interface RestoreTestDto {
  targetSandboxSchema?: string;
  verifyRowCounts?: boolean;
}

export interface UpdateImmutabilityDto {
  retentionLockUntil?: string;
  legalHold?: boolean;
  reason?: string;
}

export interface DisposeBackupDto {
  confirmationPhrase: string;
  reason: string;
}

export const backupsApi = {
  async getMetrics(): Promise<BackupMetrics> {
    return apiRequest<BackupMetrics>('/backups/metrics');
  },

  async listBackups(params?: {
    backupType?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListBackupsResponse> {
    const q = new URLSearchParams();
    if (params?.backupType && params.backupType !== 'ALL') q.set('backupType', params.backupType);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.cursor) q.set('cursor', params.cursor);

    const query = q.toString() ? `?${q.toString()}` : '';
    return apiRequest<ListBackupsResponse>(`/backups${query}`);
  },

  async getBackupById(id: string): Promise<BackupArchive> {
    return apiRequest<BackupArchive>(`/backups/${id}`);
  },

  async createBackup(dto: CreateBackupDto): Promise<BackupArchive> {
    return apiRequest<BackupArchive>('/backups', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async testRestoration(id: string, dto: RestoreTestDto): Promise<any> {
    return apiRequest(`/backups/${id}/restore-test`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async updateImmutability(id: string, dto: UpdateImmutabilityDto): Promise<BackupArchive> {
    return apiRequest<BackupArchive>(`/backups/${id}/immutability`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },

  async disposeBackup(id: string, dto: DisposeBackupDto): Promise<any> {
    return apiRequest(`/backups/${id}/dispose`, {
      method: 'DELETE',
      body: JSON.stringify(dto),
    });
  },

  async downloadBackup(id: string, filename: string): Promise<void> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const token = typeof window !== 'undefined' ? localStorage.getItem('news_share_admin_token') : null;

    const response = await fetch(`${API_BASE_URL}/backups/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download backup: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },
};
