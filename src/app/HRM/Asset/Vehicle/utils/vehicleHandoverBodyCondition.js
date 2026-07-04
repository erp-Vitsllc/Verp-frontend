import { hasAssessmentPhoto, isReceiverAssessmentMarkedDone, resolveAssessmentMediaUrl } from './vehicleHandoverReceiverAssessment';

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
    };
}

export function buildBodyConditionFormState(historyEntry) {
    const source = resolveBodyConditionSource(historyEntry);
    const form = {};
    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        form[field.key] = pickViewBlock(source, field.key);
    });
    return form;
}

export function buildBodyConditionDisplayPairs(historyEntry) {
    return BODY_CONDITION_ROW_PAIRS.map((pair) => ({
        left: {
            ...FIELD_BY_KEY[pair.left],
            ...pickViewBlock(resolveBodyConditionSource(historyEntry), pair.left),
        },
        right: {
            ...FIELD_BY_KEY[pair.right],
            ...pickViewBlock(resolveBodyConditionSource(historyEntry), pair.right),
        },
    }));
}

export function buildBodyConditionDisplayViews(historyEntry) {
    const source = resolveBodyConditionSource(historyEntry);
    return BODY_CONDITION_VIEW_FIELDS.map((field) => ({
        ...field,
        ...pickViewBlock(source, field.key),
    }));
}

export function validateBodyConditionForm(form) {
    const errors = {};
    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        const row = form?.[field.key];
        if (!hasAssessmentPhoto(row?.photo)) {
            errors[field.key] = 'Photo required (mandatory)';
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
        payload[field.key] = {
            comment: String(row.comment || '').trim(),
            photo: row.photo || null,
        };
    });
    return payload;
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
