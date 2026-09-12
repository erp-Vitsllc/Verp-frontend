'use client';

import { Receipt, UserCheck, Wallet, X } from 'lucide-react';

/**
 * First step after Pay: Expense Refund, Vendor Credit, and optionally Pay by Employee.
 */
export default function FinePayChoiceModal({
    isOpen,
    onClose,
    onExpenseRefund,
    onVendorCredit,
    onEmployeePay,
    showEmployeePay = true,
    showVendorCredit = true,
    title = 'Pay Fine',
    fineId = '',
    employeePayLabel = 'Pay by Employee',
    employeePayHint = 'Salary or cash. Emails the same receipt invoice to the employee.',
}) {
    if (!isOpen) return null;

    const showEmployeeOption = showEmployeePay && typeof onEmployeePay === 'function';
    const showVendorOption = showVendorCredit && typeof onVendorCredit === 'function';
    const optionCount = 1 + (showVendorOption ? 1 : 0) + (showEmployeeOption ? 1 : 0);
    const gridClass = optionCount >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45">
            <div className="absolute inset-0" onClick={onClose} aria-hidden />
            <div className="relative w-full max-w-[720px] bg-white rounded-md shadow-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                        <h2 className="text-[16px] font-semibold text-gray-800">{title}</h2>
                        {fineId ? (
                            <p className="text-[11px] text-gray-500 mt-0.5">{fineId}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className={`p-5 grid grid-cols-1 gap-3 ${gridClass}`}>
                    <button
                        type="button"
                        onClick={onExpenseRefund}
                        className="flex flex-col items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-left hover:border-emerald-400 hover:bg-emerald-100/80 transition-colors"
                    >
                        <Wallet className="text-emerald-700" size={22} />
                        <span className="text-sm font-semibold text-emerald-900">Expense Refund</span>
                        <span className="text-[11px] text-emerald-800/80 leading-snug">
                            Record Money In the same way as before.
                        </span>
                    </button>

                    {showVendorOption ? (
                        <button
                            type="button"
                            onClick={onVendorCredit}
                            className="flex flex-col items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 text-left hover:border-sky-400 hover:bg-sky-100/80 transition-colors"
                        >
                            <Receipt className="text-sky-700" size={22} />
                            <span className="text-sm font-semibold text-sky-900">Vendor Credit</span>
                            <span className="text-[11px] text-sky-800/80 leading-snug">
                                Create a Zoho Vendor Credit with Open status.
                            </span>
                        </button>
                    ) : null}

                    {showEmployeeOption ? (
                        <button
                            type="button"
                            onClick={onEmployeePay}
                            className="flex flex-col items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-left hover:border-amber-400 hover:bg-amber-100/80 transition-colors"
                        >
                            <UserCheck className="text-amber-800" size={22} />
                            <span className="text-sm font-semibold text-amber-900">{employeePayLabel}</span>
                            <span className="text-[11px] text-amber-800/80 leading-snug">
                                {employeePayHint}
                            </span>
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
