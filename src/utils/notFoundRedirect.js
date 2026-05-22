export const NOT_FOUND_PATH = '/404';

const PUBLIC_PATH_PREFIXES = ['/login', '/print'];

export function isPublicPath(pathname) {
    const path = String(pathname || '');
    return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isOnNotFoundPage() {
    if (typeof window === 'undefined') return false;
    return window.location.pathname === NOT_FOUND_PATH;
}

/**
 * Only true server / connectivity failures should send users to the 404 page.
 * Validation and business errors (400, 409, etc.) must stay on the current form.
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

    // Only redirect on GET when the server is clearly down (gateway errors).
    return status === 502 || status === 503 || status === 504;
}

export function redirectToNotFound() {
    if (typeof window === 'undefined') return;
    if (isOnNotFoundPage()) return;
    if (isPublicPath(window.location.pathname)) return;
    window.location.replace(NOT_FOUND_PATH);
}
