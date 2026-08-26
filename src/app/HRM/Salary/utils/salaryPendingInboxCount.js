import {
    clearPendingInboxCache,
    SALARY_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';

export const SALARY_PENDING_INBOX_CHANGED = 'salary-pending-inbox-changed';

/** Same count as the Salary page bell (pending salary-profile approvals for the viewer). */
export function countVisibleSalaryPendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.length;
}

export function notifySalaryPendingInboxChanged() {
    clearPendingInboxCache(SALARY_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(SALARY_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
