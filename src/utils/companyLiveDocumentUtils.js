/** Dropdown-only document types for company live documents (with / without expiry). */
export const COMPANY_LIVE_DOCUMENT_TYPE_OPTIONS = [
    'VAT Certificate',
    'Rental Agreement',
    'Tenancy Contract',
    'Chamber of Commerce Certificate',
    'Civil Defense Certificate',
    'Municipality Approval',
    'Environmental Approval',
    'Power of Attorney',
    'Bank Guarantee',
    'Trade Mark Certificate',
    'Import Export Code',
    'Other Approval',
];

export function buildCompanyLiveDocumentTypeOptions(existingDocuments = [], currentType = '') {
    const opts = [...COMPANY_LIVE_DOCUMENT_TYPE_OPTIONS];
    const add = (value) => {
        const v = String(value || '').trim();
        if (v && !opts.includes(v)) opts.push(v);
    };
    add(currentType);
    for (const doc of Array.isArray(existingDocuments) ? existingDocuments : []) {
        const ctx = String(doc?.context || '').toLowerCase();
        if (ctx === 'document_with_expiry' || ctx === 'document_without_expiry') {
            add(doc.type);
        }
    }
    return opts;
}

export function isLiveCompanyDocForm(modalData, modalType) {
    if (modalType !== 'companyDocument') return false;
    const ctx = String(modalData?.context || '').toLowerCase();
    return !['ejari', 'insurance', 'moa', 'certificate', 'memo'].includes(ctx);
}

export function isLiveCompanyDocContext(context) {
    const ctx = String(context || '').toLowerCase();
    return ctx === 'document_with_expiry' || ctx === 'document_without_expiry';
}

/** HR Certificate tab rows only — live docs like "VAT Certificate" are not certificate-tab records. */
export function isCompanyCertificateDocument(doc) {
    if (!doc || typeof doc !== 'object') return false;
    const ctx = String(doc?.context || '').toLowerCase();
    if (isLiveCompanyDocContext(ctx)) return false;
    return ctx === 'certificate';
}
