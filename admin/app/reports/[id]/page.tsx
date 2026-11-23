'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  FileText,
  User,
  ShieldAlert,
  AlertTriangle,
  Gavel,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
  History,
  Lock,
  RotateCcw,
  Flag,
  Info,
  Shield,
  EyeOff,
  UserX,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params?.id as string;

  const { user: currentStaff, hasPermission } = useAuth();

  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decision Form State
  const [outcome, setOutcome] = useState<'ACTION' | 'DISMISS' | 'RESOLVE'>('ACTION');
  const [decisionNote, setDecisionNote] = useState('');
  const [policyRef, setPolicyRef] = useState('COMMUNITY-STANDARDS-V1');
  const [publicReason, setPublicReason] = useState('Violation of platform community guidelines');

  // Selected Actions
  const [actionRemovePost, setActionRemovePost] = useState(true);
  const [actionWarnUser, setActionWarnUser] = useState(false);
  const [actionSuspendUser, setActionSuspendUser] = useState(false);
  const [actionBanUser, setActionBanUser] = useState(false);
  const [suspendDays, setSuspendDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Individual Reports Table Pagination (5 reports per page)
  const [reportPage, setReportPage] = useState(1);
  const REPORT_PAGE_SIZE = 5;

  const fetchCaseDetail = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/admin/report-cases/${caseId}`);
      setData(res);
      setActionRemovePost(res.targetType === 'POST');
    } catch (err: any) {
      console.error('Failed to load report case detail:', err);
      setError(err.message || 'Failed to load report details');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCaseDetail();
  }, [fetchCaseDetail]);

  const handleClaim = async () => {
    try {
      await apiRequest(`/admin/report-cases/${caseId}/claim`, { method: 'POST' });
      fetchCaseDetail();
    } catch (err: any) {
      alert(`Claim failed: ${err.message}`);
    }
  };

  const handleReopen = async () => {
    try {
      await apiRequest(`/admin/report-cases/${caseId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Reopened for additional administrative review' }),
      });
      fetchCaseDetail();
    } catch (err: any) {
      alert(`Reopen failed: ${err.message}`);
    }
  };

  const handleExecuteDecisionClick = () => {
    if (decisionNote.trim().length < 10) {
      alert('Internal documentation note must be at least 10 characters long to document administrative rationale.');
      return;
    }

    if (outcome === 'ACTION' && (actionRemovePost || actionSuspendUser || actionBanUser)) {
      setIsConfirmOpen(true);
    } else {
      executeDecision();
    }
  };

  const executeDecision = async () => {
    setIsSubmitting(true);
    setIsConfirmOpen(false);
    try {
      const actionsList: any[] = [];
      if (outcome === 'ACTION') {
        if (actionRemovePost && data?.targetType === 'POST') {
          actionsList.push({
            type: 'REMOVE_POST',
            publicReason: publicReason.trim() || 'Post removed for guideline violation',
          });
        }
        if (actionWarnUser) {
          actionsList.push({
            type: 'WARN_USER',
            message: publicReason.trim() || 'Formal administrative warning issued',
          });
        }
        if (actionSuspendUser) {
          actionsList.push({
            type: 'SUSPEND_USER',
            durationDays: Number(suspendDays),
            publicReason: publicReason.trim() || `Account suspended for ${suspendDays} days`,
            evidenceRef: `case:${caseId}`,
          });
        }
        if (actionBanUser) {
          actionsList.push({
            type: 'BAN_USER',
            publicReason: publicReason.trim() || 'Account permanently banned due to severe community violation',
            evidenceRef: `case:${caseId}`,
          });
        }
      }

      await apiRequest(`/admin/report-cases/${caseId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          outcome,
          note: decisionNote.trim(),
          policyRef,
          actions: actionsList,
        }),
      });

      alert('Moderation decision successfully applied and recorded to the immutable audit trail.');
      fetchCaseDetail();
    } catch (err: any) {
      alert(`Failed to apply decision: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminShell title="Report Detail Page" subtitle="Loading target case dossier...">
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
            <p className="text-sm text-gray-400">Loading case dossier and individual reports...</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (error || !data) {
    return (
      <AdminShell title="Report Detail Page" subtitle="Error loading report">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-bold text-white">Report Case Not Found</h3>
          <p className="mt-2 text-sm text-gray-400">{error || 'Could not retrieve report dossier.'}</p>
          <Link
            href="/reports"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#232733] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00F2FE] hover:text-black transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Report Page
          </Link>
        </div>
      </AdminShell>
    );
  }

  const reportsList = data.reports || [];
  const totalReportPages = Math.ceil(reportsList.length / REPORT_PAGE_SIZE) || 1;
  const paginatedReports = reportsList.slice((reportPage - 1) * REPORT_PAGE_SIZE, reportPage * REPORT_PAGE_SIZE);
  const targetUser = data.targetUser || {};
  const targetProfile = targetUser.profile || (data.snapshot as any)?.author || {};
  const targetPost = data.targetPost || (data.targetType === 'POST' ? data.snapshot : null);
  const reasonsBreakdown = data.reasonsBreakdown || [];
  const totalReports = data.totalReportsCount || data.reportCount || reportsList.length;
  const isClosed = data.status === 'ACTION_TAKEN' || data.status === 'REJECTED' || data.status === 'RESOLVED';

  return (
    <AdminShell
      title="Report Review & Moderation Studio"
      subtitle={`Dossier for ${data.targetType} target: ${data.targetKey}`}
    >
      <div className="space-y-6 pb-12">
        {/* Navigation Bar & Status Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#232733] bg-[#12141A] p-5 lg:flex-row lg:items-center lg:justify-between shadow-xl">
          <div className="flex items-center gap-4">
            <Link
              href="/reports"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#232733] bg-[#181B22] text-gray-400 hover:text-white hover:border-[#00F2FE] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-500/20">
                  {data.targetType === 'POST' ? <FileText className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  {data.targetType}
                </span>
                <StatusBadge status={data.status} />
                <PriorityBadge priority={data.priorityScore} />
                <span className="font-mono text-xs text-gray-500">
                  Target: {data.targetKey}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-white">
                {targetPost?.title || (data.targetType === 'POST' ? 'Reported Post Submission' : `Account: @${targetProfile?.username || 'user'}`)}
              </h2>
            </div>
          </div>

          {/* Quick Status Control Buttons */}
          <div className="flex items-center gap-3">
            {data.status === 'PENDING' && (
              <button
                onClick={handleClaim}
                className="flex items-center gap-2 rounded-xl bg-[#00F2FE] px-4 py-2 text-xs font-bold text-black hover:bg-[#25F4EE] shadow-lg shadow-cyan-500/10 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
                Claim & Begin Review
              </button>
            )}
            {isClosed && (
              <button
                onClick={handleReopen}
                className="flex items-center gap-2 rounded-xl border border-[#232733] bg-[#181B22] px-4 py-2 text-xs font-semibold text-white hover:bg-[#232733] transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                Reopen Case
              </button>
            )}
          </div>
        </div>

        {/* TOP ROW: REPORT SUMMARY METRICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">Total Reports</span>
              <Flag className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-rose-400 font-mono">
              {totalReports}
            </div>
            <p className="mt-1 text-xs text-gray-500">Independent user reports received</p>
          </div>

          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">Top Reported Reason</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-lg font-bold text-white truncate">
              {data.topReason || 'GENERAL'}
            </div>
            <p className="mt-1 text-xs text-gray-500">Most frequent violation category</p>
          </div>

          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">First Reported</span>
              <Clock className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-sm font-semibold text-white">
              {new Date(data.firstReportedAt).toLocaleDateString()}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(data.firstReportedAt).toLocaleTimeString()}
            </p>
          </div>

          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">Latest Incident</span>
              <Calendar className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-2 text-sm font-semibold text-white">
              {new Date(data.lastReportedAt).toLocaleDateString()}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(data.lastReportedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* MIDDLE SECTION: REPORTED CONTENT (LEFT) & TARGET OWNER / REASONS BREAKDOWN (RIGHT) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* A. REPORTED CONTENT & EVIDENCE */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-[#00F2FE]" />
                  <h3 className="text-base font-bold text-white">Reported Content Evidence</h3>
                </div>
                {targetPost?.status && (
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${targetPost.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                    Status: {targetPost.status}
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-4">
                {targetPost?.title && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Headline / Title</h4>
                    <p className="mt-1 text-base font-bold text-white">{targetPost.title}</p>
                  </div>
                )}

                {targetPost?.content && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Body Content</h4>
                    <div className="mt-2 rounded-xl border border-[#232733] bg-[#181B22] p-4 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {targetPost.content}
                    </div>
                  </div>
                )}

                {targetPost?.imageUrl && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Media Attachment</h4>
                    <div className="mt-2 overflow-hidden rounded-xl border border-[#232733] bg-[#0A0B0E]">
                      <img
                        src={targetPost.imageUrl}
                        alt="Evidence media attachment"
                        className="max-h-96 w-full object-contain bg-black/40"
                      />
                    </div>
                  </div>
                )}

                {!targetPost?.title && !targetPost?.content && !targetPost?.imageUrl && (
                  <div className="rounded-xl border border-dashed border-[#232733] p-8 text-center text-gray-500 text-sm">
                    No post text or media payload stored. Target is user account profile @{targetProfile?.username || 'user'}.
                  </div>
                )}

                {/* Content Metadata */}
                <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-gray-500 border-t border-[#232733]">
                  {targetPost?.createdAt && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Created: {new Date(targetPost.createdAt).toLocaleString()}
                    </span>
                  )}
                  {targetPost?.id && (
                    <span className="font-mono">
                      Post ID: {targetPost.id}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* C. INDIVIDUAL REPORTS TABLE */}
            <div className="rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#232733] bg-[#181B22] px-6 py-4">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">
                    Individual Reports Breakdown ({reportsList.length})
                  </h3>
                </div>
                <span className="text-xs text-gray-400">
                  Every user report filed against this target
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#232733] bg-[#14171E] text-gray-400">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Reporter</th>
                      <th className="px-5 py-3 font-semibold">Reason Category</th>
                      <th className="px-5 py-3 font-semibold">User Description / Context</th>
                      <th className="px-5 py-3 font-semibold">Submitted At</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232733]">
                    {reportsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No individual report records linked to this case.
                        </td>
                      </tr>
                    ) : (
                      paginatedReports.map((r: any) => {
                        const reporter = r.reporter || {};
                        const profile = reporter.profile || {};
                        const username = profile.username || 'user';
                        const fullName = profile.fullName || username;

                        return (
                          <tr key={r.id} className="hover:bg-[#181B22]/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden flex-shrink-0">
                                  {profile.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt={username} className="h-full w-full object-cover" />
                                  ) : (
                                    username.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-white">{fullName}</div>
                                  <div className="font-mono text-[11px] text-gray-500">@{username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-block rounded-md bg-rose-500/10 px-2 py-0.5 font-bold text-rose-400 border border-rose-500/20 text-[11px]">
                                {r.reason}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 max-w-xs">
                              {r.details ? (
                                <p className="text-gray-300 text-[11.5px] line-clamp-3 bg-[#181B22] p-2 rounded-lg border border-[#232733]">
                                  {r.details}
                                </p>
                              ) : (
                                <span className="text-gray-500 italic text-[11px]">No additional details provided</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap">
                              {new Date(r.createdAt).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusBadge status={r.status || data.status} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Individual Reports Pagination Footer (5 reports per page) */}
              {reportsList.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[#232733] bg-[#14171E] px-6 py-3.5 gap-3">
                  <div className="text-xs text-gray-400">
                    Showing <span className="font-semibold text-white">{(reportPage - 1) * REPORT_PAGE_SIZE + 1}</span> to{' '}
                    <span className="font-semibold text-white">{Math.min(reportPage * REPORT_PAGE_SIZE, reportsList.length)}</span> of{' '}
                    <span className="font-semibold text-white">{reportsList.length}</span> reports
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={reportPage <= 1}
                      onClick={() => setReportPage((prev) => Math.max(prev - 1, 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#232733] bg-[#181B22] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#232733] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </button>

                    <div className="flex items-center gap-1 px-2 text-xs font-mono text-gray-400">
                      Page <span className="font-bold text-white ml-1">{reportPage}</span> of <span className="font-bold text-white ml-1">{totalReportPages}</span>
                    </div>

                    <button
                      type="button"
                      disabled={reportPage >= totalReportPages}
                      onClick={() => setReportPage((prev) => Math.min(prev + 1, totalReportPages))}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#232733] bg-[#181B22] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#232733] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: TARGET USER CARD, REASONS DISTRIBUTION, AND DECISION STUDIO WITH VERTICAL SCROLLER & HIDDEN SCROLLBAR */}
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-5rem)] overflow-y-auto space-y-6 pr-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* TARGET ACCOUNT INFORMATION */}
            <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-[#232733] pb-3">
                Reported Target Account
              </h3>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-lg font-bold text-white overflow-hidden shadow-lg shadow-purple-500/10 flex-shrink-0">
                  {targetProfile?.avatarUrl ? (
                    <img src={targetProfile.avatarUrl} alt={targetProfile.username} className="h-full w-full object-cover" />
                  ) : (
                    (targetProfile?.username || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{targetProfile?.fullName || targetProfile?.username || 'Unknown'}</h4>
                  <p className="font-mono text-xs text-gray-400">@{targetProfile?.username || 'user'}</p>
                  {targetUser.email && <p className="text-[11px] text-gray-500">{targetUser.email}</p>}
                </div>
              </div>

              {/* Account Stats */}
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-[#232733] bg-[#181B22] p-3">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Account Status</span>
                  <span className="font-bold text-white mt-1 block">
                    {targetUser.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="rounded-xl border border-[#232733] bg-[#181B22] p-3">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Past Warnings</span>
                  <span className="font-bold text-amber-400 mt-1 block">
                    {targetUser.warnings?.length || 0} warnings
                  </span>
                </div>
              </div>

              {targetProfile?.bio && (
                <div className="mt-4 rounded-xl border border-[#232733] bg-[#181B22] p-3 text-xs text-gray-300">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">User Bio</span>
                  {targetProfile.bio}
                </div>
              )}
            </div>

            {/* REASONS BREAKDOWN */}
            <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-[#232733] pb-3">
                Violation Categories Breakdown
              </h3>
              <div className="mt-4 space-y-3">
                {reasonsBreakdown.length === 0 ? (
                  <p className="text-xs text-gray-500">No category breakdown available.</p>
                ) : (
                  reasonsBreakdown.map((item: any) => {
                    const percentage = Math.round((item.count / totalReports) * 100);
                    return (
                      <div key={item.reason} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-200">{item.reason}</span>
                          <span className="font-mono text-gray-400">
                            {item.count} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#181B22] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. MODERATION ACTIONS AND DECISIONS STUDIO */}
            <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl space-y-5">
              <div className="flex items-center gap-2 border-b border-[#232733] pb-3">
                <Gavel className="h-5 w-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Execute Moderation Decision</h3>
              </div>

              {/* Outcome Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                  Decision Outcome
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutcome('ACTION')}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      outcome === 'ACTION'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-400 shadow-lg shadow-rose-500/10'
                        : 'border-[#232733] bg-[#181B22] text-gray-400 hover:text-white'
                    }`}
                  >
                    Action Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome('DISMISS')}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      outcome === 'DISMISS'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/10'
                        : 'border-[#232733] bg-[#181B22] text-gray-400 hover:text-white'
                    }`}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome('RESOLVE')}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      outcome === 'RESOLVE'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10'
                        : 'border-[#232733] bg-[#181B22] text-gray-400 hover:text-white'
                    }`}
                  >
                    Resolve
                  </button>
                </div>
              </div>

              {/* Actions Checklist when Outcome == ACTION */}
              {outcome === 'ACTION' && (
                <div className="space-y-3 rounded-xl border border-[#232733] bg-[#181B22] p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Select Sanctions to Enforce
                  </span>

                  {data.targetType === 'POST' && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={actionRemovePost}
                        onChange={(e) => setActionRemovePost(e.target.checked)}
                        className="rounded border-[#232733] bg-[#12141A] text-[#00F2FE] focus:ring-0"
                      />
                      <span className="text-xs text-gray-200">
                        Remove post from feed (preserves evidence in database)
                      </span>
                    </label>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={actionWarnUser}
                      onChange={(e) => setActionWarnUser(e.target.checked)}
                      className="rounded border-[#232733] bg-[#12141A] text-[#00F2FE] focus:ring-0"
                    />
                    <span className="text-xs text-gray-200">
                      Send formal community warning to user
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={actionSuspendUser}
                      onChange={(e) => {
                        setActionSuspendUser(e.target.checked);
                        if (e.target.checked) setActionBanUser(false);
                      }}
                      className="rounded border-[#232733] bg-[#12141A] text-amber-500 focus:ring-0"
                    />
                    <span className="text-xs text-amber-300">
                      Temporarily suspend user account
                    </span>
                  </label>

                  {actionSuspendUser && (
                    <div className="pl-6 pt-1">
                      <label className="text-[11px] text-gray-400 block mb-1">Suspension Duration (Days)</label>
                      <select
                        value={suspendDays}
                        onChange={(e) => setSuspendDays(Number(e.target.value))}
                        className="rounded-lg border border-[#232733] bg-[#12141A] px-3 py-1.5 text-xs text-white focus:outline-none"
                      >
                        <option value={1}>1 Day (24 Hours)</option>
                        <option value={3}>3 Days</option>
                        <option value={7}>7 Days (Standard)</option>
                        <option value={14}>14 Days</option>
                        <option value={30}>30 Days</option>
                      </select>
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={actionBanUser}
                      onChange={(e) => {
                        setActionBanUser(e.target.checked);
                        if (e.target.checked) setActionSuspendUser(false);
                      }}
                      className="rounded border-[#232733] bg-[#12141A] text-rose-500 focus:ring-0"
                    />
                    <span className="text-xs text-rose-400 font-bold">
                      Permanently ban user account
                    </span>
                  </label>
                </div>
              )}

              {/* Policy Reference */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Policy Reference
                </label>
                <select
                  value={policyRef}
                  onChange={(e) => setPolicyRef(e.target.value)}
                  className="w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="COMMUNITY-STANDARDS-V1">Community Standards General (v1.0)</option>
                  <option value="HARASSMENT-POLICY-2">Harassment & Bullying (HARASS-2)</option>
                  <option value="HATE-SPEECH-1">Hate Speech & Symbols (HATE-1)</option>
                  <option value="VIOLENCE-INCITEMENT-3">Violence & Dangerous Content (VIOL-3)</option>
                  <option value="MISINFORMATION-4">False Information & Spam (MISINFO-4)</option>
                  <option value="EXPLOITATION-POLICY-5">Illegal Goods / Exploitation (EXPLOIT-5)</option>
                </select>
              </div>

              {/* Public Reason (Shown to affected user) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Public Notice Message (Shown to User)
                </label>
                <input
                  type="text"
                  value={publicReason}
                  onChange={(e) => setPublicReason(e.target.value)}
                  placeholder="e.g. Content violated community guidelines regarding harassment"
                  className="w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>

              {/* Decision Note (Internal Audit Log Rationale) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Internal Administrative Rationale (Audit Log) *
                </label>
                <textarea
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Document specific evidence, policy violation rationale, and administrative findings (min 10 characters)..."
                  className="w-full rounded-xl border border-[#232733] bg-[#181B22] p-3 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                <span className="text-[10px] text-gray-500">
                  {decisionNote.length}/10 minimum characters required for audit trail
                </span>
              </div>

              {/* Submit Decision Button */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteDecisionClick}
                className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-[#FE2C55] py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'Executing Decision...' : `Confirm & Apply ${outcome}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Destructive Actions */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={executeDecision}
        title="Confirm Moderation Sanctions"
        description={`Are you sure you want to enforce these actions against ${data.targetType} target @${targetProfile?.username || 'user'}? This decision will be permanently sealed into the immutable cryptographic audit trail.`}
        confirmLabel="Yes, Execute Sanction"
        isDestructive={actionBanUser || actionSuspendUser || actionRemovePost}
      />
    </AdminShell>
  );
}
