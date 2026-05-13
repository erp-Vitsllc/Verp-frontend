'use client';

import { memo, useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { validateDate } from "@/utils/validation";
import { toast } from '@/hooks/use-toast';
import { crudAccess } from '@/utils/permissions';
import LabourCardModal from '../modals/LabourCardModal';
import DeleteConfirmDialog from '../modals/DeleteConfirmDialog';

const LabourCard = forwardRef(function LabourCard({
    employee,
    employeeId,
    formatDate,
    fetchEmployee,
    updateEmployeeOptimistically,
    onViewDocument,
    onRequestNotRenew,
    viewerIsDesignatedFlowchartHr = false,
    onHrApproveNotRenew,
    onHrRejectNotRenewOpen,
    setViewingDocument,
    setShowDocumentViewer,
    isCompanyProfile = false
}, ref) {
    const labourPerm = useMemo(
        () => (isCompanyProfile ? 'hrm_company_view_owner_labour_card' : 'hrm_employees_view_labour_card'),
        [isCompanyProfile]
    );
    const access = crudAccess(labourPerm);
    // Modal state
    const [showLabourCardModal, setShowLabourCardModal] = useState(false);
    const [labourCardForm, setLabourCardForm] = useState({
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null,
        contractFile: null
    });
    const [labourCardErrors, setLabourCardErrors] = useState({});
    const [savingLabourCard, setSavingLabourCard] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showNotRenewConfirm, setShowNotRenewConfirm] = useState(false);
    const [isRenewing, setIsRenewing] = useState(false);
    const labourCardFileRef = useRef(null);
    const labourContractFileRef = useRef(null);

    const normalizeIsoDateInput = useCallback((value) => {
        if (!value) return '';
        const s = String(value);
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : '';
    }, []);

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
            if (value && value.trim() !== '') {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
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

    const handleLabourContractFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) {
            setLabourCardForm(prev => ({ ...prev, contractFile: file }));
            setLabourCardErrors(prev => {
                const updated = { ...prev };
                delete updated.contractFile;
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

        if (labourCardForm.issueDate) {
            const dateValidation = validateDate(labourCardForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
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

            }
        }

        // Validate labour card file - only required if no existing document
        const hasExistingDocument = Boolean(employee?.labourCardDetails?.document?.url || employee?.labourCardDetails?.document?.data || employee?.labourCardDetails?.document?.name);
        if (!labourCardForm.file && !hasExistingDocument) {
            errors.file = 'Document is required';
        }
        const hasExistingContractDocument = Boolean(employee?.labourCardDetails?.labourContractAttachment?.url || employee?.labourCardDetails?.labourContractAttachment?.data || employee?.labourCardDetails?.labourContractAttachment?.name);
        if (!labourCardForm.contractFile && !hasExistingContractDocument) {
            errors.contractFile = 'Labour contract attachment is required';
        }

        if (Object.keys(errors).length > 0) {
            setLabourCardErrors(errors);
            return;
        }

        setSavingLabourCard(true);
        try {
            let upload;
            let uploadName = '';
            let uploadMime = '';
            let contractUpload;
            let contractUploadName = '';
            let contractUploadMime = '';

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
            if (labourCardForm.contractFile) {
                contractUpload = await fileToBase64(labourCardForm.contractFile);
                contractUploadName = labourCardForm.contractFile.name;
                contractUploadMime = labourCardForm.contractFile.type;
            } else if (employee?.labourCardDetails?.labourContractAttachment?.data) {
                contractUpload = employee.labourCardDetails.labourContractAttachment.data;
                contractUploadName = employee.labourCardDetails.labourContractAttachment.name || '';
                contractUploadMime = employee.labourCardDetails.labourContractAttachment.mimeType || '';
            } else if (employee?.labourCardDetails?.labourContractAttachment?.url) {
                contractUpload = employee.labourCardDetails.labourContractAttachment.url;
                contractUploadName = employee.labourCardDetails.labourContractAttachment.name || '';
                contractUploadMime = employee.labourCardDetails.labourContractAttachment.mimeType || '';
            }

            const response = await axiosInstance.patch(`/Employee/labour-card/${employeeId}`, {
                number: labourCardForm.number.trim(),
                issueDate: labourCardForm.issueDate,
                expiryDate: labourCardForm.expiryDate,
                upload,
                uploadName,
                uploadMime,
                contractUpload,
                contractUploadName,
                contractUploadMime
            });
            const isQueuedApproval = String(response?.data?.message || '').toLowerCase().includes('queued for hr activation approval');

            // Optimistic update
            if (!isQueuedApproval && response.data?.labourCardDetails) {
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
                title: isQueuedApproval ? "Labour Card queued" : "Labour Card updated",
                description: isQueuedApproval
                    ? "Change is stored for HR activation approval. Live card will update after approval."
                    : "Labour Card information has been saved successfully."
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
    const handleOpenLabourCardModal = useCallback((isRenew = false, seed = null) => {
        setIsRenewing(!!isRenew);
        if (seed && typeof seed === 'object') {
            setLabourCardForm({
                number: seed.number || '',
                issueDate: normalizeIsoDateInput(seed.issueDate),
                expiryDate: normalizeIsoDateInput(seed.expiryDate),
                file: null,
                contractFile: null
            });
        } else if (!isRenew && employee?.labourCardDetails) {
            setLabourCardForm({
                number: employee.labourCardDetails.number || '',
                issueDate: employee.labourCardDetails.issueDate ? employee.labourCardDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.labourCardDetails.expiryDate ? employee.labourCardDetails.expiryDate.substring(0, 10) : '',
                file: null, // Don't set file - modal will show existing document
                contractFile: null
            });
        } else {
            setLabourCardForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null,
                contractFile: null
            });
        }
        setLabourCardErrors({});
        setShowLabourCardModal(true);
    }, [employee, normalizeIsoDateInput]);

    const handleOpenForActivationHold = useCallback((proposed) => {
        handleOpenLabourCardModal(false, proposed);
    }, [handleOpenLabourCardModal]);

    // Close modal handler
    const handleCloseLabourCardModal = useCallback(() => {
        if (!savingLabourCard) {
            setShowLabourCardModal(false);
            setLabourCardForm({
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null,
                contractFile: null
            });
            setLabourCardErrors({});
            if (labourCardFileRef.current) {
                labourCardFileRef.current.value = '';
            }
            if (labourContractFileRef.current) {
                labourContractFileRef.current.value = '';
            }
        }
    }, [savingLabourCard]);

    const handleDeleteLabourCard = useCallback(async () => {
        if (!access.delete) {
            toast({ variant: "destructive", title: "Access denied", description: "You do not have permission to delete Labour Card details." });
            return;
        }
        setShowDeleteConfirm(false);
        try {
            await axiosInstance.delete(`/Employee/labour-card/${employeeId}`);
            toast({ title: "Labour Card deleted", description: "Labour Card details removed successfully." });
            if (fetchEmployee) fetchEmployee(true).catch(console.error);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Delete failed",
                description: error.response?.data?.message || error.message || "Failed to delete Labour Card details."
            });
        }
    }, [employeeId, fetchEmployee]);

    const handleNotRenewLabourCard = useCallback(async () => {
        const pendingList = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        const hasPending = pendingList.some((r) => r?.status === 'pending' && r?.kind === 'labourCard');
        if (hasPending) {
            toast({ title: 'Already pending', description: 'A not-renew request is already waiting for HR approval.' });
            setShowNotRenewConfirm(false);
            return;
        }
        setShowNotRenewConfirm(false);
        const details = employee?.labourCardDetails;
        if (!details?.number) {
            toast({ variant: 'destructive', title: 'Not available', description: 'Labour Card data not found.' });
            return;
        }
        try {
            await onRequestNotRenew?.({ kind: 'labourCard', label: 'Labour Card' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || error.message || 'Failed to submit Labour Card not-renew request.',
            });
        }
    }, [employee?.labourCardDetails, employee?.pendingNotRenewRequests, onRequestNotRenew]);

    // Open document viewer handler
    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const document = employee?.labourCardDetails?.document;
            console.log('Labour - handleViewDocument (local fallback):', document);
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
        console.log('Labour - handleViewDocument (centralized):', document);
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
                onViewDocument({ moduleId: labourPerm,
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

                onViewDocument({ moduleId: labourPerm,
                    data: cleanData,
                    name: document.name || 'Labour_Card.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            }
        } else if (employeeId && document.name) {
            // If no local data but document exists (has name), fetch from server
            onViewDocument({ moduleId: labourPerm,
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
                        onViewDocument({ moduleId: labourPerm,
                            data: response.data.data,
                            name: response.data.name || document.name || 'Labour_Card.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }

                        onViewDocument({ moduleId: labourPerm,
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
        openModal: handleOpenLabourCardModal,
        openModalForActivationHold: handleOpenForActivationHold
    }));

    // Memoize permission checks and data existence
    const getPendingSectionData = useCallback((sectionName) => {
        const list = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
        const sec = String(sectionName || '').toLowerCase();
        const match = list.find(e => String(e.section || '').toLowerCase() === sec);
        return match?.proposedData || null;
    }, [employee?.pendingReactivationChanges]);

    const effectiveLabourCardDetails = useMemo(() => {
        return employee?.labourCardDetails || getPendingSectionData('labourcard');
    }, [employee?.labourCardDetails, getPendingSectionData]);

    const hasNumber = useMemo(() =>
        !!effectiveLabourCardDetails?.number,
        [effectiveLabourCardDetails?.number]
    );

    const hasDocument = useMemo(() =>
        !!(employee?.labourCardDetails?.document?.url || employee?.labourCardDetails?.document?.data || employee?.labourCardDetails?.document?.name),
        [employee?.labourCardDetails?.document]
    );
    const isCardExpired = useMemo(() => {
        const expRaw = effectiveLabourCardDetails?.expiryDate;
        if (!expRaw) return false;
        const exp = new Date(expRaw);
        if (Number.isNaN(exp.getTime())) return false;
        exp.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return exp < today;
    }, [effectiveLabourCardDetails?.expiryDate]);
    const pendingNotRenewRequest = useMemo(() => {
        const pendingList = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        return pendingList.find((r) => r?.status === 'pending' && r?.kind === 'labourCard') || null;
    }, [employee?.pendingNotRenewRequests]);

    // Memoize data rows
    const dataRows = useMemo(() => {
        if (!effectiveLabourCardDetails) return [];

        return [
            { label: 'Number', value: effectiveLabourCardDetails.number },
            { label: 'Expiry Date', value: effectiveLabourCardDetails.expiryDate ? formatDate(effectiveLabourCardDetails.expiryDate) : null },
            { label: 'Last Updated', value: effectiveLabourCardDetails.lastUpdated ? formatDate(effectiveLabourCardDetails.lastUpdated) : null }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [effectiveLabourCardDetails, formatDate]);

    const isPendingApproval = useMemo(() => {
        return (employee?.pendingReactivationChanges || []).some(
            (change) => String(change?.section || '').toLowerCase() === 'labourcard'
        );
    }, [employee?.pendingReactivationChanges]);

    // Show only if user has view permission
    if (!access.view) {
        return null;
    }

    if (!hasNumber) {
        if (!access.create && !access.edit) {
            return (
                <div className="rounded-2xl shadow-sm border break-inside-avoid mb-6 bg-white border-gray-100">
                    <div className="flex items-center px-6 py-4 border-b border-gray-100">
                        <h3 className="text-xl font-semibold text-gray-800">Labour Card</h3>
                    </div>
                    <p className="px-6 py-4 text-sm text-gray-500">No labour card on file.</p>
                </div>
            );
        }
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
                        labourContractFileRef={labourContractFileRef}
                        employee={employee}
                        onLabourCardFileChange={handleLabourCardFileChange}
                        onLabourContractFileChange={handleLabourContractFileChange}
                        onSaveLabourCard={handleSaveLabourCard}
                        validateLabourCardDateField={validateLabourCardDateField}
                        setViewingDocument={setViewingDocument}
                        setShowDocumentViewer={setShowDocumentViewer}
                        isRenew={isRenewing}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div
                className={`rounded-2xl shadow-sm border break-inside-avoid mb-6 ${
                    isCardExpired ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'
                }`}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center">
                        <h3 className="text-xl font-semibold text-gray-800">Labour Card</h3>
                        {isPendingApproval && (
                            <span
                                className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                title="waiting for hr approval"
                            >
                                !
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {access.edit && hasNumber && (
                            <>
                                <button
                                    onClick={() => handleOpenLabourCardModal(false)}
                                    className="text-blue-600 hover:text-blue-700 transition-colors"
                                    title="Edit"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleOpenLabourCardModal(true)}
                                    className="text-orange-600 hover:text-orange-700 transition-colors"
                                    title="Renew Labour Card"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                                        <path d="M21 3v5h-5"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setShowNotRenewConfirm(true)}
                                    className="text-slate-600 hover:text-slate-700 transition-colors"
                                    title="Not Renew"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M4.9 4.9l14.2 14.2" />
                                    </svg>
                                </button>
                            </>
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
                        {access.delete && hasNumber && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete Labour Card"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                                    <path d="M10 11v6"></path>
                                    <path d="M14 11v6"></path>
                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
                {pendingNotRenewRequest && (
                    <div className="px-6 py-3 border-b border-amber-100 bg-amber-50/70 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">Pending HR approval</p>
                            <p className="text-sm text-amber-700">{employee?.labourCardDetails?.number || '-'}</p>
                        </div>
                        {viewerIsDesignatedFlowchartHr && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onHrApproveNotRenew?.({ kind: 'labourCard' })}
                                    className="w-9 h-9 rounded-xl border border-emerald-200 bg-white text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors flex items-center justify-center"
                                    title="Approve Not Renew"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => onHrRejectNotRenewOpen?.({ kind: 'labourCard' })}
                                    className="w-9 h-9 rounded-xl border border-rose-200 bg-white text-rose-600 hover:text-rose-700 hover:border-rose-300 transition-colors flex items-center justify-center"
                                    title="Reject Not Renew"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div>
                    {/* Expiry Warning */}
                    {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (effectiveLabourCardDetails?.expiryDate) {
                            const exp = new Date(effectiveLabourCardDetails.expiryDate);
                            if (exp < today) {
                                return (
                                    <div className="mx-6 mb-4 mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                                        <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <h4 className="font-semibold text-sm">Labour Card Expired</h4>
                                            <p className="text-sm mt-1 opacity-90">
                                                This labour card expired on {exp.toISOString().split('T')[0]}. Please upload renewed labour card details.
                                            </p>
                                            {access.edit && (
                                            <button
                                                onClick={() => handleOpenLabourCardModal(true)}
                                                className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Renew Labour Card
                                            </button>
                                            )}
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
                            <span className={isCardExpired && /expiry/i.test(row.label) ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                                {row.value}
                            </span>
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
                    labourContractFileRef={labourContractFileRef}
                    employee={employee}
                    onLabourCardFileChange={handleLabourCardFileChange}
                    onLabourContractFileChange={handleLabourContractFileChange}
                    onSaveLabourCard={handleSaveLabourCard}
                    validateLabourCardDateField={validateLabourCardDateField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                    isRenew={isRenewing}
                />
            )}
            <DeleteConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Labour Card details?"
                description="This will permanently remove the Labour Card details for this employee."
                confirmLabel="Delete"
                onConfirm={handleDeleteLabourCard}
            />
            <DeleteConfirmDialog
                open={showNotRenewConfirm}
                onOpenChange={setShowNotRenewConfirm}
                title="Not Renew Labour Card?"
                description="This will move the current Labour Card to Old Documents and remove it from Basic Details."
                confirmLabel="Not Renew"
                onConfirm={handleNotRenewLabourCard}
            />
        </>
    );
});

export default LabourCard;
