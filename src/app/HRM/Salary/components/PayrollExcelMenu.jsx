'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { downloadPayrollExcel } from '../utils/payrollExcel';

export default function PayrollExcelMenu({
    monthLabel,
    groups = [],
    companies = [],
    allCount = 0,
    employeesOf,
    onEmpty,
}) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [level, setLevel] = useState('root');

    useEffect(() => {
        if (!open) return undefined;
        function onPointer(event) {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        }
        function onKey(event) {
            if (event.key === 'Escape') setOpen(false);
        }
        document.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    function toggle() {
        setLevel('root');
        setOpen((value) => !value);
    }

    function choose(kind, item) {
        const rows = employeesOf?.(kind, item) || [];
        if (!rows.length) {
            onEmpty?.(item.label);
            return;
        }
        downloadPayrollExcel({ monthLabel, scopeLabel: item.label, employees: rows });
        setOpen(false);
    }

    const list = level === 'group' ? groups : companies;
    const listLabel = level === 'group' ? 'Groups' : 'Companies';

    return (
        <div className="spcc-excel" ref={rootRef}>
            <button
                type="button"
                className={`spcc-excel__btn${open ? ' is-open' : ''}`}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={toggle}
            >
                <Download size={13} aria-hidden="true" />
                Download Excel
                <ChevronDown size={13} aria-hidden="true" />
            </button>
            {open ? (
                <div className="spcc-excel__menu" role="menu" aria-label="Download payroll Excel">
                    {level === 'root' ? (
                        <>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => choose('all', { id: 'all', label: 'All employees' })}
                            >
                                <span>All employees</span>
                                <em>{allCount}</em>
                            </button>
                            <button type="button" role="menuitem" onClick={() => setLevel('group')}>
                                <span>Group</span>
                                <ChevronRight size={14} aria-hidden="true" />
                            </button>
                            <button type="button" role="menuitem" onClick={() => setLevel('company')}>
                                <span>Company</span>
                                <ChevronRight size={14} aria-hidden="true" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="spcc-excel__back" onClick={() => setLevel('root')}>
                                <ChevronLeft size={14} aria-hidden="true" />
                                <span>{listLabel}</span>
                            </button>
                            <div className="spcc-excel__list">
                                {list.length ? (
                                    list.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="menuitem"
                                            onClick={() => choose(level, item)}
                                            title={item.label}
                                        >
                                            <span>{item.label}</span>
                                            <em>{item.count}</em>
                                        </button>
                                    ))
                                ) : (
                                    <p className="spcc-excel__empty">No {listLabel.toLowerCase()} for this month.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
}
