'use client';

import { useState, useEffect, useMemo } from 'react';
import { DatePicker } from "@/components/ui/date-picker";
import {
    formatEmiratesIdDisplay,
    normalizeEmiratesIdNumber,
    validateEmployeeEmiratesIdFile,
    validateEmployeeEmiratesIdForm,
} from '@/utils/employeeEmiratesIdValidation';

export default function EmiratesIdModal({
    isOpen,
    onClose,
    initialData,
    onSaveEmiratesId,
    employee,
    setViewingDocument,
    setShowDocumentViewer,
    isRenew = false,
    isProfileActive = false,
    viewerIsDesignatedFlowchartHr = false,
    numberLocked = false,
}) {
    const [localForm, setLocalForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null,
        fileBase64: '',
        fileName: '',
        fileMime: ''
    });
    const [localErrors, setLocalErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [isRenewal, setIsRenewal] = useState(isRenew);
    const [oldDocumentMeta, setOldDocumentMeta] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setIsRenewal(isRenew);
            setOldDocumentMeta(initialData?.oldDocumentMeta || null);
            if (initialData) {
                setLocalForm({
                    number: initialData.number || '',
                    issueDate: initialData.issueDate || '',
                    expiryDate: initialData.expiryDate || '',
                    file: null,
                    fileBase64: initialData.fileBase64 || '',
                    fileName: initialData.fileName || '',
                    fileMime: initialData.fileMime || ''
                });
            } else if (employee?.emiratesIdDetails && !isRenew) {
                setLocalForm({
                    number: employee.emiratesIdDetails.number || '',
                    issueDate: employee.emiratesIdDetails.issueDate ? employee.emiratesIdDetails.issueDate.substring(0, 10) : '',
                    expiryDate: employee.emiratesIdDetails.expiryDate ? employee.emiratesIdDetails.expiryDate.substring(0, 10) : '',
                    file: null,
                    fileBase64: employee.emiratesIdDetails.document?.data || '',
                    fileName: employee.emiratesIdDetails.document?.name || '',
                    fileMime: employee.emiratesIdDetails.document?.mimeType || ''
                });
            } else {
                setLocalForm({
                    number: '',
                    issueDate: '',
                    expiryDate: '',
                    file: null,
                    fileBase64: '',
                    fileName: '',
                    fileMime: ''
                });
            }
            setLocalErrors({});
        }
    }, [isOpen, initialData, employee, isRenew]);

    const handleLocalChange = (field, value) => {
        if (field === 'number' && numberLocked) return;

        let processedValue = value;
        if (field === 'number') {
            processedValue = normalizeEmiratesIdNumber(value);
        }
        setLocalForm(prev => ({ ...prev, [field]: processedValue }));
        if (localErrors[field]) {
            setLocalErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setLocalForm(prev => ({ ...prev, file: null }));
            return;
        }

        const fileCheck = validateEmployeeEmiratesIdFile({ file });
        if (!fileCheck.isValid) {
            setLocalErrors(prev => ({ ...prev, file: fileCheck.error }));
            e.target.value = '';
            return;
        }

        setLocalForm(prev => ({ ...prev, file }));
        if (localErrors.file) {
            setLocalErrors(prev => {
                const updated = { ...prev };
                delete updated.file;
                return updated;
            });
        }
    };

    const validateForm = () => {
        const requireFile = isRenewal ? true : !Boolean(localForm.fileBase64 || localForm.fileName);
        const errors = validateEmployeeEmiratesIdForm(localForm, {
            skipNumber: employee?.emiratesIdDetails?.number || '',
            requireFile: isRenewal ? true : requireFile || !localForm.file,
        });
        if (isRenewal && !localForm.file && !localForm.fileBase64) {
            errors.file = 'A new Emirates ID document is required for renewal';
        }
        setLocalErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const needsHrApproval = isProfileActive && !viewerIsDesignatedFlowchartHr;
    const submitLabel = useMemo(() => {
        if (needsHrApproval) return 'Send for Approval';
        if (isRenewal) return 'Renew';
        return 'Update';
    }, [needsHrApproval, isRenewal]);

    const handleSubmit = async () => {
        if (saving) return;
        if (!validateForm()) return;
        setSaving(true);
        try {
            await onSaveEmiratesId({ ...localForm, isRenewal });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const numberDisplay = localForm.number ? formatEmiratesIdDisplay(localForm.number) : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {isRenewal ? 'Renew Emirates ID' : 'Emirates ID'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={saving}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    {isRenewal && oldDocumentMeta && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="font-semibold">Previous Emirates ID (OLD)</p>
                            {oldDocumentMeta.issueDate && (
                                <p className="mt-1">Issue date: {oldDocumentMeta.issueDate}</p>
                            )}
                            {oldDocumentMeta.expiryDate && (
                                <p>Expiry date: {oldDocumentMeta.expiryDate}</p>
                            )}
                            {oldDocumentMeta.fileName && (
                                <p>Document: {oldDocumentMeta.fileName}</p>
                            )}
                            <p className="mt-1 text-xs text-amber-800">
                                Upload a new document below. The previous file will be archived when renewal is saved.
                            </p>
                        </div>
                    )}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Emirates ID Number <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={15}
                                    value={localForm.number}
                                    onChange={(e) => handleLocalChange('number', e.target.value)}
                                    placeholder="784-XXXX-XXXXXXX-X"
                                    readOnly={numberLocked}
                                    className={`w-full h-10 px-3 rounded-xl border ${localErrors.number ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} ${numberLocked ? 'bg-gray-100 text-gray-700 cursor-not-allowed opacity-90' : 'bg-[#F7F9FC] text-gray-800'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    disabled={saving}
                                />
                                {numberLocked && (
                                    <p className="text-xs text-gray-500">
                                        Emirates ID number cannot be changed after it is saved.
                                    </p>
                                )}
                                {numberDisplay && numberDisplay.length === 18 && (
                                    <p className="text-xs text-gray-500">Formatted: {numberDisplay}</p>
                                )}
                                {localErrors.number && (
                                    <p className="text-xs text-red-500">{localErrors.number}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Issue Date <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DatePicker
                                    value={localForm.issueDate}
                                    onChange={(val) => handleLocalChange('issueDate', val)}
                                    className={`w-full ${localErrors.issueDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={saving}
                                    disabledDays={{ after: new Date() }}
                                />
                                {localErrors.issueDate && (
                                    <p className="text-xs text-red-500">{localErrors.issueDate}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Expiry Date <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DatePicker
                                    value={localForm.expiryDate}
                                    onChange={(val) => handleLocalChange('expiryDate', val)}
                                    className={`w-full ${localErrors.expiryDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={saving}
                                />
                                {localErrors.expiryDate && (
                                    <p className="text-xs text-red-500">{localErrors.expiryDate}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Document <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-2">
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileChange}
                                    className={`w-full h-10 px-3 rounded-xl border ${localErrors.file ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2`}
                                    disabled={saving}
                                />
                                <p className="text-xs text-gray-500">Upload file in PDF format only (Max 10MB)</p>
                                {localErrors.file && (
                                    <p className="text-xs text-red-500">{localErrors.file}</p>
                                )}
                                {(localForm.file || (localForm.fileName && !isRenewal)) && (
                                    <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20 6L9 17l-5-5"></path>
                                            </svg>
                                            <span>
                                                {localForm.file
                                                    ? localForm.file.name
                                                    : (localForm.fileName || 'emirates-id.pdf')}
                                                {localForm.file ? ' (New)' : ' (Current)'}
                                            </span>
                                        </div>
                                        {(localForm.fileBase64 || localForm.file) && setViewingDocument && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (localForm.file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (e) => {
                                                            const base64 = e.target.result.split(',')[1];
                                                            setViewingDocument({
                                                                data: base64,
                                                                name: localForm.file.name,
                                                                mimeType: localForm.file.type || 'application/pdf'
                                                            });
                                                            setShowDocumentViewer(true);
                                                        };
                                                        reader.readAsDataURL(localForm.file);
                                                    } else if (localForm.fileBase64) {
                                                        setViewingDocument({
                                                            data: localForm.fileBase64,
                                                            name: localForm.fileName || 'Emirates ID.pdf',
                                                            mimeType: localForm.fileMime || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }
                                                }}
                                                className="text-blue-600 hover:text-blue-700 text-xs font-medium underline"
                                            >
                                                View
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
