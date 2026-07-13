import {
    collectEmployeeLiveExpiryNotifications,
    mergeExpiryNotificationDedupe,
} from '@/utils/expiryNotificationFallbacks';
import {
    filterMandatoryCardsNotificationsByProgress,
    isMandatoryCardsProfileIncompleteItem,
    PROFILE_INCOMPLETE_TYPE,
} from '@/utils/employeeProfileIncompleteNotifications';
import {
    CARD_DELETED_PROGRESS_TYPE,
    includesCardDeletedNotificationType,
} from '@/utils/cardDeletedNotifications';
import { sortNotificationsStackOrder } from '@/utils/notificationSortOrder';

const EMPLOYEE_NOTIFICATION_TYPES = new Set([
    'Profile Activation',
    PROFILE_INCOMPLETE_TYPE,
    'Employee Document Expiry Reminder',
    'Probation Change',
    'Employee Document Not Renew',
    'Notice Request',
    CARD_DELETED_PROGRESS_TYPE,
]);

/** Employee bell + modal list — one row in UI per returned item. */
export function buildEmployeePageNotifications(
    pendingItems = [],
    employeesList = [],
    hrLive = false,
    mandatoryCardsHrLive = false,
) {
    const employeeFiltered = filterMandatoryCardsNotificationsByProgress(
        (pendingItems || []).filter((item) => {
            const type = String(item?.type || '').trim();
            if (!mandatoryCardsHrLive && isMandatoryCardsProfileIncompleteItem(item)) return false;
            return (
                EMPLOYEE_NOTIFICATION_TYPES.has(type) ||
                includesCardDeletedNotificationType(item?.type)
            );
        }),
        employeesList,
    );

    const liveExpiry = hrLive ? collectEmployeeLiveExpiryNotifications(employeesList) : [];

    return sortNotificationsStackOrder(
        filterMandatoryCardsNotificationsByProgress(
            mergeExpiryNotificationDedupe(employeeFiltered, liveExpiry),
            employeesList,
        ),
    );
}
