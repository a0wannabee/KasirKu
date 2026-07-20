import React from 'react';
import { formatIDR } from '@/lib/utils';
import { suggestCashAmounts } from '@/lib/calculations';

interface Props {
  total: number;
  amountPaid: number;
  change: number;
  onAmountChange: (v: number) => void;
}

export default function CashShortcut({ total, amountPaid, change, onAmountChange }: Props) {
  const shortcuts = suggestCashAmounts(total);

  return (
    <div className="space-y-2">
      {/* Amount paid input */}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="pos-amount-paid" className="text-xs font-semibold text-gray-400 flex-shrink-0">
          Uang diterima
        </label>
        <input
          id="pos-amount-paid"
          type="number"
          min={0}
          value={amountPaid || ''}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          placeholder="0"
          className="glass-input w-36 rounded-lg px-3 py-1.5 text-right font-mono font-bold text-sm text-white"
        />
      </div>

      {/* Quick-cash buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onAmountChange(total)}
          className="rounded-lg py-1.5 text-[10px] font-bold bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-all"
        >
          Uang Pas
        </button>
        {(Array.isArray(shortcuts) ? shortcuts : [])
          .filter((a) => a >= total)
          .slice(0, 5)
          .map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onAmountChange(amount)}
              className={`rounded-lg py-1.5 text-[10px] font-bold border transition-all ${
                amountPaid === amount
                  ? 'bg-blue-600/30 text-blue-200 border-blue-500'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
              }`}
            >
              {formatIDR(amount)}
            </button>
          ))}
      </div>

      {/* Change display */}
      <div
        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold border ${
          amountPaid >= total && total > 0
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-gray-800/60 border-gray-700/60 text-gray-500'
        }`}
      >
        <span>Kembalian</span>
        <span className="font-mono text-sm">
          {amountPaid >= total && total > 0 ? formatIDR(change) : '—'}
        </span>
      </div>
    </div>
  );
}
