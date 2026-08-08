'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import axiosInstance from '@/utils/axios';
import { mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 44,
        borderRadius: '0.75rem',
        borderColor: state.isFocused ? '#00B5AD' : '#e2e8f0',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 181, 173, 0.15)' : 'none',
        backgroundColor: state.isDisabled ? '#f8fafc' : '#fff',
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        '&:hover': {
            borderColor: state.isDisabled ? '#e2e8f0' : '#00B5AD',
        },
    }),
    menu: (base) => ({ ...base, zIndex: 9999, borderRadius: '0.75rem' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#00B5AD' : state.isFocused ? '#f0fdfa' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
    }),
    singleValue: (base) => ({ ...base, fontSize: '0.875rem', fontWeight: 600 }),
    placeholder: (base) => ({ ...base, fontSize: '0.875rem', color: '#94a3b8' }),
    indicatorSeparator: () => ({ display: 'none' }),
};

function groupAccountOptions(accounts) {
    const groups = new Map();
    for (const row of accounts || []) {
        const type = String(row.type || 'Other').trim() || 'Other';
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push({
            value: row.id,
            label: row.code ? `${row.name} (${row.code})` : row.name || row.id,
        });
    }
    return [...groups.entries()].map(([label, options]) => ({ label, options }));
}

/**
 * Loads `/zoho/expenses/support` once and renders Expense Account + Paid Through
 * (same lists as Accounts → Expenses → Add Expense).
 */
export default function ZohoExpenseSupportSelects({
    expenseAccountId = '',
    paidThroughAccountId = '',
    onExpenseAccountChange,
    onPaidThroughChange,
    disabled = false,
    organizationId = '',
    expenseError = '',
    paidThroughError = '',
    /** When set and Paid Through is empty, auto-select the first account whose label matches (e.g. "1st Card"). */
    preferPaidThroughName = '',
}) {
    const [expenseAccounts, setExpenseAccounts] = useState([]);
    const [paidThroughAccounts, setPaidThroughAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const preferredPaidThroughAppliedRef = useRef(false);
    const onPaidThroughChangeRef = useRef(onPaidThroughChange);
    onPaidThroughChangeRef.current = onPaidThroughChange;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const params = {};
                if (organizationId) params.organizationId = organizationId;
                const res = await axiosInstance.get('/zoho/expenses/support', {
                    params,
                    skipToast: true,
                    timeout: 120000,
                });
                if (cancelled) return;
                const support = res.data?.data || res.data || {};
                const expenseRows = mapZohoPaymentAccounts(support.accounts || []);
                const paidThroughRows = mapZohoPaymentAccounts(
                    support.paidThroughAccounts || support.accounts || [],
                );
                setExpenseAccounts(expenseRows);
                setPaidThroughAccounts(paidThroughRows);
                if (!expenseRows.length && !paidThroughRows.length) {
                    setError(
                        res.data?.message ||
                            'No expense accounts returned from Zoho. Check Zoho connection.',
                    );
                }
            } catch (err) {
                if (cancelled) return;
                setExpenseAccounts([]);
                setPaidThroughAccounts([]);
                setError(err?.response?.data?.message || err?.message || 'Could not load accounts');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [organizationId]);

    const expenseOptions = useMemo(() => groupAccountOptions(expenseAccounts), [expenseAccounts]);
    const paidThroughOptions = useMemo(
        () => groupAccountOptions(paidThroughAccounts),
        [paidThroughAccounts],
    );
    const flatExpense = useMemo(
        () => expenseOptions.flatMap((g) => g.options || []),
        [expenseOptions],
    );
    const flatPaidThrough = useMemo(
        () => paidThroughOptions.flatMap((g) => g.options || []),
        [paidThroughOptions],
    );

    // Prefer a Paid Through account such as "1st Card" when nothing is selected yet.
    useEffect(() => {
        preferredPaidThroughAppliedRef.current = false;
    }, [organizationId, preferPaidThroughName]);

    useEffect(() => {
        if (loading || preferredPaidThroughAppliedRef.current) return;
        if (paidThroughAccountId || !preferPaidThroughName) return;
        if (!flatPaidThrough.length) return;
        const needle = String(preferPaidThroughName).trim().toLowerCase();
        if (!needle) return;
        const match =
            flatPaidThrough.find((o) => String(o.label || '').toLowerCase() === needle) ||
            flatPaidThrough.find((o) => String(o.label || '').toLowerCase().includes(needle));
        if (!match?.value) return;
        preferredPaidThroughAppliedRef.current = true;
        onPaidThroughChangeRef.current?.({
            id: match.value,
            name: String(match.label || '').trim(),
        });
    }, [loading, paidThroughAccountId, preferPaidThroughName, flatPaidThrough]);

    const portalTarget = typeof document !== 'undefined' ? document.body : null;
    const labelClass = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500';

    return (
        <>
            <div>
                <label className={labelClass}>
                    Expense Account <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5">
                    <Select
                        instanceId="car-wash-expense-account"
                        styles={selectStyles}
                        options={expenseOptions}
                        value={flatExpense.find((o) => o.value === expenseAccountId) || null}
                        onChange={(o) => {
                            onExpenseAccountChange?.({
                                id: o?.value || '',
                                name: String(o?.label || '').trim(),
                            });
                        }}
                        isDisabled={disabled || loading}
                        placeholder={loading ? 'Loading accounts…' : 'Select expense account'}
                        menuPortalTarget={portalTarget}
                    />
                </div>
                {expenseError ? <p className="mt-1 text-xs text-red-600">{expenseError}</p> : null}
            </div>
            <div>
                <label className={labelClass}>
                    Paid Through <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5">
                    <Select
                        instanceId="car-wash-paid-through"
                        styles={selectStyles}
                        options={paidThroughOptions}
                        value={flatPaidThrough.find((o) => o.value === paidThroughAccountId) || null}
                        onChange={(o) => {
                            onPaidThroughChange?.({
                                id: o?.value || '',
                                name: String(o?.label || '').trim(),
                            });
                        }}
                        isDisabled={disabled || loading}
                        placeholder={
                            loading
                                ? 'Loading banks…'
                                : preferPaidThroughName
                                  ? `Select paid through (e.g. ${preferPaidThroughName})`
                                  : 'Select paid through'
                        }
                        menuPortalTarget={portalTarget}
                    />
                </div>
                {paidThroughError ? (
                    <p className="mt-1 text-xs text-red-600">{paidThroughError}</p>
                ) : null}
            </div>
            {error ? <p className="md:col-span-2 text-xs text-red-600">{error}</p> : null}
        </>
    );
}
