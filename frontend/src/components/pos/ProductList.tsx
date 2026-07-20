import React from 'react';
import { formatIDR } from '@/lib/utils';
import type { POSProduct } from '@/types/pos';

interface Props {
  products: POSProduct[];
  loading: boolean;
  searchQuery: string;
  onSelect: (product: POSProduct) => void;
}

export default function ProductList({ products, loading, searchQuery, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-gray-800/60 border border-gray-700/40"
          />
        ))}
      </div>
    );
  }

  const filtered = searchQuery.trim() && Array.isArray(products)
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.barcode && p.barcode.includes(searchQuery))
      )
    : (Array.isArray(products) ? products : []);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800 border border-gray-700">
          <svg className="h-7 w-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500">Tidak ada produk ditemukan</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {filtered.map((p) => {
        const outOfStock = p.currentStock <= 0;
        const lowStock = p.currentStock > 0 && p.currentStock <= 5;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            disabled={outOfStock}
            className={`flex flex-col justify-between rounded-xl p-3.5 text-left border transition-all ${
              outOfStock
                ? 'bg-gray-900/40 border-gray-800/40 opacity-40 cursor-not-allowed'
                : 'bg-gray-800/60 border-gray-700/60 hover:bg-gray-800 hover:border-blue-500/60 active:scale-95'
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-blue-400 truncate mb-1">{p.sku}</div>
              <div className="font-semibold text-white text-xs line-clamp-2 leading-snug">
                {p.name}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-gray-700/60 flex items-center justify-between gap-1">
              <span className="font-bold font-mono text-emerald-400 text-xs">
                {formatIDR(p.sellPrice)}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  outOfStock
                    ? 'bg-rose-500/20 text-rose-400'
                    : lowStock
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-gray-700/80 text-gray-400'
                }`}
              >
                {outOfStock ? 'Habis' : `${p.currentStock}`}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
