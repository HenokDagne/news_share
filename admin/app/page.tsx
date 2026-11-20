'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { apiRequest } from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import {
  Users,
  ShieldAlert,
  Flag,
  FileText,
  UserCheck,
  UserX,
  Gavel,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardSummary {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalPosts: number;
  reportedPosts: number;
  pendingReports: number;
  resolvedReports: number;
  newRegistrations: number;
  moderationActions: number;
}

interface TimeseriesPoint {
  day: string;
  value: number;
}

interface DistributionItem {
  name: string;
  count: number;
  percentage: number;
}

const DONUT_COLORS = ['#00F2FE', '#FE2C55', '#F59E0B', '#10B981', '#7928CA'];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [recentData, setRecentData] = useState<any>(null);
  const [distribution, setDistribution] = useState<any>(null);

  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [metric, setMetric] = useState<'registrations' | 'posts' | 'reports' | 'moderation'>('registrations');
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async () => {
    try {
      const [sumRes, timeRes, recRes, distRes] = await Promise.all([
        apiRequest<DashboardSummary>('/admin/dashboard/summary'),
        apiRequest<TimeseriesPoint[]>(`/admin/dashboard/timeseries?metric=${metric}&range=${range}&interval=day`),
        apiRequest<any>('/admin/dashboard/recent'),
        apiRequest<any>('/admin/dashboard/distribution'),
      ]);

      setSummary(sumRes);
      setTimeseries(timeRes || []);
      setRecentData(recRes);
      setDistribution(distRes);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [range, metric]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time socket listeners
  useEffect(() => {
    const s = getAdminSocket();
    if (!s) return;

    let timer: NodeJS.Timeout;
    const debouncedReload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetchDashboardData();
      }, 800);
    };

    s.on('stats.changed', debouncedReload);
    s.on('report.new', debouncedReload);
    s.on('case.updated', debouncedReload);
    s.on('registration.new', debouncedReload);
    s.on('admin.action', debouncedReload);

    return () => {
      clearTimeout(timer);
      s.off('stats.changed', debouncedReload);
      s.off('report.new', debouncedReload);
      s.off('case.updated', debouncedReload);
      s.off('registration.new', debouncedReload);
      s.off('admin.action', debouncedReload);
    };
  }, [fetchDashboardData]);

  const kpis = [
    {
      label: 'Total Registered Users',
      value: summary?.totalUsers ?? '...',
      sub: `${summary?.newRegistrations ?? 0} new in period`,
      icon: Users,
      color: 'text-cyan-400',
      border: 'hover:border-cyan-500/40',
      tooltip: 'Non-deleted accounts currently existing in the database',
    },
    {
      label: 'Active Users (30d)',
      value: summary?.activeUsers ?? '...',
      sub: 'Authenticated within 30d',
      icon: UserCheck,
      color: 'text-emerald-400',
      border: 'hover:border-emerald-500/40',
      tooltip: 'Accounts active or authenticated within the last 30 days',
    },
    {
      label: 'Pending Reports Queue',
      value: summary?.pendingReports ?? '...',
      sub: 'Action required',
      icon: Flag,
      color: 'text-amber-400',
      border: 'hover:border-amber-500/40',
      tooltip: 'Report cases currently in PENDING status awaiting review',
    },
    {
      label: 'Enforced Suspensions / Bans',
      value: summary?.bannedUsers ?? '...',
      sub: 'Active restrictions',
      icon: UserX,
      color: 'text-rose-400',
      border: 'hover:border-rose-500/40',
      tooltip: 'Accounts currently restricted under active BAN or SUSPENSION',
    },
    {
      label: 'Active Posts Published',
      value: summary?.totalPosts ?? '...',
      sub: `${summary?.reportedPosts ?? 0} with reports`,
      icon: FileText,
      color: 'text-blue-400',
      border: 'hover:border-blue-500/40',
      tooltip: 'All user posts with ACTIVE visibility status',
    },
    {
      label: 'Enforcement Actions Taken',
      value: summary?.moderationActions ?? '...',
      sub: `${summary?.resolvedReports ?? 0} cases resolved`,
      icon: Gavel,
      color: 'text-purple-400',
      border: 'hover:border-purple-500/40',
      tooltip: 'Cumulative moderation decisions executed by staff',
    },
  ];

  return (
    <AdminShell
      title="Platform Operations & Telemetry"
      subtitle={`Real database telemetry • Synchronized ${lastRefreshed.toLocaleTimeString()}`}
      actions={
        <button
          onClick={() => fetchDashboardData()}
          className="flex items-center gap-2 rounded-xl border border-[#232733] bg-[#12141A] px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#181B22] hover:text-white transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="space-y-8">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                title={kpi.tooltip}
                className={`group relative overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] p-5 shadow-lg transition-all ${kpi.border}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {kpi.label}
                  </span>
                  <div className={`rounded-xl bg-[#181B22] p-2.5 ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {kpi.value}
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium text-gray-500">
                  {kpi.sub}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeseries Section */}
        <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Temporal Activity Trends
              </h3>
              <p className="text-xs text-gray-400">
                Daily telemetry aggregated directly from database transaction logs
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Metric Selector */}
              <div className="flex rounded-xl border border-[#232733] bg-[#181B22] p-1 text-xs">
                {(['registrations', 'posts', 'reports', 'moderation'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`rounded-lg px-3 py-1 font-semibold capitalize transition-colors ${
                      metric === m
                        ? 'bg-[#00F2FE] text-black shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Range Selector */}
              <div className="flex rounded-xl border border-[#232733] bg-[#181B22] p-1 text-xs">
                {(['7d', '30d', '90d'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-lg px-2.5 py-1 font-semibold uppercase transition-colors ${
                      range === r
                        ? 'bg-[#FE2C55] text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F2FE" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00F2FE" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#232733" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(str) => {
                    const d = new Date(str);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12141A',
                    borderColor: '#232733',
                    borderRadius: '12px',
                    color: '#FFF',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                  }}
                  labelFormatter={(lbl) => new Date(lbl).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00F2FE"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#chartGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grid: Distribution & Recents */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Status Breakdown Donut */}
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-xl">
            <h3 className="text-base font-bold text-white">
              Account State Distribution
            </h3>
            <p className="text-xs text-gray-400">
              Live breakdown across user population
            </p>

            <div className="mt-4 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution?.statuses || []}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {(distribution?.statuses || []).map((_: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#181B22',
                      borderColor: '#232733',
                      borderRadius: '8px',
                      color: '#FFF',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-2 border-t border-[#232733] pt-4">
              {(distribution?.statuses || []).map((item: DistributionItem, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                    />
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-white">{item.count}</span>
                    <span className="text-gray-500">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Reports Stream */}
          <div className="rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-xl lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  High Priority Incident Queue
                </h3>
                <p className="text-xs text-gray-400">
                  Most urgent report cases awaiting human moderator intervention
                </p>
              </div>
              <Link
                href="/reports"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#00F2FE] hover:underline"
              >
                <span>View Full Queue</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-4 space-y-2.5 overflow-hidden">
              {recentData?.cases?.length > 0 ? (
                recentData.cases.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-[#232733] bg-[#181B22] p-3.5 transition-colors hover:border-[#2B303F]"
                  >
                    <div className="flex items-center gap-3">
                      <PriorityBadge priority={c.priorityScore} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {c.targetType}: {c.targetUserId?.substring(0, 8)}...
                          </span>
                          <span className="rounded bg-[#232733] px-1.5 py-0.5 text-[10px] text-gray-300">
                            {c.reportCount} reports
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          Top Reason: <span className="text-gray-200">{c.topReason || 'GENERAL'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={c.status} />
                      <Link
                        href={`/reports?caseId=${c.id}`}
                        className="rounded-lg bg-[#232733] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#00F2FE] hover:text-black transition-colors"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#232733] text-center">
                  <ShieldAlert className="h-8 w-8 text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-white">Reports Queue Clear</p>
                  <p className="text-xs text-gray-500">No pending reports currently require action.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
