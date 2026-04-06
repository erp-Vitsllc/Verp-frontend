'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Loader2, Package, ListChecks } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

/**
 * AC bulk-assign batch: assignee (or manager delegate) reviews assets.
 * Checked = accept assignment; unchecked = decline (unassigned, or prior assignee when batch meta says so).
 */
export default function BulkAssignmentAcknowledgeModal({ isOpen, groupId, onClose, onSuccess }) {
    const { toast } = useToast();
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [items, setItems] = useState([]);
    const [checked, setChecked] = useState(() => new Set());
    const [comments, setComments] = useState('');

    useEffect(() => {
        if (!isOpen || !groupId) {
            setItems([]);
            setChecked(new Set());
            setComments('');
            return;
        }

        let cancelled = false;
        setLoading(true);

        (async () => {
            try {
                const res = await axiosInstance.get(`/AssetItem/bulk-assignment-pending/${encodeURIComponent(groupId)}`);
                const list = Array.isArray(res.data?.items) ? res.data.items : [];
                if (cancelled) return;
                setItems(list);
                setChecked(new Set(list.map((row) => String(row._id))));
            } catch (e) {
                if (cancelled) return;
                console.error(e);
                const msg = e?.response?.data?.message || 'Could not load this batch.';
                toast({ variant: 'destructive', title: 'Batch unavailable', description: msg });
                setItems([]);
                setChecked(new Set());
                onCloseRef.current?.();
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, groupId, toast]);

    const toggle = useCallback((id) => {
        const k = String(id);
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    }, []);

    const allIds = useMemo(() => items.map((row) => String(row._id)), [items]);

    const submit = async () => {
        if (!groupId || allIds.length === 0) return;
        const acceptedAssetIds = allIds.filter((id) => checked.has(id));
        const rejectedAssetIds = allIds.filter((id) => !checked.has(id));
        if (acceptedAssetIds.length + rejectedAssetIds.length !== allIds.length) {
            toast({ variant: 'destructive', title: 'Invalid selection', description: 'Each asset must be accepted or declined.' });
            return;
        }
        setSubmitting(true);
        try {
            const res = await axiosInstance.put('/AssetItem/bulk-assignment-respond', {
                groupId,
                acceptedAssetIds,
                rejectedAssetIds,
                comments: comments.trim() || undefined
            });
            toast({
                title: 'Batch updated',
                description: res.data?.message || 'Your responses were saved.'
            });
            onSuccess?.();
            onClose?.();
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Could not submit',
                description: e?.response?.data?.message || 'Try again.'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !groupId) return null;

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 bg-gradient-to-r from-sky-50/90 to-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-800 border border-sky-200 shrink-0">
                            <ListChecks size={22} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Bulk assignment</h2>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Accept assigned assets (checked). Unchecked = decline — unassigned or returned to prior holder when applicable
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-50"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                            <Loader2 className="animate-spin" size={32} />
                            <span className="text-sm font-semibold">Loading assets…</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm font-semibold">No pending items in this batch.</div>
                    ) : (
                        items.map((row) => {
                            const id = String(row._id);
                            const isOn = checked.has(id);
                            const cat = row.categoryId?.name || '—';
                            const by = row.assignedBy
                                ? `${row.assignedBy.firstName || ''} ${row.assignedBy.lastName || ''}`.trim() ||
                                  row.assignedBy.employeeId ||
                                  '—'
                                : '—';
                            const rev = row.bulkAssignment?.revertToDisplayName;
                            return (
                                <label
                                    key={id}
                                    className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${
                                        isOn ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200 bg-slate-50/50 opacity-90'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                        checked={isOn}
                                        onChange={() => toggle(id)}
                                    />
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Package size={16} className="text-slate-400 shrink-0" />
                                            <span className="font-bold text-slate-900 text-sm">{row.name || 'Asset'}</span>
                                            <span className="text-xs font-mono text-slate-500">{row.assetId}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-600">
                                            <span className="font-semibold">{cat}</span>
                                            <span className="mx-1 text-slate-300">·</span>
                                            <span>From {by}</span>
                                            {row.assignmentType ? (
                                                <>
                                                    <span className="mx-1 text-slate-300">·</span>
                                                    <span>{row.assignmentType}</span>
                                                </>
                                            ) : null}
                                        </div>
                                        {rev ? (
                                            <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide pt-1">
                                                If declined: returns to {rev}
                                            </p>
                                        ) : (
                                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide pt-1">
                                                If declined: returns to unassigned pool
                                            </p>
                                        )}
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>

                {!loading && items.length > 0 ? (
                    <div className="p-5 border-t border-slate-100 space-y-3 bg-white">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                Comment (optional)
                            </label>
                            <textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                                placeholder="Optional note for accepted / declined items"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={submitting}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 shadow-lg shadow-sky-100"
                            >
                                {submitting ? 'Saving…' : 'Submit responses'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
