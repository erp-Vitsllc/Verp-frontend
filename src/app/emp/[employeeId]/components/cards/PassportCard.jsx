'use client';

import { useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import PassportModal from '../modals/PassportModal';
import DeleteConfirmDialog from '../modals/DeleteConfirmDialog';

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
    const [isRenewing, setIsRenewing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showNotRenewConfirm, setShowNotRenewConfirm] = useState(false);
    const passportFileInputRef = useRef(null);
    const [activationHoldPassportSeed, setActivationHoldPassportSeed] = useState(null);

    const passportBaseModalData = useMemo(() => {
        if (isRenewing) return null;
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
    }, [employee, getCountryName, isRenewing]);

    const passportModalInitialData = useMemo(() => {
        const seed =
            activationHoldPassportSeed && typeof activationHoldPassportSeed === 'object'
                ? activationHoldPassportSeed
                : null;
        if (seed) {
            return { ...(passportBaseModalData || {}), ...seed };
        }
        return passportBaseModalData;
    }, [passportBaseModalData, activationHoldPassportSeed]);


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

            // Upload passport document to Storage FIRST (if new file provided)
            if (formData.file) {
                passportCopyName = formData.file.name;
                passportCopyMime = formData.file.type || 'application/pdf';

                try {
                    const base64Data = await fileToBase64(formData.file);
                    const fullBase64 = `data:${passportCopyMime};base64,${base64Data}`;

                    // Upload to Storage
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
                    console.error('Error uploading passport to Storage:', uploadError);
                    toast({
                        variant: "destructive",
                        title: "Upload failed",
                        description: uploadError.response?.data?.message || uploadError.message || "Failed to upload document. Please try again."
                    });
                    return;
                }
            } else if (employee?.passportDetails?.document?.url) {
                // Preserve existing Storage URL
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
                isRenewal: formData.isRenewal,
            };

            const response = await axiosInstance.patch(`/Employee/passport/${employeeId}`, payload);
            const isQueuedApproval = String(response?.data?.message || '').toLowerCase().includes('queued for hr activation approval');

            const nextPassportDetails =
                !isQueuedApproval && response.data?.passportDetails
                    ? response.data.passportDetails
                    : {
                        number: payload.number,
                        nationality: payload.nationality,
                        issueDate: payload.issueDate,
                        expiryDate: payload.expiryDate,
                        placeOfIssue: payload.placeOfIssue,
                        document: payload.passportCopy
                            ? {
                                url: payload.passportCopy,
                                name: payload.passportCopyName || '',
                                mimeType: payload.passportCopyMime || '',
                            }
                            : (employee?.passportDetails?.document || null),
                        lastUpdated: new Date().toISOString(),
                    };

            // Ensure card reflects immediately after save (even if queued for approval)
            if (updateEmployeeOptimistically) {
                updateEmployeeOptimistically({ passportDetails: nextPassportDetails });
            }

            // If renewal, force fetch to get updated documents list (oldDocuments changes etc.)
            if (formData.isRenewal && fetchEmployee) {
                fetchEmployee(true).catch(err => {
                    console.error('Error refreshing employee data:', err);
                });
            } else if (!updateEmployeeOptimistically && fetchEmployee) {
                fetchEmployee(true).catch(err => {
                    console.error('Error refreshing employee data:', err);
                });
            }

            setActivationHoldPassportSeed(null);
            setShowPassportModal(false);
            toast({
                title: isQueuedApproval ? "Passport queued" : "Passport details updated",
                description: isQueuedApproval
                    ? "Change is stored for HR activation approval. Live card will update after approval."
                    : "Passport information has been saved successfully."
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

    const normalizeIsoDateInput = useCallback((v) => {
        if (!v) return '';
        const s = String(v);
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : '';
    }, []);

    const proposedToActivationHoldSeed = useCallback(
        (proposed) => {
            if (!proposed || typeof proposed !== 'object') return {};
            const p = proposed.passportDetails && typeof proposed.passportDetails === 'object' ? proposed.passportDetails : proposed;
            const natCode = String(p.nationality || '').trim();
            const placeCode = String(p.placeOfIssue || '').trim();
            const nationality =
                natCode.length === 2
                    ? getCountryName(natCode.toUpperCase()) || natCode
                    : natCode || '';
            const countryOfIssue =
                placeCode.length === 2
                    ? getCountryName(placeCode.toUpperCase()) || placeCode
                    : placeCode || '';

            const doc = p.document && typeof p.document === 'object' ? p.document : null;
            const fileBase64 = doc?.data && typeof doc.data === 'string' && !/^https?:\/\//i.test(doc.data) ? doc.data : '';
            const next = {};
            if (p.number != null && String(p.number).trim()) next.number = String(p.number).trim();
            if (nationality) next.nationality = nationality;
            if (p.issueDate) next.issueDate = normalizeIsoDateInput(p.issueDate);
            if (p.expiryDate) next.expiryDate = normalizeIsoDateInput(p.expiryDate);
            if (countryOfIssue) next.countryOfIssue = countryOfIssue;
            if (fileBase64) next.fileBase64 = fileBase64;
            if (doc?.name) next.fileName = doc.name;
            if (doc?.mimeType) next.fileMime = doc.mimeType;
            return next;
        },
        [getCountryName, normalizeIsoDateInput],
    );

    // Open modal
    const handleOpenPassportModal = useCallback((isRenew = false) => {
        setActivationHoldPassportSeed(null);
        setIsRenewing(!!isRenew);
        setShowPassportModal(true);
    }, []);

    // Close modal
    const handleClosePassportModal = () => {
        setActivationHoldPassportSeed(null);
        setShowPassportModal(false);
    };

    const handleDeletePassport = useCallback(async () => {
        if (!isAdmin()) {
            toast({ variant: "destructive", title: "Access denied", description: "Only administrator can delete passport details." });
            return;
        }
        setShowDeleteConfirm(false);
        try {
            await axiosInstance.delete(`/Employee/passport/${employeeId}`);
            toast({ title: "Passport deleted", description: "Passport details removed successfully." });
            if (fetchEmployee) fetchEmployee(true).catch(console.error);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Delete failed",
                description: error.response?.data?.message || error.message || "Failed to delete passport details."
            });
        }
    }, [isAdmin, employeeId, fetchEmployee]);

    // Open document viewer handler - use centralized onViewDocument
    const handleViewDocument = useCallback(async () => {
        if (!onViewDocument) {
            // Fallback to old method if onViewDocument not provided
            const document = employee?.passportDetails?.document;
            console.log('Passport - handleViewDocument (local fallback):', document);
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
                            mimeType: response.data.mimeType || document.mimeType || (() => {
                                const n = response.data.name || document.name || 'Passport.pdf';
                                const ext = n.split('.').pop().toLowerCase();
                                if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                                return 'application/pdf';
                            })()
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
                    mimeType: document.mimeType || (() => {
                        const n = document.name || 'Passport.pdf';
                        const ext = n.split('.').pop().toLowerCase();
                        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                        return 'application/pdf';
                    })()
                });
                setShowDocumentViewer(true);
            }
            return;
        }

        // Use centralized handler (like Bank Account)
        const document = employee?.passportDetails?.document;
        console.log('Passport - handleViewDocument (centralized):', document);
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
                    mimeType: document.mimeType || (() => {
                        const n = document.name || 'Passport.pdf';
                        const ext = n.split('.').pop().toLowerCase();
                        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                        return 'application/pdf';
                    })()
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

    const handleNotRenewPassport = useCallback(async () => {
        if (!employeeId) return;
        const details = employee?.passportDetails;
        if (!details?.number) {
            toast({ variant: 'destructive', title: 'Not available', description: 'Passport data not found.' });
            return;
        }
        try {
            const oldDocs = Array.isArray(employee?.oldDocuments) ? employee.oldDocuments : [];
            const historyDoc = {
                type: 'Previous Passport',
                description: `Not Renewed - ${details.number || ''}`,
                issueDate: details.issueDate || details.lastUpdated || '',
                expiryDate: details.expiryDate || '',
                document: details.document || null,
                archiveReason: 'Not Renewed',
                archivedAt: new Date().toISOString(),
            };
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                oldDocuments: [historyDoc, ...oldDocs],
            });
            await axiosInstance.delete(`/Employee/passport/${employeeId}`);
            toast({ title: 'Updated', description: 'Passport moved to Old Documents (Not Renewed).' });
            fetchEmployee(true).catch(() => { });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || error.message || 'Failed to mark passport as Not Renew.',
            });
        }
    }, [employeeId, employee?.passportDetails, employee?.oldDocuments, fetchEmployee]);

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
        openModal: handleOpenPassportModal,
        openModalForActivationHold: (proposed) => {
            setIsRenewing(false);
            setActivationHoldPassportSeed(proposedToActivationHoldSeed(proposed));
            setShowPassportModal(true);
        },
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
                        initialData={passportModalInitialData}
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
                            <>
                                <button
                                    onClick={() => handleOpenPassportModal(false)}
                                    className="text-blue-600 hover:text-blue-700 transition-colors"
                                    title="Edit"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleOpenPassportModal(true)}
                                    className="text-orange-600 hover:text-orange-700 transition-colors"
                                    title="Renew Passport"
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
                        {isAdmin() && hasPassportNumber && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete Passport"
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
                <div>
                    {/* Expiry Warning */}
                    {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (employee?.passportDetails?.expiryDate) {
                            const exp = new Date(employee.passportDetails.expiryDate);
                            if (exp < today) {
                                return (
                                    <div className="mx-6 mb-4 mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
                                        <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <h4 className="font-semibold text-sm">Passport Expired</h4>
                                            <p className="text-sm mt-1 opacity-90">
                                                This passport expired on {exp.toISOString().split('T')[0]}. Please upload renewed passport details.
                                            </p>
                                            <button
                                                onClick={() => handleOpenPassportModal(true)}
                                                className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Renew Passport
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

            {/* Passport Modal */}
            {showPassportModal && (
                <PassportModal
                    isOpen={true}
                    onClose={handleClosePassportModal}
                    initialData={passportModalInitialData}
                    onPassportSubmit={handlePassportSubmit}
                    employee={employee}
                    setViewingDocument={setViewingDocument}
                    setShowDocumentViewer={setShowDocumentViewer}
                    passportFileInputRef={passportFileInputRef}
                    isRenew={isRenewing}
                />
            )}

            <DeleteConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Passport details?"
                description="This will permanently remove the passport details for this employee."
                confirmLabel="Delete"
                onConfirm={handleDeletePassport}
            />
            <DeleteConfirmDialog
                open={showNotRenewConfirm}
                onOpenChange={setShowNotRenewConfirm}
                title="Not Renew Passport?"
                description="This will move the current passport to Old Documents and remove it from Basic Details."
                confirmLabel="Not Renew"
                onConfirm={handleNotRenewPassport}
            />
        </>
    );
});

export default PassportCard;
