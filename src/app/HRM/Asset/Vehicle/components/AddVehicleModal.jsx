'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { EMIRATES, EMIRATE_PLATE_IMAGE, parsePlateParts } from '../lib/vehiclePlateConfig';
import { getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';
import { PDF_FILE_ACCEPT, isPdfUploadFile } from '../utils/vehicleDocumentCardRows';
import { saveVehicleSectionOrQueue } from '../lib/vehicleProfileEditOps';
import {
    buildBasicProposedRows,
    buildVehicleProfileEditSnapshots,
} from '../lib/vehicleProfileEditSnapshots';

const emptyForm = () => ({
    manufacture: '',
    name: '',
    modelYear: '',
    plateNumber: '',
    plateEmirate: 'Dubai',
    plateCode: '',
    plateDigits: '',
    purchaseValue: '',
    purchaseYearMonth: '',
    invoiceFileName: '',
    invoiceAttachment: '',
    category: '',
    assetValue: 0,
    photo: '',
});

export default function AddVehicleModal({
    isOpen,
    onClose,
    onSuccess,
    editAssetId = null,
    modalTitle,
    isLocatorSetup = false,
    asset = null,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [loadEdit, setLoadEdit] = useState(false);

    const [categories, setCategories] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [nextFleetAssetId, setNextFleetAssetId] = useState('');
    const yearOptions = Array.from({ length: 41 }, (_, i) => String(new Date().getFullYear() - i));

    const isEditMode = Boolean(editAssetId);
    const showInvoiceUpload = true;

    const fetchNextFleetAssetId = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get('/AssetItem/next-fleet-vehicle-id', {
                skipToast: true,
                timeout: 15000,
            });
            setNextFleetAssetId(data?.assetId || '');
        } catch {
            setNextFleetAssetId('');
        }
    }, []);

    const fetchDropdownData = useCallback(async () => {
        try {
            setDataLoading(true);
            const response = await axiosInstance.get('/AssetType', {
                params: { scope: 'catalog' },
                timeout: 15000,
            });
            const data = response.data || [];
            const cats = data.filter((item) => item.assetId && item.assetId.toString().startsWith('asset-cat-'));
            setCategories(cats);
            const defaultCat = cats.find(
                (c) => c.category?.toLowerCase().includes('vehicle') || c.category?.toLowerCase().includes('fleet')
            );
            if (defaultCat && !isEditMode) {
                setFormData((prev) => ({ ...prev, category: defaultCat.category }));
            }
        } catch (error) {
        } finally {
            setDataLoading(false);
        }
    }, [isEditMode, toast]);

    const loadAssetForEdit = useCallback(async () => {
        if (!editAssetId) return;
        try {
            setLoadEdit(true);
            const { data: a } = await axiosInstance.get(`/AssetItem/detail/${editAssetId}`);
            const { code, digits } = parsePlateParts(a.plateNumber);
            const pd = a.purchaseDate ? new Date(a.purchaseDate).toISOString().slice(0, 10) : '';
            // Locator stubs often store GPS device name as model and type name as brand — match Add Vehicle blanks.
            const plateMissing = !String(a.plateNumber || '').trim();
            const locatorFresh = isLocatorSetup && plateMissing;
            setFormData({
                ...emptyForm(),
                manufacture: locatorFresh
                    ? String(a.vehicleBrand || '').trim()
                    : getVehicleBrandLabel(a),
                name: locatorFresh ? '' : a.name || '',
                modelYear: a.modelYear ? String(a.modelYear) : '',
                plateEmirate: a.plateEmirate || 'Dubai',
                plateCode: code,
                plateDigits: digits,
                purchaseValue: a.assetValue != null ? String(a.assetValue) : '',
                purchaseYearMonth: locatorFresh ? '' : pd ? pd.slice(0, 7) : '',
                category: a.categoryId?.name || '',
                assetValue: a.assetValue || 0,
                invoiceFileName: a.invoiceFile ? 'Existing invoice on file' : '',
                invoiceAttachment: '',
            });
            setNextFleetAssetId(a.assetId || '');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load vehicle for editing.' });
            onClose();
        } finally {
            setLoadEdit(false);
        }
    }, [editAssetId, isLocatorSetup, onClose, toast]);

    useEffect(() => {
        if (!isOpen) {
            setDataLoading(false);
            setLoadEdit(false);
            return;
        }
        fetchDropdownData();
        if (!editAssetId) {
            fetchNextFleetAssetId();
        } else {
            setNextFleetAssetId('');
        }
        if (editAssetId) {
            loadAssetForEdit();
        } else {
            setFormData(emptyForm());
            setErrors({});
        }
    }, [isOpen, editAssetId, fetchDropdownData, loadAssetForEdit, fetchNextFleetAssetId]);

    const normalizePlate = ({ code, digits }) => {
        const digitsOnly = String(digits || '').replace(/\D/g, '').slice(0, 6) || '1';
        const codePart = String(code || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 3);
        return codePart ? `${codePart} ${digitsOnly}` : digitsOnly;
    };
    const purchaseYmToDateValue = (ym) => (ym ? `${ym}-01` : '');
    const dateValueToPurchaseYm = (d) => {
        if (!d || typeof d !== 'string') return '';
        return d.slice(0, 7);
    };

    const validate = () => {
        const e = {};
        if (!formData.modelYear) e.modelYear = 'Required';
        if (!String(formData.manufacture || '').trim()) e.manufacture = 'Required';
        if (!String(formData.name || '').trim()) e.name = 'Required';
        if (!formData.plateDigits || String(formData.plateDigits).replace(/\D/g, '').length < 1) {
            e.plateDigits = 'Plate number required';
        }
        if (!formData.purchaseYearMonth) e.purchaseYearMonth = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const buildCategory = () => {
        let assignedCategory = formData.category;
        if (!assignedCategory && categories.length > 0) {
            const defaultCat = categories.find(
                (c) => c.category?.toLowerCase().includes('vehicle') || c.category?.toLowerCase().includes('fleet')
            );
            assignedCategory = defaultCat ? defaultCat.category : categories[0].category;
        }
        return assignedCategory || 'Vehicle';
    };

    const buildCreatePayload = (creationIntent) => {
        const assignedCategory = buildCategory();
        const brand = String(formData.manufacture || '').trim();
        const selectedCat = categories.find((c) => c.category === assignedCategory);
        // Parent tools type name if present — brand must not be sent as `type` (that auto-created tools types).
        const parentTypeName = String(selectedCat?.type || '').trim() || 'Fleet Vehicle';
        return {
            mode: 'asset',
            creationIntent,
            category: assignedCategory,
            type: parentTypeName,
            vehicleBrand: brand,
            name: formData.name,
            modelYear: formData.modelYear,
            plateNumber: normalizePlate({
                code: formData.plateCode,
                digits: formData.plateDigits,
            }),
            plateEmirate: formData.plateEmirate,
            assetValue: Number(formData.purchaseValue || formData.assetValue || 0),
            purchaseValue: Number(formData.purchaseValue || 0),
            purchaseYearMonth: formData.purchaseYearMonth,
            purchaseDate: purchaseYmToDateValue(formData.purchaseYearMonth),
            invoiceFile: formData.invoiceAttachment || null,
            photo: formData.photo,
            quantity: 1,
        };
    };

    const buildUpdatePayload = () => ({
        name: formData.name,
        type: formData.manufacture,
        vehicleBrand: String(formData.manufacture || '').trim(),
        modelYear: formData.modelYear,
        plateNumber: normalizePlate({
            code: formData.plateCode,
            digits: formData.plateDigits,
        }),
        plateEmirate: formData.plateEmirate,
        assetValue: Number(formData.purchaseValue || 0),
        purchaseDate: purchaseYmToDateValue(formData.purchaseYearMonth),
        ...(formData.invoiceAttachment ? { invoiceFile: formData.invoiceAttachment } : {}),
    });

    const submitCreate = async (creationIntent) => {
        if (!validate()) return;
        try {
            setLoading(true);
            const payload = buildCreatePayload(creationIntent);
            await axiosInstance.post('/AssetType', payload);
            const msg =
                creationIntent === 'saveDraft'
                    ? 'Vehicle saved as draft. Publish it from the vehicle page when ready.'
                    : 'Vehicle created. Complete the profile and submit for activation when ready.';
            toast({ title: 'Success', description: msg });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to add vehicle',
            });
        } finally {
            setLoading(false);
        }
    };

    const submitUpdate = async () => {
        if (!validate()) return;
        try {
            setLoading(true);
            const body = buildUpdatePayload();
            if (asset) {
                const snapshotForm = {
                    assetId: nextFleetAssetId || asset.assetId || '',
                    brand: String(formData.manufacture || '').trim(),
                    name: formData.name,
                    plateEmirate: formData.plateEmirate,
                    plateCode: formData.plateCode,
                    plateDigits: formData.plateDigits,
                    modelYear: formData.modelYear,
                };
                const { previousRows, proposedRows } = buildVehicleProfileEditSnapshots({
                    sectionId: 'basic',
                    asset,
                    proposedRows: buildBasicProposedRows(snapshotForm, asset),
                });
                const result = await saveVehicleSectionOrQueue({
                    asset,
                    assetId: editAssetId,
                    sectionId: 'basic',
                    action: 'edit',
                    steps: [{ op: 'put_asset_type', body }],
                    previousRows,
                    proposedRows,
                });
                toast({
                    title: 'Saved',
                    description: result.queued
                        ? 'Basic details saved. Submit for HR approval when ready.'
                        : 'Vehicle details saved.',
                });
            } else {
                await axiosInstance.put(`/AssetType/${editAssetId}`, body);
                toast({ title: 'Saved', description: 'Vehicle details saved.' });
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save changes',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800">
                        {modalTitle || (isEditMode ? 'Edit vehicle (draft)' : 'Add Vehicle')}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {(dataLoading && !isEditMode) || loadEdit ? (
                    <div className="p-12 flex flex-col items-center gap-2 text-gray-500">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">Loading…</p>
                    </div>
                ) : (
                    <>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Vehicle ID
                                </label>
                                <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 tracking-wide">
                                    {nextFleetAssetId || (isEditMode ? '—' : 'Generating…')}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Plate Number <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <select
                                            value={formData.plateEmirate}
                                            onChange={(e) => setFormData({ ...formData, plateEmirate: e.target.value })}
                                            className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.plateEmirate ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                                        >
                                            {EMIRATES.map((em) => (
                                                <option key={em.value} value={em.value}>
                                                    {em.value}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <input
                                            type="text"
                                            value={formData.plateCode}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    plateCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3),
                                                })
                                            }
                                            placeholder="Code"
                                            className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <input
                                            type="text"
                                            value={formData.plateDigits}
                                            onChange={(e) =>
                                                setFormData({ ...formData, plateDigits: e.target.value.replace(/\D/g, '').slice(0, 6) })
                                            }
                                            placeholder="Number"
                                            className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm ${errors.plateDigits ? 'border-red-300' : 'border-gray-200'}`}
                                        />
                                        {errors.plateDigits && <p className="text-xs text-red-500">{errors.plateDigits}</p>}
                                    </div>
                                </div>
                            </div>

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
                                            <div
                                                className={`absolute left-[6%] ${formData.plateEmirate === 'Dubai' ? 'top-[62%]' : 'top-1/2'} -translate-y-1/2 ${formData.plateEmirate === 'Dubai' ? 'text-[min(4.5vw,44px)]' : 'text-[min(5.2vw,52px)]'} font-black leading-none tracking-tight text-black`}
                                            >
                                                {formData.plateCode || 'B'}
                                            </div>
                                            <div className="absolute right-[10%] top-1/2 -translate-y-1/2 text-[min(5.5vw,56px)] font-black leading-none tracking-tight text-black">
                                                {formData.plateDigits || '12345'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full rounded-2xl border-[3px] border-black bg-[#f8f8f8] p-3">
                                        <div className="flex items-center gap-4">
                                            <div className="text-4xl font-black">{formData.plateCode || 'B'}</div>
                                            <div className="ml-auto text-5xl font-black">{formData.plateDigits || '12345'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Model Year <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.modelYear}
                                        onChange={(e) => setFormData({ ...formData, modelYear: e.target.value })}
                                        className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm ${errors.modelYear ? 'border-red-300' : 'border-gray-200'}`}
                                    >
                                        <option value="">Select year</option>
                                        {yearOptions.map((y) => (
                                            <option key={y} value={y}>
                                                {y}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.modelYear && <p className="text-xs text-red-500">{errors.modelYear}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Brand <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.manufacture}
                                        onChange={(e) => setFormData({ ...formData, manufacture: e.target.value })}
                                        placeholder="e.g. Toyota"
                                        className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm ${errors.manufacture ? 'border-red-300' : 'border-gray-200'}`}
                                    />
                                    {errors.manufacture && <p className="text-xs text-red-500">{errors.manufacture}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Model <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Corolla"
                                        className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
                                    />
                                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Value</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.purchaseValue}
                                        onChange={(e) => setFormData({ ...formData, purchaseValue: e.target.value })}
                                        placeholder="0"
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Purchase Year & Month <span className="text-red-500">*</span>
                                    </label>
                                    <DatePicker
                                        value={purchaseYmToDateValue(formData.purchaseYearMonth)}
                                        onChange={(v) => setFormData({ ...formData, purchaseYearMonth: dateValueToPurchaseYm(v || '') })}
                                        placeholder="Select month/year"
                                    />
                                    {errors.purchaseYearMonth && <p className="text-xs text-red-500">{errors.purchaseYearMonth}</p>}
                                </div>
                            </div>

                            {showInvoiceUpload ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Upload</label>
                                    <input
                                        type="file"
                                        accept={PDF_FILE_ACCEPT}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = '';
                                            if (!file) return;
                                            if (!isPdfUploadFile(file)) {
                                                toast({
                                                    variant: 'destructive',
                                                    title: 'Invalid file',
                                                    description: 'Invoice must be a PDF file.',
                                                });
                                                return;
                                            }
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    invoiceFileName: file.name,
                                                    invoiceAttachment: String(reader.result || ''),
                                                }));
                                            };
                                            reader.readAsDataURL(file);
                                        }}
                                    />
                                    <p className="text-[11px] text-gray-400">PDF only</p>
                                    {formData.invoiceFileName ? (
                                        <p className="text-xs text-gray-500">Attached: {formData.invoiceFileName}</p>
                                    ) : null}
                                </div>
                            ) : null}

                            {!isEditMode ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex gap-2 text-xs text-slate-600">
                                    <AlertCircle className="shrink-0 text-slate-500" size={16} />
                                    <span>
                                        <strong>Save as draft</strong> — only you can see and edit it until you publish.{' '}
                                        <strong>Create vehicle</strong> — adds it to the fleet list immediately. HR approval is only
                                        needed when you submit the profile for activation at 100% completion (including vehicle inspection).
                                    </span>
                                </div>
                            ) : null}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-white hover:shadow-sm transition-all"
                            >
                                Cancel
                            </button>
                            {isEditMode ? (
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => submitUpdate()}
                                    className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 shadow-lg disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? 'Saving...' : (
                                        <>
                                            <Save size={16} /> Save changes
                                        </>
                                    )}
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => submitCreate('saveDraft')}
                                        className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : 'Save as draft'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => submitCreate('createUnassigned')}
                                        className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 shadow-md disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loading ? 'Creating...' : 'Create vehicle'}
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
