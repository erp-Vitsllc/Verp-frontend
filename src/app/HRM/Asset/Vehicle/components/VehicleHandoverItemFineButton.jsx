'use client';

import { Banknote } from 'lucide-react';

export default function VehicleHandoverItemFineButton({
    hasFine = false,
    onClick,
    disabled = false,
    className = '',
}) {
    if (!onClick) return null;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                hasFine
                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-red-300 bg-white text-red-700 hover:bg-red-50'
            } ${className}`}
        >
            <Banknote size={12} />
            {hasFine ? 'Edit Fine' : 'Add Fine'}
        </button>
    );
}
