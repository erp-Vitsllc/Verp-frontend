'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VehicleServiceRequestSortHeader({
    label,
    columnKey,
    sortKey,
    sortDirection,
    onSort,
    className = '',
    detail = '',
}) {
    const isActive = sortKey === columnKey;

    return (
        <th className={cn('px-4 py-3 whitespace-nowrap align-bottom', className)}>
            <div className={cn('flex w-full flex-col gap-0.5', detail ? 'items-end' : 'items-start')}>
                {detail ? (
                    <span className="text-[11px] font-bold tabular-nums normal-case tracking-normal text-slate-900">
                        {detail}
                    </span>
                ) : null}
                <button
                    type="button"
                    onClick={() => onSort(columnKey)}
                    className={`inline-flex items-center gap-1 hover:text-slate-700 ${isActive ? 'text-teal-700' : ''}`}
                    title={`Sort by ${label}`}
                    aria-label={`Sort by ${label}${
                        isActive ? (sortDirection === 'asc' ? ', ascending' : ', descending') : ''
                    }`}
                >
                    {label}
                    {isActive ? (
                        sortDirection === 'asc' ? (
                            <ArrowUp size={12} className="opacity-100" />
                        ) : (
                            <ArrowDown size={12} className="opacity-100" />
                        )
                    ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                    )}
                </button>
            </div>
        </th>
    );
}
