'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  GitPullRequest,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  User,
  Shield,
  Layers,
  Calendar,
} from 'lucide-react';

interface ChangeRequest {
  id: string;
  title: string;
  category: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  reason: string;
  planDetails: string;
  rollbackPlan: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED' | 'ROLLED_BACK';
  createdAt: string;
  approvedAt: string | null;
  implementedAt: string | null;
  requester: {
    id: string;
    email: string;
    profile: { username: string; fullName: string | null } | null;
  };
  approvedBy: {
    id: string;
    email: string;
    profile: { username: string; fullName: string | null } | null;
  } | null;
}

export default function ChangeManagementPage() {
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('SECURITY_CONFIG');
  const [formRiskLevel, setFormRiskLevel] = useState<ChangeRequest['riskLevel']>('MEDIUM');
  const [formReason, setFormReason] = useState('');
  const [formPlan, setFormPlan] = useState('');
  const [formRollback, setFormRollback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchChanges = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<ChangeRequest[]>('/admin/governance/changes');
      setChanges(data);
    } catch (err) {
      console.error('Failed to load change requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  const handleOpenCreate = () => {
    setFormTitle('');
    setFormCategory('SECURITY_CONFIG');
    setFormRiskLevel('MEDIUM');
    setFormReason('');
    setFormPlan('');
    setFormRollback('');
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest('/admin/governance/changes', {
        method: 'POST',
        body: {
          title: formTitle,
          category: formCategory,
          riskLevel: formRiskLevel,
          reason: formReason,
          planDetails: formPlan,
          rollbackPlan: formRollback,
        },
      });
      setIsCreateModalOpen(false);
      fetchChanges();
    } catch (err) {
      alert('Failed to submit RFC: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiRequest(`/admin/governance/changes/${id}/review`, {
        method: 'PATCH',
        body: { status },
      });
      fetchChanges();
    } catch (err) {
      alert('Failed to review RFC: ' + String(err));
    }
  };

  const handleImplement = async (id: string, status: 'IMPLEMENTED' | 'ROLLED_BACK') => {
    try {
      await apiRequest(`/admin/governance/changes/${id}/implement`, {
        method: 'PATCH',
        body: { status },
      });
      fetchChanges();
    } catch (err) {
      alert('Failed to record implementation status: ' + String(err));
    }
  };

  const filtered = changes.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ChangeRequest['status']) => {
    switch (status) {
      case 'APPROVED':
        return <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">APPROVED</span>;
      case 'IMPLEMENTED':
        return <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-[#00F2FE] border border-cyan-500/20">IMPLEMENTED</span>;
      case 'ROLLED_BACK':
        return <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">ROLLED BACK</span>;
      case 'REJECTED':
        return <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">REJECTED</span>;
      default:
        return <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-bold text-yellow-300 border border-yellow-500/20">SUBMITTED (AWAITING REVIEW)</span>;
    }
  };

  return (
    <AdminShell
      title="Security Change Management (RFC)"
      subtitle="Request, review, approve, test, and audit security-relevant architectural changes"
      actions={
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Submit RFC
        </button>
      }
    >
      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search RFC title, reason, or category..."
              className="w-full rounded-xl border border-[#232733] bg-[#12141A] py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:border-[#00F2FE] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#232733] bg-[#12141A] px-3 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="IMPLEMENTED">Implemented</option>
              <option value="REJECTED">Rejected</option>
              <option value="ROLLED_BACK">Rolled Back</option>
            </select>
          </div>
        </div>

        {/* Changes Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Change Title & Justification</th>
                <th className="px-5 py-3.5">Risk Level</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Rollback Strategy</th>
                <th className="px-5 py-3.5">Requester & Date</th>
                <th className="px-5 py-3.5 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232733]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    Loading change requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No change requests matching filter. Click &quot;Submit RFC&quot; to propose a security change.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#181B22]/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{item.title}</div>
                      <div className="text-[11px] text-[#00F2FE] font-mono mt-0.5">{item.category}</div>
                      <div className="text-gray-400 text-[11px] mt-1 line-clamp-1">{item.reason}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          item.riskLevel === 'EMERGENCY'
                            ? 'bg-rose-500/20 text-rose-400'
                            : item.riskLevel === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {item.riskLevel}
                      </span>
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-5 py-4 text-gray-300 text-[11px] max-w-xs truncate">
                      {item.rollbackPlan}
                    </td>
                    <td className="px-5 py-4 text-[11px] font-mono text-gray-400">
                      <div>By: {item.requester?.profile?.username || item.requester?.email}</div>
                      <div className="text-gray-500 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {item.status === 'SUBMITTED' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReview(item.id, 'APPROVED')}
                            className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(item.id, 'REJECTED')}
                            className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : item.status === 'APPROVED' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleImplement(item.id, 'IMPLEMENTED')}
                            className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-1 text-xs font-bold text-[#00F2FE] hover:bg-cyan-500/30 transition-all"
                          >
                            Mark Implemented
                          </button>
                        </div>
                      ) : item.status === 'IMPLEMENTED' ? (
                        <button
                          onClick={() => handleImplement(item.id, 'ROLLED_BACK')}
                          className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-2 py-1 text-[11px] font-bold text-amber-400 hover:bg-amber-500/30 transition-all"
                        >
                          Trigger Rollback
                        </button>
                      ) : (
                        <span className="text-gray-500 text-[11px]">Closed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Submit RFC */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GitPullRequest className="h-4 w-4 text-[#00F2FE]" />
                  Submit Request for Change (RFC)
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Change Request Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Upgrade token signing algorithm to RS256 with key rotation"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="SECURITY_CONFIG">Security Configuration</option>
                      <option value="DATABASE_SCHEMA">Database & Migrations</option>
                      <option value="INFRASTRUCTURE">Cloud & Infrastructure</option>
                      <option value="ACCESS_POLICY">Access Policy & Roles</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Risk Level</label>
                    <select
                      value={formRiskLevel}
                      onChange={(e) => setFormRiskLevel(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="LOW">Low Risk</option>
                      <option value="MEDIUM">Medium Risk</option>
                      <option value="HIGH">High Risk</option>
                      <option value="EMERGENCY">Emergency (Immediate)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Business & Security Justification *</label>
                  <textarea
                    required
                    rows={2}
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="Why this change is needed and what risks it mitigates..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Implementation Steps & Testing *</label>
                  <textarea
                    required
                    rows={3}
                    value={formPlan}
                    onChange={(e) => setFormPlan(e.target.value)}
                    placeholder="Step-by-step procedure, maintenance window, test validation..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Rollback Procedure *</label>
                  <input
                    type="text"
                    required
                    value={formRollback}
                    onChange={(e) => setFormRollback(e.target.value)}
                    placeholder="Contingency steps if change fails test verification..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit RFC for Approval'}
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
