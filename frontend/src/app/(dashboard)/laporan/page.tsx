'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR, formatDate } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';

interface LabaRugiData {
  periode: { from: string; to: string };
  pendapatan: number;
  hpp: number;
  labaKotor: number;
  totalPembelian: number;
  totalDiskonDiberikan: number;
  totalPajakDipungut: number;
  marginPersen: number;
}

interface MarginItem {
  productId: string;
  sku: string;
  name: string;
  hpp: number;
  sellPrice: number;
  marginRp: number;
  marginPersen: number;
}

interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  totalTerjual: number;
  totalOmzet: number;
}

export default function LaporanPage() {
  const [activeTab, setActiveTab] = useState<'laba-rugi' | 'margin' | 'terlaris' | 'grafik'>('laba-rugi');
  const [loading, setLoading] = useState(true);

  const [labaRugi, setLabaRugi] = useState<LabaRugiData | null>(null);
  const [margins, setMargins] = useState<MarginItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [salesChart, setSalesChart] = useState<Array<{ tanggal: string; omzet: number }>>([]);
  const [purchasesChart, setPurchasesChart] = useState<Array<{ tanggal: string; pembelian: number }>>([]);

  // Date filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'laba-rugi') {
      const res = await fetchApi<LabaRugiData>(`/reports/laba-rugi?from=${fromDate}&to=${toDate}`);
      if (res.ok && res.data) setLabaRugi(res.data);
    } else if (activeTab === 'margin') {
      const res = await fetchApi<MarginItem[]>('/reports/margin-produk');
      if (res.ok && res.data) setMargins(res.data);
    } else if (activeTab === 'terlaris') {
      const res = await fetchApi<TopProduct[]>(`/reports/produk-terlaris?from=${fromDate}&to=${toDate}&limit=15`);
      if (res.ok && res.data) setTopProducts(res.data);
    } else if (activeTab === 'grafik') {
      const [salesRes, purchRes] = await Promise.all([
        fetchApi<Array<{ tanggal: string; omzet: number }>>('/reports/grafik-penjualan?days=30'),
        fetchApi<Array<{ tanggal: string; pembelian: number }>>('/reports/grafik-pembelian?days=30'),
      ]);
      if (salesRes.ok && salesRes.data) setSalesChart(salesRes.data);
      if (purchRes.ok && purchRes.data) setPurchasesChart(purchRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('laba-rugi')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'laba-rugi' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30' : 'bg-gray-800/60 text-gray-400 hover:text-white'
            }`}
          >
            Laba Rugi (P&L)
          </button>
          <button
            onClick={() => setActiveTab('margin')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'margin' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30' : 'bg-gray-800/60 text-gray-400 hover:text-white'
            }`}
          >
            Analisis Margin Produk
          </button>
          <button
            onClick={() => setActiveTab('terlaris')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'terlaris' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30' : 'bg-gray-800/60 text-gray-400 hover:text-white'
            }`}
          >
            Produk Terlaris
          </button>
          <button
            onClick={() => setActiveTab('grafik')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'grafik' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30' : 'bg-gray-800/60 text-gray-400 hover:text-white'
            }`}
          >
            Grafik Penjualan vs Pembelian
          </button>
        </div>

        {(activeTab === 'laba-rugi' || activeTab === 'terlaris') && (
          <form onSubmit={handleFilterSubmit} className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Dari:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="glass-input rounded-lg px-2.5 py-1.5 text-gray-200"
            />
            <span className="text-gray-400">Sampai:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="glass-input rounded-lg px-2.5 py-1.5 text-gray-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-3.5 py-1.5 font-bold text-white hover:bg-blue-500 shadow">
              Filter
            </button>
          </form>
        )}
      </div>

      {/* Tab 1: Laba Rugi */}
      {activeTab === 'laba-rugi' && (
        loading ? (
          <div className="py-24 text-center text-gray-400">Menghitung laporan laba rugi...</div>
        ) : !labaRugi ? (
          <div className="py-24 text-center text-rose-400">Gagal memuat laporan laba rugi.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel rounded-2xl p-6 border-l-4 border-blue-500">
              <p className="text-xs uppercase font-bold text-gray-400">Total Pendapatan (Omzet)</p>
              <p className="mt-2 text-3xl font-extrabold text-white font-mono">{formatIDR(labaRugi.pendapatan)}</p>
              <div className="mt-3 text-xs text-gray-400 flex justify-between">
                <span>Diskon Diberikan:</span>
                <span className="text-rose-400 font-mono">-{formatIDR(labaRugi.totalDiskonDiberikan)}</span>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border-l-4 border-amber-500">
              <p className="text-xs uppercase font-bold text-gray-400">Total HPP Penjualan</p>
              <p className="mt-2 text-3xl font-extrabold text-amber-400 font-mono">{formatIDR(labaRugi.hpp)}</p>
              <div className="mt-3 text-xs text-gray-400 flex justify-between">
                <span>Total Pembelian Supplier:</span>
                <span className="font-mono text-gray-300">{formatIDR(labaRugi.totalPembelian)}</span>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border-l-4 border-emerald-500 bg-gradient-to-br from-emerald-950/20 to-transparent">
              <p className="text-xs uppercase font-bold text-gray-400">Laba Kotor (Gross Profit)</p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-400 font-mono">{formatIDR(labaRugi.labaKotor)}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  Margin: {labaRugi.marginPersen}%
                </span>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="md:col-span-3 glass-panel rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4">Rincian Komponen Laporan Laba Rugi</h3>
              <div className="divide-y divide-gray-800 text-sm font-mono space-y-3 pt-2">
                <div className="flex justify-between py-2"><span className="text-gray-300 font-sans">Pendapatan Kotor (Gross Sales)</span><span className="text-white font-bold">{formatIDR(labaRugi.pendapatan + labaRugi.totalDiskonDiberikan)}</span></div>
                <div className="flex justify-between py-2 text-rose-400"><span className="font-sans">Dikurangi: Diskon Penjualan</span><span>-{formatIDR(labaRugi.totalDiskonDiberikan)}</span></div>
                <div className="flex justify-between py-2 font-bold text-white bg-gray-800/40 px-3 rounded-lg"><span className="font-sans">Pendapatan Bersih (Net Sales)</span><span>{formatIDR(labaRugi.pendapatan)}</span></div>
                <div className="flex justify-between py-2 text-amber-400"><span className="font-sans">Dikurangi: HPP (Weighted Average Cost)</span><span>-{formatIDR(labaRugi.hpp)}</span></div>
                <div className="flex justify-between py-3 font-extrabold text-emerald-400 text-base bg-emerald-950/20 px-3 rounded-xl border border-emerald-500/30"><span className="font-sans">LABA KOTOR (Gross Margin)</span><span>{formatIDR(labaRugi.labaKotor)}</span></div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Tab 2: Margin Produk */}
      {activeTab === 'margin' && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">Produk / SKU</th>
                <th className="py-4 px-4 text-right">HPP (WAC)</th>
                <th className="py-4 px-4 text-right">Harga Jual</th>
                <th className="py-4 px-4 text-right">Margin (Rp)</th>
                <th className="py-4 px-6 text-center">Margin (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Memuat margin produk...</td></tr>
              ) : margins.map((m) => (
                <tr key={m.productId} className="hover:bg-gray-800/40">
                  <td className="py-4 px-6 font-semibold text-white">{m.name} <span className="text-xs text-blue-400 font-mono">({m.sku})</span></td>
                  <td className="py-4 px-4 text-right font-mono text-gray-400">{formatIDR(m.hpp)}</td>
                  <td className="py-4 px-4 text-right font-mono font-semibold text-white">{formatIDR(m.sellPrice)}</td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400">+{formatIDR(m.marginRp)}</td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-block rounded-lg px-3 py-1 font-bold text-xs ${
                      m.marginPersen >= 20 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {m.marginPersen}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Produk Terlaris */}
      {activeTab === 'terlaris' && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">Peringkat & Produk</th>
                <th className="py-4 px-4 text-center">SKU</th>
                <th className="py-4 px-4 text-center">Total Terjual (Qty)</th>
                <th className="py-4 px-6 text-right">Kontribusi Omzet (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400">Memuat produk terlaris...</td></tr>
              ) : topProducts.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-500">Belum ada penjualan pada periode ini.</td></tr>
              ) : topProducts.map((p, idx) => (
                <tr key={p.productId} className="hover:bg-gray-800/40">
                  <td className="py-4 px-6 flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs border ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : idx === 1 ? 'bg-gray-300/20 text-gray-200 border-gray-400/40' : idx === 2 ? 'bg-amber-800/30 text-amber-500 border-amber-700/40' : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-white">{p.name || 'Produk'}</span>
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-xs text-blue-400">{p.sku}</td>
                  <td className="py-4 px-4 text-center font-mono font-bold text-white text-base">{p.totalTerjual}</td>
                  <td className="py-4 px-6 text-right font-mono font-extrabold text-emerald-400 text-base">{formatIDR(p.totalOmzet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Grafik Penjualan vs Pembelian */}
      {activeTab === 'grafik' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-6">Tren Penjualan Harian (30 Hari Terakhir)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChart} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOmzet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                  <XAxis dataKey="tanggal" stroke="#9ca3af" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} tickFormatter={(v) => `Rp ${v/1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', color: '#fff' }} formatter={(v: number) => [formatIDR(v), 'Omzet']} />
                  <Area type="monotone" dataKey="omzet" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOmzet)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-6">Tren Pembelian Supplier (30 Hari Terakhir)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purchasesChart} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                  <XAxis dataKey="tanggal" stroke="#9ca3af" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} tickFormatter={(v) => `Rp ${v/1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', color: '#fff' }} formatter={(v: number) => [formatIDR(v), 'Pembelian']} />
                  <Bar dataKey="pembelian" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
