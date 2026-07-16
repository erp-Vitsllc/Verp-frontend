export const CARD_DELETED_PROGRESS_TYPE = 'Card Deleted Progress';

export const CARD_DELETED_PROGRESS_MESSAGE = 'Card deleted and progress updated';

/** Notification types shown on both Company and Employee list bells. */
export const CARD_DELETED_NOTIFICATION_TYPES = [CARD_DELETED_PROGRESS_TYPE];

export function cardDeletedProgressToast() {
    return {
        title: 'Deleted',
        description: CARD_DELETED_PROGRESS_MESSAGE,
    };
}

export function includesCardDeletedNotificationType(type) {
    return CARD_DELETED_NOTIFICATION_TYPES.includes(String(type || '').trim());
}

/** Hidden from all bells, Command Center, and My Requests. */
export function isCardDeletedNotificationHiddenType(type) {
    return includesCardDeletedNotificationType(type);
}

export function mergeCardDeletedNotifications(items = [], cardDeletedItems = []) {
    const base = Array.isArray(items) ? items : [];
    const extra = Array.isArray(cardDeletedItems) ? cardDeletedItems : [];
    if (!extra.length) return base;
    const seen = new Set(base.map((item) => `${item.type}|${item.actionId || item.id}|${item.extra1 || ''}`));
    const merged = [...base];
    for (const item of extra) {
        const key = `${item.type}|${item.actionId || item.id}|${item.extra1 || ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
        }
    }
    return merged;
}
