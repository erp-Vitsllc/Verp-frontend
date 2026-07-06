import { BODY_CONDITION_VIEW_FIELDS } from './vehicleHandoverBodyCondition';
import {
    findPreviousAssessmentHandoverEntry,
    findPreviousBodyConditionHandoverEntry,
} from './vehicleHandoverPreviousReports';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    resolveAssessmentMediaUrl,
} from './vehicleHandoverReceiverAssessment';

function normalizePhotoKey(photo) {
    if (!photo) return '';
    if (typeof photo === 'string') {
        const trimmed = photo.trim();
        if (trimmed.startsWith('data:')) return trimmed.slice(0, 120);
        return trimmed.split('?')[0];
    }
    if (typeof photo === 'object') {
        const nested = photo.url || photo.publicId || photo.path || photo.data || '';
        return normalizePhotoKey(nested);
    }
    return '';
}

function pickAssessmentBlock(source, key) {
    if (!source || typeof source !== 'object') return { present: null, photo: null };
    const nested = source[key];
    if (nested && typeof nested === 'object') {
        return {
            present:
                nested.present === true ? true : nested.present === false ? false : null,
            photo: nested.photo ?? nested.image ?? nested.attachment ?? null,
        };
    }
    return {
        present:
            nested === true ? true : nested === false ? false : null,
        photo: source[`${key}Photo`] ?? source[`${key}Image`] ?? null,
    };
}

function pickBodyBlock(source, key) {
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

function resolveAssessmentSource(historyEntry) {
    const candidates = [
        historyEntry?.details?.receiverAssessment,
        historyEntry?.details?.vehicleAssessmentReportByReceiver,
        historyEntry?.receiverAssessment,
        historyEntry?.details?.receiverAssessmentReport,
    ];
    return candidates.find((item) => item && typeof item === 'object') || null;
}

function resolveBodySource(historyEntry) {
    const candidates = [
        historyEntry?.details?.bodyConditionReport,
        historyEntry?.details?.bodyCondition,
        historyEntry?.bodyConditionReport,
    ];
    return candidates.find((item) => item && typeof item === 'object') || null;
}

export function photosDiffer(previousPhoto, currentPhoto) {
    const prevKey = normalizePhotoKey(previousPhoto);
    const currKey = normalizePhotoKey(currentPhoto);
    if (!prevKey && !currKey) return false;
    if (!prevKey || !currKey) return true;
    return prevKey !== currKey;
}

export function presentValueChanged(previousPresent, currentPresent) {
    if (previousPresent === currentPresent) return false;
    if (
        (previousPresent === true || previousPresent === false) &&
        (currentPresent === true || currentPresent === false)
    ) {
        return true;
    }
    return false;
}

export function buildAssessmentComparisonRows(historyEntry, assetHistory = []) {
    const previousEntry = assetHistory?.length
        ? findPreviousAssessmentHandoverEntry(assetHistory, historyEntry?._id, historyEntry)
        : null;
    const currentSource = resolveAssessmentSource(historyEntry);
    const previousSource = previousEntry ? resolveAssessmentSource(previousEntry) : null;

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const current = pickAssessmentBlock(currentSource, item.key);
        const previous = pickAssessmentBlock(previousSource, item.key);
        const photoChanged = photosDiffer(previous.photo, current.photo);
        const presentChanged = presentValueChanged(previous.present, current.present);
        const changed = photoChanged || presentChanged;

        return {
            ...item,
            previous: {
                present: previous.present,
                photo: previous.photo,
                photoUrl: resolveAssessmentMediaUrl(previous.photo),
            },
            current: {
                present: current.present,
                photo: current.photo,
                photoUrl: resolveAssessmentMediaUrl(current.photo),
            },
            changed,
            photoChanged,
            presentChanged,
        };
    });
}

export function buildBodyConditionComparisonRows(historyEntry, assetHistory = []) {
    const previousEntry = assetHistory?.length
        ? findPreviousBodyConditionHandoverEntry(assetHistory, historyEntry?._id, historyEntry)
        : null;
    const currentSource = resolveBodySource(historyEntry);
    const previousSource = previousEntry ? resolveBodySource(previousEntry) : null;

    return BODY_CONDITION_VIEW_FIELDS.map((field) => {
        const current = pickBodyBlock(currentSource, field.key);
        const previous = pickBodyBlock(previousSource, field.key);
        const photoChanged = photosDiffer(previous.photo, current.photo);
        const commentChanged =
            String(previous.comment || '').trim() !== String(current.comment || '').trim();
        const changed = photoChanged || commentChanged;

        return {
            ...field,
            previous: {
                comment: previous.comment,
                photo: previous.photo,
                photoUrl: resolveAssessmentMediaUrl(previous.photo),
            },
            current: {
                comment: current.comment,
                photo: current.photo,
                photoUrl: resolveAssessmentMediaUrl(current.photo),
            },
            changed,
            photoChanged,
            commentChanged,
        };
    });
}

export function hasHandoverPhotoChanges(historyEntry, assetHistory = []) {
    const assessment = buildAssessmentComparisonRows(historyEntry, assetHistory);
    const body = buildBodyConditionComparisonRows(historyEntry, assetHistory);
    return assessment.some((row) => row.changed) || body.some((row) => row.changed);
}
