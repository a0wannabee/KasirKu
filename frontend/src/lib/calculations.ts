import type { CartItem, CartTotals } from '@/types/pos';

/**
 * Compute all POS totals from cart state.
 * Pure function — no side effects.
 */
export function computeCartTotals(
  cart: CartItem[],
  discountAmount: number,
  taxRate: number,
  amountPaid: number
): CartTotals {
  const subtotal = cart.reduce(
    (acc, item) => acc + Number(item.product.sellPrice) * item.quantity,
    0
  );
  const afterDiscount = Math.max(subtotal - discountAmount, 0);
  const taxAmount = Math.round((afterDiscount * taxRate) / 100);
  const total = afterDiscount + taxAmount;
  const change = Math.max(amountPaid - total, 0);

  return { subtotal, discountAmount, taxAmount, total, change };
}

/**
 * Round up to the nearest denomination (10k, 50k, 100k, etc.)
 */
export function roundUpTo(amount: number, denomination: number): number {
  return Math.ceil(amount / denomination) * denomination;
}

/**
 * Suggested quick-cash amounts for the given total.
 * Returns fixed amounts plus a "rounded" amount.
 */
export function suggestCashAmounts(total: number): number[] {
  const fixed = [10_000, 20_000, 50_000, 100_000];
  const rounded = roundUpTo(total, 10_000);
  const unique = Array.from(new Set([...fixed, rounded])).sort((a, b) => a - b);
  return unique;
}

/**
 * Returns true when payment is sufficient (or method is non-cash).
 */
export function isPaymentSufficient(
  total: number,
  amountPaid: number,
  paymentMethod: string
): boolean {
  if (paymentMethod !== 'CASH') return true;
  return amountPaid >= total;
}
