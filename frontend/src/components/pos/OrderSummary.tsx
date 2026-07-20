import React from 'react';
import { formatIDR } from '@/lib/utils';
import type { CartTotals } from '@/types/pos';

interface Props {
  totals: CartTotals;
  discount: number;
  taxRate: number;
  onDiscountChange: (v: number) => void;
  onTaxRateChange: (v: number) => void;
}

export default function OrderSummary({
  totals,
  discount,
  taxRate,
  onDiscountChange,
  onTaxRateChange,
}: Props) {
  return (
    <div className="space-y-2">
      {/* Subtotal */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Subtotal</span>
        <span className="font-mono text-gray-200">{formatIDR(totals.subtotal)}</span>
      </div>

      {/* Discount */}
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="text-gray-400 flex-shrink-0">Diskon (Rp)</span>
        <input
          id="pos-discount"
          type="number"
          min={0}
          value={discount || ''}
          onChange={(e) => onDiscountChange(Number(e.target.value))}
          placeholder="0"
          className="glass-input w-28 rounded-lg px-2.5 py-1 text-right font-mono text-xs text-amber-300"
        />
      </div>

      {/* Tax */}
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="text-gray-400 flex-shrink-0">Pajak</span>
        <div className="flex items-center gap-2">
          <select
            id="pos-tax-rate"
            value={taxRate}
            onChange={(e) => onTaxRateChange(Number(e.target.value))}
            className="glass-input rounded-lg px-2 py-1 text-[11px]"
          >
            <option value={0} className="bg-dark-800">0%</option>
            <option value={11} className="bg-dark-800">11% (PPN)</option>
          </select>
          {totals.taxAmount > 0 && (
            <span className="font-mono text-gray-300 text-[11px]">
              {formatIDR(totals.taxAmount)}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700/60 pt-2 mt-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-300">TOTAL</span>
          <span className="text-xl font-extrabold font-mono text-emerald-400">
            {formatIDR(totals.total)}
          </span>
        </div>
      </div>
    </div>
  );
}
