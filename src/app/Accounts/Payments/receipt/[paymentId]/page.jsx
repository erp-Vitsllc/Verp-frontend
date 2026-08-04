'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Printer } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import PaymentReceipt from '@/app/Accounts/Payments/components/PaymentReceipt';
import { readCachedPaymentReceipt } from '@/app/HRM/LoanAndAdvance/utils/loanPaymentReceipts';

/**
 * Standalone payment receipt for new-tab open from loan/advance Document dropdown.
 * Prefers session-cached payment (from the row click), then loads via API search.
 */
export default function PaymentReceiptPage() {
    const params = useParams();
    const paymentKey = decodeURIComponent(String(params?.paymentId || '').trim());
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!paymentKey) {
                setError('Missing payment id.');
                setLoading(false);
                return;
            }

            const cached = readCachedPaymentReceipt(paymentKey);
            if (cached) {
                if (!cancelled) {
                    setPayment(cached);
                    setLoading(false);
                }
                return;
            }

            try {
                const res = await axiosInstance.get('/Payment', {
                    params: { search: paymentKey, limit: 25 },
                });
                const list = res.data?.payments || (Array.isArray(res.data) ? res.data : []);
                const match = list.find(
                    (p) =>
                        String(p._id) === paymentKey ||
                        String(p.paymentId || '') === paymentKey,
                );
                if (!match) {
                    if (!cancelled) setError('Payment receipt not found.');
                } else if (!cancelled) {
                    setPayment(match);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e?.response?.data?.message || 'Unable to load this receipt.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [paymentKey]);

    return (
        <div className="min-h-screen bg-gray-100 print:bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-200 print:hidden">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Payment receipt
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                        {payment?.paymentId || paymentKey || '—'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700"
                >
                    <Printer size={14} />
                    Print
                </button>
            </div>

            <div className="max-w-5xl mx-auto p-4 md:p-8">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
                        <Loader2 className="animate-spin" size={22} />
                        Loading receipt…
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm font-semibold text-rose-700">
                        {error}
                    </div>
                ) : payment ? (
                    <PaymentReceipt payment={payment} />
                ) : null}
            </div>
        </div>
    );
}
