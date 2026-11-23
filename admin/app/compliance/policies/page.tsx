'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  History,
  Send,
  Eye,
  Calendar,
  Layers,
  Archive,
} from 'lucide-react';

interface PolicyVersion {
  id: string;
  versionNumber: string;
  changeSummary: string;
  publishedAt: string;
}

interface SecurityPolicy {
  id: string;
  title: string;
  code: string;
  category: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  currentVersion: string;
  summary: string;
  content: string;
  publishedAt: string | null;
  nextReviewDate: string;
  createdAt: string;
  versions?: PolicyVersion[];
}

export default function SecurityPoliciesPage() {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null);

  // Create Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCode, setFormCode] = useState('POL-SEC-');
  const [formCategory, setFormCategory] = useState('Information Security');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formNextReview, setFormNextReview] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');

  // New Version Form State
  const [newVersionNum, setNewVersionNum] = useState('');
  const [versionSummary, setVersionSummary] = useState('');
  const [versionContent, setVersionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<SecurityPolicy[]>('/admin/governance/policies');
      setPolicies(data);
    } catch (err) {
      console.error('Failed to load security policies:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleOpenCreate = () => {
    setFormTitle('');
    setFormCode(`POL-SEC-00${policies.length + 1}`);
    setFormCategory('Information Security');
    setFormSummary('');
    setFormContent('');
    setFormNextReview(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormStatus('PUBLISHED');
    setIsCreateModalOpen(true);
  };

  const handleOpenPublishVersion = (p: SecurityPolicy) => {
    setSelectedPolicy(p);
    const parts = p.currentVersion.split('.');
    const nextMinor = `${parts[0] || '1'}.${Number(parts[1] || 0) + 1}.0`;
    setNewVersionNum(nextMinor);
    setVersionSummary('');
    setVersionContent(p.content);
    setIsVersionModalOpen(true);
  };

  const handleOpenView = (p: SecurityPolicy) => {
    setSelectedPolicy(p);
    setIsViewModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest('/admin/governance/policies', {
        method: 'POST',
        body: {
          title: formTitle,
          code: formCode,
          category: formCategory,
          summary: formSummary,
          content: formContent,
          nextReviewDate: new Date(formNextReview).toISOString(),
          status: formStatus,
        },
      });
      setIsCreateModalOpen(false);
      fetchPolicies();
    } catch (err) {
      alert('Failed to create policy: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/governance/policies/${selectedPolicy.id}/versions`, {
        method: 'POST',
        body: {
          versionNumber: newVersionNum,
          content: versionContent,
          changeSummary: versionSummary,
        },
      });
      setIsVersionModalOpen(false);
      fetchPolicies();
    } catch (err) {
      alert('Failed to publish version: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = policies.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(policies.map((p) => p.category)));

  return (
    <AdminShell
      title="Security Policies & AUP"
      subtitle="Publish, version, review, and track organizational security policies"
      actions={
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Create Policy
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
              placeholder="Search by policy code, title, or category..."
              className="w-full rounded-xl border border-[#232733] bg-[#12141A] py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:border-[#00F2FE] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[#232733] bg-[#12141A] px-3 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Policies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-xs text-gray-500">
              Loading security policies...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-gray-500">
              No policies found. Click &quot;Create Policy&quot; to initialize an AUP or Security Policy.
            </div>
          ) : (
            filtered.map((policy) => (
              <div
                key={policy.id}
                className="flex flex-col justify-between rounded-2xl border border-[#232733] bg-[#12141A] p-5 hover:border-[#00F2FE]/30 transition-all hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-block rounded-md bg-[#232733] px-2 py-0.5 text-[10px] font-mono font-bold text-[#00F2FE]">
                      {policy.code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        policy.status === 'PUBLISHED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : policy.status === 'DRAFT'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}
                    >
                      {policy.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mt-3 line-clamp-1">{policy.title}</h3>
                  <p className="text-[11px] text-[#00F2FE]/80 font-medium mt-0.5">{policy.category}</p>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{policy.summary}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#232733]/80 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Layers className="h-3.5 w-3.5 text-gray-500" />
                      v{policy.currentVersion}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Calendar className="h-3 w-3 text-gray-500" />
                      Next Review: {new Date(policy.nextReviewDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenView(policy)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#232733] bg-[#181B22] py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#00F2FE]" />
                      Read
                    </button>
                    <button
                      onClick={() => handleOpenPublishVersion(policy)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00F2FE]/20 to-[#FE2C55]/20 border border-[#00F2FE]/40 py-1.5 text-xs font-bold text-[#00F2FE] hover:bg-[#00F2FE]/30 transition-all"
                    >
                      <Send className="h-3.5 w-3.5" />
                      New Version
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Create Policy */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#00F2FE]" />
                  Create Security Policy
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3.5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-300">Policy Title *</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Acceptable Use Policy (AUP)"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Policy Code *</label>
                    <input
                      type="text"
                      required
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="POL-AUP-001"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Category *</label>
                    <input
                      type="text"
                      required
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g. Data Retention, AUP, Access Control"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Executive Summary *</label>
                  <input
                    type="text"
                    required
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Short summary for staff and auditors..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Policy Text / Rules (Markdown Supported) *</label>
                  <textarea
                    required
                    rows={6}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Full policy provisions, acceptable user requirements, prohibited behaviors, and enforcement..."
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white font-mono focus:border-[#00F2FE] focus:outline-none"
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
                    {isSubmitting ? 'Creating...' : 'Create & Publish Policy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Publish New Version */}
        {isVersionModalOpen && selectedPolicy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-[#00F2FE]" />
                  Publish New Version: {selectedPolicy.code}
                </h3>
                <button onClick={() => setIsVersionModalOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleVersionSubmit} className="mt-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Target Version Number *</label>
                    <input
                      type="text"
                      required
                      value={newVersionNum}
                      onChange={(e) => setNewVersionNum(e.target.value)}
                      placeholder="e.g. 1.1.0"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300">Change Summary *</label>
                    <input
                      type="text"
                      required
                      value={versionSummary}
                      onChange={(e) => setVersionSummary(e.target.value)}
                      placeholder="e.g. Updated retention terms for user deletion"
                      className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:border-[#00F2FE] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300">Revised Policy Content *</label>
                  <textarea
                    required
                    rows={8}
                    value={versionContent}
                    onChange={(e) => setVersionContent(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white font-mono focus:border-[#00F2FE] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232733]">
                  <button
                    type="button"
                    onClick={() => setIsVersionModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish Version & Append Audit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Policy Content */}
        {isViewModalOpen && selectedPolicy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#232733] bg-[#12141A] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#232733] p-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#00F2FE]" />
                    {selectedPolicy.title}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {selectedPolicy.code} • Version {selectedPolicy.currentVersion} • Category: {selectedPolicy.category}
                  </p>
                </div>
                <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="rounded-xl bg-[#181B22] p-3 text-xs text-gray-300 border border-[#232733]">
                  <span className="font-bold text-white">Summary: </span>
                  {selectedPolicy.summary}
                </div>
                <div className="prose prose-invert max-w-none text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {selectedPolicy.content}
                </div>
              </div>

              <div className="border-t border-[#232733] p-4 flex justify-end">
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="rounded-xl bg-[#181B22] px-4 py-2 text-xs font-bold text-white border border-[#232733] hover:border-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
