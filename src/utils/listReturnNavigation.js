const LIST_RETURN_KEY = 'verp:list-return-href';
const NAV_STACK_KEY = 'verp:nav-return-stack';
const MAX_NAV_STACK = 40;

let suppressNextNavigationPush = false;

function readStack() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(NAV_STACK_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((h) => typeof h === 'string' && h.startsWith('/')) : [];
    } catch {
        return [];
    }
}

function writeStack(stack) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack.slice(-MAX_NAV_STACK)));
    } catch {
        // ignore quota / private mode
    }
}

/**
 * Push a page (path + query) onto the ERP back stack. Skips duplicate consecutive entries.
 */
export function pushNavigationReturnState(href) {
    if (typeof window === 'undefined') return;
    const path = normalizeHref(href);
    if (!path || path === '/' || path.startsWith('/login')) return;
    const stack = readStack();
    const last = stack[stack.length - 1];
    if (last === path) return;
    stack.push(path);
    writeStack(stack);
}

export function popNavigationReturnState() {
    const stack = readStack();
    if (!stack.length) return null;
    const href = stack.pop() || null;
    writeStack(stack);
    return href;
}

export function peekNavigationReturnState() {
    const stack = readStack();
    return stack.length ? stack[stack.length - 1] : null;
}

export function getNavigationStackDepth() {
    return readStack().length;
}

/** After programmatic back, skip one tracker push (avoids re-pushing the page we left). */
export function suppressNextNavigationStackPush() {
    suppressNextNavigationPush = true;
}

export function consumeNavigationPushSuppression() {
    if (!suppressNextNavigationPush) return false;
    suppressNextNavigationPush = false;
    return true;
}

function normalizeHref(href) {
    if (!href || typeof href !== 'string') return '';
    const trimmed = href.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Remember the last list URL (path + query) so detail pages can return to the same filters/pagination.
 */
export function saveListReturnState(href) {
    if (typeof window === 'undefined') return;
    const path = normalizeHref(href || getBrowserPathWithSearch());
    if (!path || path === '/') return;
    try {
        sessionStorage.setItem(LIST_RETURN_KEY, path);
    } catch {
        // ignore quota / private mode
    }
}

export function getListReturnHref() {
    if (typeof window === 'undefined') return null;
    try {
        return sessionStorage.getItem(LIST_RETURN_KEY);
    } catch {
        return null;
    }
}

/**
 * Navigate to the previous ERP page (stack first, then saved list URL). Returns true when navigation ran.
 */
export function tryNavigateListReturn(router) {
    if (!router) return false;
    const href = popNavigationReturnState() || getListReturnHref();
    if (!href) return false;
    suppressNextNavigationStackPush();
    router.push(href);
    return true;
}

const LOCATION_SYNC_EVENT = 'verp:location-sync';

/** Lets ErpNavigationTracker keep prev href in sync after replaceState filter updates. */
export function notifyLocationSync() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCATION_SYNC_EVENT));
}

export function getLocationSyncEventName() {
    return LOCATION_SYNC_EVENT;
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
    notifyLocationSync();
    return true;
}

/**
 * When list filters change on the same page, push the previous URL so Back undoes the last filter step.
 */
export function rememberListFilterStep(nextHref) {
    if (typeof window === 'undefined') return;
    const next = normalizeHref(nextHref);
    if (!next) return;
    const current = normalizeHref(getBrowserPathWithSearch());
    if (current && current !== next) {
        pushNavigationReturnState(current);
    }
    syncBrowserUrl(next);
    saveListReturnState(next);
}

/**
 * Open a detail (or child) page while remembering the current list view for Back.
 */
export function navigateFromList(router, targetHref, listReturnHref) {
    if (!router) return;
    const target = normalizeHref(targetHref);
    if (!target) return;
    const list = normalizeHref(listReturnHref || getBrowserPathWithSearch());
    if (list) {
        saveListReturnState(list);
        pushNavigationReturnState(list);
    }
    suppressNextNavigationStackPush();
    router.push(target);
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

/** True when our stack or saved list URL can serve a back navigation. */
export function hasAppNavigationBack() {
    if (typeof window === 'undefined') return false;
    return getNavigationStackDepth() > 0 || Boolean(getListReturnHref());
}
