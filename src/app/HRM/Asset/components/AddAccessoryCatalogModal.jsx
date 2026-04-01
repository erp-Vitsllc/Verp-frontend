'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddAccessoryCatalogModal({ isOpen, onClose, onSuccess, initialData = null, useMockData = false, onCreateLocal = null }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        if (initialData) {
            setName(initialData.name || '');
            setPrice(initialData.price != null ? String(initialData.price) : '');
            setDescription(initialData.description || '');
        } else {
            setName('');
            setPrice('');
            setDescription('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Name is required' });
            return;
        }
        setLoading(true);
        try {
            const body = {
                name: name.trim(),
                price: price === '' ? 0 : Number(price),
                description: description.trim()
            };
            if (useMockData && !initialData?._id && typeof onCreateLocal === 'function') {
                onCreateLocal(body);
                toast({ title: 'Added', description: 'Accessory added to mock catalog' });
                onSuccess?.();
                onClose();
                return;
            }
            if (initialData?._id) {
                await axiosInstance.put(`/AssetAccessoryCatalog/${initialData._id}`, body);
                toast({ title: 'Saved', description: 'Accessory updated' });
            } else {
                await axiosInstance.post('/AssetAccessoryCatalog', body);
                toast({ title: 'Added', description: 'Accessory added to catalog' });
            }
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Request failed'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[22px] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {initialData ? 'Edit accessory' : 'Add accessory'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Accessory name"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="0"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                                placeholder="Optional description"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? 'Saving...' : 'OK'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
