'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export default function SearchableAssignedToFilter({
    value,
    onChange,
    employeeOptions = [],
    companyOptions = [],
    employeePrefix,
    companyPrefix,
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);

    const options = useMemo(() => {
        const rows = [{ value: '', label: 'All assignees', group: null, searchText: 'all assignees' }];
        employeeOptions.forEach((emp) => {
            rows.push({
                value: `${employeePrefix}${emp.id}`,
                label: `${emp.name}${emp.employeeId ? ` (${emp.employeeId})` : ''}`,
                group: 'Employees',
                searchText: `${emp.name} ${emp.employeeId || ''}`.toLowerCase(),
            });
        });
        companyOptions.forEach((company) => {
            rows.push({
                value: `${companyPrefix}${company.id}`,
                label: company.name,
                group: 'Companies',
                searchText: String(company.name || '').toLowerCase(),
            });
        });
        return rows;
    }, [employeeOptions, companyOptions, employeePrefix, companyPrefix]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((opt) => (opt.searchText || opt.label.toLowerCase()).includes(q));
    }, [options, query]);

    const selected = options.find((opt) => opt.value === value) || options[0];

    useEffect(() => {
        const handler = (event) => {
            if (ref.current && !ref.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative min-w-[14rem]">
            <button
                type="button"
                onClick={() => {
                    setOpen((prev) => !prev);
                    setQuery('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white pr-8 cursor-pointer text-left flex items-center justify-between gap-2"
                aria-label="Filter assigned assets by employee or company"
            >
                <span className="truncate">{selected?.label || 'All assignees'}</span>
                <ChevronDown
                    size={16}
                    className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full min-w-[16rem] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <Search size={14} className="text-gray-400 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search by name or ID..."
                            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                        />
                    </div>
                    <ul className="max-h-56 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-4 py-2.5 text-sm text-gray-400 italic">No assignees found</li>
                        ) : (
                            filtered.map((opt, index) => {
                                const showGroup =
                                    opt.group &&
                                    (index === 0 || filtered[index - 1]?.group !== opt.group);
                                return (
                                    <li key={opt.value || 'all-assignees'}>
                                        {showGroup && (
                                            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                                {opt.group}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange(opt.value);
                                                setOpen(false);
                                                setQuery('');
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${
                                                opt.value === value
                                                    ? 'bg-blue-50 font-medium text-blue-700'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
