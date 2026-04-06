'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { X, Loader2, Package, AlertTriangle, ExternalLink } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

function normalizeAsset(a) {
    if (!a) return null;
    return {
        _id: a._id,
        assetId: a.assetId,
        name: a.name,
        status: a.status,
        pendingAction: a.pendingAction,
        accessories: (a.accessories || []).map((ac) => ({
            _id: ac._id,
            accessoryId: ac.accessoryId,
            name: ac.name,
            status: ac.status,
            pendingAction: ac.pendingAction
        }))
    };
}

/**
 * Bulk pending dashboard item: select assets to approve; unchecked = returned to Draft (creation flow).
 * List is driven by bulkAssetIds (one row per id); inbox + GET bulk/details are merged so no asset is dropped.
 */
export default function BulkPendingResolveModal({ isOpen, row, onClose, onSuccess }) {
    const { toast } = useToast();
    const [checked, setChecked] = useState(() => new Set());
    const [submitting, setSubmitting] = useState(false);
    const [fetchedBulkAssets, setFetchedBulkAssets] = useState([]);
    const [loadingList, setLoadingList] = useState(false);

    const ids = useMemo(() => {
        if (!row?.bulkAssetIds?.length) return [];
        return row.bulkAssetIds.map((x) => String(x));
    }, [row]);

    const idsKey = ids.join(',');

    /** One row per bulk id: inbox rows + fetched rows merged (fetch wins for richer accessories). */
    const list = useMemo(() => {
        const byId = new Map();
        const put = (arr, prefer) => {
            for (const raw of arr || []) {
                if (!raw?._id) continue;
                const k = String(raw._id);
                const n = normalizeAsset(raw);
                if (!n) continue;
                if (prefer || !byId.has(k)) byId.set(k, n);
            }
        };
        put(row?.bulkAssets, false);
        put(fetchedBulkAssets, true);
        return ids.map((id) => {
            const k = String(id);
            return (
                byId.get(k) || {
                    _id: id,
                    assetId: '—',
                    name: 'Loading…',
                    status: null,
                    pendingAction: null,
                    accessories: []
                }
            );
        });
    }, [ids, row?.bulkAssets, fetchedBulkAssets]);

    useEffect(() => {
        if (!isOpen || !row) return;
        setChecked(new Set(ids));
    }, [isOpen, row, ids]);

    useEffect(() => {
        if (!isOpen || !row || ids.length === 0) {
            setFetchedBulkAssets([]);
            return;
        }
        let cancelled = false;
        setLoadingList(true);
        axiosInstance
            .get(`/AssetItem/bulk/details?ids=${encodeURIComponent(idsKey)}`)
            .then((res) => {
                if (cancelled) return;
                const items = res.data?.items || [];
                setFetchedBulkAssets(items.map((a) => normalizeAsset(a)).filter(Boolean));
            })
            .catch((e) => {
                if (cancelled) return;
                console.error(e);
                toast({
                    variant: 'destructive',
                    title: 'Could not load asset details',
                    description: e?.response?.data?.message || 'Try again.'
                });
                setFetchedBulkAssets([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingList(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, row?.dashboardActionId, idsKey, toast]);

    const toggle = (id) => {
        const sid = String(id);
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(sid)) next.delete(sid);
            else next.add(sid);
            return next;
        });
    };

    const selectAll = () => setChecked(new Set(ids));
    const selectNone = () => setChecked(new Set());

    const runSubmit = useCallback(async () => {
        if (!row || ids.length === 0) return;
        const selected = ids.filter((id) => checked.has(id));
        const unselected = ids.filter((id) => !checked.has(id));
        /** Backend loads :id from the URL and requires that asset to still have pendingAction. After rejecting a batch, the dashboard primary can be cleared first — so never use primaryId for both calls; use an id from each batch. */
        const urlIdForReject = unselected.length > 0 ? String(unselected[0]) : null;
        const urlIdForApprove = selected.length > 0 ? String(selected[0]) : null;

        setSubmitting(true);
        try {
            if (row.bulkKind === 'creation' || row.requestType === 'Asset Approval') {
                if (unselected.length > 0) {
                    await axiosInstance.put('/AssetItem/bulk/approve-creation', {
                        assetIds: unselected,
                        action: 'Draft'
                    });
                }
                if (selected.length > 0) {
                    await axiosInstance.put('/AssetItem/bulk/approve-creation', {
                        assetIds: selected,
                        action: 'Approve'
                    });
                }
            } else {
                if (unselected.length > 0 && urlIdForReject) {
                    await axiosInstance.put(`/AssetItem/${urlIdForReject}/approve-action`, {
                        approve: false,
                        comment: 'Not selected — treated as rejected.',
                        bulkAssetIdsToProcess: unselected.map(String)
                    });
                }
                if (selected.length > 0 && urlIdForApprove) {
                    await axiosInstance.put(`/AssetItem/${urlIdForApprove}/approve-action`, {
                        approve: true,
                        comment: '',
                        bulkAssetIdsToProcess: selected.map(String)
                    });
                }
            }

            toast({
                title: 'Done',
                description:
                    selected.length && unselected.length
                        ? `Approved ${selected.length} asset(s); returned ${unselected.length} to draft for the creator to edit.`
                        : selected.length
                          ? `Approved ${selected.length} asset(s).`
                          : `Returned ${unselected.length} asset(s) to draft.`
            });
            onSuccess?.();
            onClose();
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: e?.response?.data?.message || e.message || 'Request failed.'
            });
        } finally {
            setSubmitting(false);
        }
    }, [row, ids, checked, toast, onSuccess, onClose]);

    if (!isOpen || !row) return null;

    /** Approve/reject only when every row loaded from DB (no loading / missing asset placeholders). */
    const canConfirm =
        ids.length > 0 &&
        list.every((a) => a.name !== 'Loading…' && a.name !== 'Asset not found');

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200">
                <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Review bulk request</h3>
                        <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mt-1">{row.requestType}</p>
                        {row.extra1 && <p className="text-sm text-slate-600 mt-2">{row.extra1}</p>}
                        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-900">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span>
                                Checked assets will be <strong>approved</strong>. Unchecked assets are returned to <strong>Draft</strong> so the creator can edit and resubmit (they are not rejected).
                            </span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {loadingList && (
                        <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold">
                            <Loader2 className="animate-spin" size={14} />
                            Syncing asset rows and accessories…
                        </div>
                    )}

                    <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                        <button type="button" onClick={selectAll} className="text-amber-700 hover:underline">
                            Check all
                        </button>
                        <button type="button" onClick={selectNone} className="text-slate-500 hover:underline">
                            Uncheck all
                        </button>
                    </div>

                    {list.length === 0 ? (
                        <p className="text-sm text-slate-500">No assets in this bulk request.</p>
                    ) : (
                        <ul className="space-y-2">
                            {list.map((a) => {
                                const id = String(a._id);
                                const isOn = checked.has(id);
                                const accs = a.accessories || [];
                                const canOpenAsset = a.name !== 'Loading…' && a.name !== 'Asset not found';
                                const assetDetailHref = `/HRM/Asset/details/${id}?tab=document`;

                                return (
                                    <li
                                        key={id}
                                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="mt-1 w-4 h-4 rounded border-slate-300 text-amber-600 shrink-0 cursor-pointer"
                                                checked={isOn}
                                                onChange={() => toggle(id)}
                                                id={`bulk-pending-asset-${id}`}
                                                aria-label={`Select ${a.name || 'asset'}`}
                                            />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <Package size={16} className="text-slate-400 shrink-0" />
                                                        <span className="font-bold text-slate-900">{a.name}</span>
                                                        <span className="text-[10px] font-mono text-slate-400">{a.assetId}</span>
                                                    </div>
                                                    {canOpenAsset && (
                                                        <Link
                                                            href={assetDetailHref}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            View asset
                                                            <ExternalLink size={12} className="opacity-80" />
                                                        </Link>
                                                    )}
                                                </div>
                                                {a.pendingAction && (
                                                    <p className="text-[10px] font-semibold text-rose-600">
                                                        Pending: {a.pendingAction}
                                                    </p>
                                                )}
                                                {accs.length > 0 && (
                                                    <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase">
                                                            Accessories
                                                        </p>
                                                        {accs.map((ac) => (
                                                            <div
                                                                key={String(ac._id || ac.accessoryId)}
                                                                className="text-[11px] text-slate-700"
                                                            >
                                                                <span className="font-medium">{ac.name || '—'}</span>{' '}
                                                                <span className="font-mono text-slate-400">{ac.accessoryId}</span>
                                                                {ac.status && (
                                                                    <span className="text-slate-500"> · {ac.status}</span>
                                                                )}
                                                                {ac.pendingAction && (
                                                                    <span className="text-amber-800 font-semibold">
                                                                        {' '}
                                                                        — {ac.pendingAction}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black uppercase text-slate-600 bg-white"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={submitting || !canConfirm}
                        onClick={runSubmit}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
                        Confirm selection
                    </button>
                </div>
            </div>
        </div>
    );
}
