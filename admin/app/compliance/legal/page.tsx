'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  Scale,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Calendar,
  User,
  Shield,
  FileCheck,
} from 'lucide-react';

interface LegalObligation {
  id: string;
  title: string;
  regulation: string;
  jurisdiction: string;
  description: string;
  complianceStatus: 'COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NON_COMPLIANT' | 'UNDER_REVIEW';
  responsiblePerson: string;
  reviewCycleMonths: number;
  lastReviewedAt: string | null;
  nextReviewAt: string;
  evidenceNotes: string | null;
  createdAt: string;
}

export default function LegalCompliancePage() {
  const [obligations, setObligations] = useState<LegalObligation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formRegulation, setFormRegulation] = useState('Personal Data Protection Proclamation No. 1321/2024');
  const [formJurisdiction, setFormJurisdiction] = useState('Ethiopia');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<LegalObligation['complianceStatus']>('UNDER_REVIEW');
  const [formResponsible, setFormResponsible] = useState('');
  const [formNextReview, setFormNextReview] = useState(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [formEvidence, setFormEvidence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchObligations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<LegalObligation[]>('/admin/governance/legal');
      setObligations(data);
    } catch (err) {
      console.error('Failed to load legal obligations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchObligations();
  }, [fetchObligations]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormRegulation('Personal Data Protection Proclamation No. 1321/2024');
    setFormJurisdiction('Ethiopia');
    setFormDescription('');
    setFormStatus('UNDER_REVIEW');
    setFormResponsible('');
    setFormNextReview(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormEvidence('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: LegalObligation) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormRegulation(item.regulation);
    setFormJurisdiction(item.jurisdiction);
    setFormDescription(item.description);
    setFormStatus(item.complianceStatus);
    setFormResponsible(item.responsiblePerson);
    setFormNextReview(new Date(item.nextReviewAt).toISOString().split('T')[0]);
    setFormEvidence(item.evidenceNotes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/admin/governance/legal/${editingId}`, {
          method: 'PATCH',
          body: {
            title: formTitle,
            regulation: formRegulation,
            jurisdiction: formJurisdiction,
            description: formDescription,
            complianceStatus: formStatus,
            responsiblePerson: formResponsible,
            nextReviewAt: new Date(formNextReview).toISOString(),
            evidenceNotes: formEvidence,
          },
        });
      } else {
        await apiRequest('/admin/governance/legal', {
          method: 'POST',
          body: {
            title: formTitle,
            regulation: formRegulation,
            jurisdiction: formJurisdiction,
            description: formDescription,
            complianceStatus: formStatus,
            responsiblePerson: formResponsible,
            nextReviewAt: new Date(formNextReview).toISOString(),
            evidenceNotes: formEvidence,
          },
        });
      }
      setIsModalOpen(false);
      fetchObligations();
    } catch (err) {
      console.error('Failed to save obligation:', err);
      alert('Failed to save legal obligation: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this legal obligation? This action is recorded in the audit log.')) return;
    try {
      await apiRequest(`/admin/governance/legal/${id}`, { method: 'DELETE' });
      fetchObligations();
    } catch (err) {
      console.error('Failed to delete obligation:', err);
      alert('Failed to delete obligation: ' + String(err));
    }
  };

  const filtered = obligations.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.regulation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.responsiblePerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.complianceStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: LegalObligation['complianceStatus']) => {
    switch (status) {
      case 'COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            COMPLIANT
          </span>
        );
      case 'PARTIALLY_COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-3 w-3" />
            PARTIAL
          </span>
        );
      case 'NON_COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
            <AlertCircle className="h-3 w-3" />
            NON-COMPLIANT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
            <Clock className="h-3 w-3" />
            UNDER REVIEW
          </span>
        );
    }
  };

  return (
    <AdminShell
      title="Legal & Regulatory Obligations"
      subtitle="Applicable laws, statutory mandates, and compliance evidence register"
      actions={
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Obligation
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
              placeholder="Search by regulation, title, or owner..."
              className="w-full rounded-xl border border-[#232733] bg-[#12141A] py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:border-[#00F2FE] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#232733] bg-[#12141A] px-3 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="PARTIALLY_COMPLIANT">Partially Compliant</option>
              <option value="NON_COMPLIANT">Non-Compliant</option>
              <option value="UNDER_REVIEW">Under Review</option>
            </select>
          </div>
        </div>

        {/* Obligations Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#232733] bg-[#181B22]/60 text-gray-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Obligation Title & Regulation</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Responsible Owner</th>
                <th className="px-5 py-3.5">Next Review Date</th>
                <th className="px-5 py-3.5">Evidence & Notes</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232733]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    Loading compliance records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No legal obligations found matching criteria. Click &quot;Add Obligation&quot; to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#181B22]/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{item.title}</div>
                      <div className="text-gray-400 text-[11px] mt-0.5 flex items-center gap-1.5">
                        <Scale className="h-3 w-3 text-[#00F2FE]" />
                        {item.regulation} ({item.jurisdiction})
                      </div>
                      <div className="text-gray-500 text-[11px] mt-1 line-clamp-1">{item.description}</div>
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(item.complianceStatus)}</td>
                    <td className="px-5 py-4 text-gray-300 font-medium flex items-center gap-1.5 mt-2">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      {item.responsiblePerson}
                    </td>
                    <td className="px-5 py-4 text-gray-300 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {new Date(item.nextReviewAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-[11px] max-w-xs truncate">
                      {item.evidenceNotes || 'Pending evidence upload'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-[#232733] hover:text-[#00F2FE] transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-[#232733] hover:text-rose-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Create / Edit Obligation */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="h-4 w-4 text-[#00F2FE]" />
                  {editingId ? 'Edit Legal Obligation' : 'Add New Legal Obligation'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300">Obligation Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Consent Records & Transparency Mandate"
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Regulation *</label>
                    <input
                      type="text"
                      required
                      value={formRegulation}
                      onChange={(e) => setFormRegulation(e.target.value)}
                      placeholder="e.g. Proclamation No. 1321/2024"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Jurisdiction</label>
                    <input
                      type="text"
                      value={formJurisdiction}
                      onChange={(e) => setFormJurisdiction(e.target.value)}
                      placeholder="e.g. Ethiopia"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Description *</label>
                  <textarea
                    required
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Mandate details, statutory articles, and processing rules..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Compliance Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    >
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="COMPLIANT">Compliant</option>
                      <option value="PARTIALLY_COMPLIANT">Partially Compliant</option>
                      <option value="NON_COMPLIANT">Non-Compliant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Responsible Person *</label>
                    <input
                      type="text"
                      required
                      value={formResponsible}
                      onChange={(e) => setFormResponsible(e.target.value)}
                      placeholder="e.g. Legal Counsel / DPO"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Next Review Date *</label>
                    <input
                      type="date"
                      required
                      value={formNextReview}
                      onChange={(e) => setFormNextReview(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Evidence Reference</label>
                    <input
                      type="text"
                      value={formEvidence}
                      onChange={(e) => setFormEvidence(e.target.value)}
                      placeholder="Doc ref, audit report, etc."
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
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
                    {isSubmitting ? 'Saving...' : editingId ? 'Update Obligation' : 'Save Obligation'}
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
