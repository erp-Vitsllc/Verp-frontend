export const LOAN_PENDING_INBOX_CHANGED = 'loan-pending-inbox-changed';

/** Same count as the Loan page bell (pending loan/advance rows for the viewer). */
export function countVisibleLoanPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifyLoanPendingInboxChanged() {
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent(LOAN_PENDING_INBOX_CHANGED));
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(LOAN_PENDING_INBOX_CHANGED));
    }
}
