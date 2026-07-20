import { useState, useCallback } from 'react';
import type { CartItem, POSProduct } from '@/types/pos';

export interface UseCartReturn {
  cart: CartItem[];
  addToCart: (product: POSProduct) => string | null;
  updateQuantity: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  itemCount: number;
}

/**
 * Manages the POS cart state.
 * Returns null from addToCart on success, or an error message string.
 */
export function useCart(): UseCartReturn {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((product: POSProduct): string | null => {
    if (product.currentStock <= 0) {
      return `Stok "${product.name}" sudah habis.`;
    }

    let errorMsg: string | null = null;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          errorMsg = `Stok maksimal "${product.name}" adalah ${product.currentStock}.`;
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    return errorMsg;
  }, []);

  const updateQuantity = useCallback(
    (productId: string, qty: number) => {
      setCart((prev) => {
        if (qty <= 0) {
          return (Array.isArray(prev) ? prev : []).filter((item) => item.product.id !== productId);
        }
        return prev.map((item) => {
          if (item.product.id !== productId) return item;
          const capped = Math.min(qty, item.product.currentStock);
          return { ...item, quantity: capped };
        });
      });
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return { cart, addToCart, updateQuantity, removeFromCart, clearCart, itemCount };
}
