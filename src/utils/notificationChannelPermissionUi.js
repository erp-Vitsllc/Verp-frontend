let cache = { at: 0, byDashboardType: null };
const CACHE_MS = 20 * 1000;

export function invalidateNotificationChannelMap() {
    cache = { at: 0, byDashboardType: null };
}

export function hiddenNotificationTypesFromMap(byDashboardType) {
    return Object.entries(byDashboardType || {})
        .filter(([, channels]) => channels && channels.notification === false)
        .map(([type]) => type);
}

export function getHiddenNotificationTypesSet(byDashboardType) {
    const map = byDashboardType || cache.byDashboardType || {};
    return new Set(hiddenNotificationTypesFromMap(map));
}

export function isNotificationTypeHidden(item, hiddenTypes) {
    if (!hiddenTypes || !hiddenTypes.size) return false;
    const type = String(item?.type || item?.requestType || '').trim();
    return hiddenTypes.has(type);
}

export function filterItemsByNotificationPermission(items, byDashboardType) {
    const hidden = getHiddenNotificationTypesSet(byDashboardType);
    if (!hidden.size) return Array.isArray(items) ? items : [];
    return (Array.isArray(items) ? items : []).filter((item) => !isNotificationTypeHidden(item, hidden));
}

export async function loadNotificationChannelMap(axiosInstance) {
    const now = Date.now();
    if (cache.byDashboardType && now - cache.at < CACHE_MS) {
        return cache.byDashboardType;
    }
    try {
        const res = await axiosInstance.get('/NotificationEmailPermission/map', { skipToast: true });
        const byDashboardType = res.data?.byDashboardType || {};
        cache = { at: now, byDashboardType };
        return byDashboardType;
    } catch {
        return cache.byDashboardType || {};
    }
}
