'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  UserPlus,
  Shield,
  Key,
  Check,
  X,
  Mail,
  UserCheck,
  UserX,
  Lock,
} from 'lucide-react';

interface StaffUser {
  id: string;
  email: string;
  username: string;
  role: 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  status: string;
  permissions: string[];
  createdAt: string;
  lastActiveAt?: string;
}

export default function StaffPage() {
  const { user: currentStaff, hasPermission } = useAuth();

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [catalog, setCatalog] = useState<{
    permissions: string[];
    presets: Record<string, string[]>;
    labels: Record<string, string>;
    sensitive: string[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Invite Staff Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<'MODERATOR' | 'ADMIN'>('MODERATOR');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Edit Staff Modal
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editRole, setEditRole] = useState<'MODERATOR' | 'ADMIN'>('MODERATOR');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const fetchStaffData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, catRes] = await Promise.all([
        apiRequest<StaffUser[]>('/admin/admins'),
        apiRequest<any>('/admin/permissions'),
      ]);
      setStaffList(staffRes || []);
      setCatalog(catRes);
      if (catRes?.presets?.MODERATOR) {
        setSelectedPermissions(catRes.presets.MODERATOR);
      }
    } catch (err) {
      console.error('Failed to load staff data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const handleRoleChange = (role: 'MODERATOR' | 'ADMIN') => {
    setInviteRole(role);
    if (catalog?.presets?.[role]) {
      setSelectedPermissions(catalog.presets[role]);
    }
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const toggleEditPermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteResult(null);

    try {
      const res = await apiRequest('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          username: inviteUsername.trim() || undefined,
          role: inviteRole,
          permissions: selectedPermissions,
        }),
      });

      setInviteResult(res.message || 'Staff member invited successfully.');
      setInviteEmail('');
      setInviteUsername('');
      fetchStaffData();
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteResult(null);
      }, 2000);
    } catch (err: any) {
      alert(`Invite failed: ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditLoading(true);

    try {
      await apiRequest(`/admin/admins/${editingStaff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: editRole,
          permissions: editPermissions,
        }),
      });
      alert('Staff privileges updated. Their active sessions have been revoked.');
      setEditingStaff(null);
      fetchStaffData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  const toggleStaffStatus = async (staff: StaffUser) => {
    const isDeactivating = staff.status === 'ACTIVE';
    const action = isDeactivating ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} staff member ${staff.username}?`)) return;

    try {
      await apiRequest(`/admin/admins/${staff.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: `${action} via staff console` }),
      });
      alert(`Staff member ${action}d.`);
      fetchStaffData();
    } catch (err: any) {
      alert(`Failed to ${action} staff: ${err.message}`);
    }
  };

  return (
    <AdminShell
      title="Staff Administrators & Permissions"
      subtitle="Role-based access governance, invite workflows, and granular permission enforcement"
      actions={
        hasPermission('ADMINS_MANAGE') && (
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#25F4EE] px-4 py-2 text-xs font-bold text-black hover:opacity-90 shadow-lg shadow-cyan-500/20"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite Staff Admin</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        {/* Staff Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Staff Member</th>
                <th className="px-5 py-3.5 font-semibold">Email</th>
                <th className="px-5 py-3.5 font-semibold">Role</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Active Permissions</th>
                <th className="px-5 py-3.5 font-semibold">Last Active</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232733]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    Loading staff directory...
                  </td>
                </tr>
              ) : (
                staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-[#181B22]/50">
                    <td className="px-5 py-3.5 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-white border border-[#2B303F]">
                          {s.username?.substring(0, 2).toUpperCase()}
                        </div>
                        <span>@{s.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-gray-300">{s.email}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          s.role === 'SUPER_ADMIN'
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                            : s.role === 'ADMIN'
                            ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800/80'
                        }`}
                      >
                        {s.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      {s.role === 'SUPER_ADMIN' ? (
                        <span className="text-[11px] font-semibold text-purple-400">
                          ALL PERMISSIONS (ROOT)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {s.permissions?.map((p) => (
                            <span
                              key={p}
                              className="rounded bg-[#232733] px-1.5 py-0.2 text-[9px] text-gray-300"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">
                      {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {hasPermission('ADMINS_MANAGE') && s.role !== 'SUPER_ADMIN' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingStaff(s);
                              setEditRole(s.role as any);
                              setEditPermissions(s.permissions || []);
                            }}
                            className="rounded-lg bg-[#232733] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#00F2FE] hover:text-black transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleStaffStatus(s)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                              s.status === 'ACTIVE'
                                ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60 hover:bg-rose-900/60'
                                : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/60'
                            }`}
                          >
                            {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Staff Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#232733] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#00F2FE]" />
                Invite Staff Administrator
              </h3>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteResult && (
              <div className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3 text-xs text-emerald-400">
                {inviteResult}
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-gray-300">Staff Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="moderator@newsshare.com"
                  className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:border-[#00F2FE] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300">Username (Optional)</label>
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="mod_alex"
                  className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:border-[#00F2FE] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300">Role Designation</label>
                <div className="mt-1 flex gap-3">
                  {(['MODERATOR', 'ADMIN'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                        inviteRole === r
                          ? 'border-[#00F2FE] bg-[#00F2FE]/15 text-[#00F2FE]'
                          : 'border-[#232733] bg-[#181B22] text-gray-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <label className="text-xs text-gray-300">
                  Granular Permissions ({selectedPermissions.length} selected)
                </label>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-[#232733] bg-[#181B22] p-3">
                  {catalog?.permissions?.map((p) => {
                    const isSensitive = catalog.sensitive?.includes(p);
                    const isChecked = selectedPermissions.includes(p);
                    const isDisabled = isSensitive && currentStaff?.role !== 'SUPER_ADMIN';

                    return (
                      <label
                        key={p}
                        className={`flex items-center justify-between rounded-lg p-1.5 text-xs ${
                          isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#232733] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => togglePermission(p)}
                            className="rounded border-[#232733] bg-[#12141A] text-[#00F2FE]"
                          />
                          <span className="text-white font-mono text-[11px]">{p}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {catalog.labels?.[p]}
                          {isSensitive && ' (Sensitive)'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-3 text-[11px] text-gray-400">
                Notice: The invitee receives an invitation email with a 48h reset token to configure their own permanent password. No passwords are displayed or sent in cleartext.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="rounded-xl border border-[#232733] px-4 py-2 text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="rounded-xl bg-[#00F2FE] px-4 py-2 text-xs font-bold text-black hover:bg-[#25F4EE]"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#232733] pb-3">
              <h3 className="text-base font-bold text-white">
                Edit Staff: @{editingStaff.username}
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-gray-300">Role</label>
                <div className="mt-1 flex gap-3">
                  {(['MODERATOR', 'ADMIN'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditRole(r)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                        editRole === r
                          ? 'border-[#00F2FE] bg-[#00F2FE]/15 text-[#00F2FE]'
                          : 'border-[#232733] bg-[#181B22] text-gray-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-300">Permissions</label>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-[#232733] bg-[#181B22] p-3">
                  {catalog?.permissions?.map((p) => {
                    const isSensitive = catalog.sensitive?.includes(p);
                    const isChecked = editPermissions.includes(p);
                    const isDisabled = isSensitive && currentStaff?.role !== 'SUPER_ADMIN';

                    return (
                      <label
                        key={p}
                        className={`flex items-center justify-between rounded-lg p-1.5 text-xs ${
                          isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#232733] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => toggleEditPermission(p)}
                            className="rounded border-[#232733] bg-[#12141A] text-[#00F2FE]"
                          />
                          <span className="text-white font-mono text-[11px]">{p}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {catalog.labels?.[p]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-xl border border-[#232733] px-4 py-2 text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-[#00F2FE] px-4 py-2 text-xs font-bold text-black hover:bg-[#25F4EE]"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
