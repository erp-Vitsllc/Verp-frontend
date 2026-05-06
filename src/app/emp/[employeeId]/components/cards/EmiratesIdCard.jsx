'use client';

import { useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import EmiratesIdModal from '../modals/EmiratesIdModal';
import DeleteConfirmDialog from '../modals/DeleteConfirmDialog';

const EmiratesIdCard = forwardRef(function EmiratesIdCard({
    employee,
    employeeId,
    isAdmin,
    hasPermission,
    formatDate,
    fetchEmployee,
    updateEmployeeOptimistically,
    onViewDocument,
    onRequestNotRenew,
    viewerIsDesignatedFlowchartHr = false,
    onHrApproveNotRenew,
    onHrRejectNotRenewOpen,
    setViewingDocument,
    setShowDocumentViewer
}, ref) {
    // Modal state
    const [showEmiratesIdModal, setShowEmiratesIdModal] = useState(false);
    const [isRenewing, setIsRenewing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showNotRenewConfirm, setShowNotRenewConfirm] = useState(false);
    const [activationHoldEmiratesIdSeed, setActivationHoldEmiratesIdSeed] = useState(null);
    const emiratesIdFileRef = useRef(null);

    const normalizeIsoDateInput = useCallback((value) => {
        if (!value) return '';
        const s = String(value);
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : '';
    }, []);

    // Derived initial data
    const emiratesIdInitialData = useMemo(() => {
        if (activationHoldEmiratesIdSeed && typeof activationHoldEmiratesIdSeed === 'object') {
            return activationHoldEmiratesIdSeed;
        }
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
    }, [employee?.emiratesIdDetails, isRenewing, activationHoldEmiratesIdSeed]);

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
            const isQueuedApproval = String(response?.data?.message || '').toLowerCase().includes('queued for hr activation approval');

            // Optimistic update
            if (!isQueuedApproval && response.data?.emiratesIdDetails) {
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
                title: isQueuedApproval ? "Emirates ID queued" : "Emirates ID updated",
                description: isQueuedApproval
                    ? "Change is stored for HR activation approval. Live card will update after approval."
                    : "Emirates ID information has been saved successfully."
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
        setActivationHoldEmiratesIdSeed(null);
    }, []);

    const handleOpenForActivationHold = useCallback((proposed) => {
        const p = proposed && typeof proposed === 'object' ? proposed : {};
        const doc = p.document && typeof p.document === 'object' ? p.document : null;
        const fileBase64 =
            doc?.data && typeof doc.data === 'string' && !/^https?:\/\//i.test(doc.data)
                ? doc.data
                : '';
        setIsRenewing(false);
        setActivationHoldEmiratesIdSeed({
            number: p.number || '',
            issueDate: normalizeIsoDateInput(p.issueDate),
            expiryDate: normalizeIsoDateInput(p.expiryDate),
            fileBase64,
            fileName: doc?.name || '',
            fileMime: doc?.mimeType || '',
        });
        setShowEmiratesIdModal(true);
    }, [normalizeIsoDateInput]);

    const handleDeleteEmiratesId = useCallback(async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete Emirates ID details." });
            return;
        }
        setShowDeleteConfirm(false);
        try {
            await axiosInstance.delete(`/Employee/emirates-id/${employeeId}`);
            toast({ title: "Emirates ID deleted", description: "Emirates ID details removed successfully." });
            if (fetchEmployee) fetchEmployee(true).catch(console.error);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Delete failed",
                description: error.response?.data?.message || error.message || "Failed to delete Emirates ID details."
            });
        }
    }, [isAdmin, employeeId, fetchEmployee]);

    const handleNotRenewEmiratesId = useCallback(async () => {
        const pendingList = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        const hasPending = pendingList.some((r) => r?.status === 'pending' && r?.kind === 'emiratesId');
        if (hasPending) {
            toast({ title: 'Already pending', description: 'A not-renew request is already waiting for HR approval.' });
            setShowNotRenewConfirm(false);
            return;
        }
        setShowNotRenewConfirm(false);
        const details = employee?.emiratesIdDetails;
        if (!details?.number) {
            toast({ variant: 'destructive', title: 'Not available', description: 'Emirates ID data not found.' });
            return;
        }
        try {
            await onRequestNotRenew?.({ kind: 'emiratesId', label: 'Emirates ID' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || error.message || 'Failed to submit Emirates ID not-renew request.',
            });
        }
    }, [employee?.emiratesIdDetails, employee?.pendingNotRenewRequests, onRequestNotRenew]);

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
        openModal: handleOpenEmiratesIdModal,
        openModalForActivationHold: handleOpenForActivationHold
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

    const getPendingSectionData = useCallback((sectionName) => {
        const list = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
        const sec = String(sectionName || '').toLowerCase();
        const match = list.find(e => String(e.section || '').toLowerCase() === sec);
        return match?.proposedData || null;
    }, [employee?.pendingReactivationChanges]);

    const effectiveEmiratesIdDetails = useMemo(() => {
        return employee?.emiratesIdDetails || getPendingSectionData('emiratesid');
    }, [employee?.emiratesIdDetails, getPendingSectionData]);

    const hasNumber = useMemo(() =>
        !!effectiveEmiratesIdDetails?.number,
        [effectiveEmiratesIdDetails?.number]
    );

    const hasDocument = useMemo(() =>
        !!(employee?.emiratesIdDetails?.document?.url || employee?.emiratesIdDetails?.document?.data || employee?.emiratesIdDetails?.document?.name),
        [employee?.emiratesIdDetails?.document]
    );
    const isCardExpired = useMemo(() => {
        const expRaw = effectiveEmiratesIdDetails?.expiryDate;
        if (!expRaw) return false;
        const exp = new Date(expRaw);
        if (Number.isNaN(exp.getTime())) return false;
        exp.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return exp < today;
    }, [effectiveEmiratesIdDetails?.expiryDate]);
    const pendingNotRenewRequest = useMemo(() => {
        const pendingList = Array.isArray(employee?.pendingNotRenewRequests) ? employee.pendingNotRenewRequests : [];
        return pendingList.find((r) => r?.status === 'pending' && r?.kind === 'emiratesId') || null;
    }, [employee?.pendingNotRenewRequests]);

    // Memoize data rows to prevent recalculation
    const dataRows = useMemo(() => {
        if (!effectiveEmiratesIdDetails) return [];

        return [
            { label: 'Number', value: effectiveEmiratesIdDetails.number },
            { label: 'Issue date', value: effectiveEmiratesIdDetails.issueDate ? formatDate(effectiveEmiratesIdDetails.issueDate) : null },
            { label: 'Expiry Date', value: effectiveEmiratesIdDetails.expiryDate ? formatDate(effectiveEmiratesIdDetails.expiryDate) : null },
            { label: 'Last Updated', value: effectiveEmiratesIdDetails.lastUpdated ? formatDate(effectiveEmiratesIdDetails.lastUpdated) : null }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [effectiveEmiratesIdDetails, formatDate]);

    const isPendingApproval = useMemo(() => {
        return (employee?.pendingReactivationChanges || []).some(
            (change) => String(change?.section || '').toLowerCase() === 'emiratesid'
        );
    }, [employee?.pendingReactivationChanges]);

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
                        <h3 className="text-xl font-semibold text-gray-800">Emirates ID</h3>
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
                        {canEdit && hasNumber && (
                            <>
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
                                <button
                                    onClick={() => handleOpenEmiratesIdModal(true)}
                                    className="text-orange-600 hover:text-orange-700 transition-colors"
                                    title="Renew Emirates ID"
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
                        {isAdmin() && hasNumber && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete Emirates ID"
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
                            <p className="text-sm text-amber-700">{employee?.emiratesIdDetails?.number || '-'}</p>
                        </div>
                        {viewerIsDesignatedFlowchartHr && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onHrApproveNotRenew?.({ kind: 'emiratesId' })}
                                    className="w-9 h-9 rounded-xl border border-emerald-200 bg-white text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors flex items-center justify-center"
                                    title="Approve Not Renew"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => onHrRejectNotRenewOpen?.({ kind: 'emiratesId' })}
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
                        if (effectiveEmiratesIdDetails?.expiryDate) {
                            const exp = new Date(effectiveEmiratesIdDetails.expiryDate);
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
                            <span className={isCardExpired && /expiry/i.test(row.label) ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                                {row.value}
                            </span>
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
                    isRenew={isRenewing}
                />
            )}
            <DeleteConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Emirates ID details?"
                description="This will permanently remove the Emirates ID details for this employee."
                confirmLabel="Delete"
                onConfirm={handleDeleteEmiratesId}
            />
            <DeleteConfirmDialog
                open={showNotRenewConfirm}
                onOpenChange={setShowNotRenewConfirm}
                title="Not Renew Emirates ID?"
                description="This will move the current Emirates ID to Old Documents and remove it from Basic Details."
                confirmLabel="Not Renew"
                onConfirm={handleNotRenewEmiratesId}
            />
        </>
    );
});

export default EmiratesIdCard;
