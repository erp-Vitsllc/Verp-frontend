import { resolveClientApiBaseUrl } from '@/utils/axios';
import {
    findPreviousAssessmentHandoverEntry,
    mergeAssessmentItemFromPrevious,
} from './vehicleHandoverPreviousReports';
import { buildAssessmentComparisonRows, buildAssessmentFormComparisonRows } from './vehicleHandoverPhotoComparison';
import { resolveHandoverDeleteHistoryId } from './vehicleHandoverHistory';

const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const S3_PATH_PREFIXES = [
    'admin-deletion-archive',
    'asset-documents',
    'asset-invoices',
    'asset-photos',
    'asset-service-invoices',
    'asset-service-attachments',
    'asset-services',
    'asset-history',
    'asset-accessories',
    'employee-documents',
    'employee-profiles',
    'employee-signatures',
    'profile-pictures',
    'user-profiles',
    'signatures',
    'uploads',
];

function isResolvableRelativeMediaPath(value) {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || MONGO_OBJECT_ID_RE.test(trimmed)) return false;
    if (trimmed.includes('/')) return true;
    return S3_PATH_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}/`));
}

function resolveApiOrigin() {
    const apiUrl = resolveClientApiBaseUrl();
    try {
        const parsed = new URL(
            apiUrl,
            typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
        );
        return parsed.origin;
    } catch {
        return String(apiUrl || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    }
}

export const RECEIVER_ASSESSMENT_ITEMS = [
    { key: 'spareTyre', label: 'Spare type' },
    { key: 'toolsKit', label: 'Tools Kit' },
    { key: 'scissorJack', label: 'Scissor Jack' },
    { key: 'firstAidKit', label: 'First Aid Kit' },
    { key: 'fireExtinguisher', label: 'Fire extinguisher' },
];

/** Fixed landscape photo slot — full width, 115px tall (Vehicle Assessment cards). */
export const HANDOVER_LANDSCAPE_PHOTO_BOX_CLASS =
    'h-[115px] min-h-[115px] max-h-[115px] w-full shrink-0 overflow-hidden rounded-lg';

/** Slightly taller landscape photo slot for Body Condition Report (4-col cards). */
export const HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS =
    'h-[145px] min-h-[145px] max-h-[145px] w-full shrink-0 overflow-hidden rounded-lg';

/** Vehicle Assessment Report — 3 cards per row */
export const HANDOVER_ASSESSMENT_GRID_CLASS = 'grid grid-cols-1 gap-2 sm:grid-cols-3';

/** Body Condition Report — 4 cards per row on sm+ screens */
export const HANDOVER_BODY_CONDITION_GRID_CLASS = 'grid grid-cols-2 gap-2 sm:grid-cols-4';

/** @deprecated */
export const HANDOVER_ASSESSMENT_CARD_MIN_HEIGHT_CLASS = '';

function normalizePresent(value) {
    if (value === true || value === 'true' || value === 'yes' || value === 'Yes') return true;
    if (value === false || value === 'false' || value === 'no' || value === 'No') return false;
    return null;
}

function pickItemBlock(source, key) {
    if (!source || typeof source !== 'object') return null;

    const nested = source[key];
    if (nested && typeof nested === 'object' && ('present' in nested || 'photo' in nested || 'image' in nested)) {
        return {
            present: normalizePresent(nested.present ?? nested.hasItem ?? nested.value ?? nested.answer),
            photo: nested.photo ?? nested.image ?? nested.attachment ?? null,
            amount:
                nested.amount != null && nested.amount !== ''
                    ? Number(nested.amount)
                    : nested.price != null && nested.price !== ''
                      ? Number(nested.price)
                      : null,
        };
    }

    const present = normalizePresent(nested ?? source[`${key}Present`] ?? source[`${key}Answer`]);
    const photo = source[`${key}Photo`] ?? source[`${key}Image`] ?? null;
    const amountRaw = source[`${key}Amount`] ?? source[`${key}Price`];

    if (present === null && !photo && (amountRaw == null || amountRaw === '')) return null;
    return {
        present,
        photo,
        amount: amountRaw != null && amountRaw !== '' ? Number(amountRaw) : null,
    };
}

function hasAssessmentData(source) {
    if (!source || typeof source !== 'object') return false;

    return RECEIVER_ASSESSMENT_ITEMS.some((item) => {
        const block = pickItemBlock(source, item.key);
        return block?.present === true || block?.present === false || Boolean(block?.photo);
    });
}

export function resolveReceiverAssessmentSource(historyEntry, vehicle) {
    const candidates = [
        historyEntry?.details?.receiverAssessment,
        historyEntry?.details?.vehicleAssessmentReportByReceiver,
        historyEntry?.receiverAssessment,
        vehicle?.receiverAssessment,
        historyEntry?.details?.receiverAssessmentReport,
    ];

    return candidates.find((item) => hasAssessmentData(item)) || null;
}

function resolveCurrentAssessmentItemBlock(historyEntry, key) {
    const historySources = [
        historyEntry?.details?.receiverAssessment,
        historyEntry?.details?.vehicleAssessmentReportByReceiver,
        historyEntry?.receiverAssessment,
        historyEntry?.details?.receiverAssessmentReport,
    ];

    for (const source of historySources) {
        const block = pickItemBlock(source, key);
        if (block?.present === true || block?.present === false) {
            return block;
        }
        if (block?.photo) {
            return { present: true, photo: block.photo, amount: block.amount ?? null };
        }
    }

    const mergedSource = resolveReceiverAssessmentSource(historyEntry, null);
    if (mergedSource) {
        const block = pickItemBlock(mergedSource, key);
        if (block?.present === true || block?.present === false) {
            return block;
        }
        if (block?.photo) {
            return { present: true, photo: block.photo, amount: block.amount ?? null };
        }
    }

    return null;
}

function resolveStoredAccessoriesItemBlock(entry, key) {
    if (!entry || typeof entry !== 'object') return null;
    const block = entry[key];
    if (!block || typeof block !== 'object') return null;

    const present =
        block.present === true ? true : block.present === false ? false : block.photo ? true : null;

    return {
        present,
        photo: present === true ? block.photo ?? null : null,
        amount:
            block.amount != null && block.amount !== '' && Number.isFinite(Number(block.amount))
                ? Number(block.amount)
                : null,
    };
}

export function storedAccessoriesEntryHasAssessmentData(entry) {
    if (!entry || typeof entry !== 'object') return false;
    return RECEIVER_ASSESSMENT_ITEMS.some((item) => {
        const block = resolveStoredAccessoriesItemBlock(entry, item.key);
        return block?.present === true || block?.present === false || Boolean(block?.photo);
    });
}

/** Latest accessories-list row to compare against (skips current assignment_change snapshot). */
export function findPreviousAccessoriesListBaselineEntry(asset, currentHistoryId = '') {
    const entries = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : [];
    if (!entries.length) return null;

    const currentId = String(currentHistoryId || '');
    const ranked = [...entries].sort((a, b) => {
        const aTs = new Date(a?.createdAt || 0).getTime();
        const bTs = new Date(b?.createdAt || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });

    for (const entry of ranked) {
        const kind = String(entry?.kind || 'manual');
        const sourceId = String(entry?.sourceHistoryId || '');
        if (kind === 'assignment_change' && sourceId && sourceId === currentId) continue;
        if (storedAccessoriesEntryHasAssessmentData(entry)) return entry;
    }

    return null;
}

export function findLatestStoredAccessoriesListEntry(asset) {
    const entries = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : [];
    if (!entries.length) return null;

    return [...entries].sort((a, b) => {
        const aTs = new Date(a?.createdAt || 0).getTime();
        const bTs = new Date(b?.createdAt || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    })[0];
}

function resolveAssessmentItemBlock(historyEntry, vehicle, key) {
    const fromHistory = resolveCurrentAssessmentItemBlock(historyEntry, key);
    if (fromHistory) return fromHistory;

    return pickItemBlock(vehicle?.receiverAssessment, key);
}

export function hasCurrentReceiverAssessmentDataOnHistory(historyEntry) {
    if (!historyEntry) return false;

    return RECEIVER_ASSESSMENT_ITEMS.some((item) => {
        const block = resolveCurrentAssessmentItemBlock(historyEntry, item.key);
        return block?.present === true || block?.present === false;
    });
}

function resolvePreviousAssessmentItemBlock(previousEntry, key) {
    if (!previousEntry) return null;
    return resolveCurrentAssessmentItemBlock(previousEntry, key);
}

/** Baseline for change detection — previous handover / stored row only, never current assignment values. */
export function buildPreviousHandoverComparisonForm(historyEntry, vehicle, options = {}) {
    const { assetHistory, currentEntry = historyEntry, asset = vehicle } = options || {};
    const previousEntry = assetHistory?.length
        ? findPreviousAssessmentHandoverEntry(assetHistory, historyEntry?._id, currentEntry)
        : null;
    const storedBaselineEntry = findPreviousAccessoriesListBaselineEntry(
        asset,
        historyEntry?._id,
    );
    const form = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        let block = resolvePreviousAssessmentItemBlock(previousEntry, item.key);

        if (
            (!block ||
                (block.present !== true &&
                    block.present !== false &&
                    !block.photo)) &&
            storedBaselineEntry
        ) {
            const storedBlock = resolveStoredAccessoriesItemBlock(storedBaselineEntry, item.key);
            if (storedBlock) block = storedBlock;
        }

        const present =
            block?.present === true
                ? true
                : block?.present === false
                  ? false
                  : block?.photo
                    ? true
                    : null;

        form[item.key] = {
            present,
            photo: present === true ? block?.photo ?? null : null,
        };
    });

    return form;
}

export function buildAccessoriesAssessmentComparisonRows(historyEntry, asset, assetHistory = []) {
    const currentForm = buildAssessmentFormState(historyEntry, asset, {
        assetHistory,
        asset,
        currentEntry: historyEntry,
    });
    const previousForm = buildPreviousHandoverComparisonForm(historyEntry, asset, {
        assetHistory,
        currentEntry: historyEntry,
        asset,
    });

    return buildAssessmentFormComparisonRows(currentForm, historyEntry, assetHistory, {
        initialForm: previousForm,
    });
}

export function buildAssessmentFormState(historyEntry, vehicle, options = {}) {
    const { assetHistory, currentEntry = historyEntry, asset = vehicle } = options || {};
    const previousEntry = assetHistory?.length
        ? findPreviousAssessmentHandoverEntry(assetHistory, historyEntry?._id, currentEntry)
        : null;
    const latestAssessmentEntry =
        assetHistory?.length && historyEntry?._id
            ? findLatestReceiverAssessmentHandoverEntry(assetHistory)
            : null;
    const latestStoredEntry = findLatestStoredAccessoriesListEntry(asset);
    const form = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const currentBlock = resolveCurrentAssessmentItemBlock(historyEntry, item.key);
        const previousBlock = resolvePreviousAssessmentItemBlock(previousEntry, item.key);
        let merged = mergeAssessmentItemFromPrevious(currentBlock, previousBlock);

        const needsFallback =
            merged.present !== true &&
            merged.present !== false &&
            !merged.photo;

        if (needsFallback && latestAssessmentEntry) {
            const latestId = String(latestAssessmentEntry?._id || '');
            const currentId = String(historyEntry?._id || '');
            if (latestId && latestId !== currentId) {
                const latestBlock = resolveCurrentAssessmentItemBlock(latestAssessmentEntry, item.key);
                merged = mergeAssessmentItemFromPrevious(merged, latestBlock);
            } else if (latestId === currentId) {
                const latestBlock = resolveCurrentAssessmentItemBlock(latestAssessmentEntry, item.key);
                if (latestBlock) {
                    merged = mergeAssessmentItemFromPrevious(merged, latestBlock);
                }
            }
        }

        if (
            merged.present !== true &&
            merged.present !== false &&
            !merged.photo &&
            latestStoredEntry
        ) {
            const storedBlock = resolveStoredAccessoriesItemBlock(latestStoredEntry, item.key);
            merged = mergeAssessmentItemFromPrevious(merged, storedBlock);
        }

        form[item.key] = merged;
    });

    return form;
}

export function buildReceiverAssessmentRows(historyEntry, vehicle, options = {}) {
    const form = buildAssessmentFormState(historyEntry, vehicle, options);
    const asset = options?.asset;

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const row = form[item.key] || {};
        const present = row.present ?? null;
        const photo = row.photo ?? null;
        const amount = resolveVehicleAccessoryItemPrice(asset, item.key, item.label, row);

        return {
            ...item,
            present,
            photo,
            amount,
            yesLabel: present === true ? 'Yes' : present === false ? 'No' : '—',
            photoRequired: present === true,
            photoMissing: present === true && !resolveAssessmentMediaUrl(photo),
            photoUrl: present === true ? resolveAssessmentMediaUrl(photo) : null,
        };
    });
}

const VEHICLE_ACCESSORY_PRICE_ALIASES = {
    spareTyre: ['spare type', 'spare tyre', 'spare tire'],
    toolsKit: ['tools kit', 'tool kit'],
    scissorJack: ['scissor jack', 'jack'],
    firstAidKit: ['first aid kit', 'first aid'],
    fireExtinguisher: ['fire extinguisher', 'extinguisher'],
};

function normalizeAccessoryName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function resolveAccessoryAmountFromAsset(asset, key, label) {
    const accessories = Array.isArray(asset?.accessories) ? asset.accessories : [];
    if (!accessories.length) return null;

    const targets = new Set(
        [label, ...(VEHICLE_ACCESSORY_PRICE_ALIASES[key] || [])].map(normalizeAccessoryName).filter(Boolean),
    );

    const matched = accessories.find((acc) => {
        const name = normalizeAccessoryName(acc?.name);
        if (!name) return false;
        if (targets.has(name)) return true;
        return [...targets].some((target) => name.includes(target) || target.includes(name));
    });

    if (!matched || matched.amount == null || matched.amount === '') return null;
    const parsed = Number(matched.amount);
    return Number.isFinite(parsed) ? parsed : null;
}

export function resolveVehicleAccessoryItemPrice(asset, key, label, assessmentRow = null) {
    if (assessmentRow?.amount != null && assessmentRow.amount !== '') {
        const fromRow = Number(assessmentRow.amount);
        if (Number.isFinite(fromRow)) return fromRow;
    }
    return resolveAccessoryAmountFromAsset(asset, key, label);
}

export function findLatestReceiverAssessmentHandoverEntry(assetHistory) {
    if (!Array.isArray(assetHistory) || !assetHistory.length) return null;

    const sorted = [...assetHistory].sort((a, b) => {
        const aTs = new Date(a?.createdAt || a?.date || 0).getTime();
        const bTs = new Date(b?.createdAt || b?.date || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });

    return sorted.find((row) => resolveReceiverAssessmentSource(row, null)) || null;
}

/** Prefer the active pending handover row; fall back to the latest saved assessment. */
export function resolveAccessoriesListPrimaryHandoverEntry(asset, assetHistory) {
    if (!Array.isArray(assetHistory) || !assetHistory.length) return null;

    const activeId = asset?.pendingActionDetails?.vehicleHandoverFlow?.historyId;
    if (activeId) {
        const active = assetHistory.find((row) => String(row?._id) === String(activeId));
        if (active) return active;
    }

    return findLatestReceiverAssessmentHandoverEntry(assetHistory);
}

export function buildVehicleAccessoriesListTableRows(asset, assetHistory) {
    const historyEntry = resolveAccessoriesListPrimaryHandoverEntry(asset, assetHistory);
    return buildReceiverAssessmentRows(historyEntry, asset, { assetHistory, asset });
}

export function buildAccessoriesListRowsFromStoredEntry(entry, asset) {
    if (!entry || typeof entry !== 'object') return [];

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const block = entry[item.key] || {};
        const present = block.present ?? null;
        const photo = block.photo ?? null;
        const amount = resolveVehicleAccessoryItemPrice(asset, item.key, item.label, block);

        return {
            ...item,
            present,
            photo,
            amount,
            photoUrl: present === true ? resolveAssessmentMediaUrl(photo) : null,
        };
    });
}

export function buildEmptyAccessoriesListEditForm() {
    const form = {};
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        form[item.key] = { present: true, photo: null, amount: '' };
    });
    return form;
}

export function buildVehicleAccessoriesListTableSets(asset, assetHistory) {
    const latestEntry = resolveAccessoriesListPrimaryHandoverEntry(asset, assetHistory);
    const previousEntry =
        latestEntry?._id && assetHistory?.length
            ? findPreviousAssessmentHandoverEntry(assetHistory, latestEntry._id, latestEntry)
            : null;
    const storedBaselineEntry = findPreviousAccessoriesListBaselineEntry(asset, latestEntry?._id);

    const currentRows = buildReceiverAssessmentRows(latestEntry, asset, {
        assetHistory,
        asset,
    });
    const previousRows = previousEntry
        ? buildReceiverAssessmentRows(previousEntry, asset, {
              assetHistory,
              asset,
              currentEntry: latestEntry,
          })
        : storedBaselineEntry
          ? buildAccessoriesListRowsFromStoredEntry(storedBaselineEntry, asset)
          : null;

    const comparisonRows =
        latestEntry && asset
            ? buildAccessoriesAssessmentComparisonRows(latestEntry, asset, assetHistory)
            : [];
    const changedByKey = Object.fromEntries(
        comparisonRows.map((row) => [row.key, Boolean(row.changed)]),
    );
    const hasAssignmentChanges = comparisonRows.some((row) => row.changed);

    const sets = [];

    if (hasAssignmentChanges && previousRows) {
        sets.push({
            id: 'previous-handover',
            label: previousEntry ? 'Previous handover' : 'Previous row',
            createdAt:
                previousEntry?.createdAt ||
                previousEntry?.date ||
                storedBaselineEntry?.createdAt ||
                null,
            rows: previousRows,
            isPrimary: false,
            highlight: false,
            changedByKey: {},
        });
        sets.push({
            id: 'new-assignment',
            label: 'New assignment',
            createdAt: latestEntry?.createdAt || latestEntry?.date || null,
            rows: currentRows.map((row) => ({ ...row, changed: Boolean(changedByKey[row.key]) })),
            isPrimary: true,
            highlight: true,
            changedByKey,
        });
    } else if (
        currentRows.some(
            (row) =>
                row.present === true ||
                row.present === false ||
                row.photoUrl ||
                row.amount != null,
        )
    ) {
        sets.push({
            id: 'primary',
            label: 'Current handover',
            createdAt: latestEntry?.createdAt || latestEntry?.date || null,
            rows: currentRows,
            isPrimary: true,
            highlight: false,
            changedByKey: {},
        });
    }

    const manualEntries = (Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : []
    ).filter((entry) => {
        if (String(entry?.kind || 'manual') === 'assignment_change') return false;
        if (
            storedBaselineEntry &&
            hasAssignmentChanges &&
            String(entry?._id || '') === String(storedBaselineEntry?._id || '')
        ) {
            return false;
        }
        return true;
    });

    manualEntries.forEach((entry, index) => {
        sets.push({
            id: String(entry?._id || `manual-${index}`),
            label: entry?.kind === 'edit_snapshot' ? 'Previous row' : 'Additional row',
            createdAt: entry?.createdAt || null,
            rows: buildAccessoriesListRowsFromStoredEntry(entry, asset),
            isPrimary: false,
            highlight: false,
            changedByKey: {},
        });
    });

    const assignmentChangeEntries = (Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : []
    )
        .filter((entry) => String(entry?.kind || '') === 'assignment_change')
        .sort((a, b) => {
            const aTs = new Date(a?.createdAt || 0).getTime();
            const bTs = new Date(b?.createdAt || 0).getTime();
            if (aTs !== bTs) return aTs - bTs;
            return String(a?._id || '').localeCompare(String(b?._id || ''));
        });

    assignmentChangeEntries.forEach((entry, index) => {
        const linkedHistoryId = String(entry?.sourceHistoryId || '');
        const linkedLatest =
            linkedHistoryId && latestEntry && String(latestEntry._id) === linkedHistoryId;
        if (linkedLatest && hasAssignmentChanges && previousRows) return;

        const storedChangedByKey =
            entry?.changedByKey && typeof entry.changedByKey === 'object'
                ? entry.changedByKey
                : null;
        const entryChangedByKey =
            storedChangedByKey ||
            Object.fromEntries(
                comparisonRows
                    .filter((row) => row.changed)
                    .map((row) => [row.key, true]),
            );

        sets.push({
            id: String(entry?._id || `assignment-change-${index}`),
            label: 'Assignment changes',
            createdAt: entry?.createdAt || null,
            rows: buildAccessoriesListRowsFromStoredEntry(entry, asset).map((row) => ({
                ...row,
                changed: Boolean(entryChangedByKey[row.key]),
            })),
            isPrimary: false,
            highlight: true,
            changedByKey: entryChangedByKey,
        });
    });

    return { sets, headerRows: currentRows.length ? currentRows : RECEIVER_ASSESSMENT_ITEMS };
}

export function serializeVehicleAccessoriesListEntry(draft, options = {}) {
    const { kind = 'manual', sourceHistoryId = null, changedByKey = null } = options;
    const payload = buildAssessmentPayload(draft);
    const entry = { createdAt: new Date().toISOString(), kind };
    if (sourceHistoryId) entry.sourceHistoryId = sourceHistoryId;
    if (changedByKey && typeof changedByKey === 'object') {
        entry.changedByKey = { ...changedByKey };
    }
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = payload[item.key];
        if (!row) return;
        entry[item.key] = {
            present: row.present,
            photo: photoForAccessoryStorage(row.photo),
            amount: row.amount != null ? row.amount : null,
        };
    });
    return entry;
}

export function serializeVehicleAccessoriesListEntryFromRows(rows, options = {}) {
    const form = buildAccessoriesListEditForm(rows);
    return serializeVehicleAccessoriesListEntry(form, options);
}

function photoForAccessoryStorage(photo) {
    if (!photo) return null;
    if (typeof photo === 'string') {
        const trimmed = photo.trim();
        if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
        if (trimmed.startsWith('data:')) return trimmed;
        if (trimmed.startsWith('http')) {
            for (const prefix of S3_PATH_PREFIXES) {
                const index = trimmed.indexOf(prefix);
                if (index !== -1) {
                    return decodeURIComponent(trimmed.substring(index).split('?')[0]);
                }
            }
            try {
                const parsed = new URL(trimmed);
                const pathKey = decodeURIComponent(String(parsed.pathname || '').replace(/^\/+/, ''));
                if (pathKey && S3_PATH_PREFIXES.some((prefix) => pathKey === prefix || pathKey.startsWith(`${prefix}/`))) {
                    return pathKey;
                }
            } catch {
                return null;
            }
            return null;
        }
        return trimmed;
    }
    if (typeof photo === 'object') {
        const nested = photo.publicId || photo.path || photo.url || photo.data || null;
        return photoForAccessoryStorage(nested);
    }
    return photo;
}

/** Stable identity for comparing handover photos (S3 key, data URL prefix, or URL path). */
export function normalizeHandoverPhotoIdentity(photo) {
    if (!photo) return '';
    if (typeof photo === 'string') {
        const trimmed = photo.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('data:')) return trimmed.slice(0, 120);
        if (trimmed.startsWith('http')) {
            for (const prefix of S3_PATH_PREFIXES) {
                const index = trimmed.indexOf(prefix);
                if (index !== -1) {
                    return decodeURIComponent(trimmed.substring(index).split('?')[0]);
                }
            }
            try {
                const parsed = new URL(trimmed);
                const pathKey = decodeURIComponent(String(parsed.pathname || '').replace(/^\/+/, ''));
                if (
                    pathKey &&
                    S3_PATH_PREFIXES.some(
                        (prefix) => pathKey === prefix || pathKey.startsWith(`${prefix}/`),
                    )
                ) {
                    return pathKey.split('?')[0];
                }
            } catch {
                return trimmed.split('?')[0];
            }
            return trimmed.split('?')[0];
        }
        return trimmed.split('?')[0];
    }
    if (typeof photo === 'object') {
        const nested = photo.publicId || photo.path || photo.url || photo.data || '';
        return normalizeHandoverPhotoIdentity(nested);
    }
    return '';
}

function normalizeAccessoriesPhotoKey(photo) {
    return normalizeHandoverPhotoIdentity(photo);
}

export function applyAssessmentPresentToggle(currentRow = {}, present, fallbackPhoto = null) {
    const stashedPhoto = currentRow.photo ?? fallbackPhoto ?? null;
    return {
        present,
        photo: stashedPhoto,
    };
}

export function cloneAssessmentForm(source = {}) {
    const form = {};
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = source[item.key] || {};
        form[item.key] = {
            present: row.present ?? null,
            photo: row.photo ?? null,
        };
    });
    return form;
}

export function assessmentFormChanged(baseline = {}, next = {}) {
    return RECEIVER_ASSESSMENT_ITEMS.some((item) => {
        const original = baseline[item.key] || {};
        const draft = next[item.key] || {};
        const originalPresent =
            original.present ?? (original.photo ? true : null);
        const nextPresent = draft.present ?? (draft.photo ? true : null);
        if (originalPresent !== nextPresent) return true;
        return (
            normalizeAccessoriesPhotoKey(original.photo) !==
            normalizeAccessoriesPhotoKey(draft.photo)
        );
    });
}

export function hasAssessmentDraftSelections(form = {}) {
    return RECEIVER_ASSESSMENT_ITEMS.some((item) => {
        const row = form[item.key];
        return row?.present === true || row?.present === false;
    });
}

export function accessoriesAssessmentRowsChanged(originalRows, draft) {
    return RECEIVER_ASSESSMENT_ITEMS.some((item) => {
        const original = originalRows.find((row) => row.key === item.key) || {};
        const next = draft[item.key] || {};
        const originalPresent =
            original.present ?? (original.photoUrl || original.photo ? true : null);
        const nextPresent = next.present ?? (next.photo ? true : null);
        if (originalPresent !== nextPresent) return true;

        const originalAmount =
            original.amount != null && original.amount !== '' ? Number(original.amount) : null;
        const nextAmount =
            next.amount != null && next.amount !== '' ? Number(next.amount) : null;
        if (originalAmount !== nextAmount) return true;

        return (
            normalizeAccessoriesPhotoKey(original.photo) !== normalizeAccessoriesPhotoKey(next.photo)
        );
    });
}

export function serializeVehicleAccessoriesListEntries(asset, draft) {
    const existing = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries.map((entry) => {
              const serialized = {
                  createdAt: entry.createdAt || new Date().toISOString(),
                  kind: entry.kind || 'manual',
              };
              if (entry._id) serialized._id = entry._id;
              if (entry.sourceHistoryId) serialized.sourceHistoryId = entry.sourceHistoryId;
              RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
                  const row = entry[item.key];
                  if (!row) return;
                  serialized[item.key] = {
                      present: row.present ?? null,
                      photo: row.photo ?? null,
                      amount: row.amount ?? null,
                  };
              });
              return serialized;
          })
        : [];

    return [...existing, serializeVehicleAccessoriesListEntry(draft)];
}

export function formatVehicleAccessoryPrice(amount) {
    if (amount == null || amount === '' || !Number.isFinite(Number(amount))) return '—';
    return `AED ${new Intl.NumberFormat().format(Number(amount))}`;
}

export function buildAccessoriesListEditForm(rows) {
    const form = {};
    rows.forEach((row) => {
        form[row.key] = {
            present: row.present ?? (row.photoUrl || row.photo ? true : null),
            photo: row.photo ?? null,
            amount: row.amount != null && row.amount !== '' ? String(row.amount) : '',
        };
    });
    return form;
}

export function buildSyncedAssetAccessories(asset, editForm) {
    const accessories = Array.isArray(asset?.accessories) ? [...asset.accessories] : [];
    if (!accessories.length) return null;

    let changed = false;
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const draft = editForm[item.key];
        if (!draft || draft.amount === '' || draft.amount == null) return;

        const amount = Number(draft.amount);
        if (!Number.isFinite(amount)) return;

        const targets = new Set(
            [item.label, ...(VEHICLE_ACCESSORY_PRICE_ALIASES[item.key] || [])]
                .map(normalizeAccessoryName)
                .filter(Boolean),
        );

        const index = accessories.findIndex((acc) => {
            const name = normalizeAccessoryName(acc?.name);
            if (!name) return false;
            if (targets.has(name)) return true;
            return [...targets].some((target) => name.includes(target) || target.includes(name));
        });

        if (index < 0) return;
        if (Number(accessories[index].amount) === amount) return;
        accessories[index] = { ...accessories[index], amount };
        changed = true;
    });

    return changed ? accessories : null;
}

export function resolveAssessmentMediaUrl(value) {
    if (!value) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
        if (trimmed.startsWith('data:') || trimmed.startsWith('http')) return trimmed;
        if (!isResolvableRelativeMediaPath(trimmed)) return null;
        const origin = resolveApiOrigin();
        return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
    }

    if (typeof value === 'object') {
        if (typeof value.url === 'string') {
            const direct = value.url.trim();
            if (direct.startsWith('http') || direct.startsWith('data:')) return direct;
        }
        const nested = value.url || value.publicId || value.path || value.data || null;
        return resolveAssessmentMediaUrl(nested);
    }

    return null;
}

export function resolveVehiclePreviewImage(vehicle) {
    return (
        resolveAssessmentMediaUrl(vehicle?.imagePreview) ||
        resolveAssessmentMediaUrl(vehicle?.photo) ||
        null
    );
}

export function hasStoredAssessmentPhoto(photo) {
    if (!photo) return false;
    if (typeof photo === 'string') {
        const trimmed = photo.trim();
        return Boolean(trimmed && trimmed !== 'undefined' && trimmed !== 'null');
    }
    if (typeof photo === 'object') {
        return Boolean(photo.url || photo.publicId || photo.data || photo.path || photo.image);
    }
    return false;
}

export function hasAssessmentPhoto(photo) {
    return hasStoredAssessmentPhoto(photo) || Boolean(resolveAssessmentMediaUrl(photo));
}

export function isAssessmentFormComplete(form) {
    return Object.keys(validateAssessmentForm(form)).length === 0;
}

export function validateAssessmentForm(form) {
    const errors = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = form?.[item.key];
        if (!row || row.present !== true && row.present !== false) {
            errors[item.key] = 'Select Yes or No (required)';
            return;
        }
        if (row.present === true && !hasAssessmentPhoto(row.photo)) {
            errors[item.key] = 'Photo required (mandatory) when Yes is selected';
        }
    });

    return errors;
}

export function buildAssessmentPayload(form) {
    const payload = {};
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = form[item.key];
        const entry = {
            present: row?.present === true ? true : row?.present === false ? false : null,
            photo: row?.present === true ? photoForAccessoryStorage(row.photo) : null,
        };
        if (row?.amount != null && row.amount !== '' && Number.isFinite(Number(row.amount))) {
            entry.amount = Number(row.amount);
        }
        payload[item.key] = entry;
    });
    return payload;
}

export function mergeReceiverAssessmentIntoEntry(historyEntry, receiverAssessment) {
    if (!historyEntry) return historyEntry;
    return {
        ...historyEntry,
        details: {
            ...(historyEntry.details && typeof historyEntry.details === 'object' ? historyEntry.details : {}),
            receiverAssessment,
        },
    };
}

export function isReceiverAssessmentMarkedDone(historyEntry) {
    return historyEntry?.details?.receiverAssessmentCompleted === true;
}

export function mergeAssessmentCompletedIntoEntry(historyEntry) {
    if (!historyEntry) return historyEntry;
    return {
        ...historyEntry,
        details: {
            ...(historyEntry.details && typeof historyEntry.details === 'object' ? historyEntry.details : {}),
            receiverAssessmentCompleted: true,
        },
    };
}

function serializeExistingAccessoriesListEntries(asset) {
    return Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries.map((entry) => {
              const serialized = {
                  createdAt: entry.createdAt || new Date().toISOString(),
                  kind: entry.kind || 'manual',
              };
              if (entry._id) serialized._id = entry._id;
              if (entry.sourceHistoryId) serialized.sourceHistoryId = entry.sourceHistoryId;
              if (entry.changedByKey && typeof entry.changedByKey === 'object') {
                  serialized.changedByKey = { ...entry.changedByKey };
              }
              RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
                  const row = entry[item.key];
                  if (!row) return;
                  serialized[item.key] = {
                      present: row.present ?? null,
                      photo: row.photo ?? null,
                      amount: row.amount ?? null,
                  };
              });
              return serialized;
          })
        : [];
}

export function buildAccessoriesListAssignmentChangeEntry(form, assetHistory, historyEntry, vehicle) {
    const payload = buildAssessmentPayload(form);
    const entryForComparison = mergeReceiverAssessmentIntoEntry(historyEntry, payload);
    const comparisonRows = buildAccessoriesAssessmentComparisonRows(
        entryForComparison,
        vehicle,
        assetHistory,
    );
    if (!comparisonRows.some((row) => row.changed)) return null;

    const changedByKey = Object.fromEntries(
        comparisonRows.map((row) => [row.key, Boolean(row.changed)]),
    );
    const rawSourceId =
        resolveHandoverDeleteHistoryId(historyEntry, vehicle, assetHistory) ||
        historyEntry?._id ||
        null;
    const sourceHistoryId =
        rawSourceId && !String(rawSourceId).startsWith('live-') ? rawSourceId : null;

    return serializeVehicleAccessoriesListEntry(form, {
        kind: 'assignment_change',
        sourceHistoryId,
        changedByKey,
    });
}

export function mergeAccessoriesListAssignmentChangeEntry(asset, changeEntry) {
    if (!changeEntry) return null;
    const existing = serializeExistingAccessoriesListEntries(asset);
    const sourceId = String(changeEntry.sourceHistoryId || '');
    const idx = existing.findIndex(
        (row) =>
            String(row?.kind || '') === 'assignment_change' &&
            String(row?.sourceHistoryId || '') === sourceId,
    );
    if (idx >= 0) {
        existing[idx] = {
            ...existing[idx],
            ...changeEntry,
            _id: existing[idx]._id,
            createdAt: existing[idx].createdAt || changeEntry.createdAt,
        };
    } else {
        existing.push(changeEntry);
    }
    return existing;
}
