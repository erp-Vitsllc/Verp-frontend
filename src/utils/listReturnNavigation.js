const STORAGE_KEY = 'verp:list-return-href';

/**
 * Remember the last list URL (path + query) so detail pages can return to the same filters/pagination.
 */
export function saveListReturnState(href) {
    if (typeof window === 'undefined') return;
    const path = href || `${window.location.pathname}${window.location.search}`;
    if (!path || path === '/') return;
    try {
        sessionStorage.setItem(STORAGE_KEY, path);
    } catch {
        // ignore quota / private mode
    }
}

export function getListReturnHref() {
    if (typeof window === 'undefined') return null;
    try {
        return sessionStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Navigate to the saved list URL. Returns true when navigation was performed.
 */
export function tryNavigateListReturn(router) {
    const href = getListReturnHref();
    if (!href || !router) return false;
    router.push(href);
    return true;
}

/**
 * Sync filters/pagination into the visible address bar (router.replace alone can leave the bar on /emp while state has ?page=N).
 */
export function syncBrowserUrl(pathWithQuery) {
    if (typeof window === 'undefined') return false;
    const next = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next === current) return false;
    window.history.replaceState(window.history.state, '', next);
    return true;
}

export function getBrowserPathWithSearch() {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}`;
}

export function buildListReturnHref(pathname, params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        search.set(key, String(value));
    });
    const qs = search.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}
