import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
  return num.toString();
}

export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(dateString?: string | Date | null): string {
  if (!dateString) return '';
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getPriorityBadge(score: number) {
  if (score >= 20) {
    return {
      label: 'Critical',
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      dot: 'bg-red-500',
    };
  }
  if (score >= 10) {
    return {
      label: 'High',
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      dot: 'bg-amber-500',
    };
  }
  if (score >= 5) {
    return {
      label: 'Medium',
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      dot: 'bg-orange-500',
    };
  }
  return {
    label: 'Low',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-500',
  };
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
    case 'RESOLVED':
    case 'ACTION_TAKEN':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    case 'PENDING':
    case 'DEACTIVATED':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'UNDER_REVIEW':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    case 'SUSPENDED':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/20';
    case 'BANNED':
    case 'REMOVED':
    case 'DELETED':
    case 'REJECTED':
      return 'bg-red-500/15 text-red-400 border-red-500/20';
    default:
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }
}
