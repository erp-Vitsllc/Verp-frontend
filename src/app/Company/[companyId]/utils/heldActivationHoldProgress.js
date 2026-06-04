/** Mirror backend hold-row label detection for red/green UI. */

const hasAnyKey = (obj, keys) =>
    obj && typeof obj === 'object' && keys.some((k) => Object.prototype.hasOwnProperty.call(obj, k));

const HR_QUEUE_LABELS = new Set([
    'basic details',
    'trade license',
    'establishment card',
    'moa',
    'owner passport',
    'owner emirates id',
]);

function labelsFromProposed(proposed) {
    const pd = proposed && typeof proposed === 'object' ? proposed : null;
    if (!pd) return [];
    const labels = [];
    if (hasAnyKey(pd, ['name', 'nickName', 'email', 'phone', 'establishedDate', 'companyId'])) {
        labels.push('Basic Details');
    }
    if (
        hasAnyKey(pd, [
            'tradeLicenseNumber',
            'tradeLicenseIssueDate',
            'tradeLicenseExpiry',
            'tradeLicenseAttachment',
            'tradeLicenseOwnerName',
        ]) ||
        (Array.isArray(pd.owners) && pd.owners.length > 0)
    ) {
        labels.push('Trade License');
    }
    if (
        hasAnyKey(pd, [
            'establishmentCardNumber',
            'establishmentCardIssueDate',
            'establishmentCardExpiry',
            'establishmentCardAttachment',
        ])
    ) {
        labels.push('Establishment Card');
    }
    if (Array.isArray(pd.documents) && pd.documents.some((d) => String(d?.type || '').toLowerCase().includes('moa'))) {
        labels.push('MOA');
    }
    if (Array.isArray(pd.owners) && pd.owners.some((o) => o?.passport)) labels.push('Owner Passport');
    if (Array.isArray(pd.owners) && pd.owners.some((o) => o?.emiratesId)) labels.push('Owner Emirates ID');
    return labels.filter((l) => HR_QUEUE_LABELS.has(l.toLowerCase()));
}

export function labelsRequiredForHoldEntry(entry) {
    const fromPd = labelsFromProposed(entry?.proposedData);
    if (fromPd.length) return fromPd;
    return String(entry?.card || '')
        .split(',')
        .map((s) => s.replace(/\([^)]*\)/g, '').trim())
        .filter(Boolean);
}

export function isCompanyHoldRowResolved(rowId, entry, hold) {
    const id = String(rowId);
    const resolvedIds = (hold?.resolvedEntryIds || []).map(String);
    if (resolvedIds.includes(id)) return true;
    if (!entry) return true;

    const needed = labelsRequiredForHoldEntry(entry);
    const addressed = hold?.addressedLabelsByEntryId?.[id];
    if (!needed.length || !Array.isArray(addressed) || addressed.length === 0) return false;

    const addressedNorm = new Set(addressed.map((x) => String(x || '').toLowerCase().trim()));
    return needed.every((label) => addressedNorm.has(String(label || '').toLowerCase().trim()));
}
