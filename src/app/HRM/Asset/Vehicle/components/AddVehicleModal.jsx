'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddVehicleModal({ isOpen, onClose, onSuccess }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Dropdown Data
    const [categories, setCategories] = useState([]);
    const [types, setTypes] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    const [formData, setFormData] = useState({
        vehicleCode: '', // Vehicle No
        name: '',        // Model
        type: '',        // Dropdown
        modelYear: '',
        plateNumber: '',
        category: '',    // Required by backend
        assetValue: 0    // Default
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            fetchDropdownData();
        }
    }, [isOpen]);

    const fetchDropdownData = async () => {
        try {
            setDataLoading(true);
            const response = await axiosInstance.get('/AssetType');
            const data = response.data || [];

            // Filter Categories (assetId starts with 'asset-cat-')
            const cats = data.filter(item => item.assetId && item.assetId.toString().startsWith('asset-cat-'));

            // Filter Types (assetId starts with 'asset-type-')
            const allTypes = data.filter(item => item.assetId && item.assetId.toString().startsWith('asset-type-'));

            setCategories(cats);
            setTypes(allTypes);

            // Try to auto-select a 'Vehicle' or 'Fleet' category if distinct
            const defaultCat = cats.find(c => c.category?.toLowerCase().includes('vehicle') || c.category?.toLowerCase().includes('fleet'));
            if (defaultCat) {
                setFormData(prev => ({ ...prev, category: defaultCat.category }));
            }

        } catch (error) {
            console.error('Error fetching dropdown data', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load categories/types' });
        } finally {
            setDataLoading(false);
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.vehicleCode) newErrors.vehicleCode = 'Vehicle No is required';
        if (!formData.name) newErrors.name = 'Model is required';
        if (!formData.type) newErrors.type = 'Type is required';
        if (!formData.modelYear) newErrors.modelYear = 'Model Year is required';
        // Category validation removed from frontend check (will be auto-assigned)
        // if (!formData.category) newErrors.category = 'Category is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            setLoading(true);
            // Auto-assign category if not set
            let assignedCategory = formData.category;
            if (!assignedCategory && categories.length > 0) {
                const defaultCat = categories.find(c => c.category?.toLowerCase().includes('vehicle') || c.category?.toLowerCase().includes('fleet'));
                assignedCategory = defaultCat ? defaultCat.category : categories[0].category;
            }

            const payload = {
                mode: 'asset',
                category: assignedCategory || 'Vehicle',
                type: formData.type,
                name: formData.name, // Model
                vehicleCode: formData.vehicleCode,
                modelYear: formData.modelYear,
                plateNumber: formData.plateNumber,
                assetValue: formData.assetValue,
                quantity: 1
            };

            await axiosInstance.post('/AssetType', payload);

            toast({ title: 'Success', description: 'Vehicle added successfully' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Submission Error:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to add vehicle'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800">Add Vehicle</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

                    {/* Category Removed from UI */}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Vehicle No */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle No <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.vehicleCode}
                                onChange={(e) => setFormData({ ...formData, vehicleCode: e.target.value })}
                                placeholder="Ref/Code"
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.vehicleCode ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                            />
                            {errors.vehicleCode && <p className="text-xs text-red-500">{errors.vehicleCode}</p>}
                        </div>

                        {/* Plate No */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plate No</label>
                            <input
                                type="text"
                                value={formData.plateNumber}
                                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                                placeholder="Optional"
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Type */}
                        {/* Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type <span className="text-red-500">*</span></label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.type ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                            >
                                <option value="">Select Type</option>
                                <option value="Car">Car</option>
                                <option value="Van">Van</option>
                                <option value="Pickup">Pickup</option>
                            </select>
                            {errors.type && <p className="text-xs text-red-500">{errors.type}</p>}
                        </div>

                        {/* Model Year */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Model Year <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.modelYear}
                                onChange={(e) => setFormData({ ...formData, modelYear: e.target.value })}
                                placeholder="YYYY"
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.modelYear ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                            />
                            {errors.modelYear && <p className="text-xs text-red-500">{errors.modelYear}</p>}
                        </div>
                    </div>

                    {/* Model Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Model <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Toyota Corolla"
                            className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.name ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                        />
                        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                    </div>


                </form>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-white hover:shadow-sm transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 shadow-lg shadow-gray-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? 'Saving...' : 'Add Vehicle'}
                    </button>
                </div>
            </div>
        </div>
    );
}
