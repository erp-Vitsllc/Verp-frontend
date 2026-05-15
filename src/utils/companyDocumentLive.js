/** Live company document row (in `documents[]`, not archived to Old). */

export const isArchivedCompanyDocumentRow = (d) => {
    if (!d || typeof d !== 'object') return false;
    const t = String(d?.type || '').toLowerCase();
    const desc = String(d?.description || '').toLowerCase();
    if (t.includes('previous')) return true;
    if (desc.includes('not renewed')) return true;
    if (d?.archivedAt) return true;
    if (String(d?.archiveReason || '').toLowerCase().includes('not renew')) return true;
    return false;
};

export const isLiveCompanyDocumentRow = (d) => !isArchivedCompanyDocumentRow(d);

/** MOA identity (context from Add MOA, or legacy type text). */
export const documentIsMoaKind = (d) => {
    if (!d || typeof d !== 'object') return false;
    const ctx = String(d?.context || '').toLowerCase();
    if (ctx === 'moa') return true;
    const t = String(d?.type || '').toLowerCase();
    return t.includes('moa');
};

/** MOA that counts toward activation / Live Documents (not archived). */
export const hasLiveMoaInDocuments = (documents) => {
    const list = Array.isArray(documents) ? documents : [];
    return list.some((d) => {
        if (!isLiveCompanyDocumentRow(d)) return false;
        const url = d?.document?.url || d?.attachment;
        if (!url || !String(url).trim()) return false;
        return documentIsMoaKind(d);
    });
};

/** MOA row for Live vs Old document tabs. */
export const isMoaForDocumentTab = (d, { isLiveView, isOldView, sourceKind }) => {
    if (!documentIsMoaKind(d)) return false;
    if (isLiveView) {
        return sourceKind === 'documents' && isLiveCompanyDocumentRow(d);
    }
    if (isOldView) {
        return sourceKind === 'oldDocuments' || isArchivedCompanyDocumentRow(d);
    }
    return false;
};
