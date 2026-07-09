'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { PDF_FILE_ACCEPT, isPdfUploadFile } from '../utils/vehicleDocumentCardRows';

const CERTIFICATE_LABEL = 'Warranty Certificate';

const emptyCertificate = () => ({
    rowDocId: null,
    file: null,
    fileBase64: '',
    fileName: '',
    fileMime: '',
    hasExisting: false,
});

export default function VehicleWarrantyModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    existingDoc,
    isRenew = false,
    existingAttachmentRows = [],
    excludedCoverageTypes = [],
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [deletedDocIds, setDeletedDocIds] = useState([]);

    const [formData, setFormData] = useState({
        warrantyBy: '',
        warrantyCovered: [],
        startDate: '',
        endDate: '',
        currentKm: '',
        endKm: '',
        certificate: emptyCertificate(),
        extraRows: [],
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

    const splitAttachments = (rows) => {
        const list = rows || [];
        const cert =
            list.find(
                (r) =>
                    String(r.description || '')
                        .trim()
                        .toLowerCase() === CERTIFICATE_LABEL.toLowerCase(),
            ) || null;
        const extras = list.filter((r) => r !== cert);
        return { cert, extras };
    };

    const mapAttachmentRow = (r) => ({
        rowDocId: r._id,
        description: r.description || '',
        file: null,
        fileBase64: '',
        fileName: r.attachment ? 'Existing file — click to replace' : '',
        fileMime: '',
        hasExisting: !!r.attachment,
    });

    const mapCertificate = (r) =>
        r
            ? {
                  rowDocId: r._id,
                  file: null,
                  fileBase64: '',
                  fileName: r.attachment ? 'Existing file — click to replace' : '',
                  fileMime: '',
                  hasExisting: !!r.attachment,
              }
            : emptyCertificate();

    const loadFromParsed = (existing, parsed, attachmentRows) => {
        const { cert, extras } = splitAttachments(attachmentRows);
        return {
            warrantyBy: parsed.warrantyBy || '',
            warrantyCovered: Array.isArray(parsed.warrantyCovered) ? parsed.warrantyCovered : [],
            startDate: existing.issueDate ? String(existing.issueDate).substring(0, 10) : '',
            endDate: existing.expiryDate ? String(existing.expiryDate).substring(0, 10) : '',
            currentKm:
                parsed.currentKm != null
                    ? String(parsed.currentKm)
                    : parsed.km != null
                      ? String(parsed.km)
                      : '',
            endKm: parsed.endKm != null ? String(parsed.endKm) : '',
            certificate: mapCertificate(cert),
            extraRows: extras.map(mapAttachmentRow),
        };
    };

    useEffect(() => {
        if (!isOpen) return;

        if (isRenew) {
            setFormData({
                warrantyBy: '',
                warrantyCovered: [],
                startDate: '',
                endDate: '',
                currentKm: '',
                endKm: '',
                certificate: emptyCertificate(),
                extraRows: [],
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
            setFormData(loadFromParsed(existingDoc, parsed, existingAttachmentRows));
        } else {
            setFormData({
                warrantyBy: '',
                warrantyCovered: [],
                startDate: '',
                endDate: '',
                currentKm: '',
                endKm: '',
                certificate: emptyCertificate(),
                extraRows: [],
            });
        }
        setDeletedDocIds([]);
        setErrors({});
    }, [isOpen, existingDoc, isRenew, existingAttachmentRows]);

    if (!isOpen) return null;

    const handleExtraChange = (index, patch) => {
        setFormData((prev) => {
            const next = [...prev.extraRows];
            next[index] = { ...next[index], ...patch };
            return { ...prev, extraRows: next };
        });
    };

    const readFile = (file, onDone) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            onDone({
                file,
                fileBase64: base64,
                fileName: file.name,
                fileMime: file.type || 'application/pdf',
            });
        };
        reader.readAsDataURL(file);
    };

    const handleCertificateFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!isPdfUploadFile(file)) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Only PDF files are allowed.',
            });
            e.target.value = '';
            return;
        }
        readFile(file, (patch) =>
            setFormData((p) => ({ ...p, certificate: { ...p.certificate, ...patch } })),
        );
    };

    const handleExtraFile = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!isPdfUploadFile(file)) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Only PDF files are allowed.',
            });
            e.target.value = '';
            return;
        }
        readFile(file, (patch) => handleExtraChange(index, patch));
    };

    const addExtraRow = () => {
        setFormData((prev) => ({
            ...prev,
            extraRows: [
                ...prev.extraRows,
                {
                    rowDocId: null,
                    description: '',
                    file: null,
                    fileBase64: '',
                    fileName: '',
                    fileMime: '',
                    hasExisting: false,
                },
            ],
        }));
    };

    const removeExtraRow = (index) => {
        const row = formData.extraRows[index];
        if (row.rowDocId) setDeletedDocIds((prev) => [...prev, row.rowDocId]);
        setFormData((prev) => ({
            ...prev,
            extraRows: prev.extraRows.filter((_, i) => i !== index),
        }));
    };

    const removeCertificate = () => {
        const { certificate } = formData;
        if (certificate.rowDocId) setDeletedDocIds((prev) => [...prev, certificate.rowDocId]);
        setFormData((p) => ({ ...p, certificate: emptyCertificate() }));
    };

    const validate = () => {
        const next = {};
        if (!formData.startDate) next.startDate = 'Start date is required';
        if (!formData.endDate) next.endDate = 'End date is required';
        if (!formData.warrantyBy) next.warrantyBy = 'Warranty provider is required';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const saveAttachment = async (row, description) => {
        const desc = String(description || '').trim();
        const hasFile = !!row.fileBase64;
        if (!hasFile || !desc) return;

        const mime = row.fileMime || 'application/pdf';
        const dataPayload = row.fileBase64.startsWith('data:')
            ? row.fileBase64
            : `data:${mime};base64,${row.fileBase64}`;

        const rowPayload = {
            type: 'Warranty Attachment',
            issueAuthority: 'Warranty Provider',
            issueDate: formData.startDate,
            expiryDate: formData.endDate,
            description: desc,
            document: {
                name: row.fileName || 'warranty-attachment.pdf',
                data: dataPayload,
                mimeType: mime,
            },
        };

        if (row.rowDocId && !isRenew) {
            await axiosInstance.put(`/AssetItem/${assetId}/document/${row.rowDocId}`, rowPayload);
        } else {
            await axiosInstance.post(`/AssetItem/${assetId}/document`, rowPayload);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            setLoading(true);

            for (const id of deletedDocIds) {
                try {
                    await axiosInstance.delete(`/AssetItem/${assetId}/document/${id}`);
                } catch (err) {
                }
            }

            const descriptionPayload = {
                warrantyBy: formData.warrantyBy,
                warrantyCovered: formData.warrantyCovered,
                km: formData.currentKm ? Number(formData.currentKm) : null,
                currentKm: formData.currentKm ? Number(formData.currentKm) : null,
                endKm: formData.endKm ? Number(formData.endKm) : null,
            };

            if (isRenew && existingDoc?._id) {
                descriptionPayload.renewedFrom = existingDoc._id;
            }

            const mainPayload = {
                type: 'Warranty',
                issueAuthority: 'Warranty Provider',
                issueDate: formData.startDate,
                expiryDate: formData.endDate,
                description: JSON.stringify(descriptionPayload),
            };

            if (existingDoc?._id && !isRenew) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, mainPayload);
            } else {
                if (isRenew && existingDoc?._id) {
                    mainPayload.renewFromDocumentId = existingDoc._id;
                }
                await axiosInstance.post(`/AssetItem/${assetId}/document`, mainPayload);
            }

            await saveAttachment(formData.certificate, CERTIFICATE_LABEL);

            for (const row of formData.extraRows) {
                await saveAttachment(row, row.description);
            }

            toast({
                title: isRenew ? 'Warranty renewed' : 'Saved',
                description: isRenew
                    ? 'New warranty is live. The previous document was moved to Old Documents.'
                    : 'Warranty details saved successfully.',
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save warranty details.',
            });
        } finally {
            setLoading(false);
        }
    };

    const coverageValue = Array.isArray(formData.warrantyCovered)
        ? formData.warrantyCovered[0] || ''
        : formData.warrantyCovered || '';

    const excludedCoverageSet = new Set(
        (Array.isArray(excludedCoverageTypes) ? excludedCoverageTypes : []).map(String),
    );
    const availableCoverageOptions = coverageOptions.filter(
        (opt) => !excludedCoverageSet.has(opt.id) || opt.id === coverageValue,
    );

    const fieldLabel = 'text-[11px] font-black text-slate-500 uppercase tracking-widest';
    const fieldInput =
        'w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[720px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200 shrink-0">
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

                <form
                    onSubmit={handleSave}
                    className="space-y-5 px-1 md:px-2 pt-5 pb-2 flex-1 overflow-y-auto modal-scroll"
                >
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                            Warranty By <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.warrantyBy}
                            onChange={(e) => setFormData((p) => ({ ...p, warrantyBy: e.target.value }))}
                            className={`${fieldInput} ${errors.warrantyBy ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                            disabled={loading}
                        >
                            <option value="">Select vendor...</option>
                            {vendorOptions.map((v) => (
                                <option key={v} value={v}>
                                    {v}
                                </option>
                            ))}
                        </select>
                        {errors.warrantyBy && (
                            <p className="text-[11px] font-medium text-red-500 mt-1">{errors.warrantyBy}</p>
                        )}
                    </div>

                    <div className="space-y-4">
                        <p className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                            Warranty Covered
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <span className={fieldLabel}>Warranty Covered</span>
                                <select
                                    value={coverageValue}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            warrantyCovered: e.target.value ? [e.target.value] : [],
                                        }))
                                    }
                                    className={fieldInput}
                                    disabled={loading}
                                >
                                    <option value="">Select coverage...</option>
                                    {availableCoverageOptions.map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <span className={fieldLabel}>
                                    Start Date <span className="text-red-500">*</span>
                                </span>
                                <DatePicker
                                    value={formData.startDate}
                                    onChange={(date) => setFormData((p) => ({ ...p, startDate: date }))}
                                    placeholder="Pick start date"
                                    className={`w-full h-11 border-slate-200 bg-white text-slate-800 ${errors.startDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                />
                                {errors.startDate && (
                                    <p className="text-[11px] font-medium text-red-500">{errors.startDate}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <span className={fieldLabel}>
                                    End Date <span className="text-red-500">*</span>
                                </span>
                                <DatePicker
                                    value={formData.endDate}
                                    onChange={(date) => setFormData((p) => ({ ...p, endDate: date }))}
                                    placeholder="Pick end date"
                                    className={`w-full h-11 border-slate-200 bg-white text-slate-800 ${errors.endDate ? 'border-red-400 ring-2 ring-red-400/10' : ''}`}
                                />
                                {errors.endDate && (
                                    <p className="text-[11px] font-medium text-red-500">{errors.endDate}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="hidden md:block" aria-hidden />
                            <div className="space-y-1.5">
                                <span className={fieldLabel}>Current KM</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.currentKm}
                                    onChange={(e) => setFormData((p) => ({ ...p, currentKm: e.target.value }))}
                                    className={fieldInput}
                                    disabled={loading}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <span className={fieldLabel}>End KM</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.endKm}
                                    onChange={(e) => setFormData((p) => ({ ...p, endKm: e.target.value }))}
                                    className={fieldInput}
                                    disabled={loading}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide block">
                            Warranty Certificate{' '}
                            <span className="text-slate-400 font-semibold normal-case">(Optional)</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="relative flex-1 h-11 flex items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 cursor-pointer hover:bg-blue-50/40 transition-colors">
                                <input
                                    type="file"
                                    onChange={handleCertificateFile}
                                    accept={PDF_FILE_ACCEPT}
                                    disabled={loading}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                                <Upload size={16} className="text-slate-400 mr-2 shrink-0" />
                                <span className="text-[12px] font-bold text-slate-600 truncate">
                                    {formData.certificate.fileBase64
                                        ? formData.certificate.fileName
                                        : formData.certificate.hasExisting
                                          ? formData.certificate.fileName
                                          : 'Optional — click to upload'}
                                </span>
                            </div>
                            {(formData.certificate.hasExisting || formData.certificate.fileBase64) && (
                                <button
                                    type="button"
                                    onClick={removeCertificate}
                                    disabled={loading}
                                    className="h-11 px-4 rounded-xl border border-rose-200 text-rose-600 text-[11px] font-bold uppercase tracking-wide hover:bg-rose-50"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Extra documents */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                                Additional documents
                            </p>
                            <button
                                type="button"
                                onClick={addExtraRow}
                                disabled={loading}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Add More
                            </button>
                        </div>
                        {formData.extraRows.map((row, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col md:flex-row gap-2 p-3 rounded-xl border border-slate-100 bg-white"
                            >
                                <div className="flex-1 space-y-1">
                                    <span className={fieldLabel}>Name</span>
                                    <input
                                        type="text"
                                        value={row.description}
                                        onChange={(e) => handleExtraChange(idx, { description: e.target.value })}
                                        placeholder="Document name"
                                        disabled={loading}
                                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-bold outline-none"
                                    />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <span className={fieldLabel}>Attachment</span>
                                    <div className="relative h-9 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 cursor-pointer">
                                        <input
                                            type="file"
                                            onChange={(e) => handleExtraFile(idx, e)}
                                            accept={PDF_FILE_ACCEPT}
                                            disabled={loading}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <span className="text-[11px] font-bold text-slate-600 truncate">
                                            {row.fileBase64
                                                ? row.fileName
                                                : row.hasExisting
                                                  ? row.fileName
                                                  : 'Click to upload'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={() => removeExtraRow(idx)}
                                        disabled={loading}
                                        className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-6 h-11 rounded-xl border border-slate-200 text-[13px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-black uppercase tracking-widest shadow-lg disabled:opacity-60 min-w-[120px]"
                        >
                            {loading ? 'Saving...' : 'OK'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
