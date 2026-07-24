import {
    clearPendingInboxCache,
    FINE_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';

export const FINE_PENDING_INBOX_CHANGED = 'fine-pending-inbox-changed';

/** Same count as the Fine page bell icon (all pending inbox rows for the viewer). */
export function countVisibleFinePendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifyFinePendingInboxChanged() {
    clearPendingInboxCache(FINE_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(FINE_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
