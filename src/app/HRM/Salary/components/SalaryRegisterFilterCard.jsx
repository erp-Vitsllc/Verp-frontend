'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const SELECT_CLASS =
    'w-full h-10 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

function sameCompany(left, right) {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function employeeMatchesCompany(emp, company) {
    if (!company) return true;
    if (emp?.companyId && sameCompany(emp.companyId, company)) return true;
    return sameCompany(emp?.companyName || 'Unassigned', company);
}

function employeeLabel(emp) {
    const name = String(emp?.name || '').trim();
    const id = String(emp?.employeeId || '').trim();
    if (name && id) return `${name} (${id})`;
    return name || id || 'Employee';
}

function FilterSelect({ label, value, onChange, ariaLabel, children }) {
    return (
        <label className="block min-w-0">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {label}
            </span>
            <div className="relative">
                <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} className={SELECT_CLASS}>
                    {children}
                </select>
                <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
            </div>
        </label>
    );
}

function EmployeeNameSelect({ employees, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const selected = employees.find((emp) => emp.employeeId === value);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((emp) => {
            const hay = `${emp.name || ''} ${emp.employeeId || ''} ${emp.companyName || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [employees, query]);

    useEffect(() => {
        const onDoc = (event) => {
            if (ref.current && !ref.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    function pick(nextId) {
        onChange(nextId);
        setOpen(false);
        setQuery('');
    }

    return (
        <label className="block min-w-0">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Employee
            </span>
            <div ref={ref} className="relative">
                <button
                    type="button"
                    onClick={() => {
                        setOpen((v) => !v);
                        setQuery('');
                    }}
                    aria-label="Filter by employee"
                    className={`${SELECT_CLASS} flex items-center justify-between gap-2 pr-9 text-left`}
                >
                    <span className={`truncate ${selected ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                        {selected ? employeeLabel(selected) : 'All employees'}
                    </span>
                </button>
                {value ? (
                    <button
                        type="button"
                        aria-label="Clear employee"
                        onClick={(event) => {
                            event.stopPropagation();
                            pick('');
                        }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronDown
                        size={16}
                        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 ${
                            open ? 'rotate-180' : ''
                        }`}
                    />
                )}
                {open ? (
                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                        <div className="flex items-center gap-2 border-b border-gray-100 bg-slate-50 px-3 py-2">
                            <Search size={14} className="shrink-0 text-slate-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search name or ID"
                                className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </div>
                        <ul className="max-h-56 overflow-y-auto">
                            <li>
                                <button
                                    type="button"
                                    onClick={() => pick('')}
                                    className={`w-full px-3 py-2.5 text-left text-sm ${
                                        !value
                                            ? 'bg-blue-50 font-medium text-blue-700'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    All employees
                                </button>
                            </li>
                            {filtered.length === 0 ? (
                                <li className="px-3 py-3 text-sm text-slate-400">No employees found</li>
                            ) : (
                                filtered.map((emp) => (
                                    <li key={emp.employeeId}>
                                        <button
                                            type="button"
                                            onClick={() => pick(emp.employeeId)}
                                            className={`w-full px-3 py-2.5 text-left ${
                                                emp.employeeId === value
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="block truncate text-sm font-medium">
                                                {emp.name || emp.employeeId}
                                            </span>
                                            <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                                                {[emp.employeeId, emp.companyName].filter(Boolean).join(' · ')}
                                            </span>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                ) : null}
            </div>
        </label>
    );
}

export default function SalaryRegisterFilterCard({
    years = [],
    companies = [],
    employees = [],
    year,
    company,
    employeeId,
    onYearChange,
    onCompanyChange,
    onEmployeeChange,
    onClear,
    filtering = false,
}) {
    const companyOptions = useMemo(
        () =>
            (companies || []).filter(
                (row) => Number(row?.enrolled) > 0 || Number(row?.totalActive) > 0,
            ),
        [companies],
    );

    const enrolledEmployees = useMemo(() => {
        const list = (employees || []).filter((emp) => emp?.enrolled && String(emp?.employeeId || '').trim());
        const scoped = company ? list.filter((emp) => employeeMatchesCompany(emp, company)) : list;
        return [...scoped].sort((a, b) =>
            String(a.name || a.employeeId).localeCompare(String(b.name || b.employeeId), undefined, {
                sensitivity: 'base',
            }),
        );
    }, [employees, company]);

    const selectedEmployee = enrolledEmployees.find((emp) => emp.employeeId === employeeId);
    const hasFilters = Boolean(year || company || employeeId);

    const summary = selectedEmployee
        ? `${selectedEmployee.name || selectedEmployee.employeeId}'s salary for each month`
        : company && year
          ? `${company} · ${year}`
          : company
            ? `${company} employees`
            : year
              ? `Months in ${year}`
              : 'All enrolled employees and months';

    return (
        <div className="mb-4 sm:mb-6">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-400">
                        Filter salary
                    </h3>
                    <p className="mt-0.5 text-xs font-medium leading-snug text-slate-500">{summary}</p>
                </div>
                {hasFilters ? (
                    <button
                        type="button"
                        onClick={onClear}
                        className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                        Clear
                    </button>
                ) : null}
            </div>
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${filtering ? 'opacity-70' : ''}`}>
                <FilterSelect label="Year" value={year} onChange={onYearChange} ariaLabel="Filter by year">
                    <option value="">All years</option>
                    {years.map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </FilterSelect>
                <FilterSelect
                    label="Company"
                    value={company}
                    onChange={onCompanyChange}
                    ariaLabel="Filter by company"
                >
                    <option value="">All companies</option>
                    {companyOptions.map((row) => (
                        <option key={row.companyId || row.name} value={row.name}>
                            {row.name}
                        </option>
                    ))}
                </FilterSelect>
                <EmployeeNameSelect
                    employees={enrolledEmployees}
                    value={employeeId}
                    onChange={onEmployeeChange}
                />
            </div>
        </div>
    );
}
