'use client';

import { useMemo, useState } from 'react';

const CATEGORIES = {
    BASIC: 'Basic Details',
    SALARY: 'Salary',
    PERSONAL: 'Personal Information',
    TRAINING: 'Training',
    OTHER: 'Other'
};

export default function DocumentsTab({
    employee,
    isAdmin,
    hasPermission,
    onOpenDocumentModal,
    onViewDocument,
    onEditDocument,
    onDeleteDocument,
    formatDate
}) {
    const [deletingIndex, setDeletingIndex] = useState(null);

    // Helper to check if a document exists and has content
    const hasDoc = (doc) => {
        return doc && (doc.url || doc.data || doc.name);
    };

    // Helper to get document object standard format
    const getDocObj = (doc, name, typeOverride) => {
        if (!doc) return null;
        return {
            name: doc.name || name || 'Document.pdf',
            data: doc.data || doc.url,
            mimeType: doc.mimeType || (() => {
                const n = doc.name || name || 'Document.pdf';
                const ext = n.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                return 'application/pdf';
            })(),
            type: typeOverride || 'Document'
        };
    };

    // Aggregate all documents into a single list for the table
    const categorizedDocuments = useMemo(() => {
        const docs = [];

        // Helper to determine category based on type or source
        const getCategory = (type, source) => {
            const t = (type || '').toLowerCase();
            const s = (source || '').toLowerCase();

            // Training should have high priority to avoid falling into personal/other
            if (t.includes('training') || s.includes('training')) {
                return CATEGORIES.TRAINING;
            }

            if (t.includes('passport') || t.includes('visa') || t.includes('eid') || t.includes('emirates id') ||
                t.includes('labour') || t.includes('medical') || t.includes('driving') || t.includes('basic') ||
                s.includes('passport') || s.includes('visa') || s.includes('emirates id') ||
                s.includes('labour') || s.includes('medical') || s.includes('driving') || s.includes('basic')) {
                return CATEGORIES.BASIC;
            }

            if (t.includes('offer') || t.includes('bank') || t.includes('salary') || t.includes('contract') || t.includes('agreement') ||
                t.includes('payslip') || t.includes('increment') || t.includes('bonus') || t.includes('payment') ||
                s.includes('salary') || s.includes('bank') || s.includes('offer')) {
                return CATEGORIES.SALARY;
            }

            if (t.includes('education') || t.includes('experience') || t.includes('certificate') || t.includes('personal') ||
                s.includes('education') || s.includes('experience') || s.includes('personal')) {
                return CATEGORIES.PERSONAL;
            }

            return CATEGORIES.OTHER;
        };

        // 1. Manual Documents (from employee.documents array)
        if (employee?.documents && Array.isArray(employee.documents)) {
            employee.documents.forEach((doc, index) => {
                let expiryDate = doc.expiryDate;

                // Try to extract expiry date from description if not explicitly set (for archived passports)
                if (!expiryDate && doc.description && doc.description.includes('Expired on')) {
                    try {
                        const parts = doc.description.split('Expired on');
                        if (parts.length > 1) {
                            const dateStr = parts[1].trim();
                            if (!isNaN(new Date(dateStr).getTime())) {
                                expiryDate = dateStr;
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }

                docs.push({
                    id: `manual-${index}`,
                    index: index,
                    type: doc.type || 'Document',
                    expiryDate: expiryDate,
                    document: doc.document,
                    isSystem: false,
                    source: 'Manual',
                    category: getCategory(doc.type, 'Manual')
                });
            });
        }

        // 2. System Documents (Passport)
        if (hasDoc(employee?.passportDetails?.document)) {
            docs.push({
                id: 'sys-passport',
                type: 'Passport',
                expiryDate: employee.passportDetails.expiryDate,
                document: employee.passportDetails.document,
                isSystem: true,
                source: 'Passport Details',
                category: CATEGORIES.BASIC
            });
        }

        // 3. System Documents (Visas)
        if (employee?.visaDetails) {
            ['visit', 'employment', 'spouse'].forEach(type => {
                const visa = employee.visaDetails[type];
                if (hasDoc(visa?.document)) {
                    docs.push({
                        id: `sys-visa-${type}`,
                        type: `${type.charAt(0).toUpperCase() + type.slice(1)} Visa`,
                        expiryDate: visa.expiryDate,
                        document: visa.document,
                        isSystem: true,
                        source: 'Visa Details',
                        category: CATEGORIES.BASIC
                    });
                }
            });
        }

        // 4. Emirates ID
        if (hasDoc(employee?.emiratesIdDetails?.document)) {
            docs.push({
                id: 'sys-eid',
                type: 'Emirates ID',
                expiryDate: employee.emiratesIdDetails.expiryDate,
                document: employee.emiratesIdDetails.document,
                isSystem: true,
                source: 'Emirates ID',
                category: CATEGORIES.BASIC
            });
        }

        // 5. Labour Card
        if (hasDoc(employee?.labourCardDetails?.document)) {
            docs.push({
                id: 'sys-labour',
                type: 'Labour Card',
                expiryDate: employee.labourCardDetails.expiryDate,
                document: employee.labourCardDetails.document,
                isSystem: true,
                source: 'Labour Card',
                category: CATEGORIES.BASIC
            });
        }

        // 6. Medical Insurance
        if (hasDoc(employee?.medicalInsuranceDetails?.document)) {
            docs.push({
                id: 'sys-medical',
                type: 'Medical Insurance',
                expiryDate: employee.medicalInsuranceDetails.expiryDate,
                document: employee.medicalInsuranceDetails.document,
                isSystem: true,
                source: 'Medical Insurance',
                category: CATEGORIES.BASIC
            });
        }

        // 7. Driving License
        if (hasDoc(employee?.drivingLicenceDetails?.document)) {
            docs.push({
                id: 'sys-driving',
                type: 'Driving License',
                expiryDate: employee.drivingLicenceDetails.expiryDate,
                document: employee.drivingLicenceDetails.document,
                isSystem: true,
                source: 'Driving License',
                category: CATEGORIES.BASIC
            });
        }

        // 8. Offer Letter (Latest from History or Main)
        let latestOfferLetter = employee?.offerLetter;
        if (employee?.salaryHistory && Array.isArray(employee.salaryHistory)) {
            // Find the most recent entry that has an offer letter
            const entryWithOffer = [...employee.salaryHistory].find(entry => hasDoc(entry.offerLetter));
            if (entryWithOffer) {
                latestOfferLetter = entryWithOffer.offerLetter;
            }
        }

        if (hasDoc(latestOfferLetter)) {
            docs.push({
                id: 'sys-offer-letter',
                type: 'Salary Letter',
                expiryDate: null,
                document: latestOfferLetter,
                isSystem: true,
                source: 'Salary Details',
                category: CATEGORIES.SALARY
            });
        }

        // 9. Bank Account Attachment
        if (hasDoc(employee?.bankAttachment)) {
            docs.push({
                id: 'sys-bank',
                type: 'Bank Detail Attachment',
                expiryDate: null,
                document: employee.bankAttachment,
                isSystem: true,
                source: 'Bank Details',
                category: CATEGORIES.SALARY
            });
        }


        // 11. Education Certificates
        if (employee?.educationDetails && Array.isArray(employee.educationDetails)) {
            employee.educationDetails.forEach((edu, index) => {
                if (hasDoc(edu.certificate)) {
                    docs.push({
                        id: `sys-edu-${index}`,
                        type: `Education - ${edu.degree || edu.universityOrBoard || 'Certificate'}`,
                        expiryDate: edu.completedYear, // Use completed year as End Date
                        document: edu.certificate,
                        isSystem: true,
                        source: 'Education',
                        category: CATEGORIES.PERSONAL
                    });
                }
            });
        }

        // 12. Experience Certificates
        if (employee?.experienceDetails && Array.isArray(employee.experienceDetails)) {
            employee.experienceDetails.forEach((exp, index) => {
                if (hasDoc(exp.certificate)) {
                    docs.push({
                        id: `sys-exp-${index}`,
                        type: `Experience - ${exp.company || 'Certificate'}`,
                        expiryDate: exp.endDate, // Use end date as End Date
                        document: exp.certificate,
                        isSystem: true,
                        source: 'Experience',
                        category: CATEGORIES.PERSONAL
                    });
                }
            });
        }

        // 13. Training Certificates
        if (employee?.trainingDetails && Array.isArray(employee.trainingDetails)) {
            employee.trainingDetails.forEach((train, index) => {
                if (hasDoc(train.certificate)) {
                    docs.push({
                        id: `sys-train-${index}`,
                        type: `Training - ${train.trainingName || 'Certificate'}`,
                        expiryDate: null,
                        document: train.certificate,
                        isSystem: true,
                        source: 'Training',
                        category: CATEGORIES.TRAINING
                    });
                }
            });
        }

        // 14. Salary Attachment (Latest from History or Main)
        let latestSalaryAttachment = employee?.salaryAttachment || employee?.attachment;
        if (employee?.salaryHistory && Array.isArray(employee.salaryHistory)) {
            // Find the most recent entry that has an attachment
            const entryWithAttach = [...employee.salaryHistory].find(entry => hasDoc(entry.attachment));
            if (entryWithAttach) {
                latestSalaryAttachment = entryWithAttach.attachment;
            }
        }

        if (hasDoc(latestSalaryAttachment)) {
            docs.push({
                id: 'sys-salary-attachment',
                type: 'Salary Attachment',
                expiryDate: null,
                document: latestSalaryAttachment,
                isSystem: true,
                source: 'Salary Details',
                category: CATEGORIES.SALARY
            });
        }

        // Group by category and sort latest first
        const grouped = {};
        Object.values(CATEGORIES).forEach(cat => {
            grouped[cat] = docs
                .filter(d => d.category === cat)
                .sort((a, b) => {
                    const dateA = a.expiryDate ? new Date(a.expiryDate) : new Date(0);
                    const dateB = b.expiryDate ? new Date(b.expiryDate) : new Date(0);
                    // If no expiry, maybe sort by ID or just keep order? 
                    // Manual documents have IDs like manual-0, manual-1. 
                    // Let's stick to date desc (latest first)
                    return dateB - dateA;
                });
        });

        // Filter out empty categories
        return Object.entries(grouped).filter(([_, items]) => items.length > 0);
    }, [employee]);

    const handleDelete = async (index) => {
        setDeletingIndex(index);
        await onDeleteDocument(index);
        setDeletingIndex(null);
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Documents</h3>
                    {(isAdmin() || hasPermission('hrm_employees_view_documents', 'isCreate')) && (
                        <button
                            onClick={onOpenDocumentModal}
                            className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                        >
                            Add Document
                            <span className="text-lg leading-none">+</span>
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto w-full max-w-full">
                    {categorizedDocuments.length > 0 ? (
                        categorizedDocuments.map(([category, docs]) => (
                            <div key={category} className="mb-8 last:mb-0">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-4">
                                    {category}
                                </h4>
                                <table className="w-full min-w-0 table-auto border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <th className="py-2 px-4">File Type</th>
                                            <th className="py-2 px-4">End Date</th>
                                            <th className="py-2 px-4">Document</th>
                                            <th className="py-2 px-4 w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {docs.map((doc) => (
                                            <tr key={doc.id} className="bg-white hover:bg-gray-50 transition-colors shadow-sm ring-1 ring-gray-100 rounded-lg group">
                                                <td className="py-3 px-4 text-sm text-gray-700 font-medium">
                                                    {doc.type}
                                                    {doc.isSystem && (
                                                        <span className="ml-2 px-2 py-0.5 text-[10px] bg-blue-50 text-blue-500 rounded-full font-bold uppercase tracking-tighter">
                                                            System
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {doc.expiryDate ? (formatDate ? formatDate(doc.expiryDate) : doc.expiryDate.substring(0, 10)) : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    <button
                                                        onClick={() => onViewDocument(getDocObj(doc.document, doc.type))}
                                                        className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                        title="View Document"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    {!doc.isSystem && (isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit')) ? (
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => onEditDocument(doc.index)}
                                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                title="Edit"
                                                                disabled={deletingIndex === doc.index}
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(doc.index)}
                                                                className={`p-1 text-red-600 hover:bg-red-50 rounded ${doc.type && doc.type.toLowerCase().includes('expired') ? 'hidden' : ''}`}
                                                                title="Delete"
                                                                disabled={deletingIndex === doc.index}
                                                                style={{ display: doc.type && doc.type.toLowerCase().includes('expired') ? 'none' : 'block' }}
                                                            >
                                                                {deletingIndex === doc.index ? (
                                                                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                ) : (
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center">
                            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                    <polyline points="13 2 13 9 20 9"></polyline>
                                </svg>
                            </div>
                            <h3 className="text-gray-900 font-medium mb-1">No documents found</h3>
                            <p className="text-gray-500 text-sm">Add documents to see them categorized here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
