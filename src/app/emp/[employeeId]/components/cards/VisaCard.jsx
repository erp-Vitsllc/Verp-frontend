'use client';

import { useMemo, useState, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import VisaModal from '../modals/VisaModal';

const VisaCard = forwardRef(function VisaCard({
    employee,
    employeeId,
    isAdmin,
    hasPermission,
    formatDate,
    isUAENationality,
    fetchEmployee,
    updateEmployeeOptimistically,
    onViewDocument,
    setViewingDocument,
    setShowDocumentViewer
}, ref) {
    // Modal state
    const [showVisaModal, setShowVisaModal] = useState(false);
    const [showVisaDropdownLocal, setShowVisaDropdownLocal] = useState(false);
    const [selectedVisaType, setSelectedVisaType] = useState('');
    const [isRenewing, setIsRenewing] = useState(false);
    const [showRenewDropdown, setShowRenewDropdown] = useState(false);
    const [showHeaderRenewDropdown, setShowHeaderRenewDropdown] = useState(false);

    // Ref to store the visa type that was active BEFORE renewal started
    const prevActiveVisaTypeRef = useRef(null);

    // Memoize visa types
    const visaTypesLocal = useMemo(() => [
        { key: 'visit', label: 'Visit Visa' },
        { key: 'employment', label: 'Employment Visa' },
        { key: 'spouse', label: 'Spouse Visa' }
    ], []);

    const selectedVisaLabel = useMemo(() =>
        visaTypesLocal.find((type) => type.key === selectedVisaType)?.label || '',
        [selectedVisaType, visaTypesLocal]);

    const isPermanent = useMemo(() => employee?.status?.trim() === 'Permanent', [employee?.status]);

    // Derived Active Visa Logic (Lifted)
    const activeVisaType = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isValid = (dateStr) => dateStr && new Date(dateStr) >= today;

        // Prioritize Valid
        if (isValid(employee?.visaDetails?.employment?.expiryDate)) return 'employment';
        if (isValid(employee?.visaDetails?.spouse?.expiryDate)) return 'spouse';
        if (!isPermanent && isValid(employee?.visaDetails?.visit?.expiryDate)) return 'visit';

        // Fallback to Expired
        if (employee?.visaDetails?.employment?.number) return 'employment';
        if (employee?.visaDetails?.spouse?.number) return 'spouse';
        if (!isPermanent && employee?.visaDetails?.visit?.number) return 'visit';

        return null;
    }, [employee?.visaDetails, isPermanent]);

    // Format date helper
    const formatDateForForm = useCallback((dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        } else {
            return dateString.includes('T') ? dateString.split('T')[0] : dateString.substring(0, 10);
        }
    }, []);

    // Derived initial data for the SELECTED visa type
    const initialVisaData = useMemo(() => {
        // If renewing, we want FRESH data (empty form), so return null
        if (isRenewing) return null;

        if (!selectedVisaType || !employee?.visaDetails) return null;

        const details = employee.visaDetails[selectedVisaType];
        if (!details) return null;

        return {
            number: details.number || '',
            issueDate: formatDateForForm(details.issueDate),
            expiryDate: formatDateForForm(details.expiryDate),
            sponsor: details.sponsor || '',
            fileBase64: details.document?.data || '',
            fileName: details.document?.name || '',
            fileMime: details.document?.mimeType || ''
        };
    }, [selectedVisaType, employee, formatDateForForm, isRenewing]);


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

    // Submit handler
    const handleVisaSubmit = useCallback(async (formData) => {
        try {
            let visaCopyUrl = null;
            let visaCopyName = formData.fileName || '';
            let visaCopyMime = formData.fileMime || '';

            // Upload visa document to Cloudinary FIRST (if new file provided)
            if (formData.file) {
                visaCopyName = formData.file.name;
                visaCopyMime = formData.file.type || 'application/pdf';

                try {
                    const base64Data = await fileToBase64(formData.file);
                    const fullBase64 = `data:${visaCopyMime};base64,${base64Data}`;

                    // Upload to Cloudinary
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/visa/${selectedVisaType}`,
                        fileName: visaCopyName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        visaCopyUrl = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading visa to Cloudinary:', uploadError);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                }
            } else if (employee?.visaDetails?.[selectedVisaType]?.document?.url) {
                // Preserve existing Cloudinary URL
                visaCopyUrl = employee.visaDetails[selectedVisaType].document.url;
                visaCopyName = employee.visaDetails[selectedVisaType].document.name || '';
                visaCopyMime = employee.visaDetails[selectedVisaType].document.mimeType || '';
            } else if (employee?.visaDetails?.[selectedVisaType]?.document?.data) {
                // Legacy: existing base64 data
                visaCopyUrl = employee.visaDetails[selectedVisaType].document.data;
                visaCopyName = employee.visaDetails[selectedVisaType].document.name || '';
                visaCopyMime = employee.visaDetails[selectedVisaType].document.mimeType || '';
            }

            await axiosInstance.patch(`/Employee/visa/${employeeId}`, {
                visaType: selectedVisaType,
                visaNumber: formData.number,
                issueDate: formData.issueDate,
                expiryDate: formData.expiryDate,
                sponsor: formData.sponsor,
                visaCopy: visaCopyUrl,
                visaCopyName: visaCopyName,
                visaCopyMime: visaCopyMime
            });

            // Logic to DELETE the previous visa if we are renewing and switching types
            // e.g., Changed from 'visit' to 'employment' -> delete 'visit'
            if (isRenewing && prevActiveVisaTypeRef.current && prevActiveVisaTypeRef.current !== selectedVisaType) {
                try {
                    await axiosInstance.delete(`/Employee/visa/${employeeId}/${prevActiveVisaTypeRef.current}`);
                    console.log(`Deleted previous visa type: ${prevActiveVisaTypeRef.current}`);
                } catch (deleteErr) {
                    console.error('Failed to delete previous visa type:', deleteErr);
                }
            }

            toast({
                title: "Visa Saved",
                description: `${selectedVisaLabel} details have been saved successfully.`
            });

            // Optimistic update
            if (updateEmployeeOptimistically) {
                // Trigger full refresh for safety with dual operations
                if (fetchEmployee) fetchEmployee(true).catch(console.error);
            } else if (fetchEmployee) {
                fetchEmployee(true).catch(console.error);
            }

            setShowVisaModal(false);
            setSelectedVisaType('');
        } catch (error) {
            console.error('Failed to save visa details:', error);
            toast({
                variant: "destructive",
                title: "Visa Save Failed",
                description: error.response?.data?.message || error.message || "Unable to update visa details. Please try again."
            });
        }
    }, [selectedVisaType, selectedVisaLabel, employeeId, fileToBase64, updateEmployeeOptimistically, fetchEmployee]);



    // Open modal handler
    const handleOpenVisaModal = useCallback((visaType, isRenew = false) => {
        if (isUAENationality()) {
            toast({
                variant: "default",
                title: "Visa Not Required",
                description: "Visa details are only required for employees whose nationality is not UAE."
            });
            return;
        }

        const isPermanent = employee?.status?.trim() === 'Permanent';

        // Restriction: Permanent employees cannot have Visit Visa
        if (isPermanent && visaType === 'visit') {
            toast({
                variant: "destructive",
                title: "Action Not Allowed",
                description: "Permanent employees cannot have a Visit Visa."
            });
            return;
        }

        // Set renewal state
        setIsRenewing(isRenew);

        // Capture the currently active visa type before we start the renewal/edit process
        if (isRenew) {
            prevActiveVisaTypeRef.current = activeVisaType;
        } else {
            prevActiveVisaTypeRef.current = null;
        }

        if (visaType) {
            setSelectedVisaType(visaType);
            setShowVisaDropdownLocal(false);
            setShowHeaderRenewDropdown(false);
            setShowVisaModal(true);
        } else {
            // If no visaType, check which visas exist and open dropdown or direct modal
            const existingVisas = [];
            if (!isPermanent && employee?.visaDetails?.visit?.number) existingVisas.push('visit');
            if (employee?.visaDetails?.employment?.number) existingVisas.push('employment');
            if (employee?.visaDetails?.spouse?.number) existingVisas.push('spouse');

            if (existingVisas.length === 1) {
                // If the only existing visa is 'visit' but status is Permanent, 
                // we must NOT auto-select 'visit'. We should open dropdown (which will filter it out)
                // effectively showing remaining options or nothing?

                if (isPermanent && existingVisas[0] === 'visit') {
                    setShowVisaDropdownLocal(prev => !prev);
                } else {
                    setSelectedVisaType(existingVisas[0]);
                    setShowVisaDropdownLocal(false);
                    setShowVisaModal(true);
                }
            } else {
                setShowVisaDropdownLocal(prev => !prev);
            }
        }
    }, [employee, isUAENationality]);

    // Close modal handler
    const handleCloseVisaModal = useCallback(() => {
        setShowVisaModal(false);
        setSelectedVisaType('');
        setShowVisaDropdownLocal(false);
        setShowHeaderRenewDropdown(false);
        setIsRenewing(false);
        prevActiveVisaTypeRef.current = null;
    }, []);


    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const visitDoc = employee?.visaDetails?.visit?.document;
            const employmentDoc = employee?.visaDetails?.employment?.document;
            const spouseDoc = employee?.visaDetails?.spouse?.document;
            const doc = visitDoc?.url || visitDoc?.data ? visitDoc : (employmentDoc?.url || employmentDoc?.data ? employmentDoc : (spouseDoc?.url || spouseDoc?.data ? spouseDoc : null));
            console.log('Visa - handleViewDocument (local fallback):', doc);

            if (!doc) return;

            if (doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://'))) {
                try {
                    let visaType = 'visit';
                    if (employmentDoc?.url === doc.url || employmentDoc?.data === doc.data) visaType = 'employment';
                    else if (spouseDoc?.url === doc.url || spouseDoc?.data === doc.data) visaType = 'spouse';

                    const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                        params: { type: `visa-${visaType}` }
                    });
                    if (response.data && response.data.data) {
                        setViewingDocument({
                            data: response.data.data,
                            name: response.data.name || doc.name || 'Visa Document.pdf',
                            mimeType: response.data.mimeType || doc.mimeType || 'application/pdf',
                            moduleId: 'hrm_employees_view_visa'
                        });
                        setShowDocumentViewer(true);
                    }
                } catch (error) {
                    console.error('Error fetching visa document:', error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to load document. Please try again."
                    });
                }
            } else if (doc.data) {
                setViewingDocument({
                    data: doc.data,
                    name: doc.name || 'Visa Document.pdf',
                    mimeType: doc.mimeType || 'application/pdf',
                    moduleId: 'hrm_employees_view_visa'
                });
                setShowDocumentViewer(true);
            }
            return;
        }

        // Use centralized handler (like Bank Account)
        const visitDoc = employee?.visaDetails?.visit?.document;
        const employmentDoc = employee?.visaDetails?.employment?.document;
        const spouseDoc = employee?.visaDetails?.spouse?.document;

        // Find the first document that exists (check url, data, or name)
        let doc = null;
        let visaType = 'visit';

        if (visitDoc && (visitDoc.url || visitDoc.data || visitDoc.name)) {
            doc = visitDoc;
            visaType = 'visit';
        } else if (employmentDoc && (employmentDoc.url || employmentDoc.data || employmentDoc.name)) {
            doc = employmentDoc;
            visaType = 'employment';
        } else if (spouseDoc && (spouseDoc.url || spouseDoc.data || spouseDoc.name)) {
            doc = spouseDoc;
            visaType = 'spouse';
        }

        console.log('Visa - handleViewDocument (centralized):', { doc, visaType });

        if (!doc) {
            alert('No visa document found');
            return;
        }

        const documentData = doc.url || doc.data;

        // Check if it's a Cloudinary URL or base64 data
        const isCloudinaryUrl = doc.url || (doc.data && (doc.data.startsWith('http://') || doc.data.startsWith('https://')));

        // If document data is available locally, use it directly
        if (documentData) {
            if (isCloudinaryUrl) {
                // Cloudinary URL - use directly
                onViewDocument({
                    data: documentData,
                    name: doc.name || 'Visa Document.pdf',
                    mimeType: doc.mimeType || 'application/pdf',
                    moduleId: 'hrm_employees_view_visa'
                });
            } else {
                // Base64 data - clean and use
                let cleanData = documentData;
                if (cleanData.includes(',')) {
                    cleanData = cleanData.split(',')[1];
                }

                onViewDocument({
                    data: cleanData,
                    name: doc.name || 'Visa Document.pdf',
                    mimeType: doc.mimeType || 'application/pdf',
                    moduleId: 'hrm_employees_view_visa'
                });
            }
        } else if (employeeId && doc.name) {
            // If no local data but document exists (has name), fetch from server
            // visaType already determined above

            onViewDocument({
                data: null,
                name: doc.name || 'Visa Document.pdf',
                mimeType: doc.mimeType || 'application/pdf',
                loading: true,
                moduleId: 'hrm_employees_view_visa'
            });

            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: `visa-${visaType}` }
                });

                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                    if (isCloudinaryUrl) {
                        onViewDocument({
                            data: response.data.data,
                            name: response.data.name || doc.name || 'Visa Document.pdf',
                            mimeType: response.data.mimeType || doc.mimeType || 'application/pdf',
                            moduleId: 'hrm_employees_view_visa'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }

                        onViewDocument({
                            data: cleanData,
                            name: response.data.name || doc.name || 'Visa Document.pdf',
                            mimeType: response.data.mimeType || doc.mimeType || 'application/pdf',
                            moduleId: 'hrm_employees_view_visa'
                        });
                    }
                } else {
                    onViewDocument(null);
                    alert('Failed to load visa document');
                }
            } catch (err) {
                console.error('Error fetching visa document:', err);
                onViewDocument(null);
                alert('Error fetching visa document. Please try again.');
            }
        } else if (employeeId && doc.name) {
            // If no local data but document exists (has name), fetch from server
            // visaType already determined above

            onViewDocument({
                data: null,
                name: doc.name || 'Visa Document.pdf',
                mimeType: doc.mimeType || 'application/pdf',
                loading: true,
                moduleId: 'hrm_employees_view_visa'
            });

            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: `visa-${visaType}` }
                });

                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                    if (isCloudinaryUrl) {
                        onViewDocument({
                            data: response.data.data,
                            name: response.data.name || doc.name || 'Visa Document.pdf',
                            mimeType: response.data.mimeType || doc.mimeType || 'application/pdf',
                            moduleId: 'hrm_employees_view_visa'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }

                        onViewDocument({
                            data: cleanData,
                            name: response.data.name || doc.name || 'Visa Document.pdf',
                            mimeType: response.data.mimeType || doc.mimeType || 'application/pdf',
                            moduleId: 'hrm_employees_view_visa'
                        });
                    }
                } else {
                    onViewDocument(null);
                    alert('Failed to load visa document');
                }
            } catch (err) {
                console.error('Error fetching visa document:', err);
                onViewDocument(null);
                alert('Error fetching visa document. Please try again.');
            }
        } else {
            // No document data available at all
            alert('Visa document data not available');
        }
    }, [employee, employeeId, onViewDocument, setViewingDocument, setShowDocumentViewer]);


    // Expose openModal function via ref
    useImperativeHandle(ref, () => ({
        openModal: handleOpenVisaModal
    }));

    // Memoize permission checks
    const canView = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_visa', 'isView'),
        [isAdmin, hasPermission]
    );

    const canEdit = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_visa', 'isEdit'),
        [isAdmin, hasPermission]
    );

    const isUAE = useMemo(() => isUAENationality(), [isUAENationality]);

    const hasVisaData = useMemo(() => {
        const isPerm = employee?.status?.trim() === 'Permanent';
        const hasVisit = !isPerm && employee?.visaDetails?.visit?.number;

        return !!(hasVisit ||
            employee?.visaDetails?.employment?.number ||
            employee?.visaDetails?.spouse?.number);
    }, [employee?.visaDetails, employee?.status]);

    const hasDocument = useMemo(() => {
        const visitDoc = employee?.visaDetails?.visit?.document;
        const employmentDoc = employee?.visaDetails?.employment?.document;
        const spouseDoc = employee?.visaDetails?.spouse?.document;
        return !!(visitDoc?.url || visitDoc?.data || visitDoc?.name ||
            employmentDoc?.url || employmentDoc?.data || employmentDoc?.name ||
            spouseDoc?.url || spouseDoc?.data || spouseDoc?.name);
    }, [employee?.visaDetails]);

    // Helpers to create rows
    const createVisaRows = (details) => {
        if (!details?.number) return [];
        return [
            { label: 'Number', value: details.number },
            { label: 'Issue date', value: details.issueDate ? formatDate(details.issueDate) : null },
            { label: 'Date of Expiry', value: details.expiryDate ? formatDate(details.expiryDate) : null },
            { label: 'Sponsor', value: details.sponsor }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    };

    const visitVisaRows = useMemo(() => createVisaRows(employee?.visaDetails?.visit), [employee?.visaDetails?.visit, formatDate]);
    const employmentVisaRows = useMemo(() => createVisaRows(employee?.visaDetails?.employment), [employee?.visaDetails?.employment, formatDate]);
    const spouseVisaRows = useMemo(() => createVisaRows(employee?.visaDetails?.spouse), [employee?.visaDetails?.spouse, formatDate]);

    if (!canView || isUAE) return null;

    if (!hasVisaData) {
        return (
            <>
                {showVisaModal && (
                    <VisaModal
                        isOpen={true}
                        onClose={handleCloseVisaModal}
                        initialData={initialVisaData}
                        onVisaSubmit={handleVisaSubmit}
                        selectedVisaType={selectedVisaType}
                        selectedVisaLabel={selectedVisaLabel}
                        employee={employee}
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
                    <h3 className="text-xl font-semibold text-gray-800">Visa</h3>
                    <div className="flex items-center gap-2 relative">
                        {canEdit && hasVisaData && activeVisaType && (
                            <>
                                <button
                                    onClick={() => handleOpenVisaModal(activeVisaType, false)}
                                    className="text-blue-600 hover:text-blue-700 transition-colors"
                                    title="Edit"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>

                                <button
                                    onClick={() => setShowHeaderRenewDropdown(!showHeaderRenewDropdown)}
                                    className="text-orange-600 hover:text-orange-700 transition-colors"
                                    title="Renew Visa"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                                        <path d="M21 3v5h-5"></path>
                                    </svg>
                                </button>

                                {showHeaderRenewDropdown && (
                                    <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                                        {visaTypesLocal
                                            .filter(type => {
                                                if (isPermanent && type.key === 'visit') return false;
                                                return true;
                                            })
                                            .map((type) => (
                                                <button
                                                    key={type.key}
                                                    onClick={() => handleOpenVisaModal(type.key, true)}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                    </div>
                                )}
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

                        {showVisaDropdownLocal && (
                            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                                {visaTypesLocal
                                    .filter(type => {
                                        // Filter out 'visit' type if employee is Permanent
                                        if (isPermanent && type.key === 'visit') {
                                            return false;
                                        }
                                        return true;
                                    })
                                    .map((type) => (
                                        <button
                                            key={type.key}
                                            onClick={() => handleOpenVisaModal(type.key, false)}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    {/* Expiry Warning - Check all relevant visas */}
                    {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        // Helper to check validity
                        const isValid = (dateStr) => dateStr && new Date(dateStr) >= today;
                        const isExpired = (dateStr) => dateStr && new Date(dateStr) < today;

                        // Check for ANY valid visa first
                        const hasValidVisit = !isPermanent && isValid(employee?.visaDetails?.visit?.expiryDate);
                        const hasValidEmployment = isValid(employee?.visaDetails?.employment?.expiryDate);
                        const hasValidSpouse = isValid(employee?.visaDetails?.spouse?.expiryDate);

                        if (hasValidVisit || hasValidEmployment || hasValidSpouse) {
                            return null; // Do not show expired banner if employee has at least one valid visa
                        }

                        let expiredVisa = null;

                        // If no valid visa, find which one is expired to warn about
                        // Prioritize: Employment > Spouse > Visit
                        if (isExpired(employee?.visaDetails?.employment?.expiryDate)) {
                            expiredVisa = { label: 'Employment Visa', type: 'employment', date: new Date(employee.visaDetails.employment.expiryDate) };
                        } else if (isExpired(employee?.visaDetails?.spouse?.expiryDate)) {
                            expiredVisa = { label: 'Spouse Visa', type: 'spouse', date: new Date(employee.visaDetails.spouse.expiryDate) };
                        } else if (!isPermanent && isExpired(employee?.visaDetails?.visit?.expiryDate)) {
                            expiredVisa = { label: 'Visit Visa', type: 'visit', date: new Date(employee.visaDetails.visit.expiryDate) };
                        }

                        // If no visa exists at all, we don't show expiry warning (that's a "missing" state handled elsewhere or implicitly)

                        if (expiredVisa) {
                            return (
                                <div className="mx-6 mb-4 mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                                    <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="font-semibold text-sm">Visa Expired</h4>
                                        <p className="text-sm mt-1 opacity-90">
                                            This visa ({expiredVisa.label}) expired on {expiredVisa.date.toISOString().split('T')[0]}. Please upload renewed visa details.
                                        </p>
                                        <div className="relative mt-2">
                                            <button
                                                onClick={() => setShowRenewDropdown(!showRenewDropdown)}
                                                className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Renew Visa
                                                <svg className={`w-3 h-3 transition-transform ${showRenewDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {showRenewDropdown && (
                                                <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                                                    {visaTypesLocal
                                                        .filter(type => {
                                                            if (isPermanent && type.key === 'visit') return false;
                                                            return true;
                                                        })
                                                        .map((type) => (
                                                            <button
                                                                key={type.key}
                                                                onClick={() => {
                                                                    handleOpenVisaModal(type.key, true);
                                                                    setShowRenewDropdown(false);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                                                            >
                                                                {type.label}
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Display Only The Active/Relevant Visa */}
                    {activeVisaType && (() => {
                        let rows = [];
                        if (activeVisaType === 'visit') rows = visitVisaRows;
                        else if (activeVisaType === 'employment') rows = employmentVisaRows;
                        else if (activeVisaType === 'spouse') rows = spouseVisaRows;

                        return (
                            <>
                                {rows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600">
                                        <span className="text-gray-500">{row.label}</span>
                                        <span className="text-gray-500">{row.value}</span>
                                    </div>
                                ))}
                            </>
                        );
                    })()}

                </div>
            </div>

            {/* Visa Modal */}
            {showVisaModal && (
                <VisaModal
                    isOpen={true}
                    onClose={handleCloseVisaModal}
                    initialData={initialVisaData}
                    onVisaSubmit={handleVisaSubmit}
                    selectedVisaType={selectedVisaType}
                    selectedVisaLabel={selectedVisaLabel}
                    employee={employee}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}
        </>
    );
});

export default VisaCard;
