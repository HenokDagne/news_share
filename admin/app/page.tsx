'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import {
  Users,
  Heart,
  Compass,
  Layers,
  TrendingUp,
  Download,
  Share2,
  MoreHorizontal,
  ChevronDown,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isCopied, setIsCopied] = useState(false);

  // Filter dropdown states matching inspiration screenshot
  const [trendRange, setTrendRange] = useState<'6 Month' | '3 Month' | '1 Year'>('6 Month');
  const [trendDropdownOpen, setTrendDropdownOpen] = useState(false);

  const [insightsRange, setInsightsRange] = useState<'Week' | 'Month' | 'Year'>('Week');
  const [insightsDropdownOpen, setInsightsDropdownOpen] = useState(false);

  const [platformRange, setPlatformRange] = useState<'This Month' | 'Last Month' | 'All Time'>('This Month');
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  const [postingRange, setPostingRange] = useState<'Today' | 'This Week'>('Today');
  const [postingDropdownOpen, setPostingDropdownOpen] = useState(false);

  // Active hover states for chart tooltips
  const [hoveredMonth, setHoveredMonth] = useState<string | null>('Mar');
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{ day: string; time: string; intensity: number } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const sumRes = await apiRequest<DashboardSummary>('/admin/dashboard/summary');
      setSummary(sumRes);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

    return () => {
      clearTimeout(timer);
      s.off('stats.changed', debouncedReload);
      s.off('report.new', debouncedReload);
      s.off('case.updated', debouncedReload);
      s.off('registration.new', debouncedReload);
    };
  }, [fetchDashboardData]);

  // Export CSV handler
  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Metric,Value,Growth,Period',
        `Total Followers,${summary?.totalUsers ? (summary.totalUsers * 2500 + 132540) : 132540},+8.5%,from last month`,
        'Total Engagement,48920,+12.1%,from last month',
        'Total Reach,1.8M,+18.5%,from last month',
        'Total Impressions,3.2M,+5.1%,from last month',
        '',
        'Platform,Followers,Engagement,Reach,Growth',
        'Instagram,51K,12.3K,430K,+7.8%',
        'Facebook,38K,8.2K,310K,+5.2%',
        'TikTok,22K,15.1K,520K,+12.4%',
        'LinkedIn,12K,2.4K,120K,+3.1%',
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `social_media_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Share handler
  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // 1. Audience Growth Trend Data (6 Months with Gained & Lost)
  const growthTrendData = [
    { month: 'Jan', gained: 3800, lost: 700, net: 3100 },
    { month: 'Feb', gained: 4200, lost: 850, net: 3350 },
    { month: 'Mar', gained: 5100, lost: 920, net: 4180 },
    { month: 'Apr', gained: 4700, lost: 800, net: 3900 },
    { month: 'May', gained: 5300, lost: 950, net: 4350 },
    { month: 'Jun', gained: 5900, lost: 1100, net: 4800 },
  ];

  // 2. Audience Insights Data (Age Demographics)
  const audienceInsightsData = [
    { ageGroup: '18-24', percentage: 35, color: '#D946EF', label: '35%' },
    { ageGroup: '25-34', percentage: 50, color: '#F97316', label: '50%' },
    { ageGroup: '35-44', percentage: 18, color: '#22C55E', label: '18%' },
    { ageGroup: '45+', percentage: 7, color: '#06B6D4', label: '7%' },
  ];

  // 3. Audience Sentiment Data
  const sentimentData = [
    { name: 'Positive Comments', value: 72, color: '#F97316', percentage: '72%' },
    { name: 'Neutral Comments', value: 20, color: '#22C55E', percentage: '20%' },
    { name: 'Negative Comments', value: 8, color: '#06B6D4', percentage: '8%' },
  ];

  // 4. Platform Performance Overview Data
  const platformData = [
    { platform: 'Instagram', badgeColor: 'bg-[#F97316]', followers: '51K', engagement: '12.3K', reach: '430K', growth: '+7.8%' },
    { platform: 'Facebook', badgeColor: 'bg-[#22C55E]', followers: '38K', engagement: '8.2K', reach: '310K', growth: '+5.2%' },
    { platform: 'TikTok', badgeColor: 'bg-[#D946EF]', followers: '22K', engagement: '15.1K', reach: '520K', growth: '+12.4%' },
    { platform: 'LinkedIn', badgeColor: 'bg-[#06B6D4]', followers: '12K', engagement: '2.4K', reach: '120K', growth: '+3.1%' },
  ];

  // 5. Optimal Posting Time Heatmap Matrix (7 days x 8 time slots)
  const heatmapDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmapTimes = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];

  // Intensity map (0 = light peach, 1 = medium, 2 = vibrant orange, 3 = deep orange) matching image
  const heatmapMatrix: number[][] = [
    [0, 0, 0, 1, 1, 1, 2, 2], // Sun
    [0, 0, 0, 0, 1, 1, 2, 2], // Mon
    [1, 0, 0, 0, 2, 1, 1, 2], // Tue
    [0, 0, 1, 1, 1, 2, 1, 2], // Wed
    [1, 1, 1, 0, 2, 2, 2, 2], // Thu
    [0, 1, 1, 1, 2, 2, 1, 1], // Fri
    [0, 0, 1, 1, 2, 1, 1, 0], // Sat
  ];

  const getHeatmapColor = (intensity: number) => {
    switch (intensity) {
      case 3:
        return 'bg-[#EA580C] text-white'; // Deep rich orange
      case 2:
        return 'bg-[#F97316] text-white'; // Vibrant orange
      case 1:
        return 'bg-[#FDBA74] text-slate-800'; // Medium peach
      default:
        return 'bg-[#FFEDD5] text-slate-700'; // Soft warm peach
    }
  };

  return (
    <AdminShell>
      {/* Crisp, clean, luminous white canvas container matching inspiration UI */}
      <div className="-m-8 min-h-screen bg-[#F8FAFC] p-8 font-sans text-slate-800">
        <div className="mx-auto max-w-[1400px] space-y-6">

          {/* ===================== HEADER ===================== */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Social Media Analytics
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Track performance, engagement, and growth across all your social platforms in one place.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              {/* Share Button (Vibrant Orange Gradient Pill) */}
              <button
                onClick={handleShare}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#FB923C] px-5 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-[#EA580C] hover:to-[#F97316] transition-all"
              >
                {isCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                <span>{isCopied ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* ===================== TOP ROW: 4 KPI CARDS ===================== */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

            {/* CARD 1: Total Followers */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500">Total Followers</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      132,540
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      +8.5%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">from last month</p>
                </div>
                {/* Circular Pink Badge */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FCE7F3] text-[#EC4899]">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* CARD 2: Total Engagement */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500">Total Engagement</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      48,920
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      +12.1%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">from last month</p>
                </div>
                {/* Circular Indigo Badge */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE9FE] text-[#8B5CF6]">
                  <Heart className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* CARD 3: Total Reach */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500">Total Reach</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      1.8M
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      +18.5%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">from last month</p>
                </div>
                {/* Circular Lime/Green Badge */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DCFCE7] text-[#10B981]">
                  <Compass className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* CARD 4: Total Impressions */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500">Total Impressions</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      3.2M
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      +5.1%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">from last month</p>
                </div>
                {/* Circular Coral/Rose Badge */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFE4E6] text-[#F43F5E]">
                  <Layers className="h-5 w-5" />
                </div>
              </div>
            </div>

          </div>

          {/* ===================== MIDDLE ROW: 3 ANALYTICAL CARDS ===================== */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* 1. AUDIENCE GROWTH TREND */}
            <div className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Audience Growth Trend</h3>

                {/* Dropdown Pill */}
                <div className="relative">
                  <button
                    onClick={() => setTrendDropdownOpen(!trendDropdownOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <span>{trendRange}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {trendDropdownOpen && (
                    <div className="absolute right-0 top-8 z-20 w-28 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs">
                      {(['6 Month', '3 Month', '1 Year'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setTrendRange(r);
                            setTrendDropdownOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Chart container with March Tooltip Card */}
              <div className="relative mt-5 h-56 w-full">
                {/* Floating Interactive Tooltip Card for March matching Screenshot */}
                <div className="absolute left-[34%] top-2 z-10 rounded-xl border border-slate-100 bg-white p-2.5 shadow-xl">
                  <div className="text-[11px] font-bold text-slate-800">March</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                    <span className="h-2 w-2 rounded-sm bg-[#FED7AA]" />
                    <span className="text-slate-500">Gained</span>
                    <span className="font-bold text-slate-700">5100</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                    <span className="h-2 w-2 rounded-sm bg-[#F97316]" />
                    <span className="text-slate-500">Lost</span>
                    <span className="font-bold text-slate-700">920</span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={growthTrendData} barSize={26}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                      domain={[0, 6000]}
                      ticks={[0, 1500, 3000, 6000]}
                    />
                    {/* Lighter bar (Gained) & Solid Orange (Net) */}
                    <Bar dataKey="gained" fill="#F8FAFC" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="net" fill="#F97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. AUDIENCE INSIGHTS (Age Demographics) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Audience Insights</h3>

                {/* Dropdown Pill */}
                <div className="relative">
                  <button
                    onClick={() => setInsightsDropdownOpen(!insightsDropdownOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <span>{insightsRange}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {insightsDropdownOpen && (
                    <div className="absolute right-0 top-8 z-20 w-24 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs">
                      {(['Week', 'Month', 'Year'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setInsightsRange(r);
                            setInsightsDropdownOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Colorful Rounded Bars */}
              <div className="mt-5 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={audienceInsightsData} barSize={34}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="ageGroup"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                      domain={[0, 60]}
                      ticks={[0, 15, 30, 45, 60]}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val}%`, 'Audience Share']}
                      contentStyle={{
                        backgroundColor: '#FFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '11px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      }}
                    />
                    <Bar
                      dataKey="percentage"
                      radius={[8, 8, 0, 0]}
                      label={{
                        position: 'top',
                        fill: '#64748B',
                        fontSize: 10,
                        fontWeight: 'bold',
                        formatter: (val: any) => `${val}%`,
                      }}
                    >
                      {audienceInsightsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. AUDIENCE SENTIMENT (Donut Chart + Legend) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Audience Sentiment</h3>
                <button className="text-slate-400 hover:text-slate-600">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                {/* Donut Chart with Centered Total */}
                <div className="relative h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={74}
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={4}
                      >
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Ring Text */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-extrabold text-slate-800">100%</span>
                    <span className="text-[10px] font-medium text-slate-400">Total</span>
                  </div>
                </div>

                {/* Legend on the right */}
                <div className="space-y-3">
                  {sentimentData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-slate-600 text-[11px] font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-800 text-[12px]">{item.percentage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ===================== BOTTOM ROW: 2 WIDE CARDS ===================== */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

            {/* 4. PLATFORM PERFORMANCE OVERVIEW (Span 3) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] lg:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Platform Performance Overview</h3>

                {/* Dropdown Pill */}
                <div className="relative">
                  <button
                    onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <span>{platformRange}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {platformDropdownOpen && (
                    <div className="absolute right-0 top-8 z-20 w-28 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs">
                      {(['This Month', 'Last Month', 'All Time'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setPlatformRange(r);
                            setPlatformDropdownOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                      <th className="pb-3 font-medium">Platform</th>
                      <th className="pb-3 font-medium">Followers</th>
                      <th className="pb-3 font-medium">Engagement</th>
                      <th className="pb-3 font-medium">Reach</th>
                      <th className="pb-3 text-right font-medium">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {platformData.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5">
                          <span
                            className={`inline-block rounded-md px-2.5 py-0.5 text-[11px] font-bold text-white ${p.badgeColor}`}
                          >
                            {p.platform}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-700 font-bold">{p.followers}</td>
                        <td className="py-3.5 text-slate-700 font-bold">{p.engagement}</td>
                        <td className="py-3.5 text-slate-700 font-bold">{p.reach}</td>
                        <td className="py-3.5 text-right font-bold text-emerald-600">
                          {p.growth}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. OPTIMAL POSTING TIME / HEATMAP (Span 2) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Optimal Posting Time</h3>

                {/* Dropdown Pill */}
                <div className="relative">
                  <button
                    onClick={() => setPostingDropdownOpen(!postingDropdownOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <span>{postingRange}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {postingDropdownOpen && (
                    <div className="absolute right-0 top-8 z-20 w-24 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs">
                      {(['Today', 'This Week'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setPostingRange(r);
                            setPostingDropdownOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Heatmap Grid */}
              <div className="mt-5">
                <div className="flex flex-col gap-1.5">
                  {heatmapDays.map((day, dIdx) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-7 text-[10px] font-medium text-slate-400">{day}</span>
                      <div className="grid flex-1 grid-cols-8 gap-1.5">
                        {heatmapTimes.map((time, tIdx) => {
                          const intensity = heatmapMatrix[dIdx][tIdx];
                          const colorClass = getHeatmapColor(intensity);

                          return (
                            <div
                              key={time}
                              title={`${day} ${time} - Engagement level: ${intensity + 1}/4`}
                              className={`h-5 rounded-[4px] transition-transform hover:scale-110 cursor-pointer ${colorClass}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Time Labels on X-axis */}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="w-7" />
                    <div className="grid flex-1 grid-cols-8 gap-1.5 text-center">
                      {heatmapTimes.map((time) => (
                        <span key={time} className="text-[9px] font-medium text-slate-400">
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </AdminShell>
  );
}
