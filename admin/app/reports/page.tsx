'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
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
  ChevronRight,
  ArrowUpDown,
  Layers,
  Calendar,
} from 'lucide-react';

function ReportsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user: currentStaff, hasPermission } = useAuth();

  const [targets, setTargets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastReportedAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTargets = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sortBy,
        order: sortOrder,
      });
      if (statusFilter) q.set('status', statusFilter);
      if (priorityFilter) q.set('priority', priorityFilter);
      if (targetTypeFilter) q.set('targetType', targetTypeFilter);
      if (search.trim()) q.set('q', search.trim());

      const res = await apiRequest<{ items?: any[]; data?: any[]; total: number }>(
        `/admin/report-cases?${q.toString()}`,
      );
      setTargets(res.items || res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load report targets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, priorityFilter, targetTypeFilter, sortBy, sortOrder, search]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <AdminShell
      title="Report Page"
      subtitle="Aggregated incident targets, violation categorization, and moderation management"
    >
      <div className="space-y-6">
        {/* KPI / OVERVIEW CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Reported Targets</span>
              <Layers className="h-4 w-4 text-[#00F2FE]" />
            </div>
            <div className="mt-2 text-2xl font-black text-white font-mono">{total}</div>
            <p className="mt-1 text-xs text-gray-500">Unique posts & accounts reported</p>
          </div>

          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Targets</span>
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-400 font-mono">
              {targets.filter((t) => t.status === 'PENDING' || t.status === 'UNDER_REVIEW').length}
            </div>
            <p className="mt-1 text-xs text-gray-500">Currently pending or under review</p>
          </div>

          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Reports Count</span>
              <Flag className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-rose-400 font-mono">
              {targets.reduce((acc, t) => acc + (t.reportCount || 1), 0)}
            </div>
            <p className="mt-1 text-xs text-gray-500">Cumulative user reports in view</p>
          </div>

          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Resolved Targets</span>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">
              {targets.filter((t) => t.status === 'ACTION_TAKEN' || t.status === 'RESOLVED').length}
            </div>
            <p className="mt-1 text-xs text-gray-500">Actioned or mitigated</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#232733] bg-[#12141A] p-4 lg:flex-row lg:items-center lg:justify-between shadow-lg">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by target user, title, content, or ID..."
                className="w-full rounded-xl border border-[#232733] bg-[#181B22] pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:border-[#00F2FE] focus:outline-none transition-colors"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="ACTION_TAKEN">ACTION_TAKEN</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="REJECTED">DISMISSED / REJECTED</option>
            </select>

            {/* Target Type Filter */}
            <select
              value={targetTypeFilter}
              onChange={(e) => {
                setTargetTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Target Types</option>
              <option value="POST">Post Submissions</option>
              <option value="USER">User Accounts</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white focus:outline-none"
            >
              <option value="lastReportedAt">Sort: Latest Reported</option>
              <option value="reportCount">Sort: Most Reported</option>
              <option value="firstReportedAt">Sort: Earliest Reported</option>
              <option value="priorityScore">Sort: Highest Priority</option>
            </select>
          </div>
        </div>

        {/* Aggregated Reports Table (One Row Per Target) */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Priority</th>
                  <th className="px-5 py-3.5 font-semibold">Reported Target Content</th>
                  <th className="px-5 py-3.5 font-semibold">Target Account</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Reports Count</th>
                  <th className="px-5 py-3.5 font-semibold">Violation Categories</th>
                  <th className="px-5 py-3.5 font-semibold">Timeline</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-gray-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
                      <p className="mt-2 text-xs text-gray-400">Aggregating reported targets from database...</p>
                    </td>
                  </tr>
                ) : targets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-gray-500">
                      <CheckCircle className="mx-auto h-8 w-8 text-emerald-400/50 mb-2" />
                      <p className="text-sm font-bold text-gray-300">No report cases found</p>
                      <p className="mt-1 text-xs text-gray-500">There are no reported targets matching your current filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  targets.map((t) => {
                    const targetProfile = t.targetUser?.profile || {};
                    const username = targetProfile.username || t.targetUsername || 'user';
                    const avatarUrl = targetProfile.avatarUrl || t.targetUserAvatar;
                    const reportCount = t.reportCount || t.totalReportsCount || 1;

                    return (
                      <tr
                        key={t.id}
                        onClick={() => router.push(`/reports/${t.id}`)}
                        className="hover:bg-[#181B22]/70 transition-colors cursor-pointer group"
                      >
                        {/* Priority Badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <PriorityBadge priority={t.priorityScore} />
                        </td>

                        {/* Reported Content Preview & Target Type */}
                        <td className="px-5 py-3.5 max-w-xs">
                          <div className="flex items-start gap-3">
                            {t.targetImageUrl && (
                              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-[#232733] bg-black">
                                <img
                                  src={t.targetImageUrl}
                                  alt="Thumbnail"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  t.targetType === 'POST'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                }`}>
                                  {t.targetType === 'POST' ? <FileText className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                  {t.targetType}
                                </span>
                              </div>
                              <p className="font-semibold text-white truncate text-xs group-hover:text-[#00F2FE] transition-colors">
                                {t.targetTitle || t.targetContent || (t.targetType === 'POST' ? 'Untitled post' : `@${username}`)}
                              </p>
                              {t.targetContent && t.targetTitle && (
                                <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                  {t.targetContent}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Reported Target Account */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden flex-shrink-0">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
                              ) : (
                                username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-200">@{username}</div>
                              {t.targetUser?.email && (
                                <div className="text-[10px] text-gray-500">{t.targetUser.email}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Reports Count (Combined for this target) */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-black text-rose-400 border border-rose-500/20 font-mono">
                            <Flag className="h-3 w-3" />
                            {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                          </span>
                        </td>

                        {/* Violation Categories */}
                        <td className="px-5 py-3.5 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            <span className="rounded bg-[#232733] px-2 py-0.5 text-[11px] font-bold text-gray-200">
                              {t.topReason || 'GENERAL'}
                            </span>
                            {t.reasonsBreakdown && t.reasonsBreakdown.length > 1 && (
                              <span className="rounded bg-[#181B22] border border-[#232733] px-1.5 py-0.5 text-[10px] text-gray-400">
                                +{t.reasonsBreakdown.length - 1} more
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Timeline (First & Latest Reported) */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-gray-400">
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <Clock className="h-3 w-3 text-cyan-400" />
                            <span>{new Date(t.lastReportedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            First: {new Date(t.firstReportedAt).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Overall Status */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <StatusBadge status={t.status} />
                        </td>

                        {/* Action: Open Report Detail Page */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            href={`/reports/${t.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#232733] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#00F2FE] hover:text-black transition-colors shadow-sm"
                          >
                            <span>Review Dossier</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-[#232733] bg-[#181B22] px-5 py-3.5 text-xs text-gray-400">
            <span>
              Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({total} unique reported targets)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-[#232733] bg-[#12141A] px-3.5 py-1.5 font-medium text-white hover:bg-[#232733] disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-[#232733] bg-[#12141A] px-3.5 py-1.5 font-medium text-white hover:bg-[#232733] disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <AdminShell title="Report Page" subtitle="Loading reports queue...">
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
          </div>
        </AdminShell>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
