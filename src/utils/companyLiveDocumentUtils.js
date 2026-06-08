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
