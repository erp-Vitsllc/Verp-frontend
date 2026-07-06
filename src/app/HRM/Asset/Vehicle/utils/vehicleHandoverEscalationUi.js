export const HANDOVER_ESCALATION_REMINDER_START_DAY = 5;
export const HANDOVER_ESCALATION_AUTO_ACCEPT_DAY = 10;

function startOfDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

export function getHandoverEscalationDaysElapsed(requestedAt, today = startOfDay(new Date())) {
    const start = startOfDay(requestedAt);
    if (!start || !today) return 0;
    return Math.floor((today - start) / (1000 * 60 * 60 * 24));
}

function isLinkedHandoverHistoryEntry(vehicle, historyEntry) {
    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    const historyId = flow?.historyId;
    if (!historyId) return true;
    if (!historyEntry?._id) return true;
    return String(historyId) === String(historyEntry._id);
}

function findLatestAssignedHistoryEntry(assetHistory = []) {
    if (!Array.isArray(assetHistory) || !assetHistory.length) return null;

    return [...assetHistory]
        .filter((row) => String(row?.action || '').trim() === 'Assigned')
        .sort(
            (a, b) =>
                new Date(b?.createdAt || b?.date || 0).getTime() -
                new Date(a?.createdAt || a?.date || 0).getTime(),
        )[0];
}

export function resolveHandoverEscalationRequestedAt(vehicle, historyEntry = null, assetHistory = []) {
    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;

    if (flow?.escalation?.requestedAt) {
        return flow.escalation.requestedAt;
    }

    if (historyEntry?.createdAt || historyEntry?.date) {
        return historyEntry.createdAt || historyEntry.date;
    }

    const historyId = flow?.historyId;
    if (historyId && assetHistory.length) {
        const linked = assetHistory.find((row) => String(row?._id) === String(historyId));
        if (linked?.createdAt || linked?.date) {
            return linked.createdAt || linked.date;
        }
    }

    const latestAssigned = findLatestAssignedHistoryEntry(assetHistory);
    if (latestAssigned?.createdAt || latestAssigned?.date) {
        return latestAssigned.createdAt || latestAssigned.date;
    }

    if (vehicle?.assignedDate) return vehicle.assignedDate;
    if (vehicle?.updatedAt) return vehicle.updatedAt;

    return null;
}

export function isHandoverEscalationWindowActive(vehicle) {
    const acceptance = String(vehicle?.acceptanceStatus || '').trim();
    const status = String(vehicle?.status || '').trim();
    if (acceptance !== 'Pending') return false;
    if (status !== 'Pending' && status !== 'Assigned') return false;

    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    const stage = flow?.stage ? String(flow.stage).toLowerCase() : 'target';
    if (stage !== 'target') return false;
    if (flow?.escalation?.resolvedAt || flow?.escalation?.autoAcceptedAt) return false;

    return true;
}

/**
 * Day counter for fleet handover target stage (assignee acknowledgment window).
 * @returns {{ daysElapsed: number, displayDay: number, daysLeft: number, inReminderWindow: boolean, autoAcceptDue: boolean } | null}
 */
export function getHandoverEscalationDayInfo(vehicle, historyEntry = null, options = {}) {
    const { assetHistory = [] } = options || {};
    if (!isHandoverEscalationWindowActive(vehicle)) return null;
    if (historyEntry && !isLinkedHandoverHistoryEntry(vehicle, historyEntry)) return null;

    const requestedAt = resolveHandoverEscalationRequestedAt(vehicle, historyEntry, assetHistory);
    if (!requestedAt) return null;

    const daysElapsed = getHandoverEscalationDaysElapsed(requestedAt);
    const displayDay = Math.min(HANDOVER_ESCALATION_AUTO_ACCEPT_DAY, daysElapsed + 1);
    const daysLeft = Math.max(0, HANDOVER_ESCALATION_AUTO_ACCEPT_DAY - displayDay);

    return {
        daysElapsed,
        displayDay,
        daysLeft,
        inReminderWindow: daysElapsed >= HANDOVER_ESCALATION_REMINDER_START_DAY,
        autoAcceptDue: daysElapsed >= HANDOVER_ESCALATION_AUTO_ACCEPT_DAY,
    };
}

export function formatHandoverEscalationDayLabel(dayInfo) {
    if (!dayInfo) return '';
    return `Day ${dayInfo.displayDay}/${HANDOVER_ESCALATION_AUTO_ACCEPT_DAY}`;
}
