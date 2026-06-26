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
    const timeB = getNotificationSortTime(b);
    const timeA = getNotificationSortTime(a);
    if (timeB !== timeA) return timeB - timeA;

    const actionB = getNotificationActionKey(b);
    const actionA = getNotificationActionKey(a);
    if (actionB && actionA && actionB !== actionA) {
        return actionB.localeCompare(actionA);
    }
    if (actionB && !actionA) return -1;
    if (!actionB && actionA) return 1;

    return getNotificationSubjectKey(a).localeCompare(getNotificationSubjectKey(b));
}

/**
 * Stack order (LIFO): newest task on top, oldest at bottom.
 * Tasks that arrived first appear last in the list.
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
