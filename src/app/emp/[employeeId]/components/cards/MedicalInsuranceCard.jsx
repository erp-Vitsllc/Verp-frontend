'use client';

import { memo, useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { validateDate, validateName } from "@/utils/validation";
import { toast } from '@/hooks/use-toast';
import { crudAccess } from '@/utils/permissions';
import MedicalInsuranceModal from '../modals/MedicalInsuranceModal';
import DeleteConfirmDialog from '../modals/DeleteConfirmDialog';

const MedicalInsuranceCard = forwardRef(function MedicalInsuranceCard({
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
    const medPerm = useMemo(
        () => (isCompanyProfile ? 'hrm_company_view_owner_medical_insurance' : 'hrm_employees_view_medical_insurance'),
        [isCompanyProfile]
    );
    const access = crudAccess(medPerm);
    // Modal state
    const [showMedicalInsuranceModal, setShowMedicalInsuranceModal] = useState(false);
    const [medicalInsuranceForm, setMedicalInsuranceForm] = useState({
        provider: '',
        number: '',
        issueDate: '',
        expiryDate: '',
        file: null
    });
    const [medicalInsuranceErrors, setMedicalInsuranceErrors] = useState({});
    const [savingMedicalInsurance, setSavingMedicalInsurance] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showNotRenewConfirm, setShowNotRenewConfirm] = useState(false);
    const [isRenewing, setIsRenewing] = useState(false);
    const medicalInsuranceFileRef = useRef(null);

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


    // Validate field
    const validateMedicalInsuranceField = useCallback((field, value) => {
        const errors = { ...medicalInsuranceErrors };
        let error = '';

        if (field === 'provider') {
            if (!value || value.trim() === '') {
                error = 'Provider is required';
            } else {
                const providerValidation = validateName(value.trim(), true);
                if (!providerValidation.isValid) {
                    error = providerValidation.error;
                }
            }
        } else if (field === 'issueDate') {
            if (!value || value.trim() === '') {
                error = 'Issue date is required';
            } else {
                const dateValidation = validateDate(value, true);
                if (!dateValidation.isValid) {
                    error = dateValidation.error;
                } else {
                    const issueDate = new Date(value);
                    if (medicalInsuranceForm.expiryDate) {
                        const expiryDate = new Date(medicalInsuranceForm.expiryDate);
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
                    if (medicalInsuranceForm.issueDate) {
                        const issueDate = new Date(medicalInsuranceForm.issueDate);
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
        setMedicalInsuranceErrors(errors);
    }, [medicalInsuranceForm, medicalInsuranceErrors]);

    // File change handler
    const handleMedicalInsuranceFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) {
            setMedicalInsuranceForm(prev => ({ ...prev, file }));
            setMedicalInsuranceErrors(prev => {
                const updated = { ...prev };
                delete updated.file;
                return updated;
            });
        }
    }, []);

    // Save handler
    const handleSaveMedicalInsurance = useCallback(async () => {
        const errors = {};

        const hasExistingData = Boolean(employee?.medicalInsuranceDetails?.provider);

        // Validate provider - only required if no existing data
        if (!medicalInsuranceForm.provider || !medicalInsuranceForm.provider.trim()) {
            if (!hasExistingData) {
                errors.provider = 'Provider is required';
            }
        } else {
            const providerValidation = validateName(medicalInsuranceForm.provider.trim(), true);
            if (!providerValidation.isValid) {
                errors.provider = providerValidation.error;
            }
        }

        // Validate number - only required if no existing data
        if (!medicalInsuranceForm.number || !medicalInsuranceForm.number.trim()) {
            if (!hasExistingData || !employee?.medicalInsuranceDetails?.number) {
                errors.number = 'Policy number is required';
            }
        }

        // Validate issue date - only required if no existing data
        if (!medicalInsuranceForm.issueDate) {
            if (!hasExistingData || !employee?.medicalInsuranceDetails?.issueDate) {
                errors.issueDate = 'Issue date is required';
            }
        } else {
            const dateValidation = validateDate(medicalInsuranceForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(medicalInsuranceForm.issueDate);
                if (medicalInsuranceForm.expiryDate) {
                    const expiryDate = new Date(medicalInsuranceForm.expiryDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate expiry date - only required if no existing data
        if (!medicalInsuranceForm.expiryDate) {
            if (!hasExistingData || !employee?.medicalInsuranceDetails?.expiryDate) {
                errors.expiryDate = 'Expiry date is required';
            }
        } else {
            const dateValidation = validateDate(medicalInsuranceForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(medicalInsuranceForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (medicalInsuranceForm.issueDate) {
                    const issueDate = new Date(medicalInsuranceForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // Validate file - only required if no existing document
        const hasExistingDocument = Boolean(employee?.medicalInsuranceDetails?.document?.url || employee?.medicalInsuranceDetails?.document?.data || employee?.medicalInsuranceDetails?.document?.name);
        if (!medicalInsuranceForm.file && !hasExistingDocument) {
            errors.file = 'Document is required';
        }

        if (Object.keys(errors).length > 0) {
            setMedicalInsuranceErrors(errors);
            return;
        }

        setSavingMedicalInsurance(true);
        try {
            let upload = null;
            let uploadName = '';
            let uploadMime = '';

            if (medicalInsuranceForm.file) {
                // New file selected
                upload = await fileToBase64(medicalInsuranceForm.file);
                uploadName = medicalInsuranceForm.file.name;
                uploadMime = medicalInsuranceForm.file.type;
            } else if (employee?.medicalInsuranceDetails?.document?.data) {
                // No new file, but existing document in DB - use existing document
                upload = employee.medicalInsuranceDetails.document.data;
                uploadName = employee.medicalInsuranceDetails.document.name || '';
                uploadMime = employee.medicalInsuranceDetails.document.mimeType || '';
            }

            const response = await axiosInstance.patch(`/Employee/medical-insurance/${employeeId}`, {
                provider: medicalInsuranceForm.provider.trim(),
                number: medicalInsuranceForm.number.trim(),
                issueDate: medicalInsuranceForm.issueDate,
                expiryDate: medicalInsuranceForm.expiryDate,
                upload,
                uploadName,
                uploadMime
            });
            const isQueuedApproval = String(response?.data?.message || '').toLowerCase().includes('queued for hr activation approval');

            // Optimistic update
            if (!isQueuedApproval && response.data?.medicalInsuranceDetails) {
                if (updateEmployeeOptimistically) {
                    updateEmployeeOptimistically({
                        medicalInsuranceDetails: response.data.medicalInsuranceDetails
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

            handleCloseMedicalInsuranceModal();
            toast({
                title: isQueuedApproval ? "Medical Insurance queued" : "Medical Insurance updated",
                description: isQueuedApproval
                    ? "Change is stored for HR activation approval. Live card will update after approval."
                    : "Medical Insurance information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Medical Insurance', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingMedicalInsurance(false);
        }
    }, [medicalInsuranceForm, employee, employeeId, fileToBase64, updateEmployeeOptimistically, fetchEmployee, toast]);

    // Open modal handler
    const handleOpenMedicalInsuranceModal = useCallback((isRenew = false, seed = null) => {
        setIsRenewing(!!isRenew);
        if (seed && typeof seed === 'object') {
            setMedicalInsuranceForm({
                provider: seed.provider || '',
                number: seed.number || '',
                issueDate: normalizeIsoDateInput(seed.issueDate),
                expiryDate: normalizeIsoDateInput(seed.expiryDate),
                file: null
            });
        } else if (!isRenew && employee?.medicalInsuranceDetails) {
            setMedicalInsuranceForm({
                provider: employee.medicalInsuranceDetails.provider || '',
                number: employee.medicalInsuranceDetails.number || '',
                issueDate: employee.medicalInsuranceDetails.issueDate ? employee.medicalInsuranceDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.medicalInsuranceDetails.expiryDate ? employee.medicalInsuranceDetails.expiryDate.substring(0, 10) : '',
                file: null // Don't set file - modal will show existing document
            });
        } else {
            setMedicalInsuranceForm({
                provider: '',
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
        }
        setMedicalInsuranceErrors({});
        setShowMedicalInsuranceModal(true);
    }, [employee, normalizeIsoDateInput]);

    const handleOpenForActivationHold = useCallback((proposed) => {
        handleOpenMedicalInsuranceModal(false, proposed);
    }, [handleOpenMedicalInsuranceModal]);

    // Close modal handler
    const handleCloseMedicalInsuranceModal = useCallback(() => {
        if (!savingMedicalInsurance) {
            setShowMedicalInsuranceModal(false);
            setMedicalInsuranceForm({
                provider: '',
                number: '',
                issueDate: '',
                expiryDate: '',
                file: null
            });
            setMedicalInsuranceErrors({});
            if (medicalInsuranceFileRef.current) {
                medicalInsuranceFileRef.current.value = '';
            }
        }
    }, [savingMedicalInsurance]);

    const handleDeleteMedicalInsurance = useCallback(async () => {
        if (!access.delete) {
            toast({ variant: "destructive", title: "Access denied", description: "You do not have permission to delete Medical Insurance details." });
            return;
        }
        setShowDeleteConfirm(false);
        try {
            await axiosInstance.delete(`/Employee/medical-insurance/${employeeId}`);
            toast({ title: "Medical Insurance deleted", description: "Medical Insurance details removed successfully." });
            if (fetchEmployee) fetchEmployee(true).catch(console.error);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Delete failed",
                description: error.response?.data?.message || error.message || "Failed to delete Medical Insurance details."
            });
        }
    }, [employeeId, fetchEmployee]);

    const handleNotRenewMedicalInsurance = useCallback(async () => {
        const pendingList = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        const hasPending = pendingList.some((r) => r?.status === 'pending' && r?.kind === 'medicalInsurance');
        if (hasPending) {
            toast({ title: 'Already pending', description: 'A not-renew request is already waiting for HR approval.' });
            setShowNotRenewConfirm(false);
            return;
        }
        setShowNotRenewConfirm(false);
        const details = employee?.medicalInsuranceDetails;
        if (!details?.provider) {
            toast({ variant: 'destructive', title: 'Not available', description: 'Medical insurance data not found.' });
            return;
        }
        try {
            await onRequestNotRenew?.({ kind: 'medicalInsurance', label: 'Medical Insurance' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || error.message || 'Failed to submit Medical Insurance not-renew request.',
            });
        }
    }, [employee?.medicalInsuranceDetails, employee?.pendingNotRenewRequests, onRequestNotRenew]);

    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const document = employee?.medicalInsuranceDetails?.document;
            if (!document) return;

            if (document.url && (document.url.startsWith('http://') || document.url.startsWith('https://'))) {
                try {
                    const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                        params: { type: 'medicalInsurance' }
                    });
                    if (response.data && response.data.data) {
                        setViewingDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Medical_Insurance.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                        setShowDocumentViewer(true);
                    }
                } catch (error) {
                    console.error('Error fetching Medical Insurance document:', error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to load document. Please try again."
                    });
                }
            } else if (document.data) {
                setViewingDocument({
                    data: document.data,
                    name: document.name || 'Medical_Insurance.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
                setShowDocumentViewer(true);
            }
            return;
        }

        // Use centralized handler (like Bank Account)
        const document = employee?.medicalInsuranceDetails?.document;
        if (!document) {
            alert('No medical insurance document found');
            return;
        }

        const documentData = document.url || document.data;

        // Check if it's a Cloudinary URL or base64 data
        const isCloudinaryUrl = document.url || (document.data && (document.data.startsWith('http://') || document.data.startsWith('https://')));

        // If document data is available locally, use it directly
        if (documentData) {
            if (isCloudinaryUrl) {
                // Cloudinary URL - use directly
                onViewDocument({ moduleId: medPerm,
                    data: documentData,
                    name: document.name || 'Medical_Insurance.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            } else {
                // Base64 data - clean and use
                let cleanData = documentData;
                if (cleanData.includes(',')) {
                    cleanData = cleanData.split(',')[1];
                }

                onViewDocument({ moduleId: medPerm,
                    data: cleanData,
                    name: document.name || 'Medical_Insurance.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            }
        } else if (employeeId) {
            // Fetch from server if needed
            onViewDocument({ moduleId: medPerm,
                data: null,
                name: document.name || 'Medical_Insurance.pdf',
                mimeType: document.mimeType || 'application/pdf',
                loading: true
            });

            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: 'medicalInsurance' }
                });

                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                    if (isCloudinaryUrl) {
                        onViewDocument({ moduleId: medPerm,
                            data: response.data.data,
                            name: response.data.name || document.name || 'Medical_Insurance.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }

                        onViewDocument({ moduleId: medPerm,
                            data: cleanData,
                            name: response.data.name || document.name || 'Medical_Insurance.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    }
                } else {
                    onViewDocument(null);
                    alert('Failed to load medical insurance document');
                }
            } catch (err) {
                console.error('Error fetching Medical Insurance document:', err);
                onViewDocument(null);
                alert('Error fetching medical insurance document. Please try again.');
            }
        } else if (employeeId && document.name) {
            // If no local data but document exists (has name), fetch from server
            onViewDocument({ moduleId: medPerm,
                data: null,
                name: document.name || 'Medical_Insurance.pdf',
                mimeType: document.mimeType || 'application/pdf',
                loading: true
            });

            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: 'medicalInsurance' }
                });

                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                    if (isCloudinaryUrl) {
                        onViewDocument({ moduleId: medPerm,
                            data: response.data.data,
                            name: response.data.name || document.name || 'Medical_Insurance.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }

                        onViewDocument({ moduleId: medPerm,
                            data: cleanData,
                            name: response.data.name || document.name || 'Medical_Insurance.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    }
                } else {
                    onViewDocument(null);
                    alert('Failed to load medical insurance document');
                }
            } catch (err) {
                console.error('Error fetching Medical Insurance document:', err);
                onViewDocument(null);
                alert('Error fetching medical insurance document. Please try again.');
            }
        } else {
            // No document data available at all
            alert('Medical insurance document data not available');
        }
    }, [employee, employeeId, onViewDocument, setViewingDocument, setShowDocumentViewer]);

    // Expose openModal function via ref
    useImperativeHandle(ref, () => ({
        openModal: handleOpenMedicalInsuranceModal,
        openModalForActivationHold: handleOpenForActivationHold
    }));

    const getPendingSectionData = useCallback((sectionName) => {
        const list = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
        const sec = String(sectionName || '').toLowerCase();
        const match = list.find(e => String(e.section || '').toLowerCase() === sec);
        return match?.proposedData || null;
    }, [employee?.pendingReactivationChanges]);

    const effectiveMedicalInsuranceDetails = useMemo(() => {
        return employee?.medicalInsuranceDetails || getPendingSectionData('medicalinsurance');
    }, [employee?.medicalInsuranceDetails, getPendingSectionData]);

    const hasProvider = useMemo(() =>
        !!effectiveMedicalInsuranceDetails?.provider,
        [effectiveMedicalInsuranceDetails?.provider]
    );

    const hasDocument = useMemo(() =>
        !!(employee?.medicalInsuranceDetails?.document?.url || employee?.medicalInsuranceDetails?.document?.data || employee?.medicalInsuranceDetails?.document?.name),
        [employee?.medicalInsuranceDetails?.document]
    );
    const isCardExpired = useMemo(() => {
        const expRaw = effectiveMedicalInsuranceDetails?.expiryDate;
        if (!expRaw) return false;
        const exp = new Date(expRaw);
        if (Number.isNaN(exp.getTime())) return false;
        exp.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return exp < today;
    }, [effectiveMedicalInsuranceDetails?.expiryDate]);
    const pendingNotRenewRequest = useMemo(() => {
        const pendingList = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        return pendingList.find((r) => r?.status === 'pending' && r?.kind === 'medicalInsurance') || null;
    }, [employee?.pendingNotRenewRequests]);

    // Memoize data rows
    const dataRows = useMemo(() => {
        if (!effectiveMedicalInsuranceDetails) return [];

        return [
            { label: 'Provider', value: effectiveMedicalInsuranceDetails.provider },
            { label: 'Number', value: effectiveMedicalInsuranceDetails.number },
            { label: 'Issue date', value: effectiveMedicalInsuranceDetails.issueDate ? formatDate(effectiveMedicalInsuranceDetails.issueDate) : null },
            { label: 'Expiry Date', value: effectiveMedicalInsuranceDetails.expiryDate ? formatDate(effectiveMedicalInsuranceDetails.expiryDate) : null },
            { label: 'Last Updated', value: effectiveMedicalInsuranceDetails.lastUpdated ? formatDate(effectiveMedicalInsuranceDetails.lastUpdated) : null }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [effectiveMedicalInsuranceDetails, formatDate]);

    // Show only if user has view permission
    if (!access.view) {
        return null;
    }

    if (!hasProvider) {
        if (!access.create && !access.edit) {
            return (
                <div className="rounded-2xl shadow-sm border break-inside-avoid mb-6 bg-white border-gray-100">
                    <div className="flex items-center px-6 py-4 border-b border-gray-100">
                        <h3 className="text-xl font-semibold text-gray-800">Medical Insurance</h3>
                    </div>
                    <p className="px-6 py-4 text-sm text-gray-500">No medical insurance on file.</p>
                </div>
            );
        }
        return (
            <>
                {/* Hidden - just manages modal state for add button */}
                {showMedicalInsuranceModal && (
                    <MedicalInsuranceModal
                        isOpen={true}
                        onClose={handleCloseMedicalInsuranceModal}
                        medicalInsuranceForm={medicalInsuranceForm}
                        setMedicalInsuranceForm={setMedicalInsuranceForm}
                        medicalInsuranceErrors={medicalInsuranceErrors}
                        setMedicalInsuranceErrors={setMedicalInsuranceErrors}
                        savingMedicalInsurance={savingMedicalInsurance}
                        medicalInsuranceFileRef={medicalInsuranceFileRef}
                        employee={employee}
                        onMedicalInsuranceFileChange={handleMedicalInsuranceFileChange}
                        onSaveMedicalInsurance={handleSaveMedicalInsurance}
                        validateMedicalInsuranceField={validateMedicalInsuranceField}
                        setViewingDocument={setViewingDocument}
                        setShowDocumentViewer={setShowDocumentViewer}
                        isRenew={isRenewing}
                    />
                )}
            </>
        );
    }

    const isPendingApproval = useMemo(() => {
        return (employee?.pendingReactivationChanges || []).some(
            (change) => String(change?.section || '').toLowerCase() === 'medicalinsurance'
        );
    }, [employee?.pendingReactivationChanges]);

    return (
        <>
            <div
                className={`rounded-2xl shadow-sm border break-inside-avoid mb-6 ${
                    isCardExpired ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'
                }`}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center">
                        <h3 className="text-xl font-semibold text-gray-800">Medical Insurance</h3>
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
                        {access.edit && hasProvider && (
                            <>
                                <button
                                    onClick={() => handleOpenMedicalInsuranceModal(false)}
                                    className="text-blue-600 hover:text-blue-700 transition-colors"
                                    title="Edit"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleOpenMedicalInsuranceModal(true)}
                                    className="text-orange-600 hover:text-orange-700 transition-colors"
                                    title="Renew Medical Insurance"
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
                        {access.delete && hasProvider && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete Medical Insurance"
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
                            <p className="text-sm text-amber-700">{employee?.medicalInsuranceDetails?.number || '-'}</p>
                        </div>
                        {viewerIsDesignatedFlowchartHr && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onHrApproveNotRenew?.({ kind: 'medicalInsurance' })}
                                    className="w-9 h-9 rounded-xl border border-emerald-200 bg-white text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors flex items-center justify-center"
                                    title="Approve Not Renew"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => onHrRejectNotRenewOpen?.({ kind: 'medicalInsurance' })}
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
                        if (effectiveMedicalInsuranceDetails?.expiryDate) {
                            const exp = new Date(effectiveMedicalInsuranceDetails.expiryDate);
                            if (exp < today) {
                                return (
                                    <div className="mx-6 mb-4 mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                                        <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <h4 className="font-semibold text-sm">Medical Insurance Expired</h4>
                                            <p className="text-sm mt-1 opacity-90">
                                                This medical insurance expired on {exp.toISOString().split('T')[0]}. Please upload renewed medical insurance details.
                                            </p>
                                            {access.edit && (
                                            <button
                                                onClick={() => handleOpenMedicalInsuranceModal(true)}
                                                className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Renew Medical Insurance
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

            {/* Medical Insurance Modal */}
            {showMedicalInsuranceModal && (
                <MedicalInsuranceModal
                    isOpen={true}
                    onClose={handleCloseMedicalInsuranceModal}
                    medicalInsuranceForm={medicalInsuranceForm}
                    setMedicalInsuranceForm={setMedicalInsuranceForm}
                    medicalInsuranceErrors={medicalInsuranceErrors}
                    setMedicalInsuranceErrors={setMedicalInsuranceErrors}
                    savingMedicalInsurance={savingMedicalInsurance}
                    medicalInsuranceFileRef={medicalInsuranceFileRef}
                    employee={employee}
                    onMedicalInsuranceFileChange={handleMedicalInsuranceFileChange}
                    onSaveMedicalInsurance={handleSaveMedicalInsurance}
                    validateMedicalInsuranceField={validateMedicalInsuranceField}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                    isRenew={isRenewing}
                />
            )}
            <DeleteConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Medical Insurance details?"
                description="This will permanently remove the Medical Insurance details for this employee."
                confirmLabel="Delete"
                onConfirm={handleDeleteMedicalInsurance}
            />
            <DeleteConfirmDialog
                open={showNotRenewConfirm}
                onOpenChange={setShowNotRenewConfirm}
                title="Not Renew Medical Insurance?"
                description="This will move the current Medical Insurance to Old Documents and remove it from Basic Details."
                confirmLabel="Not Renew"
                onConfirm={handleNotRenewMedicalInsurance}
            />
        </>
    );
});

export default MedicalInsuranceCard;
