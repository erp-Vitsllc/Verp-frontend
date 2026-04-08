'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

const EMIRATES = [
    { value: 'Abu Dhabi', short: 'ABU DHABI', ar: 'ابوظبي' },
    { value: 'Dubai', short: 'DUBAI', ar: 'دبي' },
    { value: 'Sharjah', short: 'SHARJAH', ar: 'الشارقة' },
    { value: 'Ajman', short: 'AJMAN', ar: 'عجمان' },
    { value: 'Umm Al Quwain', short: 'UAQ', ar: 'ام القيوين' },
    { value: 'Ras Al Khaimah', short: 'RAK', ar: 'رأس الخيمة' },
    { value: 'Fujairah', short: 'FUJAIRAH', ar: 'الفجيرة' }
];

const EMIRATE_PLATE_IMAGE = {
    'Abu Dhabi': '/assets/abudhabi-no-plate.png',
    'Ajman': '/assets/ajman-no-plate.png',
    'Dubai': '/assets/dubai-noplate.png',
    'Fujairah': '/assets/fujairah-plate-no.png',
    'Ras Al Khaimah': '/assets/rak-plate-no.png',
    'Sharjah': '/assets/sharjah-no-plate.png',
    'Umm Al Quwain': '/assets/Screenshot%202026-04-07%20160803.png'
};

export default function AddVehicleModal({ isOpen, onClose, onSuccess }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Dropdown Data
    const [categories, setCategories] = useState([]);
    const [types, setTypes] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    const [formData, setFormData] = useState({
        manufacture: '', // Mapped to type
        name: '',        // Vehicle Model
        modelYear: '',   // Make Year
        plateNumber: '',
        plateEmirate: 'Dubai',
        plateCode: '',
        plateDigits: '',
        purchaseValue: '',
        purchaseYearMonth: '',
        warrantyEnabled: 'No',
        warrantyKm: '',
        warrantyExpiryDate: '',
        invoiceFileName: '',
        invoiceAttachment: '',
        category: '',    // Required by backend
        assetValue: 0,   // Default
        photo: ''        // Base64 image
    });

    const [errors, setErrors] = useState({});
    const yearOptions = Array.from({ length: 41 }, (_, i) => String(new Date().getFullYear() - i));

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
            setCategories(cats);

            // Try to auto-select a 'Vehicle' or 'Fleet' category
            const defaultCat = cats.find(c => c.category?.toLowerCase().includes('vehicle') || c.category?.toLowerCase().includes('fleet'));
            if (defaultCat) {
                setFormData(prev => ({ ...prev, category: defaultCat.category }));
            }

        } catch (error) {
            console.error('Error fetching dropdown data', error);
        } finally {
            setDataLoading(false);
        }
    };

    // Backend accepts: optional 1-3 letters + 1-6 digits (e.g. "B 12345" or "12345")
    const normalizePlate = ({ code, digits }) => {
        const digitsOnly = String(digits || '').replace(/\D/g, '').slice(0, 6) || '1';
        const lettersOnly = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
        return lettersOnly ? `${lettersOnly} ${digitsOnly}` : digitsOnly;
    };
    const purchaseYmToDateValue = (ym) => (ym ? `${ym}-01` : '');
    const dateValueToPurchaseYm = (d) => {
        if (!d || typeof d !== 'string') return '';
        return d.slice(0, 7);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

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
                type: formData.manufacture,
                name: formData.name, // Model
                modelYear: formData.modelYear,
                plateNumber: normalizePlate({
                    code: formData.plateCode,
                    digits: formData.plateDigits
                }),
                assetValue: Number(formData.purchaseValue || formData.assetValue || 0),
                purchaseValue: Number(formData.purchaseValue || 0),
                purchaseYearMonth: formData.purchaseYearMonth,
                warrantyEnabled: formData.warrantyEnabled === 'Yes',
                warrantyKm: formData.warrantyEnabled === 'Yes' ? Number(formData.warrantyKm || 0) : 0,
                warrantyExpiryDate: formData.warrantyEnabled === 'Yes' ? formData.warrantyExpiryDate : '',
                invoiceAttachment: formData.invoiceAttachment
                    ? {
                        fileName: formData.invoiceFileName || 'invoice',
                        data: formData.invoiceAttachment
                    }
                    : null,
                photo: formData.photo,
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

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

                    {/* Plate Number: one row, 3 boxes */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plate Number <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <select
                                    value={formData.plateEmirate}
                                    onChange={(e) => setFormData({ ...formData, plateEmirate: e.target.value })}
                                    className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.plateEmirate ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                                >
                                    {EMIRATES.map((em) => (
                                        <option key={em.value} value={em.value}>{em.value}</option>
                                    ))}
                                </select>
                                {errors.plateEmirate && <p className="text-xs text-red-500">{errors.plateEmirate}</p>}
                            </div>

                            <div className="space-y-1">
                                <input
                                    type="text"
                                    value={formData.plateCode}
                                    onChange={(e) => setFormData({ ...formData, plateCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) })}
                                    placeholder="Code"
                                    className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.plateCode ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                                />
                                {errors.plateCode && <p className="text-xs text-red-500">{errors.plateCode}</p>}
                            </div>

                            <div className="space-y-1">
                                <input
                                    type="text"
                                    value={formData.plateDigits}
                                    onChange={(e) => setFormData({ ...formData, plateDigits: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                    placeholder="Number"
                                    className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.plateDigits ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                                />
                                {errors.plateDigits && <p className="text-xs text-red-500">{errors.plateDigits}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Plate preview matching sample style */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plate Preview</label>
                        {EMIRATE_PLATE_IMAGE[formData.plateEmirate] ? (
                            <div className="w-full rounded-2xl overflow-hidden border border-gray-200 bg-white">
                                <div className="relative w-full">
                                    <img
                                        src={EMIRATE_PLATE_IMAGE[formData.plateEmirate]}
                                        alt={`${formData.plateEmirate} plate`}
                                        className="w-full h-auto block"
                                    />
                                    <div className={`absolute left-[6%] ${formData.plateEmirate === 'Dubai' ? 'top-[62%]' : 'top-1/2'} -translate-y-1/2 text-[min(7vw,72px)] font-black leading-none tracking-tight text-black`}>
                                        {formData.plateCode || 'B'}
                                    </div>
                                    <div className="absolute right-[6%] top-1/2 -translate-y-1/2 text-[min(10vw,104px)] font-black leading-none tracking-tight text-black">
                                        {formData.plateDigits || '12345'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full rounded-2xl border-[3px] border-black bg-[#f8f8f8] p-3">
                            <div className="flex items-center gap-4">
                                <div className="min-w-[74px] text-center">
                                    <div className="text-6xl leading-none font-black tracking-tight">{formData.plateCode || 'B'}</div>
                                </div>
                                <div className="min-w-[140px]">
                                    <div className="text-4xl font-bold leading-none">UAE</div>
                                    <div className="text-3xl font-bold leading-none mt-1">
                                        {EMIRATES.find((x) => x.value === formData.plateEmirate)?.ar || ''}
                                    </div>
                                </div>
                                <div className="ml-auto text-7xl font-black tracking-tight leading-none">
                                    {formData.plateDigits || '12345'}
                                </div>
                            </div>
                            </div>
                        )}
                    </div>

                    {/* Vehicle details row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Model Year <span className="text-red-500">*</span></label>
                            <select
                                value={formData.modelYear}
                                onChange={(e) => setFormData({ ...formData, modelYear: e.target.value })}
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.modelYear ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                            >
                                <option value="">Select year</option>
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            {errors.modelYear && <p className="text-xs text-red-500">{errors.modelYear}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.manufacture}
                                onChange={(e) => setFormData({ ...formData, manufacture: e.target.value })}
                                placeholder="e.g. Toyota"
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.manufacture ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                            />
                            {errors.manufacture && <p className="text-xs text-red-500">{errors.manufacture}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Model <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Corolla"
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.name ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                            />
                            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                        </div>
                    </div>

                    {/* Purchase + Warranty + Invoice */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Value</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.purchaseValue}
                                onChange={(e) => setFormData({ ...formData, purchaseValue: e.target.value })}
                                placeholder="0"
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all focus:border-blue-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Year & Month <span className="text-red-500">*</span></label>
                            <DatePicker
                                value={purchaseYmToDateValue(formData.purchaseYearMonth)}
                                onChange={(v) => setFormData({ ...formData, purchaseYearMonth: dateValueToPurchaseYm(v || '') })}
                                placeholder="Select purchase month/year"
                            />
                            {errors.purchaseYearMonth && <p className="text-xs text-red-500">{errors.purchaseYearMonth}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warranty</label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, warrantyEnabled: 'Yes' })}
                                    className={`px-3 py-2 rounded-lg text-sm font-semibold border ${formData.warrantyEnabled === 'Yes' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, warrantyEnabled: 'No', warrantyKm: '', warrantyExpiryDate: '' })}
                                    className={`px-3 py-2 rounded-lg text-sm font-semibold border ${formData.warrantyEnabled === 'No' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    </div>

                    {formData.warrantyEnabled === 'Yes' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warranty KM <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.warrantyKm}
                                    onChange={(e) => setFormData({ ...formData, warrantyKm: e.target.value })}
                                    placeholder="e.g. 100000"
                                    className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.warrantyKm ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                                />
                                {errors.warrantyKm && <p className="text-xs text-red-500">{errors.warrantyKm}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warranty End Date <span className="text-red-500">*</span></label>
                                <DatePicker
                                    value={formData.warrantyExpiryDate}
                                    onChange={(v) => setFormData({ ...formData, warrantyExpiryDate: v || '' })}
                                    placeholder="Select warranty end date"
                                />
                                {errors.warrantyExpiryDate && <p className="text-xs text-red-500">{errors.warrantyExpiryDate}</p>}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Upload</label>
                        <input
                            type="file"
                            accept=".pdf,image/*"
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        invoiceFileName: file.name,
                                        invoiceAttachment: String(reader.result || '')
                                    }));
                                };
                                reader.readAsDataURL(file);
                            }}
                        />
                        {formData.invoiceFileName ? (
                            <p className="text-xs text-gray-500">Attached: {formData.invoiceFileName}</p>
                        ) : null}
                    </div>

                    {/* Vehicle Photo Upload */}
                    

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
