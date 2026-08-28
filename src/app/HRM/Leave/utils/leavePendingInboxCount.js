import {
    clearPendingInboxCache,
    LEAVE_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';

export const LEAVE_PENDING_INBOX_CHANGED = 'leave-pending-inbox-changed';

/** Same count as the Leave Dashboard bell icon. */
export function countVisibleLeavePendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.filter((row) => {
        const name = String(row?.subjectName || row?.employeeName || '').trim();
        return !/\(company\)\s*$/i.test(name);
    }).length;
}

export function notifyLeavePendingInboxChanged() {
    clearPendingInboxCache(LEAVE_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(LEAVE_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
