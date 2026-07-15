'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/** Clamp value to [0, maxAllowed]. */
function clampToDiff(value, maxAllowed) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const max = Math.max(0, round2(maxAllowed));
    if (n < 0) return 0;
    if (n > max) return max;
    return round2(n);
}

/**
 * Split row difference: Difference = Company + Employee.
 * Each field must be between 0 and Difference (no negatives, no more than difference).
 */
export default function PayBySplitModal({
    isOpen,
    onClose,
    onSave,
    differenceAmount = 0,
    accountNo = '',
    initialCompany = '',
    initialEmployee = '',
}) {
    const [company, setCompany] = useState('');
    const [employee, setEmployee] = useState('');
    const [error, setError] = useState('');

    const diff = round2(differenceAmount);
    const maxAllowed = Math.max(0, diff);
    const canSplit = maxAllowed > 0;

    useEffect(() => {
        if (!isOpen) return;
        if (!canSplit) {
            setCompany('0');
            setEmployee('0');
            setError('Difference must be greater than 0 to split.');
            return;
        }
        let c =
            initialCompany !== '' && initialCompany != null
                ? clampToDiff(initialCompany, maxAllowed)
                : maxAllowed;
        if (c == null) c = maxAllowed;
        const e = clampToDiff(maxAllowed - c, maxAllowed) ?? 0;
        setCompany(String(c));
        setEmployee(String(e));
        setError('');
    }, [isOpen, differenceAmount, initialCompany, initialEmployee, maxAllowed, canSplit]);

    if (!isOpen) return null;

    const onCompanyChange = (val) => {
        if (val === '') {
            setCompany('');
            setError('');
            return;
        }
        const n = Number(val);
        if (!Number.isFinite(n)) return;
        if (n < 0) {
            setError('Negative values are not allowed. Use 0 to Difference.');
            setCompany('0');
            setEmployee(String(maxAllowed));
            return;
        }
        if (n > maxAllowed) {
            setError(`Cannot exceed Difference (${formatMoney(maxAllowed)} AED).`);
            setCompany(String(maxAllowed));
            setEmployee('0');
            return;
        }
        const c = round2(n);
        setCompany(String(c));
        setEmployee(String(round2(maxAllowed - c)));
        setError('');
    };

    const onEmployeeChange = (val) => {
        if (val === '') {
            setEmployee('');
            setError('');
            return;
        }
        const n = Number(val);
        if (!Number.isFinite(n)) return;
        if (n < 0) {
            setError('Negative values are not allowed. Use 0 to Difference.');
            setEmployee('0');
            setCompany(String(maxAllowed));
            return;
        }
        if (n > maxAllowed) {
            setError(`Cannot exceed Difference (${formatMoney(maxAllowed)} AED).`);
            setEmployee(String(maxAllowed));
            setCompany('0');
            return;
        }
        const emp = round2(n);
        setEmployee(String(emp));
        setCompany(String(round2(maxAllowed - emp)));
        setError('');
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (!canSplit) {
            setError('Difference must be greater than 0 to split.');
            return;
        }
        const c = clampToDiff(company, maxAllowed);
        const emp = clampToDiff(employee, maxAllowed);
        if (c == null || emp == null || company === '' || employee === '') {
            setError('Enter company and employee amounts (0 to Difference).');
            return;
        }
        if (c < 0 || emp < 0) {
            setError('Negative values are not allowed.');
            return;
        }
        if (c > maxAllowed || emp > maxAllowed) {
            setError(`Each amount must be between 0 and ${formatMoney(maxAllowed)} AED.`);
            return;
        }
        if (Math.abs(round2(c + emp) - maxAllowed) > 0.009) {
            setError(
                `Company + Employee must equal Difference (${formatMoney(maxAllowed)}).`,
            );
            return;
        }
        onSave?.({
            companyAmount: c,
            employeeAmount: emp,
        });
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Pay by — split</h2>
                        {accountNo ? (
                            <p className="text-xs text-gray-500 mt-0.5">Account {accountNo}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSave}>
                    <div className="px-5 py-4 space-y-3">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                Difference amount
                            </p>
                            <p className="text-base font-bold tabular-nums text-gray-800 mt-0.5">
                                {formatMoney(maxAllowed)} AED
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">
                                Difference = Company + Employee · each field 0 to{' '}
                                {formatMoney(maxAllowed)}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Company
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={maxAllowed}
                                step="0.01"
                                value={company}
                                disabled={!canSplit}
                                onChange={(e) => onCompanyChange(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:bg-gray-100"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Employee
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={maxAllowed}
                                step="0.01"
                                value={employee}
                                disabled={!canSplit}
                                onChange={(e) => onEmployeeChange(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:bg-gray-100"
                            />
                        </div>

                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    </div>

                    <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSplit}
                            className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50"
                        >
                            Apply
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/** @deprecated Prefer PAY_BY_OPTIONS from PayByChoiceModal (Company / Employee only). */
export { PAY_BY_OPTIONS } from './PayByChoiceModal';
