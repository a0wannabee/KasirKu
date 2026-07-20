import React from 'react';
import type { PaymentMethod as PaymentMethodType } from '@/types/pos';

const METHODS: { value: PaymentMethodType; label: string; icon: string }[] = [
  { value: 'CASH', label: 'Tunai', icon: '💵' },
  { value: 'QRIS', label: 'QRIS', icon: '📱' },
  { value: 'TRANSFER', label: 'Transfer', icon: '🏦' },
  { value: 'CARD', label: 'Kartu', icon: '💳' },
];

interface Props {
  selected: PaymentMethodType;
  onChange: (method: PaymentMethodType) => void;
}

export default function PaymentMethod({ selected, onChange }: Props) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Metode Pembayaran
      </p>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold border transition-all ${
              selected === m.value
                ? 'bg-blue-600/20 text-blue-300 border-blue-500 shadow-md shadow-blue-600/10'
                : 'bg-gray-800/50 text-gray-400 border-gray-700/60 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-base leading-none">{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
