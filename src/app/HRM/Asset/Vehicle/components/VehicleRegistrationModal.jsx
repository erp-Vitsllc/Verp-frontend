'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

export default function VehicleRegistrationModal({
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
        registrationDate: '',
        expiryDate: '',
        fee: '',
        rows: [{ rowDocId: null, description: 'Registration Card', file: null, fileBase64: '', fileName: '', fileMime: '', hasExisting: false }],
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!isOpen) return;

        // Renew opens with empty fields (like employee passport renew).
        if (isRenew) {
            setFormData({
                registrationDate: '',
                expiryDate: '',
                fee: '',
                rows: [{ rowDocId: null, description: 'Registration Card', file: null, fileBase64: '', fileName: '', fileMime: '', hasExisting: false }],
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
            const primaryRow = {
                rowDocId: existingDoc._id || null,
                description: 'Registration Card',
                file: null,
                fileBase64: '',
                fileName: existingDoc.attachment ? 'Click to upload' : '',
                fileMime: '',
                hasExisting: !!existingDoc.attachment
            };

            const otherRows = (existingAttachmentRows && existingAttachmentRows.length)
                ? existingAttachmentRows.map((r) => ({
                    rowDocId: r._id || null,
                    description: r.description || '',
                    file: null,
                    fileBase64: '',
                    fileName: r.attachment ? 'Click to upload' : '',
                    fileMime: '',
                    hasExisting: !!r.attachment
                }))
                : [];

            setFormData({
                registrationDate: existingDoc.issueDate ? existingDoc.issueDate.substring(0, 10) : '',
                expiryDate: existingDoc.expiryDate ? existingDoc.expiryDate.substring(0, 10) : '',
                fee: parsed.fee != null ? String(parsed.fee) : '',
                rows: [primaryRow, ...otherRows],
            });
        } else {
            setFormData({
                registrationDate: '',
                expiryDate: '',
                fee: '',
                rows: [{ rowDocId: null, description: 'Registration Card', file: null, fileBase64: '', fileName: '', fileMime: '', hasExisting: false }],
            });
        }
        setDeletedDocIds([]);
        setErrors({});
    }, [isOpen, existingDoc, isRenew, existingAttachmentRows]);

    if (!isOpen) return null;

    // Removed separate handleCardFileChange as card file is now part of the first row.

    const handleRowChange = (index, patch) => {
        setFormData((prev) => {
            const next = [...prev.rows];
            next[index] = { ...next[index], ...patch };
            return { ...prev, rows: next };
        });
    };

    const handleRowFileChange = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) {
            handleRowChange(index, { file: null, fileBase64: '', fileName: '', fileMime: '' });
            return;
        }
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
        if (index === 0) return; // Cannot remove primary doc
        
        if (row.rowDocId) {
            setDeletedDocIds((prev) => [...prev, row.rowDocId]);
        }

        setFormData((prev) => {
            const next = prev.rows.filter((_, i) => i !== index);
            return { ...prev, rows: next };
        });
    };

    const validate = () => {
        const next = {};
        if (!formData.registrationDate) next.registrationDate = 'Registration date is required';
        if (!formData.expiryDate) next.expiryDate = 'Expiry date is required';
        
        const primaryRow = formData.rows[0];
        const shouldRequireAttachment = isRenew || !existingDoc || !existingDoc.attachment;
        const hasAttachment = primaryRow?.fileBase64 || primaryRow?.hasExisting;
        if (shouldRequireAttachment && !hasAttachment) {
            next.cardFile = 'Primary registration document is required';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const rows = formData.rows || [];
        const primaryRow = rows[0];

        const mainPayload = {
            type: 'Registration',
            issueAuthority: 'RTA',
            issueDate: formData.registrationDate,
            expiryDate: formData.expiryDate,
            description: JSON.stringify({
                fee: formData.fee ? Number(formData.fee) : null,
            }),
        };

        if (primaryRow?.fileBase64) {
            mainPayload.document = {
                name: primaryRow.fileName || 'registration-card',
                data: primaryRow.fileBase64,
                mimeType: primaryRow.fileMime || 'application/pdf',
            };
        }

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

            const shouldUpdateExisting = existingDoc?._id && !isRenew;
            if (shouldUpdateExisting) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, mainPayload);
            } else {
                await axiosInstance.post(`/AssetItem/${assetId}/document`, mainPayload);
            }

            // Save other attachment rows (starting from index 1).
            const otherRows = rows.slice(1);
            for (const r of otherRows) {
                const descriptionText = (r.description || '').trim();
                const hasFile = !!r.fileBase64;

                if (!descriptionText && !hasFile) continue;

                const basePayload = {
                    type: 'Registration Attachment',
                    issueAuthority: 'RTA',
                    issueDate: formData.registrationDate,
                    expiryDate: formData.expiryDate,
                    description: descriptionText,
                };

                if (r.rowDocId) {
                    const updatePayload = { ...basePayload };
                    if (hasFile) {
                        updatePayload.document = {
                            name: r.fileName || 'registration-attachment',
                            data: r.fileBase64,
                            mimeType: r.fileMime || 'application/pdf',
                        };
                    }
                    await axiosInstance.put(`/AssetItem/${assetId}/document/${r.rowDocId}`, updatePayload);
                } else {
                    const createPayload = { ...basePayload };
                    if (hasFile) {
                        createPayload.document = {
                            name: r.fileName || 'registration-attachment',
                            data: r.fileBase64,
                            mimeType: r.fileMime || 'application/pdf',
                        };
                    }
                    await axiosInstance.post(`/AssetItem/${assetId}/document`, createPayload);
                }
            }

            toast({
                title: 'Saved',
                description: 'Registration details saved successfully.',
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving registration details', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save registration details.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {isRenew ? 'Renew Registration' : 'Registration Details'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Registration Date */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Registration Date <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                value={formData.registrationDate}
                                onChange={(date) => setFormData((p) => ({ ...p, registrationDate: date }))}
                                placeholder="Pick date"
                                className={`w-full h-11 border-slate-200 bg-slate-50 text-slate-800 ${errors.registrationDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                            />
                            {errors.registrationDate && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.registrationDate}</p>}
                        </div>

                        {/* Expiry Date */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Expiry Date <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                value={formData.expiryDate}
                                onChange={(date) => setFormData((p) => ({ ...p, expiryDate: date }))}
                                placeholder="Pick date"
                                className={`w-full h-11 border-slate-200 bg-slate-50 text-slate-800 ${errors.expiryDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                            />
                            {errors.expiryDate && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.expiryDate}</p>}
                        </div>
                    </div>

                    {/* Registration Documents Section */}
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[15px] font-black text-slate-900 uppercase tracking-widest">Registration Documents</h4>
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
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                            {idx === 0 ? 'Document Name' : 'Document Name'} {idx === 0 && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={row.description}
                                            onChange={(e) => handleRowChange(idx, { description: e.target.value })}
                                            placeholder={idx === 0 ? "Registration Card" : "e.g. Emission Test, Police Report..."}
                                            disabled={loading}
                                            className={`w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none ${idx === 0 && errors.cardFile && !row.description ? 'border-red-400' : ''}`}
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                            {idx === 0 ? 'Attachment' : 'Attachment'} {idx === 0 && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className={`relative h-9 flex items-center rounded-lg border bg-slate-50 px-3 cursor-pointer hover:bg-blue-50/50 transition-colors ${idx === 0 && errors.cardFile ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}>
                                            <input
                                                type="file"
                                                onChange={(e) => handleRowFileChange(idx, e)}
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                disabled={loading}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <span className={`text-[11px] font-bold truncate max-w-full ${idx === 0 && errors.cardFile ? 'text-red-500' : 'text-slate-600'}`}>
                                                {row.fileName || 'Click to upload'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-end pb-0.5">
                                        {idx > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(idx)}
                                                disabled={loading}
                                                className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100"
                                                title="Remove"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {errors.cardFile && <p className="text-[11px] font-medium text-red-500 px-1">{errors.cardFile}</p>}
                        </div>
                    </div>

                    {/* Registration Value */}
                    <div className="space-y-1.5 pt-4">
                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                            Registration Value
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">AED</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.fee}
                                onChange={(e) => setFormData((p) => ({ ...p, fee: e.target.value }))}
                                className="w-full h-11 pl-14 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-semibold"
                                disabled={loading}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

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

