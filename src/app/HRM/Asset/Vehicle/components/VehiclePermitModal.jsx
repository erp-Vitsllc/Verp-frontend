'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X, FileText, Eye } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from "@/components/ui/date-picker";

export default function VehiclePermitModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    existingDoc = null,
    existingAttachmentRows = [],
    isRenew = false,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [deletedDocIds, setDeletedDocIds] = useState([]);
    const [errors, setErrors] = useState({});
    
    const [formData, setFormData] = useState({
        documentType: '',
        permitName: '',
        descriptionText: '',
        issueDate: '',
        rows: [],
    });

    useEffect(() => {
        if (!isOpen) return;

        const safeAttachmentRows = existingAttachmentRows || [];

        if (existingDoc && !isRenew) {
            let meta = {};
            try {
                meta = existingDoc?.description ? JSON.parse(existingDoc.description) : {};
            } catch {
                meta = {};
            }
            const childRows = safeAttachmentRows.map((r) => ({
                rowDocId: r._id,
                description: r.description || '',
                file: null,
                fileBase64: '',
                fileName: r.attachment?.name || '',
                fileMime: r.attachment?.mimeType || '',
                hasExisting: !!r.attachment,
                isMainPermitSlot: false,
            }));
            const primaryOnMainDoc = !!existingDoc?.attachment;
            const rows = primaryOnMainDoc
                ? [
                      {
                          rowDocId: null,
                          description: 'Permit Certificate',
                          file: null,
                          fileBase64: '',
                          fileName: existingDoc.attachment?.name || 'Permit Certificate',
                          fileMime: existingDoc.attachment?.mimeType || '',
                          hasExisting: true,
                          isMainPermitSlot: true,
                      },
                      ...childRows,
                  ]
                : childRows;
            setFormData({
                documentType: meta?.documentType || '',
                permitName: meta?.permitName || meta?.permitType || '',
                descriptionText: meta?.descriptionText || '',
                issueDate: existingDoc?.issueDate ? String(existingDoc.issueDate).substring(0, 10) : '',
                rows,
            });
        } else {
            setFormData({
                documentType: '',
                permitName: '',
                descriptionText: '',
                issueDate: '',
                rows: [],
            });
        }
        setDeletedDocIds([]);
        setErrors({});
    }, [isOpen, existingDoc, isRenew, existingAttachmentRows]);

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
            rows: [
                ...prev.rows,
                {
                    rowDocId: null,
                    description: '',
                    file: null,
                    fileBase64: '',
                    fileName: '',
                    fileMime: '',
                    hasExisting: false,
                    isMainPermitSlot: false,
                },
            ],
        }));
    };

    const removeRow = (index) => {
        const row = formData.rows[index];
        if (row.isMainPermitSlot) return;
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
        if (!formData.documentType.trim()) next.documentType = 'Document type is required';
        if (!formData.permitName.trim()) next.permitName = 'Permit name is required';
        if (!formData.issueDate) next.issueDate = 'Issue date is required';
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

            const isRenewWithExisting = Boolean(existingDoc?._id && isRenew);
            const mainPayload = {
                type: 'Permit',
                issueAuthority: 'RTA',
                issueDate: formData.issueDate,
                description: JSON.stringify({
                    documentType: formData.documentType.trim(),
                    permitName: formData.permitName.trim(),
                    descriptionText: formData.descriptionText.trim(),
                    ...(isRenewWithExisting
                        ? {
                              renewedFrom: existingDoc._id,
                              renewedAt: new Date().toISOString(),
                          }
                        : {}),
                }),
            };

            const mainSlotIdx = formData.rows.findIndex((r) => r.isMainPermitSlot);
            const primaryFileRow =
                mainSlotIdx >= 0 ? formData.rows[mainSlotIdx] : formData.rows[0];
            if (primaryFileRow?.fileBase64) {
                mainPayload.document = {
                    name: primaryFileRow.fileName || 'permit-doc',
                    data: primaryFileRow.fileBase64,
                    mimeType: primaryFileRow.fileMime || 'application/pdf',
                };
            }

            if (existingDoc?._id && !isRenew) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, mainPayload);
            } else {
                await axiosInstance.post(`/AssetItem/${assetId}/document`, mainPayload);
            }

            const firstRowUsedAsPrimaryAttachment = Boolean(primaryFileRow?.fileBase64);
            let startIndex = 0;
            if (mainSlotIdx >= 0) {
                startIndex = mainSlotIdx + 1;
            } else if (firstRowUsedAsPrimaryAttachment) {
                startIndex = 1;
            }
            for (let i = startIndex; i < formData.rows.length; i++) {
                const r = formData.rows[i];
                const desc = (r.description || '').trim();
                const hasFile = !!r.fileBase64;
                if (!desc && !hasFile) continue;

                const rowPayload = {
                    type: 'Permit Attachment',
                    issueAuthority: 'RTA',
                    description: desc || 'Permit Document',
                };

                if (hasFile) {
                    rowPayload.document = {
                        name: r.fileName || 'permit-attachment',
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

            toast({ title: 'Saved', description: 'Permit saved successfully.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving permit', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save permit.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[85vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {isRenew ? 'Renew Permit' : existingDoc ? 'Edit Permit' : 'Add Permit'}
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

                <form onSubmit={handleSave} className="space-y-4 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                Document Type <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.documentType}
                                onChange={(e) => setFormData(p => ({ ...p, documentType: e.target.value }))}
                                placeholder="Enter document type"
                                className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${errors.documentType ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                disabled={loading}
                            />
                            {errors.documentType && <p className="text-[11px] font-medium text-red-500 mt-1 px-1">{errors.documentType}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                Permit Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.permitName}
                                onChange={(e) => setFormData(p => ({ ...p, permitName: e.target.value }))}
                                placeholder="Enter permit name"
                                className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${errors.permitName ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                disabled={loading}
                            />
                            {errors.permitName && <p className="text-[11px] font-medium text-red-500 mt-1 px-1">{errors.permitName}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                Discription
                            </label>
                            <textarea
                                value={formData.descriptionText}
                                onChange={(e) => setFormData(p => ({ ...p, descriptionText: e.target.value }))}
                                placeholder="Enter discription"
                                className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                Issue Date <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                value={formData.issueDate || ''}
                                onChange={(date) => setFormData((p) => ({ ...p, issueDate: date }))}
                                placeholder="Pick issue date"
                                className={`w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-100/50 transition-all ${errors.issueDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                disabled={loading}
                            />
                            {errors.issueDate && <p className="text-[11px] font-medium text-red-500 mt-1 px-1">{errors.issueDate}</p>}
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[15px] font-black text-slate-900 uppercase tracking-widest">Documents</h4>
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
                                            placeholder="e.g. Permit Page 1, Permit Scan..."
                                            disabled={loading || row.isMainPermitSlot}
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
                                            disabled={loading || row.isMainPermitSlot}
                                            className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100 disabled:opacity-40 disabled:pointer-events-none"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {formData.rows.length === 0 && (
                                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No documents added yet</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Click "+ Add More" to upload files</p>
                                </div>
                            )}
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
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
