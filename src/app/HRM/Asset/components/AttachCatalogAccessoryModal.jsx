'use client';

import { useEffect, useState } from 'react';
import { X, Search, Package } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AttachCatalogAccessoryModal({ isOpen, onClose, accessory, onAttached }) {
    const { toast } = useToast();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submittingId, setSubmittingId] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const fetchAssets = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get('/AssetType');
                const items = Array.isArray(res.data) ? res.data : [];
                const candidates = items.filter((item) =>
                    item?.assetId &&
                    (item.assetId.startsWith('VEGA-ASSET-') || item.assetId.startsWith('A-ASSET-')) &&
                    item.status !== 'Draft'
                );
                setAssets(candidates);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load assets list' });
                setAssets([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAssets();
    }, [isOpen, toast]);

    if (!isOpen || !accessory) return null;

    const filtered = assets.filter((a) =>
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.assetId || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.category || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleAttach = async (targetAssetId, targetAssetName) => {
        const ok = window.confirm(`Send attach request for "${accessory.name}" to "${targetAssetName}"?`);
        if (!ok) return;
        setSubmittingId(targetAssetId);
        try {
            const response = await axiosInstance.put(`/AssetAccessoryCatalog/${accessory._id}/request-attach`, { targetAssetId });
            const approverName = response?.data?.approverName || 'approver';
            toast({
                title: 'Request Sent',
                description: `Sent to ${approverName} (email + dashboard) for "${targetAssetName}".`
            });
            onAttached?.();
            onClose();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.response?.data?.message || 'Attach request failed' });
        } finally {
            setSubmittingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b">
                    <h3 className="text-lg font-bold text-gray-900">Attach "{accessory.name}" to Asset</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search assets..."
                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <p className="text-sm text-gray-500 text-center py-10">Loading assets...</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-10">No assets found</p>
                    ) : filtered.map((row) => (
                        <button
                            key={row._id}
                            type="button"
                            disabled={submittingId === row._id}
                            onClick={() => handleAttach(row._id, row.name || row.assetId)}
                            className="w-full text-left p-3 border rounded-xl hover:border-blue-300 hover:bg-blue-50/40 transition-all"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-gray-50 border flex items-center justify-center text-gray-400">
                                        <Package size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{row.name || '-'}</p>
                                        <p className="text-[11px] text-gray-500 font-mono truncate">{row.assetId}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-bold uppercase">{row.status || 'Unknown'}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
