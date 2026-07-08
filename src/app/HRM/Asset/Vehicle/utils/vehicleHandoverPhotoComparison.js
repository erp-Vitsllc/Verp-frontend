import { BODY_CONDITION_VIEW_FIELDS } from './vehicleHandoverBodyCondition';
import {
    findPreviousAssessmentHandoverEntry,
    findPreviousBodyConditionHandoverEntry,
} from './vehicleHandoverPreviousReports';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    normalizeHandoverPhotoIdentity,
    resolveAssessmentMediaUrl,
} from './vehicleHandoverReceiverAssessment';

function normalizePhotoKey(photo) {
    return normalizeHandoverPhotoIdentity(photo);
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
    const previousSource = previousEntry ? resolveAssessmentSource(previousEntry) : null;

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const current = resolveItemBlockFromHistoryEntry(historyEntry, item.key);
        const { block: previous, hasBaseline, usesPreviousHandover } = pickAssessmentBaselineBlock(
            previousEntry,
            previousSource,
            null,
            item.key,
        );
        const photoChanged = photosDiffer(previous.photo, current.photo);
        const presentChanged = presentValueChanged(previous.present, current.present);
        const changed = hasBaseline && (photoChanged || presentChanged);

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
            hasBaseline,
            usesPreviousHandover,
        };
    });
}

function resolveItemBlockFromHistoryEntry(historyEntry, key) {
    if (!historyEntry) return { present: null, photo: null };

    const sources = [
        historyEntry?.details?.receiverAssessment,
        historyEntry?.details?.vehicleAssessmentReportByReceiver,
        historyEntry?.receiverAssessment,
        historyEntry?.details?.receiverAssessmentReport,
    ];

    for (const source of sources) {
        const block = pickAssessmentBlock(source, key);
        if (block.present === true || block.present === false || block.photo) {
            return block;
        }
    }

    return { present: null, photo: null };
}

function pickAssessmentBaselineBlock(previousEntry, previousSource, initialForm, key) {
    const fromPreviousEntry = resolveItemBlockFromHistoryEntry(previousEntry, key);
    if (
        fromPreviousEntry &&
        (fromPreviousEntry.present === true ||
            fromPreviousEntry.present === false ||
            fromPreviousEntry.photo)
    ) {
        const present =
            fromPreviousEntry.present === true
                ? true
                : fromPreviousEntry.present === false
                  ? false
                  : fromPreviousEntry.photo
                    ? true
                    : null;
        return {
            block: {
                present,
                photo: present === true ? fromPreviousEntry.photo ?? null : null,
            },
            hasBaseline: true,
            usesPreviousHandover: true,
        };
    }

    const previous = pickAssessmentBlock(previousSource, key);
    const hasPreviousBaseline =
        previous.present === true ||
        previous.present === false ||
        Boolean(previous.photo);

    if (hasPreviousBaseline) {
        return { block: previous, hasBaseline: true, usesPreviousHandover: true };
    }

    const initial = initialForm?.[key] || {};
    const initialPresent =
        initial.present === true ? true : initial.present === false ? false : null;
    const hasInitialBaseline =
        initialPresent === true ||
        initialPresent === false ||
        Boolean(initial.photo);

    return {
        block: {
            present: initialPresent,
            photo: initial.photo ?? null,
        },
        hasBaseline: hasInitialBaseline,
        usesPreviousHandover: hasInitialBaseline,
    };
}

/** Live form vs previous handover (or initial prefill) — updates as the user edits. */
export function buildAssessmentFormComparisonRows(
    form,
    historyEntry,
    assetHistory = [],
    options = {},
) {
    const { initialForm = null } = options;
    const previousEntry = assetHistory?.length
        ? findPreviousAssessmentHandoverEntry(assetHistory, historyEntry?._id, historyEntry)
        : null;
    const previousSource = previousEntry ? resolveAssessmentSource(previousEntry) : null;

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const current = {
            present:
                form?.[item.key]?.present === true
                    ? true
                    : form?.[item.key]?.present === false
                      ? false
                      : null,
            photo: form?.[item.key]?.photo ?? null,
        };
        const { block: baseline, hasBaseline, usesPreviousHandover } = pickAssessmentBaselineBlock(
            previousEntry,
            previousSource,
            initialForm,
            item.key,
        );
        const photoChanged = photosDiffer(baseline.photo, current.photo);
        const presentChanged = presentValueChanged(baseline.present, current.present);
        const changed = hasBaseline && (photoChanged || presentChanged);

        return {
            ...item,
            previous: {
                present: baseline.present,
                photo: baseline.photo,
                photoUrl: resolveAssessmentMediaUrl(baseline.photo),
            },
            current: {
                present: current.present,
                photo: current.photo,
                photoUrl: resolveAssessmentMediaUrl(current.photo),
            },
            changed,
            photoChanged,
            presentChanged,
            hasBaseline,
            usesPreviousHandover,
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
