'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Bell, Package, Loader2, ChevronRight, Layers, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';
import { useRouter } from 'next/navigation';
import BulkPendingResolveModal from './BulkPendingResolveModal';
import OwnerOnDutyReviewModal from './OwnerOnDutyReviewModal';
import { formatAssetDashboardRequestType, isAssetServiceOverdueRequestType, isPendingInboxRowVisible } from '../utils/assetRequestLabels';
import { countVisibleAssetPendingInbox, notifyAssetPendingInboxChanged } from '../utils/assetPendingInboxCount';
import { buildAssetNotificationPath, normalizeAssetNotificationItem } from '@/utils/assetNotificationRouting';
import { navigateFromNotificationClick } from '@/utils/listReturnNavigation';

/**
 * Pending inbox: one row per dashboard item. Single-asset rows navigate to the asset.
 * Bulk groups open a sub-modal to approve/reject per asset.
 */
/**
 * @param {'all'|'tools'|'vehicle'} inboxScope — tools = equipment inbox (excludes vehicle service workflow); vehicle = fleet only.
 */
export default function PendingAssetRequestsModal({
    isOpen,
    onClose,
    onRefreshParent,
    inboxScope = 'all',
    onPendingInboxCount,
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [bulkRow, setBulkRow] = useState(null);
    const [ownerOnDutyRow, setOwnerOnDutyRow] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [canDeleteNotifications, setCanDeleteNotifications] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const rawUser = localStorage.getItem('user');
            const user = rawUser ? JSON.parse(rawUser) : {};
            const isAdminUser =
                user?.isAdmin === true ||
                user?.role === 'Admin' ||
                user?.role === 'ROOT';
            setCanDeleteNotifications(isAdminUser);
        } catch {
            setCanDeleteNotifications(false);
        }
    }, [isOpen]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params =
                inboxScope === 'tools' || inboxScope === 'vehicle' ? { scope: inboxScope } : undefined;
            const res = await axiosInstance.get('/AssetItem/dashboard/pending-inbox', { params });
            const list = Array.isArray(res.data?.items) ? res.data.items : [];
            setItems(list);
            if (typeof onPendingInboxCount === 'function') {
                const n = countVisibleAssetPendingInbox(list);
                onPendingInboxCount(n);
            }
            notifyAssetPendingInboxChanged();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: e?.response?.data?.message || 'Could not load pending requests.' });
            setItems([]);
            if (typeof onPendingInboxCount === 'function') {
                onPendingInboxCount(0);
            }
            notifyAssetPendingInboxChanged();
        } finally {
            setLoading(false);
        }
    }, [toast, inboxScope, onPendingInboxCount]);

    useEffect(() => {
        if (!isOpen) return;
        load();
        setBulkRow(null);
    }, [isOpen, load]);

    const handleRowActivate = (row) => {
        if (row.requestType === 'Asset Owner On Duty' && row.dashboardActionId) {
            setOwnerOnDutyRow(row);
            return;
        }

        const path = buildAssetNotificationPath(normalizeAssetNotificationItem(row));
        if (path) {
            navigateFromNotificationClick(router, path);
            onClose();
            return;
        }

        if (
            row.isBulk &&
            row.bulkKind !== 'assignment' &&
            Array.isArray(row.bulkAssetIds) &&
            row.bulkAssetIds.length > 1
        ) {
            setBulkRow(row);
            return;
        }

        toast({
            variant: 'destructive',
            title: 'Missing asset',
            description: 'Could not resolve this request.',
        });
    };

    const handleDeleteNotification = (e, row) => {
        e.preventDefault();
        e.stopPropagation();
        const canDismiss = canDeleteNotifications || row.isCreatorOutcome;
        if (!canDismiss) return;
        const actionId = row.dashboardActionId;
        if (!actionId) return;
        setDeleteTarget(row);
    };

    const executeDeleteNotification = async () => {
        const row = deleteTarget;
        if (!row) return;
        const actionId = row.dashboardActionId;
        if (!actionId) return;
        setDeletingId(actionId);
        try {
            await axiosInstance.delete(`/AssetItem/dashboard/pending-inbox/${actionId}`);
            setItems((prev) => {
                const next = prev.filter((item) => item.dashboardActionId !== actionId);
                if (typeof onPendingInboxCount === 'function') {
                    onPendingInboxCount(countVisibleAssetPendingInbox(next));
                }
                return next;
            });
            notifyAssetPendingInboxChanged();
            toast({ title: 'Notification removed' });
            setBulkRow((prev) => (prev?.dashboardActionId === actionId ? null : prev));
            await load();
            onRefreshParent?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not remove',
                description: err?.response?.data?.message || 'Try again.',
            });
        } finally {
            setDeletingId(null);
            setDeleteTarget(null);
        }
    };

    const visibleRows = items.filter(isPendingInboxRowVisible);

    if (!isOpen) return null;

    return (
        <>
            {!bulkRow && !ownerOnDutyRow && (
            <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                    <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-white">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 border border-amber-200 shrink-0">
                                <Bell size={22} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                                    {inboxScope === 'vehicle' ? 'Vehicle pending' : 'Pending requests'}
                                </h2>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                                    {inboxScope === 'vehicle'
                                        ? 'Vehicle service, profile activation, disposition, HR creation approval, and your resubmit tasks'
                                        : inboxScope === 'tools'
                                          ? 'Tools & equipment — excludes vehicle service workflow'
                                          : 'Tap a row — single asset opens the asset page; bulk requests open a review screen'}
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
                                {inboxScope === 'vehicle'
                                    ? 'No pending vehicle tasks in your inbox.'
                                    : 'No pending asset requests in your inbox.'}
                            </div>
                        ) : (
                            visibleRows.map((row) => {
                                const isOwnerOnDuty = row.requestType === 'Asset Owner On Duty';
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
                                                    {isOwnerOnDuty ? (
                                                        <span className="text-sm font-black text-slate-900">
                                                            {row.subjectName || 'Parked assets'} — review
                                                        </span>
                                                    ) : isBulk ? (
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
                                                <p
                                                    className={`text-[11px] font-bold text-amber-800 tracking-wide ${
                                                        isAssetServiceOverdueRequestType(row.requestType) ? '' : 'uppercase'
                                                    }`}
                                                >
                                                    {formatAssetDashboardRequestType(row.requestType, row)}
                                                </p>
                                                {row.dashboardStatus === 'Rejected' || row.isCreatorOutcome ? (
                                                    <span className="inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                                        Not approved — resubmit or remove draft
                                                    </span>
                                                ) : null}
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
                                        {(canDeleteNotifications || row.isCreatorOutcome) && (
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
                                        )}
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
            )}

            <BulkPendingResolveModal
                isOpen={!!bulkRow}
                row={bulkRow}
                onClose={() => setBulkRow(null)}
                onSuccess={() => {
                    load();
                    onRefreshParent?.();
                }}
            />
            <OwnerOnDutyReviewModal
                isOpen={!!ownerOnDutyRow}
                dashboardActionId={ownerOnDutyRow?.dashboardActionId}
                onClose={() => {
                    setOwnerOnDutyRow(null);
                }}
                onCompleted={() => {
                    setOwnerOnDutyRow(null);
                    load();
                    onRefreshParent?.();
                }}
            />
            <ConfirmAlertDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => !open && !deletingId && setDeleteTarget(null)}
                title="Remove notification?"
                description={
                    deleteTarget?.isCreatorOutcome
                        ? 'Remove this notification from your list? You can still edit or delete the draft asset from its detail page.'
                        : 'Remove this notification from your list? The asset may still need approval on its detail page until the request is completed.'
                }
                confirmLabel="Remove"
                destructive
                loading={Boolean(deletingId)}
                onConfirm={executeDeleteNotification}
            />
        </>
    );
}
