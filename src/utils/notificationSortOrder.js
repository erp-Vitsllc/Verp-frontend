/** Timestamp used for notification ordering (task arrival / creation). */
export function getNotificationSortTime(item) {
    const candidates = [
        item?.createdAt,
        item?.requestedDate,
        item?.requestedAt,
        item?.leaveRequestedAt,
        item?.appliedDate,
        item?.date,
        item?.updatedAt,
    ];
    let best = 0;
    for (const raw of candidates) {
        if (raw == null || raw === '') continue;
        const t = new Date(raw).getTime();
        if (Number.isFinite(t) && t > best) best = t;
    }
    return best;
}

export function isPendingNotification(item) {
    const s = String(item?.status || item?.approvalStatus || '').trim().toLowerCase();
    if (!s) return true;
    if (
        s.includes('reject') ||
        s.includes('approved') ||
        s.includes('accepted') ||
        s.includes('cancel') ||
        s === 'completed' ||
        s === 'done'
    ) {
        return false;
    }
    return s === 'pending' || s === 'on hold' || s.includes('pending') || s.includes('hold');
}

/** Mongo action ids sort roughly by creation time — stabilizes rows with the same timestamp. */
function getNotificationActionKey(item) {
    return String(item?.actionId ?? item?.dashboardActionId ?? item?._id ?? '');
}

function getNotificationSubjectKey(item) {
    return [
        item?.type,
        item?.targetEmployeeId ?? item?.id,
        item?.extra1,
        item?.extra2,
        item?.subjectName,
    ]
        .map((part) => String(part ?? '').trim().toLowerCase())
        .join('|');
}

function compareNotificationItems(a, b) {
    const pendingA = isPendingNotification(a) ? 1 : 0;
    const pendingB = isPendingNotification(b) ? 1 : 0;
    if (pendingA !== pendingB) return pendingB - pendingA;

    const timeA = getNotificationSortTime(a);
    const timeB = getNotificationSortTime(b);
    if (timeA !== timeB) return timeB - timeA;

    const actionA = getNotificationActionKey(a);
    const actionB = getNotificationActionKey(b);
    if (actionA && actionB && actionA !== actionB) {
        return actionB.localeCompare(actionA);
    }
    if (actionA && !actionB) return -1;
    if (!actionA && actionB) return 1;

    return getNotificationSubjectKey(b).localeCompare(getNotificationSubjectKey(a));
}

/**
 * Stack order: pending first, then newest on top.
 */
export function sortNotificationsStackOrder(items = []) {
    return [...(items || [])].sort(compareNotificationItems);
}

/** Sort mapped inbox rows using each row's raw notification payload when present. */
export function sortNotificationPresentationRows(rows = []) {
    return [...(rows || [])].sort((a, b) =>
        compareNotificationItems(a?.raw ?? a, b?.raw ?? b),
    );
}

/**
 * Same as sortNotificationPresentationRows, with optional direction.
 * @param {'newest'|'oldest'} direction
 */
export function sortNotificationPresentationRowsByDirection(rows = [], direction = 'newest') {
    const sorted = sortNotificationPresentationRows(rows);
    if (String(direction || '').toLowerCase() === 'oldest') {
        return sorted.slice().reverse();
    }
    return sorted;
}
