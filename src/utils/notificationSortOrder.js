/** Timestamp used for notification ordering (task arrival / creation). */
export function getNotificationSortTime(item) {
    const raw =
        item?.createdAt ??
        item?.requestedDate ??
        item?.requestedAt ??
        item?.updatedAt ??
        0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
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
 * Stack order (newest first): latest notification on top, oldest at bottom.
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
