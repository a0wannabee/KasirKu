'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR, formatDate, getStatusBadgeColor } from '@/lib/utils';
import { hasRole } from '@/lib/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface OcrStatus {
  configured: boolean;
  provider: string | null;
  message: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// ─── Toast Component ─────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed top-5 right-5 z-[110] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl border text-sm font-medium animate-slideIn max-w-sm ${
            t.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300'
              : t.type === 'error'
              ? 'bg-rose-950/95 border-rose-500/40 text-rose-300'
              : t.type === 'warning'
              ? 'bg-amber-950/95 border-amber-500/40 text-amber-300'
              : 'bg-blue-950/95 border-blue-500/40 text-blue-300'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100 font-bold ml-2">✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── Upload Zone Component ────────────────────────────────────────────────────

function UploadZone({
  uploading,
  uploadStep,
  ocrStatus,
  onFileSelected,
  onSimulateClick,
}: {
  uploading: boolean;
  uploadStep: string;
  ocrStatus: OcrStatus | null;
  onFileSelected: (file: File) => void;
  onSimulateClick: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        alert('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert('Ukuran file terlalu besar. Maksimum 8 MB.');
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0]);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-6">
      {/* OCR status banner */}
      {ocrStatus && !ocrStatus.configured && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 border border-amber-500/30 text-xs text-amber-300">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span><strong>OCR tidak dikonfigurasi:</strong> {ocrStatus.message}</span>
        </div>
      )}
      {ocrStatus?.configured && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 border border-emerald-500/20 text-[11px] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Ekstraksi AI OCR aktif
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col md:flex-row items-center justify-between gap-6 rounded-xl border-2 border-dashed p-6 transition-all ${
          dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-blue-500/40 hover:border-blue-500/70'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {uploading ? (
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {uploading ? uploadStep : 'Upload Foto Nota Supplier (AI OCR)'}
            </h3>
            <p className="text-xs text-gray-400">
              {uploading
                ? 'Harap tunggu, proses AI sedang berjalan...'
                : 'Seret & lepas foto ke sini, atau klik tombol di kanan. Format: JPG / PNG / WEBP (maks 8 MB)'}
            </p>
          </div>
        </div>

        {/* Image preview */}
        {preview && !uploading && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview nota"
            className="h-24 w-auto rounded-lg object-contain border border-gray-700 flex-shrink-0"
          />
        )}

        {/* Action buttons */}
        {!uploading && (
          <div className="flex gap-2 flex-shrink-0">
            {/* File picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:from-blue-500 hover:to-indigo-500 transition-all"
            >
              📁 Pilih File
            </button>
            {/* Camera button */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="rounded-xl bg-gray-800 hover:bg-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 border border-gray-700 transition-all"
              title="Ambil foto dengan kamera"
            >
              📷 Kamera
            </button>
            {/* Simulation button (Only in development) */}
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={onSimulateClick}
                className="rounded-xl bg-amber-600/20 hover:bg-amber-600 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:text-white border border-amber-500/30 transition-all shadow-sm"
                title="Simulasi alur verifikasi nota tanpa API Key"
              >
                🧪 Simulasi OCR
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

// ─── New Product Modal (Inline Creation) ──────────────────────────────────────

function NewProductModal({
  item,
  categories,
  onClose,
  onSuccess,
}: {
  item: {
    rawName: string;
    category: string;
    brand: string;
    unit: string;
    barcode: string;
    purchaseItemId: string;
    purchaseId: string;
    unitPrice: number;
  };
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(item.brand ? `${item.brand} ${item.rawName}` : item.rawName);
  const [categoryId, setCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [purchaseUnit, setPurchaseUnit] = useState(item.unit || 'Karton');
  const [saleUnit, setSaleUnit] = useState('Pcs');
  const [contentPerPack, setContentPerPack] = useState(1);
  const [sellPrice, setSellPrice] = useState(Math.round(item.unitPrice * 1.2)); // 20% margin
  const [minStock, setMinStock] = useState(0);
  const [barcode, setBarcode] = useState(item.barcode || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-match category
  useEffect(() => {
    if (item.category) {
      const match = categories.find(c => c.name.toLowerCase() === item.category.toLowerCase());
      if (match) {
        setCategoryId(match.id);
        setIsNewCategory(false);
      } else {
        setIsNewCategory(true);
        setNewCategoryName(item.category);
      }
    } else if (categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [item.category, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Nama produk wajib diisi.');
    if (isNewCategory && !newCategoryName.trim()) return setError('Nama kategori baru wajib diisi.');
    if (!isNewCategory && !categoryId) return setError('Kategori wajib dipilih.');
    if (sellPrice <= 0) return setError('Harga jual harus lebih dari 0.');

    setSubmitting(true);

    try {
      let finalCategoryId = categoryId;
      if (isNewCategory) {
        const catRes = await fetchApi<{ id: string }>('/categories', {
          method: 'POST',
          body: JSON.stringify({ name: newCategoryName.trim() })
        });
        if (!catRes.ok || !catRes.data) {
          throw new Error(catRes.error || 'Gagal membuat kategori baru.');
        }
        finalCategoryId = catRes.data.id;
      }

      const prodRes = await fetchApi<{ id: string }>('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          barcode: barcode.trim() || undefined,
          categoryId: finalCategoryId,
          purchaseUnit: purchaseUnit.trim(),
          saleUnit: saleUnit.trim(),
          contentPerPack,
          sellPrice,
          minStock,
        })
      });

      if (!prodRes.ok || !prodRes.data) {
        throw new Error(prodRes.error || 'Gagal membuat produk baru.');
      }

      // Link to purchase item
      const linkRes = await fetchApi(`/purchases/${item.purchaseId}/items/${item.purchaseItemId}`, {
        method: 'PUT',
        body: JSON.stringify({
          productId: prodRes.data.id,
        })
      });

      if (!linkRes.ok) {
        throw new Error(linkRes.error || 'Gagal menghubungkan produk ke transaksi.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="glass-panel w-full max-w-md rounded-2xl border border-gray-700 overflow-hidden shadow-2xl animate-scaleUp">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-gray-800/50">
          <h3 className="font-bold text-white text-sm">Buat Master Produk Baru</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white font-bold">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Nama Produk</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="glass-input w-full rounded-xl px-3.5 py-2 text-sm text-white" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Kategori</label>
              {isNewCategory ? (
                <div className="flex gap-1.5">
                  <input type="text" placeholder="Nama Kategori..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="glass-input w-full rounded-xl px-3.5 py-2 text-xs text-white" />
                  <button type="button" onClick={() => setIsNewCategory(false)} className="px-2 bg-gray-800 text-gray-400 rounded-xl hover:text-white text-xs border border-gray-700">Pilih</button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <select value={categoryId} onChange={e => {
                    if (e.target.value === '__new__') setIsNewCategory(true);
                    else setCategoryId(e.target.value);
                  }} className="glass-input w-full rounded-xl px-2 py-2 text-xs text-white bg-gray-900">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="__new__">+ Kategori Baru...</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Barcode (Opsional)</label>
              <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} className="glass-input w-full rounded-xl px-3.5 py-2 text-sm text-white font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Satuan Beli</label>
              <input type="text" value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)} className="glass-input w-full rounded-xl px-2 py-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Satuan Jual</label>
              <input type="text" value={saleUnit} onChange={e => setSaleUnit(e.target.value)} className="glass-input w-full rounded-xl px-2 py-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Isi per Pack</label>
              <input type="number" min="1" value={contentPerPack} onChange={e => setContentPerPack(parseInt(e.target.value) || 1)} className="glass-input w-full rounded-xl px-2 py-2 text-xs text-white text-center font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Harga Beli OCR</label>
              <div className="glass-input w-full rounded-xl px-3.5 py-2 text-sm text-gray-400 bg-gray-880/40 border-gray-800 font-mono">
                {formatIDR(item.unitPrice)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Harga Jual Toko (Rp)</label>
              <input type="number" min="1" value={sellPrice} onChange={e => setSellPrice(parseInt(e.target.value) || 0)} className="glass-input w-full rounded-xl px-3.5 py-2 text-sm text-white font-mono font-bold text-emerald-400 bg-emerald-950/10 border-emerald-500/20" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Stok Minimum Peringatan</label>
            <input type="number" min="0" value={minStock} onChange={e => setMinStock(parseInt(e.target.value) || 0)} className="glass-input w-full rounded-xl px-3.5 py-2 text-sm text-white" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-800 px-6 py-4 bg-gray-800/30">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs transition-all">Batal</button>
          <button type="submit" disabled={submitting} className="rounded-xl px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50">
            {submitting ? 'Menyimpan...' : 'Simpan Master Produk'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Bulk Create Modal (Inline Mass Creation) ──────────────────────────────────

function BulkCreateModal({
  purchase,
  categories,
  onClose,
  onSuccess,
}: {
  purchase: Purchase;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Extract initial items having status NEW PRODUCT
  useEffect(() => {
    let parsedOcr: any = null;
    try {
      if (purchase.ocrRawText) {
        const cleaned = purchase.ocrRawText.replace(/```json|```/g, '').trim();
        parsedOcr = JSON.parse(cleaned);
      }
    } catch (e) {
      console.error(e);
    }

    const newProductItems = purchase.items
      .filter((it) => !it.productId && Number(it.quantity) > 0 && Number(it.unitPrice) > 0)
      .map((it, idx) => {
        const ocrItem = parsedOcr?.items?.find((i: any) => i.rawName === it.rawName) || parsedOcr?.items?.[idx];
        const predictedCategory = ocrItem?.category || 'Sembako';
        const predictedBrand = ocrItem?.brand || '';
        const predictedBarcode = ocrItem?.barcode || '';
        const name = predictedBrand ? `${predictedBrand} ${it.rawName}` : it.rawName;
        
        // Find if predicted category matches existing ones
        const existingCat = categories.find(c => c.name.toLowerCase() === predictedCategory.toLowerCase());
        
        return {
          purchaseItemId: it.id,
          purchaseId: purchase.id,
          name,
          categoryName: existingCat ? '' : predictedCategory,
          categoryId: existingCat ? existingCat.id : (categories[0]?.id || ''),
          isNewCategory: !existingCat,
          barcode: predictedBarcode,
          purchaseUnit: it.unit || 'Karton',
          saleUnit: 'Pcs',
          contentPerPack: 1,
          hpp: it.unitPrice,
          sellPrice: Math.round(it.unitPrice * 1.2), // 20% margin recommendation
          minStock: 0,
        };
      });

    setItems(newProductItems);
  }, [purchase, categories]);

  const updateItemField = (idx: number, field: string, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validations
    for (const item of items) {
      if (!item.name.trim()) return setError('Semua nama produk wajib diisi.');
      if (item.isNewCategory && !item.categoryName.trim()) return setError('Semua kategori baru harus memiliki nama.');
      if (!item.isNewCategory && !item.categoryId) return setError('Semua produk harus memiliki kategori.');
      if (item.sellPrice <= 0) return setError('Semua harga jual harus lebih dari 0.');
    }

    setSubmitting(true);

    try {
      const res = await fetchApi('/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        throw new Error(res.error || 'Gagal membuat produk masal.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="glass-panel w-full max-w-4xl rounded-2xl border border-gray-700 overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scaleUp">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-gray-800/50">
          <div>
            <h3 className="font-bold text-white text-sm">Buat Semua Produk Baru Secara Masal</h3>
            <p className="text-[10px] text-gray-400">Review dan sesuaikan detail produk yang diprediksi AI dari nota.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white font-bold">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">{error}</div>}

          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-gray-850 text-gray-400 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-2">Nama Produk (Editable)</th>
                <th className="py-2.5 px-2 w-48">Kategori</th>
                <th className="py-2.5 px-2 w-28">Barcode</th>
                <th className="py-2.5 px-2 text-center w-24">Satuan Beli/Jual</th>
                <th className="py-2.5 px-2 text-right w-24">Harga Beli</th>
                <th className="py-2.5 px-2 text-right w-32">Harga Jual (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-gray-800/20">
                  <td className="py-2.5 px-2">
                    <input type="text" value={it.name} onChange={e => updateItemField(idx, 'name', e.target.value)} className="glass-input w-full rounded-lg px-2 py-1 text-xs text-white" required />
                  </td>
                  <td className="py-2.5 px-2">
                    {it.isNewCategory ? (
                      <div className="flex gap-1">
                        <input type="text" placeholder="Nama Kategori..." value={it.categoryName} onChange={e => updateItemField(idx, 'categoryName', e.target.value)} className="glass-input w-full rounded-lg px-2 py-1 text-xs text-white" />
                        <button type="button" onClick={() => updateItemField(idx, 'isNewCategory', false)} className="px-1.5 py-1 bg-gray-800 text-gray-400 rounded-lg hover:text-white text-[10px] border border-gray-700">Pilih</button>
                      </div>
                    ) : (
                      <select value={it.categoryId} onChange={e => {
                        if (e.target.value === '__new__') {
                          updateItemField(idx, 'isNewCategory', true);
                        } else {
                          updateItemField(idx, 'categoryId', e.target.value);
                        }
                      }} className="glass-input w-full rounded-lg px-1 py-1 text-xs text-white bg-gray-900">
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="__new__">+ Baru...</option>
                      </select>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    <input type="text" value={it.barcode} onChange={e => updateItemField(idx, 'barcode', e.target.value)} className="glass-input w-full rounded-lg px-2 py-1 text-xs text-white font-mono" />
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px] text-gray-400 font-bold">{it.purchaseUnit}</span>
                      <span className="text-[10px] text-gray-600">→</span>
                      <input type="text" value={it.saleUnit} onChange={e => updateItemField(idx, 'saleUnit', e.target.value)} className="glass-input w-8 text-center rounded-lg px-1 py-0.5 text-[10px] text-white" />
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{formatIDR(it.hpp)}</td>
                  <td className="py-2.5 px-2 text-right">
                    <input type="number" min="1" value={it.sellPrice} onChange={e => updateItemField(idx, 'sellPrice', parseInt(e.target.value) || 0)} className="glass-input w-full rounded-lg px-2 py-1 text-xs text-right text-emerald-400 font-mono font-bold bg-emerald-950/10 border-emerald-500/20" required />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-800 px-6 py-4 bg-gray-800/30">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs transition-all">Batal</button>
          <button type="submit" disabled={submitting} className="rounded-xl px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50">
            {submitting ? 'Membuat Master Produk...' : `Buat ${items.length} Master Produk Baru`}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Verify Modal ─────────────────────────────────────────────────────────────

function VerifyModal({
  purchase,
  products,
  categories,
  canAction,
  onUpdateItem,
  onDeleteItem,
  onPost,
  onRefreshPurchase,
  onClose,
}: {
  purchase: Purchase;
  products: Product[];
  categories: { id: string; name: string }[];
  canAction: boolean;
  onUpdateItem: (itemId: string, updates: { productId?: string; quantity?: number; unitPrice?: number }) => void;
  onDeleteItem: (itemId: string) => void;
  onPost: (purchaseId: string) => void;
  onRefreshPurchase: () => void;
  onClose: () => void;
}) {
  const [showNewProductModal, setShowNewProductModal] = useState<any | null>(null);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);

  const allResolved = purchase.items.every((i) => !i.needsVerification && i.productId);

  // Parse predictions from ocrRawText
  let parsedOcr: any = null;
  try {
    if (purchase.ocrRawText) {
      const cleaned = purchase.ocrRawText.replace(/```json|```/g, '').trim();
      parsedOcr = JSON.parse(cleaned);
    }
  } catch (e) {
    console.error("Failed to parse ocrRawText:", e);
  }

  // Count items with status NEW PRODUCT
  const newProductItemsCount = purchase.items.filter(
    (it) => !it.productId && Number(it.quantity) > 0 && Number(it.unitPrice) > 0
  ).length;

  const getItemStatus = (it: PurchaseItem) => {
    if (Number(it.quantity) <= 0 || Number(it.unitPrice) <= 0) {
      return { name: 'ERROR', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    }
    if (!it.productId) {
      return { name: 'NEW PRODUCT', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    }
    if (it.needsVerification) {
      return { name: 'REVIEW', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    }
    return { name: 'MATCHED', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
        <div className="glass-panel w-full max-w-5xl rounded-2xl p-6 border border-gray-700 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
            <div>
              <h3 className="text-base font-bold text-white">Verifikasi OCR: {purchase.purchaseNumber}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Cocokkan setiap item nota dengan master produk • Confidence AI: {purchase.ocrConfidence != null ? `${Math.round(purchase.ocrConfidence * 100)}%` : '—'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-lg leading-none">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-800 text-gray-400 uppercase font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-3 w-16 text-center">Status</th>
                  <th className="py-3 px-3">Nama di Nota (Raw OCR)</th>
                  <th className="py-3 px-3 text-center">Qty & Satuan</th>
                  <th className="py-3 px-3 text-right">Harga Satuan</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-4">Pencocokan Produk</th>
                  {purchase.status !== 'POSTED' && canAction && <th className="py-3 px-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {purchase.items.map((it, index) => {
                  const statusObj = getItemStatus(it);
                  const ocrItem = parsedOcr?.items?.find((i: any) => i.rawName === it.rawName) || parsedOcr?.items?.[index];
                  
                  return (
                    <tr key={it.id} className={`${it.needsVerification ? 'bg-amber-500/5' : ''} hover:bg-gray-850/30 transition-colors`}>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block rounded-lg px-2.5 py-0.5 text-[9px] font-bold border ${statusObj.cls}`}>
                          {statusObj.name}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{it.rawName}</div>
                        {it.matchedConfidence > 0 && (
                          <span className={`text-[10px] font-medium ${it.matchedConfidence >= 0.8 ? 'text-emerald-400' : it.matchedConfidence >= 0.6 ? 'text-amber-400' : 'text-rose-400'}`}>
                            AI Match: {Math.round(it.matchedConfidence * 100)}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {purchase.status === 'POSTED' ? (
                          <span>{it.quantity} {it.unit}</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              defaultValue={it.quantity}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== it.quantity) {
                                  onUpdateItem(it.id, { quantity: val });
                                }
                              }}
                              className="glass-input w-16 text-center rounded px-1.5 py-1 text-xs"
                            />
                            <span className="text-[10px] text-gray-400">{it.unit || 'pcs'}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {purchase.status === 'POSTED' ? (
                          <span className="font-mono">{formatIDR(it.unitPrice)}</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1 font-mono">
                            <span className="text-[10px] text-gray-500">Rp</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              defaultValue={it.unitPrice}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== it.unitPrice) {
                                  onUpdateItem(it.id, { unitPrice: val });
                                }
                              }}
                              className="glass-input w-24 text-right rounded px-1.5 py-1 text-xs font-mono"
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{formatIDR(it.subtotal)}</td>
                      <td className="py-3 px-4">
                        {purchase.status === 'POSTED' ? (
                          <span className="text-emerald-400 font-semibold">
                            ✓ {products.find((p) => p.id === it.productId)?.name || 'Terhubung'}
                          </span>
                        ) : statusObj.name === 'NEW PRODUCT' ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowNewProductModal({
                                rawName: it.rawName,
                                category: ocrItem?.category || '',
                                brand: ocrItem?.brand || '',
                                unit: it.unit,
                                barcode: ocrItem?.barcode || '',
                                purchaseItemId: it.id,
                                purchaseId: purchase.id,
                                unitPrice: it.unitPrice,
                              })}
                              className="rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white px-3 py-1.5 text-xs font-bold transition-all shadow-sm"
                            >
                              ➕ Buat Produk
                            </button>
                            <select
                              value={it.productId || ''}
                              onChange={(e) => e.target.value && onUpdateItem(it.id, { productId: e.target.value })}
                              disabled={!canAction}
                              className="glass-input flex-1 rounded-lg px-2 py-1.5 text-[11px] text-gray-400 bg-gray-900 border-gray-800"
                            >
                              <option value="">-- Atau pilih manual --</option>
                              {products.map((pr) => (
                                <option key={pr.id} value={pr.id} className="bg-gray-900 text-white">
                                  {pr.name} ({pr.sku})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <select
                            value={it.productId || ''}
                            onChange={(e) => e.target.value && onUpdateItem(it.id, { productId: e.target.value })}
                            disabled={!canAction}
                            className={`glass-input w-full rounded-lg px-2 py-1.5 text-xs ${
                              it.needsVerification || !it.productId
                                ? 'border-amber-500/60 text-amber-300 bg-amber-950/30'
                                : 'border-emerald-500/50 text-emerald-300 bg-emerald-950/20'
                            }`}
                          >
                            <option value="">-- Pilih Produk yang Sesuai --</option>
                            {products.map((pr) => (
                              <option key={pr.id} value={pr.id} className="bg-gray-900 text-white">
                                {pr.name} ({pr.sku})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      {purchase.status !== 'POSTED' && canAction && (
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Apakah Anda yakin ingin menghapus item ini dari daftar pembelian?')) {
                                onDeleteItem(it.id);
                              }
                            }}
                            className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 transition-all font-bold"
                            title="Hapus baris"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-800">
            <div className="text-xs text-gray-400 flex items-center gap-4">
              <div>
                Total: <strong className="text-white font-mono text-sm">{formatIDR(purchase.totalAmount)}</strong>
              </div>
              {!allResolved && purchase.status !== 'POSTED' && (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span>⚠</span> {purchase.items.filter((i) => i.needsVerification || !i.productId).length} item perlu dicocokkan
                </span>
              )}
              {newProductItemsCount > 0 && purchase.status !== 'POSTED' && canAction && (
                <button
                  type="button"
                  onClick={() => setShowBulkCreateModal(true)}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 px-4 py-1.5 text-xs font-bold transition-all shadow-lg shadow-blue-500/20 animate-pulse"
                >
                  🚀 Buat Semua Produk Baru ({newProductItemsCount})
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs"
              >
                Tutup
              </button>
              {canAction && purchase.status !== 'POSTED' && (
                <button
                  onClick={() => onPost(purchase.id)}
                  disabled={!allResolved || purchase.items.length === 0}
                  className="rounded-xl px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Posting Stok & HPP
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNewProductModal && (
        <NewProductModal
          item={showNewProductModal}
          categories={categories}
          onClose={() => setShowNewProductModal(null)}
          onSuccess={async () => {
            setShowNewProductModal(null);
            onRefreshPurchase();
          }}
        />
      )}

      {showBulkCreateModal && (
        <BulkCreateModal
          purchase={purchase}
          categories={categories}
          onClose={() => setShowBulkCreateModal(false)}
          onSuccess={async () => {
            setShowBulkCreateModal(false);
            onRefreshPurchase();
          }}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PembelianPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [ocrStatus, setOcrStatus] = useState<OcrStatus | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const canAction = hasRole('OWNER', 'GUDANG');

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = String(++toastId.current);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [purchRes, prodRes, catRes] = await Promise.all([
      fetchApi<Purchase[]>('/purchases'),
      fetchApi<{ items: Product[] }>('/products?limit=200'),
      fetchApi<{ id: string; name: string }[]>('/categories'),
    ]);
    if (purchRes.ok && Array.isArray(purchRes.data)) setPurchases(purchRes.data);
    if (prodRes.ok && prodRes.data) setProducts(Array.isArray(prodRes.data.items) ? prodRes.data.items : []);
    if (catRes.ok && Array.isArray(catRes.data)) setCategories(catRes.data);
    setLoading(false);
  }, []);

  // Check OCR status on mount
  useEffect(() => {
    loadAll();
    if (canAction) {
      fetchApi<OcrStatus>('/purchases/ocr-status').then((res) => {
        if (res.ok && res.data) setOcrStatus(res.data);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelected = async (file: File) => {
    setUploading(true);
    setUploadStep('Mengunggah gambar...');

    const formData = new FormData();
    formData.append('receipt', file);

    setUploadStep('AI sedang menganalisis nota...');

    const res = await fetchApi<Purchase>('/purchases/upload-receipt', {
      method: 'POST',
      body: formData,
    });

    setUploading(false);
    setUploadStep('');

    if (res.ok && res.data) {
      addToast('success', `Nota berhasil diproses! Nomor: ${res.data.purchaseNumber}`);
      await loadAll();
      setSelectedPurchase(res.data);
    } else {
      const msg = res.error || 'Gagal memproses nota.';
      addToast('error', msg);
    }
  };

  const handleSimulateOcr = async () => {
    setUploading(true);
    setUploadStep('Menyiapkan berkas simulasi...');

    const jpegHex = 'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc0001108000100010301110002110103110000ffdd00040001ffc40014000100000000000000000000000000000000ffc40014100000000000000000000000000000000ffda000c03010002110311003f009ff00ffd9';
    const bytes = new Uint8Array(jpegHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const file = new File([bytes], 'simulated-receipt.jpg', { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('receipt', file);

    setUploadStep('AI sedang menganalisis nota (Simulasi)...');

    const res = await fetchApi<Purchase>('/purchases/upload-receipt?simulate=true', {
      method: 'POST',
      body: formData,
    });

    setUploading(false);
    setUploadStep('');

    if (res.ok && res.data) {
      addToast('success', `Simulasi OCR Berhasil! Nomor: ${res.data.purchaseNumber}`);
      await loadAll();
      setSelectedPurchase(res.data);
    } else {
      const msg = res.error || 'Gagal menjalankan simulasi.';
      addToast('error', msg);
    }
  };

  const handleUpdateItem = async (
    itemId: string,
    updates: { productId?: string; quantity?: number; unitPrice?: number }
  ) => {
    if (!selectedPurchase) return;
    const res = await fetchApi(`/purchases/${selectedPurchase.id}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await loadAll();
      // Refresh selected purchase from the updated list
      const updatedList = await fetchApi<Purchase[]>('/purchases');
      if (updatedList.ok && Array.isArray(updatedList.data)) {
        const updated = updatedList.data.find((p) => p.id === selectedPurchase.id);
        if (updated) setSelectedPurchase(updated);
      }
    } else {
      addToast('error', res.error || 'Gagal memperbarui item.');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedPurchase) return;
    const res = await fetchApi(`/purchases/${selectedPurchase.id}/items/${itemId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      addToast('success', 'Item berhasil dihapus.');
      await loadAll();
      // Refresh selected purchase from the updated list
      const updatedList = await fetchApi<Purchase[]>('/purchases');
      if (updatedList.ok && Array.isArray(updatedList.data)) {
        const updated = updatedList.data.find((p) => p.id === selectedPurchase.id);
        if (updated) setSelectedPurchase(updated);
      }
    } else {
      addToast('error', res.error || 'Gagal menghapus item.');
    }
  };

  const handlePost = async (purchaseId: string) => {
    const res = await fetchApi(`/purchases/${purchaseId}/post`, { method: 'POST' });
    if (res.ok) {
      addToast('success', 'Pembelian diposting! Stok dan HPP telah diperbarui secara atomik.');
      setSelectedPurchase(null);
      await loadAll();
    } else {
      addToast('error', res.error || 'Gagal memposting. Pastikan semua item telah diverifikasi.');
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="space-y-6 animate-fadeIn">
        {/* Upload Zone */}
        {canAction && (
          <UploadZone
            uploading={uploading}
            uploadStep={uploadStep}
            ocrStatus={ocrStatus}
            onFileSelected={handleFileSelected}
            onSimulateClick={handleSimulateOcr}
          />
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
                  <th className="py-4 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">Memuat data pembelian...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-500">Belum ada dokumen pembelian diunggah.</td></tr>
                ) : (
                  purchases.map((p) => {
                    const unresolvedCount = Array.isArray(p.items)
                      ? p.items.filter((i) => i.needsVerification || !i.productId).length
                      : 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-4 px-6 font-mono font-semibold text-white">
                          <div>{p.purchaseNumber}</div>
                          <span className="text-xs text-gray-400 font-sans">{formatDate(p.createdAt)}</span>
                        </td>
                        <td className="py-4 px-4 text-gray-300">{p.supplier?.name || 'Ekstraksi AI Nota'}</td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block rounded-lg px-3 py-1 font-bold text-xs border ${getStatusBadgeColor(p.status)}`}>
                            {p.status}
                          </span>
                          {unresolvedCount > 0 && p.status !== 'POSTED' && (
                            <span className="block mt-1 text-[10px] text-amber-400 font-medium">
                              ⚠ {unresolvedCount} belum dicocokkan
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatIDR(p.totalAmount)}
                        </td>
                        <td className="py-4 px-4 text-xs text-gray-400">{p.createdBy?.fullName || '-'}</td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedPurchase(p)}
                              className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-300 border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all"
                            >
                              Detail ({Array.isArray(p.items) ? p.items.length : 0})
                            </button>
                            {canAction && p.status !== 'POSTED' && unresolvedCount === 0 && (
                              <button
                                onClick={() => handlePost(p.id)}
                                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all"
                              >
                                Posting
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
      </div>

      {/* Verify Modal */}
      {selectedPurchase && (
        <VerifyModal
          purchase={selectedPurchase}
          products={products}
          categories={categories}
          canAction={canAction}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onPost={handlePost}
          onRefreshPurchase={async () => {
            await loadAll();
            // Refresh selected purchase from the updated list
            const updatedList = await fetchApi<Purchase[]>('/purchases');
            if (updatedList.ok && Array.isArray(updatedList.data)) {
              const updated = updatedList.data.find((p) => p.id === selectedPurchase.id);
              if (updated) setSelectedPurchase(updated);
            }
          }}
          onClose={() => setSelectedPurchase(null)}
        />
      )}
    </>
  );
}
