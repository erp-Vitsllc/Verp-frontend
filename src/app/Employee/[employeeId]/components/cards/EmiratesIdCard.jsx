'use client';

import { useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import EmiratesIdModal from '../modals/EmiratesIdModal';

const EmiratesIdCard = forwardRef(function EmiratesIdCard({
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
    const [showEmiratesIdModal, setShowEmiratesIdModal] = useState(false);
    const [isRenewing, setIsRenewing] = useState(false);
    const emiratesIdFileRef = useRef(null);

    // Derived initial data
    const emiratesIdInitialData = useMemo(() => {
        if (isRenewing) return null;
        if (!employee?.emiratesIdDetails) return null;
        return {
            number: employee.emiratesIdDetails.number || '',
            issueDate: employee.emiratesIdDetails.issueDate ? employee.emiratesIdDetails.issueDate.substring(0, 10) : '',
            expiryDate: employee.emiratesIdDetails.expiryDate ? employee.emiratesIdDetails.expiryDate.substring(0, 10) : '',
            fileBase64: employee.emiratesIdDetails.document?.data || '',
            fileName: employee.emiratesIdDetails.document?.name || '',
            fileMime: employee.emiratesIdDetails.document?.mimeType || ''
        };
    }, [employee?.emiratesIdDetails, isRenewing]);

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


    // Save Emirates ID
    const handleSaveEmiratesId = useCallback(async (formData) => {
        try {
            let upload = formData.fileBase64 || '';
            let uploadName = formData.fileName || '';
            let uploadMime = formData.fileMime || '';

            if (formData.file) {
                // New file selected
                upload = await fileToBase64(formData.file);
                uploadName = formData.file.name;
                uploadMime = formData.file.type;
            } else if (!upload && employee?.emiratesIdDetails?.document?.data) {
                // No new file, but existing document in DB - use existing document
                upload = employee.emiratesIdDetails.document.data;
                uploadName = employee.emiratesIdDetails.document.name || '';
                uploadMime = employee.emiratesIdDetails.document.mimeType || '';
            }

            const response = await axiosInstance.patch(`/Employee/emirates-id/${employeeId}`, {
                number: formData.number.trim(),
                issueDate: formData.issueDate,
                expiryDate: formData.expiryDate,
                upload,
                uploadName,
                uploadMime
            });

            // Optimistic update
            if (response.data?.emiratesIdDetails) {
                if (updateEmployeeOptimistically) {
                    updateEmployeeOptimistically({
                        emiratesIdDetails: response.data.emiratesIdDetails
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

            setShowEmiratesIdModal(false);
            if (emiratesIdFileRef.current) emiratesIdFileRef.current.value = '';

            toast({
                title: "Emirates ID updated",
                description: "Emirates ID information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Emirates ID', error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        }
    }, [employeeId, fileToBase64, updateEmployeeOptimistically, fetchEmployee]);

    // Open modal
    const handleOpenEmiratesIdModal = useCallback((isRenew = false) => {
        setIsRenewing(!!isRenew);
        setShowEmiratesIdModal(true);
    }, []);

    // Close modal
    const handleCloseEmiratesIdModal = useCallback(() => {
        setShowEmiratesIdModal(false);
    }, []);

    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const document = employee?.emiratesIdDetails?.document;
            if (!document) return;

            if (document.url && (document.url.startsWith('http://') || document.url.startsWith('https://'))) {
                try {
                    const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                        params: { type: 'emiratesId' }
                    });
                    if (response.data && response.data.data) {
                        setViewingDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Emirates_ID.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                        setShowDocumentViewer(true);
                    }
                } catch (error) {
                    console.error('Error fetching Emirates ID document:', error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to load document. Please try again."
                    });
                }
            } else if (document.data) {
                setViewingDocument({
                    data: document.data,
                    name: document.name || 'Emirates_ID.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
                setShowDocumentViewer(true);
            }
            return;
        }

        // Use centralized handler (like Bank Account)
        const document = employee?.emiratesIdDetails?.document;
        if (!document) {
            alert('No Emirates ID document found');
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
                    name: document.name || 'Emirates_ID.pdf',
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
                    name: document.name || 'Emirates_ID.pdf',
                    mimeType: document.mimeType || 'application/pdf'
                });
            }
        } else if (employeeId && document.name) {
            // If no local data but document exists (has name), fetch from server
            onViewDocument({
                data: null,
                name: document.name || 'Emirates_ID.pdf',
                mimeType: document.mimeType || 'application/pdf',
                loading: true
            });

            try {
                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                    params: { type: 'emiratesId' }
                });

                if (response.data && response.data.data) {
                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                    if (isCloudinaryUrl) {
                        onViewDocument({
                            data: response.data.data,
                            name: response.data.name || document.name || 'Emirates_ID.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    } else {
                        let cleanData = response.data.data;
                        if (cleanData.includes(',')) {
                            cleanData = cleanData.split(',')[1];
                        }

                        onViewDocument({
                            data: cleanData,
                            name: response.data.name || document.name || 'Emirates_ID.pdf',
                            mimeType: response.data.mimeType || document.mimeType || 'application/pdf'
                        });
                    }
                } else {
                    onViewDocument(null);
                    alert('Failed to load Emirates ID document');
                }
            } catch (err) {
                console.error('Error fetching Emirates ID document:', err);
                onViewDocument(null);
                alert('Error fetching Emirates ID document. Please try again.');
            }
        } else {
            // No document data available at all
            alert('Emirates ID document data not available');
        }
    }, [employee, employeeId, onViewDocument, setViewingDocument, setShowDocumentViewer]);

    // Expose openModal function via ref
    useImperativeHandle(ref, () => ({
        openModal: handleOpenEmiratesIdModal
    }));

    // Memoize permission checks and data existence
    const canView = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_emirates_id', 'isView'),
        [isAdmin, hasPermission]
    );

    const canEdit = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_emirates_id', 'isEdit'),
        [isAdmin, hasPermission]
    );

    const hasNumber = useMemo(() =>
        !!employee?.emiratesIdDetails?.number,
        [employee?.emiratesIdDetails?.number]
    );

    const hasDocument = useMemo(() =>
        !!(employee?.emiratesIdDetails?.document?.url || employee?.emiratesIdDetails?.document?.data || employee?.emiratesIdDetails?.document?.name),
        [employee?.emiratesIdDetails?.document]
    );

    // Memoize data rows to prevent recalculation
    const dataRows = useMemo(() => {
        if (!employee?.emiratesIdDetails) return [];

        return [
            { label: 'Number', value: employee.emiratesIdDetails.number },
            { label: 'Issue date', value: employee.emiratesIdDetails.issueDate ? formatDate(employee.emiratesIdDetails.issueDate) : null },
            { label: 'Expiry Date', value: employee.emiratesIdDetails.expiryDate ? formatDate(employee.emiratesIdDetails.expiryDate) : null },
            { label: 'Last Updated', value: employee.emiratesIdDetails.lastUpdated ? formatDate(employee.emiratesIdDetails.lastUpdated) : null }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [employee?.emiratesIdDetails, formatDate]);

    // Show only if user has view permission
    if (!canView) {
        return null;
    }

    // If no Emirates ID number, don't render card UI but still manage modal
    if (!hasNumber) {
        return (
            <>
                {/* Hidden - just manages modal state for add button */}
                {showEmiratesIdModal && (
                    <EmiratesIdModal
                        isOpen={true}
                        onClose={handleCloseEmiratesIdModal}
                        initialData={emiratesIdInitialData}
                        onSaveEmiratesId={handleSaveEmiratesId}
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
                    <h3 className="text-xl font-semibold text-gray-800">Emirates ID</h3>
                    <div className="flex items-center gap-2">
                        {canEdit && hasNumber && (
                            <button
                                onClick={() => handleOpenEmiratesIdModal(false)}
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
                        if (employee?.emiratesIdDetails?.expiryDate) {
                            const exp = new Date(employee.emiratesIdDetails.expiryDate);
                            if (exp < today) {
                                return (
                                    <div className="mx-6 mb-4 mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                                        <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <h4 className="font-semibold text-sm">Emirates ID Expired</h4>
                                            <p className="text-sm mt-1 opacity-90">
                                                This Emirates ID expired on {exp.toISOString().split('T')[0]}. Please upload renewed Emirates ID details.
                                            </p>
                                            <button
                                                onClick={() => handleOpenEmiratesIdModal(true)}
                                                className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Renew Emirates ID
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

            {/* Emirates ID Modal */}
            {showEmiratesIdModal && (
                <EmiratesIdModal
                    isOpen={true}
                    onClose={handleCloseEmiratesIdModal}
                    initialData={emiratesIdInitialData}
                    onSaveEmiratesId={handleSaveEmiratesId}
                    employee={employee}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                />
            )}
        </>
    );
});

export default EmiratesIdCard;
