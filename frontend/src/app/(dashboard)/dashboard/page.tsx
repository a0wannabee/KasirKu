'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR, formatDate } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardData {
  totalPenjualanHariIni: number;
  totalLabaHariIni: number;
  jumlahTransaksiHariIni: number;
  produkHampirHabis: Array<{
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minStock: number;
  }>;
  produkPalingLaris: Array<{
    name: string;
    totalTerjual: number;
  }>;
  pembelianTerakhir: Array<{
    purchaseNumber: string;
    supplier: string;
    totalAmount: number;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [chartData, setChartData] = useState<Array<{ tanggal: string; omzet: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    const [summaryRes, chartRes] = await Promise.all([
      fetchApi<DashboardData>('/dashboard/summary'),
      fetchApi<Array<{ tanggal: string; omzet: number }>>('/reports/grafik-penjualan?days=14'),
    ]);

    if (summaryRes.ok && summaryRes.data) {
      setData(summaryRes.data);
    } else {
      setError(summaryRes.error || 'Gagal memuat ringkasan dashboard.');
    }

    if (chartRes.ok && chartRes.data) {
      setChartData(chartRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Memuat statistik realtime...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-rose-500/10 p-6 border border-rose-500/30 text-rose-300">
        <h3 className="font-semibold">Terjadi Kesalahan</h3>
        <p className="mt-1 text-sm">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-4 rounded-xl bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Omzet Hari Ini */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-6">
          <div className="absolute right-4 top-4 rounded-xl bg-blue-500/10 p-3 text-blue-400 border border-blue-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Omzet Penjualan Hari Ini</p>
          <p className="mt-2 text-3xl font-bold text-white tracking-tight">{formatIDR(data.totalPenjualanHariIni)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-400 font-medium">
            <span>Dari {data.jumlahTransaksiHariIni} transaksi sukses</span>
          </div>
        </div>

        {/* Laba Kotor Hari Ini */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-6">
          <div className="absolute right-4 top-4 rounded-xl bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Laba Kotor Hari Ini</p>
          <p className="mt-2 text-3xl font-bold text-emerald-400 tracking-tight">{formatIDR(data.totalLabaHariIni)}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <span>Setelah dikurangi HPP Weighted Average</span>
          </div>
        </div>

        {/* Jumlah Transaksi */}
        <div className="glass-panel relative overflow-hidden rounded-2xl p-6">
          <div className="absolute right-4 top-4 rounded-xl bg-purple-500/10 p-3 text-purple-400 border border-purple-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Transaksi Hari Ini</p>
          <p className="mt-2 text-3xl font-bold text-white tracking-tight">{data.jumlahTransaksiHariIni}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-purple-400 font-medium">
            <span>Kasir beroperasi normal</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Grafik Tren Omzet (14 Hari Terakhir)</h3>
            <p className="text-xs text-gray-400">Pergerakan total penjualan harian dalam rupiah</p>
          </div>
        </div>
        <div className="h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                <XAxis dataKey="tanggal" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `Rp ${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: number) => [formatIDR(val), 'Omzet']}
                />
                <Bar dataKey="omzet" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Belum ada data penjualan pada rentang 14 hari terakhir.
            </div>
          )}
        </div>
      </div>

      {/* Grid 2 Columns: Low Stock Alert & Top Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Produk Hampir Habis */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="font-bold text-white">Alert Stok Menipis</h3>
            </div>
            <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-300 border border-rose-500/30">
              {data.produkHampirHabis.length} Produk
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
            {data.produkHampirHabis.length > 0 ? (
              data.produkHampirHabis.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-gray-800/60 p-3.5 border border-gray-700/50 transition-colors hover:border-rose-500/40"
                >
                  <div>
                    <p className="font-semibold text-white text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400">SKU: {item.sku} • Min. Stok: {item.minStock}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm font-bold text-rose-300 border border-rose-500/30">
                      Sisa: {item.currentStock}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-sm text-emerald-400">
                Semua stok produk dalam kondisi aman (di atas batas minimum).
              </div>
            )}
          </div>
        </div>

        {/* Produk Paling Laris */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-white">Produk Paling Laris Hari Ini</h3>
            <span className="text-xs text-gray-400">Top 5 Kuantitas</span>
          </div>

          <div className="space-y-3">
            {data.produkPalingLaris.length > 0 ? (
              data.produkPalingLaris.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-800/60 p-3.5 border border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 font-bold text-blue-400 text-xs border border-blue-500/30">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-white text-sm">{item.name || 'Produk'}</span>
                  </div>
                  <span className="rounded-lg bg-gray-700/60 px-3 py-1 text-xs font-bold text-gray-200">
                    {item.totalTerjual} Terjual
                  </span>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">
                Belum ada transaksi penjualan tercatat hari ini.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
