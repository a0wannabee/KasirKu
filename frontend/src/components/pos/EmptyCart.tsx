import React from 'react';

export default function EmptyCart() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800/80 border border-gray-700">
        <svg
          className="h-8 w-8 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-400">Keranjang kosong</p>
        <p className="text-xs text-gray-600 mt-1">
          Scan barcode atau pilih produk dari daftar
        </p>
      </div>
    </div>
  );
}
