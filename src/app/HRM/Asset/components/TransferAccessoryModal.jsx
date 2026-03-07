'use client';

import { useState, useEffect } from 'react';
import { X, Search, Package, ArrowRightLeft } from 'lucide-react';
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

export default function TransferAccessoryModal({ isOpen, onClose, accessory, sourceAsset, onTransfer }) {
    const [assets, setAssets] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState({ isOpen: false, targetAssetId: null, targetAssetName: '' });
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            fetchAssets();
        }
    }, [isOpen]);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            // Use the primary "Management" endpoint used in the main Asset page
            // to ensure we show "all in the tool" as requested
            const response = await axiosInstance.get('/AssetType');
            const allItems = Array.isArray(response.data) ? response.data : [];

            // Filter for actual asset items, exclude current asset, and exclude Draft status
            const availableAssets = allItems.filter(item =>
                item.assetId &&
                (item.assetId.startsWith('VEGA-ASSET-') || item.assetId.startsWith('ASSET-')) &&
                item._id !== sourceAsset._id &&
                item.status !== 'Draft' &&
                item.status === 'Assigned'
            );

            console.log('Available assets for transfer:', availableAssets.length);
            setAssets(availableAssets);
        } catch (error) {
            console.error('Failed to fetch assets for transfer:', error);
            // Fallback: try specialized endpoints if primary fails
            try {
                const response = await axiosInstance.get('/AssetItem/assigned/all');
                const availableAssets = (response.data || []).filter(item =>
                    item.assetId &&
                    item._id !== sourceAsset._id &&
                    item.status !== 'Draft' &&
                    item.status === 'Assigned'
                );
                setAssets(availableAssets);
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                setAssets([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const getEligibility = (targetAsset) => {
        if (targetAsset.status !== 'Assigned') {
            return { eligible: false, reason: "Transfers can only be made to assets currently in 'Assigned' status." };
        }
        if (targetAsset.status === 'Out of Service') {
            return { eligible: false, reason: "Target asset is currently 'Out of Service'." };
        }
        if (targetAsset.acceptanceStatus === 'Pending') {
            return { eligible: false, reason: "Target asset has a pending assignment/approval." };
        }
        return { eligible: true };
    };

    const handleTransfer = async () => {
        const { targetAssetId, targetAssetName } = confirmTransfer;
        setSubmitting(true);
        try {
            // Use the request-action workflow for accessory transfer approval
            await axiosInstance.put(
                `/AssetItem/${sourceAsset._id}/accessories/${accessory._id || accessory.accessoryId}/request-action`,
                {
                    actionType: 'Transfer',
                    targetAssetId,
                    reason: `Transfer to asset: ${targetAssetName}`
                }
            );
            toast({ title: 'Transfer Request Sent', description: `Transfer request for "${accessory.name}" sent to reportee for approval.` });
            onTransfer();
            onClose();
        } catch (error) {
            console.error('Transfer request failed:', error);
            toast({ variant: 'destructive', title: 'Error', description: error.response?.data?.message || 'Failed to submit transfer request.' });
        } finally {
            setSubmitting(false);
            setConfirmTransfer({ isOpen: false, targetAssetId: null, targetAssetName: '' });
        }
    };

    if (!isOpen) return null;

    const filteredAssets = assets.filter(a =>
        (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.assetId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.typeId?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.categoryId?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl h-[80vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Transfer Accessory</h2>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Select destination asset for <span className="text-blue-600 font-bold">{accessory.name}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search assets by ID, name, or category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-xs font-bold uppercase tracking-wider">Loading Assets...</p>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="text-center py-20 text-slate-300">
                            <Package size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-sm font-bold uppercase tracking-widest">No destination assets found</p>
                            <p className="text-xs text-slate-400 mt-2">Only non-Draft assets can receive transfers</p>
                        </div>
                    ) : (
                        filteredAssets.map(asset => {
                            const { eligible, reason } = getEligibility(asset);
                            return (
                                <button
                                    key={asset._id}
                                    onClick={() => {
                                        if (eligible) {
                                            setConfirmTransfer({ isOpen: true, targetAssetId: asset._id, targetAssetName: asset.name });
                                        } else {
                                            toast({
                                                variant: "destructive",
                                                title: "Asset Not Eligible",
                                                description: reason
                                            });
                                        }
                                    }}
                                    disabled={submitting}
                                    className={`w-full flex items-center justify-between p-4 bg-white border rounded-2xl transition-all group text-left ${!eligible
                                        ? 'border-slate-50 opacity-60 cursor-not-allowed bg-slate-50/50'
                                        : 'border-slate-100 hover:border-blue-200 hover:shadow-md'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${!eligible
                                            ? 'bg-slate-100 border-slate-200 text-slate-300'
                                            : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                                            }`}>
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${!eligible ? 'text-slate-500' : 'text-slate-800'}`}>{asset.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-mono font-bold text-slate-400">{asset.assetId}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${!eligible ? 'bg-slate-200/50 text-slate-400' : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                    {asset.typeId?.name || asset.categoryId?.name || 'Asset'}
                                                </span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${asset.status === 'Assigned' ? 'bg-emerald-50 text-emerald-600' :
                                                    asset.status === 'Unassigned' ? 'bg-slate-100 text-slate-500' :
                                                        'bg-amber-50 text-amber-600'
                                                    }`}>
                                                    {asset.status}
                                                </span>
                                            </div>
                                            {asset.assignedTo && (
                                                <p className="text-[9px] text-slate-400 mt-1">
                                                    Assigned: {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRightLeft className={`${!eligible ? 'text-slate-200' : 'text-slate-300 group-hover:text-blue-600'} transition-all`} size={18} />
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Transfer Confirmation */}
            <AlertDialog
                open={confirmTransfer.isOpen}
                onOpenChange={(open) => !open && setConfirmTransfer({ ...confirmTransfer, isOpen: false })}
            >
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Request Transfer</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500">
                            Are you sure you want to request transfer of <span className="font-bold text-gray-900">"{accessory.name}"</span> to <span className="font-bold text-blue-600">"{confirmTransfer.targetAssetName}"</span>?
                            This request will be sent to the reportee for approval.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleTransfer();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-blue-100"
                        >
                            {submitting ? 'Requesting...' : 'Request Transfer'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
