'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAuth } from '@/lib/auth-context';

interface AdminShellProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: AdminShellProps) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0B0E]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
          <p className="text-xs text-gray-500 tracking-wider">INITIALIZING CONTROL CONSOLE...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#0A0B0E]">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-64">
        <Header title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
