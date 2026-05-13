'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

export default function VehicleInsuranceModal({
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
        insuranceCompany: '',
        policyNumber: '',
        premiumAmount: '',
        excessCharge: '',
        startDate: '',
        expiryDate: '',
        documents: [
            { id: null, name: 'Insurance Certificate', file: null, fileBase64: '', fileName: '', fileMime: '', mandatory: true, hasExisting: false },
        ],
    });

    const [errors, setErrors] = useState({});

    const vendorOptions = [
        'Al Sagr National Insurance',
        'Emirates Insurance',
        'AXA Insurance',
        'Oman Insurance',
        'Sukoon Insurance',
        'Noor Takaful',
        'Alliance Insurance',
        'RSA Insurance',
    ];

    useEffect(() => {
        if (!isOpen) return;

        const defaultDocs = [
            { id: null, name: 'Insurance Certificate', file: null, fileBase64: '', fileName: '', fileMime: '', mandatory: true, hasExisting: false },
        ];

        if (isRenew) {
            setFormData({
                insuranceCompany: '',
                policyNumber: '',
                premiumAmount: '',
                excessCharge: '',
                startDate: '',
                expiryDate: '',
                documents: defaultDocs,
            });
            setDeletedDocIds([]);
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

            // Map existing attachments
            const otherDocs = (existingAttachmentRows || []).map(r => ({
                id: r._id,
                name: r.description || 'Additional Document',
                file: null,
                fileBase64: '',
                fileName: r.attachment ? 'Click to upload' : '',
                fileMime: '',
                mandatory: false,
                hasExisting: !!r.attachment
            }));

            const filteredOtherDocs = otherDocs.filter(
                (d) => !String(d.name || '').toLowerCase().includes('invoice')
            );

            setFormData({
                insuranceCompany: parsed.company || '',
                policyNumber: parsed.policy || '',
                premiumAmount: parsed.premiumAmount || parsed.value || '',
                excessCharge: parsed.excessCharge || '',
                startDate: existingDoc.issueDate ? String(existingDoc.issueDate).substring(0, 10) : '',
                expiryDate: existingDoc.expiryDate ? String(existingDoc.expiryDate).substring(0, 10) : '',
                documents: [
                    {
                        id: existingDoc._id,
                        name: 'Insurance Certificate',
                        file: null,
                        fileBase64: '',
                        fileName: existingDoc.attachment ? 'Click to upload' : '',
                        fileMime: '',
                        mandatory: true,
                        hasExisting: !!existingDoc.attachment,
                    },
                    ...filteredOtherDocs,
                ],
            });
            setDeletedDocIds([]);
            setErrors({});
            return;
        }

        setFormData({
            insuranceCompany: '',
            policyNumber: '',
            premiumAmount: '',
            excessCharge: '',
            startDate: '',
            expiryDate: '',
            documents: defaultDocs,
        });
        setDeletedDocIds([]);
        setErrors({});
    }, [isOpen, existingDoc, isRenew, existingAttachmentRows]);

    if (!isOpen) return null;

    const handleFileChange = (e, field) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            setFormData((prev) => ({
                ...prev,
                [`${field}File`]: file,
                [`${field}FileName`]: file.name,
                [`${field}FileBase64`]: base64,
                [`${field}FileMime`]: file.type || 'application/pdf',
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleDocChange = (index, patch) => {
        setFormData((prev) => {
            const next = [...prev.documents];
            next[index] = { ...next[index], ...patch };
            return { ...prev, documents: next };
        });
    };

    const handleDocFileChange = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            handleDocChange(index, {
                file,
                fileBase64: base64,
                fileName: file.name,
                fileMime: file.type || 'application/pdf',
            });
        };
        reader.readAsDataURL(file);
    };

    const addDoc = () => {
        setFormData((prev) => ({
            ...prev,
            documents: [...prev.documents, { id: null, name: '', file: null, fileBase64: '', fileName: '', fileMime: '', mandatory: false, hasExisting: false }],
        }));
    };

    const removeDoc = (index) => {
        const doc = formData.documents[index];
        if (doc.mandatory) return; // Cannot remove mandatory ones
        
        if (doc.id) {
            setDeletedDocIds((prev) => [...prev, doc.id]);
        }

        setFormData((prev) => ({
            ...prev,
            documents: prev.documents.filter((_, i) => i !== index),
        }));
    };

    const validate = () => {
        const next = {};
        if (!formData.startDate) next.startDate = 'Start date is required';
        if (!formData.expiryDate) next.expiryDate = 'Expiry date is required';
        if (!formData.insuranceCompany) next.insuranceCompany = 'Insurance company is required';
        if (!formData.policyNumber) next.policyNumber = 'Policy number is required';
        
        // Check mandatory documents
        formData.documents.forEach((doc, idx) => {
            if (doc.mandatory) {
                const hasAttachment = doc.fileBase64 || doc.hasExisting;
                if (!hasAttachment) {
                    next[`doc_${idx}`] = `${doc.name} attachment is required`;
                }
            }
        });

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            setLoading(true);

            // 0. Remove legacy insurance-invoice attachments, then user-marked deletions
            const invoiceAttachmentIds = (existingAttachmentRows || [])
                .filter((r) => String(r?.description || '').toLowerCase().includes('invoice'))
                .map((r) => r._id)
                .filter(Boolean);
            const deleteIds = [...new Set([...(deletedDocIds || []), ...invoiceAttachmentIds].map(String))];

            for (const id of deleteIds) {
                try {
                    await axiosInstance.delete(`/AssetItem/${assetId}/document/${id}`);
                } catch (err) {
                    console.error("Failed to delete document:", id, err);
                }
            }
            
            // 1. Prepare Primary Insurance Doc (Certificate is usually the main one)
            const certificateDoc = formData.documents[0]; // Convention: 0 is certificate
            const mainPayload = {
                type: 'Insurance',
                issueAuthority: 'Insurance Company',
                issueDate: formData.startDate,
                expiryDate: formData.expiryDate,
                description: JSON.stringify({
                    company: formData.insuranceCompany,
                    policy: formData.policyNumber,
                    premiumAmount: formData.premiumAmount ? Number(formData.premiumAmount) : null,
                    excessCharge: formData.excessCharge ? Number(formData.excessCharge) : null,
                }),
            };

            if (certificateDoc.fileBase64) {
                mainPayload.document = {
                    name: certificateDoc.fileName || 'insurance-certificate',
                    data: certificateDoc.fileBase64,
                    mimeType: certificateDoc.fileMime || 'application/pdf',
                };
            }

            const shouldUpdateExisting = certificateDoc.id && !isRenew;
            if (shouldUpdateExisting) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${certificateDoc.id}`, mainPayload);
            } else {
                await axiosInstance.post(`/AssetItem/${assetId}/document`, mainPayload);
            }

            // 2. Save Remaining Documents
            const otherDocs = formData.documents.slice(1);
            for (const doc of otherDocs) {
                const hasFile = !!doc.fileBase64;
                const hasId = !!doc.id;
                
                // If it's a new entry and no file, skip (unless it's mandatory and validated)
                if (!hasFile && !hasId) continue;

                const rowPayload = {
                    type: 'Insurance Attachment',
                    issueAuthority: 'Insurance Company',
                    issueDate: formData.startDate,
                    expiryDate: formData.expiryDate,
                    description: doc.name || 'Insurance Document',
                };

                if (hasFile) {
                    rowPayload.document = {
                        name: doc.fileName || 'insurance-attachment',
                        data: doc.fileBase64,
                        mimeType: doc.fileMime || 'application/pdf',
                    };
                }

                if (hasId && !isRenew) {
                    await axiosInstance.put(`/AssetItem/${assetId}/document/${doc.id}`, rowPayload);
                } else {
                    await axiosInstance.post(`/AssetItem/${assetId}/document`, rowPayload);
                }
            }

            toast({ title: 'Saved', description: 'Insurance details saved successfully.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving insurance', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save insurance details.',
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
                        {isRenew ? 'Renew Insurance' : 'Insurance Details'}
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
                    
                    {/* Row 1: Company & Policy */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Insurance Company <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.insuranceCompany}
                                onChange={(e) => setFormData(p => ({ ...p, insuranceCompany: e.target.value }))}
                                className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${errors.insuranceCompany ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                disabled={loading}
                            >
                                <option value="">Select Insurance Company...</option>
                                {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            {errors.insuranceCompany && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.insuranceCompany}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Insurance Policy <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.policyNumber}
                                onChange={(e) => setFormData(p => ({ ...p, policyNumber: e.target.value }))}
                                className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${errors.policyNumber ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                disabled={loading}
                                placeholder="Enter policy number"
                            />
                            {errors.policyNumber && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.policyNumber}</p>}
                        </div>
                    </div>

                    {/* Row 2: Premium & Excess */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Insurance Premium Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">AED</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.premiumAmount}
                                    onChange={(e) => setFormData(p => ({ ...p, premiumAmount: e.target.value }))}
                                    className="w-full h-11 pl-14 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-semibold"
                                    disabled={loading}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Insurance Excess Charge
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">AED</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.excessCharge}
                                    onChange={(e) => setFormData(p => ({ ...p, excessCharge: e.target.value }))}
                                    className="w-full h-11 pl-14 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-semibold"
                                    disabled={loading}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 3: From - To Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Insurance Start Date <span className="text-red-500">*</span>
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
                                Insurance End Date <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                value={formData.expiryDate}
                                onChange={(date) => setFormData(p => ({ ...p, expiryDate: date }))}
                                placeholder="Pick end date"
                                className={`w-full h-11 border-slate-200 bg-slate-50 text-slate-800 ${errors.expiryDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                            />
                            {errors.expiryDate && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.expiryDate}</p>}
                        </div>
                    </div>

                    {/* Documents Section */}
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[15px] font-black text-slate-900 uppercase tracking-widest">Insurance Documents</h4>
                            <button
                                type="button"
                                onClick={addDoc}
                                disabled={loading}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Add More
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {formData.documents.map((doc, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-2 p-3 rounded-xl bg-white border border-slate-100 shadow-sm relative group">
                                    <div className="flex-1 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                            Name {doc.mandatory && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={doc.name}
                                            onChange={(e) => handleDocChange(idx, { name: e.target.value })}
                                            placeholder="e.g. Coverage Details, Terms..."
                                            disabled={loading || doc.mandatory}
                                            className={`w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none ${doc.mandatory ? 'opacity-70' : ''}`}
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                            Attachment {doc.mandatory && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className={`relative h-9 flex items-center rounded-lg border ${errors[`doc_${idx}`] ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} px-3 cursor-pointer hover:bg-blue-50/50 transition-colors`}>
                                            <input
                                                type="file"
                                                onChange={(e) => handleDocFileChange(idx, e)}
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                disabled={loading}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <span className="text-[11px] font-bold text-slate-600 truncate">
                                                {doc.fileName || 'Click to upload'}
                                            </span>
                                        </div>
                                        {errors[`doc_${idx}`] && <p className="text-[10px] font-medium text-red-500 mt-1">{errors[`doc_${idx}`]}</p>}
                                    </div>
                                    {!doc.mandatory && (
                                        <div className="flex items-end pb-0.5">
                                            <button
                                                type="button"
                                                onClick={() => removeDoc(idx)}
                                                disabled={loading}
                                                className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
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
