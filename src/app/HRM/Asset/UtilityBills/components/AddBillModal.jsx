'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { MonthPicker } from '@/components/ui/date-picker';

/**
 * Add bill — if amount > monthly rental, OK becomes "Send HR for Approval".
 * Payment by is chosen only by HR at approve time.
 */
export default function AddBillModal({
    isOpen,
    onClose,
    monthlyRental = 0,
    utilityType = '',
    onSubmit,
    saving = false,
}) {
    const [amount, setAmount] = useState('');
    const [billMonth, setBillMonth] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setAmount('');
        setBillMonth('');
        setNotes('');
        setError('');
    }, [isOpen]);

    const amountNum = Number(amount);
    const overLimit =
        Number.isFinite(amountNum) && amount !== '' && amountNum > Number(monthlyRental || 0);

    const primaryLabel = useMemo(
        () => (overLimit ? 'Send HR for Approval' : 'OK'),
        [overLimit],
    );

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!Number.isFinite(amountNum) || amountNum < 0 || amount === '') {
            setError('Enter a valid payment amount.');
            return;
        }
        onSubmit?.({
            amount: amountNum,
            billMonth,
            notes,
            sendForHr: overLimit,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-visible">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Add {utilityType || 'Utility'} Bill</h2>
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
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Bill payment amount
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => {
                                        setAmount(e.target.value);
                                        setError('');
                                    }}
                                    className={`w-full rounded-lg border px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                                        overLimit
                                            ? 'border-red-400 text-red-600 font-semibold'
                                            : 'border-gray-300 text-gray-800'
                                    }`}
                                    placeholder="0.00"
                                    autoFocus
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                                    AED
                                </span>
                            </div>
                            <p className={`mt-1 text-xs ${overLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                Monthly rental: {Number(monthlyRental || 0).toLocaleString('en-AE', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}{' '}
                                AED
                                {overLimit ? ' — amount exceeds monthly rental (HR will choose Payment by)' : ''}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Bill month
                            </label>
                            <MonthPicker
                                value={billMonth}
                                onChange={(v) => setBillMonth(v || '')}
                                placeholder="Select bill month"
                                className="w-full"
                                fromYear={new Date().getFullYear() - 3}
                                toYear={new Date().getFullYear() + 2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Notes
                            </label>
                            <textarea
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                                placeholder="Optional"
                            />
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
                            className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 ${
                                overLimit
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : 'bg-teal-500 hover:bg-teal-600'
                            }`}
                        >
                            {saving ? 'Saving…' : primaryLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
