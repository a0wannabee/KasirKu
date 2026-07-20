import React, { useState, useEffect } from 'react';
import { getSession } from '@/lib/auth';

interface Props {
  onOpenHistory: () => void;
}

export default function POSHeader({ onOpenHistory }: Props) {
  const session = getSession();
  const [mounted, setMounted] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="glass-panel flex items-center justify-between gap-4 rounded-2xl px-5 py-3 flex-shrink-0">
      {/* Left — session info */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Terminal POS</p>
          <p className="text-[11px] text-gray-400">
            Kasir: <span className="text-blue-400 font-semibold">{session?.fullName || session?.username || '—'}</span>
          </p>
        </div>
      </div>

      {/* Center — date/time (live & safe for hydration) */}
      <div className="hidden sm:block text-center min-w-[150px]">
        {mounted ? (
          <>
            <p className="text-sm font-bold text-white font-mono">{timeStr}</p>
            <p className="text-[11px] text-gray-400">{dateStr}</p>
          </>
        ) : (
          <div className="h-8 w-32 bg-gray-800/60 animate-pulse rounded-lg mx-auto" />
        )}
      </div>

      {/* Right — actions */}
      <button
        type="button"
        onClick={onOpenHistory}
        className="flex items-center gap-2 rounded-xl bg-gray-800/80 px-3.5 py-2 text-xs font-semibold text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Riwayat &amp; Void</span>
      </button>
    </div>
  );
}
