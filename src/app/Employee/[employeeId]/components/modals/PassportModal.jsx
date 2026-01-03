'use client';

import { useState, useEffect, useMemo } from 'react';
import { validateDate } from "@/utils/validation";
import { getAllCountriesOptions, getAllCountryNames } from '../../utils/helpers';
import { DatePicker } from "@/components/ui/date-picker";

export default function PassportModal({
    isOpen,
    onClose,
    initialData,
    onPassportSubmit,
    employee,
    setViewingDocument,
    setShowDocumentViewer,
    passportFileInputRef
}) {
    const [localForm, setLocalForm] = useState({
        number: '',
        nationality: '',
        issueDate: '',
        expiryDate: '',
        countryOfIssue: '',
        file: null,
        fileBase64: '',
        fileName: '',
        fileMime: ''
    });
    const [localErrors, setLocalErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [isRenewal, setIsRenewal] = useState(false);

    const allCountriesOptions = useMemo(() => getAllCountriesOptions(), []);
    const allCountryNamesList = useMemo(() => getAllCountryNames(), []);

    useEffect(() => {
        if (isOpen) {
            setIsRenewal(false);
            if (initialData) {
                setLocalForm({
                    number: initialData.number || '',
                    nationality: initialData.nationality || '',
                    issueDate: initialData.issueDate || '',
                    expiryDate: initialData.expiryDate || '',
                    countryOfIssue: initialData.countryOfIssue || '',
                    file: null,
                    fileBase64: initialData.fileBase64 || '',
                    fileName: initialData.fileName || '',
                    fileMime: initialData.fileMime || ''
                });
            } else {
                setLocalForm({
                    number: '',
                    nationality: '',
                    issueDate: '',
                    expiryDate: '',
                    countryOfIssue: '',
                    file: null,
                    fileBase64: '',
                    fileName: '',
                    fileMime: ''
                });
            }
            setLocalErrors({});
        }
    }, [isOpen, initialData]);

    const handleLocalChange = (field, value) => {
        let processedValue = value;
        if (field === 'number') {
            processedValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
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
            setLocalForm(prev => ({
                ...prev,
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: ''
            }));
            if (localErrors.file) setLocalErrors(prev => ({ ...prev, file: '' }));
            return;
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setLocalErrors(prev => ({ ...prev, file: 'Only PDF, JPEG, or PNG file formats are allowed' }));
            return;
        }

        // Convert to Base64 immediately to avoid lag on submit
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setLocalForm(prev => ({
                ...prev,
                file,
                fileBase64: base64,
                fileName: file.name,
                fileMime: file.type || 'application/pdf'
            }));
        };
        reader.readAsDataURL(file);

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
        const hasExistingData = Boolean(employee?.passportDetails?.number);

        if (!localForm.number || localForm.number.trim() === '') {
            if (!hasExistingData) errors.number = 'Passport number is required';
        } else if (!/^[A-Za-z0-9]+$/.test(localForm.number.trim())) {
            errors.number = 'Passport number must be alphanumeric with no special characters';
        }

        if (!localForm.nationality || localForm.nationality.trim() === '') {
            if (!hasExistingData) errors.nationality = 'Passport nationality is required';
        } else if (!allCountryNamesList.includes(localForm.nationality.trim())) {
            errors.nationality = 'Please select a valid country from the list';
        }

        if (!localForm.issueDate) {
            if (!hasExistingData) errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(localForm.issueDate, true);
            if (!dateValidation.isValid) errors.issueDate = dateValidation.error;
            else {
                const issueDate = new Date(localForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) errors.issueDate = 'Issue date must be a past date';
            }
        }

        if (!localForm.expiryDate) {
            if (!hasExistingData) errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(localForm.expiryDate, true);
            if (!dateValidation.isValid) errors.expiryDate = dateValidation.error;
            else {
                const expiryDate = new Date(localForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) errors.expiryDate = 'Expiry date must be a future date';
                else if (localForm.issueDate) {
                    const issueDate = new Date(localForm.issueDate);
                    if (expiryDate <= issueDate) errors.expiryDate = 'Expiry date must be later than the issue date';
                }
            }
        }

        if (!localForm.countryOfIssue || localForm.countryOfIssue.trim() === '') {
            if (!hasExistingData) errors.countryOfIssue = 'Country of issue is required';
        } else if (!allCountryNamesList.includes(localForm.countryOfIssue.trim())) {
            errors.countryOfIssue = 'Please select a valid country from the list';
        }

        const hasFile = Boolean(localForm.file || localForm.fileBase64 || localForm.fileName);
        if (!hasFile) {
            errors.file = 'Passport copy is required';
        }

        setLocalErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleRenew = () => {
        setIsRenewal(true);
        setLocalForm(prev => ({
            number: '',
            nationality: prev.nationality,
            issueDate: '',
            expiryDate: '',
            countryOfIssue: prev.countryOfIssue,
            file: null,
            fileBase64: '',
            fileName: '',
            fileMime: ''
        }));
        setLocalErrors({});
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            await onPassportSubmit({ ...localForm, isRenewal });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const hasFile = !!(localForm.file || localForm.fileName);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Passport Details</h3>
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
                        {/* Passport Number */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Passport Number <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    value={localForm.number}
                                    onChange={(e) => handleLocalChange('number', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${localErrors.number ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                    disabled={saving}
                                />
                                {localErrors.number && <p className="text-xs text-red-500">{localErrors.number}</p>}
                            </div>
                        </div>

                        {/* Nationality */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Passport Nationality <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <select
                                    value={localForm.nationality}
                                    onChange={(e) => handleLocalChange('nationality', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${localErrors.nationality ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                    disabled={saving}
                                >
                                    <option value="">Select Passport Nationality</option>
                                    {allCountriesOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {localErrors.nationality && <p className="text-xs text-red-500">{localErrors.nationality}</p>}
                            </div>
                        </div>

                        {/* Issue Date */}
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
                                {localErrors.issueDate && <p className="text-xs text-red-500">{localErrors.issueDate}</p>}
                            </div>
                        </div>

                        {/* Expiry Date */}
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
                                {localErrors.expiryDate && <p className="text-xs text-red-500">{localErrors.expiryDate}</p>}
                            </div>
                        </div>

                        {/* Country of Issue */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Country of Issue <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <select
                                    value={localForm.countryOfIssue}
                                    onChange={(e) => handleLocalChange('countryOfIssue', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${localErrors.countryOfIssue ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                    disabled={saving}
                                >
                                    <option value="">Select Country of Issue</option>
                                    {allCountriesOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {localErrors.countryOfIssue && <p className="text-xs text-red-500">{localErrors.countryOfIssue}</p>}
                            </div>
                        </div>

                        {/* File Upload */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Passport Copy <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-2">
                                <input
                                    ref={passportFileInputRef}
                                    type="file"
                                    accept=".jpeg,.jpg,.pdf"
                                    onChange={handleFileChange}
                                    className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${localErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                    disabled={saving}
                                />
                                {localErrors.file && <p className="text-xs text-red-500">{localErrors.file}</p>}
                                {hasFile && (
                                    <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20 6L9 17l-5-5"></path>
                                            </svg>
                                            <span>
                                                {localForm.file ? localForm.file.name : localForm.fileName}
                                            </span>
                                        </div>
                                        {((localForm.fileBase64 || localForm.file) && setViewingDocument) && (
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
                                                    } else {
                                                        setViewingDocument({
                                                            data: localForm.fileBase64,
                                                            name: localForm.fileName || 'Passport Document',
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
                                <p className="text-xs text-gray-500">Upload file in JPEG / PDF format.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                    {initialData?.number && !isRenewal && (
                        <button
                            onClick={handleRenew}
                            className="mr-auto px-4 py-2 rounded-lg bg-orange-100 text-orange-600 font-semibold text-sm hover:bg-orange-200 transition-colors"
                            disabled={saving}
                            type="button"
                        >
                            Renew Passport
                        </button>
                    )}
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
                        {saving ? 'Updating...' : 'Update'}
                    </button>
                </div>
            </div>
        </div>
    );
}
