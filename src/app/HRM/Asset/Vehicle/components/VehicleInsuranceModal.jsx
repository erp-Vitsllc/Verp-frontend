'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { saveVehicleSectionOrQueue } from '../lib/vehicleProfileEditOps';
import {
    PDF_FILE_ACCEPT,
    isInvoiceDocumentLabel,
    isPdfUploadFile,
    insuranceInvoiceAttachmentForDoc,
} from '../utils/vehicleDocumentCardRows';

const emptyInvoiceRow = () => ({
    rowDocId: null,
    file: null,
    fileBase64: '',
    fileName: '',
    fileMime: '',
    hasExisting: false,
});

const mapInvoiceAttachmentToRow = (doc) => ({
    rowDocId: doc?._id || null,
    file: null,
    fileBase64: '',
    fileName: doc?.attachment ? 'Existing invoice — click to replace' : '',
    fileMime: '',
    hasExisting: !!doc?.attachment,
});

export default function VehicleInsuranceModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    asset = null,
    existingDoc,
    isRenew = false,
    existingAttachmentRows = [],
    hrMayApplyDirectly = false,
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
        documents: [],
        invoice: emptyInvoiceRow(),
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

        if (isRenew) {
            setFormData({
                insuranceCompany: '',
                policyNumber: '',
                premiumAmount: '',
                excessCharge: '',
                startDate: '',
                expiryDate: '',
                documents: [],
                invoice: emptyInvoiceRow(),
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
            const otherDocs = (existingAttachmentRows || [])
                .filter((r) => !!r.attachment)
                .map((r) => ({
                    id: r._id,
                    name: String(r.description || '').trim(),
                    file: null,
                    fileBase64: '',
                    fileName: 'Existing file — click to replace',
                    fileMime: '',
                    hasExisting: true,
                }));

            const filteredOtherDocs = otherDocs.filter(
                (d) => !isInvoiceDocumentLabel(d.name),
            );
            const invoiceDoc =
                insuranceInvoiceAttachmentForDoc(existingDoc, asset?.documents || []) ||
                insuranceInvoiceAttachmentForDoc(existingDoc, existingAttachmentRows);

            setFormData({
                insuranceCompany: parsed.company || '',
                policyNumber: parsed.policy || '',
                premiumAmount: parsed.premiumAmount || parsed.value || '',
                excessCharge: parsed.excessCharge || '',
                startDate: existingDoc.issueDate ? String(existingDoc.issueDate).substring(0, 10) : '',
                expiryDate: existingDoc.expiryDate ? String(existingDoc.expiryDate).substring(0, 10) : '',
                documents: filteredOtherDocs,
                invoice: invoiceDoc ? mapInvoiceAttachmentToRow(invoiceDoc) : emptyInvoiceRow(),
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
            documents: [],
            invoice: emptyInvoiceRow(),
        });
        setDeletedDocIds([]);
        setErrors({});
    }, [isOpen, existingDoc, isRenew, existingAttachmentRows, asset?.documents]);

    if (!isOpen) return null;

    const handleDocChange = (index, patch) => {
        setFormData((prev) => {
            const next = [...prev.documents];
            next[index] = { ...next[index], ...patch };
            return { ...prev, documents: next };
        });
    };

    const handleDocFileChange = (index, e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const doc = formData.documents[index];
        if (isInvoiceDocumentLabel(doc?.name) && !isPdfUploadFile(file)) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Invoice must be a PDF file.',
            });
            return;
        }
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

    const handleInvoiceFileChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) {
            setFormData((prev) => ({ ...prev, invoice: emptyInvoiceRow() }));
            return;
        }
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
            const base64 = String(reader.result || '').split(',')[1] || '';
            setFormData((prev) => ({
                ...prev,
                invoice: {
                    ...prev.invoice,
                    file,
                    fileBase64: base64,
                    fileName: file.name,
                    fileMime: file.type || 'application/pdf',
                    hasExisting: false,
                },
            }));
        };
        reader.readAsDataURL(file);
    };

    const addDoc = () => {
        setFormData((prev) => ({
            ...prev,
            documents: [
                ...prev.documents,
                {
                    id: null,
                    name: '',
                    file: null,
                    fileBase64: '',
                    fileName: '',
                    fileMime: '',
                    hasExisting: false,
                },
            ],
        }));
    };

    const removeDoc = (index) => {
        const doc = formData.documents[index];

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

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            setLoading(true);

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

            const steps = [];
            for (const id of deletedDocIds) {
                steps.push({ op: 'delete_document', docId: id });
            }

            const mainInsuranceDocId = existingDoc?._id;
            if (mainInsuranceDocId && !isRenew) {
                steps.push({
                    op: 'put_document',
                    docId: mainInsuranceDocId,
                    body: mainPayload,
                });
            } else {
                steps.push({ op: 'post_document', body: mainPayload });
            }

            for (const doc of formData.documents) {
                const hasFile = !!doc.fileBase64;
                const hasId = !!doc.id;
                const docName = String(doc.name || '').trim();
                if (!hasFile || !docName) continue;
                if (isInvoiceDocumentLabel(docName)) continue;

                const rowPayload = {
                    type: 'Insurance Attachment',
                    issueAuthority: 'Insurance Company',
                    issueDate: formData.startDate,
                    expiryDate: formData.expiryDate,
                    description: docName,
                    document: {
                        name: doc.fileName || 'insurance-attachment',
                        data: doc.fileBase64,
                        mimeType: doc.fileMime || 'application/pdf',
                    },
                };

                if (hasId && !isRenew) {
                    steps.push({ op: 'put_document', docId: doc.id, body: rowPayload });
                } else {
                    steps.push({ op: 'post_document', body: rowPayload });
                }
            }

            const invoiceRow = formData.invoice;
            if (invoiceRow?.fileBase64) {
                const invoicePayload = {
                    type: 'Insurance Attachment',
                    issueAuthority: 'Insurance Company',
                    issueDate: formData.startDate,
                    expiryDate: formData.expiryDate,
                    description: 'Invoice',
                    document: {
                        name: invoiceRow.fileName || 'insurance-invoice.pdf',
                        data: invoiceRow.fileBase64,
                        mimeType: invoiceRow.fileMime || 'application/pdf',
                    },
                };
                if (invoiceRow.rowDocId && !isRenew) {
                    steps.push({ op: 'put_document', docId: invoiceRow.rowDocId, body: invoicePayload });
                } else {
                    steps.push({ op: 'post_document', body: invoicePayload });
                }
            }

            const result = await saveVehicleSectionOrQueue({
                asset,
                assetId,
                sectionId: 'insurance',
                action: isRenew ? 'renew' : 'edit',
                steps,
                documentId: existingDoc?._id || null,
                hrMayApplyDirectly,
            });

            if (result.queued) {
                toast({
                    title: 'Submitted for HR review',
                    description: isRenew
                        ? 'Insurance renewal will apply after HR approval. The current policy stays live until then.'
                        : 'Insurance changes will apply after HR approval.',
                });
            } else {
                toast({
                    title: isRenew ? 'Insurance renewed' : 'Saved',
                    description: isRenew
                        ? 'New insurance is live. The previous policy was moved to Old Documents.'
                        : 'Insurance details saved successfully.',
                });
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
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

                    <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                            Invoice Upload
                        </label>
                        <div className="relative h-11 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 cursor-pointer hover:bg-blue-50/50 transition-colors">
                            <input
                                type="file"
                                onChange={handleInvoiceFileChange}
                                accept={PDF_FILE_ACCEPT}
                                disabled={loading}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <span className="text-[12px] font-bold text-slate-600 truncate">
                                {formData.invoice?.fileName || 'Click to upload PDF invoice'}
                            </span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 px-1">PDF only</p>
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
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            value={doc.name}
                                            onChange={(e) => handleDocChange(idx, { name: e.target.value })}
                                            placeholder="Document name"
                                            disabled={loading}
                                            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                            Attachment
                                        </label>
                                        <div className={`relative h-9 flex items-center rounded-lg border ${errors[`doc_${idx}`] ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'} px-3 cursor-pointer hover:bg-blue-50/50 transition-colors`}>
                                            <input
                                                type="file"
                                                onChange={(e) => handleDocFileChange(idx, e)}
                                                accept={isInvoiceDocumentLabel(doc.name) ? PDF_FILE_ACCEPT : '.pdf,.jpg,.jpeg,.png'}
                                                disabled={loading}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <span className="text-[11px] font-bold text-slate-600 truncate">
                                                {doc.fileBase64
                                                    ? doc.fileName
                                                    : doc.hasExisting
                                                      ? doc.fileName || 'Existing file — click to replace'
                                                      : 'Click to upload'}
                                            </span>
                                        </div>
                                        {errors[`doc_${idx}`] && <p className="text-[10px] font-medium text-red-500 mt-1">{errors[`doc_${idx}`]}</p>}
                                    </div>
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
