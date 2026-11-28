'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export function useColumnSort(initialKey = '', initialDir = 'asc') {
    const [sortKey, setSortKey] = useState(initialKey);
    const [sortDir, setSortDir] = useState(initialDir === 'desc' ? 'desc' : 'asc');

    function onSort(key) {
        if (!key) return;
        if (sortKey === key) {
            setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDir('asc');
    }

    return { sortKey, sortDir, onSort };
}

function isEmpty(value) {
    return value == null || value === '';
}

export function compareColumnValues(left, right, direction = 'asc') {
    if (isEmpty(left) && isEmpty(right)) return 0;
    if (isEmpty(left)) return 1;
    if (isEmpty(right)) return -1;
    const mul = direction === 'desc' ? -1 : 1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * mul;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * mul;
}

export function sortRowsByColumn(rows, sortKey, sortDir, valueOf) {
    if (!sortKey || !Array.isArray(rows) || rows.length < 2) return rows;
    return rows.slice().sort((left, right) => compareColumnValues(valueOf(left, sortKey), valueOf(right, sortKey), sortDir));
}

export function SortHeading({ label, columnKey, sortKey, sortDir, onSort, className = '', align = 'left' }) {
    if (!columnKey) return <th className={className}>{label}</th>;
    const active = sortKey === columnKey;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
        <th className={className} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button
                type="button"
                onClick={() => onSort(columnKey)}
                className={`inline-flex max-w-full items-center gap-1 hover:text-slate-700 ${align === 'right' ? 'ml-auto' : ''}`}
                title={`Sort by ${label}`}
            >
                <span className="truncate">{label}</span>
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-slate-700' : 'text-slate-300'}`} />
            </button>
        </th>
    );
}
