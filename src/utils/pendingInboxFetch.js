import { sortNotificationsStackOrder } from '@/utils/notificationSortOrder';

const CACHE_TTL_MS = 2 * 60 * 1000;
/** Asset vehicle/tools inbox: longer TTL so badge warm + modal share without re-hit. */
const ASSET_INBOX_CACHE_TTL_MS = 3 * 60 * 1000;

const cachedByKey = new Map();
const inFlightByKey = new Map();

export const FINE_PENDING_INBOX_ENDPOINT = '/Fine/dashboard/pending-inbox';
export const PAYMENT_PENDING_INBOX_ENDPOINT = '/Payment/dashboard/pending-inbox';
export const ASSET_PENDING_INBOX_ENDPOINT = '/AssetItem/dashboard/pending-inbox';
export const REWARD_PENDING_INBOX_ENDPOINT = '/Reward/dashboard/pending-inbox';
export const LOAN_PENDING_INBOX_ENDPOINT = '/Employee/loans/dashboard/pending-inbox';
export const ATTENDANCE_PENDING_INBOX_ENDPOINT = '/Attendance/dashboard/pending-inbox';

function buildCacheKey(endpoint, params = {}) {
    // skipSync must NOT fragment the cache — badge (skipSync) and modal must share rows.
    const entries = Object.entries(params)
        .filter(([key, value]) => key !== 'skipSync' && value != null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return endpoint;
    const qs = entries.map(([key, value]) => `${key}=${value}`).join('&');
    return `${endpoint}?${qs}`;
}

function cacheTtlForKey(key) {
    if (String(key || '').includes(ASSET_PENDING_INBOX_ENDPOINT)) return ASSET_INBOX_CACHE_TTL_MS;
    return CACHE_TTL_MS;
}

function getCachedEntry(key) {
    const entry = cachedByKey.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at >= cacheTtlForKey(key)) return null;
    return entry.items;
}

export function getCachedPendingInbox(endpoint, params = {}) {
    return getCachedEntry(buildCacheKey(endpoint, params));
}

export function rememberPendingInbox(endpoint, params = {}, items = []) {
    const list = sortNotificationsStackOrder(Array.isArray(items) ? items : []);
    const key = buildCacheKey(endpoint, params);
    cachedByKey.set(key, { items: list, at: Date.now() });
    return list;
}

export function clearPendingInboxCache(endpoint, params) {
    if (!endpoint) {
        cachedByKey.clear();
        inFlightByKey.clear();
        return;
    }
    const key = buildCacheKey(endpoint, params || {});
    cachedByKey.delete(key);
    inFlightByKey.delete(key);
}

/** Deduped fetch for module pending-inbox endpoints — shared by bell count + modal. */
export async function fetchPendingInbox(
    axiosInstance,
    endpoint,
    { params, force = false, skipToast = true } = {},
) {
    const key = buildCacheKey(endpoint, params || {});

    if (!force) {
        const cached = getCachedEntry(key);
        if (cached) return cached;
    }

    if (inFlightByKey.has(key) && !force) {
        return inFlightByKey.get(key);
    }

    const request = axiosInstance
        .get(endpoint, {
            params: params && Object.keys(params).length ? params : undefined,
            skipToast,
        })
        .then((res) => {
            const list = sortNotificationsStackOrder(
                Array.isArray(res.data?.items) ? res.data.items : [],
            );
            cachedByKey.set(key, { items: list, at: Date.now() });
            return list;
        })
        .finally(() => {
            inFlightByKey.delete(key);
        });

    inFlightByKey.set(key, request);
    return request;
}

export function fetchFinePendingInbox(axiosInstance, options = {}) {
    const { targetUserId, ...rest } = options;
    const params = targetUserId ? { targetUserId } : undefined;
    return fetchPendingInbox(axiosInstance, FINE_PENDING_INBOX_ENDPOINT, { ...rest, params });
}

export function fetchPaymentPendingInbox(axiosInstance, options = {}) {
    const { targetUserId, ...rest } = options;
    const params = targetUserId ? { targetUserId } : undefined;
    return fetchPendingInbox(axiosInstance, PAYMENT_PENDING_INBOX_ENDPOINT, { ...rest, params });
}

export function fetchRewardPendingInbox(axiosInstance, options = {}) {
    const { targetUserId, ...rest } = options;
    const params = targetUserId ? { targetUserId } : undefined;
    return fetchPendingInbox(axiosInstance, REWARD_PENDING_INBOX_ENDPOINT, { ...rest, params });
}

export function fetchLoanPendingInbox(axiosInstance, options = {}) {
    const { targetUserId, ...rest } = options;
    const params = targetUserId ? { targetUserId } : undefined;
    return fetchPendingInbox(axiosInstance, LOAN_PENDING_INBOX_ENDPOINT, { ...rest, params });
}

export function fetchAttendancePendingInbox(axiosInstance, options = {}) {
    const { targetUserId, ...rest } = options;
    const params = targetUserId ? { targetUserId } : undefined;
    return fetchPendingInbox(axiosInstance, ATTENDANCE_PENDING_INBOX_ENDPOINT, { ...rest, params });
}

/**
 * Asset pending inbox. Prefer skipSync:true for UI (badge/modal) — sync is expensive.
 * Cache is shared across skipSync on/off so badge warm hydrates the modal instantly.
 */
export function fetchAssetPendingInbox(
    axiosInstance,
    { inboxScope = 'all', skipSync = true, targetUserId, ...options } = {},
) {
    const params = {};
    if (inboxScope === 'tools' || inboxScope === 'vehicle') params.scope = inboxScope;
    if (skipSync !== false) params.skipSync = '1';
    if (targetUserId) params.targetUserId = targetUserId;
    return fetchPendingInbox(axiosInstance, ASSET_PENDING_INBOX_ENDPOINT, { ...options, params });
}
