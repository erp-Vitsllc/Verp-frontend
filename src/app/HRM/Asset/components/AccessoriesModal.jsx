'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, Upload, Paperclip, ExternalLink, ArrowRightLeft, AlertCircle, Ban, FileText, Loader2 } from 'lucide-react';
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
    const [actionRequest, setActionRequest] = useState({ isOpen: false, type: '', reason: '', attachment: null, attachmentName: '', accId: null });

    const fileInputRef = useRef(null);
    const actionFileRef = useRef(null);

    const handleFileUpload = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = async () => {
            try {
                await axiosInstance.put(`/AssetItem/${asset._id}/accessories-attachment`, { attachment: reader.result });
                toast({ title: 'Success', description: 'Tab attachment uploaded successfully.' });
                if (onUpdate) onUpdate();
            } catch (err) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload attachment.' });
            }
        };
    };

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

                    {/* --- Action Request Overlay --- */}
                    {actionRequest.isOpen && (
                        <div className="absolute inset-0 z-[70] bg-white/95 backdrop-blur-sm rounded-[24px] p-8 flex flex-col animate-in fade-in duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-800">Request {actionRequest.type}</h3>
                                <button onClick={() => setActionRequest({ ...actionRequest, isOpen: false })} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>

                            <div className="space-y-6 overflow-y-auto pr-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Reason for Request <span className="text-rose-500">*</span></label>
                                    <textarea
                                        value={actionRequest.reason}
                                        onChange={(e) => setActionRequest({ ...actionRequest, reason: e.target.value })}
                                        placeholder={`Please explain why you are requesting ${actionRequest.type}...`}
                                        className="w-full min-h-[120px] p-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none text-slate-700 font-medium"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Supporting Attachment (Optional)</label>
                                    <div
                                        onClick={() => actionFileRef.current?.click()}
                                        className="w-full p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer flex flex-col items-center gap-2 group"
                                    >
                                        <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                                            <Upload size={24} className="text-slate-400 group-hover:text-blue-500" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-500 group-hover:text-blue-600 truncate max-w-full px-4">
                                            {actionRequest.attachmentName || 'Click to upload document/image'}
                                        </span>
                                        <input
                                            type="file"
                                            ref={actionFileRef}
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (re) => {
                                                        setActionRequest({
                                                            ...actionRequest,
                                                            attachment: re.target.result,
                                                            attachmentName: file.name
                                                        });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => setActionRequest({ ...actionRequest, isOpen: false })}
                                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={loading || !actionRequest.reason.trim()}
                                    onClick={async () => {
                                        try {
                                            setLoading(true);
                                            const url = actionRequest.accId
                                                ? `/AssetItem/${asset._id}/accessories/${actionRequest.accId}/request-action`
                                                : `/AssetItem/${asset._id}/request-action`;

                                            await axiosInstance.put(url, {
                                                actionType: actionRequest.type,
                                                reason: actionRequest.reason,
                                                attachment: actionRequest.attachment
                                            });
                                            toast({ title: "Request Sent", description: `${actionRequest.type} request sent for approval.` });
                                            setActionRequest({ isOpen: false, type: '', reason: '', attachment: null, attachmentName: '', accId: null });
                                            if (onUpdate) onUpdate();
                                        } catch (err) {
                                            toast({ variant: 'destructive', title: "Error", description: err.response?.data?.message || "Failed to send request" });
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    className="flex-[2] bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading && <Loader2 size={18} className="animate-spin" />}
                                    {loading ? 'Sending Request...' : 'Send Request'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide text-black">
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

                        <div className="space-y-3 mb-8">
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

                                            {acc.status === 'Attached' && asset.status !== 'Out of Service' && asset.status !== 'Pending' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setTransferModal({ isOpen: true, accessory: acc })}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[9px] font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-blue-100"
                                                    >
                                                        <ArrowRightLeft size={12} /> Transfer
                                                    </button>
                                                    <div className="flex items-center gap-1 border-l pl-2 border-slate-100">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActionRequest({
                                                                    isOpen: true,
                                                                    type: 'Loss and Damage',
                                                                    reason: '',
                                                                    attachment: null,
                                                                    attachmentName: '',
                                                                    accId: acc._id || acc.accessoryId
                                                                });
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-[8px] font-black uppercase"
                                                            title="Mark Asset as Loss and Damage"
                                                        >
                                                            <AlertCircle size={12} /> Loss and Damage
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActionRequest({
                                                                    isOpen: true,
                                                                    type: 'End of Life',
                                                                    reason: '',
                                                                    attachment: null,
                                                                    attachmentName: '',
                                                                    accId: acc._id || acc.accessoryId
                                                                });
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all text-[8px] font-black uppercase"
                                                            title="Mark Asset as End of Life"
                                                        >
                                                            <Ban size={12} /> End of Life
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* General Tab Attachment Section */}
                        <div className="pt-6 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 uppercase tracking-wider">
                                    <Paperclip size={16} className="text-blue-500" />
                                    Accessories Documents
                                </h3>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[10px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 uppercase"
                                >
                                    <Upload size={12} /> Upload Tab Attachment
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {asset.accessoriesAttachment && (
                                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100 hover:bg-white transition-all shadow-sm col-span-2">
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText size={14} className="text-blue-600 shrink-0" />
                                            <span className="text-[11px] font-bold text-blue-700 truncate uppercase">General Accessories Doc</span>
                                        </div>
                                        <a href={asset.accessoriesAttachment} target="_blank" rel="noopener" className="text-blue-600">
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                )}
                                {asset.accessories?.some(a => a.attachment) ? (
                                    asset.accessories.filter(a => a.attachment).map((a, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-all shadow-sm">
                                            <div className="flex items-center gap-2 truncate">
                                                <FileText size={14} className="text-slate-400 shrink-0" />
                                                <span className="text-[11px] font-bold text-slate-600 truncate uppercase">{a.name} Doc</span>
                                            </div>
                                            <a href={a.attachment} target="_blank" rel="noopener" className="text-slate-400">
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    ))
                                ) : (
                                    !asset.accessoriesAttachment && <p className="col-span-2 text-[10px] text-gray-400 font-bold uppercase text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">No document attached</p>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg"
                            />
                        </div>
                    </div>
                </div>
            </div >

            {/* Sub Modals */}
            {
                transferModal.isOpen && (
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
                )
            }
            {
                showLossDamageModal && (
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
                )
            }
        </>
    );
}
