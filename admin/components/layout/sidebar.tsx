'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Flag,
  ShieldAlert,
  UserCog,
  FileCheck2,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Sidebar() {
  const pathname = usePathname();
  const { user, hasPermission, logout } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      permission: 'DASHBOARD_VIEW',
    },
    {
      label: 'Users',
      href: '/users',
      icon: Users,
      permission: 'USERS_VIEW',
    },
    {
      label: 'Reports Queue',
      href: '/reports',
      icon: Flag,
      permission: 'REPORTS_VIEW',
    },
    {
      label: 'Moderation Hub',
      href: '/moderation',
      icon: ShieldAlert,
      permission: 'REPORTS_VIEW',
    },
    {
      label: 'Staff Admins',
      href: '/staff',
      icon: UserCog,
      permission: 'ADMINS_MANAGE',
    },
    {
      label: 'Audit Trail',
      href: '/audit',
      icon: FileCheck2,
      permission: 'AUDIT_VIEW',
    },
  ];

  const filteredNav = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[#232733] bg-[#12141A]">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-[#232733] px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#00F2FE] to-[#FE2C55] shadow-lg shadow-cyan-500/20">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider text-white">
            NEWS SHARE
          </h1>
          <p className="text-[10px] font-semibold tracking-widest text-[#00F2FE]">
            CONTROL // HUB
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Administration
        </div>
        {filteredNav.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#00F2FE]/15 to-transparent text-white border-l-2 border-[#00F2FE] font-semibold'
                  : 'text-gray-400 hover:bg-[#181B22] hover:text-gray-200'
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-colors ${
                  isActive ? 'text-[#00F2FE]' : 'text-gray-400 group-hover:text-white'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Staff User Footer */}
      <div className="border-t border-[#232733] p-4">
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#181B22] p-2.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-white border border-[#2B303F]">
              {user?.username?.substring(0, 2).toUpperCase() || 'ST'}
            </div>
            <div className="truncate">
              <p className="truncate text-xs font-medium text-white">
                {user?.username || 'Staff'}
              </p>
              <span className="inline-block rounded bg-[#232733] px-1.5 py-0.2 text-[9px] font-semibold text-[#00F2FE]">
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#232733] hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Security Guard v2.6</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>
      </div>
    </aside>
  );
}
