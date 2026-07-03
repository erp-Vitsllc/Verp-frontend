'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

export default function VehicleShopServiceHistoryViewLink({ href, className = '' }) {
    const router = useRouter();

    if (!href) {
        return <span className="text-slate-400">—</span>;
    }

    return (
        <button
            type="button"
            onClick={() => router.push(href)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900 ${className}`.trim()}
        >
            <span>View</span>
            <ExternalLink size={14} strokeWidth={2.25} className="shrink-0" aria-hidden />
        </button>
    );
}
