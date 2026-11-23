'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import {
  ShieldCheck,
  AlertTriangle,
  Siren,
  UserCheck,
  ClipboardCheck,
  Clock,
  FileText,
  GitPullRequest,
  RefreshCw,
  Scale,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface GovernanceSummary {
  outstandingRisks: number;
  highSeverityRisks: number;
  unresolvedIncidents: number;
  pendingPrivacyRequests: number;
  upcomingReviews: number;
  overdueTasks: number;
  policiesReviewDue: number;
  pendingChanges: number;
  breachesCount: number;
  timestamp: string;
}

export default function GovernanceDashboardPage() {
  const [summary, setSummary] = useState<GovernanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<GovernanceSummary>('/admin/governance/summary');
      setSummary(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load governance summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <AdminShell
      title="Compliance & Governance // Overview"
      subtitle="Regulatory obligations, information security risk matrix, and telemetry"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-500" />
            Last synced: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchSummary}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-[#232733] bg-[#181B22] px-3.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:border-[#00F2FE]/40 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#00F2FE]' : ''}`} />
            Refresh Data
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Outstanding Risks */}
          <Link
            href="/compliance/risks"
            className="group relative overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] p-5 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Outstanding Risks
              </span>
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {isLoading ? '-' : summary?.outstandingRisks ?? 0}
              </span>
              {(summary?.highSeverityRisks ?? 0) > 0 && (
                <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                  {summary?.highSeverityRisks} Critical/High
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Threat Register</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-hover:text-amber-400" />
            </div>
          </Link>

          {/* 2. Unresolved Incidents */}
          <Link
            href="/compliance/incidents"
            className="group relative overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] p-5 transition-all hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Active Incidents
              </span>
              <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-400">
                <Siren className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {isLoading ? '-' : summary?.unresolvedIncidents ?? 0}
              </span>
              <span className="text-xs text-gray-400">Under Investigation</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Security Incident Log</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-hover:text-rose-400" />
            </div>
          </Link>

          {/* 3. Pending Privacy Requests */}
          <Link
            href="/compliance/privacy"
            className="group relative overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] p-5 transition-all hover:border-[#00F2FE]/40 hover:shadow-lg hover:shadow-cyan-500/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Privacy Requests
              </span>
              <div className="rounded-xl bg-[#00F2FE]/10 p-2.5 text-[#00F2FE]">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {isLoading ? '-' : summary?.pendingPrivacyRequests ?? 0}
              </span>
              <span className="text-xs text-gray-400">Pending Fulfill</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Data Subject Rights</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-hover:text-[#00F2FE]" />
            </div>
          </Link>

          {/* 4. Overdue Remediation Tasks */}
          <Link
            href="/compliance/reviews"
            className="group relative overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] p-5 transition-all hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Overdue Findings
              </span>
              <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-400">
                <ClipboardCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {isLoading ? '-' : summary?.overdueTasks ?? 0}
              </span>
              <span className="text-xs text-gray-400">Audit Deadlines</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Security Audit Findings</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-hover:text-violet-400" />
            </div>
          </Link>
        </div>

        {/* Secondary KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Policy Reviews Due */}
          <Link
            href="/compliance/policies"
            className="group flex items-center justify-between rounded-xl border border-[#232733] bg-[#12141A] p-4 transition-all hover:border-[#00F2FE]/30"
          >
            <div className="flex items-center gap-3.5">
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Policies Due for Review</p>
                <p className="text-lg font-bold text-white">
                  {isLoading ? '-' : summary?.policiesReviewDue ?? 0} policies
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </Link>

          {/* Pending Changes (RFC) */}
          <Link
            href="/compliance/changes"
            className="group flex items-center justify-between rounded-xl border border-[#232733] bg-[#12141A] p-4 transition-all hover:border-[#00F2FE]/30"
          >
            <div className="flex items-center gap-3.5">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                <GitPullRequest className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Pending Change Approvals</p>
                <p className="text-lg font-bold text-white">
                  {isLoading ? '-' : summary?.pendingChanges ?? 0} requests
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </Link>

          {/* Upcoming Security Audits */}
          <Link
            href="/compliance/reviews"
            className="group flex items-center justify-between rounded-xl border border-[#232733] bg-[#12141A] p-4 transition-all hover:border-[#00F2FE]/30"
          >
            <div className="flex items-center gap-3.5">
              <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Upcoming Scheduled Audits</p>
                <p className="text-lg font-bold text-white">
                  {isLoading ? '-' : summary?.upcomingReviews ?? 0} audits
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </Link>
        </div>

        {/* Legal & Regulatory Framework Overview Card */}
        <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#232733] pb-5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#00F2FE]" />
                Regulatory Posture & Ethiopian Data Protection Proclamation
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Monitored compliance under Ethiopian Personal Data Protection Proclamation No. 1321/2024 & ISO/IEC 27001
              </p>
            </div>
            <Link
              href="/compliance/legal"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#FE2C55] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/10"
            >
              <span>Manage Legal Obligations</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="rounded-xl border border-[#232733] bg-[#181B22]/60 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00F2FE] uppercase tracking-wider mb-2">
                <span className="h-2 w-2 rounded-full bg-[#00F2FE]" />
                Lawful Grounds & Consent
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Articles 6 & 12 enforce verifiable consent logging with timestamp and IP origin. Explicit consent preferences managed through mobile app settings.
              </p>
            </div>

            <div className="rounded-xl border border-[#232733] bg-[#181B22]/60 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Data Subject Rights (Articles 22-27)
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Self-service personal data access, export generation, rectification requests, and account deletion tracking with a 30-day compliance SLA.
              </p>
            </div>

            <div className="rounded-xl border border-[#232733] bg-[#181B22]/60 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Breach Notification (Article 33)
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                72-hour regulatory authority disclosure tracking. Incident triage automatically assesses personal data exposure and user notification thresholds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
