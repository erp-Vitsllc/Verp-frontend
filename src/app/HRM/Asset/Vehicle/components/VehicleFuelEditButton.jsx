'use client';

import { PencilLine } from 'lucide-react';

export default function VehicleFuelEditButton({ onClick, title = 'Edit this fuel entry' }) {
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onClick?.(event);
            }}
            title={title}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100"
        >
            <PencilLine size={12} />
            Edit
        </button>
    );
}
