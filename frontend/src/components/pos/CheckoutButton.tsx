import React from 'react';
import { formatIDR } from '@/lib/utils';

interface Props {
  total: number;
  canCheckout: boolean;
  submitting: boolean;
  cartEmpty: boolean;
  onClick: () => void;
}

export default function CheckoutButton({
  total,
  canCheckout,
  submitting,
  cartEmpty,
  onClick,
}: Props) {
  const getLabel = () => {
    if (submitting) return 'Memproses...';
    if (cartEmpty) return 'Keranjang kosong';
    return `Bayar ${formatIDR(total)}`;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canCheckout}
      className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
    >
      {submitting ? (
        <>
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Memproses Transaksi...</span>
        </>
      ) : (
        <>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span>{getLabel()}</span>
        </>
      )}
    </button>
  );
}
