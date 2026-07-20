import { useState, useCallback, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { computeCartTotals, isPaymentSufficient } from '@/lib/calculations';
import { useCart } from './useCart';
import type { POSProduct, Sale, PaymentMethod, CheckoutPayload } from '@/types/pos';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface UsePOSReturn {
  // Products
  products: POSProduct[];
  loadingProducts: boolean;
  loadProducts: () => Promise<void>;
  // Cart (delegated)
  cart: ReturnType<typeof useCart>['cart'];
  addToCart: ReturnType<typeof useCart>['addToCart'];
  updateQuantity: ReturnType<typeof useCart>['updateQuantity'];
  removeFromCart: ReturnType<typeof useCart>['removeFromCart'];
  itemCount: number;
  // Payment
  discount: number;
  setDiscount: (v: number) => void;
  taxRate: number;
  setTaxRate: (v: number) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  amountPaid: number;
  setAmountPaid: (v: number) => void;
  totals: ReturnType<typeof computeCartTotals>;
  canCheckout: boolean;
  // Checkout
  submitting: boolean;
  lastSale: Sale | null;
  checkout: () => Promise<void>;
  resetAfterSale: () => void;
  // Toast
  toasts: Toast[];
  addToast: (type: Toast['type'], msg: string) => void;
  removeToast: (id: string) => void;
}

export function usePOS(): UsePOSReturn {
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart, itemCount } = useCart();

  // Products
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Payment state
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountPaid, setAmountPaid] = useState(0);

  // Checkout state
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = String(++toastIdRef.current);
    setToasts((prev) => [...(Array.isArray(prev) ? prev : []), { id, type, message }]);
    setTimeout(() => setToasts((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== id)), 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== id));
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const res = await fetchApi<{ items: POSProduct[]; total: number }>('/products?limit=200');
    setLoadingProducts(false);
    if (res.ok && res.data) {
      setProducts(Array.isArray(res.data.items) ? res.data.items : []);
    } else {
      addToast('error', res.error || 'Gagal memuat katalog produk.');
    }
  }, [addToast]);

  const totals = computeCartTotals(cart, discount, taxRate, amountPaid);
  const canCheckout =
    cart.length > 0 &&
    !submitting &&
    isPaymentSufficient(totals.total, amountPaid, paymentMethod);

  const checkout = useCallback(async () => {
    if (submitting) return;
    if (cart.length === 0) {
      addToast('error', 'Keranjang masih kosong.');
      return;
    }
    if (!isPaymentSufficient(totals.total, amountPaid, paymentMethod)) {
      addToast('error', 'Jumlah pembayaran kurang dari total tagihan.');
      return;
    }

    setSubmitting(true);

    const payload: CheckoutPayload = {
      items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      discountAmount: discount,
      taxRate,
      paymentMethod,
      amountPaid: paymentMethod === 'CASH' ? amountPaid : totals.total,
    };

    const res = await fetchApi<Sale>('/sales/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.ok && res.data) {
      setLastSale(res.data);
      clearCart();
      setDiscount(0);
      setAmountPaid(0);
      addToast('success', `Transaksi ${res.data.invoiceNumber} berhasil!`);
      // Refresh product stock
      loadProducts();
    } else {
      addToast('error', res.error || 'Gagal memproses transaksi.');
    }
  }, [
    submitting, cart, totals, amountPaid, paymentMethod,
    discount, taxRate, clearCart, addToast, loadProducts,
  ]);

  const resetAfterSale = useCallback(() => {
    setLastSale(null);
    setPaymentMethod('CASH');
  }, []);

  return {
    products,
    loadingProducts,
    loadProducts,
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    itemCount,
    discount,
    setDiscount,
    taxRate,
    setTaxRate,
    paymentMethod,
    setPaymentMethod,
    amountPaid,
    setAmountPaid,
    totals,
    canCheckout,
    submitting,
    lastSale,
    checkout,
    resetAfterSale,
    toasts,
    addToast,
    removeToast,
  };
}
