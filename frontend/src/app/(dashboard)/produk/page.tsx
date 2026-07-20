'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR } from '@/lib/utils';
import { hasRole } from '@/lib/auth';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  phone?: string;
}

interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  category?: { id: string; name: string };
  categoryId: string;
  purchaseUnit: string;
  saleUnit: string;
  contentPerPack: number;
  hpp: number;
  sellPrice: number;
  minStock: number;
  currentStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  suppliers?: { supplier: { id: string; name: string } }[];
}

interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

type SearchType = 'name' | 'sku' | 'barcode';

// ─────────────────────────────────────────────
// Toast component
// ─────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl border text-sm font-medium animate-slideIn max-w-sm ${
            t.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
              : t.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-300'
              : 'bg-blue-950/90 border-blue-500/40 text-blue-300'
          }`}
        >
          {t.type === 'success' && (
            <svg className="h-5 w-5 flex-shrink-0 mt-0.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg className="h-5 w-5 flex-shrink-0 mt-0.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {t.type === 'info' && (
            <svg className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton Row
// ─────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800/60 animate-pulse">
      {[...Array(10)].map((_, i) => (
        <td key={i} className="py-4 px-3">
          <div className={`h-4 rounded bg-gray-700/50 ${i === 2 ? 'w-32' : i === 0 || i === 1 ? 'w-24' : 'w-16'}`} />
        </td>
      ))}
    </tr>
  );
}

// ─────────────────────────────────────────────
// Modal Overlay wrapper
// ─────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// View Modal
// ─────────────────────────────────────────────

function ViewModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const isLowStock = product.currentStock <= product.minStock;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{product.name}</h3>
              <p className="text-xs text-blue-400 font-mono">{product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-lg px-3 py-1 text-xs font-semibold border ${
              product.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {product.isActive ? '● Aktif' : '● Tidak Aktif'}
            </span>
            <span className={`rounded-lg px-3 py-1 text-xs font-semibold border ${
              isLowStock ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-gray-700 text-gray-400 border-gray-600'
            }`}>
              {isLowStock ? '⚠ Stok Rendah' : '✓ Stok Aman'}
            </span>
          </div>

          {/* Grid info */}
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="SKU" value={product.sku} mono />
            <InfoField label="Barcode" value={product.barcode || '-'} mono />
            <InfoField label="Kategori" value={product.category?.name || '-'} />
            <InfoField label="Status" value={product.isActive ? 'Aktif' : 'Tidak Aktif'} />
            <InfoField label="Satuan Beli" value={product.purchaseUnit} />
            <InfoField label="Satuan Jual" value={product.saleUnit} />
            <InfoField label="Isi per Pack" value={`${product.contentPerPack} ${product.saleUnit}`} />
            <InfoField label="Stok Minimum" value={`${product.minStock} ${product.saleUnit}`} />
            <InfoField label="Stok Saat Ini" value={`${product.currentStock} ${product.saleUnit}`} highlight={isLowStock ? 'warn' : undefined} />
            <InfoField label="HPP (Weighted Avg)" value={formatIDR(product.hpp)} highlight="neutral" />
            <InfoField label="Harga Jual" value={formatIDR(product.sellPrice)} highlight="positive" />
            <InfoField
              label="Margin"
              value={`${product.hpp > 0 ? (((Number(product.sellPrice) - Number(product.hpp)) / Number(product.hpp)) * 100).toFixed(1) : 0}%`}
            />
          </div>

          {/* Suppliers */}
          {product.suppliers && product.suppliers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Supplier</p>
              <div className="flex flex-wrap gap-2">
                {product.suppliers.map((ps) => (
                  <span key={ps.supplier.id} className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1 text-xs text-gray-300">
                    {ps.supplier.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-800 px-6 py-4 bg-gray-800/30">
          <button onClick={onClose} className="rounded-xl px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-all">
            Tutup
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function InfoField({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: 'positive' | 'warn' | 'neutral';
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
      <p
        className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${
          highlight === 'positive'
            ? 'text-emerald-400'
            : highlight === 'warn'
            ? 'text-amber-400'
            : highlight === 'neutral'
            ? 'text-amber-300'
            : 'text-gray-200'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create / Edit Modal
// ─────────────────────────────────────────────

interface ProductFormState {
  name: string;
  barcode: string;
  categoryId: string;
  purchaseUnit: string;
  saleUnit: string;
  contentPerPack: number;
  sellPrice: number;
  minStock: number;
  supplierId: string;
  isActive: boolean;
}

const DEFAULT_FORM: ProductFormState = {
  name: '',
  barcode: '',
  categoryId: '',
  purchaseUnit: 'Karton',
  saleUnit: 'Pcs',
  contentPerPack: 1,
  sellPrice: 0,
  minStock: 0,
  supplierId: '',
  isActive: true,
};

function ProductFormModal({
  mode,
  initial,
  categories,
  suppliers,
  onClose,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  initial?: Product;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<ProductFormState>(() => {
    if (mode === 'edit' && initial) {
      return {
        name: initial.name,
        barcode: initial.barcode || '',
        categoryId: initial.categoryId,
        purchaseUnit: initial.purchaseUnit,
        saleUnit: initial.saleUnit,
        contentPerPack: initial.contentPerPack,
        sellPrice: Number(initial.sellPrice),
        minStock: initial.minStock,
        supplierId: initial.suppliers?.[0]?.supplier?.id || '',
        isActive: initial.isActive,
      };
    }
    return { ...DEFAULT_FORM, categoryId: categories[0]?.id || '' };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const f = (field: keyof ProductFormState, val: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) { setError('Nama produk wajib diisi.'); return; }
    if (!form.categoryId) { setError('Kategori wajib dipilih.'); return; }
    if (form.sellPrice <= 0) { setError('Harga jual harus lebih dari 0.'); return; }

    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryId: form.categoryId,
      purchaseUnit: form.purchaseUnit.trim(),
      saleUnit: form.saleUnit.trim(),
      contentPerPack: Number(form.contentPerPack),
      sellPrice: Number(form.sellPrice),
      minStock: Number(form.minStock),
      isActive: form.isActive,
    };

    const endpoint = mode === 'create' ? '/products' : `/products/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const res = await fetchApi(endpoint, { method, body: JSON.stringify(payload) });
    setSubmitting(false);

    if (res.ok) {
      onSuccess(mode === 'create' ? 'Produk berhasil ditambahkan.' : 'Produk berhasil diperbarui.');
      onClose();
    } else {
      setError(res.error || 'Terjadi kesalahan.');
    }
  };

  const inputCls = 'glass-input w-full rounded-xl px-3.5 py-2 text-sm placeholder-gray-500';
  const labelCls = 'block text-xs font-semibold text-gray-400 mb-1';

  return (
    <ModalOverlay onClose={onClose}>
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-gray-700 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                mode === 'create'
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-amber-500/10 border border-amber-500/20'
              }`}
            >
              {mode === 'create' ? (
                <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                {mode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk'}
              </h3>
              {mode === 'edit' && initial && <p className="text-xs text-gray-400 font-mono">{initial.sku}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-300">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className={labelCls}>
                Nama Produk <span className="text-rose-400">*</span>
              </label>
              <input
                id="prod-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => f('name', e.target.value)}
                placeholder="Contoh: Kopi Kapal Api 380g"
                className={inputCls}
              />
            </div>

            {/* Barcode */}
            <div>
              <label className={labelCls}>Barcode</label>
              <input
                id="prod-barcode"
                type="text"
                value={form.barcode}
                onChange={(e) => f('barcode', e.target.value)}
                placeholder="Scan atau ketik barcode"
                className={inputCls}
              />
            </div>

            {/* Category + Supplier */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Kategori <span className="text-rose-400">*</span>
                </label>
                <select
                  id="prod-category"
                  value={form.categoryId}
                  onChange={(e) => f('categoryId', e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="" className="bg-dark-800">
                    Pilih kategori
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-dark-800">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Supplier Utama</label>
                <select
                  id="prod-supplier"
                  value={form.supplierId}
                  onChange={(e) => f('supplierId', e.target.value)}
                  className={inputCls}
                >
                  <option value="" className="bg-dark-800">
                    — Tanpa supplier —
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} className="bg-dark-800">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Purchase Unit + Sale Unit + Content Per Pack */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Satuan Beli</label>
                <input
                  id="prod-purchase-unit"
                  type="text"
                  value={form.purchaseUnit}
                  onChange={(e) => f('purchaseUnit', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Satuan Jual</label>
                <input
                  id="prod-sale-unit"
                  type="text"
                  value={form.saleUnit}
                  onChange={(e) => f('saleUnit', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Isi per Pack</label>
                <input
                  id="prod-content-per-pack"
                  type="number"
                  min={1}
                  value={form.contentPerPack}
                  onChange={(e) => f('contentPerPack', Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Sell Price + Min Stock */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Harga Jual (Rp) <span className="text-rose-400">*</span>
                </label>
                <input
                  id="prod-sell-price"
                  type="number"
                  min={0}
                  value={form.sellPrice}
                  onChange={(e) => f('sellPrice', Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Stok Minimum</label>
                <input
                  id="prod-min-stock"
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={(e) => f('minStock', Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Status toggle */}
            <div className="flex items-center justify-between rounded-xl bg-gray-800/60 border border-gray-700/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-200">Status Produk</p>
                <p className="text-xs text-gray-500 mt-0.5">Produk tidak aktif tidak akan muncul di POS</p>
              </div>
              <button
                type="button"
                onClick={() => f('isActive', !form.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.isActive ? 'bg-emerald-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-800 px-6 py-4 bg-gray-800/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`rounded-xl px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all ${
                mode === 'create'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/30'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Menyimpan...
                </span>
              ) : mode === 'create' ? (
                'Simpan Produk'
              ) : (
                'Update Produk'
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

// ─────────────────────────────────────────────
// Delete / Deactivate Confirmation Modal
// ─────────────────────────────────────────────

function ConfirmModal({
  product,
  action,
  onClose,
  onConfirm,
}: {
  product: Product;
  action: 'deactivate' | 'delete';
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const isDelete = action === 'delete';

  return (
    <ModalOverlay onClose={onClose}>
      <div className="glass-panel w-full max-w-md rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-6">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4 ${
              isDelete ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-amber-500/10 border border-amber-500/20'
            }`}
          >
            {isDelete ? (
              <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : (
              <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </div>
          <h3 className="text-center text-base font-bold text-white mb-2">
            {isDelete ? 'Hapus Produk?' : 'Nonaktifkan Produk?'}
          </h3>
          <p className="text-center text-sm text-gray-400 mb-1">
            {isDelete
              ? 'Produk akan dinonaktifkan secara permanen (soft delete). Data riwayat transaksi tetap terjaga.'
              : 'Produk tidak akan muncul di POS dan pencarian. Dapat diaktifkan kembali melalui menu Edit.'}
          </p>
          <p className="text-center text-sm font-semibold text-white mt-3">&quot;{product.name}&quot;</p>
          <p className="text-center text-xs text-gray-500 font-mono">{product.sku}</p>
        </div>
        <div className="flex gap-3 border-t border-gray-800 px-6 py-4 bg-gray-800/30">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-all"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold text-white transition-all disabled:opacity-60 ${
              isDelete ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {loading ? 'Memproses...' : isDelete ? 'Ya, Hapus' : 'Ya, Nonaktifkan'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────

export default function ProdukPage() {
  const isOwner = hasRole('OWNER');
  const canWrite = hasRole('OWNER', 'GUDANG');

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter/search state
  const [searchType, setSearchType] = useState<SearchType>('name');
  const [searchValue, setSearchValue] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'all'>('active');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // Modal state
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{
    product: Product;
    action: 'deactivate' | 'delete';
  } | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = String(++toastIdRef.current);
    setToasts((prev) => [...(Array.isArray(prev) ? prev : []), { id, type, message }]);
    setTimeout(() => setToasts((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== id));
  }, []);

  // Debounced search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchValue);
      setPage(1);
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchValue]);

  // Load reference data once
  useEffect(() => {
    Promise.all([fetchApi<Category[]>('/categories'), fetchApi<Supplier[]>('/suppliers')]).then(
      ([catRes, supRes]) => {
        if (catRes.ok && Array.isArray(catRes.data)) setCategories(catRes.data);
        if (supRes.ok && Array.isArray(supRes.data)) setSuppliers(supRes.data);
      }
    );
  }, []);

  // Fetch products from backend
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterCategory) params.set('categoryId', filterCategory);
    // Backend always filters isActive: true; filterStatus 'all' is a UI note only

    const res = await fetchApi<PaginatedProducts>(`/products?${params.toString()}`);
    setLoading(false);

    if (res.ok && res.data) {
      setProducts(Array.isArray(res.data.items) ? res.data.items : []);
      setTotal(res.data.total || 0);
    } else {
      setError(res.error || 'Gagal memuat daftar produk.');
    }
  }, [page, debouncedSearch, filterCategory]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Refresh after mutations
  const refresh = useCallback(
    async (msg: string, toastType: Toast['type'] = 'success') => {
      addToast(toastType, msg);
      await loadProducts();
    },
    [addToast, loadProducts]
  );

  // Deactivate — uses PUT with all required validation fields
  const handleDeactivate = async (product: Product) => {
    const res = await fetchApi(`/products/${product.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: product.name,
        barcode: product.barcode || undefined,
        categoryId: product.categoryId,
        purchaseUnit: product.purchaseUnit,
        saleUnit: product.saleUnit,
        contentPerPack: product.contentPerPack,
        sellPrice: Number(product.sellPrice),
        minStock: product.minStock,
        isActive: false,
      }),
    });
    if (res.ok) {
      setConfirmTarget(null);
      refresh('Produk berhasil dinonaktifkan.');
    } else {
      addToast('error', res.error || 'Gagal menonaktifkan produk.');
    }
  };

  // Soft delete via DELETE endpoint — OWNER only
  const handleDelete = async (product: Product) => {
    const res = await fetchApi(`/products/${product.id}`, { method: 'DELETE' });
    if (res.ok) {
      setConfirmTarget(null);
      refresh('Produk berhasil dihapus (soft delete).');
    } else {
      addToast('error', res.error || 'Gagal menghapus produk.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const searchPlaceholder: Record<SearchType, string> = {
    name: 'Cari nama produk...',
    sku: 'Cari berdasarkan SKU...',
    barcode: 'Cari berdasarkan barcode...',
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="space-y-5 animate-fadeIn">
        {/* ─── Page header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Master Produk</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {total > 0 ? `${total} produk terdaftar` : 'Kelola daftar produk dan HPP'}
            </p>
          </div>
          {canWrite && (
            <button
              id="btn-create-product"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:from-blue-500 hover:to-indigo-500 transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Produk
            </button>
          )}
        </div>

        {/* ─── Filters bar ─── */}
        <div className="glass-panel rounded-2xl px-4 py-3 flex flex-wrap gap-3 items-center">
          {/* Search type toggle */}
          <div className="flex rounded-xl bg-gray-800/80 border border-gray-700/60 overflow-hidden text-xs font-semibold">
            {(['name', 'sku', 'barcode'] as SearchType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSearchType(t);
                  setSearchValue('');
                }}
                className={`px-3 py-2 transition-all ${
                  searchType === t
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {t === 'name' ? 'Nama' : t === 'sku' ? 'SKU' : 'Barcode'}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="prod-search"
              type="text"
              placeholder={searchPlaceholder[searchType]}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="glass-input w-full rounded-xl pl-9 pr-9 py-2 text-sm"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category filter */}
          <select
            id="prod-filter-category"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="glass-input rounded-xl px-3 py-2 text-sm text-gray-300"
          >
            <option value="" className="bg-dark-800">
              Semua Kategori
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-dark-800">
                {c.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            id="prod-filter-status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as 'active' | 'all');
              setPage(1);
            }}
            className="glass-input rounded-xl px-3 py-2 text-sm text-gray-300"
          >
            <option value="active" className="bg-dark-800">
              Aktif
            </option>
            <option value="all" className="bg-dark-800">
              Semua
            </option>
          </select>

          {/* Reset */}
          {(searchValue || filterCategory || filterStatus !== 'active') && (
            <button
              onClick={() => {
                setSearchValue('');
                setFilterCategory('');
                setFilterStatus('active');
                setPage(1);
              }}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 transition-all"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* ─── Table ─── */}
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
                <tr>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-3">Barcode</th>
                  <th className="py-3.5 px-4">Nama Produk</th>
                  <th className="py-3.5 px-3">Kategori</th>
                  <th className="py-3.5 px-3 text-center">Stok Saat Ini</th>
                  <th className="py-3.5 px-3 text-center">Stok Min</th>
                  <th className="py-3.5 px-3 text-right">HPP</th>
                  <th className="py-3.5 px-3 text-right">Harga Jual</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loading ? (
                  [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
                          <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-rose-300">Gagal memuat data</p>
                          <p className="text-xs text-gray-500 mt-1">{error}</p>
                        </div>
                        <button
                          onClick={loadProducts}
                          className="mt-1 rounded-xl px-4 py-2 bg-rose-600/20 border border-rose-600/30 text-rose-400 text-xs font-semibold hover:bg-rose-600/30 transition-all"
                        >
                          Coba Lagi
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800 border border-gray-700">
                          <svg className="h-7 w-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-300">Tidak ada produk ditemukan</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {debouncedSearch || filterCategory
                              ? 'Coba ubah filter atau kata kunci pencarian.'
                              : 'Belum ada produk yang ditambahkan.'}
                          </p>
                        </div>
                        {canWrite && !debouncedSearch && !filterCategory && (
                          <button
                            onClick={() => setShowCreate(true)}
                            className="mt-1 flex items-center gap-2 rounded-xl px-4 py-2 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-xs font-semibold hover:bg-blue-600/30 transition-all"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Tambah Produk Pertama
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isLowStock = p.currentStock <= p.minStock;
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-gray-800/40 transition-colors ${!p.isActive ? 'opacity-60' : ''}`}
                      >
                        {/* SKU */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-blue-400">{p.sku}</span>
                        </td>

                        {/* Barcode */}
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-xs text-gray-400">
                            {p.barcode || <span className="text-gray-600">—</span>}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white text-sm">{p.name}</span>
                          <span className="block text-xs text-gray-500">
                            {p.saleUnit} · {p.contentPerPack}/pack
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-3">
                          {p.category ? (
                            <span className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-xs text-gray-300">
                              {p.category.name}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Current Stock */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                              isLowStock
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            }`}
                          >
                            {isLowStock && <span>⚠</span>}
                            {p.currentStock}
                          </span>
                        </td>

                        {/* Min Stock */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="text-xs text-gray-400">{p.minStock}</span>
                        </td>

                        {/* HPP */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-mono text-xs text-amber-400">{formatIDR(p.hpp)}</span>
                        </td>

                        {/* Sell Price */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            {formatIDR(p.sellPrice)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold border ${
                              p.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-gray-700/60 text-gray-400 border-gray-600/60'
                            }`}
                          >
                            {p.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View */}
                            <button
                              title="Lihat Detail"
                              onClick={() => setViewProduct(p)}
                              className="rounded-lg p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            {/* Edit */}
                            {canWrite && (
                              <button
                                title="Edit Produk"
                                onClick={() => setEditProduct(p)}
                                className="rounded-lg p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}

                            {/* Deactivate — OWNER only, only for active products */}
                            {isOwner && p.isActive && (
                              <button
                                title="Nonaktifkan"
                                onClick={() => setConfirmTarget({ product: p, action: 'deactivate' })}
                                className="rounded-lg p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            )}

                            {/* Delete (soft) — OWNER only */}
                            {isOwner && (
                              <button
                                title="Hapus (Soft Delete)"
                                onClick={() => setConfirmTarget({ product: p, action: 'delete' })}
                                className="rounded-lg p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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

          {/* ─── Pagination ─── */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-800/60 px-6 py-4">
              <p className="text-xs text-gray-400">
                Halaman <span className="font-semibold text-white">{page}</span> dari{' '}
                <span className="font-semibold text-white">{totalPages}</span> · Total{' '}
                <span className="font-semibold text-white">{total}</span> produk
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ← Sebelumnya
                </button>

                {/* Page number buttons (show up to 5) */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg: number;
                  if (totalPages <= 5) {
                    pg = i + 1;
                  } else if (page <= 3) {
                    pg = i + 1;
                  } else if (page >= totalPages - 2) {
                    pg = totalPages - 4 + i;
                  } else {
                    pg = page - 2 + i;
                  }
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`rounded-lg w-8 h-8 text-xs font-semibold transition-all ${
                        pg === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-700 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}

          {/* Single-page count */}
          {!loading && !error && totalPages <= 1 && products.length > 0 && (
            <div className="border-t border-gray-800/60 px-6 py-3">
              <p className="text-xs text-gray-500">
                Menampilkan <span className="font-semibold text-gray-300">{products.length}</span> produk
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals ─── */}
      {viewProduct && <ViewModal product={viewProduct} onClose={() => setViewProduct(null)} />}

      {showCreate && (
        <ProductFormModal
          mode="create"
          categories={categories}
          suppliers={suppliers}
          onClose={() => setShowCreate(false)}
          onSuccess={(msg) => refresh(msg)}
        />
      )}

      {editProduct && (
        <ProductFormModal
          mode="edit"
          initial={editProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setEditProduct(null)}
          onSuccess={(msg) => refresh(msg)}
        />
      )}

      {confirmTarget && (
        <ConfirmModal
          product={confirmTarget.product}
          action={confirmTarget.action}
          onClose={() => setConfirmTarget(null)}
          onConfirm={async () => {
            if (confirmTarget.action === 'deactivate') {
              await handleDeactivate(confirmTarget.product);
            } else {
              await handleDelete(confirmTarget.product);
            }
          }}
        />
      )}
    </>
  );
}
