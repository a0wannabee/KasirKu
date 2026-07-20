import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import { formatIDR } from '@/lib/utils';
import type { POSProduct } from '@/types/pos';

interface Props {
  query: string;
  onSelect: (product: POSProduct) => void;
}

const DEBOUNCE_MS = 300;

export default function ProductSearch({ query, onSelect }: Props) {
  const [results, setResults] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const res = await fetchApi<{ items: POSProduct[] }>(
      `/products?search=${encodeURIComponent(q)}&limit=20`
    );
    setLoading(false);
    if (res.ok && res.data) setResults(res.data.items || []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, search]);

  if (!query.trim()) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-40 mt-1 glass-panel rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
      {loading ? (
        <div className="px-4 py-3 text-xs text-gray-400 animate-pulse">Mencari...</div>
      ) : results.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-500">
          Tidak ada produk ditemukan untuk &quot;{query}&quot;
        </div>
      ) : (
        <ul className="max-h-60 overflow-y-auto divide-y divide-gray-800">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                disabled={p.currentStock <= 0}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-700/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-blue-400 font-mono">{p.sku}</p>
                </div>
                <div className="ml-4 text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-400 font-mono">
                    {formatIDR(p.sellPrice)}
                  </p>
                  <p className={`text-[10px] font-semibold ${
                    p.currentStock <= 0 ? 'text-rose-400' : p.currentStock <= 5 ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    Stok: {p.currentStock}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
