import React from 'react';
import { formatIDR, formatDate } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import type { Sale } from '@/types/pos';

interface Props {
  sale: Sale;
  onClose: () => void;
}

export default function ReceiptModal({ sale, onClose }: Props) {
  const session = getSession();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-6 border border-gray-700 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <span className="flex items-center gap-2 font-bold text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Transaksi Berhasil!
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-lg">✕</button>
        </div>

        {/* Printable receipt */}
        <div id="printable-receipt" className="rounded-xl bg-white p-4 text-black font-mono text-xs space-y-2 shadow-inner">
          <div className="text-center pb-2 border-b border-dashed border-gray-400">
            <div className="font-bold text-sm uppercase">KasirKita Minimarket</div>
            <div className="text-[10px] text-gray-600">No. Inv: {sale.invoiceNumber}</div>
            <div className="text-[10px] text-gray-500">{formatDate(sale.createdAt)}</div>
          </div>
          <div className="py-1 space-y-1.5 border-b border-dashed border-gray-400">
            {sale.items.map((item) => (
              <div key={item.id}>
                <div className="font-semibold truncate">{item.product?.name ?? '—'}</div>
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>{item.quantity} × {formatIDR(item.unitPrice)}</span>
                  <span className="font-semibold">{formatIDR(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="py-1 space-y-0.5 text-[11px]">
            <div className="flex justify-between"><span>Subtotal:</span><span>{formatIDR(sale.subtotal)}</span></div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Diskon:</span><span>-{formatIDR(sale.discountAmount)}</span>
              </div>
            )}
            {sale.taxAmount > 0 && (
              <div className="flex justify-between"><span>PPN:</span><span>{formatIDR(sale.taxAmount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-xs border-t border-gray-200 pt-1">
              <span>TOTAL:</span><span>{formatIDR(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Bayar ({sale.paymentMethod}):</span><span>{formatIDR(sale.amountPaid)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Kembalian:</span><span>{formatIDR(sale.changeAmount)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Kasir:</span><span>{session?.fullName || session?.username}</span>
            </div>
          </div>
          <div className="text-center pt-2 text-[10px] text-gray-500 border-t border-dashed border-gray-400">
            Terima kasih atas kunjungan Anda!
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-800 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition-all"
          >
            Transaksi Baru
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition-all"
          >
            Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
}
