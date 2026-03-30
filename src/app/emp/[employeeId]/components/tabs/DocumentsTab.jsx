'use client';

import React, { useMemo, useState } from 'react';
import { FileText, Download, Edit2, X, Plus, Upload } from 'lucide-react';

const SECTIONS = {
    BASIC: 'Basic Details',
    PERSONAL: 'Personal Information',
    WORK: 'Work Details',
    SALARY: 'Salary',
    TRAINING: 'Training',
    FINE: 'Fines',
    REWARD: 'Rewards',
    LOAN: 'Loans & Advances',
    OTHER: 'Other'
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

export default function DocumentsTab({
    employee,
    isAdmin,
    hasPermission,
    onOpenDocumentModal,
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

        const add = (doc, section) => {
            if (!doc) return;
            const exp = doc.expiryDate;
            const expired = isExpired(exp);
            docs.push({ ...doc, section, expired, issueDate: doc.issueDate || doc.startDate });
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
        if (hasDoc(employee.labourCardDetails?.document)) add({ type: 'Labour Card', description: employee.labourCardDetails?.number, expiryDate: employee.labourCardDetails?.expiryDate, issueDate: employee.labourCardDetails?.issueDate, document: employee.labourCardDetails.document, isSystem: true }, SECTIONS.BASIC);
        if (hasDoc(employee.medicalInsuranceDetails?.document)) add({ type: 'Medical Insurance', description: employee.medicalInsuranceDetails?.provider, expiryDate: employee.medicalInsuranceDetails?.expiryDate, issueDate: employee.medicalInsuranceDetails?.issueDate, document: employee.medicalInsuranceDetails.document, isSystem: true }, SECTIONS.BASIC);
        if (hasDoc(employee.drivingLicenceDetails?.document)) add({ type: 'Driving License', description: employee.drivingLicenceDetails?.number, expiryDate: employee.drivingLicenceDetails?.expiryDate, issueDate: employee.drivingLicenceDetails?.issueDate, document: employee.drivingLicenceDetails.document, isSystem: true }, SECTIONS.BASIC);

        // Personal Information
        (employee.educationDetails || []).forEach((edu, i) => {
            if (hasDoc(edu.certificate)) add({ type: `Education: ${edu.course || 'Certificate'}`, description: edu.universityOrBoard || edu.collegeOrInstitute || '', expiryDate: edu.completedYear, document: edu.certificate, isSystem: true }, SECTIONS.PERSONAL);
        });
        (employee.experienceDetails || []).forEach((exp, i) => {
            if (hasDoc(exp.certificate)) add({ type: `Experience: ${exp.company || 'Certificate'}`, description: exp.designation, expiryDate: exp.endDate, document: exp.certificate, isSystem: true }, SECTIONS.PERSONAL);
        });
        if (hasDoc(employee.signature)) add({ type: 'Digital Signature', expiryDate: employee.signature?.signedAt, document: employee.signature, isSystem: true }, SECTIONS.PERSONAL);
        (employee.trainingDetails || []).concat(employee.trainingDetailsFromTraining || []).forEach((t, i) => {
            if (hasDoc(t.certificate)) add({ type: `Training: ${t.trainingName || 'Cert'}`, description: t.provider, expiryDate: t.trainingDate, document: t.certificate, isSystem: true }, SECTIONS.TRAINING);
        });

        // Work Details
        if (employee.status === 'Notice' && hasDoc(employee.noticeRequest?.attachment)) {
            const docType = employee.noticeRequest?.reason === 'Termination' ? 'Termination Document' : 'Resignation Document';
            add({ type: docType, expiryDate: employee.noticeRequest?.requestedAt, document: employee.noticeRequest.attachment, isSystem: true }, SECTIONS.WORK);
        }

        // Salary
        if (hasDoc(employee.offerLetter)) add({ type: 'Salary Letter (Current)', document: employee.offerLetter, isSystem: true }, SECTIONS.SALARY);
        (employee.salaryHistory || []).forEach((entry, i) => {
            const monthName = entry.month || (entry.fromDate ? new Date(entry.fromDate).toLocaleString('default', { month: 'short', year: 'numeric' }) : `Record ${i + 1}`);
            if (hasDoc(entry.offerLetter)) add({ type: `Salary Letter (${monthName})`, expiryDate: entry.fromDate, document: entry.offerLetter, isSystem: true }, SECTIONS.SALARY);
            if (hasDoc(entry.attachment)) add({ type: `Salary Attachment (${monthName})`, expiryDate: entry.fromDate, document: entry.attachment, isSystem: true }, SECTIONS.SALARY);
        });
        const bankDoc = employee.bankAccountAttachment || employee.bankAttachment;
        if (hasDoc(bankDoc)) add({ type: 'Bank Detail Attachment', document: bankDoc, isSystem: true }, SECTIONS.SALARY);

        // Fines, Rewards, Loans
        (employee.fines || []).forEach((f, i) => {
            if (hasDoc(f.attachment)) add({ type: `Fine: ${f.fineId || 'Doc'}`, expiryDate: f.createdAt || f.fineDate, document: f.attachment, value: f.fineAmount, isSystem: true }, SECTIONS.FINE);
        });
        (employee.rewards || []).forEach((r, i) => {
            if (hasDoc(r.attachment)) add({ type: `Reward: ${r.rewardId || 'Doc'}`, expiryDate: r.createdAt || r.awardedDate, document: r.attachment, value: r.amount, isSystem: true }, SECTIONS.REWARD);
        });
        (employee.loans || []).forEach((l, i) => {
            const label = (l.type === 'Advance' || l.loanId?.includes('ADV')) ? 'Advance' : 'Loan';
            if (hasDoc(l.attachment)) add({ type: `${label}: ${l.loanId || 'Doc'}`, expiryDate: l.createdAt || l.appliedDate, document: l.attachment, value: l.amount, isSystem: true }, SECTIONS.LOAN);
        });

        // Manual Documents
        (employee.documents || []).forEach((doc, index) => {
            if (hasDoc(doc.document)) {
                const section = (doc.type || '').toLowerCase().includes('salary') || (doc.type || '').toLowerCase().includes('bank') ? SECTIONS.SALARY
                    : (doc.type || '').toLowerCase().includes('education') || (doc.type || '').toLowerCase().includes('experience') ? SECTIONS.PERSONAL
                        : (doc.type || '').toLowerCase().includes('passport') || (doc.type || '').toLowerCase().includes('visa') || (doc.type || '').toLowerCase().includes('labour') || (doc.type || '').toLowerCase().includes('emirates') ? SECTIONS.BASIC
                            : SECTIONS.OTHER;
                const expired = isExpired(doc.expiryDate);
                docs.push({ type: doc.type || 'Document', description: doc.description, expiryDate: doc.expiryDate, document: doc.document, isSystem: false, index, section, expired });
            }
        });

        return docs;
    }, [employee]);

    const { liveDocs, oldDocs } = useMemo(() => {
        // Live tab: all currently active docs shown on profile
        const live = allDocs;

        // Old tab: only replaced/deleted manual docs archived by backend
        const archived = (employee?.oldDocuments || []).filter((doc) => hasDoc(doc?.document));
        const old = archived.map((doc, index) => {
            const section = (doc.type || '').toLowerCase().includes('salary') || (doc.type || '').toLowerCase().includes('bank') ? SECTIONS.SALARY
                : (doc.type || '').toLowerCase().includes('education') || (doc.type || '').toLowerCase().includes('experience') ? SECTIONS.PERSONAL
                    : (doc.type || '').toLowerCase().includes('passport') || (doc.type || '').toLowerCase().includes('visa') || (doc.type || '').toLowerCase().includes('labour') || (doc.type || '').toLowerCase().includes('emirates') ? SECTIONS.BASIC
                        : SECTIONS.OTHER;
            return {
                ...doc,
                index,
                section,
                isSystem: false,
                isArchived: true,
                issueDate: doc.createdAt || doc.issueDate || null,
                description: doc.archiveReason ? `${doc.description || ''}${doc.description ? ' • ' : ''}${doc.archiveReason}` : doc.description
            };
        });

        return { liveDocs: live, oldDocs: old };
    }, [allDocs, employee]);

    const docsToShow = docStatusTab === 'live' ? liveDocs : oldDocs;

    const groupedBySection = useMemo(() => {
        const order = [SECTIONS.BASIC, SECTIONS.PERSONAL, SECTIONS.WORK, SECTIONS.SALARY, SECTIONS.TRAINING, SECTIONS.FINE, SECTIONS.REWARD, SECTIONS.LOAN, SECTIONS.OTHER];
        const groups = {};
        order.forEach(s => { groups[s] = []; });
        docsToShow.forEach(d => {
            const s = d.section || SECTIONS.OTHER;
            if (!groups[s]) groups[s] = [];
            groups[s].push(d);
        });
        return Object.entries(groups).filter(([, docs]) => docs.length > 0);
    }, [docsToShow]);

    const canEdit = isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit');

    const renderDocTable = (docs, title, colorClass = 'bg-blue-50 text-blue-600') => {
        if (!docs || docs.length === 0) return null;
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
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Start/Issue Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Expiry Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Value</th>
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
                                        <td className="px-6 py-4 text-sm font-medium text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">{doc.value ? `${Number(doc.value).toLocaleString()} AED` : '-'}</td>
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
                                                {!doc.isSystem && !doc.isArchived && canEdit && (
                                                    <>
                                                        <button onClick={() => onEditDocument(doc.index)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                        <button
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
        [SECTIONS.WORK]: 'bg-slate-50 text-slate-600',
        [SECTIONS.SALARY]: 'bg-emerald-50 text-emerald-600',
        [SECTIONS.TRAINING]: 'bg-teal-50 text-teal-600',
        [SECTIONS.FINE]: 'bg-red-50 text-red-600',
        [SECTIONS.REWARD]: 'bg-purple-50 text-purple-600',
        [SECTIONS.LOAN]: 'bg-violet-50 text-violet-600',
        [SECTIONS.OTHER]: 'bg-gray-50 text-gray-600'
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-in fade-in duration-500 min-h-[400px]">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-800">Documents</h3>
                    {canEdit && onOpenDocumentModal && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onOpenDocumentModal()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                            >
                                <Plus size={16} /> Document (Expiry)
                            </button>
                            <button
                                onClick={() => onOpenDocumentModal()}
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

            {groupedBySection.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30 rounded-3xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 mb-4 opacity-50">
                        <Upload size={32} strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-bold text-gray-500 mb-1">No Documents Found</h4>
                    <p className="text-xs font-medium text-gray-400 text-center max-w-xs">There are no {docStatusTab} documents in this view.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {groupedBySection.map(([section, docs]) => (
                        <div key={section}>{(renderDocTable(docs, section, sectionColors[section] || 'bg-gray-50 text-gray-600'))}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
