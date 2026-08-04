import axiosInstance from '@/utils/axios';

const FLOWCHART_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedRows = null;
let cachedAt = 0;
let inFlight = null;

/**
 * Shared /Flowchart fetch — dedupes concurrent callers and caches briefly
 * so oil/service pages + workflow panels do not stampede the API.
 */
export async function fetchFlowchartRows({ force = false } = {}) {
    if (!force && cachedRows && Date.now() - cachedAt < FLOWCHART_CACHE_TTL_MS) {
        return cachedRows;
    }
    if (inFlight && !force) return inFlight;

    inFlight = axiosInstance
        .get('/Flowchart', { skipToast: true })
        .then(({ data }) => {
            const rows = Array.isArray(data) ? data : [];
            cachedRows = rows;
            cachedAt = Date.now();
            return rows;
        })
        .catch(() => {
            if (cachedRows) return cachedRows;
            return [];
        })
        .finally(() => {
            inFlight = null;
        });

    return inFlight;
}

export function getCachedFlowchartRows() {
    if (cachedRows && Date.now() - cachedAt < FLOWCHART_CACHE_TTL_MS) return cachedRows;
    return null;
}

export function clearFlowchartRowsCache() {
    cachedRows = null;
    cachedAt = 0;
    inFlight = null;
}
