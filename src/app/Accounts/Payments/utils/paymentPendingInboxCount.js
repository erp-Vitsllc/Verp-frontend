export const PAYMENT_PENDING_INBOX_CHANGED = 'payment-pending-inbox-changed';

/** Same count as the Payments page bell icon (pending approval tasks for the viewer). */
export function countVisiblePaymentPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifyPaymentPendingInboxChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PAYMENT_PENDING_INBOX_CHANGED));
    }
}
