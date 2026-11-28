import { notificationCreatedAt } from '@/utils/notificationCreatedDate';

/** When this notification was created. Ignores document expiry and when the activity was completed. */
export function getNotificationSortTime(item) {
    const created = notificationCreatedAt(item);
    return created ? created.getTime() : 0;
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

    return 0;
}

/**
 * Newest notification on top, in every section.
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
