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

/** Passport / EID stay on live data until HR approves — do not overlay queued drafts. */
const SKIP_OVERLAY_OWNER_DOC_KEYS = new Set(['passport', 'emiratesId']);

const mergeOwnerRow = (base = {}, patch = {}, { skipHrQueuedOwnerDocs = false } = {}) => {
    if (!patch || typeof patch !== 'object') return { ...base };
    const out = { ...base };
    for (const k of Object.keys(patch)) {
        if (OWNER_NESTED_DOC_KEYS.includes(k)) continue;
        if (patch[k] !== undefined) out[k] = patch[k];
    }
    for (const docKey of OWNER_NESTED_DOC_KEYS) {
        if (skipHrQueuedOwnerDocs && SKIP_OVERLAY_OWNER_DOC_KEYS.has(docKey)) continue;
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
export const mergeCompanyOwnersSnapshot = (baseOwners = [], patchOwners = [], options = {}) => {
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
        return mergeOwnerRow(base, patch, options);
    });

    patchOwners.forEach((patch, i) => {
        const id = patch?._id;
        if (id != null && baseOwners.some((b) => String(b?._id) === String(id))) return;
        if (id == null && baseOwners[i]) return;
        result.push({ ...patch });
    });

    return result;
};

const collectViewerIdentityIds = (viewer) => {
    if (!viewer || typeof viewer !== 'object') return [];
    const ids = [viewer._id, viewer.id, viewer.employeeObjectId, viewer.empObjectId, viewer.linkedEmployee]
        .map((v) => String(v ?? '').trim().toLowerCase())
        .filter(Boolean);
    return [...new Set(ids)];
};

const viewerOwnsPendingEntry = (entry, viewer) => {
    if (!entry || !viewer || typeof viewer !== 'object') return false;
    const queuedIds = [entry.queuedByUserId, entry.queuedByEmployeeObjectId]
        .map((v) => String(v ?? '').trim().toLowerCase())
        .filter(Boolean);
    const queuedEmpCode = String(entry?.queuedByEmployeeId ?? '')
        .toLowerCase()
        .replace(/\s+/g, '');
    if (!queuedIds.length && !queuedEmpCode) return false;
    const viewerIds = collectViewerIdentityIds(viewer);
    if (queuedIds.some((id) => viewerIds.includes(id))) return true;
    const viewerEmpCode = String(viewer?.employeeId ?? '')
        .toLowerCase()
        .replace(/\s+/g, '');
    return Boolean(queuedEmpCode && viewerEmpCode && queuedEmpCode === viewerEmpCode);
};

const overlayProposedFields = (base, proposed, { skipHrQueuedOwnerDocs = false } = {}) => {
    if (!proposed || typeof proposed !== 'object') return base;
    const out = { ...base };
    for (const k of ACTIVATION_PROGRESS_OVERLAY_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(proposed, k)) continue;
        if (k === 'owners' && Array.isArray(proposed.owners)) {
            out.owners = mergeCompanyOwnersSnapshot(out.owners || [], proposed.owners, {
                skipHrQueuedOwnerDocs,
            });
        } else {
            out[k] = proposed[k];
        }
    }
    return out;
};

/** Match backend: overlay queued patches when company status is Active (includes submitted review). */
export const shouldOverlayPendingReactivationChanges = (company) =>
    String(company?.status || '').toLowerCase() === 'active';

/**
 * @param {object} company
 * @param {{ viewer?: object, includeAllQueuedOwnerDocs?: boolean }} [options]
 *   - viewer: show queued passport/EID to the employee who saved them
 *   - includeAllQueuedOwnerDocs: progress bars — count all queued owner docs
 */
export const mergePendingReactivationForActivationSnapshot = (company, options = {}) => {
    if (!company || typeof company !== 'object') return {};
    const { viewer = null, includeAllQueuedOwnerDocs = false } = options;
    const co = { ...company };
    if (!shouldOverlayPendingReactivationChanges(co)) {
        return { ...co };
    }
    const pending = Array.isArray(co.pendingReactivationChanges) ? co.pendingReactivationChanges : [];
    let merged = { ...co };
    for (const entry of pending) {
        const showQueuedOwnerDocs =
            includeAllQueuedOwnerDocs || viewerOwnsPendingEntry(entry, viewer);
        merged = overlayProposedFields(merged, entry?.proposedData, {
            skipHrQueuedOwnerDocs: !showQueuedOwnerDocs,
        });
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
    if (
        card.includes('trade license') ||
        card.includes('establishment card') ||
        card.includes('moa') ||
        card.includes('owner passport') ||
        card.includes('owner emirates')
    ) {
        return false;
    }
    if (card.includes('owner details')) return true;
    const proposedOwners = entry?.proposedData?.owners;
    if (!Array.isArray(proposedOwners) || proposedOwners.length === 0) return false;
    const basicKeys = ['name', 'email', 'phone', 'phoneCountryCode', 'nationality', 'sharePercentage'];
    return proposedOwners.some((row) => {
        if (!row || typeof row !== 'object') return false;
        // Passport / EID queue slices attach owner name for HR review — not Owner Details edits.
        if (row.passport || row.emiratesId) return false;
        return basicKeys.some((k) => Object.prototype.hasOwnProperty.call(row, k));
    });
};

/** True only for explicit Owner Passport / Owner Emirates ID queue cards. */
export const pendingReactivationEntryTouchesOwnerDoc = (entry, docKey) => {
    if (!entry || typeof entry !== 'object') return false;
    const key = normalizeOwnerDocKey(docKey);
    const card = String(entry?.card || entry?.reason || '').toLowerCase();
    if (key === 'passport') return card.includes('owner passport') && !card.includes('emirates');
    if (key === 'emiratesId') return card.includes('owner emirates') || card.includes('emirates id');
    return false;
};

export const companyHasPendingOwnerDocHrQueue = (company, docKey) => {
    const key = normalizeOwnerDocKey(docKey);
    if (key !== 'passport' && key !== 'emiratesId') return false;
    const pending = Array.isArray(company?.pendingReactivationChanges)
        ? company.pendingReactivationChanges
        : [];
    return pending.some((entry) => pendingReactivationEntryTouchesOwnerDoc(entry, docKey));
};
