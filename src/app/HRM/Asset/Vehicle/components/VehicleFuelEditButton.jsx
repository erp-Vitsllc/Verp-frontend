'use client';

import { PencilLine } from 'lucide-react';

export default function VehicleFuelEditButton({
    onClick,
    title = 'Edit this fuel entry',
    disabled = false,
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
                event.stopPropagation();
                if (disabled) return;
                onClick?.(event);
            }}
            title={disabled ? 'Only flowchart HR can edit fuel' : title}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                disabled
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
        >
            <PencilLine size={12} />
            Edit
        </button>
    );
}
