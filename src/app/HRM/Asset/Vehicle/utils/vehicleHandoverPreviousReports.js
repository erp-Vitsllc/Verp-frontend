import {
    hasCurrentReceiverAssessmentDataOnHistory,
    hasAssessmentPhoto,
    resolveReceiverAssessmentSource,
} from './vehicleHandoverReceiverAssessment';
import { hasBodyConditionReportData, resolveBodyConditionSource } from './vehicleHandoverBodyCondition';

export { hasCurrentReceiverAssessmentDataOnHistory as hasCurrentReceiverAssessmentData };

const FLEET_HANDOVER_ACTIONS = new Set(['Assigned', 'Accepted', 'Transfer', 'ControllerHandover']);

function entryTimestamp(entry) {
    const value = entry?.createdAt || entry?.date;
    const parsed = value ? new Date(Date.parse(value)) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function isVehicleInspectionHandoverEntry(entry) {
    if (!entry) return false;
    if (String(entry?.details?.handoverKind || '').trim() === 'vehicle_inspection') return true;
    return entry?.details?.firstInspection === true || entry?.details?.reinspection === true;
}

/** Fleet assignment rows only (excludes inspection handovers). */
export function isFleetAssignmentHandoverEntry(entry) {
    if (!entry) return false;
    const action = String(entry?.action || '').trim();
    if (!FLEET_HANDOVER_ACTIONS.has(action)) return false;
    if (isVehicleInspectionHandoverEntry(entry)) return false;
    return true;
}

/** Any prior handover that may supply tools, accessories, or body-condition photos. */
export function isPriorHandoverReportSourceEntry(entry) {
    if (!entry) return false;
    const action = String(entry?.action || '').trim();
    return FLEET_HANDOVER_ACTIONS.has(action);
}

function isStrictlyBeforeHistoryEntry(row, currentId, currentTs) {
    const rowTs = entryTimestamp(row);
    if (rowTs < currentTs) return true;
    if (rowTs > currentTs) return false;
    return String(row?._id || '') < String(currentId || '');
}

export function buildPriorHandoverCandidates(assetHistory, currentHistoryId, currentEntry = null) {
    if (!Array.isArray(assetHistory) || !currentHistoryId) return [];

    const currentId = String(currentHistoryId);
    const isLive = currentId.startsWith('live-');

    if (isLive) {
        return assetHistory
            .filter((row) => row?._id && isPriorHandoverReportSourceEntry(row))
            .sort((a, b) => {
                const diff = entryTimestamp(b) - entryTimestamp(a);
                if (diff !== 0) return diff;
                return String(b?._id || '').localeCompare(String(a?._id || ''));
            });
    }

    const current =
        assetHistory.find((row) => String(row?._id) === currentId) ||
        (currentEntry && String(currentEntry?._id) === currentId ? currentEntry : null);

    const currentTs = current ? entryTimestamp(current) : entryTimestamp(currentEntry);

    return assetHistory
        .filter((row) => {
            if (!row?._id || String(row._id) === currentId) return false;
            if (!isPriorHandoverReportSourceEntry(row)) return false;
            if (!currentTs) return true;
            return isStrictlyBeforeHistoryEntry(row, currentId, currentTs);
        })
        .sort((a, b) => {
            const diff = entryTimestamp(b) - entryTimestamp(a);
            if (diff !== 0) return diff;
            return String(b?._id || '').localeCompare(String(a?._id || ''));
        });
}

export function findPreviousAssessmentHandoverEntry(assetHistory, currentHistoryId, currentEntry = null) {
    const candidates = buildPriorHandoverCandidates(assetHistory, currentHistoryId, currentEntry);

    for (const row of candidates) {
        if (resolveReceiverAssessmentSource(row, null)) return row;
    }

    return null;
}

export function findPreviousFleetHandoverEntry(assetHistory, currentHistoryId, currentEntry = null) {
    const candidates = buildPriorHandoverCandidates(assetHistory, currentHistoryId, currentEntry);

    for (const row of candidates) {
        const details = row?.details || {};
        if (resolveReceiverAssessmentSource(row, null) || resolveBodyConditionSource(row)) {
            return row;
        }
        if (details.receiverAssessmentCompleted && details.bodyConditionCompleted) {
            return row;
        }
    }

    return candidates[0] || null;
}

/** Most recent prior handover that has saved body condition photos. */
export function findPreviousBodyConditionHandoverEntry(assetHistory, currentHistoryId, currentEntry = null) {
    const candidates = buildPriorHandoverCandidates(assetHistory, currentHistoryId, currentEntry);

    for (const row of candidates) {
        if (hasBodyConditionReportData(row)) return row;
    }

    return findPreviousFleetHandoverEntry(assetHistory, currentHistoryId, currentEntry);
}

export function resolvePreviousHandoverEntry(assetHistory, historyEntry) {
    if (!historyEntry?._id) return null;
    return findPreviousFleetHandoverEntry(assetHistory, historyEntry._id, historyEntry);
}

export function hasCurrentBodyConditionData(historyEntry) {
    return hasBodyConditionReportData(historyEntry);
}

export function mergeAssessmentItemFromPrevious(currentBlock, previousBlock) {
    if (currentBlock?.present === true || currentBlock?.present === false) {
        return {
            present: currentBlock.present,
            photo: currentBlock.present === true ? currentBlock.photo ?? null : null,
            amount: currentBlock.amount ?? null,
        };
    }

    if (!previousBlock) {
        return {
            present: currentBlock?.present ?? null,
            photo: currentBlock?.photo ?? null,
            amount: currentBlock?.amount ?? null,
        };
    }

    const present =
        previousBlock.present === true || previousBlock.present === false
            ? previousBlock.present
            : previousBlock.photo
              ? true
              : null;

    return {
        present,
        photo: present === true ? previousBlock.photo ?? null : null,
        amount: currentBlock?.amount ?? previousBlock.amount ?? null,
    };
}

export function mergeBodyConditionViewFromPrevious(currentBlock, previousBlock) {
    const hasCurrentPhoto = hasAssessmentPhoto(currentBlock?.photo);
    const hasCurrentComment = Boolean(String(currentBlock?.comment || '').trim());

    if (hasCurrentPhoto || hasCurrentComment) {
        return {
            comment: String(currentBlock?.comment || '').trim(),
            photo: currentBlock?.photo ?? null,
        };
    }

    if (!previousBlock) {
        return {
            comment: String(currentBlock?.comment || '').trim(),
            photo: currentBlock?.photo ?? null,
        };
    }

    return {
        comment: String(previousBlock.comment || '').trim(),
        photo: previousBlock.photo ?? null,
    };
}
