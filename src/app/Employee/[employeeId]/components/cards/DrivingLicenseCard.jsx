'use client';

import { memo, useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { validateDate } from "@/utils/validation";
import { toast } from '@/hooks/use-toast';
import DrivingLicenseModal from '../modals/DrivingLicenseModal';

const DrivingLicenseCard = forwardRef(function DrivingLicenseCard({
    employee,
    employeeId,
    isAdmin,
    hasPermission,
    formatDate,
    fetchEmployee,
    updateEmployeeOptimistically,
    onViewDocument,
    setViewingDocument,
    setShowDocumentViewer
}, ref) {
    // Modal state
    const [showDrivingLicenseModal, setShowDrivingLicenseModal] = useState(false);
    const [drivingLicenseForm, setDrivingLicenseForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null
    });
    const [drivingLicenseErrors, setDrivingLicenseErrors] = useState({});
    const [savingDrivingLicense, setSavingDrivingLicense] = useState(false);
    const drivingLicenseFileRef = useRef(null);

    // Helper functions
    const base64ToFile = useCallback((base64String, fileName, mimeType) => {
        try {
            if (!base64String || typeof base64String !== 'string') {
                console.warn('Invalid base64 string provided to base64ToFile');
                return null;
            }
            let base64Data = base64String;
            if (base64String.includes(',')) {
                base64Data = base64String.split(',')[1];
            }
            base64Data = base64Data.trim();
            if (!base64Data) {
                console.warn('Empty base64 data after processing');
                return null;
            }
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType || 'application/pdf' });
            const file = new File([blob], fileName || 'document.pdf', {
                type: mimeType || 'application/pdf',
                lastModified: Date.now()
            });
            return file;
        } catch (error) {
            console.error('Error converting base64 to file:', error);
            return null;
        }
    }, []);

    const fileToBase64 = useCallback((file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }, []);


    // Validate date field
    const validateDrivingLicenseDateField = useCallback((field, value) => {
        const errors = { ...drivingLicenseErrors };
        let error = '';

        if (field === 'issueDate') {
            if (!value || value.trim() === '') {
                error = 'Issue date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const issueDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (issueDate >= today) {
                        error = 'Issue date must be a past date';
                    } else if (drivingLicenseForm.expiryDate) {
                        const expiryDate = new Date(drivingLicenseForm.expiryDate);
                        if (expiryDate <= issueDate) {
                            errors.expiryDate = 'Expiry date must be later than the issue date';
                        } else {
                            delete errors.expiryDate;
                        }
                    }
                }
            }
        } else if (field === 'expiryDate') {
            if (!value || value.trim() === '') {
                error = 'Expiry date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const expiryDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (expiryDate <= today) {
                        error = 'Expiry date must be a future date';
                    } else if (drivingLicenseForm.issueDate) {
                        const issueDate = new Date(drivingLicenseForm.issueDate);
                        if (expiryDate <= issueDate) {
                            error = 'Expiry date must be later than the issue date';
                        }
                    }
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setDrivingLicenseErrors(errors);
    }, [drivingLicenseForm, drivingLicenseErrors]);

    // File change handler
    const handleDrivingLicenseFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setDrivingLicenseForm(prev => ({ ...prev, file: null }));
            setDrivingLicenseErrors(prev => ({
                ...prev,
                file: ''
            }));
            return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setDrivingLicenseErrors(prev => ({
                ...prev,
                file: 'Only PDF, JPEG, or PNG file formats are allowed'
            }));
            if (e.target) {
                e.target.value = '';
            }
            return;
        }

        // Clear error if valid
        setDrivingLicenseErrors(prev => ({
            ...prev,
            file: ''
        }));

        setDrivingLicenseForm(prev => ({ ...prev, file }));
    }, []);

    // Save handler
    const handleSaveDrivingLicense = useCallback(async () => {
        const errors = {};

        // Validate number
        if (!drivingLicenseForm.number || !drivingLicenseForm.number.trim()) {
            errors.number = 'Driving License number is required';
        }

        // Validate issue date
        if (!drivingLicenseForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(drivingLicenseForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(drivingLicenseForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                } else if (drivingLicenseForm.expiryDate) {
                    const expiryDate = new Date(drivingLicenseForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date - only required if no existing data
        if (!drivingLicenseForm.expiryDate) {
            if (!hasExistingData || !employee?.drivingLicenceDetails?.expiryDate) {
                errors.expiryDate = 'Expiry date is required';
            }
        } else {
            const dateValidation = validateDate(drivingLicenseForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(drivingLicenseForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (drivingLicenseForm.issueDate) {
                    const issueDate = new Date(drivingLicenseForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file - only required if no existing document
        const hasExistingDocument = Boolean(employee?.drivingLicenceDetails?.document?.url || employee?.drivingLicenceDetails?.document?.data || employee?.drivingLicenceDetails?.document?.name);
        if (!drivingLicenseForm.file && !hasExistingDocument) {
            errors.file = 'Document is required';
        }

        if (Object.keys(errors).length > 0) {
            setDrivingLicenseErrors(errors);
            return;
        }

        setSavingDrivingLicense(true);
        try {
            let upload = null;
            let uploadName = '';
            let uploadMime = '';

            if (drivingLicenseForm.file) {
                // New file selected
                upload = await fileToBase64(drivingLicenseForm.file);
                uploadName = drivingLicenseForm.file.name;
                uploadMime = drivingLicenseForm.file.type;
            } else if (employee?.drivingLicenceDetails?.document?.data) {
                // No new file, but existing document in DB - use existing document
                upload = employee.drivingLicenceDetails.document.data;
                uploadName = employee.drivingLicenceDetails.document.name || '';
                uploadMime = employee.drivingLicenceDetails.document.mimeType || '';
            }

            const response = await axiosInstance.patch(`/Employee/driving-license/${employeeId}`, {
                number: drivingLicenseForm.number.trim(),
                issueDate: drivingLicenseForm.issueDate,
                expiryDate: drivingLicenseForm.expiryDate,
                document: upload,
                documentName: uploadName,
                documentMime: uploadMime
            });

            // Optimistic update
            if (response.data?.drivingLicenceDetails) {
                if (updateEmployeeOptimistically) {
                    updateEmployeeOptimistically({
                        drivingLicenceDetails: response.data.drivingLicenceDetails
                    });
                } else if (fetchEmployee) {
                    fetchEmployee(true).catch(err => {
                        console.error('Error refreshing employee data:', err);
                    });
                }
            } else if (fetchEmployee) {
                fetchEmployee(true).catch(err => {
                    console.error('Error refreshing employee data:', err);
                });
            }

            handleCloseDrivingLicenseModal();
            toast({
                title: "Driving License updated",
                description: "Driving License information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Driving License', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingDrivingLicense(false);
        }
    }, [drivingLicenseForm, employee, employeeId, fileToBase64, updateEmployeeOptimistically, fetchEmployee, toast]);

    // Open modal handler
    const handleOpenDrivingLicenseModal = useCallback((isRenew = false) => {
        if (!isRenew && employee?.drivingLicenceDetails) {
            setDrivingLicenseForm({
                number: employee.drivingLicenceDetails.number || '',
                issueDate: employee.drivingLicenceDetails.issueDate ? employee.drivingLicenceDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.drivingLicenceDetails.expiryDate ? employee.drivingLicenceDetails.expiryDate.substring(0, 10) : '',
                file: null
            });
            if (employee.drivingLicenceDetails.document?.data) {
                const file = base64ToFile(
                    employee.drivingLicenceDetails.document.data,
                    employee.drivingLicenceDetails.document.name || 'driving-license.pdf',
                    employee.drivingLicenceDetails.document.mimeType || 'application/pdf'
                );
                if (file) {
                    setDrivingLicenseForm(prev => ({ ...prev, file }));
                }
            }
        } else {
            setDrivingLicenseForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
        }
        setDrivingLicenseErrors({});
        setShowDrivingLicenseModal(true);
    }, [employee, base64ToFile]);

    // Close modal handler
    const handleCloseDrivingLicenseModal = useCallback(() => {
        if (!savingDrivingLicense) {
            setShowDrivingLicenseModal(false);
            setDrivingLicenseForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
            setDrivingLicenseErrors({});
            if (drivingLicenseFileRef.current) {
                drivingLicenseFileRef.current.value = '';
            }
        }
    }, [savingDrivingLicense]);

    // Open document viewer handler
    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const document = employee?.drivingLicenceDetails?.document;
            if (!document) return;

            if (document.url && (document.url.startsWith('http://') || document.url.startsWith('https://'))) {
                try {
                    const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                        params: { type: 'drivingLicense' }
                    });
                    if (response.data && response.data.data) {
                        setViewingDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Driving_License.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                        setShowDocumentViewer(true);
                    }
                } catch (error) {
                    console.error('Error fetching Driving License document:', error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to load document. Please try again."
                    });
                }
            } else if (document.data) {
                setViewingDocument({
                    data: document.data,
                    name: document.name || 'Driving_License.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
                setShowDocumentViewer(true);
            }
            return;
        }

        // Use centralized handler (like Bank Account)
        const document = employee?.drivingLicenceDetails?.document;
        if (!document) {
            alert('No driving license document found');
            return;
        }

        const documentData = document.url || document.data;

        // Check if it's a Cloudinary URL or base64 data
        const isCloudinaryUrl = document.url || (document.data && (document.data.startsWith('http://') || document.data.startsWith('https://')));

        // If document data is available locally, use it directly
        if (documentData) {
            if (isCloudinaryUrl) {
                // Cloudinary URL - use directly
                onViewDocument({
                    data: documentData,
                    name: document.name || 'Driving_License.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            } else {
                // Base64 data - clean and use
                let cleanData = documentData;
                if (cleanData.includes(',')) {
                    cleanData = cleanData.split(',')[1];
                }

                onViewDocument({
                    data: cleanData,
                    name: document.name || 'Driving_License.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            }
        } else if (employeeId && document.name) {
            // If no local data but document exists (has name), fetch from server
            onViewDocument({
                data: null,
                name: document.name || 'Driving_License.pdf',
                mimeType: document.mimeType || 'application/pdf',
                loading: true
            });

            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: 'drivingLicense' }
                });

                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                    if (isCloudinaryUrl) {
                        onViewDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Driving_License.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }

                        onViewDocument({
                            data: cleanData,
                            name: response.data.name || document.name || 'Driving_License.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    }
                } else {
                    onViewDocument(null);
                    alert('Failed to load driving license document');
                }
            } catch (err) {
                console.error('Error fetching Driving License document:', err);
                onViewDocument(null);
                alert('Error fetching driving license document. Please try again.');
            }
        } else {
            // No document data available at all
            alert('Driving license document data not available');
        }
    }, [employee, employeeId, onViewDocument, setViewingDocument, setShowDocumentViewer]);

    // Expose openModal function via ref
    useImperativeHandle(ref, () => ({
        openModal: handleOpenDrivingLicenseModal
    }));

    // Memoize permission checks and data existence
    const canView = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_driving_license', 'isView'),
        [isAdmin, hasPermission]
    );

    const canEdit = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_driving_license', 'isEdit'),
        [isAdmin, hasPermission]
    );

    const hasNumber = useMemo(() =>
        !!employee?.drivingLicenceDetails?.number,
        [employee?.drivingLicenceDetails?.number]
    );

    const hasDocument = useMemo(() =>
        !!(employee?.drivingLicenceDetails?.document?.url || employee?.drivingLicenceDetails?.document?.data || employee?.drivingLicenceDetails?.document?.name),
        [employee?.drivingLicenceDetails?.document]
    );

    // Memoize data rows
    const dataRows = useMemo(() => {
        if (!employee?.drivingLicenceDetails) return [];

        return [
            { label: 'Number', value: employee.drivingLicenceDetails.number },
            { label: 'Issue date', value: employee.drivingLicenceDetails.issueDate ? formatDate(employee.drivingLicenceDetails.issueDate) : null },
            { label: 'Expiry Date', value: employee.drivingLicenceDetails.expiryDate ? formatDate(employee.drivingLicenceDetails.expiryDate) : null },
            { label: 'Last Updated', value: employee.drivingLicenceDetails.lastUpdated ? formatDate(employee.drivingLicenceDetails.lastUpdated) : null }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [employee?.drivingLicenceDetails, formatDate]);

    // Show only if user has view permission
    if (!canView) {
        return null;
    }

    // If no number, don't render card UI but still manage modal
    if (!hasNumber) {
        return (
            <>
                {/* Hidden - just manages modal state for add button */}
                {showDrivingLicenseModal && (
                    <DrivingLicenseModal
                        isOpen={true}
                        onClose={handleCloseDrivingLicenseModal}
                        drivingLicenseForm={drivingLicenseForm}
                        setDrivingLicenseForm={setDrivingLicenseForm}
                        drivingLicenseErrors={drivingLicenseErrors}
                        setDrivingLicenseErrors={setDrivingLicenseErrors}
                        savingDrivingLicense={savingDrivingLicense}
                        drivingLicenseFileRef={drivingLicenseFileRef}
                        employee={employee}
                        onDrivingLicenseFileChange={handleDrivingLicenseFileChange}
                        onSaveDrivingLicense={handleSaveDrivingLicense}
                        validateDrivingLicenseDateField={validateDrivingLicenseDateField}
                        setViewingDocument={setViewingDocument}
                        setShowDocumentViewer={setShowDocumentViewer}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-800">Driving Licences</h3>
                    <div className="flex items-center gap-2">
                        {canEdit && hasNumber && (
                            <button
                                onClick={() => handleOpenDrivingLicenseModal(false)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Edit"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                        )}
                        {hasDocument && (
                            <button
                                onClick={handleViewDocument}
                                className="text-green-600 hover:text-green-700 transition-colors"
                                title="View Document"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
                <div>
                    {/* Expiry Warning */}
                    {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (employee?.drivingLicenceDetails?.expiryDate) {
                            const exp = new Date(employee.drivingLicenceDetails.expiryDate);
                            if (exp < today) {
                                return (
                                    <div className="mx-6 mb-4 mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                                        <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <h4 className="font-semibold text-sm">Driving License Expired</h4>
                                            <p className="text-sm mt-1 opacity-90">
                                                This driving license expired on {exp.toISOString().split('T')[0]}. Please upload renewed driving license details.
                                            </p>
                                            <button
                                                onClick={() => handleOpenDrivingLicenseModal(true)}
                                                className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Renew Driving License
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                        }
                        return null;
                    })()}

                    {dataRows.map((row, index, arr) => (
                        <div
                            key={row.label}
                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-500">{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Driving License Modal */}
            {showDrivingLicenseModal && (
                <DrivingLicenseModal
                    isOpen={true}
                    onClose={handleCloseDrivingLicenseModal}
                    drivingLicenseForm={drivingLicenseForm}
                    setDrivingLicenseForm={setDrivingLicenseForm}
                    drivingLicenseErrors={drivingLicenseErrors}
                    setDrivingLicenseErrors={setDrivingLicenseErrors}
                    savingDrivingLicense={savingDrivingLicense}
                    drivingLicenseFileRef={drivingLicenseFileRef}
                    employee={employee}
                    onDrivingLicenseFileChange={handleDrivingLicenseFileChange}
                    onSaveDrivingLicense={handleSaveDrivingLicense}
                    validateDrivingLicenseDateField={validateDrivingLicenseDateField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}
        </>
    );
});

export default DrivingLicenseCard;
