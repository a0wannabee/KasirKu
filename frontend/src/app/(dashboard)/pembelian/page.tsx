'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR, formatDate, getStatusBadgeColor } from '@/lib/utils';
import { hasRole } from '@/lib/auth';

interface PurchaseItem {
  id: string;
  rawName: string;
  productId: string | null;
  matchedConfidence: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  needsVerification: boolean;
}

interface Purchase {
  id: string;
  purchaseNumber: string;
  status: string;
  receiptImageUrl?: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  totalAmount: number;
  createdAt: string;
  supplier?: { name: string };
  createdBy?: { fullName: string };
  items: PurchaseItem[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  purchaseUnit: string;
}

export default function PembelianPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const canAction = hasRole('OWNER', 'GUDANG');

  const loadPurchases = async () => {
    setLoading(true);
    const [purchRes, prodRes] = await Promise.all([
      fetchApi<Purchase[]>('/purchases'),
      fetchApi<Product[]>('/products'),
    ]);
    if (purchRes.ok && purchRes.data) {
      setPurchases(purchRes.data);
      // Refresh selected purchase if modal open
      if (selectedPurchase) {
        const updated = purchRes.data.find((p) => p.id === selectedPurchase.id);
        if (updated) setSelectedPurchase(updated);
      }
    }
    if (prodRes.ok && prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('receipt', file);

    const res = await fetchApi<Purchase>('/purchases/upload-receipt', {
      method: 'POST',
      body: formData,
    });

    setUploading(false);

    if (res.ok && res.data) {
      alert(`Nota berhasil di-upload dan diproses OCR AI! Nomor Pembelian: ${res.data.purchaseNumber}`);
      loadPurchases();
      setSelectedPurchase(res.data);
    } else {
      setUploadError(res.error || 'Gagal memproses OCR nota. Periksa API key atau koneksi server.');
    }
  };

  const handleVerifyItem = async (itemId: string, targetProductId: string) => {
    if (!selectedPurchase) return;
    const res = await fetchApi(`/purchases/${selectedPurchase.id}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ productId: targetProductId }),
    });

    if (res.ok) {
      loadPurchases();
    } else {
      alert(res.error || 'Gagal memverifikasi item');
    }
  };

  const handlePostPurchase = async (purchaseId: string) => {
    if (!confirm('Apakah Anda yakin ingin memposting pembelian ini? Stok akan otomatis bertambah dan HPP Weighted Average akan dihitung ulang secara permanen.')) return;

    const res = await fetchApi(`/purchases/${purchaseId}/post`, {
      method: 'POST',
    });

    if (res.ok) {
      alert('Pembelian berhasil diposting! Stok dan HPP telah di-update secara atomik.');
      loadPurchases();
      setSelectedPurchase(null);
    } else {
      alert(res.error || 'Gagal memposting pembelian. Pastikan semua item telah diverifikasi.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Upload Banner */}
      {canAction && (
        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 border-2 border-dashed border-blue-500/40 hover:border-blue-500/80 transition-all">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Upload Foto Nota Supplier (AI OCR Automatic Extraction)</h3>
                <p className="text-xs text-gray-400">Sistem akan otomatis mengekstrak nama barang, kuantitas, harga, dan mencocokkannya ke master produk.</p>
              </div>
            </div>

            <div>
              <label className="cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:from-blue-500 hover:to-indigo-500 transition-all inline-flex items-center gap-2">
                {uploading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Menganalisis dengan AI...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Pilih Foto Nota / Drag & Drop</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {uploadError && (
            <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/30">
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* Purchases List */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Daftar Transaksi Pembelian Supplier</h3>
          <span className="text-xs text-gray-400">{purchases.length} Dokumen</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">No. Pembelian / Tanggal</th>
                <th className="py-4 px-4">Supplier</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-right">Total Nominal</th>
                <th className="py-4 px-4">Diunggah Oleh</th>
                <th className="py-4 px-6 text-center">Aksi Verifikasi & Posting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Memuat data pembelian...</td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-500">Belum ada dokumen pembelian diunggah.</td></tr>
              ) : (
                purchases.map((p) => {
                  const unresolvedCount = p.items && Array.isArray(p.items)
                    ? p.items.filter((i) => i.needsVerification || !i.productId).length
                    : 0;
                  return (
                    <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-4 px-6 font-mono font-semibold text-white">
                        <div>{p.purchaseNumber}</div>
                        <span className="text-xs text-gray-400 font-sans">{formatDate(p.createdAt)}</span>
                      </td>
                      <td className="py-4 px-4 text-gray-300">
                        {p.supplier?.name || 'Ekstraksi AI Nota'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-block rounded-lg px-3 py-1 font-bold text-xs border ${getStatusBadgeColor(p.status)}`}>
                          {p.status}
                        </span>
                        {unresolvedCount > 0 && p.status !== 'POSTED' && (
                          <span className="block mt-1 text-[10px] text-amber-400 font-medium">
                            ⚠️ {unresolvedCount} item belum dicocokkan
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatIDR(p.totalAmount)}
                      </td>
                      <td className="py-4 px-4 text-xs text-gray-400">
                        {p.createdBy?.fullName || '-'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedPurchase(p)}
                            className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-300 border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all"
                          >
                            Detail / Verifikasi ({p.items.length} item)
                          </button>
                          {canAction && p.status !== 'POSTED' && unresolvedCount === 0 && (
                            <button
                              onClick={() => handlePostPurchase(p.id)}
                              className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all shadow-sm shadow-emerald-500/20"
                            >
                              Posting Stok & HPP
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-4xl rounded-2xl p-6 border border-gray-700 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-white">Verifikasi Item OCR: {selectedPurchase.purchaseNumber}</h3>
                <p className="text-xs text-gray-400">Cocokkan nama di nota dengan master produk sebelum memposting ke stok</p>
              </div>
              <button onClick={() => setSelectedPurchase(null)} className="text-gray-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-gray-800 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-3">Nama di Nota (Raw)</th>
                    <th className="py-3 px-3">Qty & Satuan</th>
                    <th className="py-3 px-3 text-right">Harga Satuan</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-4">Pencocokan Master Produk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {selectedPurchase.items.map((it) => (
                    <tr key={it.id} className={it.needsVerification ? 'bg-amber-500/5' : ''}>
                      <td className="py-3 px-3 font-semibold text-white">
                        {it.rawName}
                        {it.matchedConfidence > 0 && (
                          <span className="block text-[10px] text-gray-500">AI Confidence: {Math.round(it.matchedConfidence * 100)}%</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-gray-300">
                        {formatIDR(it.unitPrice)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatIDR(it.subtotal)}
                      </td>
                      <td className="py-3 px-4">
                        {selectedPurchase.status === 'POSTED' ? (
                          <span className="text-emerald-400 font-medium">
                            ✓ {products.find((p) => p.id === it.productId)?.name || 'Terhubung'}
                          </span>
                        ) : (
                          <select
                            value={it.productId || ''}
                            onChange={(e) => handleVerifyItem(it.id, e.target.value)}
                            disabled={!canAction}
                            className={`glass-input w-full rounded-lg px-3 py-1.5 text-xs ${
                              it.needsVerification || !it.productId
                                ? 'border-amber-500 text-amber-300 bg-amber-950/40'
                                : 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30'
                            }`}
                          >
                            <option value="">-- Pilih Produk yang Sesuai --</option>
                            {products.map((pr) => (
                              <option key={pr.id} value={pr.id} className="bg-dark-800 text-white">
                                {pr.name} ({pr.sku})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-800">
              <div className="text-xs text-gray-400">
                Total Nominal Nota: <strong className="text-white text-sm font-mono">{formatIDR(selectedPurchase.totalAmount)}</strong>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPurchase(null)}
                  className="rounded-xl px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs"
                >
                  Tutup
                </button>
                {canAction && selectedPurchase.status !== 'POSTED' && (
                  <button
                    onClick={() => handlePostPurchase(selectedPurchase.id)}
                    disabled={selectedPurchase.items.some((i) => i.needsVerification || !i.productId)}
                    className="rounded-xl px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 disabled:opacity-40"
                  >
                    Posting Sekarang
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
