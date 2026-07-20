import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR, formatDate, getStatusBadgeColor } from '@/lib/utils';
import { hasRole } from '@/lib/auth';
import type { Sale } from '@/types/pos';

interface Props {
  onClose: () => void;
}

export default function HistoryModal({ onClose }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const canVoid = hasRole('OWNER');

  useEffect(() => {
    fetchApi<Sale[]>('/sales').then((res) => {
      if (res.ok && res.data) setSales(res.data);
      setLoading(false);
    });
  }, []);

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget || !voidReason.trim()) return;
    const res = await fetchApi(`/sales/${voidTarget.id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason: voidReason }),
    });
    if (res.ok) {
      setSales((prev) =>
        prev.map((s) => (s.id === voidTarget.id ? { ...s, status: 'VOID' as const } : s))
      );
      setVoidTarget(null);
      setVoidReason('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-4xl rounded-2xl p-6 border border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
          <div>
            <h3 className="text-base font-bold text-white">Riwayat Transaksi &amp; Void</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Transaksi tidak pernah dihapus — void hanya mengubah status &amp; mencatat audit
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-lg">✕</button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Memuat riwayat...</div>
          ) : (
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-800 text-gray-400 uppercase font-semibold sticky top-0">
                <tr>
                  <th className="py-3 px-4">Invoice / Waktu</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Metode</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {canVoid && <th className="py-3 px-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Belum ada transaksi tercatat.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-800/40">
                      <td className="py-3 px-4 font-mono font-semibold text-white">
                        <div>{s.invoiceNumber}</div>
                        <span className="text-[10px] text-gray-400 font-sans">{formatDate(s.createdAt)}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatIDR(s.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="rounded bg-gray-800 px-2 py-0.5 border border-gray-700 font-semibold">
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`rounded px-2.5 py-0.5 font-bold border text-[11px] ${getStatusBadgeColor(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      {canVoid && (
                        <td className="py-3 px-4 text-center">
                          {s.status === 'COMPLETED' ? (
                            <button
                              onClick={() => setVoidTarget(s)}
                              className="rounded bg-rose-500/20 px-3 py-1 font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all text-[11px]"
                            >
                              VOID
                            </button>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Void confirmation form */}
        {voidTarget && (
          <form
            onSubmit={handleVoid}
            className="mt-4 pt-4 border-t border-gray-800 rounded-xl bg-rose-950/20 border border-rose-500/30 p-4 space-y-3"
          >
            <p className="text-xs font-bold text-rose-400 uppercase">
              Konfirmasi VOID: {voidTarget.invoiceNumber}
            </p>
            <div className="flex gap-2">
              <input
                required
                type="text"
                placeholder="Alasan void wajib diisi untuk audit log"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="glass-input flex-1 rounded-lg px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white"
              >
                Proses VOID
              </button>
              <button
                type="button"
                onClick={() => { setVoidTarget(null); setVoidReason(''); }}
                className="rounded-lg bg-gray-800 px-4 py-2 text-xs text-gray-300 hover:bg-gray-700"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
