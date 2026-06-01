/**
 * Fields that affect `calculateCompanyActivationProgress` on the backend.
 * When a change is queued in `pendingReactivationChanges`, the live company
 * document may not yet include it — merge proposed patches so progress can reach 100%.
 */
const ACTIVATION_PROGRESS_OVERLAY_KEYS = [
    'name',
    'nickName',
    'companyId',
    'email',
    'phone',
    'establishedDate',
    'tradeLicenseNumber',
    'tradeLicenseIssueDate',
    'tradeLicenseExpiry',
    'tradeLicenseAttachment',
    'establishmentCardNumber',
    'establishmentCardIssueDate',
    'establishmentCardExpiry',
    'establishmentCardAttachment',
    'documents',
    'owners',
];

const overlayProposedFields = (base, proposed) => {
    if (!proposed || typeof proposed !== 'object') return base;
    const out = { ...base };
    for (const k of ACTIVATION_PROGRESS_OVERLAY_KEYS) {
        if (Object.prototype.hasOwnProperty.call(proposed, k)) {
            out[k] = proposed[k];
        }
    }
    return out;
};

/** Match backend: pending queue applies only when company is fully activated. */
export const shouldOverlayPendingReactivationChanges = (company) => {
    const status = String(company?.status || '').toLowerCase();
    const activationStatus = String(company?.activationStatus || '').toLowerCase();
    return status === 'active' && activationStatus === 'active';
};

export const mergePendingReactivationForActivationSnapshot = (company) => {
    if (!company || typeof company !== 'object') return {};
    const co = { ...company };
    if (!shouldOverlayPendingReactivationChanges(co)) {
        return { ...co };
    }
    const pending = Array.isArray(co.pendingReactivationChanges) ? co.pendingReactivationChanges : [];
    let merged = { ...co };
    for (const entry of pending) {
        merged = overlayProposedFields(merged, entry?.proposedData);
    }
    return merged;
};

const normalizeOwnerDocKey = (docKey) => {
    const k = String(docKey || '').toLowerCase();
    if (k === 'passport') return 'passport';
    if (k === 'emiratesid' || k === 'emirates_id') return 'emiratesId';
    return k;
};

/** True when a queued entry includes an owner passport or Emirates ID change (by card label or owners patch). */
export const pendingReactivationEntryTouchesOwnerDoc = (entry, docKey) => {
    if (!entry || typeof entry !== 'object') return false;
    const key = normalizeOwnerDocKey(docKey);
    const card = String(entry?.card || entry?.reason || '').toLowerCase();
    if (key === 'passport' && card.includes('passport')) return true;
    if (key === 'emiratesId' && card.includes('emirates')) return true;
    const proposedOwners = entry?.proposedData?.owners;
    if (!Array.isArray(proposedOwners) || proposedOwners.length === 0) return false;
    return proposedOwners.some((row) => {
        if (key === 'passport' && row?.passport && typeof row.passport === 'object') return true;
        if (key === 'emiratesId' && row?.emiratesId && typeof row.emiratesId === 'object') return true;
        return false;
    });
};

export const companyHasPendingOwnerDocHrQueue = (company, docKey) => {
    const pending = Array.isArray(company?.pendingReactivationChanges)
        ? company.pendingReactivationChanges
        : [];
    return pending.some((entry) => pendingReactivationEntryTouchesOwnerDoc(entry, docKey));
};
