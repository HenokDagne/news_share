'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  Filter,
  UserX,
  AlertTriangle,
  UserCheck,
  Shield,
  Trash2,
  Eye,
  X,
  History,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  RotateCcw,
  PowerOff,
} from 'lucide-react';

export default function UsersPage() {
  const { user: currentStaff, hasPermission } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [hasReportsFilter, setHasReportsFilter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // User Dossier Drawer
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // Action Modals State
  const [actionTarget, setActionTarget] = useState<any | null>(null);
  const [actionType, setActionType] = useState<
    'WARN' | 'BAN' | 'UNBAN' | 'DEACTIVATE' | 'ACTIVATE' | 'DELETE' | 'RESTORE' | null
  >(null);

  // Form inputs for actions
  const [reasonInput, setReasonInput] = useState('');
  const [publicReasonInput, setPublicReasonInput] = useState('');
  const [policyRefInput, setPolicyRefInput] = useState('POLICY-GEN-1');
  const [durationDays, setDurationDays] = useState<number | ''>(7);
  const [isPermanent, setIsPermanent] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) q.set('q', search.trim());
      if (statusFilter) q.set('status', statusFilter);
      if (roleFilter) q.set('role', roleFilter);
      if (hasReportsFilter) q.set('hasReports', 'true');

      const res = await apiRequest<{ items?: any[]; data?: any[]; total: number; page: number }>(
        `/admin/users?${q.toString()}`,
      );
      setUsers(res.items || res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, roleFilter, hasReportsFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const loadDossier = async (userId: string) => {
    setDossierLoading(true);
    try {
      const data = await apiRequest(`/admin/users/${userId}`);
      setSelectedUser(data);
    } catch (err) {
      console.error('Failed to load user dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  const executeAction = async () => {
    if (!actionTarget || !actionType) return;
    setActionLoading(true);

    try {
      const id = actionTarget.id;
      if (actionType === 'WARN') {
        await apiRequest(`/admin/users/${id}/warn`, {
          method: 'POST',
          body: JSON.stringify({
            message: reasonInput.trim() || 'Warning: Platform rule violation.',
            policyRef: policyRefInput,
            reason: reasonInput,
          }),
        });
      } else if (actionType === 'BAN') {
        await apiRequest(`/admin/users/${id}/ban`, {
          method: 'POST',
          body: JSON.stringify({
            reason: reasonInput.trim() || 'Violation of terms of service',
            publicReason: publicReasonInput.trim() || 'Account restricted by moderation team',
            durationDays: isPermanent ? undefined : Number(durationDays),
            policyRef: policyRefInput,
          }),
        });
      } else if (actionType === 'UNBAN') {
        await apiRequest(`/admin/users/${id}/unban`, {
          method: 'POST',
          body: JSON.stringify({ reason: reasonInput.trim() || 'Lifting restriction' }),
        });
      } else if (actionType === 'DEACTIVATE') {
        await apiRequest(`/admin/users/${id}/deactivate`, {
          method: 'POST',
          body: JSON.stringify({ reason: reasonInput.trim() || 'Account paused' }),
        });
      } else if (actionType === 'ACTIVATE') {
        await apiRequest(`/admin/users/${id}/activate`, {
          method: 'POST',
          body: JSON.stringify({ reason: reasonInput.trim() || 'Account reactivated' }),
        });
      } else if (actionType === 'DELETE') {
        await apiRequest(`/admin/users/${id}`, {
          method: 'DELETE',
          body: JSON.stringify({
            reason: reasonInput.trim() || 'Account deletion by admin',
            confirmUsername: actionTarget.username,
          }),
        });
      } else if (actionType === 'RESTORE') {
        await apiRequest(`/admin/users/${id}/restore`, {
          method: 'POST',
          body: JSON.stringify({ reason: reasonInput.trim() || 'Account restored by admin' }),
        });
      }

      // Reset
      setActionTarget(null);
      setActionType(null);
      setReasonInput('');
      setPublicReasonInput('');
      fetchUsers();
      if (selectedUser?.id === actionTarget.id) {
        loadDossier(actionTarget.id);
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <AdminShell
      title="User Population Management"
      subtitle="Directory, sanctions management, and user dossier inspection"
    >
      <div className="space-y-6">
        {/* Search & Filter Bar */}
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
                placeholder="Search by username or email..."
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
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="BANNED">BANNED</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="USER">USER</option>
              <option value="MODERATOR">MODERATOR</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={hasReportsFilter}
              onChange={(e) => {
                setHasReportsFilter(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-[#232733] bg-[#181B22] text-[#00F2FE] focus:ring-0"
            />
            <span>Has Reports Filed Against</span>
          </label>
        </div>

        {/* Users Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">User</th>
                  <th className="px-5 py-3.5 font-semibold">Email</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Role</th>
                  <th className="px-5 py-3.5 font-semibold">Reports Against</th>
                  <th className="px-5 py-3.5 font-semibold">Registered</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No matching user records found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-[#181B22]/60 transition-colors cursor-pointer"
                      onClick={() => loadDossier(u.id)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-white border border-[#2B303F]">
                            {u.username?.substring(0, 2).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-white">
                              {u.username}
                            </span>
                            {u.fullName && (
                              <p className="text-[11px] text-gray-400">{u.fullName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-300">
                        {u.email}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded bg-[#232733] px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold">
                        {u.reportsAgainst > 0 ? (
                          <span className="text-rose-400">{u.reportsAgainst}</span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td
                        className="px-5 py-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => loadDossier(u.id)}
                            title="Inspect Dossier"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#232733] hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {hasPermission('USERS_MANAGE') && u.status === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setActionTarget(u);
                                setActionType('WARN');
                              }}
                              title="Issue Warning"
                              className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-950/40"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </button>
                          )}

                          {hasPermission('USERS_BAN') && u.status === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setActionTarget(u);
                                setActionType('BAN');
                              }}
                              title="Suspend or Ban User"
                              className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-950/40"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}

                          {hasPermission('USERS_BAN') &&
                            (u.status === 'BANNED' || u.status === 'SUSPENDED') && (
                              <button
                                onClick={() => {
                                  setActionTarget(u);
                                  setActionType('UNBAN');
                                }}
                                title="Unban User"
                                className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-950/40"
                              >
                                <UserCheck className="h-4 w-4" />
                              </button>
                            )}

                          {hasPermission('USERS_MANAGE') && u.status === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setActionTarget(u);
                                setActionType('DEACTIVATE');
                              }}
                              title="Deactivate Account"
                              className="rounded-lg p-1.5 text-orange-400 hover:bg-orange-950/40"
                            >
                              <PowerOff className="h-4 w-4" />
                            </button>
                          )}

                          {hasPermission('USERS_MANAGE') && u.status === 'DEACTIVATED' && (
                            <button
                              onClick={() => {
                                setActionTarget(u);
                                setActionType('ACTIVATE');
                              }}
                              title="Reactivate Account"
                              className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-950/40"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {hasPermission('USERS_DELETE') && u.status === 'DELETED' && (
                            <button
                              onClick={() => {
                                setActionTarget(u);
                                setActionType('RESTORE');
                              }}
                              title="Restore Deleted User"
                              className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-950/40"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {hasPermission('USERS_DELETE') && u.status !== 'DELETED' && (
                            <button
                              onClick={() => {
                                setActionTarget(u);
                                setActionType('DELETE');
                              }}
                              title="Soft Delete User"
                              className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-950/50 hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#232733] bg-[#181B22] px-5 py-3 text-xs text-gray-400">
            <span>
              Showing page {page} of {totalPages} ({total} total users)
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

      {/* User Dossier Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#232733] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#00F2FE] to-[#FE2C55] text-sm font-bold text-white shadow-lg">
                  {selectedUser.profile?.username?.substring(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedUser.profile?.username || selectedUser.username}
                  </h3>
                  <p className="text-xs text-gray-400">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-[#181B22] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {/* Account Overview */}
              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Account Standing & Telemetry
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Current Status:</span>
                    <div className="mt-1">
                      <StatusBadge status={selectedUser.status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Role:</span>
                    <p className="mt-1 font-semibold text-white">{selectedUser.role}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Posts:</span>
                    <p className="mt-1 font-semibold text-white">
                      {selectedUser.postsCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Reports Against:</span>
                    <p className="mt-1 font-semibold text-rose-400">
                      {selectedUser.reportsAgainst ?? 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <p className="mt-1 text-gray-300">
                      {new Date(selectedUser.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Active:</span>
                    <p className="mt-1 text-gray-300">
                      {selectedUser.lastActiveAt
                        ? new Date(selectedUser.lastActiveAt).toLocaleString()
                        : 'Never recorded'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Restriction */}
              {selectedUser.activeRestriction && (
                <div className="rounded-xl border border-rose-800/60 bg-rose-950/20 p-4">
                  <div className="flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="h-4 w-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Active Sanction: {selectedUser.activeRestriction.type}
                    </h4>
                  </div>
                  <div className="mt-2 text-xs space-y-1">
                    <p className="text-white">
                      <strong>Public Reason:</strong>{' '}
                      {selectedUser.activeRestriction.publicReason || 'None'}
                    </p>
                    <p className="text-gray-400">
                      <strong>Internal Justification:</strong>{' '}
                      {selectedUser.activeRestriction.reason}
                    </p>
                    <p className="text-gray-400">
                      <strong>Expires:</strong>{' '}
                      {selectedUser.activeRestriction.expiresAt
                        ? new Date(selectedUser.activeRestriction.expiresAt).toLocaleString()
                        : 'Permanent (No Expiry)'}
                    </p>
                  </div>
                </div>
              )}

              {/* Warnings History */}
              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Warnings Issued ({selectedUser.warnings?.length || 0})
                </h4>
                <div className="mt-3 space-y-2">
                  {selectedUser.warnings?.length > 0 ? (
                    selectedUser.warnings.map((w: any) => (
                      <div
                        key={w.id}
                        className="rounded-lg border border-[#232733] bg-[#12141A] p-2.5 text-xs"
                      >
                        <p className="text-white font-medium">{w.message}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                          <span>Ref: {w.policyRef || 'GEN'}</span>
                          <span>{new Date(w.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No warnings on record.</p>
                  )}
                </div>
              </div>

              {/* Moderation Actions History */}
              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Moderation Action Log
                </h4>
                <div className="mt-3 space-y-2">
                  {selectedUser.actions?.length > 0 ? (
                    selectedUser.actions.map((a: any) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-[#232733] bg-[#12141A] p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-rose-400">{a.type}</span>
                          <span className="text-[10px] text-gray-500">
                            {new Date(a.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-300">{a.reason}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No moderation actions recorded.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {actionTarget && actionType === 'WARN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Issue Official Warning to @{actionTarget.username}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              The warning message will be sent to the user&apos;s personal notification feed.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-gray-300">Policy Reference Code</label>
                <input
                  type="text"
                  value={policyRefInput}
                  onChange={(e) => setPolicyRefInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300">Warning Message for User</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Explain why this warning is being issued..."
                  className="mt-1 w-full rounded-lg border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setActionType(null)}
                className="rounded-xl border border-[#232733] px-4 py-2 text-xs text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={actionLoading}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400"
              >
                {actionLoading ? 'Issuing...' : 'Issue Warning'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionTarget && actionType === 'BAN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Suspend / Ban User @{actionTarget.username}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              Revokes active sessions immediately and blocks future authentications.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[#232733] bg-[#181B22] p-3 text-xs">
                <span>Permanent Ban</span>
                <input
                  type="checkbox"
                  checked={isPermanent}
                  onChange={(e) => setIsPermanent(e.target.checked)}
                  className="h-4 w-4 rounded border-[#232733] bg-[#12141A] text-rose-500"
                />
              </div>

              {!isPermanent && (
                <div>
                  <label className="text-xs text-gray-300">Duration (Days)</label>
                  <select
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white"
                  >
                    <option value={1}>1 Day</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-300">Public Reason (Shown to User)</label>
                <input
                  type="text"
                  value={publicReasonInput}
                  onChange={(e) => setPublicReasonInput(e.target.value)}
                  placeholder="e.g. Repeated violation of harassment guidelines"
                  className="mt-1 w-full rounded-lg border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300">Internal Justification (Staff Audit)</label>
                <textarea
                  rows={2}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Internal audit notes..."
                  className="mt-1 w-full rounded-lg border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setActionType(null)}
                className="rounded-xl border border-[#232733] px-4 py-2 text-xs text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={actionLoading}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                {actionLoading ? 'Applying...' : isPermanent ? 'Ban Permanently' : 'Apply Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal for delete */}
      <ConfirmModal
        isOpen={Boolean(actionTarget && actionType === 'DELETE')}
        title={`Soft Delete @${actionTarget?.username}?`}
        description="The user account will be soft-deleted. Posts will be removed and sessions revoked. Preserved for audit retention."
        confirmWord={actionTarget?.username}
        confirmLabel="Soft Delete Account"
        isDestructive
        isLoading={actionLoading}
        onConfirm={executeAction}
        onClose={() => setActionType(null)}
      />

      {/* Confirm modal for unban */}
      <ConfirmModal
        isOpen={Boolean(actionTarget && actionType === 'UNBAN')}
        title={`Lift Sanction on @${actionTarget?.username}?`}
        description="This will lift the active ban or suspension, returning the account to ACTIVE standing."
        confirmLabel="Lift Sanction & Restore"
        isLoading={actionLoading}
        onConfirm={executeAction}
        onClose={() => setActionType(null)}
      />

      {/* Confirm modal for deactivate */}
      <ConfirmModal
        isOpen={Boolean(actionTarget && actionType === 'DEACTIVATE')}
        title={`Deactivate Account @${actionTarget?.username}?`}
        description="This will temporarily pause the user account. The user will be unable to log in until reactivated."
        confirmLabel="Deactivate Account"
        isDestructive
        isLoading={actionLoading}
        onConfirm={executeAction}
        onClose={() => setActionType(null)}
      />

      {/* Confirm modal for activate */}
      <ConfirmModal
        isOpen={Boolean(actionTarget && actionType === 'ACTIVATE')}
        title={`Reactivate Account @${actionTarget?.username}?`}
        description="This will restore the deactivated account back to ACTIVE standing."
        confirmLabel="Reactivate Account"
        isLoading={actionLoading}
        onConfirm={executeAction}
        onClose={() => setActionType(null)}
      />

      {/* Confirm modal for restore */}
      <ConfirmModal
        isOpen={Boolean(actionTarget && actionType === 'RESTORE')}
        title={`Restore Soft-Deleted @${actionTarget?.username}?`}
        description="This restores the soft-deleted user and recovers their account during the 30-day grace period."
        confirmLabel="Restore User Account"
        isLoading={actionLoading}
        onConfirm={executeAction}
        onClose={() => setActionType(null)}
      />
    </AdminShell>
  );
}
