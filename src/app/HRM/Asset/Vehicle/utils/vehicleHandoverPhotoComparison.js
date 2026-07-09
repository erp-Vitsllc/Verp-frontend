import { BODY_CONDITION_VIEW_FIELDS } from './vehicleHandoverBodyCondition';
import {
    findPreviousBodyConditionHandoverEntry,
} from './vehicleHandoverPreviousReports';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    accessoryAssessmentItemChanged,
    buildPreviousHandoverComparisonForm,
    coerceAccessoryAssessmentPresent,
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

export function buildAssessmentComparisonRows(historyEntry, assetHistory = [], asset = null) {
    // Accessories only — baseline is the live accessories list, not previous assignment.
    const accessoriesBaseline = asset
        ? buildPreviousHandoverComparisonForm(historyEntry, asset, {
              asset,
              assetHistory,
              currentEntry: historyEntry,
          })
        : null;

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const current = resolveItemBlockFromHistoryEntry(historyEntry, item.key);
        const { block: previous, hasBaseline } = pickAccessoriesBaselineBlock(accessoriesBaseline, item.key);
        const { changed, photoChanged, presentChanged } = buildAccessoryComparisonResult(previous, current);

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
            usesPreviousHandover: hasBaseline,
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

function pickAccessoriesBaselineBlock(accessoriesBaseline, key) {
    const initial = accessoriesBaseline?.[key] || {};
    const initialPresent = coerceAccessoryAssessmentPresent(initial);
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
    };
}

function buildAccessoryComparisonResult(baseline, current) {
    const changed = accessoryAssessmentItemChanged(baseline, current);
    const basePresent = coerceAccessoryAssessmentPresent(baseline);
    const currPresent = coerceAccessoryAssessmentPresent(current);
    const hasBaseline =
        basePresent === true || basePresent === false || Boolean(baseline.photo);
    const photoChanged =
        hasBaseline && currPresent === true && photosDiffer(baseline.photo, current.photo);
    const presentChanged = hasBaseline && basePresent !== currPresent;

    return { changed, hasBaseline, photoChanged, presentChanged };
}

/** Live form vs accessories list baseline — updates as the user edits. */
export function buildAssessmentFormComparisonRows(
    form,
    historyEntry,
    assetHistory = [],
    options = {},
) {
    const { initialForm = null, asset = null } = options;
    const accessoriesBaseline =
        initialForm ||
        (asset
            ? buildPreviousHandoverComparisonForm(historyEntry, asset, {
                  asset,
                  assetHistory,
                  currentEntry: historyEntry,
              })
            : null);

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
        const { block: baseline, hasBaseline } = pickAccessoriesBaselineBlock(
            accessoriesBaseline,
            item.key,
        );
        const { changed, photoChanged, presentChanged } = buildAccessoryComparisonResult(baseline, current);

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
            usesPreviousHandover: hasBaseline,
        };
    });
}

export function buildBodyConditionComparisonRows(historyEntry, assetHistory = []) {
    // Body condition only — baseline is the previous assignment handover report.
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

export function hasHandoverPhotoChanges(historyEntry, assetHistory = [], asset = null) {
    const assessment = buildAssessmentComparisonRows(historyEntry, assetHistory, asset);
    const body = buildBodyConditionComparisonRows(historyEntry, assetHistory);
    return assessment.some((row) => row.changed) || body.some((row) => row.changed);
}
