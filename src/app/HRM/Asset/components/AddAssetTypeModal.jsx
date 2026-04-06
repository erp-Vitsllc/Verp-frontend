'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Minus, Plus, RotateCw } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { DatePicker } from '@/components/ui/date-picker';
import AvatarEditor from 'react-avatar-editor';

export default function AddAssetTypeModal({
    isOpen,
    onClose,
    onSuccess,
    mode = 'type',
    preSelectedType = '',
    preSelectedCategory = '',
    initialData = null,
    canEditAssetValue = true,
    /** From GET /AssetType/meta/role — server is authoritative */
    roleMeta = { isAdmin: false, isAssetController: false }
}) {
    const { toast } = useToast();
    /** Which action is running — only that button shows a spinner (null = idle). */
    const [loadingAction, setLoadingAction] = useState(null);
    const isBusy = loadingAction !== null;

    useEffect(() => {
        if (!isOpen) setLoadingAction(null);
    }, [isOpen]);

    // State for existing options (for dropdowns)
    const [existingTypes, setExistingTypes] = useState([]);
    const [existingCategories, setExistingCategories] = useState([]);

    // File state
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [warrantyFile, setWarrantyFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [showCropper, setShowCropper] = useState(false);
    const [imageScale, setImageScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const avatarEditorRef = useRef(null);
    const [accessories, setAccessories] = useState([{ name: '', description: '', price: '' }]);

    const handleAddAccessory = () => {
        setAccessories([...accessories, { name: '', description: '', price: '' }]);
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
            if (initialData) {
                setFormData({
                    assetId: initialData.assetId || '',
                    name: initialData.name || '',
                    type: initialData.type || initialData.typeId?.name || '',
                    category: initialData.category || initialData.categoryId?.name || '',
                    total: initialData.total || 0,
                    assigned: initialData.assigned || 0,
                    unassigned: initialData.unassigned || 0,
                    assetValue: initialData.assetValue || '',
                    purchaseDate: initialData.purchaseDate ? new Date(initialData.purchaseDate).toISOString().split('T')[0] : '',
                    quantity: initialData.quantity || 1,
                    invoiceNumber: initialData.invoiceNumber || '',
                    hasWarranty: initialData.warrantyYears ? 'yes' : 'no',
                    warrantyYears: initialData.warrantyYears || '',
                    warranty: initialData.warranty || ''
                });

                setInvoiceFile(null);
                setWarrantyFile(null);
                setImagePreview(initialData.photo || initialData.imagePreview || initialData.assetPhoto || null);
                setSelectedImage(null);
                setRotation(0);
                if (initialData.accessories && initialData.accessories.length > 0) {
                    setAccessories(
                        initialData.accessories.map((a) => ({
                            _id: a._id,
                            accessoryId: a.accessoryId,
                            name: a.name || '',
                            description: a.description || '',
                            price: a.amount ?? '',
                            status: a.status,
                            pendingAction: a.pendingAction,
                            pendingActionDetails: a.pendingActionDetails,
                            attachment: a.attachment
                        }))
                    );
                } else {
                    setAccessories([{ name: '', description: '', price: '' }]);
                }
            } else {
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
                setSelectedImage(null);
                setRotation(0);
                setAccessories([{ name: '', description: '', price: '' }]);
            }

            const fetchOptions = async () => {
                try {
                    const response = await axiosInstance.get('/AssetType');
                    // Extract full type objects instead of just names
                    const types = response.data.filter(item => item.assetId?.startsWith('asset-type-'));

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

    // Auto-update image preview based on selected type (only if user hasn't uploaded one)
    useEffect(() => {
        if ((mode === 'category' || mode === 'asset' || mode === 'default') && formData.type && !selectedImage) {
            const selectedTypeObj = existingTypes.find(t => t.type === formData.type);
            if (selectedTypeObj && selectedTypeObj.imagePreview) {
                setImagePreview(selectedTypeObj.imagePreview);
            }
        }
    }, [formData.type, mode, existingTypes, selectedImage]);

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

    const isAssetMode = mode === 'asset' || mode === 'default';
    const isPrivilegedAssetCreator = !!(roleMeta?.isAdmin || roleMeta?.isAssetController);
    // Non–Admin/AC: Save Draft + Submit for Approval only.
    const showDraftVsSubmitButtons = isAssetMode && !initialData && !isPrivilegedAssetCreator;
    // Admin / Asset Controller (new asset): Draft or Add Asset (Unassigned pool). No submit-for-approval step in UI.
    const showPrivilegedNewAssetButtons = isAssetMode && !initialData && isPrivilegedAssetCreator;

    const handleSubmit = async (e, creationIntent) => {
        if (e?.preventDefault) e.preventDefault();

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

        if ((mode === 'type' || mode === 'category') && !initialData?._id && !roleMeta.isAdmin) {
            toast({
                variant: 'destructive',
                title: 'Not allowed',
                description: 'Only administrators can create asset types and categories.'
            });
            return;
        }
        if (
            (mode === 'type' || mode === 'category') &&
            initialData?._id &&
            !roleMeta.isAssetController &&
            !roleMeta.isAdmin
        ) {
            toast({
                variant: 'destructive',
                title: 'Not allowed',
                description: 'Only administrators and Asset Controller can edit asset types and categories (including images).'
            });
            return;
        }

        if (showDraftVsSubmitButtons && !creationIntent) {
            toast({
                variant: 'destructive',
                title: 'Choose an action',
                description: 'Use Save Draft or Submit for Approval.'
            });
            return;
        }

        if (
            showPrivilegedNewAssetButtons &&
            creationIntent &&
            !['saveDraft', 'createUnassigned'].includes(creationIntent)
        ) {
            toast({
                variant: 'destructive',
                title: 'Invalid action',
                description: 'Use Draft or Add Asset.'
            });
            return;
        }

        let actionKey = 'save';
        if (creationIntent === 'saveDraft') actionKey = 'saveDraft';
        else if (creationIntent === 'submitForApproval') actionKey = 'submitForApproval';
        else if (creationIntent === 'createUnassigned') actionKey = 'createUnassigned';
        setLoadingAction(actionKey);
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

            if ((showDraftVsSubmitButtons || showPrivilegedNewAssetButtons) && creationIntent) {
                payload.creationIntent = creationIntent;
            }

            // Conditional payload based on mode
            if (isAssetMode) {
                // Add Asset Mode Fields
                payload.assetValue = formData.assetValue;
                payload.warranty = formData.hasWarranty === 'yes' ? formData.warranty : 'No Warranty';
                payload.total = 1;
                payload.assigned = 0;
                payload.unassigned = 1;

                const isEditingExistingAsset = !!(initialData && initialData._id);
                // Filter empties — on edit, keep Mongo _id / accessoryId so server merges; otherwise every row looks "new" and all go pending for assignee approval.
                payload.accessories = accessories
                    .filter((a) => a.name.trim() !== '')
                    .map((a) => {
                        const row = {
                            name: a.name.trim(),
                            description: (a.description || '').trim(),
                            amount: a.price !== '' && a.price != null ? Number(a.price) : 0
                        };
                        if (isEditingExistingAsset && (a._id != null || a.accessoryId)) {
                            if (a._id != null && a._id !== '') row._id = a._id;
                            if (a.accessoryId != null && a.accessoryId !== '') row.accessoryId = a.accessoryId;
                            if (a.status != null && a.status !== '') row.status = a.status;
                            if (a.pendingAction != null && a.pendingAction !== '') row.pendingAction = a.pendingAction;
                            if (a.pendingActionDetails != null) row.pendingActionDetails = a.pendingActionDetails;
                            if (a.attachment) row.attachment = a.attachment;
                        }
                        return row;
                    });

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
                        setLoadingAction(null);
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
                        setLoadingAction(null);
                        return;
                    }
                }
            } else {
                // Asset Type / Category Mode Fields
                payload.total = formData.total;
                payload.assigned = formData.assigned;
                payload.unassigned = formData.unassigned;
            }

            // Handle image processing
            let finalImage = imagePreview;
            if (showCropper && avatarEditorRef.current) {
                const canvas = avatarEditorRef.current.getImageScaledToCanvas();
                finalImage = canvas.toDataURL('image/png', 1.0);
            }

            // Always add image if it is a newly cropped/selected image (base64)
            if (finalImage && finalImage.startsWith('data:image')) {
                payload.imagePreview = finalImage;
                payload.photo = finalImage;
            }

            if (initialData && initialData._id) {
                await axiosInstance.put(`/AssetType/${initialData._id}`, payload);
                toast({
                    title: "Success",
                    description: "Updated successfully"
                });
            } else {
                const createRes = await axiosInstance.post('/AssetType', payload);
                const createdCount = Number(createRes?.data?.createdCount || 1);
                const createdAssetIds = Array.isArray(createRes?.data?.createdAssetIds) ? createRes.data.createdAssetIds : [];
                toast({
                    title: "Success",
                    description: createdCount > 1
                        ? `${createdCount} assets were created successfully.`
                        : creationIntent === 'saveDraft'
                            ? "Saved as draft. You can edit until you submit for approval."
                            : creationIntent === 'submitForApproval'
                                ? "Submitted for approval. Asset Controller has been notified."
                                : creationIntent === 'createUnassigned' && isAssetMode
                                    ? "Asset created as Unassigned and is ready to assign."
                                    : isPrivilegedAssetCreator && isAssetMode
                                        ? "Asset created as Unassigned and is ready to assign."
                                        : "Added successfully",
                    action: createdCount > 1
                        ? <ToastAction altText="View created assets" onClick={() => onSuccess?.()}>View Assets</ToastAction>
                        : undefined
                });
                if (createdCount > 1 && createdAssetIds.length > 0) {
                    console.log('[AddAsset] Bulk created asset IDs:', createdAssetIds);
                }
            }

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
            setAccessories([{ name: '', description: '', price: '' }]);

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
            setLoadingAction(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[22px] shadow-xl w-full max-w-[750px] max-h-[75vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {initialData ? 'Edit Asset' : mode === 'category' ? 'Add Category' : isAssetMode ? 'Add Asset' : 'Add Asset Type'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={isBusy}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto modal-scroll p-6">
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
                                            <option key={i} value={t.type}>{t.type}</option>
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
                                        disabled={!!initialData && !canEditAssetValue}
                                        className={`w-full px-4 py-2 border border-gray-200 rounded-lg transition-all ${!!initialData && !canEditAssetValue ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'}`}
                                        placeholder="Enter the Value"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Purchase Date
                                        </label>
                                        <DatePicker
                                            value={formData.purchaseDate || ''}
                                            onChange={(date) => setFormData({ ...formData, purchaseDate: date })}
                                            placeholder="Pick purchase date"
                                            className="w-full h-10 px-3 border border-gray-200 rounded-lg bg-white font-normal text-gray-900 hover:bg-gray-50/80 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                                            disabled={isBusy}
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
                                        <div
                                            key={acc._id?.toString?.() || acc.accessoryId || `acc-row-${index}`}
                                            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start"
                                        >
                                            <div className="md:col-span-3">
                                                <input
                                                    type="text"
                                                    value={acc.name || ''}
                                                    onChange={(e) => handleAccessoryChange(index, 'name', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                                    placeholder="Name"
                                                />
                                            </div>
                                            <div className="md:col-span-6">
                                                <input
                                                    type="text"
                                                    value={acc.description || ''}
                                                    onChange={(e) => handleAccessoryChange(index, 'description', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                                    placeholder="Description"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={acc.price || ''}
                                                    onChange={(e) => handleAccessoryChange(index, 'price', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                                    placeholder="Price"
                                                />
                                            </div>
                                            {accessories.length > 1 && roleMeta?.isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAccessory(index)}
                                                    className="md:col-span-1 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                                                    title="Remove row (admin only)"
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

                        {/* Enhanced Image Upload Section for All Modes */}
                        <div className="md:col-span-2 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {mode === 'type' ? 'Asset Type Image' : mode === 'category' ? 'Category Image' : 'Asset Photo'} <span className="text-gray-400 text-[10px] ml-1 uppercase">(Recommended)</span>
                            </label>

                            {showCropper ? (
                                <div className="flex flex-col items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="relative bg-white rounded-lg shadow-inner overflow-hidden flex items-center justify-center p-2 group" style={{ width: '100%', maxWidth: '400px', height: '300px' }}>
                                        <AvatarEditor
                                            ref={avatarEditorRef}
                                            image={selectedImage}
                                            width={300}
                                            height={250}
                                            border={20}
                                            borderRadius={12}
                                            scale={imageScale}
                                            rotate={rotation || 0}
                                            color={[255, 255, 255, 0.6]}
                                            style={{ borderRadius: '12px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                            className="absolute right-4 top-4 w-10 h-10 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl flex items-center justify-center text-slate-600 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all border border-slate-100"
                                            title="Rotate Image"
                                        >
                                            <RotateCw size={18} />
                                        </button>
                                    </div>

                                    <div className="w-full max-w-sm flex items-center gap-3">
                                        <Minus size={16} className="text-gray-400" />
                                        <input
                                            type="range"
                                            min="1"
                                            max="3"
                                            step="0.01"
                                            value={imageScale}
                                            onChange={(e) => setImageScale(parseFloat(e.target.value))}
                                            className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <Plus size={16} className="text-gray-400" />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCropper(false);
                                                setSelectedImage(null);
                                                setImagePreview(null);
                                            }}
                                            className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-100 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (avatarEditorRef.current) {
                                                    const canvas = avatarEditorRef.current.getImageScaledToCanvas();
                                                    setImagePreview(canvas.toDataURL());
                                                    setShowCropper(false);
                                                }
                                            }}
                                            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all"
                                        >
                                            Done Cropping
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer relative group h-40">
                                    {imagePreview ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img src={imagePreview} alt="Preview" className="h-full object-contain rounded-lg" />
                                            <div className="absolute top-2 right-2 flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedImage(imagePreview);
                                                        setShowCropper(true);
                                                    }}
                                                    className="p-1.5 bg-white/90 shadow-md rounded-full text-blue-600 hover:bg-blue-50 backdrop-blur-sm"
                                                    title="Recrop"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" /><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" /></svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setImagePreview(null);
                                                        setSelectedImage(null);
                                                    }}
                                                    className="p-1.5 bg-white/90 shadow-md rounded-full text-red-500 hover:bg-red-50 backdrop-blur-sm"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 mb-2 group-hover:scale-110 transition-transform">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                {mode === 'type' ? 'Add Type Photo' : mode === 'category' ? 'Add Category Photo' : 'Upload Asset Photo'}
                                            </span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setSelectedImage(reader.result);
                                                            setShowCropper(true);
                                                            setImageScale(1);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            )}
                        </div>



                    </div>
                </form>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0 flex-wrap">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                        disabled={isBusy}
                    >
                        Cancel
                    </button>
                    {showDraftVsSubmitButtons ? (
                        <>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'saveDraft')}
                                className="px-6 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2 min-w-[8rem] disabled:opacity-50"
                                disabled={isBusy}
                            >
                                {loadingAction === 'saveDraft' && <Loader2 size={16} className="animate-spin shrink-0" />}
                                {loadingAction === 'saveDraft' ? 'Saving…' : 'Save Draft'}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'submitForApproval')}
                                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 min-w-[10rem] disabled:opacity-50"
                                disabled={isBusy}
                            >
                                {loadingAction === 'submitForApproval' && <Loader2 size={16} className="animate-spin shrink-0" />}
                                {loadingAction === 'submitForApproval' ? 'Submitting…' : 'Submit for Approval'}
                            </button>
                        </>
                    ) : showPrivilegedNewAssetButtons ? (
                        <>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'saveDraft')}
                                className="px-6 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2 min-w-[8rem] disabled:opacity-50"
                                disabled={isBusy}
                            >
                                {loadingAction === 'saveDraft' && <Loader2 size={16} className="animate-spin shrink-0" />}
                                {loadingAction === 'saveDraft' ? 'Saving…' : 'Draft'}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'createUnassigned')}
                                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 min-w-[10rem] disabled:opacity-50"
                                disabled={isBusy}
                            >
                                {loadingAction === 'createUnassigned' && <Loader2 size={16} className="animate-spin shrink-0" />}
                                {loadingAction === 'createUnassigned' ? 'Creating…' : 'Add Asset'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e)}
                            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            disabled={isBusy}
                        >
                            {loadingAction === 'save' && <Loader2 size={16} className="animate-spin" />}
                            {loadingAction === 'save' ? 'Saving...' : (initialData ? 'Save Changes' : 'Add')}
                        </button>
                    )}
                </div>
            </div >
        </div >
    );
}
