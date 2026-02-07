'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Minus, Plus } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddAssetTypeModal({ isOpen, onClose, onSuccess, mode = 'type', preSelectedType = '', preSelectedCategory = '' }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // State for existing options (for dropdowns)
    const [existingTypes, setExistingTypes] = useState([]);
    const [existingCategories, setExistingCategories] = useState([]);

    // File state
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [warrantyFile, setWarrantyFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [accessories, setAccessories] = useState([{ name: '', amount: '' }]);

    const handleAddAccessory = () => {
        setAccessories([...accessories, { name: '', amount: '' }]);
    };

    const handleRemoveAccessory = (index) => {
        setAccessories(accessories.filter((_, i) => i !== index));
    };

    const handleAccessoryChange = (index, field, value) => {
        const newAcc = [...accessories];
        newAcc[index][field] = value;
        setAccessories(newAcc);
    };


    const [formData, setFormData] = useState({
        assetId: '',
        name: '',
        type: '',
        category: '',
        total: 0,
        assigned: 0,
        unassigned: 0,
        assetValue: '',
        purchaseDate: '',
        quantity: 1,
        invoiceNumber: '',
        hasWarranty: 'no',
        warrantyYears: '',
        warranty: ''
    });

    // Fetch existing types/categories when modal opens
    // Fetch existing types/categories and reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                assetId: '',
                name: '',
                type: preSelectedType || '',
                category: preSelectedCategory || '',
                total: 0,
                assigned: 0,
                unassigned: 0,
                assetValue: '',
                purchaseDate: '',
                quantity: 1,
                invoiceNumber: '',
                hasWarranty: 'no',
                warrantyYears: '',
                warranty: ''
            });

            setInvoiceFile(null);
            setImagePreview(null);
            setAccessories([{ name: '', amount: '' }]);

            const fetchOptions = async () => {
                try {
                    const response = await axiosInstance.get('/AssetType');
                    // Extract unique types and categories
                    // Extract unique types
                    const types = [...new Set(response.data.filter(item => item.assetId?.startsWith('asset-type-')).map(item => item.type).filter(Boolean))];

                    // Store full category objects to allow filtering by type
                    const categories = response.data.filter(item => item.assetId?.startsWith('asset-cat-'));

                    setExistingTypes(types);
                    setExistingCategories(categories);

                    // If we have a preSelectedCategory, try to find its parent type
                    if (preSelectedCategory) {
                        const matchedCat = response.data.find(item => item.category === preSelectedCategory && item.assetId?.startsWith('asset-cat-'));
                        if (matchedCat && matchedCat.type) {
                            setFormData(prev => ({ ...prev, type: matchedCat.type }));
                        }
                    }

                } catch (error) {
                    console.error("Failed to fetch options", error);
                }
            };
            fetchOptions();
        }
    }, [isOpen, mode, preSelectedType, preSelectedCategory]);

    // Auto-calculate unassigned when total or assigned changes (only for non-asset modes)
    useEffect(() => {
        if (mode === 'default') return; // Skip for asset mode
        const total = Number(formData.total) || 0;
        const assigned = Number(formData.assigned) || 0;
        setFormData(prev => ({
            ...prev,
            unassigned: Math.max(0, total - assigned)
        }));
    }, [formData.total, formData.assigned, mode]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic Validation
        if (mode === 'type') {
            if (!formData.type) {
                toast({ variant: "destructive", title: "Error", description: "Type is required" });
                return;
            }
        } else if (mode === 'category') {
            if (!formData.category) {
                toast({ variant: "destructive", title: "Error", description: "Category name is required" });
                return;
            }
            if (!formData.type) {
                toast({ variant: "destructive", title: "Error", description: "Parent Type is required for categories" });
                return;
            }
        } else {
            // Asset Mode
            if (!formData.type) {
                toast({ variant: "destructive", title: "Error", description: "Type is required" });
                return;
            }
            if (!formData.category) {
                toast({ variant: "destructive", title: "Error", description: "Category is required for assets" });
                return;
            }
        }

        if (isAssetMode) {
            if (!formData.name) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Asset Name is required"
                });
                return;
            }
            if (!formData.assetValue) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Value is required"
                });
                return;
            }
            if (formData.hasWarranty === 'yes' && !formData.warrantyYears) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Year of Warranty is required when Yes is selected"
                });
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                name: formData.name,
                type: formData.type,
                category: formData.category,
                purchaseDate: formData.purchaseDate,
                quantity: formData.quantity,
                warrantyYears: formData.warrantyYears,
                invoiceNumber: formData.invoiceNumber,
                mode
            };

            // Conditional payload based on mode
            if (isAssetMode) {
                // Add Asset Mode Fields
                payload.assetValue = formData.assetValue;
                payload.warranty = formData.hasWarranty === 'yes' ? formData.warranty : 'No Warranty';
                payload.total = 1;
                payload.assigned = 0;
                payload.unassigned = 1;

                // Filter empties
                payload.accessories = accessories.filter(a => a.name.trim() !== '');

                // Helper to convert to base64
                const toBase64 = file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });

                if (invoiceFile) {
                    try {
                        const base64 = await toBase64(invoiceFile);
                        const uploadRes = await axiosInstance.post('/AssetType/upload', {
                            file: base64,
                            fileName: invoiceFile.name
                        });

                        payload.invoiceFile = uploadRes.data.publicId;
                    } catch (err) {
                        console.error('Invoice upload failed:', err);
                        toast({ variant: "destructive", title: "Error", description: "Failed to upload invoice" });
                        setLoading(false);
                        return;
                    }
                }

                if (warrantyFile) {
                    try {
                        const base64 = await toBase64(warrantyFile);
                        const uploadRes = await axiosInstance.post('/AssetType/upload', {
                            file: base64,
                            fileName: warrantyFile.name
                        });

                        payload.warrantyAttachment = uploadRes.data.publicId;
                    } catch (err) {
                        console.error('Warranty upload failed:', err);
                        toast({ variant: "destructive", title: "Error", description: "Failed to upload warranty attachment" });
                        setLoading(false);
                        return;
                    }
                }
            } else {
                // Asset Type / Category Mode Fields
                payload.total = formData.total;
                payload.assigned = formData.assigned;
                payload.unassigned = formData.unassigned;
            }

            // Always add image if available
            if (imagePreview) {
                payload.imagePreview = imagePreview;
            }

            await axiosInstance.post('/AssetType', payload);

            toast({
                title: "Success",
                description: "Added successfully"
            });

            // Reset Form (simpler reset)
            setFormData({
                assetId: '',
                name: '',
                type: '',
                category: '',
                total: 0,
                assigned: 0,
                unassigned: 0,
                assetValue: '',
                invoiceNumber: '',
                hasWarranty: 'no',
                warrantyYears: '',
                warranty: ''
            });
            setInvoiceFile(null);
            setWarrantyFile(null);
            setImagePreview(null);
            setAccessories([{ name: '', amount: '' }]);

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error adding asset:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to add"
            });
        } finally {
            setLoading(false);
        }
    };

    const isAssetMode = mode === 'asset' || mode === 'default';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[22px] shadow-xl w-full max-w-[750px] max-h-[75vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {mode === 'category' ? 'Add Category' : isAssetMode ? 'Add Asset' : 'Add Asset Type'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto modal-scroll p-6">
                    <div className="space-y-4">
                        {/* Common Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Type <span className="text-red-500">*</span>
                                </label>
                                {isAssetMode || mode === 'category' ? (
                                    <select
                                        value={formData.type || ''}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    >
                                        <option value="">Select Type</option>
                                        {existingTypes.map((t, i) => (
                                            <option key={i} value={t}>{t}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData.type || ''}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                        placeholder="Enter the Type"
                                    />
                                )}
                            </div>

                            {/* Category selection for Asset Mode */}
                            {isAssetMode && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.category || ''}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                    >
                                        <option value="">Select Category</option>
                                        {existingCategories
                                            .filter(cat => !formData.type || (cat.type === formData.type) || (cat.typeId?.name === formData.type))
                                            .map((cat) => (
                                                <option key={cat._id} value={cat.category}>
                                                    {cat.category}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Category Name Input only for category mode */}
                        {mode === 'category' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.category || ''}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                    placeholder="Enter Category Name"
                                />
                            </div>
                        )}

                        {isAssetMode && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Asset Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                    placeholder="Enter the Asset Name"
                                />
                            </div>
                        )}

                        {isAssetMode && (
                            /* Add Asset Specific Fields */
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Value <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.assetValue || ''}
                                        onChange={(e) => setFormData({ ...formData, assetValue: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        placeholder="Enter the Value"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Purchase Date
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.purchaseDate || ''}
                                            onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Quantity
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.quantity || 1}
                                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            placeholder="Enter Quantity"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Warranty <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-4 mb-3">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="hasWarranty"
                                                value="yes"
                                                checked={formData.hasWarranty === 'yes'}
                                                onChange={(e) => setFormData({ ...formData, hasWarranty: e.target.value })}
                                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Yes</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="hasWarranty"
                                                value="no"
                                                checked={formData.hasWarranty === 'no'}
                                                onChange={(e) => setFormData({ ...formData, hasWarranty: e.target.value })}
                                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">No</span>
                                        </label>
                                    </div>

                                    {formData.hasWarranty === 'yes' && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Year of Warranty
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.warrantyYears || ''}
                                                    onChange={(e) => setFormData({ ...formData, warrantyYears: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                                    placeholder="Enter Years"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Attachment
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="file"
                                                            id="warranty-upload"
                                                            className="hidden"
                                                            onChange={(e) => setWarrantyFile(e.target.files?.[0] || null)}
                                                        />
                                                        <label
                                                            htmlFor="warranty-upload"
                                                            className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm"
                                                        >
                                                            <span className="text-gray-500 truncate max-w-[150px]">
                                                                {warrantyFile ? warrantyFile.name : 'Choose File'}
                                                            </span>
                                                            <Plus size={14} className="text-gray-400" />
                                                        </label>
                                                    </div>
                                                    {warrantyFile && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setWarrantyFile(null)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Accessories Section */}
                                <div className="md:col-span-2 space-y-3">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Accessories
                                    </label>
                                    {accessories.map((acc, index) => (
                                        <div key={index} className="flex gap-4 items-start">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={acc.name || ''}
                                                    onChange={(e) => handleAccessoryChange(index, 'name', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                                    placeholder="Item Name"
                                                />
                                            </div>
                                            <div className="w-1/3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={acc.amount || ''}
                                                    onChange={(e) => handleAccessoryChange(index, 'amount', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                                    placeholder="Amount"
                                                />
                                            </div>
                                            {accessories.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAccessory(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                                                >
                                                    <X size={18} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleAddAccessory}
                                        className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2"
                                    >
                                        <Plus size={16} /> Add Accessory
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.invoiceNumber || ''}
                                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                        placeholder="Enter the Invoice Number"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Upload
                                    </label>
                                    <div className="flex items-center justify-center w-full">
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                {invoiceFile ? (
                                                    <>
                                                        <p className="mb-2 text-sm text-green-600 font-medium">{invoiceFile.name}</p>
                                                        <p className="text-xs text-gray-500">Click to change</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                                        </svg>
                                                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload invoice</span></p>
                                                        <p className="text-xs text-gray-500">PDF, JPG, PNG (MAX. 5MB)</p>
                                                    </>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </>
                        )}



                    </div>
                </form>

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
                        onClick={handleSubmit}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {loading ? 'Adding...' : (isAssetMode ? 'Add' : 'Add')}
                    </button>
                </div>
            </div >
        </div >
    );
}
