import React from 'react';
import type { CartItem, CartTotals, PaymentMethod as PaymentMethodType } from '@/types/pos';
import Cart from './Cart';
import OrderSummary from './OrderSummary';
import PaymentMethod from './PaymentMethod';
import CashShortcut from './CashShortcut';
import CheckoutButton from './CheckoutButton';

interface Props {
  cart: CartItem[];
  itemCount: number;
  totals: CartTotals;
  discount: number;
  taxRate: number;
  paymentMethod: PaymentMethodType;
  amountPaid: number;
  canCheckout: boolean;
  submitting: boolean;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onDiscountChange: (v: number) => void;
  onTaxRateChange: (v: number) => void;
  onPaymentMethodChange: (m: PaymentMethodType) => void;
  onAmountPaidChange: (v: number) => void;
  onCheckout: () => void;
}

export default function PaymentPanel({
  cart,
  itemCount,
  totals,
  discount,
  taxRate,
  paymentMethod,
  amountPaid,
  canCheckout,
  submitting,
  onUpdateQuantity,
  onRemove,
  onDiscountChange,
  onTaxRateChange,
  onPaymentMethodChange,
  onAmountPaidChange,
  onCheckout,
}: Props) {
  const handlePaymentMethodChange = (m: PaymentMethodType) => {
    onPaymentMethodChange(m);
    // Auto-fill exact amount for non-cash methods
    if (m !== 'CASH') {
      onAmountPaidChange(totals.total);
    }
  };

  return (
    <div className="glass-panel flex flex-col rounded-2xl border border-gray-700/80 shadow-xl overflow-hidden h-full">
      <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
        {/* Cart */}
        <Cart
          cart={cart}
          itemCount={itemCount}
          onUpdateQuantity={onUpdateQuantity}
          onRemove={onRemove}
        />

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Order summary */}
        <OrderSummary
          totals={totals}
          discount={discount}
          taxRate={taxRate}
          onDiscountChange={onDiscountChange}
          onTaxRateChange={onTaxRateChange}
        />

        {/* Payment method */}
        <PaymentMethod selected={paymentMethod} onChange={handlePaymentMethodChange} />

        {/* Cash shortcuts (only for CASH) */}
        {paymentMethod === 'CASH' && (
          <CashShortcut
            total={totals.total}
            amountPaid={amountPaid}
            change={totals.change}
            onAmountChange={onAmountPaidChange}
          />
        )}
      </div>

      {/* Checkout button — sticky at bottom */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex-shrink-0">
        <CheckoutButton
          total={totals.total}
          canCheckout={canCheckout}
          submitting={submitting}
          cartEmpty={cart.length === 0}
          onClick={onCheckout}
        />
      </div>
    </div>
  );
}
