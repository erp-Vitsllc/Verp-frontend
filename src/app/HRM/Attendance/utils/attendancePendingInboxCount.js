import {
    clearPendingInboxCache,
    ATTENDANCE_PENDING_INBOX_ENDPOINT,
} from '@/utils/pendingInboxFetch';
import { isTaskManagerHubRequest } from '@/utils/employeeHubRequest';

export const ATTENDANCE_PENDING_INBOX_CHANGED = 'attendance-pending-inbox-changed';

/** Same count as the Attendance page bell icon. */
export function countVisibleAttendancePendingInbox(items) {
    const list = Array.isArray(items) ? items : [];
    return list.filter((row) => {
        if (isTaskManagerHubRequest(row)) return false;
        const name = String(row?.subjectName || row?.employeeName || '').trim();
        return !/\(company\)\s*$/i.test(name);
    }).length;
}

export function notifyAttendancePendingInboxChanged() {
    clearPendingInboxCache(ATTENDANCE_PENDING_INBOX_ENDPOINT);
    if (typeof window !== 'undefined') {
        const event = new CustomEvent(ATTENDANCE_PENDING_INBOX_CHANGED);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    }
}
