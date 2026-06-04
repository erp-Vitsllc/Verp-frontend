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

const OWNER_NESTED_DOC_KEYS = [
    'passport',
    'emiratesId',
    'visa',
    'visitVisa',
    'employmentVisa',
    'spouseVisa',
    'labourCard',
    'medical',
    'drivingLicense',
];

const mergeOwnerRow = (base = {}, patch = {}) => {
    if (!patch || typeof patch !== 'object') return { ...base };
    const out = { ...base };
    for (const k of Object.keys(patch)) {
        if (OWNER_NESTED_DOC_KEYS.includes(k)) continue;
        if (patch[k] !== undefined) out[k] = patch[k];
    }
    for (const docKey of OWNER_NESTED_DOC_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(patch, docKey)) continue;
        if (patch[docKey] == null) {
            delete out[docKey];
            continue;
        }
        if (typeof patch[docKey] === 'object') {
            out[docKey] =
                typeof base?.[docKey] === 'object' && base[docKey] !== null
                    ? { ...base[docKey], ...patch[docKey] }
                    : { ...patch[docKey] };
        } else {
            out[docKey] = patch[docKey];
        }
    }
    return out;
};

/** Merge owner rows so Passport + EID (and other doc cards) on the same owner are not lost. */
export const mergeCompanyOwnersSnapshot = (baseOwners = [], patchOwners = []) => {
    if (!Array.isArray(patchOwners) || patchOwners.length === 0) {
        return Array.isArray(baseOwners) ? baseOwners : [];
    }
    if (!Array.isArray(baseOwners) || baseOwners.length === 0) {
        return patchOwners.map((o) => ({ ...o }));
    }

    const result = baseOwners.map((base, i) => {
        const patch =
            patchOwners.find(
                (p) =>
                    base?._id != null &&
                    p?._id != null &&
                    String(p._id) === String(base._id),
            ) ?? patchOwners[i];
        if (!patch) return { ...base };
        return mergeOwnerRow(base, patch);
    });

    patchOwners.forEach((patch, i) => {
        const id = patch?._id;
        if (id != null && baseOwners.some((b) => String(b?._id) === String(id))) return;
        if (id == null && baseOwners[i]) return;
        result.push({ ...patch });
    });

    return result;
};

const overlayProposedFields = (base, proposed) => {
    if (!proposed || typeof proposed !== 'object') return base;
    const out = { ...base };
    for (const k of ACTIVATION_PROGRESS_OVERLAY_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(proposed, k)) continue;
        if (k === 'owners' && Array.isArray(proposed.owners)) {
            out.owners = mergeCompanyOwnersSnapshot(out.owners || [], proposed.owners);
        } else {
            out[k] = proposed[k];
        }
    }
    return out;
};

/** Match backend: overlay queued patches when company status is Active (includes submitted review). */
export const shouldOverlayPendingReactivationChanges = (company) =>
    String(company?.status || '').toLowerCase() === 'active';

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

/** Queued owner basic-details row (name, email, phone, share, etc.). */
export const pendingReactivationEntryTouchesOwnerDetails = (entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry?.card || entry?.reason || '').toLowerCase();
    if (card.includes('owner details')) return true;
    const proposedOwners = entry?.proposedData?.owners;
    if (!Array.isArray(proposedOwners) || proposedOwners.length === 0) return false;
    return proposedOwners.some((row) => {
        if (!row || typeof row !== 'object') return false;
        const keys = ['name', 'email', 'phone', 'phoneCountryCode', 'nationality', 'sharePercentage'];
        return keys.some((k) => Object.prototype.hasOwnProperty.call(row, k));
    });
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
