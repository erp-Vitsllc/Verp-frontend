'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, Upload, Paperclip, ExternalLink } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRef } from 'react';

export default function AccessoriesModal({ isOpen, onClose, asset, onUpdate }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [accessories, setAccessories] = useState([]);
    const [newAccessory, setNewAccessory] = useState({ name: '', amount: '', attachment: null });
    const [showAddForm, setShowAddForm] = useState(false);
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

    const handleDeattach = async (index) => {
        if (!confirm('Are you sure you want to deattach this accessory?')) return;

        const updatedList = accessories.filter((_, i) => i !== index);
        await saveChanges(updatedList, 'Accessory deattached successfully');
    };

    const handleAdd = async () => {
        if (!newAccessory.name) return toast({ variant: "destructive", title: "Error", description: "Name is required" });

        setLoading(true);
        try {
            let attachmentUrl = null;
            if (newAccessory.attachment) {
                // Upload file first
                const uploadRes = await axiosInstance.post('/AssetType/upload', {
                    file: newAccessory.attachment.data,
                    fileName: newAccessory.attachment.name
                });
                attachmentUrl = uploadRes.data.publicId; // Store key
            }

            const updatedList = [...accessories, {
                name: newAccessory.name,
                amount: Number(newAccessory.amount) || 0,
                attachment: attachmentUrl
            }];

            await saveChanges(updatedList, 'Accessory added successfully');
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

    const saveChanges = async (newList, successMessage) => {
        setLoading(true);
        try {
            const response = await axiosInstance.put(`/AssetType/${asset._id}`, {
                accessories: newList
            });
            setAccessories(response.data.accessories || []);
            toast({ title: "Success", description: successMessage });
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update accessories:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update accessories" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Package className="text-blue-600" size={20} />
                        Accessories
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-700">Item List</h3>
                        {!showAddForm && (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
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
                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                    >
                                        <Upload size={14} className="text-gray-400 group-hover:text-blue-500" />
                                        <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600">Upload Attachment</span>
                                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleAdd}
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    {loading ? 'Adding...' : 'Add Item'}
                                </button>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {accessories.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                No accessories found attached to this asset.
                            </div>
                        ) : (
                            accessories.map((acc, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-blue-100 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="px-2 py-1.5 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-black text-[10px] min-w-[32px] border border-blue-100 shadow-sm">
                                            {acc.accessoryId || (index + 1)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{acc.name}</p>
                                            <div className="flex items-center gap-3">
                                                <p className="text-xs text-gray-500 font-medium">
                                                    Valued at <span className="text-gray-700">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(acc.amount || 0)}</span>
                                                </p>
                                                {acc.attachment && (
                                                    <a
                                                        href={acc.attachment}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                                    >
                                                        <ExternalLink size={10} /> View Attachment
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeattach(index)}
                                        disabled={loading}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Deattach Accessory"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
