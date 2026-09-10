'use client';

import { ChevronDown } from 'lucide-react';

export default function VehicleFuelPreviousToggle({ open, count = 0, onToggle }) {
    if (!count) return null;
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onToggle?.();
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title={open ? 'Hide previous fuels' : 'Show previous fuels'}
        >
            Prev
            {count > 1 ? <span className="tabular-nums text-slate-400">({count})</span> : null}
            <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
    );
}
