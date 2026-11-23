'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  Siren,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  User,
  Edit2,
  FileText,
} from 'lucide-react';

interface SecurityIncident {
  id: string;
  referenceNumber: string;
  title: string;
  category: string;
  severity: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';
  status: 'REPORTED' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'POST_MORTEM';
  description: string;
  containment: string | null;
  rootCause: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  leadInvestigator: {
    id: string;
    email: string;
    profile: { username: string; fullName: string | null } | null;
  } | null;
}

export default function IncidentManagementPage() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('UNAUTHORIZED_ACCESS');
  const [formSeverity, setFormSeverity] = useState<SecurityIncident['severity']>('P2_HIGH');
  const [formStatus, setFormStatus] = useState<SecurityIncident['status']>('REPORTED');
  const [formDesc, setFormDesc] = useState('');
  const [formContainment, setFormContainment] = useState('');
  const [formRootCause, setFormRootCause] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<SecurityIncident[]>('/admin/governance/incidents');
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleOpenCreate = () => {
    setFormTitle('');
    setFormCategory('UNAUTHORIZED_ACCESS');
    setFormSeverity('P2_HIGH');
    setFormStatus('REPORTED');
    setFormDesc('');
    setFormContainment('');
    setFormRootCause('');
    setIsCreateModalOpen(true);
  };

  const handleOpenUpdate = (inc: SecurityIncident) => {
    setSelectedIncident(inc);
    setFormTitle(inc.title);
    setFormCategory(inc.category);
    setFormSeverity(inc.severity);
    setFormStatus(inc.status);
    setFormDesc(inc.description);
    setFormContainment(inc.containment || '');
    setFormRootCause(inc.rootCause || '');
    setIsUpdateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest('/admin/governance/incidents', {
        method: 'POST',
        body: {
          title: formTitle,
          category: formCategory,
          severity: formSeverity,
          status: formStatus,
          description: formDesc,
          containment: formContainment,
        },
      });
      setIsCreateModalOpen(false);
      fetchIncidents();
    } catch (err) {
      alert('Failed to report incident: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/governance/incidents/${selectedIncident.id}`, {
        method: 'PATCH',
        body: {
          title: formTitle,
          category: formCategory,
          severity: formSeverity,
          status: formStatus,
          description: formDesc,
          containment: formContainment,
          rootCause: formRootCause,
        },
      });
      setIsUpdateModalOpen(false);
      fetchIncidents();
    } catch (err) {
      alert('Failed to update incident: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getSeverityBadge = (sev: SecurityIncident['severity']) => {
    switch (sev) {
      case 'P1_CRITICAL':
        return <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-mono font-bold text-rose-400">P1 - CRITICAL</span>;
      case 'P2_HIGH':
        return <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-mono font-bold text-amber-400">P2 - HIGH</span>;
      case 'P3_MEDIUM':
        return <span className="rounded-md bg-yellow-500/20 px-2 py-0.5 text-xs font-mono font-bold text-yellow-300">P3 - MEDIUM</span>;
      default:
        return <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-xs font-mono font-bold text-blue-400">P4 - LOW</span>;
    }
  };

  return (
    <AdminShell
      title="Security Incident Management"
      subtitle="Detect, triage, contain, investigate, and remediate platform security incidents"
      actions={
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Log Security Incident
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
              placeholder="Search reference #, title, or threat category..."
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
              <option value="REPORTED">Reported</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="CONTAINED">Contained</option>
              <option value="RESOLVED">Resolved</option>
              <option value="POST_MORTEM">Post-Mortem</option>
            </select>
          </div>
        </div>

        {/* Incidents Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Reference # & Title</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Severity</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Reported Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232733]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    Loading security incidents...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No active or historical incidents found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#181B22]/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#00F2FE]">{item.referenceNumber}</span>
                        <span className="font-bold text-white text-sm">{item.title}</span>
                      </div>
                      <div className="text-gray-400 text-[11px] mt-1 line-clamp-1">{item.description}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded bg-[#232733] px-2 py-0.5 text-[10px] text-gray-300 font-mono">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">{getSeverityBadge(item.severity)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'RESOLVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'CONTAINED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-gray-400">
                      {new Date(item.reportedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenUpdate(item)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-[#232733] hover:text-[#00F2FE] transition-colors"
                        title="Triage & Update"
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

        {/* Modal: Log Incident */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Siren className="h-4 w-4 text-rose-500" />
                  Log Security Incident
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Incident Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Distributed brute-force attack on /auth/login"
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
                      <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
                      <option value="ACCOUNT_COMPROMISE">Account Compromise</option>
                      <option value="DATA_LEAK">Data Leak</option>
                      <option value="DENIAL_OF_SERVICE">Denial of Service</option>
                      <option value="MALWARE">Malware</option>
                      <option value="INSIDER_THREAT">Insider Threat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Severity Level</label>
                    <select
                      value={formSeverity}
                      onChange={(e) => setFormSeverity(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="P1_CRITICAL">P1 - Critical</option>
                      <option value="P2_HIGH">P2 - High</option>
                      <option value="P3_MEDIUM">P3 - Medium</option>
                      <option value="P4_LOW">P4 - Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Incident Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Provide details on detection source, symptoms, and potential impact..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Immediate Containment Action</label>
                  <input
                    type="text"
                    value={formContainment}
                    onChange={(e) => setFormContainment(e.target.value)}
                    placeholder="e.g. Blocked offending IP subnet on firewall, forced password resets"
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
                    className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Logging...' : 'Log Incident & Alert Staff'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Update / Triage Incident */}
        {isUpdateModalOpen && selectedIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Siren className="h-4 w-4 text-[#00F2FE]" />
                  Triage Incident: {selectedIncident.referenceNumber}
                </h3>
                <button onClick={() => setIsUpdateModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="mt-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Incident Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="REPORTED">Reported</option>
                      <option value="INVESTIGATING">Investigating</option>
                      <option value="CONTAINED">Contained</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="POST_MORTEM">Post-Mortem</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Severity</label>
                    <select
                      value={formSeverity}
                      onChange={(e) => setFormSeverity(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="P1_CRITICAL">P1 - Critical</option>
                      <option value="P2_HIGH">P2 - High</option>
                      <option value="P3_MEDIUM">P3 - Medium</option>
                      <option value="P4_LOW">P4 - Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Containment Summary</label>
                  <textarea
                    rows={2}
                    value={formContainment}
                    onChange={(e) => setFormContainment(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Root Cause Analysis (RCA)</label>
                  <textarea
                    rows={3}
                    value={formRootCause}
                    onChange={(e) => setFormRootCause(e.target.value)}
                    placeholder="Underlying vulnerability, architectural oversight, or external breach vector..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Save Triage Update'}
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
