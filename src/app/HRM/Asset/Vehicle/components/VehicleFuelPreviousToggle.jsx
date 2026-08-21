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
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100"
            title={open ? 'Hide previous fuels' : 'Show previous fuels'}
        >
            Previous fuels
            {count > 1 ? <span className="tabular-nums">({count})</span> : null}
            <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
    );
}
