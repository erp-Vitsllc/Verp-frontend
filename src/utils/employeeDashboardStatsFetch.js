let inFlightPromise = null;
let cachedResponse = null;
let cachedAt = 0;

const CACHE_TTL_MS = 2 * 60 * 1000;

export function getCachedEmployeeDashboardStats() {
    if (cachedResponse && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedResponse;
    }
    return null;
}

export function clearEmployeeDashboardStatsCache() {
    cachedResponse = null;
    cachedAt = 0;
    inFlightPromise = null;
}

/** Deduped fetch for `/Employee/dashboard/user-stats` — shared by bell count + modal. */
export async function fetchEmployeeDashboardStats(axiosInstance, { force = false, skipToast = true } = {}) {
    if (!force) {
        const cached = getCachedEmployeeDashboardStats();
        if (cached) return cached;
    }

    if (inFlightPromise) return inFlightPromise;

    inFlightPromise = axiosInstance
        .get('/Employee/dashboard/user-stats', { skipToast })
        .then((res) => {
            cachedResponse = res;
            cachedAt = Date.now();
            return res;
        })
        .finally(() => {
            inFlightPromise = null;
        });

    return inFlightPromise;
}
