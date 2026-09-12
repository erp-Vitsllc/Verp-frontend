'use client';

import { ChevronDown } from 'lucide-react';

export default function VehicleFuelPreviousToggle({ open, count = 0, onToggle }) {
    const hasPrevious = Number(count) > 0;
    return (
        <button
            type="button"
            disabled={!hasPrevious}
            onClick={(event) => {
                event.stopPropagation();
                if (!hasPrevious) return;
                onToggle?.();
            }}
            className={`inline-flex h-7 min-w-[3.85rem] items-center justify-center gap-0.5 rounded-md px-2 text-[10px] font-semibold uppercase tracking-wide ${
                hasPrevious
                    ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    : 'cursor-not-allowed text-slate-300'
            }`}
            title={hasPrevious ? (open ? 'Hide previous fuels' : 'Show previous fuels') : 'No previous fuel'}
        >
            Prev
            {hasPrevious && count > 1 ? (
                <span className="tabular-nums text-slate-400">({count})</span>
            ) : null}
            <ChevronDown
                size={11}
                className={`shrink-0 transition-transform ${open && hasPrevious ? 'rotate-180' : ''} ${
                    hasPrevious ? '' : 'opacity-40'
                }`}
            />
        </button>
    );
}
