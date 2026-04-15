'use client';

import { useState, useEffect } from 'react';
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

export default function TransferAssetModal({ isOpen, onClose, asset, onUpdate }) {
    const [transferMode, setTransferMode] = useState('individual'); // 'individual' or 'bulk'
    const [actionOption, setActionOption] = useState('Leave'); // 'Leave' or 'End of Services'
    const [leaveDuration, setLeaveDuration] = useState('');

    // Bulk transfer states
    const [otherAssets, setOtherAssets] = useState([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState(false);
    const { toast } = useToast();

    const calculateBusinessExpiryMidnight = (days) => {
        const start = new Date();
        const target = new Date(start);
        let remaining = Number(days);

        while (remaining > 0) {
            target.setDate(target.getDate() + 1);
            // Sunday (0) is excluded from the count
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
        if (isOpen) {
            setTransferMode('individual');
            setActionOption('Leave');
            setLeaveDuration('');
            setSelectedAssetIds(asset ? [asset._id] : []);

            if (asset && asset.assignedTo) {
                fetchOtherAssets(asset.assignedTo._id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, asset]);

    // Auto-select all assets with same assignee when bulk mode is enabled
    useEffect(() => {
        if (transferMode === 'bulk' && asset && asset.assignedTo && otherAssets.length > 0) {
            // Auto-check all assets with the same assignee (including primary asset)
            const allAssetIds = [asset._id, ...otherAssets.map(a => a._id)];
            setSelectedAssetIds(allAssetIds);
        } else if (transferMode === 'individual') {
            // Reset to only primary asset when switching back to individual
            setSelectedAssetIds(asset ? [asset._id] : []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transferMode, otherAssets.length]);

    const fetchOtherAssets = async (employeeId) => {
        setLoadingAssets(true);
        try {
            const response = await axiosInstance.get('/AssetItem/assigned/all');
            const assignedAssets = Array.isArray(response.data) ? response.data : [];
            const employeeAssets = assignedAssets.filter(a =>
                a.assignedTo &&
                a.assignedTo._id === employeeId &&
                a.status === 'Assigned' &&
                a._id !== asset._id
            );
            setOtherAssets(employeeAssets);
        } catch (error) {
            console.error('Failed to fetch other assets:', error);
        } finally {
            setLoadingAssets(false);
        }
    };

    const handleTransfer = async () => {
        // For bulk mode, use all selected assets (including primary asset)
        // For individual mode, use only the primary asset
        const assetsToTransfer = transferMode === 'individual'
            ? [asset._id]
            : selectedAssetIds.length > 0 
                ? selectedAssetIds // Use all selected assets (already includes primary)
                : [asset._id]; // Fallback to primary asset if nothing selected

        if (assetsToTransfer.length === 0) {
            return toast({ variant: "destructive", title: "Error", description: "Please select at least one asset" });
        }

        setSubmitting(true);
        try {
            const reasonText = actionOption === 'Leave' ? `Leave duration: ${leaveDuration} days` : 'End of Services return requested';

            // If it's a bulk transfer (multiple assets), send ONE request
            if (assetsToTransfer.length > 1) {
                const payload = {
                    assetIds: assetsToTransfer,
                    actionType: actionOption,
                    reason: reasonText
                };
                if (actionOption === 'Leave') {
                    payload.duration = parseInt(leaveDuration);
                    payload.leaveDuration = parseInt(leaveDuration);
                }
                await axiosInstance.put(`/AssetItem/bulk/request-action`, payload);
            } else {
                // Individual request
                const id = assetsToTransfer[0];
                const payload = { actionType: actionOption, reason: reasonText };
                if (actionOption === 'Leave') {
                    payload.duration = parseInt(leaveDuration);
                    payload.leaveDuration = parseInt(leaveDuration);
                }
                await axiosInstance.put(`/AssetItem/${id}/request-action`, payload);
            }

            const msg = `${actionOption} request sent to Asset Controller for ${assetsToTransfer.length} asset${assetsToTransfer.length > 1 ? 's' : ''}.`;
            toast({ title: 'Success', description: msg });

            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error('Transfer request failed:', error);
            const errorMsg = error.response?.data?.message || 'Failed to submit request.';
            toast({ variant: 'destructive', title: 'Error', description: errorMsg });
        } finally {
            setSubmitting(false);
            setConfirmTransfer(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Transfer Asset to Store</h2>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Current Assignee: <span className="text-indigo-600 font-bold">{asset?.assignedTo?.firstName || 'Unknown'}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">

                    {/* Mode Toggle */}
                    <div className="flex p-1 bg-slate-100/80 rounded-2xl">
                        <button
                            onClick={() => { setTransferMode('individual'); setSelectedAssetIds([asset._id]); }}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${transferMode === 'individual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Individual Transfer
                        </button>
                        <button
                            onClick={() => {
                                setTransferMode('bulk');
                                // Auto-select all assets with same assignee when switching to bulk mode
                                // This will be handled by useEffect, but we can also set it here for immediate feedback
                                if (asset && asset.assignedTo) {
                                    if (otherAssets.length > 0) {
                                        const allAssetIds = [asset._id, ...otherAssets.map(a => a._id)];
                                        setSelectedAssetIds(allAssetIds);
                                    } else {
                                        // If assets haven't loaded yet, at least select the primary asset
                                        // The useEffect will update once otherAssets are loaded
                                        setSelectedAssetIds([asset._id]);
                                    }
                                }
                            }}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${transferMode === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Bulk Transfer
                        </button>
                    </div>

                    {/* Primary Asset Pinned Info */}
                    <div className="bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{asset?.name}</p>
                            <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">{asset?.assetId}</p>
                        </div>
                        {transferMode === 'bulk' && (
                            <div className="ml-auto px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-lg">
                                Primary
                            </div>
                        )}
                    </div>

                    {/* Bulk Selection List */}
                    {transferMode === 'bulk' && (
                        <div className="space-y-3 pt-2">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                                <ListChecks size={14} /> Other Assigned Assets
                            </label>

                            <div className="max-h-[160px] overflow-y-auto border rounded-2xl p-2 space-y-1 bg-slate-50/50">
                                {loadingAssets ? (
                                    <p className="text-xs text-center text-slate-400 py-4 font-bold uppercase">Loading assets...</p>
                                ) : otherAssets.length === 0 ? (
                                    <p className="text-xs text-center text-slate-400 py-4 font-bold uppercase">No other assets found</p>
                                ) : (
                                    <>
                                        {otherAssets.map(other => (
                                            <label key={other._id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 cursor-pointer transition-all">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 outline-none"
                                                    checked={selectedAssetIds.includes(other._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedAssetIds(prev => [...prev, other._id]);
                                                        } else {
                                                            setSelectedAssetIds(prev => prev.filter(id => id !== other._id));
                                                        }
                                                    }}
                                                />
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{other.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 font-mono">{other.assetId}</p>
                                                </div>
                                            </label>
                                        ))}
                                        {/* Summary showing total selected */}
                                        {selectedAssetIds.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-slate-200 px-3 py-2 bg-indigo-50 rounded-lg">
                                                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                                                    {selectedAssetIds.length} asset{selectedAssetIds.length > 1 ? 's' : ''} selected (including primary)
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="h-px bg-slate-100 w-full" />

                    {/* Options (Leave / End of Services) */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1">
                            Action Option
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setActionOption('Leave')}
                                className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${actionOption === 'Leave' ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                    }`}
                            >
                                <CalendarClock size={28} className="mb-2" />
                                <span className="text-[12px] font-bold uppercase tracking-wide">Leave</span>
                            </button>
                            <button
                                onClick={() => setActionOption('End of Services')}
                                className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${actionOption === 'End of Services' ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-sm' : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                    }`}
                            >
                                <PackageX size={28} className="mb-2" />
                                <span className="text-[12px] font-bold uppercase tracking-wide">End of Services</span>
                            </button>
                        </div>
                    </div>

                    {/* Duration Field (Only if Leave is selected) */}
                    {actionOption === 'Leave' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[11px] font-black text-amber-600 uppercase tracking-widest pl-1">
                                Duration (Days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                placeholder="e.g. 30 (Max 30)"
                                value={leaveDuration}
                                onChange={(e) => setLeaveDuration(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all placeholder:text-slate-300 placeholder:font-normal"
                            />
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (actionOption === 'Leave') {
                                const duration = parseInt(leaveDuration);
                                if (!duration || duration < 1 || duration > 30) {
                                    return toast({ variant: "destructive", title: "Error", description: "Please specify a valid leave duration (between 1 and 30 days)" });
                                }
                            }
                            setConfirmTransfer(true);
                        }}
                        className={`flex-[2] flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-all ${actionOption === 'Leave' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                            }`}
                    >
                        Forward to Asset Controller
                    </button>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <AlertDialog open={confirmTransfer} onOpenChange={setConfirmTransfer}>
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Confirm Action</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500 flex flex-col gap-2">
                            <span>
                                Request <span className="font-bold text-gray-900">{actionOption}</span> for
                                <span className="font-bold text-gray-900"> {transferMode === 'bulk' ? `${selectedAssetIds.length} asset(s)` : `"${asset?.name}"`}</span>?
                                This will notify the Asset Controller to update the status to {actionOption === 'Leave' ? '"On Leave"' : '"End of Services"'}.
                            </span>
                            {actionOption === 'Leave' && leaveDuration && parseInt(leaveDuration) > 0 && parseInt(leaveDuration) <= 30 && (
                                <span className="text-amber-600 font-medium">
                                    Your expiration will be {calculateBusinessExpiryMidnight(parseInt(leaveDuration)).toLocaleString()}.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleTransfer();
                            }}
                            className={`${actionOption === 'Leave' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'} text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg`}
                        >
                            {submitting ? 'Processing...' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
