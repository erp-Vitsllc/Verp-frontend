import {
    clearPendingInboxCache,
    LOAN_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';

export const LOAN_PENDING_INBOX_CHANGED = 'loan-pending-inbox-changed';

/** Same count as the Loan page bell (pending loan/advance rows for the viewer). */
export function countVisibleLoanPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifyLoanPendingInboxChanged() {
    clearPendingInboxCache(LOAN_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(LOAN_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
