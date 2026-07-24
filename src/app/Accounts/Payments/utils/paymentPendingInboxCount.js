import {
    clearPendingInboxCache,
    PAYMENT_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';

export const PAYMENT_PENDING_INBOX_CHANGED = 'payment-pending-inbox-changed';

/** Same count as the Payments page bell icon (pending approval tasks for the viewer). */
export function countVisiblePaymentPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifyPaymentPendingInboxChanged() {
    clearPendingInboxCache(PAYMENT_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(PAYMENT_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
