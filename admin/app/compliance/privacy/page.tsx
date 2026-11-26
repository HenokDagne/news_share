'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  UserCheck,
  ShieldAlert,
  Database,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  AlertTriangle,
  Plus,
  Calendar,
  Lock,
  History,
  Trash2,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface PrivacyRequest {
  id: string;
  userId: string;
  requestType: 'DATA_ACCESS_EXPORT' | 'DATA_CORRECTION' | 'ACCOUNT_DELETION' | 'RESTRICT_PROCESSING';
  status: 'PENDING' | 'UNDER_REVIEW' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  details: string | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  scheduledDeletionAt: string | null;
  exportFileUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    profile: { username: string; fullName: string | null } | null;
  };
}

interface DataBreachRecord {
  id: string;
  title: string;
  incidentRef: string | null;
  severity: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';
  dataCategories: string[];
  estimatedUsersHit: number;
  detectedAt: string;
  containedAt: string | null;
  authorityNotified: boolean;
  authorityNotifiedAt: string | null;
  usersNotified: boolean;
  remediationSummary: string;
  createdAt: string;
}

interface UserInGrace {
  id: string;
  email: string;
  username: string;
  scheduledDeletionAt: string;
  daysRemaining: number;
}

interface RetentionMetrics {
  retentionSchedules: number;
  pendingGracePeriodDeletions: number;
  readyForPurge: number;
  usersInGracePeriod: UserInGrace[];
}

interface PrivacyAuditLog {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  userEmail?: string;
  targetId: string;
  details: any;
  timestamp: string;
}

export default function PrivacyAndDataProtectionPage() {
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'BREACHES' | 'RETENTION' | 'AUDIT'>('REQUESTS');

  // Requests state
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestFilter, setRequestFilter] = useState('ALL');

  // Breaches state
  const [breaches, setBreaches] = useState<DataBreachRecord[]>([]);
  const [isLoadingBreaches, setIsLoadingBreaches] = useState(true);

  // Retention state
  const [retentionMetrics, setRetentionMetrics] = useState<RetentionMetrics | null>(null);
  const [isLoadingRetention, setIsLoadingRetention] = useState(false);
  const [isProcessingPurge, setIsProcessingPurge] = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<PrivacyAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Modals
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PrivacyRequest | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'COMPLETED' | 'REJECTED'>('COMPLETED');
  const [resolveRejectionReason, setResolveRejectionReason] = useState('');
  const [isBreachModalOpen, setIsBreachModalOpen] = useState(false);

  // Breach Form
  const [breachTitle, setBreachTitle] = useState('');
  const [breachSeverity, setBreachSeverity] = useState<'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM'>('P2_HIGH');
  const [breachCategories, setBreachCategories] = useState('USER_CREDENTIALS, EMAILS');
  const [breachUsersHit, setBreachUsersHit] = useState(0);
  const [breachDetectedAt, setBreachDetectedAt] = useState(new Date().toISOString().split('T')[0]);
  const [breachAuthorityNotified, setBreachAuthorityNotified] = useState(true);
  const [breachUsersNotified, setBreachUsersNotified] = useState(false);
  const [breachRemediation, setBreachRemediation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const data = await apiRequest<PrivacyRequest[]>('/admin/governance/privacy/requests');
      setRequests(data);
    } catch (err) {
      console.error('Failed to load privacy requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchBreaches = useCallback(async () => {
    setIsLoadingBreaches(true);
    try {
      const data = await apiRequest<DataBreachRecord[]>('/admin/governance/privacy/breaches');
      setBreaches(data);
    } catch (err) {
      console.error('Failed to load breach records:', err);
    } finally {
      setIsLoadingBreaches(false);
    }
  }, []);

  const fetchRetentionMetrics = useCallback(async () => {
    setIsLoadingRetention(true);
    try {
      const data = await apiRequest<RetentionMetrics>('/admin/governance/privacy/retention/metrics');
      setRetentionMetrics(data);
    } catch (err) {
      console.error('Failed to load retention metrics:', err);
    } finally {
      setIsLoadingRetention(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const data = await apiRequest<PrivacyAuditLog[]>('/admin/governance/privacy/audit-monitoring');
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to load privacy audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchBreaches();
  }, [fetchRequests, fetchBreaches]);

  useEffect(() => {
    if (activeTab === 'RETENTION') {
      fetchRetentionMetrics();
    } else if (activeTab === 'AUDIT') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchRetentionMetrics, fetchAuditLogs]);

  const handleOpenResolve = (r: PrivacyRequest) => {
    setSelectedRequest(r);
    setResolveStatus('COMPLETED');
    setResolveRejectionReason('');
    setIsResolveModalOpen(true);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/governance/privacy/requests/${selectedRequest.id}`, {
        method: 'PATCH',
        body: {
          status: resolveStatus,
          rejectionReason: resolveStatus === 'REJECTED' ? resolveRejectionReason : undefined,
        },
      });
      setIsResolveModalOpen(false);
      fetchRequests();
    } catch (err) {
      alert('Failed to resolve request: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessDeletions = async () => {
    const confirmed = confirm(
      'Are you sure you want to run the scheduled account deletion purge? Any accounts past their 30-day grace period will be permanently erased.'
    );
    if (!confirmed) return;

    setIsProcessingPurge(true);
    try {
      const result = await apiRequest<any>('/admin/governance/privacy/retention/process-deletions', {
        method: 'POST',
      });
      alert(`Purge completed: ${result.deletedCount || 0} expired accounts permanently anonymized.`);
      fetchRetentionMetrics();
    } catch (err) {
      alert('Failed to process scheduled deletions: ' + String(err));
    } finally {
      setIsProcessingPurge(false);
    }
  };

  const handleBreachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cats = breachCategories
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      await apiRequest('/admin/governance/privacy/breaches', {
        method: 'POST',
        body: {
          title: breachTitle,
          severity: breachSeverity,
          dataCategories: cats,
          estimatedUsersHit: Number(breachUsersHit) || 0,
          detectedAt: new Date(breachDetectedAt).toISOString(),
          authorityNotified: breachAuthorityNotified,
          authorityNotifiedAt: breachAuthorityNotified ? new Date().toISOString() : undefined,
          usersNotified: breachUsersNotified,
          remediationSummary: breachRemediation,
        },
      });
      setIsBreachModalOpen(false);
      fetchBreaches();
    } catch (err) {
      alert('Failed to record breach: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (requestFilter === 'ALL') return true;
    return r.status === requestFilter;
  });

  return (
    <AdminShell
      title="Privacy & Data Protection"
      subtitle="Data subject rights (Proclamation 1321/2024), breach records, retention schedules, and consent audit"
      actions={
        activeTab === 'BREACHES' ? (
          <button
            onClick={() => setIsBreachModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Log Data Breach
          </button>
        ) : activeTab === 'RETENTION' ? (
          <button
            onClick={handleProcessDeletions}
            disabled={isProcessingPurge}
            className="flex items-center gap-2 rounded-xl bg-[#232733] border border-[#FE2C55]/40 px-4 py-2 text-xs font-bold text-[#FE2C55] hover:bg-[#FE2C55]/10 disabled:opacity-50 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            {isProcessingPurge ? 'Processing...' : 'Run Scheduled Purge'}
          </button>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#232733] gap-6 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'REQUESTS'
                ? 'border-[#00F2FE] text-[#00F2FE]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Data Subject Requests ({requests.filter((r) => r.status === 'PENDING').length} Pending)
          </button>
          <button
            onClick={() => setActiveTab('BREACHES')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'BREACHES'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Data Breach Register ({breaches.length})
          </button>
          <button
            onClick={() => setActiveTab('RETENTION')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'RETENTION'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Database className="h-4 w-4" />
            Retention & Grace Periods
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'AUDIT'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <History className="h-4 w-4" />
            Privacy & Consent Audit
          </button>
        </div>

        {/* TAB 1: DATA SUBJECT REQUESTS */}
        {activeTab === 'REQUESTS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-gray-400">
                Filter by processing status:
              </span>
              <div className="flex gap-2 flex-wrap">
                {['ALL', 'PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setRequestFilter(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      requestFilter === st
                        ? 'bg-[#00F2FE]/20 text-[#00F2FE] border border-[#00F2FE]/40'
                        : 'bg-[#181B22] text-gray-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">User / Data Subject</th>
                    <th className="px-5 py-3.5">Request Type</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Date Submitted</th>
                    <th className="px-5 py-3.5">Details</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232733]">
                  {isLoadingRequests ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        Loading privacy requests...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No privacy requests matching status filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[#181B22]/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-sm">
                            {req.user?.profile?.username || 'user'}
                          </div>
                          <div className="text-gray-400 text-[11px] font-mono">{req.user?.email}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-block rounded-md bg-[#232733] px-2 py-0.5 text-[11px] font-semibold text-[#00F2FE]">
                            {req.requestType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              req.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : req.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : req.status === 'CANCELLED'
                                ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-gray-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-gray-400 text-[11px] max-w-xs">
                          <div className="truncate">{req.details || 'Standard subject request'}</div>
                          {req.cancelReason && (
                            <div className="text-gray-500 text-[10px] mt-0.5 italic">
                              Cancellation: {req.cancelReason}
                            </div>
                          )}
                          {req.rejectionReason && (
                            <div className="text-rose-400 text-[10px] mt-0.5">
                              Rejected: {req.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {req.status === 'PENDING' ? (
                            <button
                              onClick={() => handleOpenResolve(req)}
                              className="rounded-xl bg-gradient-to-r from-[#00F2FE]/20 to-[#FE2C55]/20 border border-[#00F2FE]/40 px-3 py-1.5 text-xs font-bold text-[#00F2FE] hover:bg-[#00F2FE]/30 transition-all"
                            >
                              Resolve Request
                            </button>
                          ) : req.exportFileUrl ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3 w-3" />
                              Export Dispatched
                            </span>
                          ) : (
                            <span className="text-gray-500 text-[11px]">
                              {req.status === 'CANCELLED' ? 'Withdrawn' : 'Processed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DATA BREACH REGISTER */}
        {activeTab === 'BREACHES' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-300 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold">Statutory Notice Requirement: </span>
                Under Article 33 of the Ethiopian Personal Data Protection Proclamation No. 1321/2024, personal data breaches posing risk to data subjects must be reported to the supervisory authority within 72 hours of detection.
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Breach Event Title</th>
                    <th className="px-5 py-3.5">Severity</th>
                    <th className="px-5 py-3.5">Exposed Data Categories</th>
                    <th className="px-5 py-3.5">Estimated Users Hit</th>
                    <th className="px-5 py-3.5">Authority Notified</th>
                    <th className="px-5 py-3.5">Detection Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232733]">
                  {isLoadingBreaches ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        Loading breach records...
                      </td>
                    </tr>
                  ) : breaches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No security or personal data breach events recorded. (Clean posture)
                      </td>
                    </tr>
                  ) : (
                    breaches.map((b) => (
                      <tr key={b.id} className="hover:bg-[#181B22]/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-sm">{b.title}</div>
                          <div className="text-gray-400 text-[11px] mt-1">{b.remediationSummary}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-block rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                            {b.severity}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {b.dataCategories.map((c) => (
                              <span key={c} className="rounded bg-[#232733] px-1.5 py-0.5 text-[10px] text-gray-300">
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-white">
                          {b.estimatedUsersHit.toLocaleString()} users
                        </td>
                        <td className="px-5 py-4">
                          {b.authorityNotified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3 w-3" />
                              Notified (72h compliant)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                              <Clock className="h-3 w-3" />
                              Internal Assessment
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-gray-400">
                          {new Date(b.detectedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DATA RETENTION & GRACE PERIODS */}
        {activeTab === 'RETENTION' && (
          <div className="space-y-6">
            {/* Live Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5">
                <div className="text-xs text-gray-400 font-semibold uppercase">Retention Schedules</div>
                <div className="mt-2 text-2xl font-bold font-mono text-[#00F2FE]">
                  {retentionMetrics?.retentionSchedules ?? 4} Policies
                </div>
                <div className="mt-1 text-[11px] text-gray-500">NIST SP 800-88, 30d Grace, WORM Backups</div>
              </div>

              <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5">
                <div className="text-xs text-gray-400 font-semibold uppercase">30-Day Deletion Grace Queue</div>
                <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
                  {retentionMetrics?.pendingGracePeriodDeletions ?? 0} Accounts
                </div>
                <div className="mt-1 text-[11px] text-gray-500">Soft-deleted, cancellable before purge</div>
              </div>

              <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5">
                <div className="text-xs text-gray-400 font-semibold uppercase">Past Grace & Ready For Purge</div>
                <div className="mt-2 text-2xl font-bold font-mono text-[#FE2C55]">
                  {retentionMetrics?.readyForPurge ?? 0} Accounts
                </div>
                <div className="mt-1 text-[11px] text-gray-500">Eligible for permanent cryptographic erasure</div>
              </div>
            </div>

            {/* Grace Period Accounts Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Accounts in 30-Day Deletion Grace Period
                </h3>
                <button
                  onClick={fetchRetentionMetrics}
                  className="text-xs text-[#00F2FE] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-5 py-3.5">User</th>
                      <th className="px-5 py-3.5">Email</th>
                      <th className="px-5 py-3.5">Scheduled Deletion</th>
                      <th className="px-5 py-3.5">Grace Remaining</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232733]">
                    {isLoadingRetention ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          Loading retention queue...
                        </td>
                      </tr>
                    ) : !retentionMetrics?.usersInGracePeriod?.length ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No user accounts currently in the 30-day deletion grace period.
                        </td>
                      </tr>
                    ) : (
                      retentionMetrics.usersInGracePeriod.map((u) => (
                        <tr key={u.id} className="hover:bg-[#181B22]/40 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-white">@{u.username}</td>
                          <td className="px-5 py-3.5 font-mono text-gray-400">{u.email}</td>
                          <td className="px-5 py-3.5 font-mono text-gray-400">
                            {new Date(u.scheduledDeletionAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`font-mono font-bold ${
                                u.daysRemaining <= 0
                                  ? 'text-rose-400'
                                  : u.daysRemaining <= 5
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {u.daysRemaining <= 0 ? 'Grace Expired' : `${u.daysRemaining} days left`}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                u.daysRemaining <= 0
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {u.daysRemaining <= 0 ? 'PENDING PURGE' : 'ACTIVE GRACE'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Retention Policies Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: 'Security Audit & Activity Logs',
                  period: '365 Days',
                  disposal: 'NIST SP 800-88 Cryptographic Shredding',
                  legalBasis: 'Proclamation No. 958/2016 (Computer Crime) & Proclamation No. 1321/2024',
                  description: 'Append-only cryptographically chained event telemetry is preserved for 1 year before automatic purge.',
                },
                {
                  title: 'Deleted User Accounts (Soft-Delete Grace)',
                  period: '30 Days',
                  disposal: 'Permanent Hard Cascade Deletion',
                  legalBasis: 'Right of Erasure / Right to be Forgotten',
                  description: 'User profile, credentials, and media enter a 30-day soft-delete grace period before permanent erasure.',
                },
                {
                  title: 'Unverified Registration Tokens',
                  period: '7 Days',
                  disposal: 'Scheduled Background Cleanup',
                  legalBasis: 'Data Minimization Principle',
                  description: 'Unverified emails and expired password reset one-time tokens are discarded automatically after 7 days.',
                },
                {
                  title: 'Encrypted Database Backup Snapshots',
                  period: '30 Days',
                  disposal: 'WORM (Write Once Read Many) Storage Expiration',
                  legalBasis: 'Business Continuity & Disaster Recovery',
                  description: 'Encrypted AES-256-GCM backup archives are retained for 30 daily cycles with verification restore tests.',
                },
              ].map((policy, idx) => (
                <div key={idx} className="rounded-2xl border border-[#232733] bg-[#12141A] p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[#00F2FE]" />
                      {policy.title}
                    </h4>
                    <span className="rounded-md bg-[#232733] px-2 py-0.5 text-xs font-mono font-bold text-[#00F2FE]">
                      {policy.period}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">{policy.description}</p>
                  <div className="mt-4 pt-3 border-t border-[#232733] flex flex-col gap-1 text-[11px]">
                    <span className="text-gray-500">Disposal Method: <span className="text-gray-300">{policy.disposal}</span></span>
                    <span className="text-gray-500">Statutory Ground: <span className="text-gray-300 font-mono text-[10px]">{policy.legalBasis}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PRIVACY & CONSENT AUDIT */}
        {activeTab === 'AUDIT' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Cryptographically tracked data privacy actions, consent updates, and export logs.
              </span>
              <button
                onClick={fetchAuditLogs}
                className="text-xs text-[#00F2FE] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Refresh Logs
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Action Event</th>
                    <th className="px-5 py-3.5">Actor / Subject</th>
                    <th className="px-5 py-3.5">Purpose / Target</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-5 py-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232733]">
                  {isLoadingAudit ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        Loading privacy audit logs...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        No privacy audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#181B22]/40 transition-colors">
                        <td className="px-5 py-4">
                          <span className="inline-block rounded-md bg-[#232733] px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-xs">
                            {log.userEmail || log.actorId}
                          </div>
                          <div className="text-gray-500 text-[10px] font-mono">{log.actorType}</div>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-gray-300">
                          {log.details?.purpose || log.targetId || 'N/A'}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-gray-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right text-gray-400 text-[11px] max-w-xs truncate">
                          {JSON.stringify(log.details || {})}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Resolve Privacy Request */}
        {isResolveModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#00F2FE]" />
                  Fulfill Privacy Request
                </h3>
                <button onClick={() => setIsResolveModalOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleResolveSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Decision Outcome *</label>
                  <select
                    value={resolveStatus}
                    onChange={(e) => setResolveStatus(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  >
                    <option value="COMPLETED">Fulfill & Complete Request</option>
                    <option value="REJECTED">Reject Request</option>
                  </select>
                </div>

                {resolveStatus === 'REJECTED' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Rejection Justification *</label>
                    <textarea
                      required
                      rows={3}
                      value={resolveRejectionReason}
                      onChange={(e) => setResolveRejectionReason(e.target.value)}
                      placeholder="Statutory exemption or reason why request cannot be fulfilled..."
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsResolveModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Recording...' : 'Confirm Resolution'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Log Breach */}
        {isBreachModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  Log Personal Data Breach Event
                </h3>
                <button onClick={() => setIsBreachModalOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleBreachSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Incident Event Title *</label>
                  <input
                    type="text"
                    required
                    value={breachTitle}
                    onChange={(e) => setBreachTitle(e.target.value)}
                    placeholder="e.g. Unauthorized credential enumeration on auth endpoint"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Severity Level</label>
                    <select
                      value={breachSeverity}
                      onChange={(e) => setBreachSeverity(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="P1_CRITICAL">P1 - Critical</option>
                      <option value="P2_HIGH">P2 - High</option>
                      <option value="P3_MEDIUM">P3 - Medium</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Estimated Users Affected</label>
                    <input
                      type="number"
                      min={0}
                      value={breachUsersHit}
                      onChange={(e) => setBreachUsersHit(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Data Categories (comma-separated) *</label>
                  <input
                    type="text"
                    required
                    value={breachCategories}
                    onChange={(e) => setBreachCategories(e.target.value)}
                    placeholder="EMAILS, USER_PASSWORDS, PROFILE_PHOTOS"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Detection Date *</label>
                  <input
                    type="date"
                    required
                    value={breachDetectedAt}
                    onChange={(e) => setBreachDetectedAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Remediation & Containment Actions *</label>
                  <textarea
                    required
                    rows={3}
                    value={breachRemediation}
                    onChange={(e) => setBreachRemediation(e.target.value)}
                    placeholder="Containment steps taken, API keys rotated, affected tokens invalidated..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsBreachModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Logging...' : 'Log Breach to Audit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
