'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePOS } from '@/hooks/usePOS';
import POSHeader from '@/components/pos/POSHeader';
import BarcodeInput from '@/components/pos/BarcodeInput';
import ProductSearch from '@/components/pos/ProductSearch';
import ProductList from '@/components/pos/ProductList';
import PaymentPanel from '@/components/pos/PaymentPanel';
import ReceiptModal from '@/components/pos/ReceiptModal';
import HistoryModal from '@/components/pos/HistoryModal';
import type { POSProduct } from '@/types/pos';

// ─── Toast display ───────────────────────────
function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: { id: string; type: 'success' | 'error' | 'info'; message: string }[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl border text-sm font-medium animate-slideIn max-w-sm ${
            t.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300'
              : t.type === 'error'
              ? 'bg-rose-950/95 border-rose-500/40 text-rose-300'
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

// ─── Main page ────────────────────────────────
export default function KasirPage() {
  const pos = usePOS();
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Load products on mount
  useEffect(() => {
    pos.loadProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle barcode Enter: exact match by barcode > SKU > first result
  const handleEnter = useCallback(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    const match =
      pos.products.find((p) => p.barcode === searchQuery.trim()) ??
      pos.products.find((p) => p.sku.toLowerCase() === q) ??
      pos.products.find(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    if (match) {
      const err = pos.addToCart(match);
      if (err) pos.addToast('error', err);
      setSearchQuery('');
    } else {
      pos.addToast('info', `Produk "${searchQuery}" tidak ditemukan.`);
    }
  }, [searchQuery, pos]);

  const handleProductSelect = useCallback(
    (product: POSProduct) => {
      const err = pos.addToCart(product);
      if (err) pos.addToast('error', err);
      setSearchQuery('');
    },
    [pos]
  );

  return (
    <>
      <ToastContainer toasts={pos.toasts} onRemove={pos.removeToast} />

      <div className="flex flex-col gap-4 h-[calc(100vh-8.5rem)] animate-fadeIn">
        {/* Top header bar */}
        <POSHeader onOpenHistory={() => setShowHistory(true)} />

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* ── Left panel: search + product grid ── */}
          <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
            {/* Search bar with dropdown */}
            <div className="glass-panel rounded-2xl p-3 relative">
              <BarcodeInput
                value={searchQuery}
                onChange={setSearchQuery}
                onEnter={handleEnter}
                onEscape={() => setSearchQuery('')}
              />
              <ProductSearch query={searchQuery} onSelect={handleProductSelect} />
            </div>

            {/* Product grid */}
            <div className="glass-panel rounded-2xl p-4 flex-1 overflow-y-auto">
              <ProductList
                products={pos.products}
                loading={pos.loadingProducts}
                searchQuery={searchQuery}
                onSelect={handleProductSelect}
              />
            </div>
          </div>

          {/* ── Right panel: cart + payment ── */}
          <div className="min-h-0">
            <PaymentPanel
              cart={pos.cart}
              itemCount={pos.itemCount}
              totals={pos.totals}
              discount={pos.discount}
              taxRate={pos.taxRate}
              paymentMethod={pos.paymentMethod}
              amountPaid={pos.amountPaid}
              canCheckout={pos.canCheckout}
              submitting={pos.submitting}
              onUpdateQuantity={pos.updateQuantity}
              onRemove={pos.removeFromCart}
              onDiscountChange={pos.setDiscount}
              onTaxRateChange={pos.setTaxRate}
              onPaymentMethodChange={pos.setPaymentMethod}
              onAmountPaidChange={pos.setAmountPaid}
              onCheckout={pos.checkout}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {pos.lastSale && (
        <ReceiptModal
          sale={pos.lastSale}
          onClose={pos.resetAfterSale}
        />
      )}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </>
  );
}
