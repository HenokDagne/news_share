'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  ClipboardCheck,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface SecurityFinding {
  id: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  remediationPlan: string;
  deadline: string;
  status: 'OPEN' | 'RESOLVED' | 'ACKNOWLEDGED' | 'DISMISSED';
  resolvedAt: string | null;
  assignedTo: {
    id: string;
    email: string;
    profile: { username: string } | null;
  };
}

interface SecurityReview {
  id: string;
  title: string;
  reviewType: string;
  scope: string;
  leadAuditor: string;
  scheduledDate: string;
  completedDate: string | null;
  summaryFindings: string | null;
  findingsCount: number;
  status: 'PENDING' | 'RESOLVED';
  findings?: SecurityFinding[];
}

export default function SecurityReviewsPage() {
  const [reviews, setReviews] = useState<SecurityReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  // Modals
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isFindingModalOpen, setIsFindingModalOpen] = useState(false);
  const [targetReviewId, setTargetReviewId] = useState<string | null>(null);

  // Review Form State
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('ACCESS_CONTROL_AUDIT');
  const [formScope, setFormScope] = useState('Admin portal permissions, MFA enforcement, and token expiry');
  const [formAuditor, setFormAuditor] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  // Finding Form State
  const [findingTitle, setFindingTitle] = useState('');
  const [findingSeverity, setFindingSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [findingDesc, setFindingDesc] = useState('');
  const [findingRemediation, setFindingRemediation] = useState('');
  const [findingAssigneeId, setFindingAssigneeId] = useState('');
  const [findingDeadline, setFindingDeadline] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [staffUsers, setStaffUsers] = useState<Array<{ id: string; email: string; profile?: { username: string } }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<SecurityReview[]>('/admin/governance/reviews');
      setReviews(data);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const data = await apiRequest<{ data: any[] }>('/admin/staff');
      if (data?.data) {
        setStaffUsers(data.data);
        if (data.data.length > 0) {
          setFindingAssigneeId(data.data[0].id);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchReviews();
    fetchStaff();
  }, [fetchReviews, fetchStaff]);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest('/admin/governance/reviews', {
        method: 'POST',
        body: {
          title: formTitle,
          reviewType: formType,
          scope: formScope,
          leadAuditor: formAuditor,
          scheduledDate: new Date(formDate).toISOString(),
        },
      });
      setIsReviewModalOpen(false);
      fetchReviews();
    } catch (err) {
      alert('Failed to schedule review: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddFinding = (reviewId: string) => {
    setTargetReviewId(reviewId);
    setFindingTitle('');
    setFindingSeverity('MEDIUM');
    setFindingDesc('');
    setFindingRemediation('');
    setFindingDeadline(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setIsFindingModalOpen(true);
  };

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReviewId) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/governance/reviews/${targetReviewId}/findings`, {
        method: 'POST',
        body: {
          title: findingTitle,
          severity: findingSeverity,
          description: findingDesc,
          remediationPlan: findingRemediation,
          assignedToId: findingAssigneeId || staffUsers[0]?.id,
          deadline: new Date(findingDeadline).toISOString(),
        },
      });
      setIsFindingModalOpen(false);
      fetchReviews();
    } catch (err) {
      alert('Failed to record finding: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveFinding = async (findingId: string) => {
    try {
      await apiRequest(`/admin/governance/findings/${findingId}`, {
        method: 'PATCH',
        body: { status: 'RESOLVED' },
      });
      fetchReviews();
    } catch (err) {
      alert('Failed to update finding: ' + String(err));
    }
  };

  return (
    <AdminShell
      title="Security Reviews & Audits"
      subtitle="Periodic vulnerability assessments, access reviews, findings, and remediation SLA tracking"
      actions={
        <button
          onClick={() => setIsReviewModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Schedule Review
        </button>
      }
    >
      <div className="space-y-6">
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-gray-500">
              Loading security review campaigns...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-12 text-center text-xs text-gray-500">
              No security reviews scheduled. Click &quot;Schedule Review&quot; to initialize a quarterly assessment.
            </div>
          ) : (
            reviews.map((r) => {
              const isExpanded = expandedReviewId === r.id;
              const hasFindings = (r.findings?.length ?? 0) > 0;

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-[#232733] bg-[#12141A] overflow-hidden transition-all"
                >
                  <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 hover:bg-[#181B22]/40 transition-colors cursor-pointer gap-4"
                    onClick={() => setExpandedReviewId(isExpanded ? null : r.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-white text-sm">{r.title}</span>
                        <span className="rounded-md bg-[#232733] px-2 py-0.5 text-[10px] font-mono text-[#00F2FE]">
                          {r.reviewType.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            r.status === 'RESOLVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {r.status === 'RESOLVED' ? 'COMPLETED' : 'SCHEDULED / IN PROGRESS'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{r.scope}</p>
                      <div className="flex items-center gap-4 text-[11px] text-gray-500 mt-2 font-mono">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-gray-400" />
                          Lead: {r.leadAuditor}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          Date: {new Date(r.scheduledDate).toLocaleDateString()}
                        </span>
                        <span>{r.findingsCount} Findings recorded</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddFinding(r.id);
                        }}
                        className="rounded-xl border border-[#00F2FE]/40 bg-[#00F2FE]/10 px-3 py-1.5 text-xs font-bold text-[#00F2FE] hover:bg-[#00F2FE]/20 transition-all flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Finding
                      </button>
                      <div className="p-1 text-gray-400">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Findings Section */}
                  {isExpanded && (
                    <div className="border-t border-[#232733] bg-[#0E1015] p-5 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                        Remediation Action Items & Vulnerability Findings
                      </h4>

                      {!hasFindings ? (
                        <p className="text-xs text-gray-500 py-4">
                          No findings logged under this review campaign. Click &quot;Add Finding&quot; to log discovered gaps.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {r.findings?.map((f) => (
                            <div
                              key={f.id}
                              className="rounded-xl border border-[#232733] bg-[#12141A] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">{f.title}</span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                      f.severity === 'CRITICAL'
                                        ? 'bg-rose-500/20 text-rose-400'
                                        : f.severity === 'HIGH'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-blue-500/20 text-blue-400'
                                    }`}
                                  >
                                    {f.severity}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                      f.status === 'RESOLVED'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/20 text-rose-400'
                                    }`}
                                  >
                                    {f.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">{f.description}</p>
                                <div className="text-[11px] text-gray-500 mt-1">
                                  Plan: <span className="text-gray-300">{f.remediationPlan}</span> • Assignee: <span className="text-gray-300">{f.assignedTo?.profile?.username || f.assignedTo?.email}</span> • Due: <span className="text-rose-400 font-mono">{new Date(f.deadline).toLocaleDateString()}</span>
                                </div>
                              </div>

                              {f.status !== 'RESOLVED' && (
                                <button
                                  onClick={() => handleResolveFinding(f.id)}
                                  className="self-start sm:self-auto rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Verify Closed
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal: Schedule Review */}
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[#00F2FE]" />
                  Schedule Security Review
                </h3>
                <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateReview} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Campaign Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Q4 2026 Privilege Access & Pentest Audit"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Review Type</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="ACCESS_CONTROL_AUDIT">Access Control Audit</option>
                      <option value="PENETRATION_TEST">Penetration Test</option>
                      <option value="VULNERABILITY_ASSESSMENT">Vulnerability Assessment</option>
                      <option value="CODE_SECURITY_REVIEW">Code Security Review</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Scheduled Date *</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Lead Auditor / Team *</label>
                  <input
                    type="text"
                    required
                    value={formAuditor}
                    onChange={(e) => setFormAuditor(e.target.value)}
                    placeholder="e.g. Internal Security Team / External Auditor"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Audit Scope & Systems *</label>
                  <textarea
                    required
                    rows={2}
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Finding */}
        {isFindingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  Log Security Finding
                </h3>
                <button onClick={() => setIsFindingModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateFinding} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Finding Title *</label>
                  <input
                    type="text"
                    required
                    value={findingTitle}
                    onChange={(e) => setFindingTitle(e.target.value)}
                    placeholder="e.g. Session duration exceeds maximum 15m threshold"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Severity</label>
                    <select
                      value={findingSeverity}
                      onChange={(e) => setFindingSeverity(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Remediation Deadline *</label>
                    <input
                      type="date"
                      required
                      value={findingDeadline}
                      onChange={(e) => setFindingDeadline(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Technical Description *</label>
                  <textarea
                    required
                    rows={2}
                    value={findingDesc}
                    onChange={(e) => setFindingDesc(e.target.value)}
                    placeholder="Root vulnerability, affected endpoint or configuration..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Remediation Action Plan *</label>
                  <input
                    type="text"
                    required
                    value={findingRemediation}
                    onChange={(e) => setFindingRemediation(e.target.value)}
                    placeholder="e.g. Patch JWT_ACCESS_TTL_SECONDS in backend configuration"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsFindingModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Logging...' : 'Record Finding'}
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
