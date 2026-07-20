'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR, formatDate, getStatusBadgeColor } from '@/lib/utils';
import { hasRole } from '@/lib/auth';

interface StockItem {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  minStock: number;
  saleUnit: string;
}

interface MutationItem {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  referenceType: string;
  note: string;
  createdAt: string;
  product?: { name: string; sku: string };
  user?: { fullName: string };
}

interface AdjustmentItem {
  id: string;
  quantityDelta: number;
  reason: string;
  note: string;
  createdAt: string;
  product?: { name: string; sku: string };
}

interface RestockItem {
  productId: string;
  sku: string;
  name: string;
  currentStock: number;
  avgDailySales: number;
  suggestedOrderQty: number;
}

export default function InventoriPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'mutations' | 'adjustments' | 'restock'>('stock');
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [mutations, setMutations] = useState<MutationItem[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([]);
  const [restockList, setRestockList] = useState<RestockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Adjustment Modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({
    productId: '',
    quantityDelta: 0,
    reason: 'STOCK_OPNAME',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const canAdjust = hasRole('OWNER', 'GUDANG');

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'stock') {
      const res = await fetchApi<StockItem[]>('/inventory/stock');
      if (res.ok && res.data) {
        setStocks(res.data);
        if (res.data.length > 0 && !adjForm.productId) {
          setAdjForm((p) => ({ ...p, productId: res.data[0].id }));
        }
      }
    } else if (activeTab === 'mutations') {
      const res = await fetchApi<MutationItem[]>('/inventory/mutations');
      if (res.ok && res.data) setMutations(res.data);
    } else if (activeTab === 'adjustments') {
      const res = await fetchApi<AdjustmentItem[]>('/inventory/adjustments');
      if (res.ok && res.data) setAdjustments(res.data);
    } else if (activeTab === 'restock') {
      const res = await fetchApi<RestockItem[]>('/inventory/restock-prediction?windowDays=30&targetDaysOfCover=14');
      if (res.ok && res.data) setRestockList(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjForm.quantityDelta === 0) {
      alert('Perubahan stok (quantityDelta) tidak boleh 0.');
      return;
    }

    setSubmitting(true);
    const res = await fetchApi('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(adjForm),
    });
    setSubmitting(false);

    if (res.ok) {
      alert('Penyesuaian stok berhasil dicatat ke StockMutation & StockAdjustment.');
      setShowAdjModal(false);
      loadData();
    } else {
      alert(res.error || 'Gagal melakukan koreksi stok');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Navigation Tabs & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-800 pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'stock'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-gray-800/60 text-gray-400 hover:text-white'
            }`}
          >
            Stok Terkini
          </button>
          <button
            onClick={() => setActiveTab('mutations')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'mutations'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-gray-800/60 text-gray-400 hover:text-white'
            }`}
          >
            Buku Mutasi (Append-Only)
          </button>
          <button
            onClick={() => setActiveTab('adjustments')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'adjustments'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-gray-800/60 text-gray-400 hover:text-white'
            }`}
          >
            Riwayat Koreksi
          </button>
          <button
            onClick={() => setActiveTab('restock')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'restock'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-gray-800/60 text-emerald-400 hover:text-white'
            }`}
          >
            <span>💡 Prediksi Restock AI</span>
          </button>
        </div>

        {canAdjust && (
          <button
            onClick={() => setShowAdjModal(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Koreksi / Opname Stok</span>
          </button>
        )}
      </div>

      {/* Tab 1: Current Stock */}
      {activeTab === 'stock' && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">SKU</th>
                <th className="py-4 px-4">Nama Produk</th>
                <th className="py-4 px-4 text-center">Batas Min. Stok</th>
                <th className="py-4 px-4 text-center">Stok Saat Ini</th>
                <th className="py-4 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Memuat stok produk...</td></tr>
              ) : stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-800/40">
                  <td className="py-4 px-6 font-mono text-xs text-blue-400">{s.sku}</td>
                  <td className="py-4 px-4 font-semibold text-white">{s.name}</td>
                  <td className="py-4 px-4 text-center font-mono text-gray-400">{s.minStock} {s.saleUnit}</td>
                  <td className="py-4 px-4 text-center font-mono font-bold text-white text-base">{s.currentStock} {s.saleUnit}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block rounded-full px-3 py-1 font-bold text-xs border ${
                      s.currentStock <= s.minStock
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {s.currentStock <= s.minStock ? '🚨 Menipis / Kritis' : '✓ Aman'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Mutations Ledger */}
      {activeTab === 'mutations' && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="p-4 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
            <span>ℹ️ Catatan Mutasi bersifat append-only: tidak ada baris yang pernah dihapus / diubah untuk menjamin integritas audit.</span>
          </div>
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">Waktu</th>
                <th className="py-4 px-4">Produk / SKU</th>
                <th className="py-4 px-4 text-center">Tipe Mutasi</th>
                <th className="py-4 px-4 text-right">Kuantitas</th>
                <th className="py-4 px-4 text-right">Saldo Setelah</th>
                <th className="py-4 px-6">Catatan & Pengguna</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Memuat mutasi...</td></tr>
              ) : mutations.map((m) => (
                <tr key={m.id} className="hover:bg-gray-800/40 text-xs">
                  <td className="py-3 px-6 font-mono text-gray-400">{formatDate(m.createdAt)}</td>
                  <td className="py-3 px-4 font-semibold text-white">{m.product?.name} <span className="text-gray-500 font-mono">({m.product?.sku})</span></td>
                  <td className="py-3 px-4 text-center">
                    <span className={`rounded-md px-2 py-0.5 font-bold border ${getStatusBadgeColor(m.type)}`}>{m.type}</span>
                  </td>
                  <td className={`py-3 px-4 text-right font-mono font-bold text-sm ${m.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-white font-semibold">{m.balanceAfter}</td>
                  <td className="py-3 px-6 text-gray-400">
                    <div>{m.note || '-'}</div>
                    <span className="text-[10px] text-gray-500">Oleh: {m.user?.fullName || 'System'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Adjustments History */}
      {activeTab === 'adjustments' && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">Waktu</th>
                <th className="py-4 px-4">Produk</th>
                <th className="py-4 px-4 text-right">Delta Koreksi</th>
                <th className="py-4 px-4">Alasan</th>
                <th className="py-4 px-6">Catatan / Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Memuat riwayat koreksi...</td></tr>
              ) : adjustments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-800/40 text-xs">
                  <td className="py-3 px-6 font-mono text-gray-400">{formatDate(a.createdAt)}</td>
                  <td className="py-3 px-4 font-semibold text-white">{a.product?.name}</td>
                  <td className={`py-3 px-4 text-right font-mono font-bold ${a.quantityDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {a.quantityDelta > 0 ? `+${a.quantityDelta}` : a.quantityDelta}
                  </td>
                  <td className="py-3 px-4"><span className="rounded bg-gray-800 px-2 py-1 border border-gray-700 text-amber-300 font-semibold">{a.reason}</span></td>
                  <td className="py-3 px-6 text-gray-400">{a.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Restock Prediction */}
      {activeTab === 'restock' && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
            <span>💡 Model Prediksi Restock: Rata-rata penjualan harian 30 hari terakhir diproyeksikan untuk 14 hari kedepan dikurangi sisa stok saat ini.</span>
          </div>
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">SKU / Produk</th>
                <th className="py-4 px-4 text-center">Stok Sisa</th>
                <th className="py-4 px-4 text-center">Rata-rata Terjual / Hari</th>
                <th className="py-4 px-4 text-right font-bold text-emerald-400">Rekomendasi Order Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400">Menghitung prediksi restock...</td></tr>
              ) : restockList.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-emerald-400">Semua produk memiliki cadangan stok yang memadai untuk 14 hari kedepan.</td></tr>
              ) : restockList.map((r) => (
                <tr key={r.productId} className="hover:bg-gray-800/40">
                  <td className="py-4 px-6 font-semibold text-white">{r.name} <span className="text-xs text-blue-400 font-mono">({r.sku})</span></td>
                  <td className="py-4 px-4 text-center font-mono">{r.currentStock}</td>
                  <td className="py-4 px-4 text-center font-mono">{r.avgDailySales} unit/hari</td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400 text-base">+{r.suggestedOrderQty} unit</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Koreksi Stok */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Koreksi / Penyesuaian Stok</h3>
            <form onSubmit={handleCreateAdjustment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Pilih Produk</label>
                <select
                  required
                  value={adjForm.productId}
                  onChange={(e) => setAdjForm({ ...adjForm, productId: e.target.value })}
                  className="glass-input w-full rounded-xl px-3 py-2 text-gray-200"
                >
                  {stocks.map((s) => (
                    <option key={s.id} value={s.id} className="bg-dark-800">
                      {s.name} ({s.sku}) - Sisa: {s.currentStock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Perubahan (Delta)</label>
                  <input
                    type="number"
                    required
                    placeholder="-5 atau 10"
                    value={adjForm.quantityDelta}
                    onChange={(e) => setAdjForm({ ...adjForm, quantityDelta: Number(e.target.value) })}
                    className="glass-input w-full rounded-xl px-3 py-2 text-amber-300 font-bold"
                  />
                  <span className="text-[10px] text-gray-500">Negatif (-) jika hilang/rusak</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Alasan</label>
                  <select
                    value={adjForm.reason}
                    onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2 text-gray-200"
                  >
                    <option value="STOCK_OPNAME" className="bg-dark-800">Stock Opname</option>
                    <option value="DAMAGED" className="bg-dark-800">Rusak / Damaged</option>
                    <option value="EXPIRED" className="bg-dark-800">Kedaluwarsa / Expired</option>
                    <option value="LOST" className="bg-dark-800">Hilang / Lost</option>
                    <option value="OTHER" className="bg-dark-800">Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  value={adjForm.note}
                  onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })}
                  placeholder="Contoh: Pecah saat penataan rak"
                  className="glass-input w-full rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="rounded-xl px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg shadow-amber-600/30"
                >
                  Simpan Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
