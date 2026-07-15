'use client';

import { X } from 'lucide-react';

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Confirm payment of checked utility bill totals (Accounts).
 * Total = company pay + employee pay (not contract).
 */
export default function UtilityBillPayModal({
    isOpen,
    onClose,
    onConfirm,
    totalAmount = 0,
    companyAmount = 0,
    employeeAmount = 0,
    billCount = 0,
    utilityType = '',
    billMonth = '',
    saving = false,
}) {
    if (!isOpen) return null;

    const payTotal =
        Number.isFinite(Number(totalAmount)) && Number(totalAmount) > 0
            ? Number(totalAmount)
            : Math.max(0, Number(companyAmount) || 0) + Math.max(0, Number(employeeAmount) || 0);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Payment</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="px-5 py-5 space-y-3">
                    <p className="text-sm text-gray-600">
                        Confirm payment for the selected utility bills.
                    </p>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
                        {utilityType ? (
                            <p>
                                <span className="text-gray-500">Type:</span>{' '}
                                <span className="font-semibold text-gray-800">{utilityType}</span>
                            </p>
                        ) : null}
                        {billMonth ? (
                            <p>
                                <span className="text-gray-500">Month:</span>{' '}
                                <span className="font-semibold text-gray-800">{billMonth}</span>
                            </p>
                        ) : null}
                        <p>
                            <span className="text-gray-500">Bills:</span>{' '}
                            <span className="font-semibold text-gray-800">{billCount}</span>
                        </p>
                        <div className="pt-2 border-t border-gray-200 mt-2 space-y-1">
                            <p>
                                <span className="text-gray-500">Company:</span>{' '}
                                <span className="font-bold tabular-nums text-emerald-600">
                                    {formatMoney(companyAmount)} AED
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500">Employee:</span>{' '}
                                <span className="font-bold tabular-nums text-emerald-600">
                                    {formatMoney(employeeAmount)} AED
                                </span>
                            </p>
                            <p className="pt-1">
                                <span className="text-gray-500">Total:</span>{' '}
                                <span className="text-lg font-bold text-red-600 tabular-nums">
                                    {formatMoney(payTotal)} AED
                                </span>
                            </p>
                        </div>
                    </div>
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
                        type="button"
                        disabled={saving || payTotal <= 0}
                        onClick={onConfirm}
                        className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Paying…' : 'Pay'}
                    </button>
                </div>
            </div>
        </div>
    );
}
