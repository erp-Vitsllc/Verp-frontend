import {
    collectCompanyLiveExpiryNotifications,
    mergeExpiryNotificationDedupe,
} from '@/utils/expiryNotificationFallbacks';
import {
    collectCompanyActivationIncompleteNotifications,
    COMPANY_ACTIVATION_INCOMPLETE_TYPE,
} from '@/utils/companyActivationIncompleteNotifications';

const COMPANY_NOTIFICATION_TYPES = new Set([
    'Company Activation',
    COMPANY_ACTIVATION_INCOMPLETE_TYPE,
    'Document Expiry Reminder',
    'Company Document Not Renew',
]);

/** Company bell + modal list — one row in UI per returned item. */
export function buildCompanyPageNotifications(pendingItems = [], companiesList = [], hrLive = false) {
    const companyFiltered = (pendingItems || []).filter((item) =>
        COMPANY_NOTIFICATION_TYPES.has(String(item?.type || '').trim()),
    );

    const activationIncomplete = hrLive
        ? collectCompanyActivationIncompleteNotifications(companiesList)
        : [];

    return mergeExpiryNotificationDedupe(
        companyFiltered,
        [...(hrLive ? collectCompanyLiveExpiryNotifications(companiesList) : []), ...activationIncomplete],
    );
}
