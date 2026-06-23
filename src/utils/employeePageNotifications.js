import {
    collectEmployeeLiveExpiryNotifications,
    mergeExpiryNotificationDedupe,
} from '@/utils/expiryNotificationFallbacks';
import {
    collectEmployeeProfileIncompleteNotifications,
    PROFILE_INCOMPLETE_TYPE,
} from '@/utils/employeeProfileIncompleteNotifications';
import {
    CARD_DELETED_PROGRESS_TYPE,
    includesCardDeletedNotificationType,
} from '@/utils/cardDeletedNotifications';

const EMPLOYEE_NOTIFICATION_TYPES = new Set([
    'Profile Activation',
    PROFILE_INCOMPLETE_TYPE,
    'Employee Document Expiry Reminder',
    'Probation Change',
    'Employee Document Not Renew',
    CARD_DELETED_PROGRESS_TYPE,
]);

/** Employee bell + modal list — one row in UI per returned item. */
export function buildEmployeePageNotifications(pendingItems = [], employeesList = [], hrLive = false) {
    const employeeFiltered = (pendingItems || []).filter((item) =>
        EMPLOYEE_NOTIFICATION_TYPES.has(String(item?.type || '').trim()) ||
        includesCardDeletedNotificationType(item?.type),
    );

    const liveExpiry = hrLive ? collectEmployeeLiveExpiryNotifications(employeesList) : [];
    const profileIncomplete = hrLive ? collectEmployeeProfileIncompleteNotifications(employeesList) : [];

    return mergeExpiryNotificationDedupe(employeeFiltered, [...liveExpiry, ...profileIncomplete]);
}
