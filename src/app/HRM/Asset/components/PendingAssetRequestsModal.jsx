'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Bell, Package, Loader2, ChevronRight, Layers, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import BulkPendingResolveModal from './BulkPendingResolveModal';

function tabForAssetRequest(requestType) {
    const s = String(requestType || '');
    if (s.includes('Accessory')) return 'accessories';
    return 'document';
}

/**
 * Pending inbox: one row per dashboard item. Single-asset rows navigate to the asset.
 * Bulk groups open a sub-modal to approve/reject per asset.
 */
export default function PendingAssetRequestsModal({ isOpen, onClose, onRefreshParent }) {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [bulkRow, setBulkRow] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/dashboard/pending-inbox');
            setItems(Array.isArray(res.data?.items) ? res.data.items : []);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message || 'Could not load pending requests.' });
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!isOpen) return;
        load();
        setBulkRow(null);
    }, [isOpen, load]);

    const handleRowActivate = (row) => {
        if (row.isBulk && Array.isArray(row.bulkAssetIds) && row.bulkAssetIds.length > 1) {
            setBulkRow(row);
            return;
        }
        const id = row.primaryAssetId || row.asset?._id;
        if (!id) {
            toast({ variant: 'destructive', title: 'Missing asset', description: 'Could not resolve this request.' });
            return;
        }
        const tab = tabForAssetRequest(row.requestType);
        router.push(`/HRM/Asset/details/${String(id)}?tab=${tab}`);
        onClose();
    };

    const handleDeleteNotification = async (e, row) => {
        e.preventDefault();
        e.stopPropagation();
        const actionId = row.dashboardActionId;
        if (!actionId) return;
        if (
            !window.confirm(
                'Remove this notification from your list? The asset may still need approval on its detail page until the request is completed.'
            )
        ) {
            return;
        }
        setDeletingId(actionId);
        try {
            await axiosInstance.delete(`/AssetItem/dashboard/pending-inbox/${actionId}`);
            toast({ title: 'Notification removed' });
            setBulkRow((prev) => (prev?.dashboardActionId === actionId ? null : prev));
            await load();
            onRefreshParent?.();
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Could not remove',
                description: err?.response?.data?.message || 'Try again.'
            });
        } finally {
            setDeletingId(null);
        }
    };

    const visibleRows = items.filter((row) => row.asset || (row.isBulk && row.bulkAssetIds?.length));

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                    <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-white">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 border border-amber-200 shrink-0">
                                <Bell size={22} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-black text-slate-900 tracking-tight">Pending requests</h2>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                                    Tap a row — single asset opens the asset page; bulk requests open a review screen
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-sm font-semibold">Loading pending items…</span>
                            </div>
                        ) : visibleRows.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 text-sm font-semibold">
                                No pending asset requests in your inbox.
                            </div>
                        ) : (
                            visibleRows.map((row) => {
                                const isBulk = row.isBulk && row.bulkAssetIds?.length > 1;
                                const a = row.asset;
                                const pendingAcc = (a?.accessories || []).filter((x) => x.pendingAction);
                                return (
                                    <div
                                        key={row.dashboardActionId}
                                        className="rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-amber-200 transition-all flex items-stretch gap-0 group overflow-hidden"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleRowActivate(row)}
                                            className="flex-1 min-w-0 text-left p-4 flex items-start gap-3"
                                        >
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {isBulk ? (
                                                        <Layers size={18} className="text-amber-600 shrink-0" />
                                                    ) : (
                                                        <Package size={16} className="text-slate-400 shrink-0" />
                                                    )}
                                                    {isBulk ? (
                                                        <span className="text-sm font-black text-slate-900">
                                                            Bulk ({row.bulkAssetIds.length} assets)
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span className="text-sm font-black text-slate-900 truncate">{a?.name}</span>
                                                            <span className="text-[10px] font-mono text-slate-400">{a?.assetId}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">{row.requestType}</p>
                                                {row.extra1 && <p className="text-xs text-slate-600 line-clamp-3">{row.extra1}</p>}
                                                {!isBulk && a?.pendingAction && (
                                                    <p className="text-[10px] font-semibold text-rose-600">Asset action: {a.pendingAction}</p>
                                                )}
                                                {!isBulk && pendingAcc.length > 0 && (
                                                    <div className="mt-2 pl-2 border-l-2 border-amber-200 space-y-1">
                                                        <p className="text-[10px] font-black text-slate-500 uppercase">Accessories pending</p>
                                                        {pendingAcc.map((ac) => (
                                                            <div
                                                                key={ac._id || ac.accessoryId}
                                                                className="flex flex-wrap gap-2 text-[11px] text-slate-700"
                                                            >
                                                                <span className="font-bold">{ac.name || 'Accessory'}</span>
                                                                <span className="font-mono text-slate-400">{ac.accessoryId}</span>
                                                                {ac.pendingAction && (
                                                                    <span className="text-amber-700 font-semibold">({ac.pendingAction})</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <ChevronRight
                                                size={22}
                                                className="text-slate-300 group-hover:text-amber-600 shrink-0 mt-1"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            title="Remove notification"
                                            disabled={deletingId === row.dashboardActionId}
                                            onClick={(e) => handleDeleteNotification(e, row)}
                                            className="shrink-0 px-3 flex items-center justify-center border-l border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 transition-colors disabled:opacity-40"
                                        >
                                            {deletingId === row.dashboardActionId ? (
                                                <Loader2 className="animate-spin" size={18} />
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50/80">
                        <button
                            type="button"
                            onClick={() => {
                                load();
                                onRefreshParent?.();
                            }}
                            className="text-[11px] font-bold uppercase text-slate-600 hover:text-slate-900 px-3 py-2"
                        >
                            Refresh list
                        </button>
                    </div>
                </div>
            </div>

            <BulkPendingResolveModal
                isOpen={!!bulkRow}
                row={bulkRow}
                onClose={() => setBulkRow(null)}
                onSuccess={() => {
                    load();
                    onRefreshParent?.();
                }}
            />
        </>
    );
}
