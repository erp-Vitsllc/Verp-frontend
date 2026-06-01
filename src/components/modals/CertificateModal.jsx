'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Upload, Plus, CheckCircle, RotateCcw } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import {
    parseCertificateStoredDescription,
    resolveCertificateIssuedToKey,
    CERTIFICATE_TYPE_OPTIONS,
} from '@/utils/companyCertificateUtils';
import {
    validateCompanyCertificateFields,
    normalizeCompanyCertificatePayload,
    normalizeCertificateIssuedBy,
    normalizeCertificateDescription,
    normalizeCertificateOtherType,
    resolveCertificateTypeName,
    buildCertificateRecipientOptions,
} from '@/utils/companyCertificateValidation';

export default function CertificateModal({
    isOpen,
    onClose,
    onSuccess,
    targetType = 'company',
    targetId,
    targetName,
    companyRecord = null,
    companyEmployees = [],
    isEdit = false,
    editData = null,
    editIndex = null,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        certificateType: '',
        otherType: '',
        issuedBy: '',
        description: '',
        issueDate: '',
        hasExpiry: 'no',
        expiryDate: '',
        issuedTo: '',
        attachment: null,
        attachmentFile: null,
        fileName: '',
    });

    const [errors, setErrors] = useState({});

    const recipientOptions = useMemo(() => {
        if (targetType !== 'company') {
            return targetName
                ? [{ value: targetName, label: targetName }]
                : [];
        }
        return buildCertificateRecipientOptions({
            companyId: companyRecord?.companyId,
            companyName: companyRecord?.name || targetName,
            employees: companyEmployees,
        });
    }, [targetType, targetName, companyRecord, companyEmployees]);

    const expiryMinDate = useMemo(() => {
        if (!formData.issueDate) return undefined;
        const afterIssue = new Date(formData.issueDate);
        afterIssue.setHours(0, 0, 0, 0);
        afterIssue.setDate(afterIssue.getDate() + 1);
        return afterIssue;
    }, [formData.issueDate]);

    useEffect(() => {
        if (!isOpen) return;

        if (isEdit && editData) {
            const parsed = parseCertificateStoredDescription(editData.description);
            const commonTypes = ['Installer', 'Safety', 'Administration'];
            const docType = String(editData.type || '').trim();
            const cType = commonTypes.includes(docType) ? docType : 'Others';
            const issuedToKey =
                targetType === 'company'
                    ? resolveCertificateIssuedToKey(parsed.issuedTo, {
                          companyId: companyRecord?.companyId,
                          companyName: companyRecord?.name || targetName,
                          employees: companyEmployees,
                      })
                    : parsed.issuedTo || targetName || '';

            setFormData({
                certificateType: cType,
                otherType: cType === 'Others' ? docType : '',
                issuedBy: parsed.issuedBy === '—' ? '' : parsed.issuedBy,
                description: parsed.userDescription === '—' ? '' : parsed.userDescription,
                issueDate: editData.issueDate
                    ? new Date(editData.issueDate).toISOString().split('T')[0]
                    : '',
                hasExpiry: editData.expiryDate ? 'yes' : 'no',
                expiryDate: editData.expiryDate
                    ? new Date(editData.expiryDate).toISOString().split('T')[0]
                    : '',
                issuedTo: issuedToKey,
                attachment: editData.document?.url || editData.attachment || null,
                attachmentFile: null,
                fileName: editData.document?.name || (editData.attachment ? 'Certificate.pdf' : ''),
            });
        } else {
            const defaultIssuedTo =
                targetType === 'company' && companyRecord?.companyId
                    ? `company:${companyRecord.companyId}`
                    : targetName || '';
            setFormData({
                certificateType: '',
                otherType: '',
                issuedBy: '',
                description: '',
                issueDate: '',
                hasExpiry: 'no',
                expiryDate: '',
                issuedTo: defaultIssuedTo,
                attachment: null,
                attachmentFile: null,
                fileName: '',
            });
        }
        setErrors({});
    }, [
        isOpen,
        targetName,
        targetType,
        isEdit,
        editData,
        companyRecord,
        companyEmployees,
    ]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fieldErrors = validateCompanyCertificateFields(
            { ...formData, attachmentFile: file },
            { requireAttachment: true, existingAttachment: formData.attachment },
        );
        if (fieldErrors.attachment) {
            toast({ variant: 'destructive', title: 'Error', description: fieldErrors.attachment });
            e.target.value = '';
            return;
        }
        setFormData((prev) => ({
            ...prev,
            attachmentFile: file,
            fileName: file.name,
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next.attachment;
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fieldErrors = validateCompanyCertificateFields(formData, {
            requireAttachment: !isEdit || !(formData.attachment || editData?.document?.url),
            existingAttachment: formData.attachment || editData?.document?.url,
            recipientOptions,
        });
        if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Please fill all required fields correctly',
            });
            return;
        }

        try {
            setLoading(true);

            let attachmentUrl = formData.attachment || editData?.document?.url || editData?.attachment || '';

            if (formData.attachmentFile) {
                const reader = new FileReader();
                const base64Data = await new Promise((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(formData.attachmentFile);
                });

                const uploadEndpoint =
                    targetType === 'company'
                        ? `/Company/${targetId}/upload`
                        : `/Employee/upload-document/${targetId}`;

                const uploadRes = await axiosInstance.post(uploadEndpoint, {
                    fileData: base64Data,
                    fileName: formData.fileName,
                    folder:
                        targetType === 'company'
                            ? 'company-documents/certificates'
                            : 'employee-documents/certificates',
                });
                attachmentUrl =
                    uploadRes.data.key ||
                    uploadRes.data.publicId ||
                    uploadRes.data.url;
            }

            const normalized = normalizeCompanyCertificatePayload(formData, {
                companyId: companyRecord?.companyId,
                companyName: companyRecord?.name || targetName,
                employees: companyEmployees,
            });

            const newDoc = {
                ...(isEdit && editData ? editData : {}),
                ...normalized,
                document: {
                    url: attachmentUrl,
                    name: formData.fileName || editData?.document?.name || 'Certificate.pdf',
                    mimeType: 'application/pdf',
                },
            };

            if (targetType === 'company') {
                const compRes = await axiosInstance.get(`/Company/${targetId}`);
                const currentCompany = compRes.data.company;
                const existingDocs = Array.isArray(currentCompany.documents)
                    ? currentCompany.documents
                    : [];
                let updatedDocs;

                if (isEdit) {
                    updatedDocs = [...existingDocs];
                    const byIdIdx =
                        editData?._id != null
                            ? updatedDocs.findIndex(
                                  (d) => String(d._id) === String(editData._id),
                              )
                            : -1;
                    const targetIdx =
                        byIdIdx >= 0
                            ? byIdIdx
                            : typeof editIndex === 'number'
                              ? editIndex
                              : -1;
                    if (targetIdx >= 0 && targetIdx < updatedDocs.length) {
                        updatedDocs[targetIdx] = newDoc;
                    } else {
                        updatedDocs.push(newDoc);
                    }
                } else {
                    updatedDocs = [...existingDocs, newDoc];
                }

                const updatedTabs = Array.from(
                    new Set([...(currentCompany.customTabs || []), 'Certificate']),
                );
                await axiosInstance.patch(`/Company/${targetId}`, {
                    documents: updatedDocs,
                    customTabs: updatedTabs,
                });
            } else {
                const empRes = await axiosInstance.get(`/Employee/${targetId}`);
                const currentEmployee = empRes.data;
                let updatedDocs;

                if (isEdit && editIndex !== null) {
                    updatedDocs = [...(currentEmployee.documents || [])];
                    updatedDocs[editIndex] = newDoc;
                } else {
                    updatedDocs = [...(currentEmployee.documents || []), newDoc];
                }

                await axiosInstance.patch(`/Employee/${targetId}`, {
                    documents: updatedDocs,
                });
            }

            toast({
                title: 'Success',
                description: isEdit
                    ? 'Certificate updated successfully'
                    : 'Certificate added successfully',
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error processing certificate:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description:
                    error.response?.data?.message ||
                    `Failed to ${isEdit ? 'update' : 'add'} certificate`,
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[600px] overflow-hidden animate-in zoom-in duration-200">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">
                            {isEdit ? 'Edit Certificate' : 'Add Certificate'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {isEdit
                                ? 'Update the details of the certificate'
                                : 'Fill in the details to add a new certificate'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
                    <div className="space-y-6 overflow-y-auto p-8 modal-scroll">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    Certificate Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.certificateType || ''}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            certificateType: e.target.value,
                                        }))
                                    }
                                    className={`w-full h-11 px-4 rounded-xl border ${errors.type ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                                >
                                    <option value="">Select Certificate Type</option>
                                    {CERTIFICATE_TYPE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt === 'Others' ? 'Others' : opt}
                                        </option>
                                    ))}
                                </select>
                                {errors.type && (
                                    <p className="text-xs text-red-500 font-medium">{errors.type}</p>
                                )}
                            </div>

                            {formData.certificateType === 'Others' && (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-sm font-semibold text-gray-700">
                                        Specify Other Type <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={formData.otherType || ''}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                otherType: normalizeCertificateOtherType(e.target.value),
                                            }))
                                        }
                                        placeholder="Enter certificate type"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.type ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Certificate Issued By <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                maxLength={150}
                                value={formData.issuedBy}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        issuedBy: normalizeCertificateIssuedBy(e.target.value),
                                    }))
                                }
                                placeholder="Enter organization name"
                                className={`w-full h-11 px-4 rounded-xl border ${errors.issuedBy ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                            />
                            {errors.issuedBy && (
                                <p className="text-xs text-red-500 font-medium">{errors.issuedBy}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Certificate Description
                            </label>
                            <textarea
                                maxLength={1000}
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        description: normalizeCertificateDescription(e.target.value),
                                    }))
                                }
                                placeholder="Enter any additional details"
                                className={`w-full min-h-[100px] p-4 rounded-xl border ${errors.description ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none`}
                            />
                            {errors.description && (
                                <p className="text-xs text-red-500 font-medium">{errors.description}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    Issue Date <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    value={formData.issueDate}
                                    onChange={(date) =>
                                        setFormData((prev) => ({ ...prev, issueDate: date }))
                                    }
                                    placeholder="dd/mm/yyyy"
                                    className={`w-full h-11 ${errors.issueDate ? 'border-red-500' : ''}`}
                                />
                                {errors.issueDate && (
                                    <p className="text-xs text-red-500 font-medium">{errors.issueDate}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    Has Expiry? <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-4 h-11">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="hasExpiry"
                                            value="yes"
                                            checked={formData.hasExpiry === 'yes'}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    hasExpiry: e.target.value,
                                                }))
                                            }
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">
                                            Yes
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="hasExpiry"
                                            value="no"
                                            checked={formData.hasExpiry === 'no'}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    hasExpiry: e.target.value,
                                                    expiryDate: '',
                                                }))
                                            }
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">
                                            No
                                        </span>
                                    </label>
                                </div>
                                {errors.hasExpiry && (
                                    <p className="text-xs text-red-500 font-medium">{errors.hasExpiry}</p>
                                )}
                            </div>
                        </div>

                        {formData.hasExpiry === 'yes' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                <label className="text-sm font-semibold text-gray-700">
                                    Expiry Date <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    value={formData.expiryDate}
                                    onChange={(date) =>
                                        setFormData((prev) => ({ ...prev, expiryDate: date }))
                                    }
                                    placeholder="dd/mm/yyyy"
                                    disabledDays={
                                        expiryMinDate ? { before: expiryMinDate } : undefined
                                    }
                                    className={`w-full h-11 ${errors.expiryDate ? 'border-red-500' : ''}`}
                                />
                                {errors.expiryDate && (
                                    <p className="text-xs text-red-500 font-medium">{errors.expiryDate}</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Certificate Issued To <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.issuedTo}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, issuedTo: e.target.value }))
                                }
                                className={`w-full h-11 px-4 rounded-xl border ${errors.issuedTo ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                            >
                                <option value="">Select recipient</option>
                                {recipientOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            {errors.issuedTo && (
                                <p className="text-xs text-red-500 font-medium">{errors.issuedTo}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Certificate Attachment <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    accept=".pdf,application/pdf"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div
                                    className={`w-full h-24 border-2 border-dashed ${formData.attachment || formData.attachmentFile ? 'border-green-400 bg-green-50' : errors.attachment ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-gray-50'} group-hover:border-blue-400 group-hover:bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all`}
                                >
                                    {formData.attachment || formData.attachmentFile ? (
                                        <>
                                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                <CheckCircle size={18} />
                                            </div>
                                            <span className="text-sm font-semibold text-green-700 truncate max-w-[250px]">
                                                {formData.fileName || 'Certificate.pdf'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                                <Upload size={18} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-500">
                                                Upload PDF (max 10 MB)
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            {errors.attachment && (
                                <p className="text-xs text-red-500 font-medium">{errors.attachment}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-4 border-t border-gray-100 bg-gray-50/50 p-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 rounded-xl px-6 text-sm font-bold text-gray-600 transition-all hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <RotateCcw className="animate-spin" size={18} />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    {isEdit ? <CheckCircle size={18} /> : <Plus size={18} />}
                                    {isEdit ? 'Update Certificate' : 'Add Certificate'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
