import {
    collectCompanyLiveExpiryNotifications,
    mergeExpiryNotificationDedupe,
} from '@/utils/expiryNotificationFallbacks';
import {
    collectCompanyActivationIncompleteNotifications,
    COMPANY_ACTIVATION_INCOMPLETE_TYPE,
} from '@/utils/companyActivationIncompleteNotifications';
import { isCardDeletedNotificationHiddenType } from '@/utils/cardDeletedNotifications';
import {
    clearEmployeeDashboardStatsCache,
    fetchEmployeeDashboardStats,
    getCachedEmployeeDashboardStats,
} from '@/utils/employeeDashboardStatsFetch';
import { sortNotificationsStackOrder } from '@/utils/notificationSortOrder';

const COMPANY_NOTIFICATION_TYPES = new Set([
    'Company Activation',
    COMPANY_ACTIVATION_INCOMPLETE_TYPE,
    'Document Expiry Reminder',
    'Company Document Not Renew',
]);

export const COMPANY_EXPIRY_SYNC_TS_KEY = 'verp:company-expiry-sync-at';
export const COMPANY_EXPIRY_SYNC_TTL_MS = 10 * 60 * 1000;

const BUNDLE_CACHE_TTL_MS = 2 * 60 * 1000;
const COMPANY_LIST_CACHE_TTL_MS = 2 * 60 * 1000;

let inFlightBundle = null;
let cachedBundle = null;
let cachedBundleAt = 0;
let inFlightCompanyList = null;
let cachedCompanyList = null;
let cachedCompanyListAt = 0;

export function shouldRunCompanyExpirySync() {
    if (typeof window === 'undefined') return true;
    const last = Number(sessionStorage.getItem(COMPANY_EXPIRY_SYNC_TS_KEY) || 0);
    return !(last > 0 && Date.now() - last < COMPANY_EXPIRY_SYNC_TTL_MS);
}

export function markCompanyExpirySyncRan() {
    if (typeof window !== 'undefined') {
        sessionStorage.setItem(COMPANY_EXPIRY_SYNC_TS_KEY, String(Date.now()));
    }
}

export function getCachedCompanyNotificationBundle() {
    if (cachedBundle && Date.now() - cachedBundleAt < BUNDLE_CACHE_TTL_MS) {
        return cachedBundle;
    }
    return null;
}

export function clearCompanyNotificationBundleCache() {
    cachedBundle = null;
    cachedBundleAt = 0;
    inFlightBundle = null;
    cachedCompanyList = null;
    cachedCompanyListAt = 0;
    inFlightCompanyList = null;
    clearEmployeeDashboardStatsCache();
}

function rememberCompanyList(companiesList) {
    if (!Array.isArray(companiesList)) return;
    cachedCompanyList = companiesList;
    cachedCompanyListAt = Date.now();
}

async function fetchCompanyList(axiosInstance, { fallback = [], force = false } = {}) {
    if (!force && cachedCompanyList && Date.now() - cachedCompanyListAt < COMPANY_LIST_CACHE_TTL_MS) {
        return cachedCompanyList;
    }
    if (inFlightCompanyList && !force) return inFlightCompanyList;

    inFlightCompanyList = axiosInstance
        .get('/Company', { skipToast: true })
        .then((companyRes) => {
            const list = Array.isArray(companyRes?.data?.companies) ? companyRes.data.companies : fallback;
            rememberCompanyList(list);
            return list;
        })
        .catch(() => fallback)
        .finally(() => {
            inFlightCompanyList = null;
        });

    return inFlightCompanyList;
}

async function loadCompanyNotificationBundleImpl(
    axiosInstance,
    { hrLive = false, cachedCompanies = [], skipExpirySync = false, skipCompanyFetch = false, force = false } = {},
) {
    let runExpirySync = hrLive && !skipExpirySync && shouldRunCompanyExpirySync();

    if (runExpirySync) {
        try {
            await axiosInstance.post('/Company/sync-expiry-notifications', {}, { skipToast: true });
            markCompanyExpirySyncRan();
        } catch {
            /* best-effort — fallbacks still run client-side */
        }
    }

    let statsRes = { data: { items: [] } };
    let companiesList = Array.isArray(cachedCompanies) ? cachedCompanies : [];

    try {
        statsRes = await fetchEmployeeDashboardStats(axiosInstance, { force, skipToast: true });
    } catch {
        const cachedStats = getCachedEmployeeDashboardStats();
        if (cachedStats) statsRes = cachedStats;
    }

    if (skipCompanyFetch && companiesList.length > 0) {
        rememberCompanyList(companiesList);
    } else {
        companiesList = await fetchCompanyList(axiosInstance, { fallback: companiesList, force });
    }

    return { statsRes, companiesList };
}

/** Fetch dashboard stats + company list; deduped + cached for bell count and modal. */
export async function loadCompanyNotificationBundle(
    axiosInstance,
    { hrLive = false, cachedCompanies = [], skipExpirySync = false, skipCompanyFetch = false, force = false } = {},
) {
    if (!force) {
        const cached = getCachedCompanyNotificationBundle();
        if (cached) {
            const companiesList =
                skipCompanyFetch && Array.isArray(cachedCompanies) && cachedCompanies.length > 0
                    ? cachedCompanies
                    : cached.companiesList;
            return { statsRes: cached.statsRes, companiesList };
        }
    }

    if (inFlightBundle && !force) return inFlightBundle;

    inFlightBundle = loadCompanyNotificationBundleImpl(axiosInstance, {
        hrLive,
        cachedCompanies,
        skipExpirySync,
        skipCompanyFetch,
        force,
    })
        .then((result) => {
            cachedBundle = result;
            cachedBundleAt = Date.now();
            return result;
        })
        .finally(() => {
            inFlightBundle = null;
        });

    return inFlightBundle;
}

/** Company bell + modal list — one row in UI per returned item. */
export function buildCompanyPageNotifications(
    pendingItems = [],
    companiesList = [],
    hrLive = false,
    mandatoryCardsHrLive = false,
) {
    const companyFiltered = (pendingItems || []).filter((item) => {
        const type = String(item?.type || '').trim();
        if (isCardDeletedNotificationHiddenType(type)) return false;
        return COMPANY_NOTIFICATION_TYPES.has(type);
    });

    const liveExpiry = hrLive
        ? collectCompanyLiveExpiryNotifications(companiesList)
        : [];

    const activationIncomplete = mandatoryCardsHrLive
        ? collectCompanyActivationIncompleteNotifications(companiesList)
        : [];

    const hasCompanyList = Array.isArray(companiesList) && companiesList.length > 0;

    return sortNotificationsStackOrder(
        mergeExpiryNotificationDedupe(
            companyFiltered,
            [...liveExpiry, ...activationIncomplete],
            {
                companies: hasCompanyList ? companiesList : null,
                preferLiveForTypes: hrLive && hasCompanyList ? ['Document Expiry Reminder'] : [],
            },
        ),
    );
}

export function rememberCompanyListFromPage(companiesList) {
    rememberCompanyList(companiesList);
}
