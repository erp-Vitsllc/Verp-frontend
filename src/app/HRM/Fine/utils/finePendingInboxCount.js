export const FINE_PENDING_INBOX_CHANGED = 'fine-pending-inbox-changed';

/** Same count as the Fine page bell icon (all pending inbox rows for the viewer). */
export function countVisibleFinePendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifyFinePendingInboxChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FINE_PENDING_INBOX_CHANGED));
    }
}
