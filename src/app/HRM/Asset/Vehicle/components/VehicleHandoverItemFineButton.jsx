'use client';

import { Banknote, CircleOff } from 'lucide-react';

export default function VehicleHandoverItemFineButton({
    hasFine = false,
    isWaived = false,
    showRemoveFromFine = false,
    onAddFine,
    onRemoveFromFine,
    disabled = false,
    className = '',
}) {
    if (!onAddFine && !onRemoveFromFine) return null;

    return (
        <div className={`mt-2 flex flex-col gap-1.5 ${className}`}>
            {onAddFine ? (
                <button
                    type="button"
                    onClick={onAddFine}
                    disabled={disabled}
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        hasFine
                            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-red-300 bg-white text-red-700 hover:bg-red-50'
                    }`}
                >
                    <Banknote size={12} />
                    {hasFine ? 'Edit Damage' : 'Add Damage'}
                </button>
            ) : null}

            {showRemoveFromFine && onRemoveFromFine ? (
                <button
                    type="button"
                    onClick={onRemoveFromFine}
                    disabled={disabled}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <CircleOff size={12} />
                    Remove from Fine
                </button>
            ) : isWaived ? (
                <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Removed from fine
                </span>
            ) : null}
        </div>
    );
}
