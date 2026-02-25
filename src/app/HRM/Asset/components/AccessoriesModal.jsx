'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, Upload, Paperclip, ExternalLink, ArrowRightLeft, AlertCircle, Ban } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRef } from 'react';
import TransferAccessoryModal from './TransferAccessoryModal';
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
import AddLossDamageModal from '../../Fine/components/AddLossDamageModal';

export default function AccessoriesModal({ isOpen, onClose, asset, onUpdate }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [accessories, setAccessories] = useState([]);
    const [newAccessory, setNewAccessory] = useState({ name: '', amount: '', attachment: null });
    const [showAddForm, setShowAddForm] = useState(false);

    const [transferModal, setTransferModal] = useState({ isOpen: false, accessory: null });
    const [showLossDamageModal, setShowLossDamageModal] = useState(false);
    const [damageInitialData, setDamageInitialData] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (asset && asset.accessories) {
            setAccessories(asset.accessories);
        } else {
            setAccessories([]);
        }
        setNewAccessory({ name: '', amount: '', attachment: null });
        setShowAddForm(false);
    }, [asset, isOpen]);

    if (!isOpen || !asset) return null;



    const handleAdd = async () => {
        if (!newAccessory.name) return toast({ variant: "destructive", title: "Error", description: "Name is required" });

        setLoading(true);
        try {
            let attachmentUrl = null;
            if (newAccessory.attachment) {
                const uploadRes = await axiosInstance.post('/AssetType/upload', {
                    file: newAccessory.attachment.data,
                    fileName: newAccessory.attachment.name
                });
                attachmentUrl = uploadRes.data.publicId;
            }

            const response = await axiosInstance.put(`/AssetType/${asset._id}`, {
                accessories: [...accessories, {
                    name: newAccessory.name,
                    amount: Number(newAccessory.amount) || 0,
                    attachment: attachmentUrl
                }]
            });

            setAccessories(response.data.accessories || []);
            toast({ title: "Success", description: "Accessory added successfully" });
            if (onUpdate) onUpdate();
            setNewAccessory({ name: '', amount: '', attachment: null });
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add accessory:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to add accessory" });
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewAccessory({
                    ...newAccessory,
                    attachment: {
                        name: file.name,
                        data: reader.result
                    }
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 h-[600px] flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <Package className="text-blue-600" size={20} />
                            Accessories
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-700">Item List</h3>
                            {!showAddForm && (
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1 shadow-sm uppercase tracking-wider"
                                >
                                    <Plus size={14} /> Add Accessory
                                </button>
                            )}
                        </div>

                        {showAddForm && (
                            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Item Name</label>
                                    <input
                                        type="text"
                                        value={newAccessory.name || ''}
                                        onChange={(e) => setNewAccessory({ ...newAccessory, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="e.g. Wireless Mouse"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
                                    <input
                                        type="number"
                                        value={newAccessory.amount || ''}
                                        onChange={(e) => setNewAccessory({ ...newAccessory, amount: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Attachment (Optional)</label>
                                    {newAccessory.attachment ? (
                                        <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-lg">
                                            <span className="text-xs font-semibold text-blue-700 truncate max-w-[200px] flex items-center gap-1">
                                                <Paperclip size={12} /> {newAccessory.attachment.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setNewAccessory({ ...newAccessory, attachment: null })}
                                                className="text-blue-500 hover:text-blue-700 p-1"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-400 hover:bg-white transition-all group"
                                        >
                                            <Upload size={14} className="text-gray-400 group-hover:text-blue-500" />
                                            <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600">Upload Attachment</span>
                                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 pt-1 font-black uppercase text-[10px]">
                                    <button
                                        onClick={handleAdd}
                                        disabled={loading}
                                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        {loading ? 'Adding...' : 'Add Item'}
                                    </button>
                                    <button
                                        onClick={() => setShowAddForm(false)}
                                        className="px-4 py-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {accessories.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200 uppercase tracking-widest font-black opacity-50">
                                    No accessories found
                                </div>
                            ) : (
                                accessories.map((acc, index) => (
                                    <div key={index} className="flex flex-col p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-blue-100 transition-all group mb-2">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center shadow-sm group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
                                                    <Package size={20} className="text-slate-400 group-hover:text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{acc.name}</p>
                                                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 font-bold uppercase">
                                                        <span>{acc.accessoryId}</span>
                                                        <span className={`px-1.5 py-0.5 rounded-full ${acc.status === 'Attached' ? 'bg-emerald-50 text-emerald-600' :
                                                            acc.status === 'Transfered' ? 'bg-blue-50 text-blue-600' :
                                                                'bg-red-50 text-red-600'
                                                            }`}>
                                                            {acc.status || 'Attached'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-[12px] font-black text-slate-900 tracking-wide">
                                                    AED {new Intl.NumberFormat().format(acc.amount || 0)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                            <div className="flex items-center gap-2">
                                                {acc.attachment && (
                                                    <a
                                                        href={acc.attachment}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-white rounded-lg shadow-sm border border-slate-100 transition-all"
                                                        title="View Attachment"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>

                                            {acc.status === 'Attached' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setTransferModal({ isOpen: true, accessory: acc })}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[9px] font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-blue-100"
                                                    >
                                                        <ArrowRightLeft size={12} /> Transfer
                                                    </button>
                                                    <div className="flex items-center gap-1 border-l pl-2 border-slate-100">
                                                        <button
                                                            onClick={() => {
                                                                setDamageInitialData({
                                                                    assetId: asset?.assetId,
                                                                    assetName: asset?.name,
                                                                    employeeId: asset?.assignedTo?.employeeId || '',
                                                                    employeeName: asset?.assignedTo
                                                                        ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                                                        : '',
                                                                    description: `Loss/Damage of accessory: ${acc.name} (${acc.accessoryId})`
                                                                });
                                                                setShowLossDamageModal(true);
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-[8px] font-black uppercase"
                                                            title="Mark as Loss and Damage or EOL"
                                                        >
                                                            <AlertCircle size={12} /> Loss and Damage / EOL
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub Modals */}
            {transferModal.isOpen && (
                <TransferAccessoryModal
                    isOpen={transferModal.isOpen}
                    onClose={() => setTransferModal({ isOpen: false, accessory: null })}
                    accessory={transferModal.accessory}
                    sourceAsset={asset}
                    onTransfer={() => {
                        toast({ title: "Success", description: "Accessory transfered" });
                        if (onUpdate) onUpdate();
                        onClose();
                    }}
                />
            )}
            {showLossDamageModal && (
                <AddLossDamageModal
                    isOpen={showLossDamageModal}
                    onClose={() => setShowLossDamageModal(false)}
                    onBack={() => setShowLossDamageModal(false)}
                    onSuccess={() => {
                        setShowLossDamageModal(false);
                        if (onUpdate) onUpdate();
                    }}
                    initialData={damageInitialData}
                    employees={[]}
                />
            )}
        </>
    );
}
