'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge } from '@/components/ui/status-badge';
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
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface StaffUser {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' | 'AUDITOR';
  status: string;
  permissions: string[];
  createdAt: string;
  lastActiveAt?: string;
}

interface RoleChangeRequest {
  id: string;
  userId: string;
  currentRole: string;
  requestedRole: string;
  justification: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  requester: {
    id: string;
    email: string;
    profile?: { username: string; fullName?: string };
  };
  reviewer?: {
    id: string;
    email: string;
    profile?: { username: string };
  };
}

interface AccessReviewCampaign {
  id: string;
  name: string;
  quarter: string;
  year: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  completedAt?: string;
  conductedBy: string;
  decisionsCount: number;
  notes?: string;
}

interface CampaignDetails {
  campaign: AccessReviewCampaign;
  privilegedUsersCount: number;
  decisionsRecordedCount: number;
  privilegedUsers: Array<{
    id: string;
    email: string;
    username: string;
    fullName?: string;
    role: string;
    permissions: string[];
    lastLoginAt?: string;
    lastActiveAt?: string;
    inactiveDays: number;
    isInactiveRisk: boolean;
    reviewDecision?: {
      decision: 'MAINTAIN' | 'REVOKE' | 'MODIFY';
      decisionReason: string;
      reviewedAt: string;
      reviewedBy: string;
    } | null;
  }>;
}

interface RoleAuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  username?: string;
  resource?: string;
  encryptedData?: string;
}

export default function StaffPage() {
  const { user: currentStaff, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<'staff' | 'requests' | 'reviews' | 'audit'>('staff');

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [catalog, setCatalog] = useState<{
    permissions: Array<{ code: string; label: string; sensitive: boolean }>;
    presets: Record<string, string[]>;
  } | null>(null);

  const [requests, setRequests] = useState<RoleChangeRequest[]>([]);
  const [campaigns, setCampaigns] = useState<AccessReviewCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetails | null>(null);
  const [roleAuditLogs, setRoleAuditLogs] = useState<RoleAuditLog[]>([]);

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

  // Review Request Modal
  const [reviewingRequest, setReviewingRequest] = useState<RoleChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Start Campaign Modal
  const [isStartCampaignOpen, setIsStartCampaignOpen] = useState(false);
  const [campaignQuarter, setCampaignQuarter] = useState('Q4-2026');
  const [campaignYear, setCampaignYear] = useState(2026);
  const [campaignNotes, setCampaignNotes] = useState('');
  const [campaignLoading, setCampaignLoading] = useState(false);

  // Record Decision Modal
  const [decisionCandidate, setDecisionCandidate] = useState<any>(null);
  const [decisionAction, setDecisionAction] = useState<'MAINTAIN' | 'REVOKE' | 'MODIFY'>('MAINTAIN');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

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

  const fetchRoleRequests = useCallback(async () => {
    try {
      const data = await apiRequest<RoleChangeRequest[]>('/admin/roles/requests');
      setRequests(data || []);
    } catch (err) {
      console.error('Failed to load role requests:', err);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await apiRequest<AccessReviewCampaign[]>('/admin/roles/access-reviews/campaigns');
      setCampaigns(data || []);
      if (data && data.length > 0) {
        const details = await apiRequest<CampaignDetails>(
          `/admin/roles/access-reviews/campaigns/${data[0].id}`,
        );
        setSelectedCampaign(details);
      }
    } catch (err) {
      console.error('Failed to load access review campaigns:', err);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const data = await apiRequest<RoleAuditLog[]>('/admin/roles/audit');
      setRoleAuditLogs(data || []);
    } catch (err) {
      console.error('Failed to load role audit logs:', err);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  useEffect(() => {
    if (activeTab === 'requests') fetchRoleRequests();
    if (activeTab === 'reviews') fetchCampaigns();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, fetchRoleRequests, fetchCampaigns, fetchAuditLogs]);

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
      await apiRequest('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          username: inviteUsername || undefined,
          role: inviteRole,
          permissions: selectedPermissions,
        }),
      });

      setInviteResult(`Staff invitation dispatched to ${inviteEmail}.`);
      setInviteEmail('');
      setInviteUsername('');
      fetchStaffData();
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteResult(null);
      }, 2000);
    } catch (err: any) {
      alert(`Invitation failed: ${err.message}`);
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

      alert(`Staff member @${editingStaff.username} permissions updated.`);
      setEditingStaff(null);
      fetchStaffData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest) return;
    setReviewLoading(true);

    try {
      await apiRequest(`/admin/roles/requests/${reviewingRequest.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: reviewAction,
          reviewNotes,
        }),
      });

      alert(`Role request successfully ${reviewAction.toLowerCase()}d.`);
      setReviewingRequest(null);
      setReviewNotes('');
      fetchRoleRequests();
      fetchStaffData();
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleStartCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampaignLoading(true);

    try {
      await apiRequest('/admin/roles/access-reviews/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          quarter: campaignQuarter,
          year: Number(campaignYear),
          notes: campaignNotes || undefined,
        }),
      });

      alert(`Access review campaign for ${campaignQuarter} initialized.`);
      setIsStartCampaignOpen(false);
      setCampaignNotes('');
      fetchCampaigns();
    } catch (err: any) {
      alert(`Failed to start campaign: ${err.message}`);
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !decisionCandidate) return;
    setDecisionLoading(true);

    try {
      await apiRequest(
        `/admin/roles/access-reviews/campaigns/${selectedCampaign.campaign.id}/decisions`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId: decisionCandidate.id,
            decision: decisionAction,
            decisionReason,
          }),
        },
      );

      alert(`Decision [${decisionAction}] applied to @${decisionCandidate.username}.`);
      setDecisionCandidate(null);
      setDecisionReason('');

      // Refresh campaign details
      const details = await apiRequest<CampaignDetails>(
        `/admin/roles/access-reviews/campaigns/${selectedCampaign.campaign.id}`,
      );
      setSelectedCampaign(details);
      fetchStaffData();
    } catch (err: any) {
      alert(`Failed to record decision: ${err.message}`);
    } finally {
      setDecisionLoading(false);
    }
  };

  return (
    <AdminShell
      title="Access Control Governance (RBAC)"
      subtitle="Role-Based Access Control, Separation of Duties, Role Request Workflows & Quarterly Access Reviews"
      actions={
        <div className="flex items-center gap-2">
          {activeTab === 'staff' && hasPermission('ADMINS_MANAGE') && (
            <button
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#25F4EE] px-4 py-2 text-xs font-bold text-black hover:opacity-90 shadow-lg shadow-cyan-500/20"
            >
              <UserPlus className="h-4 w-4" />
              <span>Invite Staff Admin</span>
            </button>
          )}
          {activeTab === 'reviews' && hasPermission('ADMINS_MANAGE') && (
            <button
              onClick={() => setIsStartCampaignOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow-lg shadow-purple-500/20"
            >
              <Calendar className="h-4 w-4" />
              <span>New Quarterly Review</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#232733] pb-3 text-xs">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === 'staff'
                ? 'bg-[#00F2FE]/15 text-[#00F2FE] border border-[#00F2FE]/40'
                : 'text-gray-400 hover:text-white hover:bg-[#181B22]'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Staff & Permissions</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === 'requests'
                ? 'bg-[#00F2FE]/15 text-[#00F2FE] border border-[#00F2FE]/40'
                : 'text-gray-400 hover:text-white hover:bg-[#181B22]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Role-Change Requests</span>
            {requests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-black font-extrabold">
                {requests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === 'reviews'
                ? 'bg-[#00F2FE]/15 text-[#00F2FE] border border-[#00F2FE]/40'
                : 'text-gray-400 hover:text-white hover:bg-[#181B22]'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Periodic Access Reviews</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-[#00F2FE]/15 text-[#00F2FE] border border-[#00F2FE]/40'
                : 'text-gray-400 hover:text-white hover:bg-[#181B22]'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Role Audit Trail</span>
          </button>
        </div>

        {/* ==================== TAB 1: STAFF & PERMISSIONS ==================== */}
        {activeTab === 'staff' && (
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
                              Edit Role
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
        )}

        {/* ==================== TAB 2: ROLE-CHANGE REQUESTS ==================== */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 text-xs text-blue-300 flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Separation of Duties Enforced (Section 1.1)</p>
                <p className="mt-0.5 text-blue-300/80">
                  Per security specification, users requesting a privileged role change cannot approve
                  their own request. Approval requires dual-control review by an authorized administrator.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Requester</th>
                    <th className="px-5 py-3.5 font-semibold">Current Role</th>
                    <th className="px-5 py-3.5 font-semibold">Requested Role</th>
                    <th className="px-5 py-3.5 font-semibold">Justification</th>
                    <th className="px-5 py-3.5 font-semibold">Submitted</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232733]">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        No role-change requests found.
                      </td>
                    </tr>
                  ) : (
                    requests.map((r) => {
                      const isSelf = currentStaff?.id === r.userId;
                      return (
                        <tr key={r.id} className="hover:bg-[#181B22]/50">
                          <td className="px-5 py-3.5 font-bold text-white">
                            <div>
                              <span>@{r.requester?.profile?.username || 'user'}</span>
                              <p className="text-[11px] font-normal text-gray-400">{r.requester?.email}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-300">
                              {r.currentRole}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="rounded bg-cyan-950 border border-cyan-800 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                              {r.requestedRole}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 max-w-xs text-gray-300">
                            <p className="line-clamp-2">{r.justification}</p>
                          </td>
                          <td className="px-5 py-3.5 text-gray-400">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                r.status === 'APPROVED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : r.status === 'REJECTED'
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {r.status === 'PENDING' ? (
                              isSelf ? (
                                <span
                                  className="text-[10px] text-amber-400 italic"
                                  title="Separation of duties: You cannot approve your own request"
                                >
                                  Self-Approval Blocked
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setReviewingRequest(r);
                                      setReviewAction('APPROVE');
                                    }}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReviewingRequest(r);
                                      setReviewAction('REJECT');
                                    }}
                                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-500"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )
                            ) : (
                              <span className="text-[11px] text-gray-500">
                                Reviewed by @{r.reviewer?.profile?.username || 'admin'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: PERIODIC ACCESS REVIEWS ==================== */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            {/* Active Campaign Banner */}
            {selectedCampaign && (
              <div className="rounded-2xl border border-purple-900/50 bg-[#12141A] p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-purple-400" />
                      {selectedCampaign.campaign.name}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Conducted by: {selectedCampaign.campaign.conductedBy} | Quarter: {selectedCampaign.campaign.quarter}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        selectedCampaign.campaign.status === 'COMPLETED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-purple-950 text-purple-300 border border-purple-800'
                      }`}
                    >
                      {selectedCampaign.campaign.status}
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {selectedCampaign.decisionsRecordedCount} of {selectedCampaign.privilegedUsersCount} Accounts Reviewed
                    </p>
                  </div>
                </div>

                {/* Candidate Review Table */}
                <div className="overflow-hidden rounded-xl border border-[#232733] bg-[#181B22]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#232733] bg-[#1F232D] text-gray-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Privileged Account</th>
                        <th className="px-4 py-3 font-semibold">Role</th>
                        <th className="px-4 py-3 font-semibold">Inactive Duration</th>
                        <th className="px-4 py-3 font-semibold">Risk Indicator</th>
                        <th className="px-4 py-3 font-semibold">Review Decision</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232733]">
                      {selectedCampaign.privilegedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#232733]/40">
                          <td className="px-4 py-3 font-bold text-white">
                            <div>
                              <span>@{u.username}</span>
                              <p className="text-[11px] font-normal text-gray-400">{u.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-300">
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {u.inactiveDays > 300 ? 'Never Active' : `${u.inactiveDays} days`}
                          </td>
                          <td className="px-4 py-3">
                            {u.isInactiveRisk ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                INACTIVE &gt; 30d
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="h-3 w-3" />
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {u.reviewDecision ? (
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                  u.reviewDecision.decision === 'REVOKE'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : u.reviewDecision.decision === 'MODIFY'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {u.reviewDecision.decision}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-[11px] italic">Pending Decision</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {selectedCampaign.campaign.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => {
                                  setDecisionCandidate(u);
                                  setDecisionAction(u.isInactiveRisk ? 'REVOKE' : 'MAINTAIN');
                                }}
                                className="rounded-lg bg-[#232733] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#00F2FE] hover:text-black transition-colors"
                              >
                                Evaluate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: ROLE AUDIT TRAIL ==================== */}
        {activeTab === 'audit' && (
          <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-5 py-3.5 font-semibold">Action</th>
                  <th className="px-5 py-3.5 font-semibold">Actor</th>
                  <th className="px-5 py-3.5 font-semibold">Affected Resource</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {roleAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-500">
                      No role audit trail logs found.
                    </td>
                  </tr>
                ) : (
                  roleAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#181B22]/50">
                      <td className="px-5 py-3.5 font-mono text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold font-mono ${
                            log.action.includes('REVOKED') || log.action.includes('VIOLATION')
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : log.action.includes('APPROVED') || log.action.includes('ASSIGNED')
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white">
                        {log.username || 'SYSTEM'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-300">
                        {log.resource || 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== MODALS ==================== */}

      {/* Review Role Request Modal */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              Review Role Request: @{reviewingRequest.requester?.profile?.username}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Requested: <span className="text-[#00F2FE] font-bold">{reviewingRequest.requestedRole}</span> (from {reviewingRequest.currentRole})
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300">Decision</label>
                <div className="mt-1 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewAction('APPROVE')}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                      reviewAction === 'APPROVE'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-[#232733] bg-[#181B22] text-gray-400'
                    }`}
                  >
                    Approve Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('REJECT')}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                      reviewAction === 'REJECT'
                        ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                        : 'border-[#232733] bg-[#181B22] text-gray-400'
                    }`}
                  >
                    Reject Request
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-300">Review Notes / Reason (Required)</label>
                <textarea
                  required
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Document the operational basis for this approval/rejection..."
                  className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] p-3 text-xs text-white placeholder-gray-600 focus:border-[#00F2FE] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingRequest(null)}
                  className="rounded-xl border border-[#232733] px-4 py-2 text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewLoading}
                  className="rounded-xl bg-[#00F2FE] px-4 py-2 text-xs font-bold text-black hover:bg-[#25F4EE]"
                >
                  {reviewLoading ? 'Submitting...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Decision Modal */}
      {decisionCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              Evaluate Access: @{decisionCandidate.username}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Current Role: <span className="font-bold text-white">{decisionCandidate.role}</span> | Inactivity: {decisionCandidate.inactiveDays} days
            </p>

            <form onSubmit={handleDecisionSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300">Review Decision</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(['MAINTAIN', 'REVOKE', 'MODIFY'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDecisionAction(d)}
                      className={`rounded-xl border py-2 text-xs font-bold ${
                        decisionAction === d
                          ? d === 'REVOKE'
                            ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                            : 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                          : 'border-[#232733] bg-[#181B22] text-gray-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-300">Documented Reason (Required for Audit)</label>
                <textarea
                  required
                  rows={3}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="e.g. Account inactive > 30 days, revoked per least-privilege policy..."
                  className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] p-3 text-xs text-white placeholder-gray-600 focus:border-[#00F2FE] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDecisionCandidate(null)}
                  className="rounded-xl border border-[#232733] px-4 py-2 text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decisionLoading}
                  className="rounded-xl bg-[#00F2FE] px-4 py-2 text-xs font-bold text-black hover:bg-[#25F4EE]"
                >
                  {decisionLoading ? 'Recording...' : 'Record Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Campaign Modal */}
      {isStartCampaignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              Start Quarterly Access Review
            </h3>

            <form onSubmit={handleStartCampaignSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300">Quarter Identifier</label>
                <input
                  type="text"
                  required
                  value={campaignQuarter}
                  onChange={(e) => setCampaignQuarter(e.target.value)}
                  placeholder="Q4-2026"
                  className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300">Year</label>
                <input
                  type="number"
                  required
                  value={campaignYear}
                  onChange={(e) => setCampaignYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300">Operational Notes</label>
                <textarea
                  rows={2}
                  value={campaignNotes}
                  onChange={(e) => setCampaignNotes(e.target.value)}
                  placeholder="Quarterly review of administrative roles and permissions..."
                  className="mt-1 w-full rounded-xl border border-[#232733] bg-[#181B22] p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStartCampaignOpen(false)}
                  className="rounded-xl border border-[#232733] px-4 py-2 text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={campaignLoading}
                  className="rounded-xl bg-purple-500 px-4 py-2 text-xs font-bold text-white hover:bg-purple-400"
                >
                  {campaignLoading ? 'Starting...' : 'Start Campaign'}
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
                    const isSensitive = p.sensitive;
                    const isChecked = editPermissions.includes(p.code);
                    const isDisabled = isSensitive && currentStaff?.role !== 'SUPER_ADMIN';

                    return (
                      <label
                        key={p.code}
                        className={`flex items-center justify-between rounded-lg p-1.5 text-xs ${
                          isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#232733] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => toggleEditPermission(p.code)}
                            className="rounded border-[#232733] bg-[#12141A] text-[#00F2FE]"
                          />
                          <span className="text-white font-mono text-[11px]">{p.code}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {p.label}
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
