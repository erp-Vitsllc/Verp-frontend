'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { Plus, Trash2, X } from 'lucide-react';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: '0.5rem',
        borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
        backgroundColor: '#fff',
        cursor: 'pointer',
        '&:hover': {
            borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
        },
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '2px 12px',
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        fontSize: '0.875rem',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#94a3b8',
        fontSize: '0.875rem',
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: '0.875rem',
        color: '#334155',
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 100000,
    }),
    menuList: (base) => ({
        ...base,
        maxHeight: 280,
        paddingTop: 4,
        paddingBottom: 4,
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: 'pointer',
    }),
    groupHeading: (base) => ({
        ...base,
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: '#64748b',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
};

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function formatMoney(value) {
    return money(value).toLocaleString('en-AE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function newLineKey() {
    return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function companyPayableValue(id) {
    const clean = String(id || '').trim();
    return clean ? `company:${clean}` : '';
}

function employeePayableValue(id) {
    const clean = String(id || '').trim();
    return clean ? `employee:${clean}` : '';
}

function resolveLinePayBy({
    payBy = '',
    payByEmployeeId = '',
    payByCompanyId = '',
    fallbackPayBy = '',
} = {}) {
    if (payBy === 'company' || payBy === 'employee') return payBy;
    if (fallbackPayBy === 'company' || fallbackPayBy === 'employee') return fallbackPayBy;
    if (String(payByEmployeeId || '').trim()) return 'employee';
    if (String(payByCompanyId || '').trim()) return 'company';
    return '';
}

export function createDefaultLineItems({
    contractAmount = 0,
    actualAmount = 0,
    accountId = '',
    accountName = '',
    itemLabel = '',
    payBy = '',
    payByEmployeeId = '',
    payByEmployeeName = '',
    payByCompanyId = '',
    payByCompanyName = '',
} = {}) {
    const contract = money(contractAmount);
    const actual = money(actualAmount);
    const firstAmount = contract > 0 ? contract : actual;
    const resolvedPayBy = resolveLinePayBy({
        payBy,
        payByEmployeeId,
        payByCompanyId,
    });
    return [
        {
            key: newLineKey(),
            item: itemLabel || 'Utility charge',
            accountId: String(accountId || ''),
            accountName: String(accountName || ''),
            quantity: '1',
            amount: firstAmount > 0 ? String(firstAmount) : '',
            payBy: resolvedPayBy,
            payByEmployeeId: String(payByEmployeeId || ''),
            payByEmployeeName: String(payByEmployeeName || ''),
            payByCompanyId: String(payByCompanyId || ''),
            payByCompanyName: String(payByCompanyName || ''),
        },
    ];
}

export function sumLineAmounts(lines = []) {
    return (lines || []).reduce((sum, line) => sum + money(line?.amount), 0);
}

export function lineItemsMatchActual(lines = [], actualAmount) {
    return Math.abs(sumLineAmounts(lines) - money(actualAmount)) < 0.01;
}

function payableValueFromLine(line = {}) {
    const payBy = String(line.payBy || '').trim();
    // Prefer explicit payBy — employee rows also keep companyMongoId for Zoho,
    // so company id must not win over an employee selection.
    if (payBy === 'employee') {
        return employeePayableValue(line.payByEmployeeId);
    }
    if (payBy === 'company') {
        return companyPayableValue(line.payByCompanyId);
    }
    if (String(line.payByEmployeeId || '').trim()) {
        return employeePayableValue(line.payByEmployeeId);
    }
    if (String(line.payByCompanyId || '').trim()) {
        return companyPayableValue(line.payByCompanyId);
    }
    return '';
}

function partyPatchFromPayableOption(option) {
    if (!option?.value) {
        return {
            payBy: '',
            payByEmployeeId: '',
            payByEmployeeName: '',
            payByCompanyId: '',
            payByCompanyName: '',
        };
    }
    if (option.partyType === 'company' || String(option.value).startsWith('company:')) {
        return {
            payBy: 'company',
            payByCompanyId: String(
                option.partyId || String(option.value).replace(/^company:/, ''),
            ),
            payByCompanyName: String(option.label || ''),
            payByEmployeeId: '',
            payByEmployeeName: '',
        };
    }
    return {
        payBy: 'employee',
        payByEmployeeId: String(
            option.partyId || String(option.value).replace(/^employee:/, ''),
        ),
        payByEmployeeName: String(option.label || ''),
        payByCompanyId: String(option.companyMongoId || ''),
        payByCompanyName: String(option.companyName || ''),
    };
}

function lineHasPayableParty(line = {}) {
    return Boolean(
        String(line.payByCompanyId || '').trim() || String(line.payByEmployeeId || '').trim(),
    );
}

/**
 * Zoho-style item table for one utility bill row.
 * Columns: Items · Account · Qty · Amount · Payable to (Company or Employee)
 */
export default function UtilityBillLineItemsModal({
    isOpen,
    onClose,
    onSave,
    accountNo = '',
    provider = '',
    contractAmount = 0,
    actualAmount = 0,
    initialLines = null,
    accountOptions = [],
    employeeOptions = [],
    companyOptions = [],
    defaultAccountId = '',
    defaultAccountName = '',
    defaultPayBy = '',
    defaultPayByEmployeeId = '',
    defaultPayByEmployeeName = '',
    defaultPayByCompanyId = '',
    defaultPayByCompanyName = '',
    itemLabel = '',
}) {
    const [lines, setLines] = useState([]);
    const [error, setError] = useState('');

    const flatAccountOptions = useMemo(
        () => (accountOptions || []).flatMap((group) => group.options || group),
        [accountOptions],
    );

    const payableOptions = useMemo(() => {
        const companies = (companyOptions || []).map((opt) => ({
            value: companyPayableValue(opt.value),
            label: String(opt.label || ''),
            partyType: 'company',
            partyId: String(opt.value || ''),
        }));
        const employees = (employeeOptions || []).map((opt) => ({
            value: employeePayableValue(opt.value),
            label: String(opt.label || ''),
            partyType: 'employee',
            partyId: String(opt.value || ''),
            companyMongoId: opt.companyMongoId || '',
            companyName: opt.companyName || '',
        }));
        const groups = [];
        if (companies.length) groups.push({ label: 'Companies', options: companies });
        if (employees.length) groups.push({ label: 'Employees', options: employees });
        return groups;
    }, [companyOptions, employeeOptions]);

    const flatPayableOptions = useMemo(
        () => payableOptions.flatMap((group) => group.options || []),
        [payableOptions],
    );

    const actual = money(actualAmount);
    const contract = money(contractAmount);
    const linesTotal = useMemo(() => sumLineAmounts(lines), [lines]);
    const remaining = money(actual - linesTotal);
    const totalsMatch = Math.abs(remaining) < 0.01 && actual > 0;
    const canAddRow = actual > 0 && !totalsMatch && remaining > 0.009;

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        if (Array.isArray(initialLines) && initialLines.length) {
            setLines(
                initialLines.map((line) => {
                    const payByEmployeeId = String(
                        line.payByEmployeeId || defaultPayByEmployeeId || '',
                    );
                    const payByCompanyId = String(
                        line.payByCompanyId || defaultPayByCompanyId || '',
                    );
                    return {
                        key: line.key || newLineKey(),
                        item: String(line.item || line.description || ''),
                        accountId: String(line.accountId || ''),
                        accountName: String(line.accountName || ''),
                        quantity:
                            line.quantity != null && line.quantity !== ''
                                ? String(line.quantity)
                                : '1',
                        amount:
                            line.amount != null && line.amount !== ''
                                ? String(line.amount)
                                : '',
                        payBy: resolveLinePayBy({
                            payBy: line.payBy,
                            payByEmployeeId,
                            payByCompanyId,
                            fallbackPayBy: defaultPayBy,
                        }),
                        payByEmployeeId,
                        payByEmployeeName: String(
                            line.payByEmployeeName || defaultPayByEmployeeName || '',
                        ),
                        payByCompanyId,
                        payByCompanyName: String(
                            line.payByCompanyName || defaultPayByCompanyName || '',
                        ),
                    };
                }),
            );
            return;
        }
        setLines(
            createDefaultLineItems({
                contractAmount: money(contractAmount),
                actualAmount: money(actualAmount),
                accountId: defaultAccountId,
                accountName: defaultAccountName,
                payBy: defaultPayBy,
                payByEmployeeId: defaultPayByEmployeeId,
                payByEmployeeName: defaultPayByEmployeeName,
                payByCompanyId: defaultPayByCompanyId,
                payByCompanyName: defaultPayByCompanyName,
                itemLabel:
                    itemLabel ||
                    [provider, accountNo ? `Acc ${accountNo}` : '']
                        .filter(Boolean)
                        .join(' · ') ||
                    'Utility charge',
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    const updateLine = (key, patch) => {
        setLines((prev) =>
            prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
        );
        setError('');
    };

    const addLine = () => {
        if (!canAddRow) return;
        const fill = remaining > 0 ? remaining : 0;
        setLines((prev) => {
            const first = prev[0] || {};
            return [
                ...prev,
                {
                    key: newLineKey(),
                    item: '',
                    accountId: String(defaultAccountId || first.accountId || ''),
                    accountName: String(defaultAccountName || first.accountName || ''),
                    quantity: '1',
                    amount: fill > 0 ? String(fill) : '',
                    payBy: String(first.payBy || defaultPayBy || ''),
                    payByEmployeeId: String(
                        first.payByEmployeeId || defaultPayByEmployeeId || '',
                    ),
                    payByEmployeeName: String(
                        first.payByEmployeeName || defaultPayByEmployeeName || '',
                    ),
                    payByCompanyId: String(
                        first.payByCompanyId || defaultPayByCompanyId || '',
                    ),
                    payByCompanyName: String(
                        first.payByCompanyName || defaultPayByCompanyName || '',
                    ),
                },
            ];
        });
        setError('');
    };

    const removeLine = (key) => {
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
        setError('');
    };

    const handleSave = () => {
        if (!(actual > 0)) {
            setError('Enter Actual Amount on the bill row first.');
            return;
        }
        if (!lines.length) {
            setError('Add at least one item row.');
            return;
        }
        for (const line of lines) {
            if (!String(line.item || '').trim()) {
                setError('Enter item details for every row.');
                return;
            }
            if (!String(line.accountId || '').trim()) {
                setError('Select an account for every row.');
                return;
            }
            if (!lineHasPayableParty(line)) {
                setError('Select Payable to (Company or Employee) for every row.');
                return;
            }
            const qty = Number(line.quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
                setError('Quantity must be greater than 0.');
                return;
            }
            if (!(money(line.amount) > 0)) {
                setError('Each row amount must be greater than 0.');
                return;
            }
        }
        if (!lineItemsMatchActual(lines, actual)) {
            setError(
                `Line amounts total ${formatMoney(linesTotal)} AED but Actual is ${formatMoney(actual)} AED. They must match.`,
            );
            return;
        }
        onSave?.(
            lines.map((line) => {
                const qty = Number(line.quantity) || 1;
                const amount = money(line.amount);
                const payBy = resolveLinePayBy({
                    payBy: line.payBy,
                    payByEmployeeId: line.payByEmployeeId,
                    payByCompanyId: line.payByCompanyId,
                });
                return {
                    key: line.key,
                    item: String(line.item || '').trim(),
                    description: String(line.item || '').trim(),
                    accountId: String(line.accountId || '').trim(),
                    accountName: String(line.accountName || '').trim(),
                    quantity: qty,
                    amount,
                    rate: qty > 0 ? money(amount / qty) : amount,
                    payBy: payBy || 'employee',
                    payByEmployeeId:
                        payBy === 'employee' ? String(line.payByEmployeeId || '').trim() : '',
                    payByEmployeeName:
                        payBy === 'employee' ? String(line.payByEmployeeName || '').trim() : '',
                    payByCompanyId: String(line.payByCompanyId || '').trim(),
                    payByCompanyName: String(line.payByCompanyName || '').trim(),
                };
            }),
        );
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Item Table</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {accountNo ? `Account ${accountNo}` : 'Bill row'}
                            {provider ? ` · ${provider}` : ''}
                            {' · '}
                            Contract {formatMoney(contract)} · Actual {formatMoney(actual)} AED
                            {' · '}
                            All item rows post inside one Zoho bill
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-white text-gray-500"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-auto flex-1 min-h-0 p-4 sm:p-5">
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-[860px] w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
                                        <th className="px-3 py-2.5">Items</th>
                                        <th className="px-3 py-2.5">Account</th>
                                        <th className="px-3 py-2.5 w-24">Qty</th>
                                        <th className="px-3 py-2.5 w-36">Amount</th>
                                        <th className="px-3 py-2.5 min-w-[13rem]">
                                            Payable to
                                            <span className="block text-[10px] font-normal text-slate-400 normal-case">
                                                Company or Employee
                                            </span>
                                        </th>
                                        <th className="px-3 py-2.5 w-12" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line, index) => {
                                        const selectedAccount =
                                            flatAccountOptions.find(
                                                (option) => option.value === line.accountId,
                                            ) || null;
                                        const selectedPayable =
                                            flatPayableOptions.find(
                                                (option) =>
                                                    option.value === payableValueFromLine(line),
                                            ) || null;
                                        return (
                                            <tr
                                                key={line.key}
                                                className="border-b border-slate-100 last:border-0 align-top"
                                            >
                                                <td className="px-3 py-2 min-w-[180px]">
                                                    <input
                                                        type="text"
                                                        value={line.item}
                                                        onChange={(e) =>
                                                            updateLine(line.key, {
                                                                item: e.target.value,
                                                            })
                                                        }
                                                        placeholder="Type item details"
                                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                    />
                                                    {index === 0 ? (
                                                        <p className="mt-1 text-[10px] text-slate-400">
                                                            1st row amount defaults to contract
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-2 min-w-[200px]">
                                                    <Select
                                                        classNamePrefix="utility-bill-line-account"
                                                        instanceId={`utility-bill-line-account-${line.key}`}
                                                        styles={selectStyles}
                                                        options={accountOptions}
                                                        value={selectedAccount}
                                                        onChange={(option) =>
                                                            updateLine(line.key, {
                                                                accountId: option?.value || '',
                                                                accountName:
                                                                    option?.name ||
                                                                    option?.label ||
                                                                    '',
                                                            })
                                                        }
                                                        placeholder="Select an account"
                                                        menuPortalTarget={
                                                            typeof document !== 'undefined'
                                                                ? document.body
                                                                : null
                                                        }
                                                        menuPosition="fixed"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={line.quantity}
                                                        onChange={(e) =>
                                                            updateLine(line.key, {
                                                                quantity: e.target.value,
                                                            })
                                                        }
                                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.amount}
                                                        onChange={(e) =>
                                                            updateLine(line.key, {
                                                                amount: e.target.value,
                                                            })
                                                        }
                                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 min-w-[13rem]">
                                                    <Select
                                                        classNamePrefix="utility-bill-line-payable"
                                                        instanceId={`utility-bill-line-payable-${line.key}`}
                                                        styles={selectStyles}
                                                        options={payableOptions}
                                                        value={selectedPayable}
                                                        onChange={(option) =>
                                                            updateLine(
                                                                line.key,
                                                                partyPatchFromPayableOption(
                                                                    option,
                                                                ),
                                                            )
                                                        }
                                                        placeholder="Select company or employee"
                                                        isSearchable
                                                        isClearable
                                                        menuPortalTarget={
                                                            typeof document !== 'undefined'
                                                                ? document.body
                                                                : null
                                                        }
                                                        menuPosition="fixed"
                                                        noOptionsMessage={() =>
                                                            'No companies or employees found'
                                                        }
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLine(line.key)}
                                                        disabled={lines.length <= 1}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                                        aria-label="Remove line"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-slate-200 bg-white px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={addLine}
                                disabled={!canAddRow}
                                title={
                                    totalsMatch
                                        ? 'Total already equals Actual — new row cannot be added'
                                        : !actual
                                          ? 'Enter Actual Amount first'
                                          : 'Add another item row'
                                }
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                            >
                                <Plus size={14} />
                                Add New Row
                            </button>
                            <div className="text-right text-sm tabular-nums">
                                <div className="text-slate-500">
                                    Sub Total{' '}
                                    <span className="font-semibold text-slate-800">
                                        {formatMoney(linesTotal)}
                                    </span>
                                </div>
                                <div
                                    className={`text-xs mt-0.5 ${
                                        totalsMatch ? 'text-emerald-600' : 'text-amber-700'
                                    }`}
                                >
                                    {totalsMatch
                                        ? 'Total = Actual'
                                        : `Remaining ${formatMoney(Math.max(0, remaining))} to match Actual`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {error ? (
                        <p className="mt-3 text-sm text-red-600">{error}</p>
                    ) : null}
                </div>

                <div className="px-5 py-3.5 border-t border-gray-100 flex justify-end gap-2 shrink-0 bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold"
                    >
                        Save lines
                    </button>
                </div>
            </div>
        </div>
    );
}
