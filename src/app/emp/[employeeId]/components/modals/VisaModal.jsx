'use client';

import { useState, useEffect } from 'react';
import { validateDate } from "@/utils/validation";
import { DatePicker } from "@/components/ui/date-picker";
import axiosInstance from '@/utils/axios';


export default function VisaModal({
    isOpen,
    onClose,
    initialData,
    onVisaSubmit,
    selectedVisaType,
    selectedVisaLabel,
    employee,
    setViewingDocument,
    setShowDocumentViewer
}) {
    const [localForm, setLocalForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        sponsor: '',
        file: null,
        fileBase64: '',
        fileName: '',
        fileMime: ''
    });
    const [localErrors, setLocalErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [isOtherSponsor, setIsOtherSponsor] = useState(false);
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await axiosInstance.get('/Company');
                const fetchedCompanies = response.data.companies || response.data;
                setCompanies(Array.isArray(fetchedCompanies) ? fetchedCompanies : []);
            } catch (error) {
                console.error("Failed to fetch companies", error);
            }
        };
        fetchCompanies();
    }, []);

    useEffect(() => {
        if (isOpen && selectedVisaType) {
            const initialSponsor = initialData?.sponsor || '';
            const companyNames = companies.map(c => c.name);
            const isStandard = companyNames.includes(initialSponsor);

            if (initialData) {
                setLocalForm({
                    number: initialData.number || '',
                    issueDate: initialData.issueDate || '',
                    expiryDate: initialData.expiryDate || '',
                    sponsor: initialSponsor,
                    file: null,
                    fileBase64: initialData.fileBase64 || '',
                    fileName: initialData.fileName || '',
                    fileMime: initialData.fileMime || ''
                });
                setIsOtherSponsor(initialSponsor !== '' && !isStandard);
            } else {
                setLocalForm({
                    number: '',
                    issueDate: '',
                    expiryDate: '',
                    sponsor: '',
                    file: null,
                    fileBase64: '',
                    fileName: '',
                    fileMime: ''
                });
                setIsOtherSponsor(false);
            }
            setLocalErrors({});
        }
    }, [isOpen, selectedVisaType, initialData, companies]);


    const handleLocalChange = (field, value) => {
        let processedValue = value;
        // Apply input restrictions
        if (field === 'number') {
            // Only alphanumeric, no special characters
            processedValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        } else if (field === 'sponsor') {
            // Only letters, numbers, and spaces
            processedValue = value.replace(/[^A-Za-z0-9\s]/g, '');
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

    const calculateDuration = (start, end) => {
        if (!start || !end) return '';
        const startDate = new Date(start);
        const endDate = new Date(end);
        let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        if (endDate.getDate() < startDate.getDate()) months--;

        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;

        let text = `${months} Month${months !== 1 ? 's' : ''}`;
        if (years > 0) {
            text += ` (${years} Year${years > 1 ? 's' : ''}`;
            if (remainingMonths > 0) text += ` ${remainingMonths} Month${remainingMonths > 1 ? 's' : ''}`;
            text += ')';
        }
        return text;
    };

    const handleSponsorSelection = (e) => {
        const val = e.target.value;
        if (val === 'Other') {
            setIsOtherSponsor(true);
            setLocalForm(prev => ({ ...prev, sponsor: '' }));
        } else {
            setIsOtherSponsor(false);
            setLocalForm(prev => ({ ...prev, sponsor: val }));
        }
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
        const hasExistingData = Boolean(employee?.visaDetails?.[selectedVisaType]?.number);

        // 1. Visa Number
        if (!localForm.number || localForm.number.trim() === '') {
            if (!hasExistingData) {
                errors.number = 'Visa number is required';
            }
        } else if (!/^[A-Za-z0-9]+$/.test(localForm.number.trim())) {
            errors.number = 'Visa number must be alphanumeric with no special characters';
        }

        // 2. Issue Date
        if (!localForm.issueDate) {
            if (!hasExistingData) {
                errors.issueDate = 'Issue date is required';
            }
        } else {
            const dateValidation = validateDate(localForm.issueDate, true);
            if (!dateValidation.isValid) errors.issueDate = dateValidation.error;
            else {
                const issueDate = new Date(localForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                issueDate.setHours(0, 0, 0, 0);

                if (hasExistingData && employee?.visaDetails?.[selectedVisaType]?.expiryDate) {
                    const existingExpiry = new Date(employee.visaDetails[selectedVisaType].expiryDate);
                    existingExpiry.setHours(0, 0, 0, 0);

                    if (issueDate <= existingExpiry) {
                        errors.issueDate = 'Renewed visa issue date must be greater than existing visa expiry date';
                    }
                }
            }
        }

        // 3. Expiry Date
        if (!localForm.expiryDate) {
            if (!hasExistingData) {
                errors.expiryDate = 'Expiry date is required';
            }
        } else {
            const dateValidation = validateDate(localForm.expiryDate, true);
            if (!dateValidation.isValid) errors.expiryDate = dateValidation.error;
            else {
                const expiryDate = new Date(localForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (localForm.issueDate) {
                    const issueDate = new Date(localForm.issueDate);
                    if (expiryDate <= issueDate) errors.expiryDate = 'Expiry date must be later than the issue date';
                }
            }
        }

        // 4. Sponsor
        if (selectedVisaType === 'employment' || selectedVisaType === 'spouse') {
            if (!localForm.sponsor || localForm.sponsor.trim() === '') {
                if (!hasExistingData) {
                    errors.sponsor = 'Sponsor is required';
                }
            } else {
                const trimmedSponsor = localForm.sponsor.trim();
                if (trimmedSponsor.length < 2) errors.sponsor = 'Sponsor must be at least 2 characters';
                else if (!/^[A-Za-z0-9\s]+$/.test(trimmedSponsor)) errors.sponsor = 'Sponsor must contain only letters, numbers, and spaces';
            }
        }

        // 5. File
        const hasExistingDocument = Boolean((localForm.fileBase64 || localForm.fileName));
        if (!localForm.file && !hasExistingDocument) {
            errors.file = 'Visa copy is required';
        }

        setLocalErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            await onVisaSubmit(localForm);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !selectedVisaType) return null;

    const inputs = [
        { label: 'Visa Number', field: 'number', type: 'text', required: true },
        { label: 'Issue Date', field: 'issueDate', type: 'date', required: true },
        { label: 'Expiry Date', field: 'expiryDate', type: 'date', required: true },
        ...(selectedVisaType === 'employment' || selectedVisaType === 'spouse'
            ? [{ label: 'Visa Sponsor', field: 'sponsor', type: 'sponsor_select', required: true }]
            : []),
        { label: 'Visa Copy Upload', field: 'file', type: 'file', required: true }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative w-full max-w-4xl bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] max-h-[80vh] flex flex-col">
                <div className="flex flex-col gap-2 border-b border-gray-200 p-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-2xl font-semibold text-gray-800">Visa Requirements</h3>
                        <p className="text-sm text-gray-500">
                            {selectedVisaLabel ? `${selectedVisaLabel} details` : 'Upload visa details'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className={`text-gray-400 hover:text-gray-600 self-start md:self-auto ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Alerts Section */}
                <div className="px-6 pt-0 pb-2 space-y-3">
                    {/* Alert: Permanent Employee with Visit Visa */}
                    {employee?.status === 'Permanent' && selectedVisaType === 'visit' && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <h4 className="font-semibold text-sm">Action Required</h4>
                                <p className="text-sm mt-1 opacity-90">
                                    Permanent employees cannot be on a Visit Visa. Please update to an Employment Visa.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Alert: Visa Expired */}
                    {(() => {
                        const expiryDate = localForm.expiryDate ? new Date(localForm.expiryDate) : (initialData?.expiryDate ? new Date(initialData.expiryDate) : null);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        if (expiryDate && expiryDate < today) {
                            return (
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                                    <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="font-semibold text-sm">Visa Expired</h4>
                                        <p className="text-sm mt-1 opacity-90">
                                            This visa expired on {expiryDate.toISOString().split('T')[0]}. Please upload renewed visa details.
                                        </p>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-2">
                    <div className="space-y-3">
                        {inputs.map((input) => (
                            <div key={`${selectedVisaType}-${input.field}`} className="flex flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                    {input.label} {input.required && <span className="text-red-500">*</span>}
                                </label>
                                <div className="w-full md:flex-1 flex flex-col gap-1">
                                    {input.type === 'file' ? (
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={handleFileChange}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${localErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={saving}
                                        />
                                    ) : input.type === 'date' ? (
                                        <DatePicker
                                            value={localForm[input.field]}
                                            onChange={(val) => handleLocalChange(input.field, val)}
                                            className={`w-full ${localErrors[input.field] ? 'border-red-400' : 'border-[#E5E7EB]'}`}
                                            disabled={saving}
                                        />
                                    ) : input.type === 'sponsor_select' ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={isOtherSponsor ? 'Other' : (localForm.sponsor || '')}
                                                    onChange={handleSponsorSelection}
                                                    className={`flex-1 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${localErrors.sponsor ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                                    disabled={saving}
                                                >
                                                    <option value="">Select Sponsor</option>
                                                    {companies.map(company => (
                                                        <option key={company._id} value={company.name}>{company.name}</option>
                                                    ))}
                                                    <option value="Other">Other +</option>
                                                </select>
                                                {isOtherSponsor && (
                                                    <button
                                                        onClick={() => setIsOtherSponsor(false)}
                                                        className="text-xs text-blue-600 hover:underline font-medium"
                                                    >
                                                        Back to list
                                                    </button>
                                                )}
                                            </div>
                                            {isOtherSponsor && (
                                                <input
                                                    type="text"
                                                    placeholder="Enter custom sponsor name"
                                                    value={localForm.sponsor || ''}
                                                    onChange={(e) => handleLocalChange('sponsor', e.target.value)}
                                                    className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${localErrors.sponsor ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                                    disabled={saving}
                                                    autoFocus
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <input
                                            type={input.type}
                                            value={localForm[input.field] || ''}
                                            onChange={(e) => handleLocalChange(input.field, e.target.value)}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${localErrors[input.field] ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={saving}
                                        />
                                    )}
                                    {input.field === 'expiryDate' && localForm.issueDate && localForm.expiryDate && (
                                        <p className="text-xs text-blue-600 font-medium mt-1">
                                            Duration: {calculateDuration(localForm.issueDate, localForm.expiryDate)}
                                        </p>
                                    )}
                                    {localErrors[input.field] && (
                                        <p className="text-xs text-red-500">{localErrors[input.field]}</p>
                                    )}
                                    {input.type === 'file' && (
                                        <p className="text-xs text-gray-500 mt-1">Upload file in PDF format only (Max 5MB)</p>
                                    )}
                                    {input.field === 'file' && (localForm.file || localForm.fileName) && (
                                        <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20 6L9 17l-5-5"></path>
                                                </svg>
                                                <span>
                                                    {localForm.file ? localForm.file.name : (localForm.fileName || `${selectedVisaType}_visa.pdf`)}
                                                    {localForm.file ? ' (New)' : ' (Current)'}
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
                                                                name: localForm.fileName || `${selectedVisaType} Visa Document`,
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
                        ))}
                    </div>

                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                        <p className="font-semibold mb-1">Note:</p>
                        <p>Visa requirements apply only if the employee&apos;s nationality is not UAE. Ensure the uploaded copy is clear and legible.</p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        disabled={saving}
                    >
                        {saving ? `Saving ${selectedVisaLabel}...` : `Save ${selectedVisaLabel}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
