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

export function deletedTaskToastDescription(category, data) {
    const base = category === 'General Task'
        ? 'The task and its notifications were removed.'
        : 'The task, its workflow, and its notifications were removed.';
    const name = String(data?.assigneeName || '').trim();
    if (data?.emailSent && name) {
        return `${base} ${name} was emailed that admin deleted this task and they no longer need to work on it.`;
    }
    if (data?.emailAttempted && name) {
        return `${base} ${name} could not be emailed.`;
    }
    return base;
}

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
