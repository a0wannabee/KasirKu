import React from 'react';
import { formatIDR } from '@/lib/utils';
import type { CartItem as CartItemType } from '@/types/pos';

interface Props {
  item: CartItemType;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
}

export default function CartItem({ item, onUpdateQuantity, onRemove }: Props) {
  const { product, quantity } = item;
  const lineTotal = Number(product.sellPrice) * quantity;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-800/60 px-3 py-2.5 border border-gray-700/50 group">
      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{product.name}</p>
        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
          {formatIDR(product.sellPrice)}&nbsp;×&nbsp;{quantity}&nbsp;=&nbsp;
          <span className="text-emerald-400 font-bold">{formatIDR(lineTotal)}</span>
        </p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onUpdateQuantity(product.id, quantity - 1)}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-700 text-white text-sm font-bold hover:bg-gray-600 transition-colors"
          aria-label="Kurangi jumlah"
        >
          −
        </button>
        <span className="w-7 text-center text-sm font-bold text-white font-mono">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => onUpdateQuantity(product.id, quantity + 1)}
          disabled={quantity >= product.currentStock}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Tambah jumlah"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onRemove(product.id)}
          className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          aria-label="Hapus dari keranjang"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
