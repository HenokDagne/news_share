'use client';

import React, { useEffect, useState } from 'react';
import { getAdminSocket } from '@/lib/socket';
import { Radio, RefreshCw, Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user } = useAuth();
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    const s = getAdminSocket();
    if (s) {
      setIsSocketConnected(s.connected);
      const onConnect = () => setIsSocketConnected(true);
      const onDisconnect = () => setIsSocketConnected(false);

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);

      return () => {
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
      };
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#232733] bg-[#0A0B0E]/80 px-8 backdrop-blur-md">
      <div>
        <h2 className="text-base font-bold text-white tracking-wide">
          {title || 'Overview'}
        </h2>
        {subtitle && (
          <p className="text-xs text-gray-400">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {actions}

        {/* Live Socket Status Badge */}
        <div
          title={isSocketConnected ? 'Real-time telemetry stream connected' : 'Socket disconnected'}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            isSocketConnected
              ? 'border-emerald-800/70 bg-emerald-950/40 text-emerald-400'
              : 'border-zinc-700 bg-zinc-900 text-zinc-400'
          }`}
        >
          <Radio
            className={`h-3 w-3 ${
              isSocketConnected ? 'animate-pulse text-emerald-400' : 'text-zinc-500'
            }`}
          />
          <span className="hidden sm:inline">
            {isSocketConnected ? 'Live Telemetry' : 'Offline'}
          </span>
        </div>

        <div className="h-4 w-px bg-[#232733]" />

        {/* Staff Identity Pill */}
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span className="font-semibold text-white">{user?.email}</span>
        </div>
      </div>
    </header>
  );
}
