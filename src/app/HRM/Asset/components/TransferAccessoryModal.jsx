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
            const response = await axiosInstance.get('/AssetType');
            // Filter only individual assets, exclude current source asset
            const onlyAssets = response.data.filter(item =>
                item.assetId &&
                item.assetId.startsWith('VEGA-ASSET-') &&
                item._id !== sourceAsset._id
            );
            setAssets(onlyAssets);
        } catch (error) {
            console.error('Failed to fetch assets for transfer:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        const { targetAssetId } = confirmTransfer;
        setSubmitting(true);
        try {
            await axiosInstance.put(`/AssetItem/${sourceAsset._id}/accessories/${accessory._id || accessory.accessoryId}/transfer`, {
                targetAssetId
            });
            toast({ title: "Success", description: "Accessory transfered successfully" });
            onTransfer();
            onClose();
        } catch (error) {
            console.error('Transfer failed:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to transfer accessory." });
        } finally {
            setSubmitting(false);
            setConfirmTransfer({ isOpen: false, targetAssetId: null, targetAssetName: '' });
        }
    };

    if (!isOpen) return null;

    const filteredAssets = assets.filter(a =>
        (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.assetId || '').toLowerCase().includes(searchQuery.toLowerCase())
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
                            placeholder="Search asset by ID or name..."
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
                            <p className="text-sm font-bold uppercase tracking-widest">No target assets found</p>
                        </div>
                    ) : (
                        filteredAssets.map(asset => (
                            <button
                                key={asset._id}
                                onClick={() => setConfirmTransfer({ isOpen: true, targetAssetId: asset._id, targetAssetName: asset.name })}
                                disabled={submitting}
                                className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all group text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{asset.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono font-bold text-slate-400">{asset.assetId}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${asset.status === 'Assigned' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {asset.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <ArrowRightLeft className="text-slate-300 group-hover:text-blue-600 transition-all" size={18} />
                            </button>
                        ))
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
                        <AlertDialogTitle className="text-xl font-bold">Confirm Transfer</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500">
                            Are you sure you want to transfer <span className="font-bold text-gray-900">"{accessory.name}"</span> to <span className="font-bold text-blue-600">"{confirmTransfer.targetAssetName}"</span>?
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
                            {submitting ? 'Transferring...' : 'Confirm Transfer'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
