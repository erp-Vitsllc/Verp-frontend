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
    { key: 'spareTyre', label: 'Spare Tyre' },
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
            return {
                present: true,
                photo: block.photo,
                amount: block.amount ?? null,
                comment: block.comment ?? block.notes ?? '',
            };
        }
    }

    const mergedSource = resolveReceiverAssessmentSource(historyEntry, null);
    if (mergedSource) {
        const block = pickItemBlock(mergedSource, key);
        if (block?.present === true || block?.present === false) {
            return block;
        }
        if (block?.photo) {
            return {
                present: true,
                photo: block.photo,
                amount: block.amount ?? null,
                comment: block.comment ?? block.notes ?? '',
            };
        }
    }

    return null;
}

function resolveStoredAccessoriesItemBlock(entry, key) {
    if (!entry || typeof entry !== 'object') return null;
    const block = entry[key];
    if (!block || typeof block !== 'object') return null;

    const photo = block.photo ?? null;
    const present = coerceAccessoryAssessmentPresent({
        present: block.present,
        photo,
    });

    return {
        present,
        photo: hasStoredAssessmentPhoto(photo) ? photo : present === true ? photo : null,
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

/** Latest accessories-list row to compare against (skips active handover snapshots). */
export function findPreviousAccessoriesListBaselineEntry(asset, currentHistoryId = '', options = {}) {
    const { historyEntry = null, assetHistory = [] } = options || {};
    const entries = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : [];
    if (!entries.length) return null;

    const resolvedCurrentId = String(
        resolveHandoverDeleteHistoryId(
            historyEntry || (currentHistoryId ? { _id: currentHistoryId } : null),
            asset,
            assetHistory,
        ) || currentHistoryId || '',
    );
    const ranked = [...entries].sort((a, b) => {
        const aTs = new Date(a?.createdAt || 0).getTime();
        const bTs = new Date(b?.createdAt || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });

    for (const entry of ranked) {
        const kind = String(entry?.kind || 'manual');
        const sourceId = String(entry?.sourceHistoryId || '');
        // Baseline must reflect pre-handover registry — not snapshots from the active handover row.
        if (resolvedCurrentId && sourceId && sourceId === resolvedCurrentId) continue;
        // Live overlays are mutable working copies — compare against last committed snapshot only.
        if (kind === 'live_accessories') continue;
        if (storedAccessoriesEntryHasAssessmentData(entry)) return entry;
    }

    return null;
}

function rankVehicleAccessoriesListEntries(asset) {
    const entries = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : [];
    return [...entries].sort((a, b) => {
        const aTs = new Date(a?.createdAt || 0).getTime();
        const bTs = new Date(b?.createdAt || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });
}

function resolveLiveOverlayExplicitKeys(entry) {
    if (!entry || typeof entry !== 'object') return [];
    if (entry.changedByKey && typeof entry.changedByKey === 'object') {
        const keys = Object.keys(entry.changedByKey).filter((key) => entry.changedByKey[key]);
        if (keys.length) return keys;
    }
    return RECEIVER_ASSESSMENT_ITEMS.map((item) => item.key).filter((key) => {
        const block = entry[key];
        return Boolean(block?.photo || block?.present === true || block?.present === false);
    });
}

export function coerceAccessoryAssessmentPresent(row = {}) {
    if (row.present === true || row.present === false) return row.present;
    return row.photo ? true : null;
}

export function accessoryAssessmentItemChanged(baseline = {}, current = {}) {
    const currPresent = coerceAccessoryAssessmentPresent(current);
    if (currPresent !== true && currPresent !== false) return false;

    const basePresent = coerceAccessoryAssessmentPresent(baseline);
    const hasBaseline =
        basePresent === true || basePresent === false || Boolean(baseline.photo);
    if (!hasBaseline) return false;
    if (basePresent !== currPresent) return true;
    if (currPresent === true) {
        return (
            normalizeAccessoriesPhotoKey(baseline.photo) !==
            normalizeAccessoriesPhotoKey(current.photo)
        );
    }
    return false;
}

export function isAccessoryAssessmentRowUserSelected(row = {}) {
    return row.present === true || row.present === false;
}

/** Merged per-key live accessories registry — used only for the 5 accessory cards. */
export function buildAccessoriesComparisonBaselineForm(asset, historyEntry = null, options = {}) {
    const { assetHistory = [] } = options || {};
    const historyId = String(
        resolveHandoverDeleteHistoryId(historyEntry, asset, assetHistory) ||
            historyEntry?._id ||
            '',
    );
    const chronological = [...rankVehicleAccessoriesListEntries(asset)].reverse();
    const blocksByKey = {};

    chronological.forEach((entry) => {
        const kind = String(entry?.kind || 'manual');
        const sourceId = String(entry?.sourceHistoryId || '');
        // Ignore assignment_change / live_accessories written during this handover — otherwise
        // receiver edits always match the moving baseline and never show Changed / In Fine.
        if (historyId && sourceId && sourceId === historyId) return;
        if (kind === 'replaced_live') return;
        // Live overlays mirror in-progress list edits — not used for handover change detection.
        if (kind === 'live_accessories') return;

        if (!storedAccessoriesEntryHasAssessmentData(entry)) return;

        RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
            const block = resolveStoredAccessoriesItemBlock(entry, item.key);
            if (!block) return;
            if (block.present === true || block.present === false || block.photo) {
                blocksByKey[item.key] = block;
            }
        });
    });

    const form = {};
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const block = blocksByKey[item.key] || null;
        if (block && hasStoredAssessmentPhoto(block.photo)) {
            form[item.key] = { present: true, photo: block.photo };
            return;
        }
        const present = coerceAccessoryAssessmentPresent(block || {});
        form[item.key] = {
            present,
            photo: present === true ? block?.photo ?? null : null,
        };
    });

    return form;
}

/**
 * Baseline for handover changed / fine detection.
 * Merged committed accessories list, with previous handover assessment as fallback per key.
 */
export function buildHandoverReceiverAccessoryComparisonBaseline(
    asset,
    historyEntry = null,
    options = {},
) {
    const { assetHistory = [] } = options || {};
    const listBaseline = buildAccessoriesComparisonBaselineForm(asset, historyEntry, { assetHistory });
    const historyId = String(
        resolveHandoverDeleteHistoryId(historyEntry, asset, assetHistory) ||
            historyEntry?._id ||
            '',
    );
    const previousEntry = findPreviousAssessmentHandoverEntry(assetHistory, historyId, historyEntry);

    if (!previousEntry) return listBaseline;

    const form = {};
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const listRow = listBaseline[item.key] || { present: null, photo: null };
        const hasListBaseline =
            listRow.present === true ||
            listRow.present === false ||
            Boolean(listRow.photo);

        if (hasListBaseline) {
            form[item.key] = { ...listRow };
            return;
        }

        const block = resolveCurrentAssessmentItemBlock(previousEntry, item.key);
        const present = coerceAccessoryAssessmentPresent(block || {});
        const hasPreviousBaseline =
            present === true || present === false || Boolean(block?.photo);

        form[item.key] = hasPreviousBaseline
            ? {
                  present,
                  photo: present === true ? block?.photo ?? null : null,
              }
            : { present: null, photo: null };
    });

    return form;
}

export function findLatestStoredAccessoriesListEntry(asset) {
    const entries = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : [];
    if (!entries.length) return null;

    const ranked = [...entries].sort((a, b) => {
        const aTs = new Date(a?.createdAt || 0).getTime();
        const bTs = new Date(b?.createdAt || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });

    for (const entry of ranked) {
        if (String(entry?.kind || '') === 'assignment_change' && storedAccessoriesEntryHasAssessmentData(entry)) {
            return entry;
        }
    }

    for (const entry of ranked) {
        const kind = String(entry?.kind || 'manual');
        if (kind === 'live_accessories') continue;
        if (storedAccessoriesEntryHasAssessmentData(entry)) return entry;
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

/** Baseline for handover changed / fine detection — last committed snapshot only. */
export function buildAccessoriesHandoverComparisonBaseline(asset, historyEntry = null, options = {}) {
    return buildHandoverReceiverAccessoryComparisonBaseline(asset, historyEntry, options);
}

/** @deprecated Use buildAccessoriesHandoverComparisonBaseline — not previous handover/assignment. */
export function buildPreviousHandoverComparisonForm(historyEntry, vehicle, options = {}) {
    const { asset = vehicle } = options || {};
    return buildAccessoriesHandoverComparisonBaseline(asset, historyEntry, options);
}

export function buildAccessoriesAssessmentComparisonRows(historyEntry, asset, assetHistory = []) {
    const currentForm = buildAssessmentFormState(historyEntry, asset, {
        assetHistory,
        asset,
        currentEntry: historyEntry,
    });
    const previousForm = buildHandoverReceiverAccessoryComparisonBaseline(asset, historyEntry, {
        assetHistory,
    });

    return buildAssessmentFormComparisonRows(currentForm, historyEntry, assetHistory, {
        initialForm: previousForm,
        asset,
    });
}

export function accessoryListItemHasImage(liveListForm, itemKey) {
    const row = liveListForm?.[itemKey];
    return hasStoredAssessmentPhoto(row?.photo);
}

function buildLiveAccessoryFormRow(liveRow = {}) {
    const photo = liveRow.photo ?? null;
    if (hasStoredAssessmentPhoto(photo)) {
        return { present: true, photo };
    }
    if (liveRow.present === false) {
        return { present: false, photo: null };
    }
    return { present: null, photo: null };
}

/** Assign-page mirror: live image → Yes + photo; otherwise default No. */
export function buildMirrorLiveAccessoriesAssessmentForm(asset, historyEntry = null, options = {}) {
    const liveForm = buildAccessoriesLiveListForm(asset, historyEntry, options);
    const form = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const liveRow = liveForm[item.key] || {};
        if (hasStoredAssessmentPhoto(liveRow.photo)) {
            form[item.key] = { present: true, photo: liveRow.photo };
        } else {
            form[item.key] = { present: false, photo: null };
        }
    });

    return form;
}

/** Baseline row for red/green compare when mirroring live accessories on assign. */
export function buildMirrorLiveAccessoryBaselineRow(liveListForm, itemKey) {
    const liveRow = liveListForm?.[itemKey] || {};
    if (hasStoredAssessmentPhoto(liveRow.photo)) {
        return { present: true, photo: liveRow.photo };
    }
    return { present: false, photo: null };
}

export function buildAssessmentFormState(historyEntry, vehicle, options = {}) {
    const {
        asset = vehicle,
        assetHistory = [],
        mirrorLiveAccessories = false,
        mirrorBaselineForm = null,
    } = options || {};
    const liveListForm = buildAccessoriesLiveListForm(asset, historyEntry, { assetHistory });
    const form = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const currentBlock = resolveCurrentAssessmentItemBlock(historyEntry, item.key);
        const liveRow = liveListForm[item.key] || { present: null, photo: null };
        const baselineRow = mirrorBaselineForm?.[item.key] || { present: false, photo: null };

        if (mirrorLiveAccessories) {
            if (currentBlock?.present === true || currentBlock?.present === false) {
                form[item.key] = {
                    present: currentBlock.present,
                    photo:
                        currentBlock.present === true
                            ? currentBlock.photo ?? baselineRow.photo ?? null
                            : null,
                };
                return;
            }

            form[item.key] = {
                present: baselineRow.present === true ? true : false,
                photo:
                    baselineRow.present === true && hasStoredAssessmentPhoto(baselineRow.photo)
                        ? baselineRow.photo
                        : null,
            };
            return;
        }

        if (currentBlock?.present === true || currentBlock?.present === false) {
            form[item.key] = {
                present: currentBlock.present,
                photo:
                    currentBlock.present === true
                        ? currentBlock.photo ?? liveRow.photo ?? null
                        : null,
            };
            return;
        }

        form[item.key] = buildLiveAccessoryFormRow(liveRow);
    });

    return form;
}

/** Ensure every accessory row is explicit before Process Next in mirror-live assign mode. */
export function normalizeMirrorLiveAssessmentFormForComplete(form, mirrorBaselineForm = {}) {
    const normalized = cloneAssessmentForm(form);

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = normalized[item.key] || {};
        const baselineRow = mirrorBaselineForm[item.key] || { present: false, photo: null };

        if (row.present === true) {
            normalized[item.key] = {
                present: true,
                photo:
                    row.photo ??
                    (baselineRow.present === true ? baselineRow.photo ?? null : null),
            };
            return;
        }

        if (row.present === false) {
            normalized[item.key] = { present: false, photo: null };
            return;
        }

        normalized[item.key] = {
            present: baselineRow.present === true ? true : false,
            photo:
                baselineRow.present === true && hasStoredAssessmentPhoto(baselineRow.photo)
                    ? baselineRow.photo
                    : null,
        };
    });

    return normalized;
}

/** After inspection is saved or sent to HR, keep assessment rows from history — not a stale live overlay. */
export function shouldLockInspectionAssessmentToHistory(vehicle, historyEntry = null) {
    const inspStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    return (
        historyEntry?.details?.receiverAssessmentCompleted === true ||
        hasCurrentReceiverAssessmentDataOnHistory(historyEntry) ||
        inspStatus === 'pending_hr' ||
        inspStatus === 'active'
    );
}

/** Inspection accessories form: live mirror while drafting; locked to saved history after submit/HR. */
export function buildInspectionHandoverAssessmentForm(asset, historyEntry = null, options = {}) {
    const { assetHistory = [] } = options || {};
    if (shouldLockInspectionAssessmentToHistory(asset, historyEntry)) {
        return buildAssessmentFormState(historyEntry, asset, {
            assetHistory,
            asset,
            currentEntry: historyEntry,
        });
    }
    return buildMirrorLiveAccessoriesAssessmentForm(asset, historyEntry, { assetHistory });
}

/** Current Live Accessories tab rows — committed list merged with live_accessories overlay. */
export function buildAccessoriesLiveListForm(asset, historyEntry = null, options = {}) {
    if (!asset) return cloneAssessmentForm({});

    const { assetHistory = [] } = options || {};
    const committed = buildAccessoriesComparisonBaselineForm(asset, historyEntry, { assetHistory });
    const liveEntry = findLatestLiveAccessoriesEntry(asset);
    const form = cloneAssessmentForm(committed);

    if (!liveEntry) return form;

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const rawBlock = liveEntry[item.key];
        if (!rawBlock || typeof rawBlock !== 'object') return;
        const photo = rawBlock.photo ?? null;
        if (hasStoredAssessmentPhoto(photo)) {
            form[item.key] = { present: true, photo };
            return;
        }
        if (rawBlock.present === false) {
            form[item.key] = { present: false, photo: null };
        } else if (rawBlock.present === true) {
            form[item.key] = { present: true, photo: photo || null };
        }
    });

    return form;
}

/** Merged live list + comparison baseline + previous handover — for handover cards display. */
export function buildAccessoryHandoverCardSourceForm(asset, historyEntry = null, options = {}) {
    const live = buildAccessoriesLiveListForm(asset, historyEntry, options);
    const baseline = buildHandoverReceiverAccessoryComparisonBaseline(asset, historyEntry, options);
    const previous = buildPreviousHandoverAccessoryForm(historyEntry, options);
    const merged = cloneAssessmentForm(live);

    const fillMissingFrom = (source) => {
        RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
            if (accessoryListItemHasImage(merged, item.key)) return;
            const row = source?.[item.key] || {};
            if (hasStoredAssessmentPhoto(row.photo)) {
                merged[item.key] = { present: true, photo: row.photo };
            } else if (row.present === false) {
                merged[item.key] = { present: false, photo: null };
            } else if (row.present === true) {
                merged[item.key] = { present: true, photo: row.photo ?? null };
            }
        });
    };

    fillMissingFrom(baseline);
    fillMissingFrom(previous);
    return merged;
}

/** Previous assignment handover assessment — for "Same as previous" on receiver cards. */
export function buildPreviousHandoverAccessoryForm(historyEntry, options = {}) {
    const { assetHistory = [] } = options || {};
    const historyId = String(historyEntry?._id || '');
    const previousEntry = findPreviousAssessmentHandoverEntry(assetHistory, historyId, historyEntry);
    const form = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        if (!previousEntry) {
            form[item.key] = { present: null, photo: null };
            return;
        }
        const block = resolveCurrentAssessmentItemBlock(previousEntry, item.key);
        const present = coerceAccessoryAssessmentPresent(block || {});
        const hasData = present === true || present === false || Boolean(block?.photo);
        form[item.key] = hasData
            ? {
                  present: present ?? null,
                  photo: present === true ? block?.photo ?? null : null,
              }
            : { present: null, photo: null };
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
        const sourceBlock = resolveCurrentAssessmentItemBlock(historyEntry, item.key) || {};
        const comment = String(
            row.comment ?? sourceBlock.comment ?? sourceBlock.notes ?? '',
        ).trim();

        return {
            ...item,
            present,
            photo,
            amount,
            comment,
            yesLabel: present === true ? 'Yes' : present === false ? 'No' : '—',
            photoRequired: present === true,
            photoMissing: present === true && !resolveAssessmentMediaUrl(photo),
            photoUrl: present === true ? resolveAssessmentMediaUrl(photo) : null,
        };
    });
}

const VEHICLE_ACCESSORY_PRICE_ALIASES = {
    spareTyre: ['spare tyre', 'spare tire', 'tyre', 'tire', 'spare type', 'spare tools'],
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
    const storedBaselineEntry = findPreviousAccessoriesListBaselineEntry(asset, latestEntry?._id, {
        historyEntry: latestEntry,
        assetHistory,
    });

    const currentRows = buildReceiverAssessmentRows(latestEntry, asset, {
        assetHistory,
        asset,
    });
    const liveOverlayEntry = findLatestLiveAccessoriesEntry(asset);
    const overlayRows = liveOverlayEntry
        ? buildAccessoriesListRowsFromStoredEntry(liveOverlayEntry, asset)
        : [];
    const mergedCurrentRows =
        overlayRows.length > 0
            ? RECEIVER_ASSESSMENT_ITEMS.map((item) => {
                const overlayRow = overlayRows.find((row) => row.key === item.key);
                const handoverRow = currentRows.find((row) => row.key === item.key);
                if (!overlayRow) return handoverRow || { ...item, present: null, photo: null, amount: null, photoUrl: null };
                if (
                    !handoverRow ||
                    (overlayRow.present === true || overlayRow.photoUrl) &&
                    !(handoverRow.present === true || handoverRow.photoUrl)
                ) {
                    return overlayRow;
                }
                if (handoverRow.present === true || handoverRow.photoUrl) return handoverRow;
                return overlayRow;
            })
            : currentRows;
    const previousRows = storedBaselineEntry
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
            label: 'Previous accessories',
            createdAt: storedBaselineEntry?.createdAt || null,
            rows: previousRows,
            isPrimary: false,
            highlight: false,
            changedByKey: {},
        });
        sets.push({
            id: 'new-assignment',
            label: 'New assignment',
            createdAt: latestEntry?.createdAt || latestEntry?.date || null,
            rows: mergedCurrentRows.map((row) => ({ ...row, changed: Boolean(changedByKey[row.key]) })),
            isPrimary: true,
            highlight: true,
            changedByKey,
        });
    } else if (
        mergedCurrentRows.some(
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
            rows: mergedCurrentRows,
            isPrimary: true,
            highlight: false,
            changedByKey: {},
        });
    }

    const manualEntries = (Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : []
    ).filter((entry) => {
        const kind = String(entry?.kind || 'manual');
        if (kind === 'assignment_change') return false;
        if (kind === 'replaced_live') return false;
        if (kind === 'live_accessories') return false;
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

    return { sets, headerRows: mergedCurrentRows.length ? mergedCurrentRows : RECEIVER_ASSESSMENT_ITEMS };
}

export function resolveAccessoriesListLatestRowSet(displaySets = []) {
    return (
        displaySets.find((set) => set.id === 'new-assignment') ||
        displaySets.find((set) => set.id === 'primary') ||
        displaySets.find((set) => set.isPrimary) ||
        displaySets[0] ||
        null
    );
}

/** Split handover accessory columns into live (present) vs lost (missing / changed away). */
export function classifyVehicleHandoverAccessoryKeys(
    displaySets = [],
    { finedKeys = [], waivedKeys = [] } = {},
) {
    const latestSet = resolveAccessoriesListLatestRowSet(displaySets);
    const previousSet = displaySets.find((set) => set.id === 'previous-handover');
    const previousByKey = Object.fromEntries(
        (previousSet?.rows || []).map((row) => [row.key, row]),
    );
    const changedByKey = latestSet?.changedByKey || {};
    const finedSet = new Set(finedKeys);
    const waivedSet = new Set(waivedKeys);

    const liveKeys = [];
    const lostKeys = [];

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = latestSet?.rows?.find((entry) => entry.key === item.key);
        if (!row) return;

        const present = row.present;
        const changed = Boolean(changedByKey[item.key]);
        const wasPresent = previousByKey[item.key]?.present === true;
        const missingNow = present === false || (changed && wasPresent && present !== true);
        const inFineFlow = finedSet.has(item.key) || waivedSet.has(item.key);

        // "Changed" vs accessories list is for handover fines only — not lost tab when still present.
        const isLost = missingNow || inFineFlow;

        if (!isLost && present === true && hasStoredAssessmentPhoto(row.photo)) {
            liveKeys.push(item.key);
        }
        if (isLost) {
            lostKeys.push(item.key);
        }
    });

    return { liveKeys, lostKeys, latestSet };
}

export function buildLiveAccessoriesListView(displaySets, headerRows, liveKeys) {
    const latestSet = resolveAccessoriesListLatestRowSet(displaySets);
    if (!latestSet || !liveKeys.length) {
        return { sets: [], headerRows: [] };
    }

    return filterVehicleAccessoriesListByKeys(
        [
            {
                ...latestSet,
                id: 'current-accessories',
                label: 'Current accessories',
                highlight: false,
                changedByKey: {},
            },
        ],
        headerRows,
        liveKeys,
    );
}

export function buildLostAccessoriesListView(displaySets, headerRows, lostKeys, asset = null) {
    if (!lostKeys.length) {
        return { sets: [], headerRows: [] };
    }

    const keySet = new Set(lostKeys);
    const previousSet = displaySets.find((set) => set.id === 'previous-handover');
    const latestSet = resolveAccessoriesListLatestRowSet(displaySets);
    const previousByKey = Object.fromEntries(
        (previousSet?.rows || []).map((row) => [row.key, row]),
    );

    const bestHistoricalByKey = {};
    displaySets.forEach((set) => {
        set.rows?.forEach((row) => {
            if (!keySet.has(row.key)) return;
            const candidate = enrichLostAccessoryDisplayRow(row, null, asset);
            const existing = bestHistoricalByKey[row.key];
            if (!existing || lostAccessoryRowRichness(candidate) > lostAccessoryRowRichness(existing)) {
                bestHistoricalByKey[row.key] = candidate;
            }
        });
    });

    const consolidatedRows = lostKeys
        .map((key) => {
            const item = RECEIVER_ASSESSMENT_ITEMS.find((entry) => entry.key === key);
            const currentRow =
                latestSet?.rows?.find((entry) => entry.key === key) ||
                item ||
                { key, label: key };
            const historicalRow = bestHistoricalByKey[key] || null;
            const previousRow =
                previousByKey[key] ||
                (historicalRow && lostAccessoryRowRichness(historicalRow) > lostAccessoryRowRichness(currentRow)
                    ? historicalRow
                    : null);
            return enrichLostAccessoryDisplayRow(currentRow, previousRow, asset);
        })
        .filter(Boolean);

    if (!consolidatedRows.length) {
        return { sets: [], headerRows: [] };
    }

    return {
        sets: [
            {
                id: 'lost-accessories',
                label: 'Lost accessories',
                rows: consolidatedRows,
                highlight: false,
                changedByKey: Object.fromEntries(lostKeys.map((key) => [key, true])),
            },
        ],
        headerRows: consolidatedRows,
    };
}

function lostAccessoryRowRichness(row) {
    let score = 0;
    if (row?.photoUrl) score += 4;
    if (row?.photo) score += 2;
    if (row?.amount != null && row.amount !== '') score += 1;
    if (row?.present === true) score += 1;
    return score;
}

/** Merge current lost row with the last known good handover snapshot for display. */
export function enrichLostAccessoryDisplayRow(row, previousRow, asset = null) {
    if (!row?.key) return null;

    const previous = previousRow || {};
    const currentPresent = row.present ?? null;
    const previousPresent = previous.present ?? null;
    const photo =
        row.photo ??
        (currentPresent !== true ? previous.photo ?? null : null) ??
        previous.photo ??
        null;
    const amount =
        row.amount != null && row.amount !== ''
            ? row.amount
            : previous.amount != null && previous.amount !== ''
                ? previous.amount
                : resolveVehicleAccessoryItemPrice(asset, row.key, row.label, previous) ??
                resolveVehicleAccessoryItemPrice(asset, row.key, row.label, row);
    const photoUrl =
        resolveAssessmentMediaUrl(photo) ||
        previous.photoUrl ||
        previous.lostDisplayPhotoUrl ||
        null;

    return {
        ...row,
        label: row.label || previous.label || row.key,
        present: row.isReplacedArchive ? false : currentPresent,
        previousPresent,
        photo,
        amount,
        photoUrl,
        lostDisplayPhotoUrl: photoUrl,
        showLostHistoricalImage: currentPresent !== true && Boolean(photoUrl),
    };
}

/** Lost tab rows: handover items plus catalog detached accessories in one list. */
export function buildLostAccessoriesTabView(displaySets, headerRows, lostKeys, asset = null) {
    const handoverView = buildLostAccessoriesListView(displaySets, headerRows, lostKeys, asset);
    const replacedRows = buildReplacedLiveAccessoryRows(asset).map((row, index) => ({
        ...row,
        key: row.listKey || (row.archiveId ? `replaced-${row.archiveId}` : `replaced-${row.key}-${index}`),
    }));
    const detachedRows = buildLostDetachedAccessoryRows(asset).map((entry) => ({
        key: `detached-${entry.id}`,
        label: entry.label,
        accessoryId: entry.accessoryId,
        photoUrl: entry.photoUrl,
        photo: entry.photoUrl,
        amount: entry.amount,
        present: false,
        previousPresent: true,
        lostDisplayPhotoUrl: entry.photoUrl,
        showLostHistoricalImage: Boolean(entry.photoUrl),
        isDetachedCatalog: true,
        detachedStatus: entry.status || 'Lost',
    }));

    const handoverRows = handoverView.sets[0]?.rows || [];
    const allRows = [...handoverRows, ...replacedRows, ...detachedRows];

    if (!allRows.length) {
        return { sets: [], headerRows: [] };
    }

    return {
        sets: [
            {
                id: 'lost-accessories',
                label: 'Lost accessories',
                rows: allRows,
                highlight: false,
                changedByKey: handoverView.sets[0]?.changedByKey || {},
            },
        ],
        headerRows: allRows,
    };
}

export function filterVehicleAccessoriesListByKeys(displaySets, headerRows, keys) {
    const keySet = new Set(keys);
    if (!keySet.size) {
        return { sets: [], headerRows: [] };
    }

    const filteredHeader = (headerRows?.length ? headerRows : RECEIVER_ASSESSMENT_ITEMS).filter((row) =>
        keySet.has(row.key),
    );
    const filteredSets = displaySets
        .map((set) => ({
            ...set,
            rows: set.rows.filter((row) => keySet.has(row.key)),
        }))
        .filter((set) => set.rows.length > 0);

    return { sets: filteredSets, headerRows: filteredHeader };
}

/** Catalog accessories marked lost / detached after L&D (shown on Lost Accessories tab). */
export function buildLostDetachedAccessoryRows(asset) {
    const rows = [];
    const seen = new Set();

    (asset?.accessories || []).forEach((acc) => {
        const status = String(acc?.status || '').trim().toLowerCase();
        if (status !== 'lost' && status !== 'damaged') return;
        const id = String(acc?.accessoryId || acc?._id || '');
        if (id && seen.has(id)) return;
        if (id) seen.add(id);
        rows.push({
            id: id || `attached-${rows.length}`,
            accessoryId: acc.accessoryId || '—',
            label: acc.name || 'Accessory',
            amount: acc.amount,
            photoUrl: resolveAssessmentMediaUrl(acc.attachment),
            status: acc.status || 'Lost',
            source: 'attached',
        });
    });

    (asset?.lostDetachedAccessories || []).forEach((acc, index) => {
        const id = String(acc?.accessoryId || `detached-${index}`);
        if (seen.has(id)) return;
        seen.add(id);
        rows.push({
            id,
            accessoryId: acc.accessoryId || '—',
            label: acc.name || 'Accessory',
            amount: acc.amount,
            photoUrl: null,
            status: 'Lost',
            source: 'detached',
            detachedAt: acc.detachedAt || null,
        });
    });

    return rows;
}

export function findLatestLiveAccessoriesEntry(asset) {
    const entries = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : [];
    const liveEntries = entries.filter((entry) => String(entry?.kind || '') === 'live_accessories');
    if (!liveEntries.length) return null;
    return [...liveEntries].sort((a, b) => {
        const aTs = new Date(a?.createdAt || 0).getTime();
        const bTs = new Date(b?.createdAt || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    })[0];
}

export function resolveCurrentLiveAccessoryRow(displaySets, accessoryKey, asset = null) {
    const latestSet = resolveAccessoriesListLatestRowSet(displaySets);
    const row = latestSet?.rows?.find((entry) => entry.key === accessoryKey);
    if (row && (row.present === true || row.photoUrl || row.photo)) {
        return row;
    }

    if (!asset || !accessoryKey) return null;

    const liveForm = buildAccessoriesLiveListForm(asset);
    const liveRow = liveForm[accessoryKey];
    if (liveRow?.present !== true || !hasStoredAssessmentPhoto(liveRow.photo)) {
        return null;
    }

    const item = RECEIVER_ASSESSMENT_ITEMS.find((entry) => entry.key === accessoryKey);
    return {
        key: accessoryKey,
        label: item?.label || accessoryKey,
        present: true,
        photo: liveRow.photo,
        photoUrl: resolveAssessmentMediaUrl(liveRow.photo),
        amount: liveRow.amount ?? null,
    };
}

export function serializeSingleAccessoryReplacedEntry(accessoryKey, row, options = {}) {
    const { sourceHistoryId = null } = options;
    const entry = {
        createdAt: new Date().toISOString(),
        kind: 'replaced_live',
        replacedKey: accessoryKey,
        changedByKey: { [accessoryKey]: true },
    };
    if (sourceHistoryId) entry.sourceHistoryId = sourceHistoryId;
    entry[accessoryKey] = {
        present: true,
        photo: photoForAccessoryStorage(row?.photo ?? row?.photoUrl ?? null),
        amount: row?.amount != null && row.amount !== '' ? Number(row.amount) : null,
    };
    return entry;
}

export function cloneVehicleAccessoriesListEntries(asset) {
    return Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries.map((entry) => {
            const serialized = {
                createdAt: entry.createdAt || new Date().toISOString(),
                kind: entry.kind || 'manual',
            };
            if (entry._id) serialized._id = entry._id;
            if (entry.sourceHistoryId) serialized.sourceHistoryId = entry.sourceHistoryId;
            if (entry.replacedKey) serialized.replacedKey = entry.replacedKey;
            if (entry.changedByKey) serialized.changedByKey = entry.changedByKey;
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

function liveAccessoryRowHasArchiveableState(row = {}) {
    return (
        row.present === true ||
        row.present === false ||
        hasStoredAssessmentPhoto(row.photo)
    );
}

function shouldArchiveLiveAccessoryEdit(previousRow = {}, nextRow = {}) {
    if (!liveAccessoryRowHasArchiveableState(previousRow)) return false;
    if (nextRow.present === false && previousRow.present !== false) return true;
    return accessoryAssessmentItemChanged(previousRow, nextRow);
}

/** Sync a single live-accessory edit: update live_accessories; prior value goes to replaced_live (Old). */
export function buildLiveAccessoryEditSyncPlan({
    asset,
    historyEntry = null,
    accessoryKey,
    nextRow = {},
}) {
    const liveForm = buildAccessoriesLiveListForm(asset, historyEntry);
    const currentRow = liveForm[accessoryKey] || { present: null, photo: null };
    const normalizedNext = {
        present: nextRow.present === true ? true : nextRow.present === false ? false : null,
        photo:
            nextRow.present === false
                ? null
                : nextRow.photo ?? (nextRow.present === true ? currentRow.photo ?? null : null),
    };
    if (normalizedNext.present == null && hasStoredAssessmentPhoto(normalizedNext.photo)) {
        normalizedNext.present = true;
    }

    const mergedForm = cloneAssessmentForm(liveForm);
    mergedForm[accessoryKey] = { ...normalizedNext };

    let nextEntries = cloneVehicleAccessoriesListEntries(asset).filter(
        (entry) => String(entry?.kind || '') !== 'live_accessories',
    );

    const archivePrevious = shouldArchiveLiveAccessoryEdit(currentRow, normalizedNext);
    if (archivePrevious) {
        nextEntries.push(
            serializeSingleAccessoryReplacedEntry(
                accessoryKey,
                {
                    present: currentRow.present === false ? false : true,
                    photo: currentRow.photo ?? null,
                    amount: currentRow.amount ?? null,
                },
                { sourceHistoryId: historyEntry?._id || null },
            ),
        );
    }

    nextEntries.push(
        serializeVehicleAccessoriesListEntry(mergedForm, {
            kind: 'live_accessories',
            sourceHistoryId: historyEntry?._id || null,
        }),
    );

    return {
        nextEntries,
        mergedForm,
        assessmentPayload: buildAssessmentPayload(mergedForm),
        archivedPrevious: archivePrevious,
        accessoryKey,
    };
}

/** Previous (Old) accessories from replaced_live entries — mirrors Accessories List Lost/Old rows. */
export function buildPreviousAccessoriesFromReplacedLive(asset) {
    const form = cloneAssessmentForm({});
    buildReplacedLiveAccessoryRows(asset).forEach((row) => {
        if (!row?.key) return;
        form[row.key] = {
            present: row.present === false ? false : true,
            photo: row.photo ?? null,
        };
    });
    return form;
}

export function buildAccessoryReplacementSavePlan({
    asset,
    historyEntry,
    displaySets,
    accessoryKey,
    photo,
    amount = '',
}) {
    const currentRow = resolveCurrentLiveAccessoryRow(displaySets, accessoryKey, asset);
    const isReplacing = Boolean(currentRow);
    const latestSet = resolveAccessoriesListLatestRowSet(displaySets);
    const baseRows = latestSet?.rows?.length ? latestSet.rows : [];
    const mergedForm = baseRows.length
        ? buildAccessoriesListEditForm(baseRows)
        : cloneAssessmentForm(buildAccessoriesLiveListForm(asset, historyEntry));

    mergedForm[accessoryKey] = {
        present: true,
        photo,
        amount:
            amount != null && String(amount).trim() !== ''
                ? String(amount)
                : mergedForm[accessoryKey]?.amount || '',
    };

    let nextEntries = cloneVehicleAccessoriesListEntries(asset).filter(
        (entry) => String(entry?.kind || '') !== 'live_accessories',
    );

    if (isReplacing && currentRow) {
        nextEntries.push(
            serializeSingleAccessoryReplacedEntry(accessoryKey, currentRow, {
                sourceHistoryId: historyEntry?._id || null,
            }),
        );
    }

    nextEntries.push(
        serializeVehicleAccessoriesListEntry(mergedForm, {
            kind: 'live_accessories',
            sourceHistoryId: historyEntry?._id || null,
        }),
    );

    return {
        assessmentPayload: buildAssessmentPayload(mergedForm),
        nextEntries,
        mergedForm,
        isReplacing,
        accessoryKey,
    };
}

/** Flat live rows for Accessories List tab (Type / Image / Status). */
export function buildFlatLiveAccessoryRows(asset, assetHistory = []) {
    if (!asset) return [];

    const historyEntry = resolveAccessoriesListPrimaryHandoverEntry(asset, assetHistory);
    const form = buildAccessoriesLiveListForm(asset, historyEntry, { assetHistory });

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const row = form[item.key] || {};
        if (row.present !== true || !hasStoredAssessmentPhoto(row.photo)) return null;

        const amount = resolveVehicleAccessoryItemPrice(asset, item.key, item.label, row);
        return {
            key: item.key,
            listKey: `live-${item.key}`,
            label: item.label,
            present: true,
            photo: row.photo,
            amount,
            photoUrl: resolveAssessmentMediaUrl(row.photo),
            status: 'Live',
        };
    }).filter(Boolean);
}

/** Flat old rows from replaced_live archives (same type re-added moves prior here). */
export function buildFlatOldAccessoryRows(asset) {
    return buildReplacedLiveAccessoryRows(asset).map((row, index) => ({
        ...row,
        listKey: row.listKey || (row.archiveId ? `old-${row.archiveId}` : `old-${row.key}-${index}`),
        status: 'Old',
    }));
}

export function buildReplacedLiveAccessoryRows(asset) {
    const entries = Array.isArray(asset?.vehicleAccessoriesListEntries)
        ? asset.vehicleAccessoriesListEntries
        : [];
    return [...entries]
        .filter((entry) => String(entry?.kind || '') === 'replaced_live')
        .sort((a, b) => {
            const aTs = new Date(a?.createdAt || 0).getTime();
            const bTs = new Date(b?.createdAt || 0).getTime();
            return bTs - aTs;
        })
        .map((entry, index) => {
            const key =
                entry.replacedKey ||
                RECEIVER_ASSESSMENT_ITEMS.find((item) => entry[item.key]?.photo || entry[item.key]?.present != null)
                    ?.key;
            if (!key) return null;
            const item = RECEIVER_ASSESSMENT_ITEMS.find((entryItem) => entryItem.key === key);
            const block = entry[key] || {};
            return enrichLostAccessoryDisplayRow(
                {
                    key,
                    listKey: entry._id ? String(entry._id) : `replaced-${key}-${index}`,
                    label: item?.label || key,
                    present: false,
                    photo: block.photo ?? null,
                    amount: block.amount ?? null,
                    isReplacedArchive: true,
                    archiveId: entry._id || `replaced-${index}`,
                },
                null,
                asset,
            );
        })
        .filter(Boolean);
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
        const present = row.present;
        const photo = photoForAccessoryStorage(row.photo);
        if (present !== true && present !== false && !photo) return;
        if (present === true && !photo) return;
        entry[item.key] = {
            present,
            photo: present === true ? photo : null,
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

/** Stable key for server-persisted assessment — avoids resetting the draft on parent re-renders. */
export function buildReceiverAssessmentRemoteSyncKey(historyEntry) {
    const historyEntryId = historyEntry?._id ?? '';
    const source =
        historyEntry?.details?.receiverAssessment ??
        historyEntry?.details?.vehicleAssessmentReportByReceiver ??
        null;
    if (!source || typeof source !== 'object') {
        return `${historyEntryId}|empty`;
    }
    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const row = source[item.key];
        if (!row || typeof row !== 'object') return `${item.key}:`;
        return `${item.key}:${row.present ?? ''}:${normalizeAccessoriesPhotoKey(row.photo)}`;
    }).join('|');
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
        // Bare S3 storage keys cannot be rendered without a signed URL from the API.
        return null;
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

export function isAssessmentFormComplete(form, options = {}) {
    return Object.keys(validateAssessmentForm(form, options)).length === 0;
}

export function validateAssessmentForm(form, options = {}) {
    const { liveListForm = null, requireAllItems = false } = options || {};
    const errors = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = form?.[item.key];
        const listHasImage =
            requireAllItems || accessoryListItemHasImage(liveListForm, item.key);

        if (!listHasImage) {
            return;
        }

        if (!row || (row.present !== true && row.present !== false)) {
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

/** Partial save — only keys the user has explicitly set Yes/No on (avoids backend 400 on unset items). */
export function buildDraftAssessmentPayload(form) {
    const payload = {};
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = form?.[item.key];
        if (!row || (row.present !== true && row.present !== false)) return;
        const entry = {
            present: row.present,
            photo: row.present === true ? photoForAccessoryStorage(row.photo) : null,
        };
        if (row.amount != null && row.amount !== '' && Number.isFinite(Number(row.amount))) {
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
