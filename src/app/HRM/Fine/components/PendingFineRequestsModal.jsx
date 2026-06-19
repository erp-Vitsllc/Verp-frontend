'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Bell, Loader2, ChevronRight, Receipt } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { buildFineNotificationPath, normalizeFineNotificationItem } from '@/utils/fineNotificationRouting';
import {
    countVisibleFinePendingInbox,
    notifyFinePendingInboxChanged,
} from '../utils/finePendingInboxCount';

export default function PendingFineRequestsModal({ isOpen, onClose, onRefreshParent, onPendingInboxCount }) {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/Fine/dashboard/pending-inbox');
            const list = Array.isArray(res.data?.items) ? res.data.items : [];
            setItems(list);
            const count = countVisibleFinePendingInbox(list);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(count);
            }
            notifyFinePendingInboxChanged();
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: e?.response?.data?.message || 'Could not load fine notifications.',
            });
            setItems([]);
            if (typeof onPendingInboxCount === 'function') onPendingInboxCount(0);
            notifyFinePendingInboxChanged();
        } finally {
            setLoading(false);
        }
    }, [toast, onPendingInboxCount]);

    useEffect(() => {
        if (!isOpen) return;
        load();
    }, [isOpen, load]);

    const handleRowActivate = (row) => {
        const path = buildFineNotificationPath(normalizeFineNotificationItem(row));
        if (!path) {
            toast({
                variant: 'destructive',
                title: 'Unable to open',
                description: 'Could not resolve this fine notification.',
            });
            return;
        }
        router.push(path);
        onClose();
        if (typeof onRefreshParent === 'function') onRefreshParent();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-amber-700" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
                            Fine notifications
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
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Loading…</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-500 px-6">
                            No pending fine notifications for you.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((row) => {
                                const fineLabel = row.fine?.fineId || row.fine?.baseFineId || 'Fine';
                                const typeLabel =
                                    row.requestType === 'Group Fine Request' ? 'Group Fine Request' : 'Fine Request';
                                return (
                                    <li key={String(row.dashboardActionId)}>
                                        <button
                                            type="button"
                                            onClick={() => handleRowActivate(row)}
                                            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-blue-50/80 transition-colors group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                                <Receipt size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{typeLabel}</p>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {row.requestedByName || 'System'} • {fineLabel}
                                                    {row.subjectName ? ` — ${row.subjectName}` : ''}
                                                </p>
                                                {row.extra1 ? (
                                                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                        {row.extra1}
                                                        {row.extra2 ? ` • ${row.extra2}` : ''}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <ChevronRight
                                                size={16}
                                                className="text-slate-300 group-hover:text-blue-500 shrink-0"
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
