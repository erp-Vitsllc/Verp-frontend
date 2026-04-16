'use client';

import React, { useMemo, useState } from 'react';
import { FileText, Download, Edit2, X, Plus, Upload } from 'lucide-react';

const SECTIONS = {
    BASIC: 'Basic Details',
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

export default function DocumentsTab({
    employee,
    isAdmin,
    hasPermission,
    /** @param {'with_expiry'|'no_expiry'} mode */
    onOpenDocumentModal,
    onOpenLabourCardModal,
    onOpenLabourRow,
    onViewDocument,
    onEditDocument,
    onDeleteDocument,
    formatDate: formatDateProp
}) {
    const [docStatusTab, setDocStatusTab] = useState('live'); // 'live' | 'old'
    const [deletingIndex, setDeletingIndex] = useState(null);

    const safeFormatDate = (date) => {
        if (formatDateProp) return formatDateProp(date);
        return formatDate(date);
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
        if (hasDoc(employee.passportDetails?.document)) add({ type: 'Passport', description: employee.passportDetails?.number, expiryDate: employee.passportDetails?.expiryDate, issueDate: employee.passportDetails?.issueDate, document: employee.passportDetails.document, isSystem: true }, SECTIONS.BASIC);
        if (employee.visaDetails) {
            ['visit', 'employment', 'spouse'].forEach(t => {
                const v = employee.visaDetails[t];
                if (hasDoc(v?.document)) add({ type: `${t.charAt(0).toUpperCase() + t.slice(1)} Visa`, description: v?.number, expiryDate: v?.expiryDate, issueDate: v?.issueDate, document: v.document, isSystem: true }, SECTIONS.BASIC);
            });
        }
        if (hasDoc(employee.emiratesIdDetails?.document)) add({ type: 'Emirates ID', description: employee.emiratesIdDetails?.number, expiryDate: employee.emiratesIdDetails?.expiryDate, issueDate: employee.emiratesIdDetails?.issueDate, document: employee.emiratesIdDetails.document, isSystem: true }, SECTIONS.BASIC);
        if (hasDoc(employee.medicalInsuranceDetails?.document)) add({ type: 'Medical Insurance', description: employee.medicalInsuranceDetails?.provider, expiryDate: employee.medicalInsuranceDetails?.expiryDate, issueDate: employee.medicalInsuranceDetails?.issueDate, document: employee.medicalInsuranceDetails.document, isSystem: true }, SECTIONS.BASIC);
        if (hasDoc(employee.drivingLicenceDetails?.document)) add({ type: 'Driving License', description: employee.drivingLicenceDetails?.number, expiryDate: employee.drivingLicenceDetails?.expiryDate, issueDate: employee.drivingLicenceDetails?.issueDate, document: employee.drivingLicenceDetails.document, isSystem: true }, SECTIONS.BASIC);

        // Personal Information
        (employee.educationDetails || []).forEach((edu, i) => {
            if (hasDoc(edu.certificate)) add({
                type: 'Education Certificate',
                description: `${edu.universityOrBoard || edu.collegeOrInstitute || 'University'} • ${edu.course || 'Course'} • ${edu.completedYear || ''}`,
                issueDate: edu.completedYear ? `${edu.completedYear}-01-01` : '',
                university: edu.universityOrBoard || edu.collegeOrInstitute || '',
                course: edu.course || '',
                year: edu.completedYear || '',
                document: edu.certificate,
                isSystem: true
            }, SECTIONS.PERSONAL);
        });
        (employee.experienceDetails || []).forEach((exp, i) => {
            if (hasDoc(exp.certificate)) add({
                type: 'Experience',
                description: `${exp.company || ''} • ${exp.designation || ''}`.trim(),
                issueDate: exp.startDate,
                expiryDate: exp.endDate,
                experienceType: exp.company || exp.type || '',
                designation: exp.designation || exp.destination || '',
                startDate: exp.startDate || '',
                endDate: exp.endDate || '',
                document: exp.certificate,
                isSystem: true
            }, SECTIONS.EXPERIENCE);
        });
        if (hasDoc(employee.signature)) add({ type: 'Digital Signature', issueDate: employee.signature?.signedAt, document: employee.signature, isSystem: true }, SECTIONS.OTHER);

        // Salary
        const currentBasic = latestSalaryEntry?.basicSalary ?? employee.basicSalary ?? employee.basic ?? 0;
        const currentHra = latestSalaryEntry?.houseRentAllowance ?? employee.houseRentAllowance ?? 0;
        const currentVehicle = latestSalaryEntry?.vehicleAllowance ?? employee.vehicleAllowance ?? 0;
        const currentFuel = latestSalaryEntry?.fuelAllowance ?? employee.fuelAllowance ?? 0;
        const currentOther = latestSalaryEntry?.otherAllowance ?? employee.otherAllowance ?? 0;
        const currentTotal = latestSalaryEntry?.monthlySalary ?? employee.monthlySalary ?? employee.totalSalary ?? 0;
        const currentSalaryDoc = latestSalaryEntry?.offerLetter || employee.offerLetter || null;

        const labourCardSnapshot = {
            basicSalary: currentBasic,
            houseRentAllowance: currentHra,
            vehicleAllowance: currentVehicle,
            fuelAllowance: currentFuel,
            otherAllowance: currentOther,
            totalSalary: currentTotal
        };

        if (hasDoc(employee.labourCardDetails?.document)) {
            add({
                type: 'Labour Card',
                description: employee.labourCardDetails?.number,
                expiryDate: employee.labourCardDetails?.expiryDate,
                issueDate: employee.labourCardDetails?.issueDate,
                document: employee.labourCardDetails.document,
                isSystem: true,
                ...labourCardSnapshot
            }, SECTIONS.LABOUR);
        }

        add({
            type: 'Current Salary',
            description: `Basic: ${currentBasic}, HRA: ${currentHra}, Vehicle: ${currentVehicle}, Fuel: ${currentFuel}, Other: ${currentOther}, Total: ${currentTotal}`,
            issueDate: latestSalaryEntry?.fromDate || employee.createdAt,
            expiryDate: latestSalaryEntry?.toDate || null,
            currentSalary: currentTotal,
            fromDate: latestSalaryEntry?.fromDate || null,
            toDate: latestSalaryEntry?.toDate || null,
            document: currentSalaryDoc,
            isSystem: true
        }, SECTIONS.SALARY);

        // Only historical (previous/increment) salary records should appear as history rows.
        // Keep latest record reserved for "Current Salary" card/row.
        salaryHistory.slice(1).forEach((entry, i) => {
            const monthName = entry.month || (entry.fromDate ? new Date(entry.fromDate).toLocaleString('default', { month: 'short', year: 'numeric' }) : `Record ${i + 1}`);
            add({
                type: `Salary (${monthName})`,
                description: `Current Salary: ${entry.monthlySalary ?? 0} • From: ${formatDate(entry.fromDate)} • To: ${formatDate(entry.toDate)} • Fine: ${entry.fine || 0}`,
                issueDate: entry.fromDate,
                expiryDate: entry.toDate,
                currentSalary: entry.monthlySalary ?? entry.totalSalary ?? 0,
                fromDate: entry.fromDate || null,
                toDate: entry.toDate || null,
                document: entry.offerLetter,
                isSystem: true
            }, SECTIONS.SALARY);
            if (hasDoc(entry.attachment)) add({
                type: `Salary Attachment (${monthName})`,
                issueDate: entry.fromDate,
                expiryDate: entry.toDate,
                document: entry.attachment,
                isSystem: true
            }, SECTIONS.SALARY);
        });
        const labourSalaryDoc = employee.labourCardDetails?.document || employee.offerLetter;
        const hasLabourCardFile = hasDoc(employee.labourCardDetails?.document);
        const lcdRef = employee.labourCardDetails?.document;
        const sameLabourAttachment = (a, b) => {
            if (!a || !b) return false;
            if (a === b) return true;
            if (a.url && b.url && a.url === b.url) return true;
            if (a.publicId && b.publicId && a.publicId === b.publicId) return true;
            return false;
        };
        const labourSalaryIsSameAsCardFile = hasLabourCardFile && sameLabourAttachment(labourSalaryDoc, lcdRef);
        // Avoid a second row with the same attachment + salary when the Labour Card row already shows both
        if (hasDoc(labourSalaryDoc) && !labourSalaryIsSameAsCardFile) {
            add({
                type: 'Labour Card Salary',
                description: employee.labourCardDetails?.number || '',
                issueDate: employee.labourCardDetails?.issueDate || employee.createdAt,
                expiryDate: employee.labourCardDetails?.expiryDate,
                basicSalary: currentBasic,
                houseRentAllowance: currentHra,
                vehicleAllowance: currentVehicle,
                fuelAllowance: currentFuel,
                otherAllowance: currentOther,
                totalSalary: currentTotal,
                document: labourSalaryDoc,
                isSystem: true
            }, SECTIONS.LABOUR);
        }

        // Fines, Rewards, Loans
        // Manual Documents
        (employee.documents || []).forEach((doc, index) => {
            if (hasDoc(doc.document)) {
                const t = (doc.type || '').toLowerCase();
                // Labour before "salary" — types like "Labour Card Salary" match both substrings
                const section = t.includes('labour')
                    ? SECTIONS.LABOUR
                    : doc.expiryDate
                      ? SECTIONS.DOC_EXPIRY
                      : t.includes('education')
                        ? SECTIONS.PERSONAL
                        : t.includes('experience')
                          ? SECTIONS.EXPERIENCE
                          : t.includes('salary')
                            ? SECTIONS.SALARY
                            : t.includes('passport') || t.includes('visa') || t.includes('emirates')
                              ? SECTIONS.BASIC
                              : t.includes('other')
                                ? SECTIONS.OTHER
                                : SECTIONS.DOC_NO_EXPIRY;
                const expired = isExpired(doc.expiryDate);
                const hasStoredLabourBreakdown = [doc.basicSalary, doc.houseRentAllowance, doc.vehicleAllowance, doc.fuelAllowance, doc.otherAllowance, doc.totalSalary].some(
                    (v) => v !== null && v !== undefined && v !== ''
                );
                const effBasic = hasStoredLabourBreakdown ? doc.basicSalary : (t.includes('labour') ? currentBasic : doc.basicSalary);
                const effHra = hasStoredLabourBreakdown ? doc.houseRentAllowance : (t.includes('labour') ? currentHra : doc.houseRentAllowance);
                const effVehicle = hasStoredLabourBreakdown ? doc.vehicleAllowance : (t.includes('labour') ? currentVehicle : doc.vehicleAllowance);
                const effFuel = hasStoredLabourBreakdown ? doc.fuelAllowance : (t.includes('labour') ? currentFuel : doc.fuelAllowance);
                const effOther = hasStoredLabourBreakdown ? doc.otherAllowance : (t.includes('labour') ? currentOther : doc.otherAllowance);
                const effTotal = hasStoredLabourBreakdown ? doc.totalSalary : (t.includes('labour') ? currentTotal : doc.totalSalary);
                const labourBreakdown = [
                    `Basic: ${effBasic ?? '-'}`,
                    `HRA: ${effHra ?? '-'}`,
                    `Vehicle: ${effVehicle ?? '-'}`,
                    `Fuel: ${effFuel ?? '-'}`,
                    `Other: ${effOther ?? '-'}`,
                    `Total: ${effTotal ?? '-'}`
                ].join(', ');
                docs.push({
                    type: doc.type || 'Document',
                    description: t.includes('labour') ? labourBreakdown : doc.description,
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
                    currentSalary: effTotal ?? doc.totalSalary ?? null,
                    fromDate: doc.fromDate || null,
                    toDate: doc.toDate || null,
                    basicSalary: effBasic ?? null,
                    houseRentAllowance: effHra ?? null,
                    vehicleAllowance: effVehicle ?? null,
                    fuelAllowance: effFuel ?? null,
                    otherAllowance: effOther ?? null,
                    totalSalary: effTotal ?? null,
                    document: doc.document,
                    isSystem: false,
                    index,
                    section,
                    expired
                });
            }
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
        const archived = (employee?.oldDocuments || []).filter((doc) => hasDoc(doc?.document));
        const oldFromArchived = archived.map((doc, index) => {
            const lowerType = (doc.type || '').toLowerCase();
            const section = lowerType.includes('salary') || lowerType.includes('bank') ? SECTIONS.SALARY
                : lowerType.includes('labour') ? SECTIONS.LABOUR
                    : lowerType.includes('education') || lowerType.includes('experience') ? SECTIONS.PERSONAL
                        : lowerType.includes('passport') || lowerType.includes('visa') || lowerType.includes('emirates') ? SECTIONS.BASIC
                            : (doc.expiryDate ? SECTIONS.DOC_EXPIRY : SECTIONS.DOC_NO_EXPIRY);
            return {
                ...doc,
                index: typeof doc.index === 'number' ? doc.index : index,
                section,
                isSystem: false,
                isArchived: true,
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

        const old = [...oldFromArchived, ...oldFromSalaryHistory];

        return { liveDocs: live, oldDocs: old };
    }, [allDocs, employee]);

    const docsToShow = docStatusTab === 'live' ? liveDocs : oldDocs;

    const groupedBySection = useMemo(() => {
        const order = [
            SECTIONS.BASIC,
            SECTIONS.SALARY,
            SECTIONS.LABOUR,
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
            if (!groups[s]) groups[s] = [];
            groups[s].push(d);
        });
        return Object.entries(groups);
    }, [docsToShow]);

    /** Renewal / edit / delete only for users with documents edit (or admin) — not view-only. */
    const canEdit = isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit');
    const canManageManualDoc = (doc) => canEdit && !doc.isSystem && !doc.isArchived && typeof doc.index === 'number';

    const renderDocTable = (docs, title, colorClass = 'bg-blue-50 text-blue-600') => {
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {docs.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const rowColor = docStatusTab === 'old' ? 'bg-gray-100 text-gray-400' : (doc.color || colorClass);
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rowColor}`}>
                                                        <FileText size={20} />
                                                    </div>
                                                    <span className="font-semibold text-gray-700 text-sm">{doc.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.issueDate || doc.startDate)}</td>
                                            {showExpiryColBasic && (
                                                <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                            )}
                                            <td className="px-6 py-4">
                                                {hasAttachment ? (
                                                    <button
                                                        onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline"
                                                    >
                                                        <Download size={14} /> View
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">No document</span>
                                                )}
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
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {docs.map((doc, idx) => {
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
                                            <td className="px-4 py-3">
                                                {hasAttachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={(ev) => {
                                                            ev.stopPropagation();
                                                            onViewDocument(getDocObj(docForView, doc.type, doc.type));
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline"
                                                    >
                                                        <Download size={14} /> View
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">No document</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canManageManualDoc(doc) && (
                                                        <>
                                                            {!!doc.expiryDate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(ev) => {
                                                                        ev.stopPropagation();
                                                                        onEditDocument(doc.index);
                                                                    }}
                                                                    className="px-2 py-1 text-[10px] font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                                                                    title="Renew document"
                                                                >
                                                                    Renewal
                                                                </button>
                                                            )}
                                                            <button type="button" onClick={(ev) => { ev.stopPropagation(); onEditDocument(doc.index); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                            <button
                                                                type="button"
                                                                onClick={async (ev) => {
                                                                    ev.stopPropagation();
                                                                    setDeletingIndex(doc.index);
                                                                    try { await onDeleteDocument(doc.index); } catch (e) { /* noop */ }
                                                                    setDeletingIndex(null);
                                                                }}
                                                                disabled={deletingIndex === doc.index}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                {deletingIndex === doc.index ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <X size={16} />}
                                                            </button>
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {docs.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const value = doc.currentSalary ?? doc.totalSalary ?? doc.cost;
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-emerald-50/20 transition-colors">
                                            <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
                                                {value !== null && value !== undefined && value !== '' ? `${Number(value).toLocaleString()} AED` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.fromDate || doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.toDate || doc.expiryDate)}</td>
                                            <td className="px-6 py-4">
                                                {hasAttachment ? (
                                                    <button
                                                        onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline"
                                                    >
                                                        <Download size={14} /> View
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">No document</span>
                                                )}
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {docs.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-red-50/20 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-700">{doc.type}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{formatDocumentCost(doc.cost)}</td>
                                            <td className="px-6 py-4">
                                                {hasAttachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline"
                                                    >
                                                        <Download size={14} /> View
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">No document</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canManageManualDoc(doc) && (
                                                        <>
                                                            {!!doc.expiryDate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onEditDocument(doc.index)}
                                                                    className="px-2 py-1 text-[10px] font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                                                                    title="Renew document"
                                                                >
                                                                    Renewal
                                                                </button>
                                                            )}
                                                            <button type="button" onClick={() => onEditDocument(doc.index)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    setDeletingIndex(doc.index);
                                                                    try { await onDeleteDocument(doc.index); } catch (e) { /* noop */ }
                                                                    setDeletingIndex(null);
                                                                }}
                                                                disabled={deletingIndex === doc.index}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                {deletingIndex === doc.index ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <X size={16} />}
                                                            </button>
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {docs.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-indigo-50/20 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-700">{doc.type}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{formatDocumentCost(doc.cost)}</td>
                                            <td className="px-6 py-4">
                                                {hasAttachment ? (
                                                    <button type="button" onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))} className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline">
                                                        <Download size={14} /> View
                                                    </button>
                                                ) : <span className="text-gray-400 text-xs italic">No document</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canManageManualDoc(doc) && (
                                                        <>
                                                            <button type="button" onClick={() => onEditDocument(doc.index)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit / add expiry"><Edit2 size={16} /></button>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    setDeletingIndex(doc.index);
                                                                    try { await onDeleteDocument(doc.index); } catch (e) { /* noop */ }
                                                                    setDeletingIndex(null);
                                                                }}
                                                                disabled={deletingIndex === doc.index}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                {deletingIndex === doc.index ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <X size={16} />}
                                                            </button>
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {docs.map((doc, idx) => {
                                    const docForView = doc.document;
                                    const hasAttachment = hasDoc(docForView);
                                    const parts = String(doc.description || '').split('•').map((p) => p.trim());
                                    const university = doc.university || parts[0] || '-';
                                    const course = doc.course || parts[1] || '-';
                                    const year = doc.year || parts[2] || '-';
                                    return (
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-amber-50/20 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-700">{university}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{course}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{year}</td>
                                            <td className="px-6 py-4">
                                                {hasAttachment ? (
                                                    <button onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))} className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline">
                                                        <Download size={14} /> View
                                                    </button>
                                                ) : <span className="text-gray-400 text-xs italic">No document</span>}
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
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
                                        <tr key={`${doc.type}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-700">{type}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{designation}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.startDate || doc.issueDate)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{safeFormatDate(doc.endDate || doc.expiryDate)}</td>
                                            <td className="px-6 py-4">
                                                {hasAttachment ? (
                                                    <button onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))} className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline">
                                                        <Download size={14} /> View
                                                    </button>
                                                ) : <span className="text-gray-400 text-xs italic">No document</span>}
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
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {docs.map((doc, idx) => {
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
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.issueDate || doc.startDate)}</td>
                                        {showExpiryColOther && (
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                        )}
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatDocumentCost(doc.cost)}</td>
                                        <td className="px-6 py-4">
                                            {hasAttachment ? (
                                                <button
                                                    onClick={() => onViewDocument(getDocObj(docForView, doc.type, doc.type))}
                                                    className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2 hover:underline"
                                                >
                                                    <Download size={14} /> View
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">No document</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {canManageManualDoc(doc) && (
                                                    <>
                                                        {!!doc.expiryDate && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onEditDocument(doc.index)}
                                                                className="px-2 py-1 text-[10px] font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                                                                title="Renew document"
                                                            >
                                                                Renewal
                                                            </button>
                                                        )}
                                                        <button type="button" onClick={() => onEditDocument(doc.index)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                        <button
                                                            type="button"
                                                            onClick={async () => { setDeletingIndex(doc.index); try { await onDeleteDocument(doc.index); } catch (e) {} setDeletingIndex(null); }}
                                                            disabled={deletingIndex === doc.index}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            {deletingIndex === doc.index ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <X size={16} />}
                                                        </button>
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
            </div>
        );
    };

    const sectionColors = {
        [SECTIONS.BASIC]: 'bg-blue-50 text-blue-600',
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
                        <div className="flex items-center gap-2">
                            {onOpenLabourCardModal && (
                                <button
                                    type="button"
                                    onClick={() => onOpenLabourCardModal()}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <Plus size={16} /> Add Labour Card
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => onOpenDocumentModal('with_expiry')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                            >
                                <Plus size={16} /> Document (Expiry)
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenDocumentModal('no_expiry')}
                                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                            >
                                <Plus size={16} /> Document (No Expiry)
                            </button>
                        </div>
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
