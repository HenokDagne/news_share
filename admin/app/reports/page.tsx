'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Flag,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  ShieldAlert,
  User,
  FileText,
  AlertTriangle,
  Gavel,
  History,
  X,
} from 'lucide-react';

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get('caseId');

  const { user: currentStaff, hasPermission } = useAuth();

  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Review Studio Drawer
  const [activeCase, setActiveCase] = useState<any | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Decision Form State
  const [outcome, setOutcome] = useState<'ACTION' | 'DISMISS' | 'RESOLVE'>('ACTION');
  const [decisionNote, setDecisionNote] = useState('');
  const [policyRef, setPolicyRef] = useState('HARASS-2');
  const [publicReason, setPublicReason] = useState('Violation of platform community standards');

  // Actions
  const [actionRemovePost, setActionRemovePost] = useState(true);
  const [actionWarnUser, setActionWarnUser] = useState(false);
  const [actionSuspendUser, setActionSuspendUser] = useState(false);
  const [actionBanUser, setActionBanUser] = useState(false);
  const [suspendDays, setSuspendDays] = useState(7);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (statusFilter) q.set('status', statusFilter);
      if (priorityFilter) q.set('priority', priorityFilter);
      if (targetTypeFilter) q.set('targetType', targetTypeFilter);
      if (search.trim()) q.set('q', search.trim());

      const res = await apiRequest<{ items?: any[]; data?: any[]; total: number }>(
        `/admin/report-cases?${q.toString()}`,
      );
      setCases(res.items || res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load report cases:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, priorityFilter, targetTypeFilter, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const loadCaseDetail = async (id: string) => {
    setReviewLoading(true);
    try {
      const data = await apiRequest(`/admin/report-cases/${id}`);
      setActiveCase(data);
      // Pre-select removal if it's a post
      setActionRemovePost(data.targetType === 'POST');
    } catch (err: any) {
      alert(`Failed to load case: ${err.message}`);
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    if (initialCaseId) {
      loadCaseDetail(initialCaseId);
    }
  }, [initialCaseId]);

  const handleClaim = async () => {
    if (!activeCase) return;
    try {
      await apiRequest(`/admin/report-cases/${activeCase.id}/claim`, { method: 'POST' });
      loadCaseDetail(activeCase.id);
      fetchCases();
    } catch (err: any) {
      alert(`Claim failed: ${err.message}`);
    }
  };

  const handleReopen = async () => {
    if (!activeCase) return;
    try {
      await apiRequest(`/admin/report-cases/${activeCase.id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Reopened for additional review' }),
      });
      loadCaseDetail(activeCase.id);
      fetchCases();
    } catch (err: any) {
      alert(`Reopen failed: ${err.message}`);
    }
  };

  const submitDecision = async () => {
    if (!activeCase) return;
    if (decisionNote.trim().length < 10) {
      alert('Internal documentation note must be at least 10 characters.');
      return;
    }

    setSubmittingDecision(true);
    try {
      const actionsList: any[] = [];
      if (outcome === 'ACTION') {
        if (actionRemovePost && activeCase.targetType === 'POST') {
          actionsList.push({
            type: 'REMOVE_POST',
            publicReason: publicReason.trim(),
          });
        }
        if (actionWarnUser) {
          actionsList.push({
            type: 'WARN_USER',
            message: publicReason.trim(),
          });
        }
        if (actionSuspendUser) {
          actionsList.push({
            type: 'SUSPEND_USER',
            durationDays: Number(suspendDays),
            publicReason: publicReason.trim(),
            evidenceRef: `case:${activeCase.id}`,
          });
        }
        if (actionBanUser) {
          actionsList.push({
            type: 'BAN_USER',
            publicReason: publicReason.trim(),
            evidenceRef: `case:${activeCase.id}`,
          });
        }
      }

      await apiRequest(`/admin/report-cases/${activeCase.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          outcome,
          note: decisionNote.trim(),
          policyRef,
          actions: actionsList,
        }),
      });

      alert('Decision applied successfully and audited.');
      setActiveCase(null);
      fetchCases();
    } catch (err: any) {
      alert(`Decision failed: ${err.message}`);
    } finally {
      setSubmittingDecision(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <AdminShell
      title="Incident Reports & Case Management"
      subtitle="Advisory prioritization queue and Review Studio for reported content"
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#232733] bg-[#12141A] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by target user or case ID..."
                className="w-full rounded-xl border border-[#232733] bg-[#181B22] pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00F2FE] focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="ACTION_TAKEN">ACTION_TAKEN</option>
              <option value="REJECTED">REJECTED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            <select
              value={targetTypeFilter}
              onChange={(e) => {
                setTargetTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Targets</option>
              <option value="POST">POST</option>
              <option value="USER">USER</option>
            </select>
          </div>
        </div>

        {/* Reports Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Priority</th>
                  <th className="px-5 py-3.5 font-semibold">Target</th>
                  <th className="px-5 py-3.5 font-semibold">Target User</th>
                  <th className="px-5 py-3.5 font-semibold">Top Reason</th>
                  <th className="px-5 py-3.5 font-semibold">Reports</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Last Reported</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
                    </td>
                  </tr>
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No report cases matching criteria.
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[#181B22]/60 transition-colors cursor-pointer"
                      onClick={() => loadCaseDetail(c.id)}
                    >
                      <td className="px-5 py-3.5">
                        <PriorityBadge priority={c.priorityScore} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 font-semibold text-white">
                          {c.targetType === 'POST' ? (
                            <FileText className="h-3.5 w-3.5 text-blue-400" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-purple-400" />
                          )}
                          {c.targetType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-300">
                        {c.targetUser?.username || c.targetUserId?.substring(0, 8)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded bg-[#232733] px-2 py-0.5 text-[11px] text-gray-200">
                          {c.topReason || 'GENERAL'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-rose-400">
                        {c.reportCount}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {new Date(c.lastReportedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadCaseDetail(c.id);
                          }}
                          className="rounded-lg bg-[#232733] px-3 py-1 text-xs font-semibold text-white hover:bg-[#00F2FE] hover:text-black transition-colors"
                        >
                          Review Studio
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#232733] bg-[#181B22] px-5 py-3 text-xs text-gray-400">
            <span>
              Showing page {page} of {totalPages} ({total} cases)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#232733] bg-[#12141A] px-3 py-1 font-medium text-white hover:bg-[#232733] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-[#232733] bg-[#12141A] px-3 py-1 font-medium text-white hover:bg-[#232733] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Case Review Studio Drawer */}
      {activeCase && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-[#232733] bg-[#12141A] p-7 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#232733] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={activeCase.priorityScore} />
                  <StatusBadge status={activeCase.status} />
                  <span className="font-mono text-xs text-gray-500">
                    ID: {activeCase.id}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-extrabold text-white">
                  Review Case: {activeCase.targetType} Target
                </h3>
                <p className="text-xs text-gray-400">
                  {activeCase.reportCount} reports submitted • First: {new Date(activeCase.firstReportedAt).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => setActiveCase(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-[#181B22] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="mt-4 flex items-center gap-3">
              {activeCase.status === 'PENDING' && (
                <button
                  onClick={handleClaim}
                  className="rounded-xl bg-[#00F2FE] px-4 py-2 text-xs font-bold text-black hover:bg-[#25F4EE]"
                >
                  Claim Case & Lock
                </button>
              )}
              {(activeCase.status === 'ACTION_TAKEN' ||
                activeCase.status === 'REJECTED' ||
                activeCase.status === 'RESOLVED') && (
                <button
                  onClick={handleReopen}
                  className="rounded-xl border border-[#232733] bg-[#181B22] px-4 py-2 text-xs font-semibold text-white hover:bg-[#232733]"
                >
                  Reopen Case
                </button>
              )}
            </div>

            <div className="mt-6 space-y-6">
              {/* Evidence Snapshot */}
              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Reported Content Snapshot (Immutable Evidence)
                </h4>
                <div className="mt-3 rounded-lg border border-[#232733] bg-[#0A0B0E] p-4 text-xs">
                  {activeCase.snapshot ? (
                    <div>
                      {activeCase.snapshot.title && (
                        <h5 className="text-sm font-bold text-white mb-2">
                          {activeCase.snapshot.title}
                        </h5>
                      )}
                      {activeCase.snapshot.content && (
                        <p className="text-gray-300 whitespace-pre-wrap">
                          {activeCase.snapshot.content}
                        </p>
                      )}
                      {activeCase.snapshot.imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-[#232733]">
                          <img
                            src={activeCase.snapshot.imageUrl}
                            alt="Evidence media"
                            className="max-h-60 w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">No snapshot recorded.</p>
                  )}
                </div>
              </div>

              {/* Target User Info & Infraction History */}
              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Target Account Standing
                </h4>
                <div className="mt-2 text-xs">
                  <span className="font-semibold text-white">
                    @{activeCase.targetUser?.username}
                  </span>
                  <span className="ml-2 text-gray-400">
                    Status: {activeCase.targetUser?.status}
                  </span>
                  <p className="mt-1 text-gray-400">
                    Prior Cases Decided Against User:{' '}
                    <strong className="text-rose-400">
                      {activeCase.priorCasesCount ?? 0}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Individual Reports Breakdown */}
              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Filed Reports ({activeCase.reports?.length || 0})
                </h4>
                <div className="mt-3 space-y-2.5">
                  {activeCase.reports?.map((r: any) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-[#232733] bg-[#12141A] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-rose-950/60 text-rose-300 border border-rose-800/60 px-2 py-0.5 text-[10px] font-bold">
                          {r.reason}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {r.details && (
                        <p className="mt-2 text-gray-300 font-sans italic">
                          &quot;{r.details}&quot;
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-gray-500">
                        Reporter: {r.reporter?.username || 'Confidential'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Panel */}
              {hasPermission('REPORTS_MODERATE') && (
                <div className="rounded-xl border border-[#00F2FE]/30 bg-[#181B22] p-5 shadow-lg">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-[#00F2FE]" />
                    Execute Moderation Decision
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Decisions are committed atomically and logged in the immutable audit trail.
                  </p>

                  <div className="mt-4 space-y-4">
                    {/* Outcome Radio */}
                    <div className="flex gap-4">
                      {(['ACTION', 'DISMISS', 'RESOLVE'] as const).map((opt) => (
                        <label
                          key={opt}
                          className={`flex-1 cursor-pointer rounded-xl border p-3 text-center text-xs font-bold transition-all ${
                            outcome === opt
                              ? 'border-[#00F2FE] bg-[#00F2FE]/15 text-white'
                              : 'border-[#232733] bg-[#12141A] text-gray-400 hover:text-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="outcome"
                            value={opt}
                            checked={outcome === opt}
                            onChange={() => setOutcome(opt)}
                            className="sr-only"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>

                    {outcome === 'ACTION' && (
                      <div className="rounded-lg border border-[#232733] bg-[#12141A] p-4 space-y-3 text-xs">
                        <span className="font-semibold text-gray-300">Sanctions to Apply:</span>
                        {activeCase.targetType === 'POST' && (
                          <label className="flex items-center gap-2 cursor-pointer text-white">
                            <input
                              type="checkbox"
                              checked={actionRemovePost}
                              onChange={(e) => setActionRemovePost(e.target.checked)}
                              className="rounded border-[#232733] bg-[#181B22] text-[#00F2FE]"
                            />
                            <span>Remove Post from Public Platform (Keep Media Evidence)</span>
                          </label>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer text-white">
                          <input
                            type="checkbox"
                            checked={actionWarnUser}
                            onChange={(e) => setActionWarnUser(e.target.checked)}
                            className="rounded border-[#232733] bg-[#181B22] text-[#00F2FE]"
                          />
                          <span>Send Formal Warning to User</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-white">
                          <input
                            type="checkbox"
                            checked={actionSuspendUser}
                            onChange={(e) => {
                              setActionSuspendUser(e.target.checked);
                              if (e.target.checked) setActionBanUser(false);
                            }}
                            className="rounded border-[#232733] bg-[#181B22] text-[#00F2FE]"
                          />
                          <span>Temporary Suspension</span>
                        </label>
                        {actionSuspendUser && (
                          <div className="pl-6">
                            <label className="text-[11px] text-gray-400">Suspension Duration</label>
                            <select
                              value={suspendDays}
                              onChange={(e) => setSuspendDays(Number(e.target.value))}
                              className="mt-1 w-full rounded border border-[#232733] bg-[#181B22] px-2 py-1.5 text-xs text-white"
                            >
                              <option value={1}>1 Day</option>
                              <option value={7}>7 Days</option>
                              <option value={14}>14 Days</option>
                              <option value={30}>30 Days</option>
                            </select>
                          </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer text-rose-400">
                          <input
                            type="checkbox"
                            checked={actionBanUser}
                            onChange={(e) => {
                              setActionBanUser(e.target.checked);
                              if (e.target.checked) setActionSuspendUser(false);
                            }}
                            className="rounded border-[#232733] bg-[#181B22] text-rose-500"
                          />
                          <span>Permanent Ban</span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-gray-300">Policy Reference</label>
                      <input
                        type="text"
                        value={policyRef}
                        onChange={(e) => setPolicyRef(e.target.value)}
                        placeholder="e.g. HARASS-2, HATE-1, VIOLENCE-1"
                        className="mt-1 w-full rounded-lg border border-[#232733] bg-[#12141A] px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-300">Public User Notice</label>
                      <input
                        type="text"
                        value={publicReason}
                        onChange={(e) => setPublicReason(e.target.value)}
                        placeholder="Visible to user in notification..."
                        className="mt-1 w-full rounded-lg border border-[#232733] bg-[#12141A] px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-300">
                        Internal Staff Note (Audit Record, min 10 chars)
                      </label>
                      <textarea
                        rows={2}
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Document justification and report findings..."
                        className="mt-1 w-full rounded-lg border border-[#232733] bg-[#12141A] px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <button
                      onClick={submitDecision}
                      disabled={submittingDecision}
                      className="w-full rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#25F4EE] py-3 text-xs font-bold text-black hover:opacity-90 transition-all disabled:opacity-40"
                    >
                      {submittingDecision ? 'Executing Decision...' : 'Commit Moderation Decision'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0B0E]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
        </div>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
