export const NOT_FOUND_PATH = '/system-unavailable';

const PUBLIC_PATH_PREFIXES = ['/login', '/print'];

export function isPublicPath(pathname) {
    const path = String(pathname || '');
    return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isOnNotFoundPage() {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    return path === NOT_FOUND_PATH || path === '/404';
}

/**
 * Only true server / connectivity failures should send users to the unavailable page.
 * Validation and business errors (400, 409, etc.) must stay on the current form.
 *
 * Note: transient 503 (e.g. brief Mongo reconnect) must NOT redirect — that causes
 * "Oops" + console `GET /404 404` noise while the user is mid-form.
 */
export function shouldApiErrorRedirectToNotFound(error) {
    if (!error || typeof window === 'undefined') return false;
    if (isOnNotFoundPage()) return false;
    if (isPublicPath(window.location.pathname)) return false;
    if (error.silent || error.redirectedToNotFound) return false;
    if (error.config?.skipRedirect || error.config?.skipToast) return false;

    const status =
        error?.response?.status ??
        error?.originalError?.response?.status;

    const method = String(error?.config?.method || 'get').toLowerCase();
    // Saves/uploads must never yank the user off the form.
    if (method !== 'get' && method !== 'head') return false;

    if (status == null) {
        // Network / timeout — show toast on the current page.
        return false;
    }

    if (status === 401) return false;

    // 4xx = client/validation/permission — show message on the page, do not redirect.
    if (status >= 400 && status < 500) return false;

    // Gateway hard-down only (not flaky 503 reconnects).
    return status === 502 || status === 504;
}

export function redirectToNotFound() {
    if (typeof window === 'undefined') return;
    if (isOnNotFoundPage()) return;
    if (isPublicPath(window.location.pathname)) return;
    window.location.replace(NOT_FOUND_PATH);
}
