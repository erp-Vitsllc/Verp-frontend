'use client';

import React, { useMemo, useState } from 'react';
import { FileText, Download, Edit2, RotateCcw, Trash2, Plus, Upload, Ban } from 'lucide-react';

const SECTIONS = {
    BASIC: 'Basic Details',
    BANK: 'Bank Details',
    PERSONAL: 'Education Certificate',
    EXPERIENCE: 'Experience',
    SALARY: 'Salary',
    LABOUR: 'Labour Card',
    DOC_EXPIRY: 'Document Expiry',
    DOC_NO_EXPIRY: 'Document Without Expiry',
    OTHER: 'Other Documents'
};

const formatDate = (date) => {
    if (!date) return '—';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return '—'; }
};

const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    try {
        const exp = new Date(expiryDate);
        exp.setHours(23, 59, 59, 999);
        return exp < new Date();
    } catch (e) { return false; }
};

/** Normalize cost from API / form (number, string, or legacy keys). */
const normalizeStoredCost = (doc) => {
    if (!doc || typeof doc !== 'object') return null;
    const raw = doc.cost ?? doc.Cost ?? doc.value;
    if (raw === null || raw === undefined || raw === '') return null;
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
};

const formatDocumentCost = (cost) => {
    if (cost === null || cost === undefined || cost === '') return '-';
    const n = typeof cost === 'number' ? cost : Number(String(cost).replace(/,/g, ''));
    if (!Number.isFinite(n)) return '-';
    return `${n.toLocaleString()} AED`;
};

const isLabourCardSalaryType = (type) => {
    const t = String(type || '').toLowerCase().trim();
    return t === 'labour card salary' || t.includes('labour card salary');
};

const isBasicIdentityDocType = (type) => {
    const t = String(type || '').toLowerCase();
    return t.includes('passport') || t.includes('visa') || t.includes('emirates') || t.includes('ejari');
};

export default function DocumentsTab({
    employee,
    isAdmin,
    hasPermission,
    onOpenDocumentModal,
    onRenewDocument,
    onNotRenewDocument,
    onOpenLabourCardModal,
    onOpenLabourRow,
    onViewDocument,
    onEditDocument,
    onDeleteDocument,
    formatDate: formatDateProp
}) {
    const ROWS_PER_SECTION = 10;
    const [docStatusTab, setDocStatusTab] = useState('live'); // 'live' | 'old'
    const [deletingIndex, setDeletingIndex] = useState(null);
    const [sectionPages, setSectionPages] = useState({});
    const [sectionExpanded, setSectionExpanded] = useState({});

    const safeFormatDate = (date) => {
        if (formatDateProp) return formatDateProp(date);
        return formatDate(date);
    };

    const docRowId = (doc) => String(doc?._id || doc?.id || '').trim();
    const shortId = (id) => {
        const s = String(id || '').trim();
        if (!s) return '';
        if (s.length <= 10) return s;
        return `${s.slice(0, 6)}…${s.slice(-4)}`;
    };

    const hasDoc = (doc) => {
        if (!doc) return false;
        if (typeof doc === 'string') return doc.startsWith('http') || doc.length > 20;
        return !!(doc.url || doc.data || doc.name || doc.publicId);
    };

    const getDocObj = (doc, name, typeOverride) => {
        if (!doc) return null;
        if (typeof doc === 'string') {
            const fileName = name || 'Document.pdf';
            const ext = fileName.split('.').pop().toLowerCase();
            let mime = 'application/pdf';
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            return { name: fileName, data: doc, url: doc, mimeType: mime, type: typeOverride || 'Document' };
        }
        return {
            name: doc.name || name || 'Document.pdf',
            data: doc.data || doc.url,
            url: doc.url || doc.data,
            mimeType: doc.mimeType || 'application/pdf',
            type: typeOverride || 'Document'
        };
    };

    // Build flat document list with section and expiry info
    const allDocs = useMemo(() => {
        if (!employee) return [];
        const docs = [];
        const salaryHistory = Array.isArray(employee.salaryHistory) ? employee.salaryHistory : [];
        const latestSalaryEntry = salaryHistory.length > 0 ? salaryHistory[0] : null;

        const add = (doc, section) => {
            if (!doc) return;
            const exp = doc.expiryDate;
            const expired = isExpired(exp);
            docs.push({
                ...doc,
                section,
                expired,
                issueDate: doc.issueDate || doc.startDate,
                cost: normalizeStoredCost(doc)
            });
        };

        // Basic Details
        if (hasDoc(employee.passportDetails?.document)) add({ type: 'Passport', description: employee.passportDetails?.number, expiryDate: employee.passportDetails?.expiryDate, issueDate: employee.passportDetails?.issueDate, document: employee.passportDetails.document, isSystem: true, deleteTarget: { kind: 'passport' } }, SECTIONS.BASIC);
        if (employee.visaDetails) {
            ['visit', 'employment', 'spouse'].forEach(t => {
                const v = employee.visaDetails[t];
                if (hasDoc(v?.document)) add({ type: `${t.charAt(0).toUpperCase() + t.slice(1)} Visa`, description: v?.number, expiryDate: v?.expiryDate, issueDate: v?.issueDate, document: v.document, isSystem: true, deleteTarget: { kind: 'visa', visaType: t } }, SECTIONS.BASIC);
            });
        }
        if (hasDoc(employee.emiratesIdDetails?.document)) add({ type: 'Emirates ID', description: employee.emiratesIdDetails?.number, expiryDate: employee.emiratesIdDetails?.expiryDate, issueDate: employee.emiratesIdDetails?.issueDate, document: employee.emiratesIdDetails.document, isSystem: true, deleteTarget: { kind: 'emirates' } }, SECTIONS.BASIC);
        if (hasDoc(employee.medicalInsuranceDetails?.document)) add({ type: 'Medical Insurance', description: employee.medicalInsuranceDetails?.provider, expiryDate: employee.medicalInsuranceDetails?.expiryDate, issueDate: employee.medicalInsuranceDetails?.issueDate, document: employee.medicalInsuranceDetails.document, isSystem: true, deleteTarget: { kind: 'medicalInsurance' } }, SECTIONS.BASIC);
        if (hasDoc(employee.drivingLicenceDetails?.document)) add({ type: 'Driving License', description: employee.drivingLicenceDetails?.number, expiryDate: employee.drivingLicenceDetails?.expiryDate, issueDate: employee.drivingLicenceDetails?.issueDate, document: employee.drivingLicenceDetails.document, isSystem: true, deleteTarget: { kind: 'drivingLicense' } }, SECTIONS.BASIC);

        // Personal Information
        (employee.educationDetails || []).forEach((edu, i) => {
            add({
                type: 'Education Certificate',
                description: `${edu.universityOrBoard || edu.collegeOrInstitute || 'University'} • ${edu.course || 'Course'} • ${edu.completedYear || ''}`,
                issueDate: edu.completedYear ? `${edu.completedYear}-01-01` : '',
                university: edu.universityOrBoard || edu.collegeOrInstitute || '',
                course: edu.course || '',
                year: edu.completedYear || '',
                document: edu.certificate || null,
                isSystem: true,
                deleteTarget: edu?._id || edu?.id ? { kind: 'education', educationId: edu?._id || edu?.id } : null
            }, SECTIONS.PERSONAL);
        });
        (employee.experienceDetails || []).forEach((exp, i) => {
            add({
                type: 'Experience',
                description: `${exp.company || ''} • ${exp.designation || ''}`.trim(),
                issueDate: exp.startDate,
                expiryDate: exp.endDate,
                experienceType: exp.company || exp.type || '',
                designation: exp.designation || exp.destination || '',
                startDate: exp.startDate || '',
                endDate: exp.endDate || '',
                document: exp.certificate || null,
                isSystem: true,
                deleteTarget: exp?._id || exp?.id ? { kind: 'experience', experienceId: exp?._id || exp?.id } : null
            }, SECTIONS.EXPERIENCE);
        });
        if (hasDoc(employee.signature)) add({ type: 'Digital Signature', issueDate: employee.signature?.signedAt, document: employee.signature, isSystem: true, deleteTarget: { kind: 'signature' } }, SECTIONS.OTHER);

        if (hasDoc(employee.labourCardDetails?.document)) {
            add({
                type: 'Labour Card',
                description: employee.labourCardDetails?.number,
                expiryDate: employee.labourCardDetails?.expiryDate,
                issueDate: employee.labourCardDetails?.issueDate || employee.labourCardDetails?.lastUpdated,
                document: employee.labourCardDetails.document,
                isSystem: true,
                deleteTarget: { kind: 'labourCard' }
            }, SECTIONS.BASIC);
        }
        if (hasDoc(employee.labourCardDetails?.labourContractAttachment)) {
            add({
                type: 'Labour Contract',
                description: employee.labourCardDetails?.number,
                expiryDate: employee.labourCardDetails?.expiryDate,
                issueDate: employee.labourCardDetails?.issueDate || employee.labourCardDetails?.lastUpdated,
                document: employee.labourCardDetails.labourContractAttachment,
                isSystem: true,
                deleteTarget: { kind: 'labourCard' }
            }, SECTIONS.BASIC);
        }

        if (hasDoc(employee.bankAttachment)) {
            add({
                type: 'Bank Details',
                bankName: employee.bankName || employee.bank || '',
                accountNumber: employee.accountNumber || employee.bankAccountNumber || employee.ibanNumber || '',
                issueDate: employee.updatedAt || employee.createdAt,
                document: employee.bankAttachment,
                isSystem: true,
                deleteTarget: { kind: 'bank' }
            }, SECTIONS.BANK);
        }

        // Salary
        const currentBasic = latestSalaryEntry?.basicSalary ?? employee.basicSalary ?? employee.basic ?? 0;
        const currentHra = latestSalaryEntry?.houseRentAllowance ?? employee.houseRentAllowance ?? 0;
        const currentVehicle = latestSalaryEntry?.vehicleAllowance ?? employee.vehicleAllowance ?? 0;
        const currentFuel = latestSalaryEntry?.fuelAllowance ?? employee.fuelAllowance ?? 0;
        const currentOther = latestSalaryEntry?.otherAllowance ?? employee.otherAllowance ?? 0;
        const currentTotal = latestSalaryEntry?.monthlySalary ?? employee.monthlySalary ?? employee.totalSalary ?? 0;
        const currentSalaryDoc = latestSalaryEntry?.offerLetter || employee.offerLetter || null;

        add({
            type: 'Current Salary',
            description: `Basic: ${currentBasic}, HRA: ${currentHra}, Vehicle: ${currentVehicle}, Fuel: ${currentFuel}, Other: ${currentOther}, Total: ${currentTotal}`,
            issueDate: latestSalaryEntry?.fromDate || employee.createdAt,
            expiryDate: latestSalaryEntry?.toDate || employee?.contractExpiryDate || employee?.labourCardDetails?.expiryDate || null,
            currentSalary: currentTotal,
            fromDate: latestSalaryEntry?.fromDate || null,
            toDate: latestSalaryEntry?.toDate || employee?.contractExpiryDate || employee?.labourCardDetails?.expiryDate || null,
            document: currentSalaryDoc,
            isSystem: true,
            deleteTarget: { kind: 'salaryCard' }
        }, SECTIONS.SALARY);

        // Only historical (previous/increment) salary records should appear as history rows.
        // Keep latest record reserved for "Current Salary" card/row.
        salaryHistory.slice(1).forEach((entry, i) => {
            const monthName = entry.month || (entry.fromDate ? new Date(entry.fromDate).toLocaleString('default', { month: 'short', year: 'numeric' }) : `Record ${i + 1}`);
            const salaryIndex = i + 1;
            add({
                type: `Salary (${monthName})`,
                description: `Current Salary: ${entry.monthlySalary ?? 0} • From: ${formatDate(entry.fromDate)} • To: ${formatDate(entry.toDate)} • Fine: ${entry.fine || 0}`,
                issueDate: entry.fromDate,
                expiryDate: entry.toDate,
                currentSalary: entry.monthlySalary ?? entry.totalSalary ?? 0,
                fromDate: entry.fromDate || null,
                toDate: entry.toDate || null,
                document: entry.offerLetter,
                isSystem: true,
                deleteTarget: { kind: 'salaryHistory', salaryIndex }
            }, SECTIONS.SALARY);
            if (hasDoc(entry.attachment)) add({
                type: `Salary Attachment (${monthName})`,
                issueDate: entry.fromDate,
                expiryDate: entry.toDate,
                document: entry.attachment,
                isSystem: true,
                deleteTarget: { kind: 'salaryHistory', salaryIndex }
            }, SECTIONS.SALARY);
        });
        // Fines, Rewards, Loans
        // Manual Documents
        (employee.documents || []).forEach((doc, index) => {
            if (hasDoc(doc.document)) {
                if (isLabourCardSalaryType(doc.type)) return;
                const t = (doc.type || '').toLowerCase();
                // Labour before "salary" — types like "Labour Card Salary" match both substrings
                const section = t.includes('bank')
                    ? SECTIONS.BANK
                    : t.includes('labour')
                        ? SECTIONS.BASIC
                        : t.includes('without expiry')
                            ? SECTIONS.DOC_NO_EXPIRY
                            : t.includes('with expiry')
                                ? SECTIONS.DOC_EXPIRY
                                : doc.expiryDate
                                    ? SECTIONS.DOC_EXPIRY
                                    : t.includes('education')
                                        ? SECTIONS.PERSONAL
                                        : t.includes('experience')
                                            ? SECTIONS.EXPERIENCE
                                            : isBasicIdentityDocType(t)
                                                ? SECTIONS.BASIC
                                                : SECTIONS.DOC_NO_EXPIRY;
                const expired = isExpired(doc.expiryDate);
                docs.push({
                    type: doc.type || 'Document',
                    description: doc.description || doc.discription || '',
                    issueDate: doc.issueDate || doc.createdAt,
                    expiryDate: doc.expiryDate,
                    cost: normalizeStoredCost(doc),
                    university: doc.university || null,
                    course: doc.course || null,
                    year: doc.year || null,
                    experienceType: doc.experienceType || null,
                    designation: doc.designation || null,
                    startDate: doc.startDate || null,
                    endDate: doc.endDate || null,
                    currentSalary: doc.totalSalary ?? null,
                    fromDate: doc.fromDate || null,
                    toDate: doc.toDate || null,
                    basicSalary: doc.basicSalary ?? null,
                    houseRentAllowance: doc.houseRentAllowance ?? null,
                    vehicleAllowance: doc.vehicleAllowance ?? null,
                    fuelAllowance: doc.fuelAllowance ?? null,
                    otherAllowance: doc.otherAllowance ?? null,
                    totalSalary: doc.totalSalary ?? null,
                    document: doc.document,
                    isSystem: false,
                    index,
                    section,
                    expired
                });
            }
        });

        // Queued (pending HR activation) document adds should still be visible in Documents tab.
        const queuedDocAdds = Array.isArray(employee.pendingReactivationChanges)
            ? employee.pendingReactivationChanges.filter((c) => {
                if (!c || typeof c !== 'object') return false;
                const section = String(c.section || '').toLowerCase();
                const changeType = String(c.changeType || '').toLowerCase();
                return section === 'documents' && changeType === 'add' && c.proposedData && hasDoc(c.proposedData.document);
            })
            : [];

        queuedDocAdds.forEach((change) => {
            const doc = change.proposedData || {};
            const t = String(doc.type || '').toLowerCase();
            const section = t.includes('bank')
                ? SECTIONS.BANK
                : t.includes('labour')
                    ? SECTIONS.BASIC
                    : t.includes('without expiry')
                        ? SECTIONS.DOC_NO_EXPIRY
                        : t.includes('with expiry')
                            ? SECTIONS.DOC_EXPIRY
                            : doc.expiryDate
                                ? SECTIONS.DOC_EXPIRY
                                : t.includes('education')
                                    ? SECTIONS.PERSONAL
                                    : t.includes('experience')
                                        ? SECTIONS.EXPERIENCE
                                        : isBasicIdentityDocType(t)
                                            ? SECTIONS.BASIC
                                            : SECTIONS.DOC_NO_EXPIRY;
            const expired = isExpired(doc.expiryDate);
            docs.push({
                ...doc,
                type: doc.type || 'Document',
                description: doc.description || '',
                issueDate: doc.issueDate || doc.createdAt,
                expiryDate: doc.expiryDate,
                cost: normalizeStoredCost(doc),
                document: doc.document,
                isSystem: false,
                isQueued: true,
                section,
                expired
            });
        });

        return docs;
    }, [employee]);

    const { liveDocs, oldDocs } = useMemo(() => {
        const isOldSalaryDoc = (doc) => {
            if (doc.section !== SECTIONS.SALARY) return false;
            if (doc.type === 'Current Salary') return false;
            return Boolean(doc.toDate || doc.expiryDate || String(doc.type || '').toLowerCase().includes('salary ('));
        };

        // Live tab: active docs + active salary entry
        const live = allDocs.filter((doc) => !isOldSalaryDoc(doc));

        // Old tab: archived manual docs + historical salary entries
        const archived = (employee?.oldDocuments || []).filter(
            (doc) => hasDoc(doc?.document) && !isLabourCardSalaryType(doc?.type)
        );
        const oldFromArchived = archived.map((doc, index) => {
            const lowerType = (doc.type || '').toLowerCase();
            const isSalaryRecord =
                lowerType === 'current salary' ||
                lowerType.startsWith('salary (') ||
                lowerType.startsWith('salary attachment (') ||
                doc?.fromDate != null ||
                doc?.toDate != null ||
                doc?.totalSalary != null ||
                doc?.currentSalary != null ||
                doc?.basicSalary != null;
            const section = isSalaryRecord ? SECTIONS.SALARY
                : lowerType.includes('bank') ? SECTIONS.BANK
                    : lowerType.includes('labour') ? SECTIONS.BASIC
                        : lowerType.includes('without expiry') ? SECTIONS.DOC_NO_EXPIRY
                            : lowerType.includes('with expiry') ? SECTIONS.DOC_EXPIRY
                                : lowerType.includes('education') ? SECTIONS.PERSONAL
                                    : lowerType.includes('experience') ? SECTIONS.EXPERIENCE
                                        : isBasicIdentityDocType(lowerType) ? SECTIONS.BASIC
                                            : (doc.expiryDate ? SECTIONS.DOC_EXPIRY : SECTIONS.DOC_NO_EXPIRY);

            // Older archived bank docs store account metadata inside description text.
            // Extract it so Bank Details table shows values instead of "-".
            const description = String(doc.description || '');
            const bankFromDescription =
                description.match(/(?:^|\|)\s*Bank:\s*([^|]+)/i)?.[1]?.trim() || '';
            const accountFromDescription =
                description.match(/(?:^|\|)\s*(?:A\/C|Account(?:\s*No)?):\s*([^|]+)/i)?.[1]?.trim() || '';

            return {
                ...doc,
                index: typeof doc.index === 'number' ? doc.index : index,
                section,
                isSystem: false,
                isArchived: true,
                deleteTarget: { kind: 'oldDocument', oldIndex: index, oldDocumentId: doc?._id || doc?.id || null },
                bankName: doc.bankName || bankFromDescription || '',
                accountNumber: doc.accountNumber || accountFromDescription || '',
                issueDate: doc.createdAt || doc.issueDate || null,
                description: doc.archiveReason ? `${doc.description || ''}${doc.description ? ' • ' : ''}${doc.archiveReason}` : doc.description
            };
        });

        const oldFromSalaryHistory = allDocs
            .filter((doc) => isOldSalaryDoc(doc))
            .map((doc) => ({
                ...doc,
                isArchived: true
            }));

        const old = [...oldFromArchived, ...oldFromSalaryHistory]
            .filter((doc) => doc.section !== SECTIONS.DOC_NO_EXPIRY);

        return { liveDocs: live, oldDocs: old };
    }, [allDocs, employee]);

    const docsToShow = docStatusTab === 'live' ? liveDocs : oldDocs;

    const groupedBySection = useMemo(() => {
        const order = docStatusTab === 'old'
            ? [
                SECTIONS.BASIC,
                SECTIONS.BANK,
                SECTIONS.SALARY,
                SECTIONS.PERSONAL,
                SECTIONS.EXPERIENCE,
                SECTIONS.DOC_EXPIRY,
                SECTIONS.OTHER
            ]
            : [
                SECTIONS.BASIC,
                SECTIONS.BANK,
                SECTIONS.SALARY,
                SECTIONS.PERSONAL,
                SECTIONS.EXPERIENCE,
                SECTIONS.DOC_EXPIRY,
                SECTIONS.DOC_NO_EXPIRY,
                SECTIONS.OTHER
            ];
        const groups = {};
        order.forEach(s => { groups[s] = []; });
        docsToShow.forEach(d => {
            const s = d.section || SECTIONS.OTHER;
            // Old view must not show "Document Without Expiry" at all.
            if (docStatusTab === 'old' && s === SECTIONS.DOC_NO_EXPIRY) return;
            // Only group into known sections for this view (avoid dynamically adding hidden sections).
            if (!groups[s]) return;
            groups[s].push(d);
        });
        return Object.entries(groups);
    }, [docsToShow, docStatusTab]);

    /** Renewal / edit / delete only for users with documents edit (or admin) — not view-only. */
    const canEdit = isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit');
    const canDelete = isAdmin();
    const canManageManualDoc = (doc) => canEdit && !doc.isSystem && !doc.isArchived && typeof doc.index === 'number';
    const hasDeleteTarget = (doc) =>
        typeof doc?.index === 'number' ||
        !!(doc?.deleteTarget && typeof doc.deleteTarget === 'object');
    const canDeleteDoc = (doc) => canDelete && hasDeleteTarget(doc);
    const deleteKeyForDoc = (doc) => {
        if (typeof doc?.index === 'number') return `idx:${doc.index}`;
        if (doc?.deleteTarget?.kind) return `target:${doc.deleteTarget.kind}:${doc.type || 'doc'}`;
        return `row:${doc?.type || 'doc'}`;
    };
    const deleteArgForDoc = (doc) => {
        // If a document has a structured delete target (system docs, archived docs, oldDocuments),
        // the page-level handler needs the full object to route the correct API call.
        if (doc?.deleteTarget?.kind) return doc;
        return typeof doc?.index === 'number' ? doc.index : doc;
    };

    const renderDocTable = (docs, title, colorClass = 'bg-blue-50 text-blue-600') => {
        const sectionKey = `${docStatusTab}:${title}`;
        const totalRows = docs.length;
        const isExpanded = !!sectionExpanded[sectionKey];
        const totalPages = Math.max(1, Math.ceil(totalRows / ROWS_PER_SECTION));
        const currentPage = Math.min(sectionPages[sectionKey] || 1, totalPages);
        const startIndex = (currentPage - 1) * ROWS_PER_SECTION;
        const pagedRows = isExpanded ? docs : docs.slice(startIndex, startIndex + ROWS_PER_SECTION);
        const renderSectionExpandToggle = () => (
            <button
                type="button"
                onClick={() => {
                    setSectionExpanded((prev) => ({ ...prev, [sectionKey]: !isExpanded }));
                    setSectionPages((prev) => ({ ...prev, [sectionKey]: 1 }));
                }}
                className="px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
                {isExpanded ? 'Paginated View' : 'Expand All'}
            </button>
        );
        const renderSectionControls = () => (
            <div className="flex items-center justify-center gap-2 border-t border-gray-100 bg-gray-50/40 px-4 py-2">
                {!isExpanded && totalRows > ROWS_PER_SECTION && (
                    <>
                        <button
                            type="button"
                            onClick={() => setSectionPages((prev) => ({ ...prev, [sectionKey]: Math.max(1, currentPage - 1) }))}
                            disabled={currentPage <= 1}
                            className="h-8 min-w-[64px] rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        >
                            Prev
                        </button>
                        <span className="h-8 min-w-[108px] inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 shadow-sm">
                            Page {currentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setSectionPages((prev) => ({ ...prev, [sectionKey]: Math.min(totalPages, currentPage + 1) }))}
                            disabled={currentPage >= totalPages}
                            className="h-8 min-w-[64px] rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        >
                            Next
                        </button>
                    </>
                )}
            </div>
        );

        if (!docs || docs.length === 0) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 py-8 px-6 text-sm text-gray-500">
                        No data available in this section.
                    </div>
                </div>
            );
        }
        if (title === SECTIONS.BASIC) {
            const showExpiryColBasic = docs.some((d) => d.expiryDate != null && String(d.expiryDate).trim() !== '');
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Document Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Issue Date</th>
                                    {showExpiryColBasic && (
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Expiry Date</th>
                                    )}
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedRows.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const rowColor = docStatusTab === 'old' ? 'bg-gray-100 text-gray-400' : (doc.color || colorClass);
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rowColor}`}>
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-gray-700 text-sm">{doc.type}</span>
                                                        {docStatusTab === 'old' && docRowId(doc) ? (
                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                                ID: {shortId(docRowId(doc))}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.issueDate || doc.startDate)}</td>
                                            {showExpiryColBasic && (
                                                <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                            )}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300 text-sm">—</span>
                                                    )}
                                                    {canDeleteDoc(doc) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const deleteKey = deleteKeyForDoc(doc);
                                                                setDeletingIndex(deleteKey);
                                                                try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                setDeletingIndex(null);
                                                            }}
                                                            disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderSectionControls()}
                </div>
            );
        }
        if (title === SECTIONS.LABOUR) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-cyan-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Basic</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">House Rent Allowance</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Vehicle Allowance</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Fuel Allowance</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Other Allowance</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Total Salary</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedRows.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const formatAmount = (value) => value !== null && value !== undefined && value !== '' ? `${Number(value).toLocaleString()} AED` : '-';
                                    const rowClickable = canEdit && typeof onOpenLabourRow === 'function';
                                    return (
                                        <tr
                                            key={`${doc.type}-${idx}`}
                                            className={`hover:bg-cyan-50/20 transition-colors group ${rowClickable ? 'cursor-pointer' : ''}`}
                                            onClick={(e) => {
                                                if (!rowClickable) return;
                                                if (e.target.closest('button')) return;
                                                onOpenLabourRow(doc);
                                            }}
                                        >
                                            <td className="px-4 py-3 text-sm text-gray-700">{formatAmount(doc.basicSalary)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{formatAmount(doc.houseRentAllowance)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{formatAmount(doc.vehicleAllowance)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{formatAmount(doc.fuelAllowance)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{formatAmount(doc.otherAllowance)}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{formatAmount(doc.totalSalary)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment && (
                                                        <button
                                                            type="button"
                                                            onClick={(ev) => {
                                                                ev.stopPropagation();
                                                                onViewDocument(getDocObj(docForView, doc.type, doc.type));
                                                            }}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    )}
                                                    {(canManageManualDoc(doc) || canDeleteDoc(doc)) && (
                                                        <>
                                                            {canManageManualDoc(doc) && !!doc.expiryDate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(ev) => {
                                                                        ev.stopPropagation();
                                                                        onRenewDocument(doc);
                                                                    }}
                                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                    title="Renew document"
                                                                >
                                                                    <RotateCcw size={16} />
                                                                </button>
                                                            )}
                                                            {canManageManualDoc(doc) && <button type="button" onClick={(ev) => { ev.stopPropagation(); onEditDocument(doc.index); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>}
                                                            {canDeleteDoc(doc) && <button
                                                                type="button"
                                                                onClick={async (ev) => {
                                                                    ev.stopPropagation();
                                                                    const deleteKey = deleteKeyForDoc(doc);
                                                                    setDeletingIndex(deleteKey);
                                                                    try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                    setDeletingIndex(null);
                                                                }}
                                                                disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                            </button>}
                                                        </>
                                                    )}
                                                    {doc.isSystem && <span className="text-[10px] text-gray-400 italic font-medium px-2 py-1 bg-gray-50 rounded">System Doc</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderSectionControls()}
                </div>
            );
        }
        if (title === SECTIONS.SALARY) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-emerald-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Current Salary</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">From Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">To Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedRows.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const value = doc.currentSalary ?? doc.totalSalary ?? doc.cost;
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-emerald-50/20 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
                                                {value !== null && value !== undefined && value !== '' ? `${Number(value).toLocaleString()} AED` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.fromDate || doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                {safeFormatDate(
                                                    doc.toDate ||
                                                    doc.expiryDate ||
                                                    employee?.contractExpiryDate ||
                                                    employee?.labourCardDetails?.expiryDate ||
                                                    doc.issueDate
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300 text-sm">—</span>
                                                    )}
                                                    {canDeleteDoc(doc) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const deleteKey = deleteKeyForDoc(doc);
                                                                setDeletingIndex(deleteKey);
                                                                try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                setDeletingIndex(null);
                                                            }}
                                                            disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderSectionControls()}
                </div>
            );
        }
        if (title === SECTIONS.BANK) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-violet-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Bank Name</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Account No</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedRows.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-violet-50/20 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-gray-700">{doc.bankName || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{doc.accountNumber || '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300 text-sm">—</span>
                                                    )}
                                                    {canDeleteDoc(doc) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const deleteKey = deleteKeyForDoc(doc);
                                                                setDeletingIndex(deleteKey);
                                                                try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                setDeletingIndex(null);
                                                            }}
                                                            disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderSectionControls()}
                </div>
            );
        }
        if (title === SECTIONS.DOC_EXPIRY) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-red-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Document Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Issue Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Expiry</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cost</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedRows.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-red-50/20 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-700">{doc.type}</span>
                                                    {docStatusTab === 'old' && docRowId(doc) ? (
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            ID: {shortId(docRowId(doc))}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{formatDocumentCost(doc.cost)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    )}
                                                    {(canManageManualDoc(doc) || canDeleteDoc(doc)) && (
                                                        <>
                                                            {canManageManualDoc(doc) && !!doc.expiryDate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onRenewDocument(doc)}
                                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                    title="Renew document"
                                                                >
                                                                    <RotateCcw size={16} />
                                                                </button>
                                                            )}
                                                            {docStatusTab === 'live' &&
                                                                canManageManualDoc(doc) &&
                                                                !!doc.expiryDate &&
                                                                typeof onNotRenewDocument === 'function' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onNotRenewDocument(doc)}
                                                                        className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                                                        title="Not renew document"
                                                                    >
                                                                        <Ban size={16} />
                                                                    </button>
                                                                )}
                                                            {canManageManualDoc(doc) && <button type="button" onClick={() => onEditDocument(doc.index)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>}
                                                            {canDeleteDoc(doc) && <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    const deleteKey = deleteKeyForDoc(doc);
                                                                    setDeletingIndex(deleteKey);
                                                                    try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                    setDeletingIndex(null);
                                                                }}
                                                                disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                            </button>}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderSectionControls()}
                </div>
            );
        }
        if (title === SECTIONS.DOC_NO_EXPIRY) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Document Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Issue Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cost</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedRows.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-indigo-50/20 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-700">{doc.type}</span>
                                                    {docStatusTab === 'old' && docRowId(doc) ? (
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            ID: {shortId(docRowId(doc))}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{formatDocumentCost(doc.cost)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    )}
                                                    {(canManageManualDoc(doc) || canDeleteDoc(doc)) && (
                                                        <>
                                                            {canManageManualDoc(doc) && <button type="button" onClick={() => onEditDocument(doc.index)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit / add expiry"><Edit2 size={16} /></button>}
                                                            {canDeleteDoc(doc) && <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    const deleteKey = deleteKeyForDoc(doc);
                                                                    setDeletingIndex(deleteKey);
                                                                    try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                    setDeletingIndex(null);
                                                                }}
                                                                disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                            </button>}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderSectionControls()}
                </div>
            );
        }
        if (title === SECTIONS.PERSONAL) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-amber-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">University</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Course</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Year</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedRows.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const parts = String(doc.description || '').split('•').map((p) => p.trim());
                                    const university = doc.university || parts[0] || '-';
                                    const course = doc.course || parts[1] || '-';
                                    const year = doc.year || parts[2] || '-';
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-amber-50/20 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-gray-700">{university}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{course}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{year}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    ) : <span className="text-gray-300 text-sm">—</span>}
                                                    {canDeleteDoc(doc) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const deleteKey = deleteKeyForDoc(doc);
                                                                setDeletingIndex(deleteKey);
                                                                try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                setDeletingIndex(null);
                                                            }}
                                                            disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {renderSectionControls()}
                </div>
            );
        }
        if (title === SECTIONS.EXPERIENCE) {
            return (
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-4 w-1 bg-slate-500 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Designation</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Start Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">End Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {docs.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const parts = String(doc.description || '').split('•').map((p) => p.trim());
                                    const type = doc.experienceType || parts[0] || '-';
                                    const designation = doc.designation || parts[1] || '-';
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-gray-700">{type}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{designation}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.startDate || doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.endDate || doc.expiryDate)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasAttachment ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Download / view attachment"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    ) : <span className="text-gray-300 text-sm">—</span>}
                                                    {canDeleteDoc(doc) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const deleteKey = deleteKeyForDoc(doc);
                                                                setDeletingIndex(deleteKey);
                                                                try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { /* noop */ }
                                                                setDeletingIndex(null);
                                                            }}
                                                            disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }
        const showExpiryColOther = docs.some((d) => d.expiryDate != null && String(d.expiryDate).trim() !== '');
        return (
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                    <h4 className="text-lg font-bold text-gray-800">{title}</h4>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Document Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Issue Date</th>
                                {showExpiryColOther && (
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Expiry Date</th>
                                )}
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cost</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{renderSectionExpandToggle()}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {pagedRows.map((doc, idx) => {
                                const docForView = doc.document;
                                const hasAttachment = hasDoc(docForView);
                                const rowColor = docStatusTab === 'old' ? 'bg-gray-100 text-gray-400' : (doc.color || colorClass);
                                return (
                                    <tr key={`${doc.type}-${idx}`} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rowColor}`}>
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-700 text-sm">{doc.type}</span>
                                                    {doc.description && <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">{doc.description}</span>}
                                                    {docStatusTab === 'old' && docRowId(doc) ? (
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            ID: {shortId(docRowId(doc))}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.issueDate || doc.startDate)}</td>
                                        {showExpiryColOther && (
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                        )}
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatDocumentCost(doc.cost)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {hasAttachment && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Download / view attachment"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                                {(canManageManualDoc(doc) || canDeleteDoc(doc)) && (
                                                    <>
                                                        {canManageManualDoc(doc) && !!doc.expiryDate && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onRenewDocument(doc)}
                                                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Renew document"
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                        )}
                                                        {canManageManualDoc(doc) && <button type="button" onClick={() => onEditDocument(doc.index)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>}
                                                        {canDeleteDoc(doc) && <button
                                                            type="button"
                                                            onClick={async () => { const deleteKey = deleteKeyForDoc(doc); setDeletingIndex(deleteKey); try { await onDeleteDocument(deleteArgForDoc(doc)); } catch (e) { } setDeletingIndex(null); }}
                                                            disabled={deletingIndex === deleteKeyForDoc(doc)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            {deletingIndex === deleteKeyForDoc(doc) ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                                        </button>}
                                                    </>
                                                )}
                                                {doc.isSystem && <span className="text-[10px] text-gray-400 italic font-medium px-2 py-1 bg-gray-50 rounded">System Doc</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {renderSectionControls()}
            </div>
        );
    };

    const sectionColors = {
        [SECTIONS.BASIC]: 'bg-blue-50 text-blue-600',
        [SECTIONS.BANK]: 'bg-violet-50 text-violet-600',
        [SECTIONS.PERSONAL]: 'bg-amber-50 text-amber-600',
        [SECTIONS.EXPERIENCE]: 'bg-slate-50 text-slate-600',
        [SECTIONS.SALARY]: 'bg-emerald-50 text-emerald-600',
        [SECTIONS.LABOUR]: 'bg-cyan-50 text-cyan-600',
        [SECTIONS.DOC_EXPIRY]: 'bg-red-50 text-red-600',
        [SECTIONS.DOC_NO_EXPIRY]: 'bg-indigo-50 text-indigo-600',
        [SECTIONS.OTHER]: 'bg-gray-50 text-gray-600'
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-in fade-in duration-500 min-h-[400px]">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-800">Documents</h3>
                    {canEdit && onOpenDocumentModal && (
                        <button
                            type="button"
                            onClick={() => onOpenDocumentModal()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                        >
                            <Plus size={16} /> Add Document
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-6 border-b border-gray-100">
                    <button
                        onClick={() => setDocStatusTab('live')}
                        className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'live' ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Live Documents
                    </button>
                    <button
                        onClick={() => setDocStatusTab('old')}
                        className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'old' ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Old Documents
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {groupedBySection.map(([section, docs]) => (
                    <div key={section}>{(renderDocTable(docs, section, sectionColors[section] || 'bg-gray-50 text-gray-600'))}</div>
                ))}
            </div>
        </div>
    );
}
