'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Undo2, ArrowRightLeft, User, Package } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import AssetBulkListPreview, {
    ASSET_BULK_MORE_THRESHOLD,
} from './AssetBulkListPreview';

/**
 * Return Asset modal — same UX as asset details Return (Individual / Bulk).
 * Supports presetAssets when opened from employee profile bulk selection.
 */
export default function ReturnAssetModal({
    isOpen,
    onClose,
    asset = null,
    /** Full asset objects already selected (profile bulk). */
    presetAssets = null,
    onUpdate,
    /** When true and no preset, show Individual/Bulk toggle and load assignee assets. */
    canUseBulkReturnUi = false,
    handoverTarget = null,
    /** Treat submitter as assignee (sends AC request with bulkAssetIds). */
    isAssigneeSelf = true,
}) {
    const { toast } = useToast();
    const hasPreset = Array.isArray(presetAssets) && presetAssets.length > 0;
    const primaryAsset = hasPreset ? presetAssets[0] : asset;

    const [returnMode, setReturnMode] = useState('individual');
    const [returnDescription, setReturnDescription] = useState('');
    const [isReturning, setIsReturning] = useState(false);
    const [returnableAssets, setReturnableAssets] = useState([]);
    const [returnBulkSelectedIds, setReturnBulkSelectedIds] = useState([]);
    const [returnableLoading, setReturnableLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setReturnDescription('');
        setIsReturning(false);

        if (hasPreset) {
            const ids = presetAssets.map((a) => String(a._id || a.id)).filter(Boolean);
            setReturnableAssets(presetAssets);
            setReturnBulkSelectedIds(ids);
            setReturnMode(ids.length > 1 ? 'bulk' : 'individual');
            setReturnableLoading(false);
            return;
        }

        setReturnMode('individual');
        if (primaryAsset?._id) {
            setReturnBulkSelectedIds([String(primaryAsset._id)]);
        } else {
            setReturnBulkSelectedIds([]);
        }
        setReturnableAssets(primaryAsset ? [primaryAsset] : []);
    }, [isOpen, hasPreset, presetAssets, primaryAsset?._id]);

    useEffect(() => {
        if (!isOpen || hasPreset || !canUseBulkReturnUi || !primaryAsset?._id) return;

        let cancelled = false;
        const load = async () => {
            setReturnableLoading(true);
            try {
                const response = await axiosInstance.get('/AssetItem/assigned/all');
                const assignedAssets = Array.isArray(response.data) ? response.data : [];
                const assigneeId =
                    primaryAsset.assignedTo?._id || primaryAsset.assignedTo;
                const mine = assignedAssets.filter((a) => {
                    const aid = a.assignedTo?._id || a.assignedTo;
                    return (
                        String(aid) === String(assigneeId) &&
                        String(a.status || '').trim() === 'Assigned' &&
                        !a.pendingAction
                    );
                });
                if (!cancelled) {
                    setReturnableAssets(mine.length ? mine : [primaryAsset]);
                }
            } catch {
                if (!cancelled) setReturnableAssets([primaryAsset]);
            } finally {
                if (!cancelled) setReturnableLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [isOpen, hasPreset, canUseBulkReturnUi, primaryAsset]);

    const selectedAssets = useMemo(() => {
        const idSet = new Set(returnBulkSelectedIds.map(String));
        const pool = hasPreset
            ? presetAssets
            : returnMode === 'bulk'
                ? returnableAssets
                : primaryAsset
                    ? [primaryAsset]
                    : [];
        if (returnMode === 'individual' && primaryAsset) return [primaryAsset];
        return (pool || []).filter((a) => idSet.has(String(a._id || a.id)));
    }, [
        returnBulkSelectedIds,
        hasPreset,
        presetAssets,
        returnMode,
        returnableAssets,
        primaryAsset,
    ]);

    const useCollapsedPreview =
        (returnMode === 'bulk' || hasPreset) &&
        selectedAssets.length >= ASSET_BULK_MORE_THRESHOLD;

    const toggleReturnBulkAsset = (rid) => {
        const id = String(rid);
        const primaryId = String(primaryAsset?._id || '');
        if (id === primaryId) return;
        setReturnBulkSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const submitReturn = async () => {
        const reason = String(returnDescription || '').trim();
        if (!reason) {
            toast({
                variant: 'destructive',
                title: 'Description required',
                description: 'Please enter a description before returning.',
            });
            return;
        }

        const ids =
            returnMode === 'bulk' || hasPreset
                ? returnBulkSelectedIds
                : primaryAsset?._id
                    ? [String(primaryAsset._id)]
                    : [];

        if (!ids.length) {
            toast({
                variant: 'destructive',
                title: 'No assets',
                description: 'Select at least one asset to return.',
            });
            return;
        }

        setIsReturning(true);
        try {
            const primary = ids[0];
            if (isAssigneeSelf) {
                if (ids.length > 1) {
                    await axiosInstance.put(`/AssetItem/${primary}/return`, {
                        bulkAssetIds: ids,
                        reason,
                    });
                } else {
                    await axiosInstance.put(`/AssetItem/${primary}/return`, { reason });
                }
                toast({
                    title: 'Success',
                    description:
                        ids.length > 1
                            ? 'Return request sent to the Asset Controller for the selected assets.'
                            : 'Return request sent to the Asset Controller.',
                });
            } else {
                for (const id of ids) {
                    await axiosInstance.put(`/AssetItem/${id}/return`, { reason });
                }
                toast({
                    title: 'Success',
                    description: `Return processed for ${ids.length} asset(s).`,
                });
            }
            if (onUpdate) onUpdate();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Return failed.',
            });
        } finally {
            setIsReturning(false);
        }
    };

    if (!isOpen || !primaryAsset) return null;

    const showBulkToggle =
        !hasPreset && canUseBulkReturnUi && returnableAssets.length > 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-100">
                            <Undo2 size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">
                                Return Asset
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {selectedAssets.length > 1
                                    ? `${selectedAssets.length} assets selected`
                                    : `Asset: ${primaryAsset.assetId} - ${primaryAsset.name}`}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    {showBulkToggle && (
                        <div className="flex rounded-2xl border border-slate-200 bg-slate-50/80 p-1 gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setReturnMode('individual');
                                    setReturnBulkSelectedIds([
                                        String(primaryAsset._id),
                                    ]);
                                }}
                                className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${returnMode === 'individual'
                                        ? 'bg-white text-amber-700 shadow-sm border border-amber-100'
                                        : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                Individual
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setReturnMode('bulk');
                                    setReturnBulkSelectedIds(
                                        returnableAssets.map((a) => String(a._id)),
                                    );
                                }}
                                className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${returnMode === 'bulk'
                                        ? 'bg-white text-amber-700 shadow-sm border border-amber-100'
                                        : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                Bulk return
                            </button>
                        </div>
                    )}

                    {returnMode === 'individual' && !hasPreset && (
                        <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-[24px] border border-slate-100">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                                    Asset Type
                                </label>
                                <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                    {primaryAsset.typeId?.name ||
                                        primaryAsset.typeId ||
                                        '-'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                                    Category
                                </label>
                                <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                    {primaryAsset.categoryId?.name ||
                                        primaryAsset.categoryId ||
                                        '-'}
                                </div>
                            </div>
                        </div>
                    )}

                    {(returnMode === 'bulk' || hasPreset) && (
                        <div className="rounded-[24px] border border-amber-100 bg-amber-50/40 p-5 space-y-3">
                            {useCollapsedPreview ? (
                                <AssetBulkListPreview
                                    assets={selectedAssets}
                                    title="Assets to return"
                                    accent="amber"
                                />
                            ) : returnableLoading ? (
                                <p className="text-sm text-slate-500 py-4 text-center">
                                    Loading your assets…
                                </p>
                            ) : hasPreset ? (
                                <div className="space-y-2">
                                    {selectedAssets.map((row) => (
                                        <div
                                            key={row._id || row.assetId}
                                            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                                                <Package size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">
                                                    {row.name}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 font-mono">
                                                    {row.assetId}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <ul className="space-y-2 max-h-48 overflow-y-auto">
                                    {returnableAssets.map((row) => {
                                        const rid = row._id?.toString();
                                        const isCurrent =
                                            rid === primaryAsset._id?.toString();
                                        const checked =
                                            returnBulkSelectedIds.includes(rid);
                                        return (
                                            <li
                                                key={rid}
                                                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${isCurrent
                                                        ? 'border-amber-300 bg-white'
                                                        : 'border-slate-200 bg-white'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300"
                                                    checked={checked}
                                                    disabled={isCurrent}
                                                    onChange={() =>
                                                        !isCurrent &&
                                                        toggleReturnBulkAsset(rid)
                                                    }
                                                />
                                                <span className="flex-1 font-bold text-slate-800">
                                                    {row.assetId} — {row.name || ''}
                                                    {isCurrent ? (
                                                        <span className="ml-2 text-[10px] font-black uppercase text-amber-600">
                                                            (this asset)
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            <p className="text-[11px] text-slate-600">
                                Selected {selectedAssets.length} asset
                                {selectedAssets.length !== 1 ? 's' : ''}.
                                {isAssigneeSelf
                                    ? ' One request will be sent to the Asset Controller.'
                                    : ''}
                            </p>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-100 rounded-[24px] p-6 space-y-2">
                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block pl-1">
                            Returning To
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-200 text-blue-700 flex items-center justify-center shadow-sm">
                                <User size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">
                                    {handoverTarget
                                        ? `${handoverTarget.firstName} ${handoverTarget.lastName} (Handover User)`
                                        : primaryAsset.assignedBy?.firstName
                                            ? `${primaryAsset.assignedBy.firstName} ${primaryAsset.assignedBy.lastName} (Original Issuer)`
                                            : 'Asset Store / Admin'}
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    {selectedAssets.length > 1
                                        ? 'Selected assets will be returned to the store after Asset Controller approval.'
                                        : handoverTarget
                                            ? 'Asset will be handed over to the designated successor.'
                                            : 'Asset will be returned to the store or original issuer.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                            Description <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={returnDescription}
                            onChange={(e) => setReturnDescription(e.target.value)}
                            rows={4}
                            placeholder="Describe why this asset is being returned…"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y min-h-[96px]"
                        />
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:border-slate-300 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submitReturn}
                        disabled={
                            isReturning || !String(returnDescription || '').trim()
                        }
                        className="flex-[2] px-6 py-4 bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-200 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                    >
                        {isReturning ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <ArrowRightLeft size={18} strokeWidth={2.5} />
                                {selectedAssets.length > 1
                                    ? `Submit bulk return (${selectedAssets.length})`
                                    : 'Confirm Return'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
