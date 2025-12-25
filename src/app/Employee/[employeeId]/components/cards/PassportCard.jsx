'use client';

import { useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import PassportModal from '../modals/PassportModal';

const PassportCard = forwardRef(function PassportCard({
    employee,
    employeeId,
    isAdmin,
    hasPermission,
    getCountryName,
    formatDate,
    fetchEmployee,
    updateEmployeeOptimistically,
    onViewDocument,
    setViewingDocument,
    setShowDocumentViewer
}, ref) {
    // Modal state
    const [showPassportModal, setShowPassportModal] = useState(false);
    const passportFileInputRef = useRef(null);

    // Derived initial data
    const passportInitialData = useMemo(() => {
        if (!employee?.passportDetails) return null;
        const basicNationalityCode = employee?.nationality || employee?.country || '';
        const basicNationality = basicNationalityCode ? getCountryName(basicNationalityCode) : '';
        const passportNationalityCode = employee.passportDetails.nationality || '';
        const passportNationality = passportNationalityCode ? getCountryName(passportNationalityCode) : '';
        const countryOfIssueCode = employee.passportDetails.placeOfIssue || '';
        const countryOfIssue = countryOfIssueCode ? getCountryName(countryOfIssueCode) : '';

        return {
            number: employee.passportDetails.number || '',
            nationality: passportNationality || basicNationality,
            issueDate: employee.passportDetails.issueDate ? employee.passportDetails.issueDate.substring(0, 10) : '',
            expiryDate: employee.passportDetails.expiryDate ? employee.passportDetails.expiryDate.substring(0, 10) : '',
            countryOfIssue: countryOfIssue || '',
            fileBase64: employee.passportDetails.document?.data || '',
            fileName: employee.passportDetails.document?.name || '',
            fileMime: employee.passportDetails.document?.mimeType || ''
        };
    }, [employee, getCountryName]);


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

    // Handle submit
    const handlePassportSubmit = useCallback(async (formData) => {
        try {
            let passportCopyUrl = null;
            let passportCopyName = formData.fileName || '';
            let passportCopyMime = formData.fileMime || '';

            // Upload passport document to Cloudinary FIRST (if new file provided)
            if (formData.file) {
                passportCopyName = formData.file.name;
                passportCopyMime = formData.file.type || 'application/pdf';

                try {
                    const base64Data = await fileToBase64(formData.file);
                    const fullBase64 = `data:${passportCopyMime};base64,${base64Data}`;

                    // Upload to Cloudinary
                    const uploadResponse = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                        document: fullBase64,
                        folder: `employee-documents/${employeeId}/passport`,
                        fileName: passportCopyName,
                        resourceType: 'raw'
                    }, {
                        timeout: 30000 // 30 second timeout for large files
                    });

                    if (uploadResponse.data && uploadResponse.data.url) {
                        passportCopyUrl = uploadResponse.data.url;
                    } else {
                        throw new Error('No URL returned from upload');
                    }
                } catch (uploadError) {
                    console.error('Error uploading passport to Cloudinary:', uploadError);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                }
            } else if (employee?.passportDetails?.document?.url) {
                // Preserve existing Cloudinary URL
                passportCopyUrl = employee.passportDetails.document.url;
                passportCopyName = employee.passportDetails.document.name || '';
                passportCopyMime = employee.passportDetails.document.mimeType || '';
            } else if (employee?.passportDetails?.document?.data) {
                // Legacy: existing base64 data (will be migrated on save)
                passportCopyUrl = employee.passportDetails.document.data;
                passportCopyName = employee.passportDetails.document.name || '';
                passportCopyMime = employee.passportDetails.document.mimeType || '';
            }

            const payload = {
                number: formData.number.trim(),
                nationality: formData.nationality.trim(),
                issueDate: formData.issueDate,
                expiryDate: formData.expiryDate,
                placeOfIssue: formData.countryOfIssue.trim(),
                passportCopy: passportCopyUrl,
                passportCopyName: passportCopyName,
                passportCopyMime: passportCopyMime,
            };

            const response = await axiosInstance.patch(`/Employee/passport/${employeeId}`, payload);

            if (response.data?.passportDetails) {
                if (updateEmployeeOptimistically) {
                    updateEmployeeOptimistically({
                        passportDetails: response.data.passportDetails
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

            setShowPassportModal(false);
            toast({
                title: "Passport details updated",
                description: "Passport information has been saved successfully."
            });

            if (passportFileInputRef.current) {
                passportFileInputRef.current.value = '';
            }

        } catch (error) {
            console.error('Failed to save passport details', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        }
    }, [employeeId, fileToBase64, updateEmployeeOptimistically, fetchEmployee]);

    // Open modal
    const handleOpenPassportModal = useCallback(() => {
        setShowPassportModal(true);
    }, []);

    // Close modal
    const handleClosePassportModal = () => {
        setShowPassportModal(false);
    };

    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const document = employee?.passportDetails?.document;
            if (!document) return;

            if (document.url && (document.url.startsWith('http://') || document.url.startsWith('https://'))) {
                try {
                    const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                        params: { type: 'passport' }
                    });
                    if (response.data && response.data.data) {
                        setViewingDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Passport.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                        setShowDocumentViewer(true);
                    }
                } catch (error) {
                    console.error('Error fetching passport document:', error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to load document. Please try again."
                    });
                }
            } else if (document.data) {
                setViewingDocument({
                    data: document.data,
                    name: document.name || 'Passport.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
                setShowDocumentViewer(true);
            }
            return;
        }

        // Use centralized handler (like Bank Account)
        const document = employee?.passportDetails?.document;
        if (!document) {
            toast({
                variant: "default",
                title: "No passport document found",
                description: "No passport document is available."
            });
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
                    name: document.name || 'Passport.pdf',
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
                    name: document.name || 'Passport.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            }
        } else if (employeeId && document.name) {
            // If no local data but document exists (has name), fetch from server
            // Fetch from server if needed
            onViewDocument({
                data: null,
                name: document.name || 'Passport.pdf',
                mimeType: document.mimeType || 'application/pdf',
                loading: true
            });
            
            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: 'passport' }
                });
                
                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl || 
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));
                    
                    if (isCloudinaryUrl) {
                        onViewDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Passport.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }
                        
                        onViewDocument({
                            data: cleanData,
                            name: response.data.name || document.name || 'Passport.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    }
                } else {
                    onViewDocument(null);
                    toast({
                        variant: "destructive",
                        title: "Failed to load passport document",
                        description: "Unable to load the passport document. Please try again."
                    });
                }
            } catch (err) {
                console.error('Error fetching passport document:', err);
                onViewDocument(null);
                toast({
                    variant: "destructive",
                    title: "Error fetching passport document",
                    description: "Please try again."
                });
            }
        }
    }, [employee, employeeId, onViewDocument, setViewingDocument, setShowDocumentViewer]);

    // Memoize permission checks
    const canView = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_passport', 'isView'),
        [isAdmin, hasPermission]
    );

    const canEdit = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_passport', 'isEdit'),
        [isAdmin, hasPermission]
    );

    const hasPassportNumber = useMemo(() =>
        !!employee?.passportDetails?.number,
        [employee?.passportDetails?.number]
    );

    const hasDocument = useMemo(() =>
        !!(employee?.passportDetails?.document?.url || employee?.passportDetails?.document?.data || employee?.passportDetails?.document?.name),
        [employee?.passportDetails?.document]
    );

    // Memoize data rows
    const dataRows = useMemo(() => {
        if (!employee?.passportDetails) return [];

        return [
            { label: 'Number', value: employee.passportDetails.number },
            { label: 'Issue date', value: employee.passportDetails.issueDate ? formatDate(employee.passportDetails.issueDate) : null },
            { label: 'Place of issue', value: employee.passportDetails.placeOfIssue ? getCountryName(employee.passportDetails.placeOfIssue) : employee.passportDetails.placeOfIssue },
            { label: 'Expiry date', value: employee.passportDetails.expiryDate ? formatDate(employee.passportDetails.expiryDate) : null }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [employee?.passportDetails, formatDate, getCountryName]);

    // Expose openModal function via ref
    useImperativeHandle(ref, () => ({
        openModal: handleOpenPassportModal
    }));

    if (!canView) return null;

    // If no passport number, don't render card UI but still manage modal
    if (!hasPassportNumber) {
        return (
            <>
                {showPassportModal && (
                    <PassportModal
                        isOpen={true}
                        onClose={handleClosePassportModal}
                        initialData={passportInitialData}
                        onPassportSubmit={handlePassportSubmit}
                        employee={employee}
                        setViewingDocument={setViewingDocument}
                        setShowDocumentViewer={setShowDocumentViewer}
                        passportFileInputRef={passportFileInputRef}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-800">Passport</h3>
                    <div className="flex items-center gap-2">
                        {canEdit && hasPassportNumber && (
                            <button
                                onClick={handleOpenPassportModal}
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

            {/* Passport Modal */}
            {showPassportModal && (
                <PassportModal
                    isOpen={true}
                    onClose={handleClosePassportModal}
                    initialData={passportInitialData}
                    onPassportSubmit={handlePassportSubmit}
                    employee={employee}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                    passportFileInputRef={passportFileInputRef}
                />
            )}
        </>
    );
});

export default PassportCard;
