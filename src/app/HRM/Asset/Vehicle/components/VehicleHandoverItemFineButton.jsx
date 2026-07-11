'use client';

import { Banknote, CircleOff, Loader2 } from 'lucide-react';

export default function VehicleHandoverItemFineButton({
    hasFine = false,
    isIncluded = false,
    isWaived = false,
    showRemoveFromFine = false,
    onAddFine,
    onRemoveFromFine,
    disabled = false,
    loading = false,
    className = '',
}) {
    if (!onAddFine && !onRemoveFromFine && !isWaived && !isIncluded) return null;

    const markedInFine = hasFine || isIncluded;

    return (
        <div className={`mt-2 flex flex-col gap-1.5 ${className}`}>
            {markedInFine && !isWaived ? (
                <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-red-700">
                    Added in fine
                </span>
            ) : null}

            {!markedInFine && !isWaived && onAddFine ? (
                <button
                    type="button"
                    onClick={onAddFine}
                    disabled={disabled || loading}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Banknote size={12} />}
                    Add to Fine
                </button>
            ) : null}

            {showRemoveFromFine && onRemoveFromFine && !isWaived ? (
                <button
                    type="button"
                    onClick={onRemoveFromFine}
                    disabled={disabled || loading}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <CircleOff size={12} />}
                    Remove from Fine
                </button>
            ) : null}

            {isWaived ? (
                <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Removed from fine
                </span>
            ) : null}
        </div>
    );
}
