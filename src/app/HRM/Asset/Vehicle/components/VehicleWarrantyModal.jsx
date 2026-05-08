'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X, ShieldCheck, Calendar } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

export default function VehicleWarrantyModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    existingDoc,
    isRenew = false,
    existingAttachmentRows = [],
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [deletedDocIds, setDeletedDocIds] = useState([]);
    
    const [formData, setFormData] = useState({
        warrantyBy: '',
        warrantyCovered: [], // ['Engine', 'Tyre', 'Service']
        startDate: '',
        km: '',
        endDate: '',
        
        // Dynamic Rows
        rows: [],
    });

    const [errors, setErrors] = useState({});

    const vendorOptions = [
        'Al Futtaim Motors',
        'AGMC',
        'Emirates Motor Company',
        'Dynatrade',
        'Galadari Automobiles',
        'Arabian Automobiles',
        'Premier Car Care',
        'Habtoor Motors',
    ];

    const coverageOptions = [
        { id: 'Engine', label: 'Engine' },
        { id: 'Tyre', label: 'Tyre' },
        { id: 'Service', label: 'Service Warranty' },
    ];

    useEffect(() => {
        if (!isOpen) return;

        if (isRenew) {
            setFormData({
                warrantyBy: '',
                warrantyCovered: [],
                startDate: '',
                km: '',
                endDate: '',
                rows: [],
            });
            setErrors({});
            return;
        }

        if (existingDoc) {
            let parsed = {};
            if (existingDoc.description) {
                try {
                    parsed = JSON.parse(existingDoc.description);
                } catch {
                    parsed = {};
                }
            }

            setFormData({
                warrantyBy: parsed.warrantyBy || '',
                warrantyCovered: Array.isArray(parsed.warrantyCovered) ? parsed.warrantyCovered : [],
                startDate: existingDoc.issueDate ? String(existingDoc.issueDate).substring(0, 10) : '',
                km: parsed.km != null ? String(parsed.km) : '',
                endDate: existingDoc.expiryDate ? String(existingDoc.expiryDate).substring(0, 10) : '',
                rows: (existingAttachmentRows || []).map(r => ({
                    rowDocId: r._id,
                    description: r.description || '',
                    file: null,
                    fileBase64: '',
                    fileName: r.attachment ? 'Click to upload' : '',
                    fileMime: '',
                    hasExisting: !!r.attachment
                })),
            });
        } else {
            setFormData({
                warrantyBy: '',
                warrantyCovered: [],
                startDate: '',
                km: '',
                endDate: '',
                rows: [],
            });
        }
        setDeletedDocIds([]);
        setErrors({});
    }, [isOpen, existingDoc]);

    if (!isOpen) return null;


    const handleRowChange = (index, patch) => {
        setFormData((prev) => {
            const next = [...prev.rows];
            next[index] = { ...next[index], ...patch };
            return { ...prev, rows: next };
        });
    };

    const handleRowFileChange = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            handleRowChange(index, {
                file,
                fileBase64: base64,
                fileName: file.name,
                fileMime: file.type || 'application/pdf',
            });
        };
        reader.readAsDataURL(file);
    };

    const addRow = () => {
        setFormData((prev) => ({
            ...prev,
            rows: [...prev.rows, { rowDocId: null, description: '', file: null, fileBase64: '', fileName: '', fileMime: '', hasExisting: false }],
        }));
    };

    const removeRow = (index) => {
        const row = formData.rows[index];
        if (row.rowDocId) {
            setDeletedDocIds((prev) => [...prev, row.rowDocId]);
        }
        setFormData((prev) => ({
            ...prev,
            rows: prev.rows.filter((_, i) => i !== index),
        }));
    };

    const validate = () => {
        const next = {};
        if (!formData.startDate) next.startDate = 'Start date is required';
        if (!formData.endDate) next.endDate = 'End date is required';
        if (!formData.warrantyBy) next.warrantyBy = 'Warranty provider is required';
        
        // Ensure at least one primary document if new
        const needDoc = (isRenew || !existingDoc);
        const hasAnyDoc = formData.rows.some(r => r.fileBase64 || r.hasExisting);
        if (needDoc && !hasAnyDoc) {
            next.docs = 'At least one warranty document is required';
        }

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            setLoading(true);

            // Handle Deletions
            for (const id of deletedDocIds) {
                try {
                    await axiosInstance.delete(`/AssetItem/${assetId}/document/${id}`);
                } catch (err) {
                    console.error("Failed to delete document:", id, err);
                }
            }
            
            // 1. Save Primary Warranty Doc
            const mainPayload = {
                type: 'Warranty',
                issueAuthority: 'Warranty Provider',
                issueDate: formData.startDate,
                expiryDate: formData.endDate,
                description: JSON.stringify({
                    warrantyBy: formData.warrantyBy,
                    warrantyCovered: formData.warrantyCovered,
                    km: formData.km ? Number(formData.km) : null,
                }),
            };

            // Use the first row as the main attachment if it exists and has a file
            if (formData.rows.length > 0 && formData.rows[0].fileBase64) {
                mainPayload.document = {
                    name: formData.rows[0].fileName || 'warranty-doc',
                    data: formData.rows[0].fileBase64,
                    mimeType: formData.rows[0].fileMime || 'application/pdf',
                };
            }

            const shouldUpdateExisting = existingDoc?._id && !isRenew;
            
            if (shouldUpdateExisting) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, mainPayload);
            } else {
                await axiosInstance.post(`/AssetItem/${assetId}/document`, mainPayload);
            }

            // 2. Save Dynamic Rows.
            // If row 0 file was used as primary doc attachment, skip it here to avoid duplicates.
            const firstRowUsedAsPrimaryAttachment = Boolean(formData.rows[0]?.fileBase64);
            const startIndex = firstRowUsedAsPrimaryAttachment ? 1 : 0;

            for (let i = startIndex; i < formData.rows.length; i++) {
                const r = formData.rows[i];
                const desc = (r.description || '').trim();
                const hasFile = !!r.fileBase64;
                if (!desc && !hasFile) continue;

                const rowPayload = {
                    type: 'Warranty Attachment',
                    issueAuthority: 'Warranty Provider',
                    issueDate: formData.startDate,
                    expiryDate: formData.endDate,
                    description: desc || 'Warranty Document',
                };

                if (hasFile) {
                    rowPayload.document = {
                        name: r.fileName || 'warranty-attachment',
                        data: r.fileBase64,
                        mimeType: r.fileMime || 'application/pdf',
                    };
                }

                if (r.rowDocId) {
                    await axiosInstance.put(`/AssetItem/${assetId}/document/${r.rowDocId}`, rowPayload);
                } else {
                    await axiosInstance.post(`/AssetItem/${assetId}/document`, rowPayload);
                }
            }

            toast({ title: 'Saved', description: 'Warranty details saved successfully.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving warranty', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save warranty details.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[85vh] p-6 md:p-8 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {isRenew ? 'Renew Warranty' : 'Warranty Details'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-5 px-1 md:px-2 pt-5 pb-2 flex-1 overflow-y-auto modal-scroll">
                    
                    {/* Warranty By & Covered Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Warranty By (Vendor) <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.warrantyBy}
                                onChange={(e) => setFormData(p => ({ ...p, warrantyBy: e.target.value }))}
                                className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${errors.warrantyBy ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                disabled={loading}
                            >
                                <option value="">Select Warranty Provider...</option>
                                {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            {errors.warrantyBy && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.warrantyBy}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Warranty Covered <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={Array.isArray(formData.warrantyCovered) ? (formData.warrantyCovered[0] || '') : formData.warrantyCovered}
                                onChange={(e) => setFormData(p => ({ ...p, warrantyCovered: [e.target.value] }))}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                disabled={loading}
                            >
                                <option value="">Select Coverage...</option>
                                {coverageOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* From - KM - To Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Start Date <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                value={formData.startDate}
                                onChange={(date) => setFormData(p => ({ ...p, startDate: date }))}
                                placeholder="Pick start date"
                                className={`w-full h-11 border-slate-200 bg-slate-50 text-slate-800 ${errors.startDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                            />
                            {errors.startDate && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.startDate}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                KM
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.km}
                                onChange={(e) => setFormData(p => ({ ...p, km: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-semibold"
                                disabled={loading}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                End Date <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                value={formData.endDate}
                                onChange={(date) => setFormData(p => ({ ...p, endDate: date }))}
                                placeholder="Pick end date"
                                className={`w-full h-11 border-slate-200 bg-slate-50 text-slate-800 ${errors.endDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                            />
                            {errors.endDate && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.endDate}</p>}
                        </div>
                    </div>

                    {/* Dynamic Documents Section */}
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[15px] font-black text-slate-900 uppercase tracking-widest">Warranty Documents</h4>
                            <button
                                type="button"
                                onClick={addRow}
                                disabled={loading}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Add More
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {formData.rows.map((row, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-2 p-3 rounded-xl bg-white border border-slate-100 shadow-sm relative group">
                                    <div className="flex-1 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Document Name</label>
                                        <input
                                            type="text"
                                            value={row.description}
                                            onChange={(e) => handleRowChange(idx, { description: e.target.value })}
                                            placeholder="e.g. Warranty Certificate, Service Contract..."
                                            disabled={loading}
                                            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Attachment</label>
                                        <div className="relative h-9 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 cursor-pointer hover:bg-blue-50/50 transition-colors">
                                            <input
                                                type="file"
                                                onChange={(e) => handleRowFileChange(idx, e)}
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                disabled={loading}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <span className="text-[11px] font-bold text-slate-600 truncate">
                                                {row.fileName || 'Click to upload'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-end pb-0.5">
                                        <button
                                            type="button"
                                            onClick={() => removeRow(idx)}
                                            disabled={loading}
                                            className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {errors.docs && <p className="text-[11px] font-medium text-red-500 px-1">{errors.docs}</p>}
                            {formData.rows.length === 0 && (
                                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No documents added yet</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Click "+ Add More" to upload warranty files</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-6 h-11 rounded-xl border border-slate-200 text-[13px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all disabled:opacity-60 flex items-center justify-center min-w-[120px]"
                        >
                            {loading ? 'Saving...' : 'OK'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
