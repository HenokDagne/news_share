'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldAlert,
  Clock,
  RotateCcw,
  UserCheck,
  FileText,
  History,
  CheckCircle,
  ExternalLink,
  Search,
} from 'lucide-react';
import Link from 'next/link';

export default function ModerationPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'RESTRICTIONS' | 'REMOVED_POSTS' | 'ACTIONS'>('QUEUE');

  // Queue State
  const [queue, setQueue] = useState<any[]>([]);

  // Restrictions State
  const [restrictions, setRestrictions] = useState<any[]>([]);

  // Removed Posts State
  const [removedPosts, setRemovedPosts] = useState<any[]>([]);
  const [restoreTargetPost, setRestoreTargetPost] = useState<any | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Actions History State
  const [actions, setActions] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const fetchTabData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'QUEUE') {
        const res = await apiRequest<any[]>('/admin/moderation/queue');
        setQueue(res || []);
      } else if (activeTab === 'RESTRICTIONS') {
        const res = await apiRequest<any[]>('/admin/moderation/restrictions?active=true');
        setRestrictions(res || []);
      } else if (activeTab === 'REMOVED_POSTS') {
        const res = await apiRequest<any[]>('/admin/moderation/removed-posts');
        setRemovedPosts(res || []);
      } else if (activeTab === 'ACTIONS') {
        const res = await apiRequest<any[]>('/admin/moderation/actions');
        setActions(res || []);
      }
    } catch (err) {
      console.error('Failed to fetch moderation tab data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  const handleRestorePost = async () => {
    if (!restoreTargetPost) return;
    setRestoreLoading(true);
    try {
      await apiRequest(`/admin/posts/${restoreTargetPost.id}/restore`, {
        method: 'POST',
      });
      alert('Post restored to public visibility.');
      setRestoreTargetPost(null);
      fetchTabData();
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleLiftRestriction = async (userId: string) => {
    if (!confirm('Are you sure you want to lift this restriction?')) return;
    try {
      await apiRequest(`/admin/users/${userId}/unban`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Restriction lifted from Moderation Hub' }),
      });
      alert('Restriction lifted successfully.');
      fetchTabData();
    } catch (err: any) {
      alert(`Failed to lift restriction: ${err.message}`);
    }
  };

  return (
    <AdminShell
      title="Content Moderation Hub"
      subtitle="Moderation queue triage, active sanctions monitoring, removed content, and decision history"
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#232733] pb-px">
          {[
            { key: 'QUEUE', label: 'Triage Queue', count: queue.length },
            { key: 'RESTRICTIONS', label: 'Active Sanctions', count: restrictions.length },
            { key: 'REMOVED_POSTS', label: 'Removed Posts Archive', count: removedPosts.length },
            { key: 'ACTIONS', label: 'Decision Audit History', count: actions.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'border-[#00F2FE] text-[#00F2FE]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-[#181B22] px-2 py-0.5 text-[10px] text-gray-300">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tab 1: Queue */}
        {activeTab === 'QUEUE' && (
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">
              Open Case Queue (Sorted by Priority Score)
            </h3>
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-gray-500">Loading queue...</div>
              ) : queue.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  Queue is clear! No active pending cases.
                </div>
              ) : (
                queue.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-[#232733] bg-[#181B22] p-4 transition-colors hover:border-[#2B303F]"
                  >
                    <div className="flex items-center gap-4">
                      <PriorityBadge priority={c.priorityScore} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {c.targetType}: @{c.targetUser?.username}
                          </span>
                          <span className="rounded bg-[#232733] px-2 py-0.5 text-[10px] text-gray-300">
                            {c.reportCount} reports
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                          Top Reason: <strong className="text-gray-200">{c.topReason}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{Math.round(c.slaAgeHours || 0)}h open</span>
                      </div>
                      <Link
                        href={`/reports?caseId=${c.id}`}
                        className="rounded-xl bg-[#00F2FE] px-3.5 py-1.5 text-xs font-bold text-black hover:bg-[#25F4EE]"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Active Restrictions */}
        {activeTab === 'RESTRICTIONS' && (
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#232733]">
              <h3 className="text-base font-bold text-white">
                Active Enforcements & Sanctions
              </h3>
              <p className="text-xs text-gray-400">
                Temporary suspensions and permanent account bans currently in effect
              </p>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Sanction Type</th>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Public Reason</th>
                  <th className="px-5 py-3 font-semibold">Internal Reason</th>
                  <th className="px-5 py-3 font-semibold">Starts At</th>
                  <th className="px-5 py-3 font-semibold">Expires At</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {restrictions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No active sanctions recorded.
                    </td>
                  </tr>
                ) : (
                  restrictions.map((r) => (
                    <tr key={r.id} className="hover:bg-[#181B22]/50">
                      <td className="px-5 py-3.5">
                        <StatusBadge status={r.type} />
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white">
                        @{r.user?.username || r.userId.substring(0, 8)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-300">{r.publicReason || 'None'}</td>
                      <td className="px-5 py-3.5 text-gray-400">{r.reason}</td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {new Date(r.startsAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : 'Permanent'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {hasPermission('USERS_BAN') && (
                          <button
                            onClick={() => handleLiftRestriction(r.userId)}
                            className="rounded-lg bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/60"
                          >
                            Lift Sanction
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Removed Posts */}
        {activeTab === 'REMOVED_POSTS' && (
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#232733]">
              <h3 className="text-base font-bold text-white">
                Archived & Removed Post Catalog
              </h3>
              <p className="text-xs text-gray-400">
                Posts removed by moderation team. Media retained for evidence retention period.
              </p>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Post Title</th>
                  <th className="px-5 py-3 font-semibold">Author</th>
                  <th className="px-5 py-3 font-semibold">Removal Policy Reason</th>
                  <th className="px-5 py-3 font-semibold">Removed Date</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {removedPosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No posts currently marked as removed.
                    </td>
                  </tr>
                ) : (
                  removedPosts.map((p) => (
                    <tr key={p.id} className="hover:bg-[#181B22]/50">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-white">{p.title || 'Untitled Post'}</span>
                        <p className="text-[11px] text-gray-400 line-clamp-1">{p.content}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-300">
                        @{p.author?.username || p.author?.profile?.username}
                      </td>
                      <td className="px-5 py-3.5 text-rose-400 font-medium">
                        {p.removalReason || 'Violation of terms'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {p.removedAt ? new Date(p.removedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {hasPermission('POSTS_REMOVE') && (
                          <button
                            onClick={() => setRestoreTargetPost(p)}
                            className="flex items-center gap-1.5 ml-auto rounded-lg bg-[#232733] px-3 py-1 text-xs font-semibold text-white hover:bg-[#00F2FE] hover:text-black transition-colors"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restore Post</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Action History */}
        {activeTab === 'ACTIONS' && (
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#232733]">
              <h3 className="text-base font-bold text-white">
                Historical Moderation Audit Trail
              </h3>
              <p className="text-xs text-gray-400">
                Log of all enforcement decisions, content removals, warnings, and sanctions
              </p>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Target User</th>
                  <th className="px-5 py-3 font-semibold">Policy Ref</th>
                  <th className="px-5 py-3 font-semibold">Internal Reason</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {actions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No moderation actions recorded yet.
                    </td>
                  </tr>
                ) : (
                  actions.map((a) => (
                    <tr key={a.id} className="hover:bg-[#181B22]/50">
                      <td className="px-5 py-3.5 font-bold text-white">
                        <StatusBadge status={a.type} />
                      </td>
                      <td className="px-5 py-3.5 text-gray-300">
                        @{a.targetUser?.username || a.targetUserId?.substring(0, 8)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-400">
                        {a.policyRef || 'GEN-1'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">{a.reason}</td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Restore Post Modal */}
      <ConfirmModal
        isOpen={Boolean(restoreTargetPost)}
        title={`Restore Post "${restoreTargetPost?.title || 'Selected Post'}"?`}
        description="Restoring this post will return it to active public visibility across user feeds and profiles."
        confirmLabel="Restore Post to Platform"
        isLoading={restoreLoading}
        onConfirm={handleRestorePost}
        onClose={() => setRestoreTargetPost(null)}
      />
    </AdminShell>
  );
}
