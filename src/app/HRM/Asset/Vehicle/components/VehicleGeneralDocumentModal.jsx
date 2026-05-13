'use client';

import { useEffect, useState, useRef } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

const RESERVED_TYPES = new Set([
    'registration',
    'registration attachment',
    'insurance',
    'insurance attachment',
    'warranty',
    'warranty attachment',
    'permit',
    'permit attachment',
    'petrol',
    'petrol attachment',
    'toll',
    'toll attachment',
    'service',
    'basic detail attachment',
]);

const normType = (t) => String(t || '').toLowerCase().trim();

const descriptionForForm = (doc) => {
    const raw = doc?.description;
    if (!raw) return '';
    try {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object' && !Array.isArray(p) && p.note != null) return String(p.note);
    } catch {
        /* plain text */
    }
    return String(raw);
};

export default function VehicleGeneralDocumentModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    existingDoc = null,
    isRenew = false,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const fileRef = useRef(null);
    const [form, setForm] = useState({
        type: '',
        description: '',
        issueAuthority: '',
        issueDate: '',
        expiryDate: '',
        hasExpiry: true,
        fileName: '',
        fileBase64: '',
        fileMime: '',
    });

    useEffect(() => {
        if (!isOpen) return;
        if (existingDoc && isRenew) {
            setForm({
                type: existingDoc.type || '',
                description: '',
                issueAuthority: '',
                issueDate: '',
                expiryDate: '',
                hasExpiry: true,
                fileName: '',
                fileBase64: '',
                fileMime: '',
            });
        } else if (existingDoc && !isRenew) {
            setForm({
                type: existingDoc.type || '',
                description: descriptionForForm(existingDoc),
                issueAuthority: existingDoc.issueAuthority || '',
                issueDate: existingDoc.issueDate ? String(existingDoc.issueDate).substring(0, 10) : '',
                expiryDate: existingDoc.expiryDate ? String(existingDoc.expiryDate).substring(0, 10) : '',
                hasExpiry: !!existingDoc.expiryDate,
                fileName: '',
                fileBase64: '',
                fileMime: '',
            });
        } else {
            setForm({
                type: '',
                description: '',
                issueAuthority: '',
                issueDate: '',
                expiryDate: '',
                hasExpiry: true,
                fileName: '',
                fileBase64: '',
                fileMime: '',
            });
        }
        setErrors({});
    }, [isOpen, existingDoc, isRenew]);

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            setForm((p) => ({
                ...p,
                fileName: file.name,
                fileBase64: base64,
                fileMime: file.type || 'application/pdf',
            }));
        };
        reader.readAsDataURL(file);
    };

    const validate = () => {
        const e = {};
        const t = String(form.type || '').trim();
        if (!t) e.type = 'Document type is required';
        else {
            const typeUnchanged =
                existingDoc && !isRenew && normType(t) === normType(existingDoc.type);
            if (RESERVED_TYPES.has(normType(t)) && !typeUnchanged) {
                e.type =
                    'This document type is reserved for structured sections (registration, insurance, etc.). Choose another name.';
            }
        }
        if (!String(form.description || '').trim()) e.description = 'Description is required';
        if (form.hasExpiry) {
            if (!form.expiryDate) e.expiryDate = 'Expiry date is required when “Has expiry” is Yes';
            else if (form.issueDate && new Date(form.expiryDate) <= new Date(form.issueDate)) {
                e.expiryDate = 'Expiry must be after issue date';
            }
        }
        const needFile = !existingDoc || isRenew;
        if (needFile && !form.fileBase64) e.file = 'Attachment is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate() || !assetId) return;
        setLoading(true);
        try {
            const isRenewWithExisting = Boolean(existingDoc?._id && isRenew);
            let descriptionValue = String(form.description || '').trim();
            if (isRenewWithExisting) {
                descriptionValue = JSON.stringify({
                    note: descriptionValue,
                    renewedFrom: existingDoc._id,
                    renewedAt: new Date().toISOString(),
                });
            }

            const payload = {
                type: String(form.type || '').trim(),
                issueAuthority: String(form.issueAuthority || '').trim() || null,
                issueDate: form.issueDate ? String(form.issueDate).substring(0, 10) : null,
                expiryDate: form.hasExpiry && form.expiryDate ? String(form.expiryDate).substring(0, 10) : null,
                description: descriptionValue || null,
            };
            if (form.fileBase64) {
                payload.document = {
                    name: form.fileName || 'document',
                    data: form.fileBase64,
                    mimeType: form.fileMime || 'application/pdf',
                };
            }

            if (existingDoc && !isRenew) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, payload);
                toast({ title: 'Saved', description: 'Document updated.' });
            } else {
                await axiosInstance.post(`/AssetItem/${assetId}/document`, payload);
                toast({
                    title: 'Saved',
                    description: isRenew ? 'Document renewed.' : 'Document added.',
                });
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to save document.',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const title = isRenew ? 'Renew document' : existingDoc ? 'Edit document' : 'Add document';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={loading ? undefined : onClose} />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        ×
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="space-y-3 px-6 py-4 overflow-y-auto flex-1 modal-scroll">
                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Document type <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.type}
                                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                                className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${errors.type ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                                placeholder="e.g. Memo, NOC, Letter"
                                disabled={loading || isRenew}
                            />
                            {errors.type && <p className="text-xs text-red-500">{errors.type}</p>}
                        </div>

                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                className={`w-full min-h-[90px] px-3 py-2 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${errors.description ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                                placeholder="Enter document description"
                                disabled={loading}
                            />
                            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                        </div>

                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Issuing authority <span className="text-gray-400 text-xs font-normal">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.issueAuthority}
                                onChange={(e) => setForm((p) => ({ ...p, issueAuthority: e.target.value }))}
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800"
                                placeholder="e.g. RTA, Bank"
                                disabled={loading}
                            />
                        </div>

                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Issue date <span className="text-gray-400 text-xs font-normal">(optional)</span>
                            </label>
                            <DatePicker
                                value={form.issueDate || ''}
                                onChange={(date) => setForm((p) => ({ ...p, issueDate: date || '' }))}
                                className="bg-[#F7F9FC] border-[#E5E7EB]"
                                disabled={loading}
                            />
                            {errors.issueDate && <p className="text-xs text-red-500">{errors.issueDate}</p>}
                        </div>

                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Has expiry date? <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setForm((p) => ({ ...p, hasExpiry: true }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${form.hasExpiry ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    disabled={loading}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm((p) => ({ ...p, hasExpiry: false, expiryDate: '' }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${!form.hasExpiry ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    disabled={loading}
                                >
                                    No
                                </button>
                            </div>
                        </div>

                        {form.hasExpiry && (
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Expiry date <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    value={form.expiryDate || ''}
                                    onChange={(date) => setForm((p) => ({ ...p, expiryDate: date || '' }))}
                                    className={`bg-[#F7F9FC] ${errors.expiryDate ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={loading}
                                />
                                {errors.expiryDate && <p className="text-xs text-red-500">{errors.expiryDate}</p>}
                            </div>
                        )}

                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Attachment{' '}
                                {(!existingDoc || isRenew) && <span className="text-red-500">*</span>}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFile}
                                    className="hidden"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={loading}
                                    className={`px-4 py-2 bg-white border rounded-lg text-blue-600 font-medium text-sm hover:bg-gray-50 ${errors.file ? 'border-red-400' : 'border-gray-300'}`}
                                >
                                    Choose file
                                </button>
                                <input
                                    type="text"
                                    readOnly
                                    value={
                                        form.fileName ||
                                        (existingDoc && !isRenew ? 'Current file on record (optional replace)' : '')
                                    }
                                    className="flex-1 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-600 text-sm"
                                    placeholder="No file chosen"
                                />
                            </div>
                            {errors.file && <p className="text-xs text-red-500">{errors.file}</p>}
                            <p className="text-xs text-gray-500">PDF or image. Required for new documents and renewals.</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-600 hover:text-gray-800 font-semibold text-sm"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving…' : isRenew ? 'Renew' : existingDoc ? 'Update' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
