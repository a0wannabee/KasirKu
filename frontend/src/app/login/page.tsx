'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { setSession, getSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetchApi<{
      ok: boolean;
      accessToken: string;
      refreshToken: string;
      user: { id: string; username: string; fullName: string; role: any };
      error?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (res.ok && res.data?.ok) {
      setSession(res.data.user, res.data.accessToken, res.data.refreshToken);
      if (res.data.user.role === 'KASIR') router.replace('/kasir');
      else if (res.data.user.role === 'GUDANG') router.replace('/inventori');
      else router.replace('/dashboard');
    } else {
      setError(res.error || res.data?.error || 'Login gagal. Periksa username dan password Anda.');
    }
  };

  const fillDemo = (u: string, p: string = 'ChangeMe123!') => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient glowing background circles */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]" />

      <div className="glass-panel z-10 w-full max-w-md rounded-2xl p-8 transition-all">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">KasirKita POS</h1>
          <p className="mt-1 text-sm text-gray-400">Masuk untuk mengelola minimarket & inventori</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-rose-500/10 p-4 border border-rose-500/30 text-sm text-rose-300">
            <svg className="h-5 w-5 flex-shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: owner"
              className="glass-input w-full rounded-xl px-4 py-3 text-sm placeholder-gray-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="glass-input w-full rounded-xl px-4 py-3 text-sm placeholder-gray-500 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Memverifikasi...
              </span>
            ) : (
              'Masuk ke Sistem'
            )}
          </button>
        </form>

        {/* Quick Demo Credentials helper */}
        <div className="mt-8 border-t border-gray-800 pt-6">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
            Akun Demo Cepat (Klik untuk memilih)
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillDemo('owner')}
              className="flex items-center justify-between rounded-lg bg-gray-800/50 p-2.5 text-left border border-gray-700/50 hover:bg-gray-800 hover:border-purple-500/50 transition-all"
            >
              <div>
                <div className="font-semibold text-purple-300">Owner</div>
                <div className="text-[10px] text-gray-400">Akses Penuh</div>
              </div>
              <span className="text-gray-500">→</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('manager')}
              className="flex items-center justify-between rounded-lg bg-gray-800/50 p-2.5 text-left border border-gray-700/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all"
            >
              <div>
                <div className="font-semibold text-blue-300">Manager</div>
                <div className="text-[10px] text-gray-400">Laporan & Stok</div>
              </div>
              <span className="text-gray-500">→</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('kasir1')}
              className="flex items-center justify-between rounded-lg bg-gray-800/50 p-2.5 text-left border border-gray-700/50 hover:bg-gray-800 hover:border-emerald-500/50 transition-all"
            >
              <div>
                <div className="font-semibold text-emerald-300">Kasir</div>
                <div className="text-[10px] text-gray-400">POS Terminal</div>
              </div>
              <span className="text-gray-500">→</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('gudang1')}
              className="flex items-center justify-between rounded-lg bg-gray-800/50 p-2.5 text-left border border-gray-700/50 hover:bg-gray-800 hover:border-amber-500/50 transition-all"
            >
              <div>
                <div className="font-semibold text-amber-300">Gudang</div>
                <div className="text-[10px] text-gray-400">Stok & Pembelian</div>
              </div>
              <span className="text-gray-500">→</span>
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-500">Password default: <code className="text-gray-400">ChangeMe123!</code></p>
        </div>
      </div>
    </div>
  );
}
