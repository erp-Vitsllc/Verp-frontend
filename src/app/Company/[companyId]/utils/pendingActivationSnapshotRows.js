/**
 * Shared helpers for HR / employee previews of pending company activation rows.
 */

export function toSerializable(value) {
    if (value == null) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
}

export function isEffectivelyEmptyObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).length === 0;
}

/** Resolves prior or proposed payload from a pendingReactivationChanges entry. */
export function resolveActivationSnapshot(entry, kind = 'proposed') {
    if (!entry || typeof entry !== 'object') return {};
    const candidates =
        kind === 'previous'
            ? [entry.previousData, entry.previous, entry.oldData, entry.fromData]
            : [entry.proposedData, entry.proposed, entry.newData, entry.toData, entry.payload];
    for (const candidate of candidates) {
        const serial = toSerializable(candidate);
        if (serial == null) continue;
        if (typeof serial === 'object') {
            if (!isEffectivelyEmptyObject(serial) || Array.isArray(serial)) return serial;
        } else {
            return serial;
        }
    }
    return {};
}

export function toLabel(key = '') {
    return String(key)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function toDisplayValue(value) {
    if (value == null || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}t/i.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
        }
        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value.length > 90 ? `${value.slice(0, 90)}...` : value;
        }
        return value;
    }
    return JSON.stringify(value);
}

export function getFileNameFromRef(value) {
    if (!value) return '-';
    if (typeof value === 'string') {
        const clean = value.split('?')[0];
        const last = clean.split('/').filter(Boolean).pop();
        return last || clean;
    }
    if (typeof value === 'object') {
        if (value.name) return value.name;
        if (value.url) return getFileNameFromRef(value.url);
    }
    return '-';
}

export function resolveAttachmentUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.startsWith('http') ? trimmed : '';
    }
    if (typeof value === 'object') {
        const url = value.url || value.publicId || '';
        return typeof url === 'string' && url.startsWith('http') ? url : '';
    }
    return '';
}

export const TRADE_LICENSE_FIELD_KEYS = [
    'tradeLicenseNumber',
    'tradeLicenseIssueDate',
    'tradeLicenseExpiry',
    'tradeLicenseAttachment',
    'tradeLicenseOwnerName',
];

const ESTABLISHMENT_CARD_FIELD_KEYS = [
    'establishmentCardNumber',
    'establishmentCardIssueDate',
    'establishmentCardExpiry',
    'establishmentCardAttachment',
];

const BASIC_DETAILS_FIELD_KEYS = [
    'name',
    'nickName',
    'email',
    'phone',
    'establishedDate',
    'companyId',
    'address',
    'country',
    'state',
    'city',
    'postalCode',
];

function pickCompanyFieldSlice(company = {}, keys = []) {
    const out = {};
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(company, key)) {
            out[key] = company[key];
        }
    }
    return out;
}

/** True when a queued entry is a Trade License card (not owner passport / EID, etc.). */
export function isTradeLicensePendingEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry.card || entry.reason || '').toLowerCase();
    if (
        card.includes('owner passport') ||
        card.includes('owner emirates') ||
        card.includes('owner details')
    ) {
        return false;
    }
    if (card.includes('trade license')) return true;
    const proposed = resolveActivationSnapshot(entry, 'proposed');
    return TRADE_LICENSE_FIELD_KEYS.some((key) =>
        Object.prototype.hasOwnProperty.call(proposed, key),
    );
}

export function isEstablishmentCardPendingEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry.card || entry.reason || '').toLowerCase();
    if (card.includes('establishment card')) return true;
    const proposed = resolveActivationSnapshot(entry, 'proposed');
    return ESTABLISHMENT_CARD_FIELD_KEYS.some((key) =>
        Object.prototype.hasOwnProperty.call(proposed, key),
    );
}

export function isBasicDetailsPendingEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry.card || entry.reason || '').toLowerCase();
    if (card.includes('basic details')) return true;
    const proposed = resolveActivationSnapshot(entry, 'proposed');
    return BASIC_DETAILS_FIELD_KEYS.some((key) =>
        Object.prototype.hasOwnProperty.call(proposed, key),
    );
}

export function isOwnerDetailsPendingEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry.card || entry.reason || '').toLowerCase();
    return card.includes('owner details');
}

export function isOwnerPassportPendingEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry.card || entry.reason || '').toLowerCase();
    return card.includes('owner passport') && !card.includes('emirates');
}

export function isOwnerEmiratesIdPendingEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry.card || entry.reason || '').toLowerCase();
    return card.includes('owner emirates') || card.includes('emirates id');
}

export function isOwnerScopedPendingEntry(entry) {
    return (
        isOwnerPassportPendingEntry(entry) ||
        isOwnerEmiratesIdPendingEntry(entry) ||
        isOwnerDetailsPendingEntry(entry)
    );
}

export function findOwnerInOwnersList(owners = [], ref = {}, fallbackIndex = 0) {
    const list = Array.isArray(owners) ? owners : [];
    const refId = ref?._id ?? ref?.id;
    if (refId != null) {
        const match = list.find((o) => String(o?._id ?? o?.id) === String(refId));
        if (match) return match;
    }
    const profileId = ref?.ownerProfileId;
    if (profileId) {
        const match = list.find((o) => String(o?.ownerProfileId) === String(profileId));
        if (match) return match;
    }
    return list[fallbackIndex] || null;
}

/** One Submit-pending row per owner (passport / EID / basic details). */
export function slicePendingEntryForOwner(entry, owner, ownerIndex = 0) {
    if (!entry || typeof entry !== 'object') return entry;
    const filterOwners = (list) => {
        if (!Array.isArray(list)) return [];
        const match = findOwnerInOwnersList(list, owner, ownerIndex);
        return match ? [{ ...match }] : [];
    };
    const proposed = entry.proposedData && typeof entry.proposedData === 'object' ? entry.proposedData : {};
    const previous = entry.previousData && typeof entry.previousData === 'object' ? entry.previousData : {};
    const ownerName = String(owner?.name || '').trim() || `Owner ${ownerIndex + 1}`;
    const ownerId = String(owner?._id ?? owner?.id ?? ownerIndex);
    return {
        ...entry,
        proposedData: { ...proposed, owners: filterOwners(proposed.owners) },
        previousData: { ...previous, owners: filterOwners(previous.owners) },
        ownerScope: { ownerId, ownerIndex, ownerName },
    };
}

export function splitPendingEntryByOwners(entry) {
    if (!isOwnerScopedPendingEntry(entry)) return [entry];
    const proposedOwners = Array.isArray(entry?.proposedData?.owners) ? entry.proposedData.owners : [];
    const previousOwners = Array.isArray(entry?.previousData?.owners) ? entry.previousData.owners : [];
    const sourceOwners = proposedOwners.length > 0 ? proposedOwners : previousOwners;
    if (sourceOwners.length === 0) return [entry];
    return sourceOwners.map((owner, index) => slicePendingEntryForOwner(entry, owner, index));
}

/** Split comma-separated card labels, then one row per owner for owner HR cards. */
export function expandPendingEntriesForDisplay(entry) {
    const rawCard = String(entry?.card || '').trim() || 'Company Profile';
    const cardParts = rawCard
        .split(',')
        .map((s) => s.replace(/\s*\([^)]*\)\s*$/g, '').trim())
        .filter(Boolean);
    const baseEntries =
        cardParts.length <= 1
            ? [{ ...entry, card: rawCard }]
            : cardParts.map((label) => ({ ...entry, card: label }));
    return baseEntries.flatMap((e) => splitPendingEntryByOwners(e));
}

export function pendingOwnerDisplayLabel(entry, cardLabel = '', changeType = '') {
    const ownerName = entry?.ownerScope?.ownerName;
    const card = String(cardLabel || entry?.card || 'Company Profile').trim();
    const ct = String(changeType || entry?.changeType || '').trim();
    const base = ownerName ? `${ownerName} — ${card}` : card;
    return ct ? `${base} (${ct})` : base;
}

const normalizeSubmittedCardLabel = (label) =>
    String(label || '')
        .toLowerCase()
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim();

/** True when a pending row belongs to cards named in this HR submission (e.g. only Trade License). */
export function pendingEntryIncludedInSubmittedCards(entry, submittedCardLabels = []) {
    if (!entry || typeof entry !== 'object') return false;
    if (!Array.isArray(submittedCardLabels) || submittedCardLabels.length === 0) return true;
    const submitted = new Set(submittedCardLabels.map(normalizeSubmittedCardLabel).filter(Boolean));
    if (!submitted.size) return true;
    const rawCard = String(entry?.card || entry?.reason || '').trim();
    const parts = rawCard
        .split(',')
        .map((s) => normalizeSubmittedCardLabel(s))
        .filter(Boolean);
    if (!parts.length) return false;
    return parts.some((part) => submitted.has(part));
}

export function buildCompanyPendingDisplayGroups(changes = []) {
    const byKey = new Map();
    for (const entry of changes) {
        for (const displayEntry of expandPendingEntriesForDisplay(entry)) {
            const key = pendingOwnerDisplayGroupKey(displayEntry);
            if (!byKey.has(key)) {
                byKey.set(key, { key, ids: [], entries: [] });
            }
            const g = byKey.get(key);
            g.ids.push(displayEntry._id);
            g.entries.push(displayEntry);
        }
    }
    const groups = [...byKey.values()].map((g) => {
        const sorted = [...g.entries].sort(
            (a, b) => new Date(b?.changedAt || 0) - new Date(a?.changedAt || 0),
        );
        const rep = sorted[0];
        const n = g.ids.length;
        const editHint = n > 1 ? ` · ${n} edits` : '';
        const baseLabel = pendingOwnerDisplayLabel(rep);
        return {
            ...g,
            representativeEntry: rep,
            displayLabel: `${baseLabel}${editHint}`,
            sortTime: Math.min(
                ...g.entries.map((e) => {
                    const t = new Date(e?.changedAt || 0).getTime();
                    return Number.isNaN(t) ? Infinity : t;
                }),
            ),
        };
    });
    groups.sort((a, b) => a.sortTime - b.sortTime);
    return groups;
}

export function pendingOwnerDisplayGroupKey(entry, section = '', changeType = '') {
    const sec = String(section || entry?.section || 'companyprofile').toLowerCase().trim();
    const ct = String(changeType || entry?.changeType || '').toLowerCase().trim();
    const cardSlug = String(entry?.card || 'company-profile').trim().toLowerCase();
    const ownerKey = entry?.ownerScope?.ownerId ? `owner:${entry.ownerScope.ownerId}` : 'owner:0';
    return `${sec}::${cardSlug}::${ownerKey}::${ct}`;
}

const OWNER_NESTED_DOC_KEYS = [
    'passport',
    'emiratesId',
    'visitVisa',
    'employmentVisa',
    'spouseVisa',
    'labourCard',
    'medical',
    'drivingLicense',
    'visa',
];

function stripOwnerNestedDocs(owner = {}) {
    const out = { ...owner };
    for (const k of OWNER_NESTED_DOC_KEYS) delete out[k];
    return out;
}

/** Owner Details HR queue: name, contact, share — not passport / EID sub-cards. */
export function buildOwnerBasicDetailsSnapshotRows(owners = []) {
    if (!Array.isArray(owners) || owners.length === 0) return [];
    const rows = [];
    const singleOwner = owners.length === 1;
    owners.forEach((owner, index) => {
        if (!owner || typeof owner !== 'object') return;
        const basic = stripOwnerNestedDocs(owner);
        const suffix = owners.length > 1 ? ` #${index + 1}` : '';
        const prefix = `Owner${suffix}`;
        const push = (label, value) => {
            if (value === undefined || value === null || value === '') return;
            const rowLabel = singleOwner ? label : `${prefix} — ${label}`;
            rows.push({ label: rowLabel, value: toDisplayValue(value) });
        };
        push('Name', basic.name);
        push('Owner ID', basic.ownerProfileId || basic.ownerId);
        if (basic.sharePercentage !== undefined && basic.sharePercentage !== null && basic.sharePercentage !== '') {
            const share = String(basic.sharePercentage).trim();
            push('Share %', share.endsWith('%') ? share : `${share}%`);
        }
        push('Email', basic.email);
        push('Phone', basic.phone);
        push('Nationality', basic.nationality);
    });
    return rows;
}

function buildOwnerDocCardSnapshotRows(owners = [], docKey, docLabel) {
    if (!Array.isArray(owners) || owners.length === 0) return [];
    const rows = [];
    const singleOwner = owners.length === 1;
    owners.forEach((owner, index) => {
        if (!owner || typeof owner !== 'object') return;
        const doc = owner[docKey];
        if (!doc || typeof doc !== 'object') return;
        const suffix = owners.length > 1 ? ` #${index + 1}` : '';
        const prefix = `Owner${suffix}`;
        const push = (label, value) => {
            if (value === undefined || value === null || value === '') return;
            const rowLabel = singleOwner ? label : `${prefix} — ${label}`;
            rows.push({ label: rowLabel, value: toDisplayValue(value) });
        };
        if (!singleOwner) {
            push('Name', owner.name);
        }
        push(`${docLabel} number`, doc.number);
        if (docKey === 'passport') {
            push('Nationality', doc.nationality);
            push('Country of issue', doc.countryOfIssue);
        }
        push('Issue date', doc.issueDate);
        push('Expiry date', doc.expiryDate);
        if (doc.attachment) {
            const attachLabel = singleOwner ? `${docLabel} attachment` : `${prefix} — ${docLabel} attachment`;
            pushAttachmentRow(rows, attachLabel, doc.attachment, `${docKey}Attachment`, new Set());
        }
    });
    return rows;
}

export function buildOwnerPassportSnapshotRows(data = {}) {
    const owners = Array.isArray(data.owners) ? data.owners : [];
    return buildOwnerDocCardSnapshotRows(owners, 'passport', 'Passport');
}

export function buildOwnerEmiratesIdSnapshotRows(data = {}) {
    const owners = Array.isArray(data.owners) ? data.owners : [];
    return buildOwnerDocCardSnapshotRows(owners, 'emiratesId', 'Emirates ID');
}

function resolveOwnerDocCardReviewData(entry, kind, live, docKey) {
    const proposedSnap = resolveActivationSnapshot(entry, 'proposed');
    const scopedProposed = Array.isArray(proposedSnap.owners) ? proposedSnap.owners : [];
    const ownerRef = scopedProposed[0] || {};
    const ownerIndex = entry?.ownerScope?.ownerIndex ?? 0;
    const liveOwners = Array.isArray(live?.owners) ? live.owners : [];
    const liveOwner = findOwnerInOwnersList(liveOwners, ownerRef, ownerIndex);

    if (kind === 'previous') {
        if (!liveOwner) return { owners: [] };
        const row = { name: liveOwner.name };
        if (liveOwner[docKey] && typeof liveOwner[docKey] === 'object') {
            row[docKey] = liveOwner[docKey];
        }
        return { owners: [row] };
    }

    if (scopedProposed.length > 0) {
        return { owners: scopedProposed };
    }
    return proposedSnap;
}

/**
 * Merge live company values with queued previous/proposed PATCH so HR sees the full card,
 * not only the fields that changed (e.g. Trade License number + dates + attachment).
 */
export function resolveFullCardReviewData(entry, kind = 'proposed', liveCompany = {}) {
    const previous = resolveActivationSnapshot(entry, 'previous');
    const proposed = resolveActivationSnapshot(entry, 'proposed');
    const live = liveCompany && typeof liveCompany === 'object' ? liveCompany : {};
    const overlay = kind === 'proposed' ? proposed : previous;

    if (isTradeLicensePendingEntry(entry)) {
        const base = pickCompanyFieldSlice(live, TRADE_LICENSE_FIELD_KEYS);
        if (Array.isArray(live.owners)) base.owners = live.owners;
        return { ...base, ...overlay };
    }
    if (isEstablishmentCardPendingEntry(entry)) {
        return { ...pickCompanyFieldSlice(live, ESTABLISHMENT_CARD_FIELD_KEYS), ...overlay };
    }
    if (isBasicDetailsPendingEntry(entry)) {
        return { ...pickCompanyFieldSlice(live, BASIC_DETAILS_FIELD_KEYS), ...overlay };
    }
    if (isOwnerPassportPendingEntry(entry)) {
        return resolveOwnerDocCardReviewData(entry, kind, live, 'passport');
    }
    if (isOwnerEmiratesIdPendingEntry(entry)) {
        return resolveOwnerDocCardReviewData(entry, kind, live, 'emiratesId');
    }
    if (isOwnerDetailsPendingEntry(entry)) {
        const proposedSnap = resolveActivationSnapshot(entry, 'proposed');
        const scopedProposed = Array.isArray(proposedSnap.owners) ? proposedSnap.owners : [];
        const ownerRef = scopedProposed[0] || {};
        const ownerIndex = entry?.ownerScope?.ownerIndex ?? 0;
        const liveOwners = Array.isArray(live?.owners) ? live.owners : [];

        if (kind === 'previous') {
            const liveOwner = findOwnerInOwnersList(liveOwners, ownerRef, ownerIndex);
            if (!liveOwner) return { owners: [] };
            return { owners: [stripOwnerNestedDocs(liveOwner)] };
        }
        if (scopedProposed.length > 0) {
            return { owners: scopedProposed.map((o) => stripOwnerNestedDocs(o)) };
        }
        const merged = { ...overlay };
        if (Array.isArray(merged.owners)) {
            merged.owners = merged.owners.map((o) => stripOwnerNestedDocs(o));
        }
        return merged;
    }

    if (kind === 'proposed') return { ...live, ...proposed };
    return { ...live, ...previous };
}

const OWNER_NESTED_DOC_LABELS = [
    ['Passport', 'passport'],
    ['Emirates ID', 'emiratesId'],
    ['Visit Visa', 'visitVisa'],
    ['Employment Visa', 'employmentVisa'],
    ['Spouse Visa', 'spouseVisa'],
    ['Labour Card', 'labourCard'],
    ['Medical Insurance', 'medical'],
    ['Driving License', 'drivingLicense'],
];

/** Expand owner rows for pending / HR review tables. */
export function buildOwnerSnapshotRows(owners = []) {
    if (!Array.isArray(owners) || owners.length === 0) return [];
    const rows = [];
    owners.forEach((owner, index) => {
        if (!owner || typeof owner !== 'object') return;
        const suffix = owners.length > 1 ? ` #${index + 1}` : '';
        const prefix = `Owner${suffix}`;
        const push = (label, value, url = '') => {
            if (value === undefined || value === null || value === '') return;
            rows.push({ label: `${prefix} — ${label}`, value: toDisplayValue(value), url });
        };

        push('Name', owner.name);
        push('Owner ID', owner.ownerProfileId || owner.ownerId);
        if (owner.sharePercentage !== undefined && owner.sharePercentage !== null && owner.sharePercentage !== '') {
            const share = String(owner.sharePercentage).trim();
            push('Share %', share.endsWith('%') ? share : `${share}%`);
        }
        push('Email', owner.email);
        push('Phone', owner.phone);
        push('Nationality', owner.nationality);

        for (const [docLabel, docKey] of OWNER_NESTED_DOC_LABELS) {
            const doc = owner[docKey];
            if (!doc || typeof doc !== 'object') continue;
            if (doc.number) push(`${docLabel} number`, doc.number);
            if (doc.issueDate) push(`${docLabel} issue`, doc.issueDate);
            if (doc.expiryDate) push(`${docLabel} expiry`, doc.expiryDate);
            if (doc.attachment) {
                rows.push({
                    label: `${prefix} — ${docLabel} attachment`,
                    value: getFileNameFromRef(doc.attachment),
                    url: resolveAttachmentUrl(doc.attachment),
                    attachmentRef: doc.attachment,
                    isAttachment: true,
                });
            }
        }
    });
    return rows;
}

/** Trade License resubmission: owner name/share only — no passport / EID / visa attachments. */
export function buildTradeLicenseOwnerSnapshotRows(owners = []) {
    if (!Array.isArray(owners) || owners.length === 0) return [];
    const rows = [];
    owners.forEach((owner, index) => {
        if (!owner || typeof owner !== 'object') return;
        const suffix = owners.length > 1 ? ` #${index + 1}` : '';
        const prefix = `Owner${suffix}`;
        const push = (label, value) => {
            if (value === undefined || value === null || value === '') return;
            rows.push({ label: `${prefix} — ${label}`, value: toDisplayValue(value) });
        };

        push('Name', owner.name);
        if (owner.sharePercentage !== undefined && owner.sharePercentage !== null && owner.sharePercentage !== '') {
            const share = String(owner.sharePercentage).trim();
            push('Share %', share.endsWith('%') ? share : `${share}%`);
        }
    });
    return rows;
}

function pushAttachmentRow(rows, label, value, keyMarker, coveredKeys) {
    if (!value) return;
    const url = resolveAttachmentUrl(value);
    rows.push({
        label,
        value: getFileNameFromRef(value),
        url,
        attachmentRef: value,
        isAttachment: true,
    });
    if (keyMarker) coveredKeys.add(keyMarker);
}

/** Trade License card: license fields + attachment (viewable) + owner name/share only. */
export function buildTradeLicenseSnapshotRows(data = {}) {
    if (!data || typeof data !== 'object') return [];
    const rows = [];
    const coveredKeys = new Set();

    const pushField = (label, key) => {
        const value = data[key];
        if (value === undefined || value === null || value === '') return;
        rows.push({ label, value: toDisplayValue(value) });
        coveredKeys.add(key);
    };

    pushField('Trade License Number', 'tradeLicenseNumber');
    pushField('Trade License Issue Date', 'tradeLicenseIssueDate');
    pushField('Trade License Expiry', 'tradeLicenseExpiry');

    const ownerName =
        data.tradeLicenseOwnerName ||
        (Array.isArray(data.owners) && data.owners[0]?.name) ||
        '';
    if (ownerName) {
        rows.push({ label: 'Trade License Owner Name', value: toDisplayValue(ownerName) });
        coveredKeys.add('tradeLicenseOwnerName');
    }

    if (Array.isArray(data.owners) && data.owners.length > 0) {
        rows.push(...buildTradeLicenseOwnerSnapshotRows(data.owners));
        coveredKeys.add('owners');
    }

    pushAttachmentRow(
        rows,
        'Trade License Attachment',
        data.tradeLicenseAttachment,
        'tradeLicenseAttachment',
        coveredKeys,
    );

    return rows;
}

/** Establishment Card card: number, dates, attachment. */
export function buildEstablishmentCardSnapshotRows(data = {}) {
    if (!data || typeof data !== 'object') return [];
    const rows = [];
    const coveredKeys = new Set();
    const pushField = (label, key) => {
        const value = data[key];
        if (value === undefined || value === null || value === '') return;
        rows.push({ label, value: toDisplayValue(value) });
        coveredKeys.add(key);
    };

    pushField('Establishment Card Number', 'establishmentCardNumber');
    pushField('Establishment Card Issue Date', 'establishmentCardIssueDate');
    pushField('Establishment Card Expiry', 'establishmentCardExpiry');
    pushAttachmentRow(
        rows,
        'Establishment Card Attachment',
        data.establishmentCardAttachment,
        'establishmentCardAttachment',
        coveredKeys,
    );
    return rows;
}

/** Flatten queued change payloads into label/value rows for read-only tables. */
/** Limit a prior snapshot to the same top-level keys as the proposed PATCH. */
export function scopeSnapshotToProposedKeys(previous = {}, proposed = {}) {
    if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)) return {};
    if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return {};
    const out = {};
    for (const key of Object.keys(proposed)) {
        if (Object.prototype.hasOwnProperty.call(previous, key)) {
            out[key] = previous[key];
        }
    }
    return out;
}

export function buildActivationSnapshotRows(data, options = {}) {
    if (!data || typeof data !== 'object') return [];
    const entry = options.entry;
    if (isTradeLicensePendingEntry(entry)) {
        return buildTradeLicenseSnapshotRows(data);
    }
    if (isEstablishmentCardPendingEntry(entry)) {
        return buildEstablishmentCardSnapshotRows(data);
    }
    if (isOwnerPassportPendingEntry(entry)) {
        return buildOwnerPassportSnapshotRows(data);
    }
    if (isOwnerEmiratesIdPendingEntry(entry)) {
        return buildOwnerEmiratesIdSnapshotRows(data);
    }
    if (isOwnerDetailsPendingEntry(entry)) {
        const owners = Array.isArray(data.owners) ? data.owners.map((o) => stripOwnerNestedDocs(o)) : [];
        return buildOwnerBasicDetailsSnapshotRows(owners);
    }
    const rows = [];
    const coveredKeys = new Set();

    const pushIfPresentForKey = (label, key) => {
        const value = data[key];
        if (value === undefined || value === null || value === '') return;
        rows.push({ label, value: toDisplayValue(value) });
        coveredKeys.add(key);
    };

    const pushIfPresent = (label, value, keyMarker = null) => {
        if (value === undefined || value === null || value === '') return;
        rows.push({ label, value: toDisplayValue(value) });
        if (keyMarker) coveredKeys.add(keyMarker);
    };

    // Company specific fields
    pushIfPresentForKey('Company Name', 'name');
    pushIfPresentForKey('Nick Name', 'nickName');
    pushIfPresentForKey('Company Id', 'companyId');
    pushIfPresentForKey('Email', 'email');
    pushIfPresentForKey('Phone', 'phone');
    pushIfPresentForKey('Established Date', 'establishedDate');
    pushIfPresentForKey('Trade License #', 'tradeLicenseNumber');
    pushIfPresentForKey('TL Issue Date', 'tradeLicenseIssueDate');
    pushIfPresentForKey('TL Expiry', 'tradeLicenseExpiry');
    pushIfPresentForKey('TL Owner', 'tradeLicenseOwnerName');
    pushIfPresentForKey('Establishment Card #', 'establishmentCardNumber');
    pushIfPresentForKey('EC Issue Date', 'establishmentCardIssueDate');
    pushIfPresentForKey('EC Expiry', 'establishmentCardExpiry');

    pushAttachmentRow(rows, 'Trade License Attachment', data.tradeLicenseAttachment, 'tradeLicenseAttachment', coveredKeys);
    pushAttachmentRow(rows, 'Establishment Card Attachment', data.establishmentCardAttachment, 'establishmentCardAttachment', coveredKeys);

    if (Array.isArray(data.owners) && data.owners.length > 0) {
        // Passport, EID, visa, etc. save immediately — only dedicated card routes may render owner rows.
        coveredKeys.add('owners');
    }

    const handledKeys = new Set([...coveredKeys, '_id', '__v', 'publicId', 'mimeType', 'lastUpdated', 'createdAt', 'updatedAt']);
    Object.keys(data)
        .sort((a, b) => a.localeCompare(b))
        .forEach((key) => {
            if (handledKeys.has(key)) return;
            const value = data[key];
            if (value === undefined || value === null || value === '') return;
            handledKeys.add(key);

            if (Array.isArray(value)) {
                if (key === 'owners') {
                    return;
                }
                if (key === 'documents') return;
                rows.push({ label: toLabel(key), value: `${value.length} item(s)` });
                return;
            }

            if (typeof value === 'string' && key.toLowerCase().includes('attachment')) {
                pushAttachmentRow(rows, toLabel(key), value, key, coveredKeys);
                return;
            }

            if (typeof value === 'object') {
                const lower = key.toLowerCase();
                if (
                    lower.includes('document') ||
                    lower.includes('attachment') ||
                    value.url ||
                    value.publicId ||
                    typeof value.mimeType === 'string'
                ) {
                    rows.push({
                        label: toLabel(key),
                        value: getFileNameFromRef(value),
                        url: value.url || '',
                        attachmentRef: value,
                        isAttachment: true,
                    });
                    return;
                }
                try {
                    const flat = JSON.stringify(value);
                    rows.push({ label: toLabel(key), value: flat.length > 200 ? `${flat.slice(0, 190)}...` : flat });
                } catch {
                    rows.push({ label: toLabel(key), value: String(value) });
                }
                return;
            }

            rows.push({ label: toLabel(key), value: toDisplayValue(value) });
        });

    return rows;
}

export function activationSnapshotRowSignature(row) {
    if (!row || typeof row !== 'object') return '';
    const v = row.value != null ? String(row.value).trim() : '';
    const u = row.url != null ? String(row.url).split('?')[0].trim() : '';
    const ref =
        row.attachmentRef != null
            ? typeof row.attachmentRef === 'string'
                ? row.attachmentRef.split('?')[0].trim()
                : String(row.attachmentRef?.url || row.attachmentRef?.publicId || '').split('?')[0].trim()
            : '';
    return `${v}||${u}||${ref}`;
}

export function filterSnapshotRowsToChangesOnly(entry, liveCompany = null) {
    const live = liveCompany && typeof liveCompany === 'object' ? liveCompany : {};
    const prevDataFull = resolveFullCardReviewData(entry, 'previous', live);
    const propData = resolveFullCardReviewData(entry, 'proposed', live);
    const prevRows = buildActivationSnapshotRows(prevDataFull, { entry });
    const propRows = buildActivationSnapshotRows(propData, { entry });
    if (!propRows.length && !prevRows.length) {
        return { previousRows: prevRows, proposedRows: propRows, usedFullFallback: false };
    }

    const prevByLabel = new Map();
    for (const r of prevRows) {
        if (!prevByLabel.has(r.label)) prevByLabel.set(r.label, r);
    }
    const propLabels = new Set(propRows.map((r) => r.label));
    const changed = new Set();

    for (const pr of propRows) {
        const oldR = prevByLabel.get(pr.label);
        if (!oldR) {
            changed.add(pr.label);
            continue;
        }
        if (activationSnapshotRowSignature(oldR) !== activationSnapshotRowSignature(pr)) {
            changed.add(pr.label);
        }
    }

    if (changed.size === 0) {
        return {
            previousRows: prevRows.filter((r) => propLabels.has(r.label)),
            proposedRows: propRows,
            usedFullFallback: true,
        };
    }
    return {
        previousRows: prevRows.filter((r) => changed.has(r.label)),
        proposedRows: propRows.filter((r) => changed.has(r.label)),
        usedFullFallback: false,
    };
}

export function formatSnapshotFallbackJson(value) {
    if (value === undefined || value === null) return '—';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
