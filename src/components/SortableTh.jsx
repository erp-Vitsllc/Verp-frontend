'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

/**
 * Sortable table header cell with up / down / idle arrows (Vehicle / Utility list pattern).
 */
export default function SortableTh({
    label,
    sortKey,
    activeKey,
    direction = 'asc',
    onSort,
    className = '',
    align = 'left',
    compact = false,
}) {
    const isActive = activeKey === sortKey;
    const alignClass = align === 'right' ? 'text-right' : 'text-left';
    const sizeClass = compact
        ? 'px-1 py-2 text-[9px] font-semibold text-gray-600 tracking-normal whitespace-nowrap'
        : 'px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap';

    const iconSize = compact ? 10 : 12;

    return (
        <th
            className={`${sizeClass} ${alignClass} ${className}`}
        >
            <button
                type="button"
                onClick={() => onSort?.(sortKey)}
                className={`inline-flex items-center ${compact ? 'gap-0.5' : 'gap-1'} hover:text-gray-900 ${
                    align === 'right' ? 'ml-auto' : ''
                } ${isActive ? 'text-teal-700' : ''}`}
                title={`Sort by ${label}`}
                aria-label={`Sort by ${label}${
                    isActive
                        ? direction === 'asc'
                            ? ', ascending'
                            : ', descending'
                        : ''
                }`}
            >
                {label}
                {isActive ? (
                    direction === 'asc' ? (
                        <ArrowUp size={iconSize} className="opacity-100 shrink-0" />
                    ) : (
                        <ArrowDown size={iconSize} className="opacity-100 shrink-0" />
                    )
                ) : (
                    <ArrowUpDown size={iconSize} className="opacity-40 shrink-0" />
                )}
            </button>
        </th>
    );
}

/** Locale-aware compare for list column sorting. */
export function compareSortValues(a, b, direction = 'asc') {
    const mul = direction === 'desc' ? -1 : 1;
    if (a == null && b == null) return 0;
    if (a == null || a === '') return 1;
    if (b == null || b === '') return -1;
    if (typeof a === 'number' && typeof b === 'number') {
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return 1;
        if (Number.isNaN(b)) return -1;
        return (a - b) * mul;
    }
    const aTime = a instanceof Date ? a.getTime() : NaN;
    const bTime = b instanceof Date ? b.getTime() : NaN;
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return (aTime - bTime) * mul;
    return (
        String(a).localeCompare(String(b), undefined, {
            numeric: true,
            sensitivity: 'base',
        }) * mul
    );
}

export function toggleSortState(prevKey, prevDir, nextKey, defaultDir = 'asc') {
    if (prevKey === nextKey) {
        return { sortKey: prevKey, sortDirection: prevDir === 'asc' ? 'desc' : 'asc' };
    }
    return { sortKey: nextKey, sortDirection: defaultDir };
}
