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

/** Fetch dashboard stats + fresh company list; optionally sync expiry tasks on the server first. */
export async function loadCompanyNotificationBundle(axiosInstance, { hrLive = false, cachedCompanies = [] } = {}) {
    if (hrLive) {
        try {
            await axiosInstance.post('/Company/sync-expiry-notifications', {}, { skipToast: true });
        } catch {
            /* best-effort — fallbacks still run client-side */
        }
    }

    let statsRes = { data: { items: [] } };
    let companiesList = Array.isArray(cachedCompanies) ? cachedCompanies : [];

    try {
        statsRes = await axiosInstance.get('/Employee/dashboard/user-stats', { skipToast: true });
    } catch {
        /* bell/modal can still use expiry fallbacks */
    }

    try {
        const companyRes = await axiosInstance.get('/Company', { skipToast: true });
        companiesList = Array.isArray(companyRes?.data?.companies)
            ? companyRes.data.companies
            : companiesList;
    } catch {
        /* keep cached list */
    }

    return { statsRes, companiesList };
}

/** Company bell + modal list — one row in UI per returned item. */
export function buildCompanyPageNotifications(pendingItems = [], companiesList = [], hrLive = false) {
    const companyFiltered = (pendingItems || []).filter((item) =>
        COMPANY_NOTIFICATION_TYPES.has(String(item?.type || '').trim()),
    );

    const activationIncomplete = hrLive
        ? collectCompanyActivationIncompleteNotifications(companiesList)
        : [];

    return mergeExpiryNotificationDedupe(companyFiltered, [
        ...collectCompanyLiveExpiryNotifications(companiesList),
        ...activationIncomplete,
    ]);
}
