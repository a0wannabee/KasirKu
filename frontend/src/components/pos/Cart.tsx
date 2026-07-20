import React from 'react';
import type { CartItem as CartItemType } from '@/types/pos';
import CartItem from './CartItem';
import EmptyCart from './EmptyCart';

interface Props {
  cart: CartItemType[];
  itemCount: number;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
}

export default function Cart({ cart, itemCount, onUpdateQuantity, onRemove }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="font-bold text-white text-sm">Keranjang</h3>
        </div>
        {itemCount > 0 && (
          <span className="rounded-lg bg-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-300 border border-blue-500/30">
            {itemCount} item
          </span>
        )}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        {cart.length === 0 ? (
          <EmptyCart />
        ) : (
          cart.map((item) => (
            <CartItem
              key={item.product.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </div>
  );
}
