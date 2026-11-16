'use client';

import { LIST_PAGE_SIZES } from './listPageSize';

const LABELS = { 10: '10', 20: '20', 50: '50', all: 'All' };

export default function PageSizeSelect({ value, onChange, disabled = false }) {
    return (
        <label className="flex items-center gap-2 text-sm text-slate-500">
            <span>Show</span>
            <select
                aria-label="Rows per page"
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"
            >
                {LIST_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{LABELS[size]}</option>
                ))}
            </select>
        </label>
    );
}
