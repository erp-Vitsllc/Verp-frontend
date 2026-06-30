const LIST_RETURN_KEY = 'verp:list-return-href';
const NAV_STACK_KEY = 'verp:nav-return-stack';
const MAX_NAV_STACK = 50;

let suppressNextNavigationPush = false;
let skipTrackerPushOnce = false;

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

function normalizeHref(href) {
    if (!href || typeof href !== 'string') return '';
    let trimmed = href.trim();
    if (!trimmed) return '';

    // Recover paths that were already mangled (e.g. /http:/localhost:3000/...)
    if (/^\/https?:\/?/i.test(trimmed)) {
        trimmed = trimmed.replace(/^\/+/, '').replace(/^http:\/?\/?/i, 'http://');
    }

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            return `${url.pathname}${url.search}${url.hash}`;
        } catch {
            /* fall through */
        }
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Employee profile tab slug from URL (`basic` when `tab` is absent). */
export function employeeProfileTabKey(href) {
    const path = normalizeHref(href);
    const match = path.match(/^(\/emp\/[^/?]+)/);
    if (!match) return null;
    const base = match[1];
    try {
        const url = new URL(path, 'http://local');
        if (url.pathname !== base) return null;
        const tab = String(url.searchParams.get('tab') || 'basic').trim().toLowerCase();
        const slug = tab === 'work' ? 'work' : tab || 'basic';
        return `${base}::${slug}`;
    } catch {
        return null;
    }
}

function hrefsEquivalent(a, b) {
    const na = normalizeHref(a);
    const nb = normalizeHref(b);
    if (!na || !nb) return na === nb;
    if (na === nb) return true;
    try {
        const ua = new URL(na, 'http://local');
        const ub = new URL(nb, 'http://local');
        if (ua.pathname !== ub.pathname) return false;
        const sa = new URLSearchParams(ua.search);
        const sb = new URLSearchParams(ub.search);
        sa.sort();
        sb.sort();
        return sa.toString() === sb.toString();
    } catch {
        return false;
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
    if (hrefsEquivalent(last, path)) return;
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

/** rememberListFilterStep already pushed — tracker must not push again on the same URL change. */
export function consumeSkipTrackerPushOnce() {
    if (!skipTrackerPushOnce) return false;
    skipTrackerPushOnce = false;
    return true;
}

/**
 * Remember the last list URL (path + query) so detail pages can seed the stack on first navigation.
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

export function clearListReturnState() {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.removeItem(LIST_RETURN_KEY);
    } catch {
        // ignore
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
 * Pop the top stack entry and navigate there. Each back consumes one entry (no loops).
 */
export function tryNavigateListReturn(router) {
    if (!router) return false;

    let href = popNavigationReturnState();
    if (!href) {
        const saved = getListReturnHref();
        const current = normalizeHref(getBrowserPathWithSearch());
        if (saved && !hrefsEquivalent(saved, current)) {
            href = normalizeHref(saved);
            clearListReturnState();
        }
    }

    if (!href) return false;

    suppressNextNavigationStackPush();
    skipTrackerPushOnce = true;
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

export function getBrowserPathWithSearch() {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}`;
}

/**
 * Sync filters/pagination into the visible address bar (router.replace alone can leave the bar stale).
 */
export function syncBrowserUrl(pathWithQuery) {
    if (typeof window === 'undefined') return false;
    const next = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (hrefsEquivalent(next, current)) return false;
    window.history.replaceState(window.history.state, '', next);
    notifyLocationSync();
    return true;
}

/**
 * Push an explicit previous URL then sync the address bar (avoids stale window.location during fast tab clicks).
 */
export function rememberListFilterStepFrom(fromHref, nextHref) {
    if (typeof window === 'undefined') return;
    const from = normalizeHref(fromHref);
    const next = normalizeHref(nextHref);
    if (!next) return;
    if (from && !hrefsEquivalent(from, next)) {
        skipTrackerPushOnce = true;
        pushNavigationReturnState(from);
    }
    syncBrowserUrl(next);
    saveListReturnState(next);
}

/**
 * When list filters / tabs change on the same page, push the previous URL so Back undoes the last step.
 */
export function rememberListFilterStep(nextHref) {
    rememberListFilterStepFrom(getBrowserPathWithSearch(), nextHref);
}

/**
 * Open a detail (or child) page while remembering the current list view for Back.
 */
export function navigateFromList(router, targetHref, listReturnHref) {
    if (!router) return;
    const target = normalizeHref(targetHref);
    if (!target) return;
    const list = normalizeHref(listReturnHref || getBrowserPathWithSearch());
    if (list && !hrefsEquivalent(list, target)) {
        saveListReturnState(list);
        pushNavigationReturnState(list);
    }
    suppressNextNavigationStackPush();
    skipTrackerPushOnce = true;
    router.push(target);
}

/**
 * Use on list row <Link> clicks: normal click uses navigateFromList (back stack);
 * Ctrl/Cmd+click, middle-click, and right-click → "Open in new tab" use the real href.
 */
export function handleNavigateFromListClick(event, router, targetHref, listReturnHref) {
    if (!router) return;
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    ) {
        return;
    }
    event.preventDefault();
    navigateFromList(router, targetHref, listReturnHref);
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

/**
 * When a notification opens the same list route, merge current filters/pagination/tab
 * query params so the user lands on the same view with notification params applied.
 */
export function mergeListContextIntoNotificationPath(targetHref, listHref = getBrowserPathWithSearch()) {
    const target = normalizeHref(targetHref);
    const list = normalizeHref(listHref);
    if (!target || !list) return target;
    try {
        const targetUrl = new URL(target, 'http://local');
        const listUrl = new URL(list, 'http://local');
        if (targetUrl.pathname !== listUrl.pathname) return target;
        const merged = new URLSearchParams(listUrl.search);
        targetUrl.searchParams.forEach((value, key) => merged.set(key, value));
        const qs = merged.toString();
        return qs ? `${targetUrl.pathname}?${qs}` : targetUrl.pathname;
    } catch {
        return target;
    }
}

/**
 * Taskbar / bell notification click from a list page: push list state for Back and
 * preserve filters, tabs, and pagination when the destination shares the list path.
 */
export function navigateFromNotificationClick(router, targetHref, listHref) {
    const list = normalizeHref(listHref || getBrowserPathWithSearch());
    const destination = mergeListContextIntoNotificationPath(targetHref, list);
    navigateFromList(router, destination, list);
}

/** True when our stack can serve a back navigation. */
export function hasAppNavigationBack() {
    if (typeof window === 'undefined') return false;
    if (getNavigationStackDepth() > 0) return true;
    const saved = getListReturnHref();
    const current = normalizeHref(getBrowserPathWithSearch());
    return Boolean(saved && !hrefsEquivalent(saved, current));
}

/** Keep stack aligned when the user uses the browser back/forward buttons. */
export function syncNavigationStackOnBrowserPop() {
    if (typeof window === 'undefined') return;
    if (readStack().length > 0) {
        popNavigationReturnState();
    }
}
