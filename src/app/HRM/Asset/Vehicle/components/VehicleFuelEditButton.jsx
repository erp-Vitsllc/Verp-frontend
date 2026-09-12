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
            className={`inline-flex h-7 min-w-[3.85rem] items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide ${
                disabled
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
        >
            <PencilLine size={11} strokeWidth={2.25} />
            Edit
        </button>
    );
}
