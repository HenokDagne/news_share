import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const norm = status?.toUpperCase() || 'UNKNOWN';

  let colorClasses = 'bg-gray-800 text-gray-300 border-gray-700';
  let dotColor = 'bg-gray-400';

  if (norm === 'ACTIVE' || norm === 'RESOLVED' || norm === 'GOOD') {
    colorClasses = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
    dotColor = 'bg-emerald-400';
  } else if (norm === 'PENDING') {
    colorClasses = 'bg-amber-950/60 text-amber-400 border-amber-800/60';
    dotColor = 'bg-amber-400 animate-pulse';
  } else if (norm === 'UNDER_REVIEW') {
    colorClasses = 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60';
    dotColor = 'bg-cyan-400';
  } else if (norm === 'SUSPENDED' || norm === 'WARNED') {
    colorClasses = 'bg-orange-950/60 text-orange-400 border-orange-800/60';
    dotColor = 'bg-orange-400';
  } else if (norm === 'BANNED' || norm === 'ACTION_TAKEN' || norm === 'DELETED') {
    colorClasses = 'bg-rose-950/60 text-rose-400 border-rose-800/60';
    dotColor = 'bg-rose-400';
  } else if (norm === 'DEACTIVATED' || norm === 'REJECTED') {
    colorClasses = 'bg-zinc-800 text-zinc-400 border-zinc-700';
    dotColor = 'bg-zinc-500';
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${px} ${colorClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{norm.replace('_', ' ')}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: number | string }) {
  let label = 'LOW';
  let classes = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  const score = typeof priority === 'number' ? priority : 0;
  if (typeof priority === 'string') {
    label = priority.toUpperCase();
    if (label === 'CRITICAL') classes = 'bg-rose-950/80 text-rose-300 border-rose-700 font-bold';
    else if (label === 'HIGH') classes = 'bg-orange-950/70 text-orange-300 border-orange-700';
    else if (label === 'MEDIUM') classes = 'bg-amber-950/70 text-amber-300 border-amber-700';
    else classes = 'bg-blue-950/60 text-blue-300 border-blue-800';
  } else {
    if (score >= 20) {
      label = `CRITICAL (${score})`;
      classes = 'bg-rose-950/80 text-rose-300 border-rose-700 font-bold animate-pulse';
    } else if (score >= 10) {
      label = `HIGH (${score})`;
      classes = 'bg-orange-950/70 text-orange-300 border-orange-700';
    } else if (score >= 5) {
      label = `MEDIUM (${score})`;
      classes = 'bg-amber-950/70 text-amber-300 border-amber-700';
    } else {
      label = `LOW (${score})`;
      classes = 'bg-blue-950/60 text-blue-300 border-blue-800';
    }
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wider ${classes}`}>
      {label}
    </span>
  );
}
