'use client';

import { memo, useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { validateDate } from "@/utils/validation";
import { toast } from '@/hooks/use-toast';
import LabourCardModal from '../modals/LabourCardModal';

const LabourCard = forwardRef(function LabourCard({
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
    const [showLabourCardModal, setShowLabourCardModal] = useState(false);
    const [labourCardForm, setLabourCardForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null
    });
    const [labourCardErrors, setLabourCardErrors] = useState({});
    const [savingLabourCard, setSavingLabourCard] = useState(false);
    const labourCardFileRef = useRef(null);

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
    const validateLabourCardDateField = useCallback((field, value) => {
        const errors = { ...labourCardErrors };
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
                    } else if (labourCardForm.expiryDate) {
                        const expiryDate = new Date(labourCardForm.expiryDate);
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
                    } else if (labourCardForm.issueDate) {
                        const issueDate = new Date(labourCardForm.issueDate);
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
        setLabourCardErrors(errors);
    }, [labourCardForm, labourCardErrors]);

    // File change handler
    const handleLabourCardFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) {
            setLabourCardForm(prev => ({ ...prev, file }));
            setLabourCardErrors(prev => {
                const updated = { ...prev };
                delete updated.file;
                return updated;
            });
        }
    }, []);

    // Save handler
    const handleSaveLabourCard = useCallback(async () => {
        const errors = {};

        // Validate number
        if (!labourCardForm.number || !labourCardForm.number.trim()) {
            errors.number = 'Labour Card number is required';
        }

        // Validate issue date
        if (!labourCardForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(labourCardForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(labourCardForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                } else if (labourCardForm.expiryDate) {
                    const expiryDate = new Date(labourCardForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date - only required if no existing data
        if (!labourCardForm.expiryDate) {
            if (!hasExistingData || !employee?.labourCardDetails?.expiryDate) {
                errors.expiryDate = 'Expiry date is required';
            }
        } else {
            const dateValidation = validateDate(labourCardForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(labourCardForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (labourCardForm.issueDate) {
                    const issueDate = new Date(labourCardForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file - only required if no existing document
        const hasExistingDocument = Boolean(employee?.labourCardDetails?.document?.url || employee?.labourCardDetails?.document?.data || employee?.labourCardDetails?.document?.name);
        if (!labourCardForm.file && !hasExistingDocument) {
            errors.file = 'Document is required';
        }

        if (Object.keys(errors).length > 0) {
            setLabourCardErrors(errors);
            return;
        }

        setSavingLabourCard(true);
        try {
            let upload = null;
            let uploadName = '';
            let uploadMime = '';

            if (labourCardForm.file) {
                // New file selected
                upload = await fileToBase64(labourCardForm.file);
                uploadName = labourCardForm.file.name;
                uploadMime = labourCardForm.file.type;
            } else if (employee?.labourCardDetails?.document?.data) {
                // No new file, but existing document in DB - use existing document
                upload = employee.labourCardDetails.document.data;
                uploadName = employee.labourCardDetails.document.name || '';
                uploadMime = employee.labourCardDetails.document.mimeType || '';
            }

            const response = await axiosInstance.patch(`/Employee/labour-card/${employeeId}`, {
                number: labourCardForm.number.trim(),
                issueDate: labourCardForm.issueDate,
                expiryDate: labourCardForm.expiryDate,
                upload,
                uploadName,
                uploadMime
            });

            // Optimistic update
            if (response.data?.labourCardDetails) {
                if (updateEmployeeOptimistically) {
                    updateEmployeeOptimistically({
                        labourCardDetails: response.data.labourCardDetails
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

            handleCloseLabourCardModal();
            toast({
                title: "Labour Card updated",
                description: "Labour Card information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Labour Card', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingLabourCard(false);
        }
    }, [labourCardForm, employee, employeeId, fileToBase64, updateEmployeeOptimistically, fetchEmployee, toast]);

    // Open modal handler
    const handleOpenLabourCardModal = useCallback(() => {
        if (employee?.labourCardDetails) {
            setLabourCardForm({
                number: employee.labourCardDetails.number || '',
                issueDate: employee.labourCardDetails.issueDate ? employee.labourCardDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.labourCardDetails.expiryDate ? employee.labourCardDetails.expiryDate.substring(0, 10) : '',
                file: null // Don't set file - modal will show existing document
            });
        } else {
            setLabourCardForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
        }
        setLabourCardErrors({});
        setShowLabourCardModal(true);
    }, [employee]);

    // Close modal handler
    const handleCloseLabourCardModal = useCallback(() => {
        if (!savingLabourCard) {
            setShowLabourCardModal(false);
            setLabourCardForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
            setLabourCardErrors({});
            if (labourCardFileRef.current) {
                labourCardFileRef.current.value = '';
            }
        }
    }, [savingLabourCard]);

    // Open document viewer handler
    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const document = employee?.labourCardDetails?.document;
            if (!document) return;

            if (document.url && (document.url.startsWith('http://') || document.url.startsWith('https://'))) {
                try {
                    const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                        params: { type: 'labourCard' }
                    });
                    if (response.data && response.data.data) {
                        setViewingDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Labour_Card.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                        setShowDocumentViewer(true);
                    }
                } catch (error) {
                    console.error('Error fetching Labour Card document:', error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to load document. Please try again."
                    });
                }
            } else if (document.data) {
                setViewingDocument({
                    data: document.data,
                    name: document.name || 'Labour_Card.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
                setShowDocumentViewer(true);
            }
            return;
        }

        // Use centralized handler (like Bank Account)
        const document = employee?.labourCardDetails?.document;
        if (!document) {
            alert('No labour card document found');
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
                    name: document.name || 'Labour_Card.pdf',
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
                    name: document.name || 'Labour_Card.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            }
        } else if (employeeId && document.name) {
            // If no local data but document exists (has name), fetch from server
            onViewDocument({
                data: null,
                name: document.name || 'Labour_Card.pdf',
                mimeType: document.mimeType || 'application/pdf',
                loading: true
            });
            
            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: 'labourCard' }
                });
                
                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl || 
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));
                    
                    if (isCloudinaryUrl) {
                        onViewDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Labour_Card.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }
                        
                        onViewDocument({
                            data: cleanData,
                            name: response.data.name || document.name || 'Labour_Card.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    }
                } else {
                    onViewDocument(null);
                    alert('Failed to load labour card document');
                }
            } catch (err) {
                console.error('Error fetching Labour Card document:', err);
                onViewDocument(null);
                alert('Error fetching labour card document. Please try again.');
            }
        } else {
            // No document data available at all
            alert('Labour card document data not available');
        }
    }, [employee, employeeId, onViewDocument, setViewingDocument, setShowDocumentViewer]);

    // Expose openModal function via ref
    useImperativeHandle(ref, () => ({
        openModal: handleOpenLabourCardModal
    }));

    // Memoize permission checks and data existence
    const canView = useMemo(() => 
        isAdmin() || hasPermission('hrm_employees_view_labour_card', 'isView'),
        [isAdmin, hasPermission]
    );
    
    const canEdit = useMemo(() => 
        isAdmin() || hasPermission('hrm_employees_view_labour_card', 'isEdit'),
        [isAdmin, hasPermission]
    );

    const hasNumber = useMemo(() => 
        !!employee?.labourCardDetails?.number,
        [employee?.labourCardDetails?.number]
    );

    const hasDocument = useMemo(() => 
        !!(employee?.labourCardDetails?.document?.url || employee?.labourCardDetails?.document?.data || employee?.labourCardDetails?.document?.name),
        [employee?.labourCardDetails?.document]
    );

    // Memoize data rows
    const dataRows = useMemo(() => {
        if (!employee?.labourCardDetails) return [];
        
        return [
            { label: 'Number', value: employee.labourCardDetails.number },
            { label: 'Issue date', value: employee.labourCardDetails.issueDate ? formatDate(employee.labourCardDetails.issueDate) : null },
            { label: 'Expiry Date', value: employee.labourCardDetails.expiryDate ? formatDate(employee.labourCardDetails.expiryDate) : null },
            { label: 'Last Updated', value: employee.labourCardDetails.lastUpdated ? formatDate(employee.labourCardDetails.lastUpdated) : null }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [employee?.labourCardDetails, formatDate]);

    // Show only if user has view permission
    if (!canView) {
        return null;
    }

    // If no number, don't render card UI but still manage modal
    if (!hasNumber) {
        return (
            <>
                {/* Hidden - just manages modal state for add button */}
                {showLabourCardModal && (
                    <LabourCardModal
                        isOpen={true}
                        onClose={handleCloseLabourCardModal}
                        labourCardForm={labourCardForm}
                        setLabourCardForm={setLabourCardForm}
                        labourCardErrors={labourCardErrors}
                        setLabourCardErrors={setLabourCardErrors}
                        savingLabourCard={savingLabourCard}
                        labourCardFileRef={labourCardFileRef}
                        employee={employee}
                        onLabourCardFileChange={handleLabourCardFileChange}
                        onSaveLabourCard={handleSaveLabourCard}
                        validateLabourCardDateField={validateLabourCardDateField}
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
                <h3 className="text-xl font-semibold text-gray-800">Labour Card</h3>
                <div className="flex items-center gap-2">
                        {canEdit && hasNumber && (
                        <button
                                onClick={handleOpenLabourCardModal}
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

            {/* Labour Card Modal */}
            {showLabourCardModal && (
                <LabourCardModal
                    isOpen={true}
                    onClose={handleCloseLabourCardModal}
                    labourCardForm={labourCardForm}
                    setLabourCardForm={setLabourCardForm}
                    labourCardErrors={labourCardErrors}
                    setLabourCardErrors={setLabourCardErrors}
                    savingLabourCard={savingLabourCard}
                    labourCardFileRef={labourCardFileRef}
                    employee={employee}
                    onLabourCardFileChange={handleLabourCardFileChange}
                    onSaveLabourCard={handleSaveLabourCard}
                    validateLabourCardDateField={validateLabourCardDateField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}
        </>
    );
});

export default LabourCard;
