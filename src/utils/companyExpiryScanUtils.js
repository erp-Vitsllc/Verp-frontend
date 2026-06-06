/** Live company rows only — excludes renewed / not-renewed / archived copies (mirrors backend). */

export const COMPANY_OWNER_EXPIRY_FIELDS = [
    ['passport', 'Passport'],
    ['visa', 'Visa'],
    ['visitVisa', 'Visit Visa'],
    ['employmentVisa', 'Employment Visa'],
    ['spouseVisa', 'Spouse Visa'],
    ['emiratesId', 'Emirates ID'],
    ['medical', 'Medical Insurance'],
    ['drivingLicense', 'Driving License'],
    ['labourCard', 'Labour Card'],
];

export const isArchivedOrStaleCompanyExpiryRow = (row = {}) => {
    if (!row || typeof row !== 'object') return true;
    if (row.sourceKind === 'oldDocuments') return true;
    if (row.archivedAt || row.isArchived === true) return true;

    const reason = String(row.archiveReason || '').trim().toLowerCase();
    if (reason.includes('replaced') || reason.includes('deleted') || reason.includes('not renew')) {
        return true;
    }

    const t = String(row.type || '').toLowerCase();
    const desc = String(row.description || '').toLowerCase();
    if (t.includes('previous') || desc.includes('previous')) return true;
    if (desc.includes('not renew') || desc.includes('not renewed')) return true;
    if (desc.includes('superseded')) return true;
    return false;
};

const isOwnerHistoryRowInDocuments = (row = {}) => {
    const t = String(row?.type || '').toLowerCase();
    return (
        t.includes(' - passport') ||
        t.includes(' - visa') ||
        t.includes(' - visit visa') ||
        t.includes(' - employment visa') ||
        t.includes(' - spouse visa') ||
        t.includes(' - labour card') ||
        t.includes(' - emirates id') ||
        t.includes(' - medical insurance') ||
        t.includes(' - driving license')
    );
};

const isBasicSystemHistoryRowInDocuments = (row = {}) => {
    const t = String(row?.type || '').toLowerCase();
    return t.includes('trade license') || t.includes('establishment card');
};

const isSyntheticMoaPlaceholderRow = (row = {}) => {
    if (!row || typeof row !== 'object') return false;
    const ctx = String(row?.context || '').toLowerCase();
    const url = String(row?.document?.url || row?.attachment || '').trim();
    return ctx === 'moa' && url === 'partitioned-moa-flag';
};

const shouldSkipDocumentsArrayExpiryRow = (row = {}) => {
    const ctx = String(row?.context || '').toLowerCase();
    if (ctx === 'ejari' || ctx === 'insurance') return true;
    if (ctx === 'document_without_expiry') return true;
    if (isSyntheticMoaPlaceholderRow(row)) return true;
    if (isArchivedOrStaleCompanyExpiryRow(row)) return true;
    if (isOwnerHistoryRowInDocuments(row)) return true;
    if (isBasicSystemHistoryRowInDocuments(row)) return true;
    return false;
};

const hasUsableExpiryDate = (expiryDate) => {
    if (!expiryDate) return false;
    const s = String(expiryDate).trim().toLowerCase();
    return s && !['---', '-', 'n/a', 'na', 'null', 'undefined'].includes(s);
};

export const isCertificateDocumentRow = (row = {}) =>
    String(row?.context || '').toLowerCase() === 'certificate';

export const buildEmployeeManualDocumentExpiryLabel = (row = {}) => {
    if (isCertificateDocumentRow(row)) return buildDocumentsArrayExpiryLabel(row);
    const typeLabel = String(row?.type || '').trim();
    return typeLabel || 'Employee Document';
};

export const buildDocumentsArrayExpiryLabel = (row = {}) => {
    const ctx = String(row?.context || '').toLowerCase();
    const typeLabel = String(row?.type || '').trim() || 'Company Document';
    const tl = typeLabel.toLowerCase();

    if (ctx === 'certificate') return `Certificate — ${typeLabel}`;
    if (ctx === 'moa' || tl.includes('moa') || tl.includes('memorandum')) {
        return tl.includes('moa') || tl.includes('memorandum') ? typeLabel : `MOA — ${typeLabel}`;
    }
    if (ctx === 'memo') return tl.startsWith('memo') ? typeLabel : `Memo — ${typeLabel}`;
    if (ctx === 'document_with_expiry' || tl.includes('with expiry')) {
        return tl.includes('document with expiry') ? typeLabel : `Document with Expiry — ${typeLabel}`;
    }
    return typeLabel;
};

/**
 * All live company documents that can surface HR expiry follow-ups (mirrors backend).
 * Covers: Trade License, Establishment Card, Ejari, Insurance, owner docs,
 * MOA / Memo / Certificate / Document with Expiry in `documents[]`.
 */
export const collectCompanyExpiryDocuments = (company = {}) => {
    const docs = [];
    const companyId = company?._id;

    if (company?.tradeLicenseExpiry) {
        docs.push({
            key: `company:${companyId}:trade-license`,
            label: 'Trade License',
            expiryDate: company.tradeLicenseExpiry,
        });
    }
    if (company?.establishmentCardExpiry) {
        docs.push({
            key: `company:${companyId}:establishment-card`,
            label: 'Establishment Card',
            expiryDate: company.establishmentCardExpiry,
        });
    }

    (company?.documents || []).forEach((d, idx) => {
        if (!hasUsableExpiryDate(d?.expiryDate)) return;
        if (shouldSkipDocumentsArrayExpiryRow(d)) return;
        docs.push({
            key: `company:${companyId}:document:${d?._id || idx}`,
            label: buildDocumentsArrayExpiryLabel(d),
            expiryDate: d.expiryDate,
            isCertificate: isCertificateDocumentRow(d),
        });
    });

    (company?.ejari || []).forEach((ej, idx) => {
        if (!hasUsableExpiryDate(ej?.expiryDate)) return;
        if (isArchivedOrStaleCompanyExpiryRow(ej)) return;
        const subKey = ej?._id != null ? String(ej._id) : `idx-${idx}`;
        docs.push({
            key: `company:${companyId}:ejari:${subKey}`,
            label: ej?.type ? `Ejari — ${ej.type}` : 'Ejari',
            expiryDate: ej.expiryDate,
        });
    });

    (company?.insurance || []).forEach((ins, idx) => {
        if (!hasUsableExpiryDate(ins?.expiryDate)) return;
        if (isArchivedOrStaleCompanyExpiryRow(ins)) return;
        const subKey = ins?._id != null ? String(ins._id) : `idx-${idx}`;
        docs.push({
            key: `company:${companyId}:insurance:${subKey}`,
            label: ins?.type ? `Insurance — ${ins.type}` : 'Insurance',
            expiryDate: ins.expiryDate,
        });
    });

    (company?.owners || []).forEach((owner, ownerIdx) => {
        COMPANY_OWNER_EXPIRY_FIELDS.forEach(([k, lbl]) => {
            const exp = owner?.[k]?.expiryDate;
            if (!hasUsableExpiryDate(exp)) return;
            docs.push({
                key: `company:${companyId}:owner:${ownerIdx}:${k}`,
                label: `${owner?.name || 'Owner'} - ${lbl}`,
                expiryDate: exp,
                ownerIdx,
                ownerDocField: k,
            });
        });
    });

    return docs;
};
