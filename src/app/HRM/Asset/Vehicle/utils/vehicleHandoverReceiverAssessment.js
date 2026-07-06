import { resolveClientApiBaseUrl } from '@/utils/axios';
import {
    findPreviousAssessmentHandoverEntry,
    mergeAssessmentItemFromPrevious,
} from './vehicleHandoverPreviousReports';
import { buildAssessmentComparisonRows } from './vehicleHandoverPhotoComparison';

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
            return { present: true, photo: block.photo };
        }
    }

    return null;
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

export function buildAssessmentFormState(historyEntry, vehicle, options = {}) {
    const { assetHistory, currentEntry = historyEntry } = options || {};
    const previousEntry = assetHistory?.length
        ? findPreviousAssessmentHandoverEntry(assetHistory, historyEntry?._id, currentEntry)
        : null;
    const form = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const currentBlock = resolveCurrentAssessmentItemBlock(historyEntry, item.key);
        const previousBlock = resolvePreviousAssessmentItemBlock(previousEntry, item.key);
        form[item.key] = mergeAssessmentItemFromPrevious(currentBlock, previousBlock);
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

export function buildVehicleAccessoriesListTableRows(asset, assetHistory) {
    const historyEntry = findLatestReceiverAssessmentHandoverEntry(assetHistory);
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
    const latestEntry = findLatestReceiverAssessmentHandoverEntry(assetHistory);
    const previousEntry =
        latestEntry?._id && assetHistory?.length
            ? findPreviousAssessmentHandoverEntry(assetHistory, latestEntry._id, latestEntry)
            : null;

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
        : null;

    const comparisonRows =
        latestEntry && assetHistory?.length
            ? buildAssessmentComparisonRows(latestEntry, assetHistory)
            : [];
    const changedByKey = Object.fromEntries(
        comparisonRows.map((row) => [row.key, Boolean(row.changed)]),
    );
    const hasAssignmentChanges = comparisonRows.some((row) => row.changed);

    const sets = [];

    if (hasAssignmentChanges && previousRows) {
        sets.push({
            id: 'previous-handover',
            label: 'Previous handover',
            createdAt: previousEntry?.createdAt || previousEntry?.date || null,
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
    ).filter((entry) => String(entry?.kind || 'manual') !== 'assignment_change');

    manualEntries.forEach((entry, index) => {
        sets.push({
            id: String(entry?._id || `manual-${index}`),
            label: 'Additional row',
            createdAt: entry?.createdAt || null,
            rows: buildAccessoriesListRowsFromStoredEntry(entry, asset),
            isPrimary: false,
            highlight: false,
            changedByKey: {},
        });
    });

    return { sets, headerRows: currentRows.length ? currentRows : RECEIVER_ASSESSMENT_ITEMS };
}

export function serializeVehicleAccessoriesListEntry(draft) {
    const payload = buildAssessmentPayload(draft);
    const entry = { createdAt: new Date().toISOString(), kind: 'manual' };
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = payload[item.key];
        if (!row) return;
        entry[item.key] = {
            present: row.present,
            photo: row.photo,
            amount: row.amount != null ? row.amount : null,
        };
    });
    return entry;
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
            photo: row?.present === true ? row.photo : null,
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
