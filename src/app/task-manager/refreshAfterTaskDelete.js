import { clearPendingInboxCache } from '@/utils/pendingInboxFetch';
import { clearEmployeeDashboardStatsCache } from '@/utils/employeeDashboardStatsFetch';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';

const INBOX_EVENTS = [
    'leave-pending-inbox-changed',
    'attendance-pending-inbox-changed',
    'asset-pending-inbox-changed',
    'fine-pending-inbox-changed',
    'salary-pending-inbox-changed',
    'payment-pending-inbox-changed',
    'reward-pending-inbox-changed',
    'loan-pending-inbox-changed',
];

export function refreshAfterTaskDelete() {
    clearPendingInboxCache();
    clearEmployeeDashboardStatsCache();
    clearModuleNotificationFeedsCache();
    if (typeof window === 'undefined') return;
    INBOX_EVENTS.forEach((name) => {
        const event = new CustomEvent(name);
        window.dispatchEvent(event);
        document.dispatchEvent(event);
    });
}
