// ─────────────────────────────────────────────
// POS shared types
// ─────────────────────────────────────────────

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS' | 'CARD';

export interface POSProduct {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  sellPrice: number;
  currentStock: number;
  saleUnit: string;
  category?: { name: string };
}

export interface CartItem {
  product: POSProduct;
  quantity: number;
}

export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  unitHpp: number;
  discount: number;
  subtotal: number;
  product?: { name: string; sku: string };
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalHpp: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
  status: 'COMPLETED' | 'VOID' | 'RETURNED' | 'PARTIALLY_RETURNED';
  voidReason?: string;
  createdAt: string;
  cashier?: { fullName: string };
  items: SaleItem[];
}

export interface CheckoutPayload {
  items: { productId: string; quantity: number; discount?: number }[];
  discountAmount: number;
  taxRate: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
}

export interface CartTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  change: number;
}
