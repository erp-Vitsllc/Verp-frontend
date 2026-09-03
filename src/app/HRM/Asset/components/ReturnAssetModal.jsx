'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, ArrowRightLeft, Package, Undo2, ListChecks } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AssetBulkListPreview, {
    ASSET_BULK_MORE_THRESHOLD,
} from './AssetBulkListPreview';

/**
 * Return Asset modal — same card layout as End of Services (TransferAssetModal),
 * with a mandatory description field.
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
    isAssetController = false,
    /** Hide Individual/Bulk toggle (profile already selected the set). */
    hideModeToggle = false,
}) {
    const { toast } = useToast();
    const hasPreset = Array.isArray(presetAssets) && presetAssets.length > 0;
    const primaryAsset = hasPreset ? (presetAssets[0] || asset) : asset;

    const [returnMode, setReturnMode] = useState('individual');
    const [returnDescription, setReturnDescription] = useState('');
    const [isReturning, setIsReturning] = useState(false);
    const [confirmReturn, setConfirmReturn] = useState(false);
    const [otherAssets, setOtherAssets] = useState([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const selectAllRef = useRef(null);

    const isIdSelected = (id) =>
        selectedAssetIds.some((sid) => String(sid) === String(id));

    const allBulkAssetIds = useMemo(() => {
        if (hasPreset) {
            return presetAssets.map((a) => a._id || a.id).filter(Boolean);
        }
        if (!primaryAsset?._id) return [];
        return [primaryAsset._id, ...otherAssets.map((a) => a._id)];
    }, [hasPreset, presetAssets, primaryAsset?._id, otherAssets]);

    const selectedAssetObjects = useMemo(() => {
        if (hasPreset) {
            const idSet = new Set(selectedAssetIds.map(String));
            return presetAssets.filter((a) => idSet.has(String(a._id || a.id)));
        }
        const map = new Map();
        if (primaryAsset?._id) map.set(String(primaryAsset._id), primaryAsset);
        otherAssets.forEach((a) => {
            if (a?._id) map.set(String(a._id), a);
        });
        return selectedAssetIds.map((id) => map.get(String(id))).filter(Boolean);
    }, [hasPreset, presetAssets, selectedAssetIds, primaryAsset, otherAssets]);

    const allBulkSelected =
        allBulkAssetIds.length > 0 && allBulkAssetIds.every((id) => isIdSelected(id));

    const someBulkSelected =
        allBulkAssetIds.some((id) => isIdSelected(id)) && !allBulkSelected;

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someBulkSelected;
        }
    }, [someBulkSelected, allBulkSelected]);

    const toggleSelectAllBulk = () => {
        if (!primaryAsset?._id && !hasPreset) return;
        if (allBulkSelected) {
            setSelectedAssetIds(
                primaryAsset?._id ? [primaryAsset._id] : allBulkAssetIds.slice(0, 1),
            );
        } else {
            setSelectedAssetIds(allBulkAssetIds);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        setReturnDescription('');
        setIsReturning(false);
        setConfirmReturn(false);

        if (hasPreset) {
            const ids = presetAssets.map((a) => a._id || a.id).filter(Boolean);
            setOtherAssets(presetAssets.slice(1));
            setSelectedAssetIds(ids);
            setReturnMode(ids.length > 1 ? 'bulk' : 'individual');
            setLoadingAssets(false);
            return;
        }

        setReturnMode('individual');
        setSelectedAssetIds(primaryAsset?._id ? [primaryAsset._id] : []);
        setOtherAssets([]);

        if (canUseBulkReturnUi && primaryAsset?._id) {
            fetchOtherAssets();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, hasPreset, presetAssets, primaryAsset?._id, canUseBulkReturnUi]);

    useEffect(() => {
        if (hasPreset || !isOpen) return;
        if (returnMode === 'bulk' && otherAssets.length > 0 && primaryAsset?._id) {
            setSelectedAssetIds([primaryAsset._id, ...otherAssets.map((a) => a._id)]);
        } else if (returnMode === 'individual') {
            setSelectedAssetIds(primaryAsset?._id ? [primaryAsset._id] : []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [returnMode, otherAssets.length, hasPreset, isOpen]);

    const fetchOtherAssets = async () => {
        setLoadingAssets(true);
        try {
            const response = await axiosInstance.get('/AssetItem/assigned/me-for-return');
            const items = Array.isArray(response.data?.items)
                ? response.data.items
                : Array.isArray(response.data)
                    ? response.data
                    : [];
            const primaryId = String(primaryAsset?._id || '');
            const others = items.filter(
                (a) =>
                    String(a._id) !== primaryId &&
                    String(a.status || '').trim() === 'Assigned' &&
                    !a.pendingAction,
            );
            setOtherAssets(others);
        } catch {
            try {
                const response = await axiosInstance.get('/AssetItem/assigned/all');
                const assignedAssets = Array.isArray(response.data) ? response.data : [];
                const assigneeId =
                    primaryAsset?.assignedTo?._id || primaryAsset?.assignedTo;
                const others = assignedAssets.filter((a) => {
                    const aid = a.assignedTo?._id || a.assignedTo;
                    return (
                        String(aid) === String(assigneeId) &&
                        String(a._id) !== String(primaryAsset?._id) &&
                        String(a.status || '').trim() === 'Assigned' &&
                        !a.pendingAction
                    );
                });
                setOtherAssets(others);
            } catch {
                setOtherAssets([]);
            }
        } finally {
            setLoadingAssets(false);
        }
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
                ? selectedAssetIds.map(String).filter(Boolean)
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
            const statusLower = String(primaryAsset?.status || '')
                .toLowerCase()
                .trim();
            const isOnService =
                statusLower === 'service' || statusLower === 'on service';

            if (isOnService && ids.length === 1) {
                await axiosInstance.put(`/AssetItem/${primary}/on-service-action`, {
                    action: 'Return',
                    reason,
                });
                toast({
                    title: 'Success',
                    description: 'Return request processed.',
                });
            } else if (isAssigneeSelf) {
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
                const acReturnRes = ids.length > 1
                    ? await axiosInstance.put(`/AssetItem/${primary}/return`, {
                        bulkAssetIds: ids,
                        reason,
                    })
                    : await axiosInstance.put(`/AssetItem/${primary}/return`, { reason });
                toast({
                    title: 'Success',
                    description:
                        acReturnRes?.data?.message ||
                        'Return request sent to the assigned employee (or their reportee) for approval.',
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
            setConfirmReturn(false);
        }
    };

    if (!isOpen || !primaryAsset) return null;

    const showBulkToggle =
        !hideModeToggle &&
        !hasPreset &&
        canUseBulkReturnUi &&
        (otherAssets.length > 0 || returnMode === 'bulk');

    const useCollapsedBulkPreview =
        returnMode === 'bulk' &&
        selectedAssetObjects.length >= ASSET_BULK_MORE_THRESHOLD;

    const assigneeName =
        primaryAsset?.assignedTo?.firstName ||
        primaryAsset?.assignedTo?.name ||
        'Unknown';

    const forwardTargetLabel =
        isAssetController && !isAssigneeSelf ? 'Asset Owner' : 'Asset Controller';
    const forwardButtonText = `Forward to ${forwardTargetLabel}`;

    const selectedCount =
        returnMode === 'bulk' || hasPreset
            ? selectedAssetIds.length
            : 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                Return Asset to Store
                            </h2>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Current Assignee:{' '}
                                <span className="text-indigo-600 font-bold">
                                    {assigneeName}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                    {(showBulkToggle || (hasPreset && !hideModeToggle && allBulkAssetIds.length > 1)) && (
                        <div className="flex p-1 bg-slate-100/80 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => {
                                    setReturnMode('individual');
                                    setSelectedAssetIds(
                                        primaryAsset?._id ? [primaryAsset._id] : [],
                                    );
                                }}
                                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                                    returnMode === 'individual'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                single asset return
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setReturnMode('bulk');
                                    if (hasPreset) {
                                        setSelectedAssetIds(allBulkAssetIds);
                                    } else if (otherAssets.length > 0) {
                                        setSelectedAssetIds([
                                            primaryAsset._id,
                                            ...otherAssets.map((a) => a._id),
                                        ]);
                                    } else {
                                        setSelectedAssetIds(
                                            primaryAsset?._id ? [primaryAsset._id] : [],
                                        );
                                    }
                                }}
                                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                                    returnMode === 'bulk'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                bulk asset return
                            </button>
                        </div>
                    )}

                    {returnMode === 'individual' && (
                        <div className="bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                                <Package size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">
                                    {primaryAsset?.name}
                                </p>
                                <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">
                                    {primaryAsset?.assetId}
                                </p>
                            </div>
                        </div>
                    )}

                    {returnMode === 'bulk' && (
                        <div className="space-y-3 pt-2">
                            {useCollapsedBulkPreview ? (
                                <>
                                    <AssetBulkListPreview
                                        assets={selectedAssetObjects}
                                        title="Assets in this request"
                                        accent="rose"
                                    />
                                    {!hasPreset && (
                                        <details className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                                            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-indigo-700">
                                                Adjust selection
                                            </summary>
                                            <div className="mt-2 max-h-[160px] overflow-y-auto space-y-1">
                                                <label className="flex items-center gap-2 cursor-pointer px-1 py-1">
                                                    <input
                                                        ref={selectAllRef}
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 outline-none"
                                                        checked={allBulkSelected}
                                                        onChange={toggleSelectAllBulk}
                                                    />
                                                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                                                        Select all ({allBulkAssetIds.length})
                                                    </span>
                                                </label>
                                                {otherAssets.map((other) => (
                                                    <label
                                                        key={other._id}
                                                        className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 cursor-pointer transition-all"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 outline-none"
                                                            checked={isIdSelected(other._id)}
                                                            onChange={(e) => {
                                                                const oid = other._id;
                                                                if (e.target.checked) {
                                                                    setSelectedAssetIds((prev) =>
                                                                        prev.some(
                                                                            (id) =>
                                                                                String(id) ===
                                                                                String(oid),
                                                                        )
                                                                            ? prev
                                                                            : [...prev, oid],
                                                                    );
                                                                } else {
                                                                    setSelectedAssetIds((prev) =>
                                                                        prev.filter(
                                                                            (id) =>
                                                                                String(id) !==
                                                                                String(oid),
                                                                        ),
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="text-sm font-bold text-slate-700 truncate">
                                                                {other.name}
                                                            </p>
                                                            <p className="text-[10px] font-bold text-slate-400 font-mono">
                                                                {other.assetId}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                                            <Package size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">
                                                {primaryAsset?.name}
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">
                                                {primaryAsset?.assetId}
                                            </p>
                                        </div>
                                        <div className="ml-auto px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-lg shrink-0">
                                            Primary
                                        </div>
                                    </div>

                                    {!hasPreset && (
                                        <>
                                            <div className="flex items-center justify-between gap-3 pl-1 pr-1">
                                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <ListChecks size={14} /> Other Assigned
                                                    Assets
                                                </label>
                                                {!loadingAssets &&
                                                    (otherAssets.length > 0 ||
                                                        primaryAsset?._id) && (
                                                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                                            <input
                                                                ref={selectAllRef}
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 outline-none"
                                                                checked={allBulkSelected}
                                                                onChange={toggleSelectAllBulk}
                                                            />
                                                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                                                                Select all (
                                                                {allBulkAssetIds.length})
                                                            </span>
                                                        </label>
                                                    )}
                                            </div>

                                            <div className="max-h-[160px] overflow-y-auto border rounded-2xl p-2 space-y-1 bg-slate-50/50">
                                                {loadingAssets ? (
                                                    <p className="text-xs text-center text-slate-400 py-4 font-bold uppercase">
                                                        Loading assets...
                                                    </p>
                                                ) : otherAssets.length === 0 ? (
                                                    <p className="text-xs text-center text-slate-400 py-4 font-bold uppercase">
                                                        No other assets found
                                                    </p>
                                                ) : (
                                                    otherAssets.map((other) => (
                                                        <label
                                                            key={other._id}
                                                            className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 cursor-pointer transition-all"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 outline-none"
                                                                checked={isIdSelected(
                                                                    other._id,
                                                                )}
                                                                onChange={(e) => {
                                                                    const oid = other._id;
                                                                    if (e.target.checked) {
                                                                        setSelectedAssetIds(
                                                                            (prev) =>
                                                                                prev.some(
                                                                                    (id) =>
                                                                                        String(
                                                                                            id,
                                                                                        ) ===
                                                                                        String(
                                                                                            oid,
                                                                                        ),
                                                                                )
                                                                                    ? prev
                                                                                    : [
                                                                                          ...prev,
                                                                                          oid,
                                                                                      ],
                                                                        );
                                                                    } else {
                                                                        setSelectedAssetIds(
                                                                            (prev) =>
                                                                                prev.filter(
                                                                                    (id) =>
                                                                                        String(
                                                                                            id,
                                                                                        ) !==
                                                                                        String(
                                                                                            oid,
                                                                                        ),
                                                                                ),
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                            <div className="flex-1 overflow-hidden">
                                                                <p className="text-sm font-bold text-slate-700 truncate">
                                                                    {other.name}
                                                                </p>
                                                                <p className="text-[10px] font-bold text-slate-400 font-mono">
                                                                    {other.assetId}
                                                                </p>
                                                            </div>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {hasPreset && (
                                        <div className="space-y-2">
                                            {selectedAssetObjects
                                                .slice(1)
                                                .map((row) => (
                                                    <div
                                                        key={row._id || row.assetId}
                                                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                                                    >
                                                        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
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
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className="h-px bg-slate-100 w-full" />

                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1">
                            Action Option
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex flex-col items-center justify-center p-4 border-2 rounded-2xl border-rose-400 bg-rose-50 text-rose-700 shadow-sm">
                                <Undo2 size={28} className="mb-2" />
                                <span className="text-[12px] font-bold uppercase tracking-wide">
                                    Return
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[11px] font-black text-rose-600 uppercase tracking-widest pl-1">
                            Description <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={returnDescription}
                            onChange={(e) => setReturnDescription(e.target.value)}
                            rows={4}
                            placeholder="Describe why this asset is being returned…"
                            className="w-full px-4 py-3 bg-white border border-rose-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-400/10 transition-all placeholder:text-slate-300 placeholder:font-normal resize-y min-h-[96px]"
                        />
                    </div>

                    {handoverTarget && (
                        <p className="text-[11px] text-slate-500 font-medium">
                            Handover target:{' '}
                            <span className="font-bold text-slate-700">
                                {handoverTarget.firstName} {handoverTarget.lastName}
                            </span>
                        </p>
                    )}
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!String(returnDescription || '').trim()) {
                                return toast({
                                    variant: 'destructive',
                                    title: 'Description required',
                                    description:
                                        'Please enter a description before returning.',
                                });
                            }
                            setConfirmReturn(true);
                        }}
                        disabled={isReturning || !String(returnDescription || '').trim()}
                        className="flex-[2] flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-all bg-rose-500 hover:bg-rose-600 shadow-rose-200 disabled:opacity-50"
                    >
                        {forwardButtonText}
                    </button>
                </div>
            </div>

            <AlertDialog open={confirmReturn} onOpenChange={setConfirmReturn}>
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">
                            Confirm Action
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500 flex flex-col gap-2">
                            <span>
                                Request{' '}
                                <span className="font-bold text-gray-900">Return</span> for
                                <span className="font-bold text-gray-900">
                                    {' '}
                                    {returnMode === 'bulk' || selectedCount > 1
                                        ? `${selectedCount} asset(s)`
                                        : `"${primaryAsset?.name}"`}
                                </span>
                                ? This will notify the {forwardTargetLabel} to return the
                                asset(s) to store as{' '}
                                <span className="font-bold text-rose-600">
                                    &quot;Unassigned&quot;
                                </span>
                                .
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest cursor-pointer">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                submitReturn();
                            }}
                            disabled={isReturning}
                            className="bg-rose-500 hover:bg-rose-600 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-rose-100 cursor-pointer"
                        >
                            {isReturning ? 'Submitting...' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
