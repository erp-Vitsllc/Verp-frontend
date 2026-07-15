'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * HR-only: select Payment by, then approve the bill.
 */
export default function HrApproveBillModal({ isOpen, onClose, bill, onConfirm, saving = false }) {
    const [paymentBy, setPaymentBy] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setPaymentBy('');
        setError('');
    }, [isOpen, bill?._id]);

    if (!isOpen || !bill) return null;

    const amountTxt = `${Number(bill.amount || 0).toLocaleString('en-AE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} AED`;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!paymentBy) {
            setError('Select Payment by before approving.');
            return;
        }
        onConfirm?.({ paymentBy });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Approve Bill</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-sm">
                            <p className="text-gray-500">
                                Amount:{' '}
                                <span className="font-semibold text-gray-800">{amountTxt}</span>
                            </p>
                            {bill.billMonth ? (
                                <p className="text-gray-500 mt-0.5">
                                    Month: <span className="font-semibold text-gray-800">{bill.billMonth}</span>
                                </p>
                            ) : null}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Payment by <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                                    <input
                                        type="radio"
                                        name="hrPaymentBy"
                                        value="company"
                                        checked={paymentBy === 'company'}
                                        onChange={() => {
                                            setPaymentBy('company');
                                            setError('');
                                        }}
                                        className="mt-0.5 accent-teal-600"
                                    />
                                    <span className="text-sm text-gray-800">
                                        <span className="font-semibold">Pay by company</span>
                                        <span className="block text-xs text-gray-500">
                                            Full bill amount paid by company
                                        </span>
                                    </span>
                                </label>
                                <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                                    <input
                                        type="radio"
                                        name="hrPaymentBy"
                                        value="employee_balance"
                                        checked={paymentBy === 'employee_balance'}
                                        onChange={() => {
                                            setPaymentBy('employee_balance');
                                            setError('');
                                        }}
                                        className="mt-0.5 accent-teal-600"
                                    />
                                    <span className="text-sm text-gray-800">
                                        <span className="font-semibold">Balance pay by employee</span>
                                        <span className="block text-xs text-gray-500">
                                            Company covers monthly rental; excess paid by employee
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    </div>

                    <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
                        >
                            {saving ? 'Approving…' : 'Approve'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
