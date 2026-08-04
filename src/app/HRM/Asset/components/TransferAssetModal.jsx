'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, ArrowRightLeft, Package, CalendarClock, PackageX, ListChecks } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { MAX_ASSET_LEAVE_DAYS } from '@/utils/assetStatusHelpers';
import AssetBulkListPreview, {
    ASSET_BULK_MORE_THRESHOLD,
} from './AssetBulkListPreview';

export default function TransferAssetModal({
    isOpen,
    onClose,
    asset,
    onUpdate,
    isAssetController = false,
    isAssignedUser = false,
    /** Prefill Leave | End of Services when opened from Return menu. */
    initialActionOption = 'Leave',
    /**
     * When opened from profile bulk selection: full asset objects already chosen.
     * Skips "fetch other assignee assets" and starts in bulk with these selected.
     */
    presetAssets = null,
    /** Force starting mode when opening (profile bulk → 'bulk'). */
    initialTransferMode = 'individual',
    /** Hide Individual/Bulk toggle (profile already selected the set). */
    hideModeToggle = false,
    /** Lock action tiles to initialActionOption only. */
    lockActionOption = false,
}) {
    const [transferMode, setTransferMode] = useState('individual');
    const [actionOption, setActionOption] = useState('Leave');
    const [leaveDuration, setLeaveDuration] = useState('');

    const [otherAssets, setOtherAssets] = useState([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState(false);
    const selectAllRef = useRef(null);
    const { toast } = useToast();

    const hasPreset = Array.isArray(presetAssets) && presetAssets.length > 0;
    const primaryAsset = hasPreset ? (presetAssets[0] || asset) : asset;

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
            setSelectedAssetIds(primaryAsset?._id ? [primaryAsset._id] : allBulkAssetIds.slice(0, 1));
        } else {
            setSelectedAssetIds(allBulkAssetIds);
        }
    };

    const calculateBusinessExpiryMidnight = (days) => {
        const start = new Date();
        const target = new Date(start);
        let remaining = Number(days);

        while (remaining > 0) {
            target.setDate(target.getDate() + 1);
            if (target.getDay() !== 0) remaining -= 1;
        }

        const expiry = new Date(target);
        const hasTimePortion =
            expiry.getHours() !== 0 ||
            expiry.getMinutes() !== 0 ||
            expiry.getSeconds() !== 0 ||
            expiry.getMilliseconds() !== 0;
        if (hasTimePortion) {
            expiry.setDate(expiry.getDate() + 1);
        }
        expiry.setHours(0, 0, 0, 0);
        return expiry;
    };

    useEffect(() => {
        if (!isOpen) return;

        const initial =
            initialActionOption === 'End of Services' ? 'End of Services' : 'Leave';
        setActionOption(initial);
        setLeaveDuration('');
        setConfirmTransfer(false);

        if (hasPreset) {
            const ids = presetAssets.map((a) => a._id || a.id).filter(Boolean);
            setOtherAssets(presetAssets.slice(1));
            setSelectedAssetIds(ids);
            setTransferMode(
                ids.length > 1 || initialTransferMode === 'bulk' ? 'bulk' : 'individual',
            );
            setLoadingAssets(false);
            return;
        }

        setTransferMode(initialTransferMode === 'bulk' ? 'bulk' : 'individual');
        setSelectedAssetIds(asset ? [asset._id] : []);
        setOtherAssets([]);

        if (asset?.assignedTo) {
            fetchOtherAssets(asset.assignedTo._id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, asset, initialActionOption, presetAssets, initialTransferMode]);

    useEffect(() => {
        if (hasPreset || !isOpen) return;
        if (transferMode === 'bulk' && asset && asset.assignedTo && otherAssets.length > 0) {
            const allAssetIds = [asset._id, ...otherAssets.map((a) => a._id)];
            setSelectedAssetIds(allAssetIds);
        } else if (transferMode === 'individual') {
            setSelectedAssetIds(asset ? [asset._id] : []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transferMode, otherAssets.length, hasPreset, isOpen]);

    const fetchOtherAssets = async (employeeId) => {
        setLoadingAssets(true);
        try {
            const response = await axiosInstance.get('/AssetItem/assigned/all');
            const assignedAssets = Array.isArray(response.data) ? response.data : [];
            const employeeAssets = assignedAssets.filter(
                (a) =>
                    a.assignedTo &&
                    a.assignedTo._id === employeeId &&
                    a.status === 'Assigned' &&
                    a._id !== asset._id,
            );
            setOtherAssets(employeeAssets);
        } catch (error) {
            // keep empty list
        } finally {
            setLoadingAssets(false);
        }
    };

    const handleTransfer = async () => {
        const assetsToTransfer =
            transferMode === 'individual'
                ? [primaryAsset._id]
                : selectedAssetIds.length > 0
                    ? selectedAssetIds
                    : [primaryAsset._id];

        if (assetsToTransfer.length === 0) {
            return toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Please select at least one asset',
            });
        }

        setSubmitting(true);
        try {
            const reasonText =
                actionOption === 'Leave'
                    ? `Leave duration: ${leaveDuration} days`
                    : 'End of Services return requested';

            if (assetsToTransfer.length > 1) {
                const payload = {
                    assetIds: assetsToTransfer,
                    actionType: actionOption,
                    reason: reasonText,
                };
                if (actionOption === 'Leave') {
                    payload.duration = parseInt(leaveDuration, 10);
                    payload.leaveDuration = parseInt(leaveDuration, 10);
                }
                await axiosInstance.put(`/AssetItem/bulk/request-action`, payload);
            } else {
                const id = assetsToTransfer[0];
                const payload = { actionType: actionOption, reason: reasonText };
                if (actionOption === 'Leave') {
                    payload.duration = parseInt(leaveDuration, 10);
                    payload.leaveDuration = parseInt(leaveDuration, 10);
                }
                await axiosInstance.put(`/AssetItem/${id}/request-action`, payload);
            }

            const msg = `${actionOption} request sent to ${forwardTargetLabel} for ${assetsToTransfer.length} asset${assetsToTransfer.length > 1 ? 's' : ''}.`;
            toast({ title: 'Success', description: msg });

            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Failed to submit request.';
            toast({ variant: 'destructive', title: 'Error', description: errorMsg });
        } finally {
            setSubmitting(false);
            setConfirmTransfer(false);
        }
    };

    if (!isOpen || !primaryAsset) return null;

    const forwardTargetLabel =
        isAssetController && !isAssignedUser ? 'Asset Owner' : 'Asset Controller';
    const forwardButtonText = `Forward to ${forwardTargetLabel}`;
    const assigneeName =
        primaryAsset?.assignedTo?.firstName ||
        primaryAsset?.assignedTo?.name ||
        'Unknown';

    const useCollapsedBulkPreview =
        transferMode === 'bulk' &&
        selectedAssetObjects.length >= ASSET_BULK_MORE_THRESHOLD;

    const bulkAccent = actionOption === 'Leave' ? 'amber' : 'rose';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">

                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Transfer Asset to Store</h2>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Current Assignee:{' '}
                                <span className="text-indigo-600 font-bold">{assigneeName}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">

                    {!hideModeToggle && (
                        <div className="flex p-1 bg-slate-100/80 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => {
                                    setTransferMode('individual');
                                    setSelectedAssetIds([primaryAsset._id]);
                                }}
                                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${transferMode === 'individual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Individual Transfer
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setTransferMode('bulk');
                                    if (hasPreset) {
                                        setSelectedAssetIds(allBulkAssetIds);
                                    } else if (asset?.assignedTo && otherAssets.length > 0) {
                                        setSelectedAssetIds([
                                            asset._id,
                                            ...otherAssets.map((a) => a._id),
                                        ]);
                                    } else {
                                        setSelectedAssetIds([primaryAsset._id]);
                                    }
                                }}
                                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${transferMode === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Bulk Transfer
                            </button>
                        </div>
                    )}

                    {transferMode === 'individual' && (
                        <div className="bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                                <Package size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">{primaryAsset?.name}</p>
                                <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">
                                    {primaryAsset?.assetId}
                                </p>
                            </div>
                        </div>
                    )}

                    {transferMode === 'bulk' && (
                        <div className="space-y-3 pt-2">
                            {useCollapsedBulkPreview ? (
                                <>
                                    <AssetBulkListPreview
                                        assets={selectedAssetObjects}
                                        title="Assets in this request"
                                        accent={bulkAccent}
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
                                                    <ListChecks size={14} /> Other Assigned Assets
                                                </label>
                                                {!loadingAssets &&
                                                    (otherAssets.length > 0 || primaryAsset?._id) && (
                                                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
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
                                                    <>
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
                                                        {selectedAssetIds.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-slate-200 px-3 py-2 bg-indigo-50 rounded-lg">
                                                                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                                                                    {selectedAssetIds.length} asset
                                                                    {selectedAssetIds.length > 1
                                                                        ? 's'
                                                                        : ''}{' '}
                                                                    selected (including primary)
                                                                </p>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {hasPreset && selectedAssetObjects.length > 1 && (
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                            {selectedAssetObjects.slice(1).map((other) => (
                                                <div
                                                    key={other._id || other.assetId}
                                                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl"
                                                >
                                                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                                                        <Package size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-700 truncate">
                                                            {other.name}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-400 font-mono">
                                                            {other.assetId}
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
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                disabled={lockActionOption && actionOption !== 'Leave'}
                                onClick={() => setActionOption('Leave')}
                                className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${actionOption === 'Leave'
                                        ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm'
                                        : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                    } ${lockActionOption && actionOption !== 'Leave' ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <CalendarClock size={28} className="mb-2" />
                                <span className="text-[12px] font-bold uppercase tracking-wide">Leave</span>
                            </button>
                            <button
                                type="button"
                                disabled={
                                    lockActionOption && actionOption !== 'End of Services'
                                }
                                onClick={() => setActionOption('End of Services')}
                                className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${actionOption === 'End of Services'
                                        ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-sm'
                                        : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                    } ${lockActionOption && actionOption !== 'End of Services' ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <PackageX size={28} className="mb-2" />
                                <span className="text-[12px] font-bold uppercase tracking-wide">
                                    End of Services
                                </span>
                            </button>
                        </div>
                    </div>

                    {actionOption === 'Leave' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[11px] font-black text-amber-600 uppercase tracking-widest pl-1">
                                Duration (Days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={MAX_ASSET_LEAVE_DAYS}
                                placeholder={`e.g. 30 (Max ${MAX_ASSET_LEAVE_DAYS})`}
                                value={leaveDuration}
                                onChange={(e) => setLeaveDuration(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all placeholder:text-slate-300 placeholder:font-normal"
                            />
                        </div>
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
                            if (actionOption === 'Leave') {
                                const duration = parseInt(leaveDuration, 10);
                                if (
                                    !duration ||
                                    duration < 1 ||
                                    duration > MAX_ASSET_LEAVE_DAYS
                                ) {
                                    return toast({
                                        variant: 'destructive',
                                        title: 'Error',
                                        description: `Please specify a valid leave duration (between 1 and ${MAX_ASSET_LEAVE_DAYS} days)`,
                                    });
                                }
                            }
                            setConfirmTransfer(true);
                        }}
                        className={`flex-[2] flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-all ${actionOption === 'Leave'
                                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                                : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                            }`}
                    >
                        {forwardButtonText}
                    </button>
                </div>
            </div>

            <AlertDialog open={confirmTransfer} onOpenChange={setConfirmTransfer}>
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">
                            Confirm Action
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500 flex flex-col gap-2">
                            <span>
                                Request{' '}
                                <span className="font-bold text-gray-900">{actionOption}</span> for
                                <span className="font-bold text-gray-900">
                                    {' '}
                                    {transferMode === 'bulk'
                                        ? `${selectedAssetIds.length} asset(s)`
                                        : `"${primaryAsset?.name}"`}
                                </span>
                                ? This will notify the {forwardTargetLabel} to update the status to{' '}
                                {actionOption === 'Leave' ? '"On Leave"' : '"Unassigned"'}.
                            </span>
                            {actionOption === 'Leave' &&
                                leaveDuration &&
                                parseInt(leaveDuration, 10) > 0 &&
                                parseInt(leaveDuration, 10) <= MAX_ASSET_LEAVE_DAYS && (
                                    <span className="text-amber-600 font-medium">
                                        Your expiration will be{' '}
                                        {calculateBusinessExpiryMidnight(
                                            parseInt(leaveDuration, 10),
                                        ).toLocaleString()}
                                        .
                                    </span>
                                )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleTransfer();
                            }}
                            className={`${actionOption === 'Leave'
                                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                                    : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                                } text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg`}
                        >
                            {submitting ? 'Processing...' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
