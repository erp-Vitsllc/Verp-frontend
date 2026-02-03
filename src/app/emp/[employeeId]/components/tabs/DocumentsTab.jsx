const CATEGORIES = {
    BASIC: 'Basic Details',
    SALARY: 'Salary',
    PERSONAL: 'Personal Information',
    TRAINING: 'Training',
    FINE: 'Fines',
    REWARD: 'Rewards',
    LOAN: 'Loans & Advances',
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
        if (!doc) return false;
        if (typeof doc === 'string') return doc.startsWith('http') || doc.length > 20;
        return !!(doc.url || doc.data || doc.name);
    };

    // Helper to get document object standard format for viewing
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
            mimeType: doc.mimeType || (() => {
                const n = doc.name || name || 'Document.pdf';
                const ext = n.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                return 'application/pdf';
            })(),
            type: typeOverride || 'Document'
        };
    };

    // Aggregate all documents
    const categorizedDocuments = useMemo(() => {
        if (!employee) return [];
        const docs = [];

        const getCategory = (type, source) => {
            const t = (type || '').toLowerCase();
            const s = (source || '').toLowerCase();
            if (t.includes('training') || s.includes('training')) return CATEGORIES.TRAINING;
            if (t.includes('passport') || t.includes('visa') || t.includes('eid') || t.includes('emirates id') ||
                t.includes('labour') || t.includes('medical') || t.includes('driving') || t.includes('basic')) return CATEGORIES.BASIC;
            if (t.includes('offer') || t.includes('bank') || t.includes('salary') || t.includes('contract') || t.includes('agreement') ||
                t.includes('payslip') || t.includes('increment') || t.includes('bonus') || t.includes('payment') ||
                s.includes('salary') || s.includes('bank') || s.includes('offer')) return CATEGORIES.SALARY;
            if (t.includes('education') || t.includes('experience') || t.includes('certificate') || t.includes('personal') ||
                s.includes('education') || s.includes('experience')) return CATEGORIES.PERSONAL;
            if (t.includes('fine') || s.includes('fine') || t.includes('violation')) return CATEGORIES.FINE;
            if (t.includes('reward') || s.includes('reward') || t.includes('award')) return CATEGORIES.REWARD;
            if (t.includes('loan') || s.includes('loan') || s.includes('advance') || t.includes('advance')) return CATEGORIES.LOAN;
            return CATEGORIES.OTHER;
        };

        // 1. Manual Documents
        if (employee.documents && Array.isArray(employee.documents)) {
            employee.documents.forEach((doc, index) => {
                if (hasDoc(doc.document)) {
                    docs.push({ id: `manual-${index}`, index: index, type: doc.type || 'Document', expiryDate: doc.expiryDate, document: doc.document, isSystem: false, source: 'Manual Upload', category: getCategory(doc.type, 'Manual') });
                }
            });
        }

        // 2. Identity Documents
        if (hasDoc(employee.passportDetails?.document)) docs.push({ id: 'sys-passport', type: 'Passport', expiryDate: employee.passportDetails.expiryDate, document: employee.passportDetails.document, isSystem: true, source: 'System (Passport)', category: CATEGORIES.BASIC });
        if (employee.visaDetails) {
            ['visit', 'employment', 'spouse'].forEach(type => {
                const visa = employee.visaDetails[type];
                if (hasDoc(visa?.document)) docs.push({ id: `sys-visa-${type}`, type: `${type.charAt(0).toUpperCase() + type.slice(1)} Visa`, expiryDate: visa.expiryDate, document: visa.document, isSystem: true, source: 'System (Visa)', category: CATEGORIES.BASIC });
            });
        }
        if (hasDoc(employee.emiratesIdDetails?.document)) docs.push({ id: 'sys-eid', type: 'Emirates ID', expiryDate: employee.emiratesIdDetails.expiryDate, document: employee.emiratesIdDetails.document, isSystem: true, source: 'System (EID)', category: CATEGORIES.BASIC });
        if (hasDoc(employee.labourCardDetails?.document)) docs.push({ id: 'sys-labour', type: 'Labour Card', expiryDate: employee.labourCardDetails.expiryDate, document: employee.labourCardDetails.document, isSystem: true, source: 'System (Labour)', category: CATEGORIES.BASIC });
        if (hasDoc(employee.medicalInsuranceDetails?.document)) docs.push({ id: 'sys-medical', type: 'Medical Insurance', expiryDate: employee.medicalInsuranceDetails.expiryDate, document: employee.medicalInsuranceDetails.document, isSystem: true, source: 'System (Medical)', category: CATEGORIES.BASIC });
        if (hasDoc(employee.drivingLicenceDetails?.document)) docs.push({ id: 'sys-driving', type: 'Driving License', expiryDate: employee.drivingLicenceDetails.expiryDate, document: employee.drivingLicenceDetails.document, isSystem: true, source: 'System (Driving)', category: CATEGORIES.BASIC });

        // 3. Salary & Bank
        if (hasDoc(employee.offerLetter)) docs.push({ id: 'sys-offer-letter-current', type: 'Salary Letter (Current)', expiryDate: null, document: employee.offerLetter, isSystem: true, source: 'System (Salary)', category: CATEGORIES.SALARY });
        if (employee.salaryHistory && Array.isArray(employee.salaryHistory)) {
            employee.salaryHistory.forEach((entry, idx) => {
                const monthName = entry.month || (entry.fromDate ? new Date(entry.fromDate).toLocaleString('default', { month: 'short', year: 'numeric' }) : `Record ${idx + 1}`);
                if (hasDoc(entry.offerLetter)) docs.push({ id: `sys-offer-hist-${idx}`, type: `Salary Letter (${monthName})`, expiryDate: entry.fromDate, document: entry.offerLetter, isSystem: true, source: 'System (Salary History)', category: CATEGORIES.SALARY });
                if (hasDoc(entry.attachment)) docs.push({ id: `sys-salary-attach-hist-${idx}`, type: `Salary Attachment (${monthName})`, expiryDate: entry.fromDate, document: entry.attachment, isSystem: true, source: 'System (Salary History)', category: CATEGORIES.SALARY });
            });
        }
        const bankDoc = employee.bankAccountAttachment || employee.bankAttachment;
        if (hasDoc(bankDoc)) docs.push({ id: 'sys-bank', type: 'Bank Detail Attachment', expiryDate: null, document: bankDoc, isSystem: true, source: 'System (Bank)', category: CATEGORIES.SALARY });

        // 4. Education & Experience
        if (employee.educationDetails && Array.isArray(employee.educationDetails)) {
            employee.educationDetails.forEach((edu, idx) => {
                if (hasDoc(edu.certificate)) docs.push({ id: `sys-edu-${idx}`, type: `Education: ${edu.degree || 'Certificate'}`, expiryDate: edu.completedYear, document: edu.certificate, isSystem: true, source: 'System (Personal)', category: CATEGORIES.PERSONAL });
            });
        }
        if (employee.experienceDetails && Array.isArray(employee.experienceDetails)) {
            employee.experienceDetails.forEach((exp, idx) => {
                if (hasDoc(exp.certificate)) docs.push({ id: `sys-exp-${idx}`, type: `Experience: ${exp.company || 'Certificate'}`, expiryDate: exp.endDate, document: exp.certificate, isSystem: true, source: 'System (Personal)', category: CATEGORIES.PERSONAL });
            });
        }

        // 5. Performance, Loans, Training, Others
        if (employee.fines && Array.isArray(employee.fines)) {
            employee.fines.forEach((fine, idx) => {
                if (hasDoc(fine.attachment)) docs.push({ id: `sys-fine-${idx}`, type: `Fine: ${fine.fineId || 'Doc'}`, expiryDate: fine.createdAt || fine.fineDate, document: fine.attachment, isSystem: true, source: 'System (Fines)', category: CATEGORIES.FINE });
            });
        }
        if (employee.rewards && Array.isArray(employee.rewards)) {
            employee.rewards.forEach((reward, idx) => {
                if (hasDoc(reward.attachment)) docs.push({ id: `sys-reward-${idx}`, type: `Reward: ${reward.rewardId || 'Doc'}`, expiryDate: reward.createdAt || reward.awardedDate, document: reward.attachment, isSystem: true, source: 'System (Rewards)', category: CATEGORIES.REWARD });
            });
        }
        if (employee.loans && Array.isArray(employee.loans)) {
            employee.loans.forEach((loan, idx) => {
                const label = (loan.type === 'Advance' || loan.loanId?.includes('ADV')) ? 'Advance' : 'Loan';
                if (hasDoc(loan.attachment)) docs.push({ id: `sys-loan-${idx}`, type: `${label}: ${loan.loanId || 'Doc'}`, expiryDate: loan.createdAt || loan.appliedDate, document: loan.attachment, isSystem: true, source: 'System (Loans)', category: CATEGORIES.LOAN });
            });
        }
        const allTrainings = [...(employee.trainingDetails || []), ...(employee.trainingDetailsFromTraining || [])];
        allTrainings.forEach((t, idx) => {
            if (hasDoc(t.certificate)) docs.push({ id: `sys-train-${idx}`, type: `Training: ${t.trainingName || 'Cert'}`, expiryDate: t.trainingDate, document: t.certificate, isSystem: true, source: 'System (Training)', category: CATEGORIES.TRAINING });
        });
        if (hasDoc(employee.signature)) docs.push({ id: 'sys-signature', type: 'Digital Signature', expiryDate: employee.signature.signedAt, document: employee.signature, isSystem: true, source: 'System (Profile)', category: CATEGORIES.PERSONAL });
        if (employee.status === 'Notice' && hasDoc(employee.noticeRequest?.attachment)) {
            const docType = employee.noticeRequest?.reason === 'Termination' ? 'Termination Document' : 'Resignation Document';
            docs.push({ id: 'sys-notice', type: docType, expiryDate: employee.noticeRequest.requestedAt, document: employee.noticeRequest.attachment, isSystem: true, source: 'System (Notice)', category: CATEGORIES.OTHER });
        }

        const grouped = {};
        Object.values(CATEGORIES).forEach(cat => {
            const items = docs.filter(d => d.category === cat).sort((a, b) => {
                const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
                const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
                return dateB - dateA;
            });
            if (items.length > 0) grouped[cat] = items;
        });
        return grouped;
    }, [employee]);

    const handleActionDelete = async (idx) => {
        setDeletingIndex(idx);
        try { await onDeleteDocument(idx); } catch (e) { }
        setDeletingIndex(null);
    };

    const safeFormatDate = (date) => {
        if (!date) return '—';
        try {
            if (formatDate) return formatDate(date);
            const d = new Date(date);
            if (isNaN(d.getTime())) return date.toString().substring(0, 10);
            return d.toLocaleDateString();
        } catch (e) { return '—'; }
    };

    // Calculate global Sl. No across categories
    let globalSlNo = 1;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Documents Portfolio</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-100">
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-16">Sl. No.</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Document Name</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Expiry Date</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Attachment</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(categorizedDocuments).length > 0 ? (
                                Object.entries(categorizedDocuments).map(([category, docs]) => (
                                    <Fragment key={category}>
                                        <tr className="bg-gray-50/50">
                                            <td colSpan="5" className="py-2 px-4 text-[11px] font-black text-blue-600 uppercase tracking-widest bg-blue-50/30">
                                                {category}
                                            </td>
                                        </tr>
                                        {docs.map((doc) => {
                                            const currentSlNo = globalSlNo++;
                                            return (
                                                <tr key={doc.id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors group">
                                                    <td className="py-3 px-4 text-sm text-gray-500 font-medium">#{currentSlNo}</td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-800">{doc.type}</span>
                                                            {doc.isSystem && <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">System Record</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-600">{safeFormatDate(doc.expiryDate)}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <button
                                                            onClick={() => onViewDocument(getDocObj(doc.document, doc.type, doc.type))}
                                                            className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-100 rounded-lg transition-all"
                                                            title="View Document"
                                                        >
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                        </button>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-end gap-2 transition-opacity">
                                                            {!doc.isSystem && (isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit')) ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => onEditDocument(doc.index)}
                                                                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                                        title="Edit"
                                                                    >
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleActionDelete(doc.index)}
                                                                        className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
                                                                        title="Delete"
                                                                        disabled={deletingIndex === doc.index}
                                                                    >
                                                                        {deletingIndex === doc.index ? (
                                                                            <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                                                        ) : (
                                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                                        )}
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 italic font-medium px-2 py-1 bg-gray-50 rounded">System Doc</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center text-gray-400 font-medium">
                                        No documents found in this portfolio.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Add Fragment import at the top
import { useMemo, useState, Fragment } from 'react';
