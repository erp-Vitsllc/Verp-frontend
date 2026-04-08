'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

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
    const [formData, setFormData] = useState({
        registrationDate: '',
        expiryDate: '',
        fee: '',
        cardFile: null,
        cardFileBase64: '',
        cardFileName: '',
        cardFileMime: '',
        rows: [{ rowDocId: null, description: '', file: null, fileBase64: '', fileName: '', fileMime: '' }],
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
                cardFile: null,
                cardFileBase64: '',
                cardFileName: '',
                cardFileMime: '',
                rows: [{ rowDocId: null, description: '', file: null, fileBase64: '', fileName: '', fileMime: '' }],
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
                registrationDate: existingDoc.issueDate ? existingDoc.issueDate.substring(0, 10) : '',
                expiryDate: existingDoc.expiryDate ? existingDoc.expiryDate.substring(0, 10) : '',
                fee: parsed.fee != null ? String(parsed.fee) : '',
                cardFile: null,
                cardFileBase64: '',
                cardFileName: '',
                cardFileMime: '',
                rows: (existingAttachmentRows && existingAttachmentRows.length)
                    ? existingAttachmentRows.map((r) => ({
                        rowDocId: r._id || null,
                        description: r.description || '',
                        file: null,
                        fileBase64: '',
                        fileName: '',
                        fileMime: '',
                    }))
                    : [{ rowDocId: null, description: '', file: null, fileBase64: '', fileName: '', fileMime: '' }],
            });
        } else {
            setFormData({
                registrationDate: '',
                expiryDate: '',
                fee: '',
                cardFile: null,
                cardFileBase64: '',
                cardFileName: '',
                cardFileMime: '',
                rows: [{ rowDocId: null, description: '', file: null, fileBase64: '', fileName: '', fileMime: '' }],
            });
        }
        setErrors({});
    }, [isOpen, existingDoc, isRenew, existingAttachmentRows]);

    if (!isOpen) return null;

    const handleCardFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setFormData((prev) => ({
                ...prev,
                cardFile: null,
                cardFileBase64: '',
                cardFileName: '',
                cardFileMime: '',
            }));
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            setFormData((prev) => ({
                ...prev,
                cardFile: file,
                cardFileName: file.name,
                cardFileBase64: base64,
                cardFileMime: file.type || 'application/pdf',
            }));
        };
        reader.readAsDataURL(file);
    };

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
            rows: [...prev.rows, { rowDocId: null, description: '', file: null, fileBase64: '', fileName: '', fileMime: '' }],
        }));
    };

    const removeRow = (index) => {
        setFormData((prev) => {
            if (prev.rows.length === 1) return prev;
            const next = prev.rows.filter((_, i) => i !== index);
            return { ...prev, rows: next };
        });
    };

    const validate = () => {
        const next = {};
        if (!formData.registrationDate) next.registrationDate = 'Registration date is required';
        if (!formData.expiryDate) next.expiryDate = 'Expiry date is required';
        const shouldRequireCard = isRenew || !existingDoc || !existingDoc.attachment;
        if (shouldRequireCard && !formData.cardFileBase64) {
            next.cardFile = 'Registration card attachment is required';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const mainPayload = {
            type: 'Registration',
            // Backend document API expects this field (VehicleDocumentModal sends it).
            // Defaulting to RTA to avoid server-side null handling issues.
            issueAuthority: 'RTA',
            issueDate: formData.registrationDate,
            expiryDate: formData.expiryDate,
            description: JSON.stringify({
                fee: formData.fee ? Number(formData.fee) : null,
                // Keep meta flexible; detailed attachments are saved as separate docs.
            }),
        };

        if (formData.cardFileBase64) {
            mainPayload.document = {
                name: formData.cardFileName || 'registration-card',
                data: formData.cardFileBase64,
                mimeType: formData.cardFileMime || 'application/pdf',
            };
        }

        try {
            setLoading(true);
            const shouldUpdateExisting = existingDoc?._id && !isRenew;
            if (shouldUpdateExisting) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, mainPayload);
            } else {
                await axiosInstance.post(`/AssetItem/${assetId}/document`, mainPayload);
            }

            // Save attachment rows (description + optional file). Existing rows are updated, new rows are created.
            const rows = formData.rows || [];
            for (const r of rows) {
                const descriptionText = (r.description || '').trim();
                const hasFile = !!r.fileBase64;

                // Skip empty rows to avoid creating junk documents.
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

                <form onSubmit={handleSave} className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    {/* Registration Date */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Registration Date <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="date"
                                value={formData.registrationDate}
                                onChange={(e) => setFormData((p) => ({ ...p, registrationDate: e.target.value }))}
                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${errors.registrationDate ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                disabled={loading}
                            />
                            {errors.registrationDate && <p className="text-xs text-red-500">{errors.registrationDate}</p>}
                        </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Expiry Date <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="date"
                                value={formData.expiryDate}
                                onChange={(e) => setFormData((p) => ({ ...p, expiryDate: e.target.value }))}
                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${errors.expiryDate ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                disabled={loading}
                            />
                            {errors.expiryDate && <p className="text-xs text-red-500">{errors.expiryDate}</p>}
                        </div>
                    </div>

                    {/* Registration Fee */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Registration Fee
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.fee}
                                onChange={(e) => setFormData((p) => ({ ...p, fee: e.target.value }))}
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                disabled={loading}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Attachment rows */}
                    <div className="border border-gray-100 rounded-xl px-4 py-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[14px] font-medium text-[#555555]">Attachments & Description</p>
                            <button
                                type="button"
                                onClick={addRow}
                                disabled={loading}
                                className="px-3 py-1.5 bg-[#F7F9FC] border border-[#E5E7EB] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Add
                            </button>
                        </div>

                        <div className="space-y-2">
                            {formData.rows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                    <div className="md:col-span-5">
                                        <div className="w-full h-10 flex items-center rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] px-3">
                                            <input
                                                type="file"
                                                onChange={(e) => handleRowFileChange(idx, e)}
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                disabled={loading}
                                                className="w-full text-sm text-gray-700 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white file:text-blue-600 hover:file:bg-gray-50"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-6">
                                        <input
                                            type="text"
                                            value={row.description}
                                            onChange={(e) => handleRowChange(idx, { description: e.target.value })}
                                            placeholder="Description"
                                            disabled={loading}
                                            className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                        />
                                    </div>
                                    <div className="md:col-span-1 flex items-center justify-end">
                                    {formData.rows.length > 1 && !row.rowDocId && (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(idx)}
                                                disabled={loading}
                                                className="w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex items-center justify-center"
                                                title="Remove"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Registration Card Attachment */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Registration Card <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <div className={`w-full h-10 flex items-center rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] px-3 ${errors.cardFile ? 'ring-2 ring-red-400 border-red-400' : ''}`}>
                                <input
                                    type="file"
                                    onChange={handleCardFileChange}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    disabled={loading}
                                    className="w-full text-sm text-gray-700 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white file:text-blue-600 hover:file:bg-gray-50"
                                />
                            </div>
                            {errors.cardFile && <p className="text-xs text-red-500">{errors.cardFile}</p>}
                            <p className="text-xs text-gray-400">Upload in PDF/JPG/PNG format.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-3 border-t border-gray-200 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="text-sm font-medium text-red-500 hover:text-red-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-28 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md transition-colors disabled:opacity-60"
                        >
                            {loading ? 'Saving...' : (isRenew ? 'Save' : 'Update')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

