'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Bell, Loader2, ChevronRight, Banknote } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';
import {
    countVisiblePaymentPendingInbox,
    notifyPaymentPendingInboxChanged,
} from '../utils/paymentPendingInboxCount';

export default function PendingPaymentRequestsModal({
    isOpen,
    onClose,
    onRefreshParent,
    onPendingInboxCount,
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/Payment/dashboard/pending-inbox');
            const list = Array.isArray(res.data?.items) ? res.data.items : [];
            setItems(list);
            const count = countVisiblePaymentPendingInbox(list);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
            notifyPaymentPendingInboxChanged();
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: e?.response?.data?.message || 'Could not load payment notifications.',
            });
            setItems([]);
            if (typeof onPendingInboxCount === 'function') onPendingInboxCount(0);
            notifyPaymentPendingInboxChanged();
        } finally {
            setLoading(false);
        }
    }, [toast, onPendingInboxCount]);

    useEffect(() => {
        if (!isOpen) return;
        load();
    }, [isOpen, load]);

    const handleRowActivate = (row) => {
        const paymentId = row.payment?.paymentId || row.payment?._id;
        if (!paymentId) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not resolve this payment notification.',
            });
            return;
        }
        navigateFromNotificationClick(router, `/Accounts/Payments?paymentId=${encodeURIComponent(paymentId)}`);
        onClose();
        if (typeof onRefreshParent === 'function') onRefreshParent();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-sky-700" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
                            Payment approvals
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-500 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Loading…</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-500 px-6">
                            No pending payment approvals for you.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((row) => {
                                const paymentLabel = row.payment?.paymentId || 'Payment';
                                return (
                                    <li key={String(row.dashboardActionId)}>
                                        <button
                                            type="button"
                                            onClick={() => handleRowActivate(row)}
                                            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-sky-50/80 transition-colors group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                                                <Banknote size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">
                                                    Payment approval required
                                                </p>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {row.requestedByName || 'System'} • {paymentLabel}
                                                    {row.subjectName ? ` — ${row.subjectName}` : ''}
                                                </p>
                                                {row.extra1 || row.extra2 ? (
                                                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                        {row.extra1}
                                                        {row.extra2 ? ` • ${row.extra2}` : ''}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <ChevronRight
                                                size={16}
                                                className="text-slate-300 group-hover:text-sky-500 shrink-0"
                                            />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
