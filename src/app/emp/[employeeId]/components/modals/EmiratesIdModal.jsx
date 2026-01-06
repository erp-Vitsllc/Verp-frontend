'use client';

import { useState, useEffect } from 'react';
import { validateDate } from "@/utils/validation";
import { DatePicker } from "@/components/ui/date-picker";

export default function EmiratesIdModal({
    isOpen,
    onClose,
    initialData,
    onSaveEmiratesId,
    employee,
    setViewingDocument,
    setShowDocumentViewer
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

    useEffect(() => {
        if (isOpen) {
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
            } else if (employee?.emiratesIdDetails) {
                // Fallback to employee data if initialData is not provided
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
    }, [isOpen, initialData, employee]);

    const validateField = (field, value) => {
        const errors = { ...localErrors };
        const hasExistingData = Boolean(employee?.emiratesIdDetails?.number);

        if (field === 'number') {
            if (!value || !value.trim()) {
                if (!hasExistingData) {
                    errors.number = 'Emirates ID number is required';
                } else {
                    delete errors.number;
                }
            } else {
                delete errors.number;
            }
        } else if (field === 'issueDate') {
            if (!value || !value.trim()) {
                if (!hasExistingData || !employee?.emiratesIdDetails?.issueDate) {
                    errors.issueDate = 'Issue date is required';
                } else {
                    delete errors.issueDate;
                }
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    errors.issueDate = dateValidation.error;
                } else {
                    const issueDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (issueDate >= today) {
                        errors.issueDate = 'Issue date must be a past date';
                    } else {
                        delete errors.issueDate;
                        // Also validate expiry date if it exists
                        if (localForm.expiryDate) {
                            const expiryDate = new Date(localForm.expiryDate);
                            if (expiryDate <= issueDate) {
                                errors.expiryDate = 'Expiry date must be later than the issue date';
                            } else {
                                delete errors.expiryDate;
                            }
                        }
                    }
                }
            }
        } else if (field === 'expiryDate') {
            if (!value || !value.trim()) {
                if (!hasExistingData || !employee?.emiratesIdDetails?.expiryDate) {
                    errors.expiryDate = 'Expiry date is required';
                } else {
                    delete errors.expiryDate;
                }
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    errors.expiryDate = dateValidation.error;
                } else {
                    const expiryDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (expiryDate <= today) {
                        errors.expiryDate = 'Expiry date must be a future date';
                    } else if (localForm.issueDate) {
                        const issueDate = new Date(localForm.issueDate);
                        if (expiryDate <= issueDate) {
                            errors.expiryDate = 'Expiry date must be later than the issue date';
                        } else {
                            delete errors.expiryDate;
                        }
                    } else {
                        delete errors.expiryDate;
                    }
                }
            }
        }

        setLocalErrors(errors);
    };

    const handleLocalChange = (field, value) => {
        setLocalForm(prev => ({ ...prev, [field]: value }));
        // Real-time validation
        validateField(field, value);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setLocalForm(prev => ({ ...prev, file: null }));
            return;
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['application/pdf'];
        const allowedExtensions = ['.pdf'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setLocalErrors(prev => ({ ...prev, file: 'Only PDF file format is allowed' }));
            e.target.value = ''; // Clear input
            return;
        }

        if (file.size > maxSize) {
            setLocalErrors(prev => ({ ...prev, file: 'File size must be less than 5MB' }));
            e.target.value = ''; // Clear input
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
        const errors = {};
        const hasExistingData = Boolean(employee?.emiratesIdDetails?.number);

        // Validate number
        if (!localForm.number || !localForm.number.trim()) {
            if (!hasExistingData) errors.number = 'Emirates ID number is required';
        }

        // Validate issue date
        if (!localForm.issueDate) {
            if (!hasExistingData) errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(localForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(localForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                }
            }
        }

        // Validate expiry date
        if (!localForm.expiryDate) {
            if (!hasExistingData) errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(localForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(localForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (localForm.issueDate) {
                    const issueDate = new Date(localForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file - only required if no existing document
        const hasExistingDocument = Boolean(localForm.fileBase64 || localForm.fileName || employee?.emiratesIdDetails?.document?.data || employee?.emiratesIdDetails?.document?.name);
        if (!localForm.file && !hasExistingDocument) {
            errors.file = 'Document is required';
        }

        setLocalErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            await onSaveEmiratesId(localForm);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Emirates ID</h3>
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
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Number <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    value={localForm.number}
                                    onChange={(e) => handleLocalChange('number', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border ${localErrors.number ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    disabled={saving}
                                />
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
                                    className={`w-full ${localErrors.issueDate ? 'border-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={saving}
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
                                    className={`w-full ${localErrors.expiryDate ? 'border-red-400' : 'border-[#E5E7EB]'}`}
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
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${localErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                    disabled={saving}
                                />
                                <p className="text-xs text-gray-500">Upload file in PDF format only (Max 5MB)</p>
                                {localErrors.file && (
                                    <p className="text-xs text-red-500">{localErrors.file}</p>
                                )}
                                {(localForm.file || localForm.fileName || localForm.fileBase64) && (
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
                                        {(localForm.fileBase64 || localForm.file) && (
                                            <button
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
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
