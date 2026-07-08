import { hasAssessmentPhoto, isReceiverAssessmentMarkedDone, resolveAssessmentMediaUrl } from './vehicleHandoverReceiverAssessment';
import {
    findPreviousBodyConditionHandoverEntry,
    mergeBodyConditionViewFromPrevious,
    buildPriorHandoverCandidates,
} from './vehicleHandoverPreviousReports';
import { photosDiffer } from './vehicleHandoverPhotoComparison';

export const BODY_CONDITION_PHOTO_SOURCE = {
    PREVIOUS: 'previous',
    NEW: 'new',
};

export const BODY_CONDITION_VIEW_FIELDS = [
    { key: 'frontView', label: 'Front View' },
    { key: 'backView', label: 'Back View' },
    { key: 'frontRightCorner', label: 'Front Right Corner' },
    { key: 'backRightCorner', label: 'Back Right Corner' },
    { key: 'frontLeftCorner', label: 'Front Left Corner' },
    { key: 'backLeftCorner', label: 'Back Left Corner' },
    { key: 'frontRightDoor', label: 'Front Right Door' },
    { key: 'backRightDoor', label: 'Back Right Door' },
    { key: 'frontLeftDoor', label: 'Front Left Door' },
    { key: 'backLeftDoor', label: 'Back Left Door' },
    { key: 'frontInsideView', label: 'Front Inside View' },
    { key: 'backInsideView', label: 'Back Inside View' },
    { key: 'frontDashBoard', label: 'Front Dash Board' },
    { key: 'carTopView', label: 'CAR Top View' },
];

export const BODY_CONDITION_CARDS_PER_ROW = 4;

export const BODY_CONDITION_ROW_PAIRS = [
    { left: 'frontView', right: 'backView' },
    { left: 'frontRightCorner', right: 'backRightCorner' },
    { left: 'frontLeftCorner', right: 'backLeftCorner' },
    { left: 'frontRightDoor', right: 'backRightDoor' },
    { left: 'frontLeftDoor', right: 'backLeftDoor' },
    { left: 'frontInsideView', right: 'backInsideView' },
    { left: 'frontDashBoard', right: 'carTopView' },
];

export function getBodyConditionRowChunks(cardsPerRow = BODY_CONDITION_CARDS_PER_ROW) {
    const chunks = [];
    for (let index = 0; index < BODY_CONDITION_VIEW_FIELDS.length; index += cardsPerRow) {
        chunks.push(BODY_CONDITION_VIEW_FIELDS.slice(index, index + cardsPerRow).map((field) => field.key));
    }
    return chunks;
}

const FIELD_BY_KEY = Object.fromEntries(
    BODY_CONDITION_VIEW_FIELDS.map((field) => [field.key, field]),
);

export function resolveBodyConditionSource(historyEntry) {
    const candidates = [
        historyEntry?.details?.bodyConditionReport,
        historyEntry?.details?.bodyCondition,
        historyEntry?.bodyConditionReport,
    ];
    return candidates.find((item) => item && typeof item === 'object') || null;
}

function pickViewBlock(source, key) {
    if (!source || typeof source !== 'object') return { comment: '', photo: null };
    const block = source[key];
    if (!block || typeof block !== 'object') {
        return {
            comment: String(source[`${key}Comment`] || '').trim(),
            photo: source[`${key}Photo`] ?? null,
        };
    }
    return {
        comment: String(block.comment ?? block.notes ?? '').trim(),
        photo: block.photo ?? block.image ?? block.attachment ?? null,
        photoSource:
            block.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
            block.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW
                ? block.photoSource
                : null,
        userSelected: block.userSelected === true,
    };
}

export function findLatestBodyConditionHandoverEntry(assetHistory) {
    if (!Array.isArray(assetHistory) || !assetHistory.length) return null;

    const sorted = [...assetHistory].sort((a, b) => {
        const aTs = new Date(a?.createdAt || a?.date || 0).getTime();
        const bTs = new Date(b?.createdAt || b?.date || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });

    return sorted.find((row) => hasBodyConditionReportData(row)) || null;
}

export function buildBodyConditionCurrentFormState(historyEntry) {
    const source = resolveBodyConditionSource(historyEntry);
    const form = {};

    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        form[field.key] = pickViewBlock(source, field.key);
    });

    return form;
}

function resolveBodyConditionPreviousEntry(historyEntry, options = {}) {
    const { assetHistory, currentEntry = historyEntry } = options || {};
    if (!assetHistory?.length) return null;

    let previousEntry = findPreviousBodyConditionHandoverEntry(
        assetHistory,
        historyEntry?._id,
        currentEntry,
    );

    if (!previousEntry) {
        previousEntry = findLatestBodyConditionHandoverEntry(assetHistory);
        const currentId = String(historyEntry?._id || '');
        if (previousEntry && String(previousEntry._id) === currentId) {
            previousEntry = null;
        }
    }

    return previousEntry;
}

function pickBestPreviousViewBlock(historyEntry, fieldKey, options = {}) {
    const { assetHistory, currentEntry = historyEntry } = options;
    const candidates = [];

    const previousEntry = resolveBodyConditionPreviousEntry(historyEntry, options);
    if (previousEntry) {
        const block = pickViewBlock(resolveBodyConditionSource(previousEntry), fieldKey);
        if (hasAssessmentPhoto(block.photo)) candidates.push(block);
    }

    if (Array.isArray(assetHistory) && assetHistory.length && historyEntry?._id) {
        const priorRows = buildPriorHandoverCandidates(assetHistory, historyEntry._id, currentEntry);
        for (const row of priorRows) {
            const block = pickViewBlock(resolveBodyConditionSource(row), fieldKey);
            if (hasAssessmentPhoto(block.photo)) {
                candidates.push(block);
                break;
            }
        }
    }

    if (!candidates.length) {
        return { comment: '', photo: null };
    }

    return candidates.reduce((best, block) => {
        if (!hasAssessmentPhoto(best?.photo)) return block;
        if (!hasAssessmentPhoto(block?.photo)) return best;
        return best;
    });
}

export function buildBodyConditionPreviousFormState(historyEntry, options = {}) {
    const form = {};

    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        form[field.key] = pickBestPreviousViewBlock(historyEntry, field.key, options);
    });

    return form;
}

export function inferBodyConditionPhotoSource(currentRow, previousRow) {
    if (!hasAssessmentPhoto(currentRow?.photo)) return null;
    if (
        hasAssessmentPhoto(previousRow?.photo) &&
        !photosDiffer(previousRow.photo, currentRow.photo)
    ) {
        return BODY_CONDITION_PHOTO_SOURCE.PREVIOUS;
    }
    return BODY_CONDITION_PHOTO_SOURCE.NEW;
}

/** True when the assignee explicitly chose Previous / New via Add (not auto-seeded). */
export function isBodyConditionRowUserSelected(cur, previousRow) {
    if (cur?.userSelected === true) return true;
    if (String(cur?.comment || '').trim()) return true;
    if (!hasAssessmentPhoto(cur?.photo)) return false;

    const source = cur?.photoSource;
    if (source !== BODY_CONDITION_PHOTO_SOURCE.PREVIOUS && source !== BODY_CONDITION_PHOTO_SOURCE.NEW) {
        return false;
    }
    if (source === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS) return true;
    if (!hasAssessmentPhoto(previousRow?.photo)) return true;
    return photosDiffer(previousRow.photo, cur.photo);
}

function resolveBodyConditionRowPhotoSource(cur, previousRow, { sectionDone = false } = {}) {
    const stored = cur?.photoSource;
    if (
        stored === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
        stored === BODY_CONDITION_PHOTO_SOURCE.NEW
    ) {
        return stored;
    }
    if (!sectionDone) return null;
    return inferBodyConditionPhotoSource(cur, previousRow);
}

export function buildBodyConditionEditableFormState(historyEntry, options = {}) {
    const current = buildBodyConditionCurrentFormState(historyEntry);
    const previous = buildBodyConditionPreviousFormState(historyEntry, options);
    const sectionDone = isBodyConditionMarkedDone(historyEntry);
    const form = {};

    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        const cur = current[field.key] || { comment: '', photo: null };

        if (!sectionDone && !isBodyConditionRowUserSelected(cur, previous[field.key])) {
            form[field.key] = {
                comment: String(cur.comment || '').trim(),
                photo: null,
                photoSource: null,
                userSelected: false,
            };
            return;
        }

        form[field.key] = {
            comment: String(cur.comment || '').trim(),
            photo: cur.photo ?? null,
            photoSource: resolveBodyConditionRowPhotoSource(cur, previous[field.key], { sectionDone }),
            userSelected: cur.userSelected === true,
        };
    });

    return form;
}

export function buildBodyConditionFormState(historyEntry, options = {}) {
    const { assetHistory, currentEntry = historyEntry } = options || {};
    let previousEntry = assetHistory?.length
        ? findPreviousBodyConditionHandoverEntry(assetHistory, historyEntry?._id, currentEntry)
        : null;

    if (!previousEntry && assetHistory?.length) {
        const latest = findLatestBodyConditionHandoverEntry(assetHistory);
        const currentId = String(historyEntry?._id || '');
        if (latest && String(latest._id) !== currentId) {
            previousEntry = latest;
        }
    }

    const source = resolveBodyConditionSource(historyEntry);
    const previousSource = previousEntry ? resolveBodyConditionSource(previousEntry) : null;
    const form = {};

    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        const currentBlock = pickViewBlock(source, field.key);
        const previousBlock = previousSource ? pickViewBlock(previousSource, field.key) : null;
        form[field.key] = mergeBodyConditionViewFromPrevious(currentBlock, previousBlock);
    });

    return form;
}

export function buildBodyConditionDisplayPairs(historyEntry, options = {}) {
    const form = buildBodyConditionFormState(historyEntry, options);
    return BODY_CONDITION_ROW_PAIRS.map((pair) => ({
        left: {
            ...FIELD_BY_KEY[pair.left],
            ...form[pair.left],
        },
        right: {
            ...FIELD_BY_KEY[pair.right],
            ...form[pair.right],
        },
    }));
}

export function buildBodyConditionDisplayViews(historyEntry, options = {}) {
    const form = buildBodyConditionFormState(historyEntry, options);
    return BODY_CONDITION_VIEW_FIELDS.map((field) => ({
        ...field,
        ...form[field.key],
    }));
}

export function bodyConditionRowRequiresComment(row) {
    return (
        row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW && hasAssessmentPhoto(row?.photo)
    );
}

export function validateBodyConditionForm(form) {
    const errors = {};
    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        const row = form?.[field.key];
        if (!hasAssessmentPhoto(row?.photo)) {
            errors[field.key] = 'Photo required (mandatory)';
            return;
        }
        if (bodyConditionRowRequiresComment(row) && !String(row.comment || '').trim()) {
            errors[field.key] = 'Comment required for new image';
        }
    });
    return errors;
}

export function isBodyConditionFormComplete(form) {
    return Object.keys(validateBodyConditionForm(form)).length === 0;
}

export function buildBodyConditionPayload(form) {
    const payload = {};
    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        const row = form[field.key] || {};
        const comment = String(row.comment || '').trim();
        const photoSource =
            row.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
            row.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW
                ? row.photoSource
                : null;
        const userSelected =
            row.userSelected === true ||
            Boolean(comment) ||
            photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
            photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW;

        payload[field.key] = {
            comment,
            photo: row.photo || null,
            ...(photoSource ? { photoSource } : {}),
            ...(userSelected ? { userSelected: true } : {}),
        };
    });
    return payload;
}

export function normalizeBodyConditionFormRow(row = {}) {
    return {
        comment: String(row.comment || '').trim(),
        photo: row.photo ?? null,
        photoSource: row.photoSource ?? null,
        userSelected: row.userSelected === true,
    };
}

export function mergeBodyConditionIntoEntry(historyEntry, bodyConditionReport) {
    if (!historyEntry) return historyEntry;
    return {
        ...historyEntry,
        details: {
            ...(historyEntry.details && typeof historyEntry.details === 'object' ? historyEntry.details : {}),
            bodyConditionReport,
        },
    };
}

export function isBodyConditionMarkedDone(historyEntry) {
    return historyEntry?.details?.bodyConditionCompleted === true;
}

export function mergeBodyConditionCompletedIntoEntry(historyEntry) {
    if (!historyEntry) return historyEntry;
    return {
        ...historyEntry,
        details: {
            ...(historyEntry.details && typeof historyEntry.details === 'object' ? historyEntry.details : {}),
            bodyConditionCompleted: true,
        },
    };
}

export function mergeBodyConditionRowIntoEntry(historyEntry, key, row) {
    const existing =
        historyEntry?.details?.bodyConditionReport &&
        typeof historyEntry.details.bodyConditionReport === 'object'
            ? historyEntry.details.bodyConditionReport
            : {};

    return mergeBodyConditionIntoEntry(historyEntry, {
        ...existing,
        [key]: {
            comment: String(row?.comment || '').trim(),
            photo: row?.photo || null,
            photoSource:
                row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
                row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW
                    ? row.photoSource
                    : null,
            ...(row?.userSelected === true ||
            String(row?.comment || '').trim() ||
            row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.PREVIOUS ||
            row?.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW
                ? { userSelected: true }
                : {}),
        },
    });
}

export function buildBodyConditionGalleryItems(historyEntry) {
    const source = resolveBodyConditionSource(historyEntry);
    return BODY_CONDITION_VIEW_FIELDS.map((field) => ({
        key: field.key,
        label: field.label,
        url: resolveAssessmentMediaUrl(pickViewBlock(source, field.key).photo),
    })).filter((item) => item.url);
}

export function hasBodyConditionReportData(historyEntry) {
    const source = resolveBodyConditionSource(historyEntry);
    if (!source) return false;

    return BODY_CONDITION_VIEW_FIELDS.some((field) => {
        const block = pickViewBlock(source, field.key);
        return Boolean(String(block.comment || '').trim()) || hasAssessmentPhoto(block.photo);
    });
}

export function shouldShowBodyConditionSection(historyEntry) {
    return isReceiverAssessmentMarkedDone(historyEntry);
}

export function isHandoverBodyConditionReadyForApproval(historyEntry) {
    return isBodyConditionMarkedDone(historyEntry) || isBodyConditionFormComplete(buildBodyConditionFormState(historyEntry));
}
