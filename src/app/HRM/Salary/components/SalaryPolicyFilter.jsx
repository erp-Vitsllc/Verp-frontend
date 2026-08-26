'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export const MAIN_POLICY_KEY = 'main';

function employeeLabel(emp) {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return name ? `${emp.employeeId} — ${name}` : emp.employeeId;
}

export default function SalaryPolicyFilter({ users, value, onChange, disabled }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const selectedUser = users.find((emp) => emp.employeeId === value);
    const selectedLabel = value === MAIN_POLICY_KEY || !value ? 'Main' : employeeLabel(selectedUser || { employeeId: value });

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return users;
        return users.filter((emp) => employeeLabel(emp).toLowerCase().includes(q));
    }, [users, query]);

    const showMain = !query.trim() || 'main'.includes(query.trim().toLowerCase());

    useEffect(() => {
        const onDoc = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    function pick(next) {
        onChange?.(next);
        setOpen(false);
        setQuery('');
    }

    return (
        <div ref={ref} className="relative w-full sm:max-w-md">
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setOpen((v) => !v);
                    setQuery('');
                }}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-left flex items-center justify-between gap-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50"
            >
                <span className="text-slate-800 truncate">{selectedLabel}</span>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-slate-50">
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search policy"
                            className="flex-1 bg-transparent text-sm outline-none text-slate-700"
                        />
                    </div>
                    <ul className="max-h-64 overflow-y-auto">
                        {showMain ? (
                            <li>
                                <button
                                    type="button"
                                    onClick={() => pick(MAIN_POLICY_KEY)}
                                    className={`w-full px-3 py-2.5 text-left text-sm ${
                                        value === MAIN_POLICY_KEY
                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    Main
                                </button>
                            </li>
                        ) : null}
                        {filteredUsers.length === 0 && !showMain ? (
                            <li className="px-3 py-3 text-sm text-slate-400">No matching policies</li>
                        ) : (
                            filteredUsers.map((emp) => (
                                <li key={emp.employeeId}>
                                    <button
                                        type="button"
                                        onClick={() => pick(emp.employeeId)}
                                        className={`w-full px-3 py-2.5 text-left text-sm truncate ${
                                            value === emp.employeeId
                                                ? 'bg-blue-50 text-blue-700 font-medium'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {employeeLabel(emp)}
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
