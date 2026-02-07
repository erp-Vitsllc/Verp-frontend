'use client';

import { useState } from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddAssetItemModal({ isOpen, onClose, onSuccess, assetTypeId }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        photo: null // Will store base64 string or URL
    });
    const [photoPreview, setPhotoPreview] = useState(null);

    if (!isOpen) return null;

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photo: reader.result }));
                setPhotoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Name is required"
            });
            return;
        }

        setLoading(true);
        try {
            await axiosInstance.post('/AssetItem', {
                assetTypeId,
                name: formData.name,
                photo: formData.photo
            });

            toast({
                title: "Success",
                description: "Asset Item added successfully"
            });
            setFormData({
                name: '',
                photo: null
            });
            setPhotoPreview(null);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error adding asset item:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to add asset item"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">Add Asset Item</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Photo Upload */}
                    <div className="flex flex-col items-center">
                        <div className="relative w-24 h-24 mb-4">
                            {photoPreview ? (
                                <img
                                    src={photoPreview}
                                    alt="Preview"
                                    className="w-full h-full rounded-full object-cover border-2 border-gray-200"
                                />
                            ) : (
                                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                                    <Upload className="text-gray-400" size={24} />
                                </div>
                            )}
                            <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                                <Upload size={14} className="text-gray-600" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handlePhotoChange}
                                />
                            </label>
                        </div>
                        <p className="text-sm text-gray-500">
                            Upload Photo
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                            placeholder="e.g. MacBook Pro M3"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            disabled={loading}
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? 'Adding...' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
