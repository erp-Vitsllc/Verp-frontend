import {
    collectEmployeeLiveExpiryNotifications,
    mergeExpiryNotificationDedupe,
} from '@/utils/expiryNotificationFallbacks';
import {
    filterMandatoryCardsNotificationsByProgress,
    isMandatoryCardsProfileIncompleteItem,
    PROFILE_INCOMPLETE_TYPE,
} from '@/utils/employeeProfileIncompleteNotifications';
import { isCardDeletedNotificationHiddenType } from '@/utils/cardDeletedNotifications';
import { sortNotificationsStackOrder } from '@/utils/notificationSortOrder';
import { filterActionableDashboardItems } from '@/utils/activationNotificationFilters';
import {
    getViewerEmployeeObjectIdFromStorage,
    isFlowchartHrForExpiryTasks,
} from '@/utils/flowchartHrExpiryVisibility';
import { isAdmin } from '@/utils/permissions';

export const EMPLOYEE_NOTIFICATION_TYPES = new Set([
    'Profile Activation',
    PROFILE_INCOMPLETE_TYPE,
    'Employee Document Expiry Reminder',
    'Probation Change',
    'Employee Document Not Renew',
]);

/** Hidden from Employees bell + dashboard Command Center. */
export function isEmployeeNotificationHiddenType(type) {
    return String(type || '').trim() === 'Notice Request';
}

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
            if (isEmployeeNotificationHiddenType(type)) return false;
            if (isCardDeletedNotificationHiddenType(type)) return false;
            if (!mandatoryCardsHrLive && isMandatoryCardsProfileIncompleteItem(item)) return false;
            return EMPLOYEE_NOTIFICATION_TYPES.has(type);
        }),
        employeesList,
    );

    const liveExpiry = hrLive ? collectEmployeeLiveExpiryNotifications(employeesList) : [];
    const hasEmployeeList = Array.isArray(employeesList) && employeesList.length > 0;

    return sortNotificationsStackOrder(
        filterMandatoryCardsNotificationsByProgress(
            mergeExpiryNotificationDedupe(employeeFiltered, liveExpiry, {
                employees: hasEmployeeList ? employeesList : null,
                preferLiveForTypes:
                    hrLive && hasEmployeeList ? ['Employee Document Expiry Reminder'] : [],
            }),
            employeesList,
        ),
    );
}

/**
 * Exact same list as Employees page bell / modal.
 * Used by emp list page, sidebar badge, and dashboard Command Center Employees section.
 */
export function buildEmployeeListBellFromStats(statsData, employeesList = [], options = {}) {
    const items = Array.isArray(statsData?.items) ? statsData.items : [];
    const pendingItems = filterActionableDashboardItems(items);
    const flowchartHrId = statsData?.flowchartHrEmployeeObjectId ?? null;
    const sessionViewerId =
        typeof window !== 'undefined' ? getViewerEmployeeObjectIdFromStorage() : null;
    const asEmployeeObjectId = options.asEmployeeObjectId
        ? String(options.asEmployeeObjectId)
        : null;
    const viewerId = asEmployeeObjectId || sessionViewerId;
    const allowSessionAdmin = !asEmployeeObjectId;

    const hrLive =
        options.liveExpiryHrView != null
            ? Boolean(options.liveExpiryHrView)
            : typeof window !== 'undefined' &&
              ((allowSessionAdmin && isAdmin()) ||
                  isFlowchartHrForExpiryTasks(flowchartHrId, viewerId));
    const mandatoryCardsHrLive =
        options.mandatoryCardsHrLive != null
            ? Boolean(options.mandatoryCardsHrLive)
            : typeof window !== 'undefined' && isFlowchartHrForExpiryTasks(flowchartHrId, viewerId);
    return buildEmployeePageNotifications(pendingItems, employeesList, hrLive, mandatoryCardsHrLive);
}
