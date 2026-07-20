'use client';

import React, { useState, useEffect } from 'react';
import { getSession } from '@/lib/auth';
import { getRoleBadgeColor } from '@/lib/utils';

export default function Navbar({ title }: { title?: string }) {
  const [timeStr, setTimeStr] = useState<string>('');
  const session = getSession();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-gray-800/80 bg-dark-900/60 px-8 backdrop-blur-md">
      <div>
        <h1 className="text-lg font-bold text-white">{title || 'Sistem POS & Inventori'}</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Real-time Clock */}
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
          <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{timeStr || 'Memuat waktu...'}</span>
        </div>

        {/* Server Status Indicator */}
        <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Server Aktif</span>
        </div>
      </div>
    </header>
  );
}
