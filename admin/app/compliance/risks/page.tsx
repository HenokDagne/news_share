'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Shield,
  User,
  Calendar,
  Edit2,
  TrendingUp,
} from 'lucide-react';

interface RiskItem {
  id: string;
  title: string;
  description: string;
  likelihood: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  impact: 'INSIGNIFICANT' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';
  riskScore: number;
  status: 'IDENTIFIED' | 'ASSESSING' | 'MITIGATING' | 'ACCEPTED' | 'RESOLVED';
  mitigationPlan: string;
  targetDate: string;
  residualScore: number | null;
  ownerId: string;
  owner: {
    id: string;
    email: string;
    profile: { username: string; fullName: string | null } | null;
  };
}

const LIKELIHOOD_VALS: Record<string, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};

const IMPACT_VALS: Record<string, number> = {
  INSIGNIFICANT: 1,
  MINOR: 2,
  MODERATE: 3,
  MAJOR: 4,
  CRITICAL: 5,
};

export default function RiskRegisterPage() {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLikelihood, setFormLikelihood] = useState<RiskItem['likelihood']>('MEDIUM');
  const [formImpact, setFormImpact] = useState<RiskItem['impact']>('MODERATE');
  const [formStatus, setFormStatus] = useState<RiskItem['status']>('IDENTIFIED');
  const [formPlan, setFormPlan] = useState('');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [formDate, setFormDate] = useState(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [formResidual, setFormResidual] = useState<number | ''>('');
  const [staffUsers, setStaffUsers] = useState<Array<{ id: string; email: string; profile?: { username: string } }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRisks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<RiskItem[]>('/admin/governance/risks');
      setRisks(data);
    } catch (err) {
      console.error('Failed to load risks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const data = await apiRequest<{ data: any[] }>('/admin/staff');
      if (data?.data) {
        setStaffUsers(data.data);
        if (data.data.length > 0 && !formOwnerId) {
          setFormOwnerId(data.data[0].id);
        }
      }
    } catch (_) {}
  }, [formOwnerId]);

  useEffect(() => {
    fetchRisks();
    fetchStaff();
  }, [fetchRisks, fetchStaff]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormLikelihood('MEDIUM');
    setFormImpact('MODERATE');
    setFormStatus('IDENTIFIED');
    setFormPlan('');
    setFormOwnerId(staffUsers[0]?.id || '');
    setFormDate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormResidual('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: RiskItem) => {
    setEditingId(r.id);
    setFormTitle(r.title);
    setFormDesc(r.description);
    setFormLikelihood(r.likelihood);
    setFormImpact(r.impact);
    setFormStatus(r.status);
    setFormPlan(r.mitigationPlan);
    setFormOwnerId(r.ownerId);
    setFormDate(new Date(r.targetDate).toISOString().split('T')[0]);
    setFormResidual(r.residualScore ?? '');
    setIsModalOpen(true);
  };

  const calculatedScore = (LIKELIHOOD_VALS[formLikelihood] || 3) * (IMPACT_VALS[formImpact] || 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle,
        description: formDesc,
        likelihood: formLikelihood,
        impact: formImpact,
        status: formStatus,
        mitigationPlan: formPlan,
        ownerId: formOwnerId || staffUsers[0]?.id,
        targetDate: new Date(formDate).toISOString(),
        residualScore: formResidual !== '' ? Number(formResidual) : undefined,
      };

      if (editingId) {
        await apiRequest(`/admin/governance/risks/${editingId}`, {
          method: 'PATCH',
          body: payload,
        });
      } else {
        await apiRequest('/admin/governance/risks', {
          method: 'POST',
          body: payload,
        });
      }
      setIsModalOpen(false);
      fetchRisks();
    } catch (err) {
      alert('Failed to save risk: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 15) {
      return <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-mono font-bold text-rose-400">Score {score} (CRITICAL)</span>;
    }
    if (score >= 10) {
      return <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-mono font-bold text-amber-400">Score {score} (HIGH)</span>;
    }
    if (score >= 5) {
      return <span className="rounded-md bg-yellow-500/20 px-2 py-0.5 text-xs font-mono font-bold text-yellow-300">Score {score} (MEDIUM)</span>;
    }
    return <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-xs font-mono font-bold text-blue-400">Score {score} (LOW)</span>;
  };

  const filtered = risks.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminShell
      title="Information Security Risk Register"
      subtitle="Threat vectors, likelihood x impact scoring, mitigation treatment plans, and ownership"
      actions={
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Risk
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
              placeholder="Search risk threats, descriptions, or mitigations..."
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
              <option value="IDENTIFIED">Identified</option>
              <option value="ASSESSING">Assessing</option>
              <option value="MITIGATING">Mitigating</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>

        {/* Risks Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Threat Scenario / Asset at Risk</th>
                <th className="px-5 py-3.5">Risk Score</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Treatment / Mitigation Plan</th>
                <th className="px-5 py-3.5">Owner & Target</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232733]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    Loading risk register...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No risk items found matching criteria. Click &quot;Add Risk&quot; to log a security threat.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#181B22]/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{item.title}</div>
                      <div className="text-gray-400 text-[11px] mt-1 line-clamp-1">{item.description}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-1">
                        Likelihood: {item.likelihood} • Impact: {item.impact}
                      </div>
                    </td>
                    <td className="px-5 py-4">{getScoreBadge(item.riskScore)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#232733] text-gray-300">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-300 text-xs max-w-xs">
                      {item.mitigationPlan}
                    </td>
                    <td className="px-5 py-4 text-[11px] font-mono text-gray-400">
                      <div>Owner: {item.owner?.profile?.username || item.owner?.email}</div>
                      <div className="text-gray-500 mt-0.5">Due: {new Date(item.targetDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-[#232733] hover:text-[#00F2FE] transition-colors"
                        title="Edit Risk"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Create / Edit Risk */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  {editingId ? 'Edit Security Risk' : 'Log New Security Risk'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Risk Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Inadequate rate limiting on public upload API"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Threat Vector / Vulnerability Description *</label>
                  <textarea
                    required
                    rows={2}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Describe how an adversary could exploit this gap and the potential impact..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Likelihood (1-5)</label>
                    <select
                      value={formLikelihood}
                      onChange={(e) => setFormLikelihood(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="VERY_LOW">1 - Very Low</option>
                      <option value="LOW">2 - Low</option>
                      <option value="MEDIUM">3 - Medium</option>
                      <option value="HIGH">4 - High</option>
                      <option value="VERY_HIGH">5 - Very High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Impact (1-5)</label>
                    <select
                      value={formImpact}
                      onChange={(e) => setFormImpact(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="INSIGNIFICANT">1 - Insignificant</option>
                      <option value="MINOR">2 - Minor</option>
                      <option value="MODERATE">3 - Moderate</option>
                      <option value="MAJOR">4 - Major</option>
                      <option value="CRITICAL">5 - Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Calculated Score</label>
                    <div className="mt-1 flex items-center justify-center rounded-xl bg-[#232733] py-2 text-xs font-mono font-bold text-white">
                      {calculatedScore} / 25
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Treatment Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="IDENTIFIED">Identified</option>
                      <option value="ASSESSING">Assessing</option>
                      <option value="MITIGATING">Mitigating</option>
                      <option value="ACCEPTED">Accepted</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Target Resolution Date *</label>
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
                  <label className="block text-xs font-semibold text-gray-300">Mitigation / Treatment Plan *</label>
                  <textarea
                    required
                    rows={2}
                    value={formPlan}
                    onChange={(e) => setFormPlan(e.target.value)}
                    placeholder="Specific security controls, architectural changes, or patches to reduce risk..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingId ? 'Update Risk' : 'Save Risk Entry'}
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
