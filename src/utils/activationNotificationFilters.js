const ACTIVATION_NOTIFICATION_TYPES = new Set([
    'Profile Activation',
    'Company Activation',
    'Vehicle Profile Activation',
]);

/** Submitter must see HR Rejected outcomes; HR inbox uses Pending / On Hold only. */
export function isActivationNotificationActionable(item) {
    if (!item || !ACTIVATION_NOTIFICATION_TYPES.has(item.type)) return false;
    if (item.status === 'Pending' || item.status === 'On Hold') return true;
    if (item.status === 'Rejected') {
        return item.scope === 'outgoing' || item.requestedBy === 'Me';
    }
    return false;
}

/** Pending task bar / notification modal: activation includes submitter Rejected outcomes. */
export function filterActionableDashboardItems(items) {
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => {
        if (ACTIVATION_NOTIFICATION_TYPES.has(item.type)) {
            return isActivationNotificationActionable(item);
        }
        return item.status === 'Pending';
    });
}

/** Dashboard "Pending" stat/filter: same rules as sidebar notifications. */
export function isDashboardPendingItem(item) {
    if (ACTIVATION_NOTIFICATION_TYPES.has(item?.type)) {
        return isActivationNotificationActionable(item);
    }
    return item?.status === 'Pending' || item?.status === 'On Hold';
}

/** Rejected activation for the submitter — still needs follow-up, not "completed" in dashboard totals. */
export function isSubmitterRejectedActivationFollowup(item) {
    if (!item || !ACTIVATION_NOTIFICATION_TYPES.has(item.type)) return false;
    return item.status === 'Rejected' && item.scope === 'outgoing';
}
