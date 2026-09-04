const listeners = new Set();

/** Blocks in-app router navigation briefly after "open in new tab/window". */
let suppressInAppNavUntil = 0;

export function suppressInAppNavigationBriefly(ms = 600) {
    suppressInAppNavUntil = Date.now() + Math.max(0, Number(ms) || 0);
}

export function shouldSuppressInAppNavigation() {
    return Date.now() < suppressInAppNavUntil;
}

export function subscribeLinkContextMenu(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function showLinkContextMenu({ href, x, y }) {
    const normalized = normalizeHref(href);
    if (!normalized) return;
    const payload = { href: normalized, x, y };
    listeners.forEach((listener) => listener(payload));
}

export function hideLinkContextMenu() {
    listeners.forEach((listener) => listener(null));
}

function normalizeHref(href) {
    if (!href || typeof href !== 'string') return '';
    const trimmed = href.trim();
    if (!trimmed) return '';

    if (typeof window !== 'undefined') {
        try {
            const url = new URL(trimmed, window.location.origin);
            if (url.origin === window.location.origin) {
                return `${url.pathname}${url.search}${url.hash}` || '/';
            }
        } catch {
            // fall through
        }
    }

    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
        return trimmed;
    }

    return '';
}

function isInternalAppHref(href) {
    return Boolean(normalizeHref(href));
}

/**
 * Props helper for any clickable that navigates in-app.
 * Marks the element so the global right-click menu can open the same destination.
 */
export function navHrefProps(href) {
    const path = normalizeHref(href);
    if (!path) return {};
    return { 'data-nav-href': path };
}

function focusOpenedWindow(win) {
    if (!win) return;
    const focusThere = () => {
        try {
            if (!win.closed) win.focus();
        } catch {
            // ignore focus errors from browser policy
        }
    };
    focusThere();
    requestAnimationFrame(focusThere);
    setTimeout(focusThere, 0);
    setTimeout(focusThere, 50);
}

function detachOpener(win) {
    if (!win) return;
    try {
        win.opener = null;
    } catch {
        // ignore
    }
}

function openWithAnchor(absoluteUrl) {
    const anchor = document.createElement('a');
    anchor.href = absoluteUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

/**
 * Open the destination in a new tab and switch to it.
 * The current page must not router-navigate when this runs.
 */
export function openLinkInNewTab(href) {
    const path = normalizeHref(href);
    if (!path || typeof window === 'undefined') return;

    suppressInAppNavigationBriefly(800);

    const absoluteUrl = new URL(path, window.location.origin).href;
    const win = window.open(absoluteUrl, '_blank');
    if (!win) {
        openWithAnchor(absoluteUrl);
        return;
    }

    focusOpenedWindow(win);
    // Detach after focus so Chromium still switches to the new tab.
    setTimeout(() => detachOpener(win), 0);
}

/**
 * Open the destination in a new window and switch to it.
 */
export function openLinkInNewWindow(href) {
    const path = normalizeHref(href);
    if (!path || typeof window === 'undefined') return;

    suppressInAppNavigationBriefly(800);

    const absoluteUrl = new URL(path, window.location.origin).href;
    const width = Math.min(1280, Math.max(960, window.screen.availWidth - 120));
    const height = Math.min(860, Math.max(640, window.screen.availHeight - 120));
    const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));

    // Chromium opens a *tab* if toolbar/menubar/noopener are in the features string.
    // Request an explicit popup with size/position only, then clear opener manually.
    const features = [
        'popup=yes',
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'resizable=yes',
        'scrollbars=yes',
    ].join(',');

    const win = window.open(absoluteUrl, '_blank', features);
    if (!win) {
        openWithAnchor(absoluteUrl);
        return;
    }
    focusOpenedWindow(win);
    setTimeout(() => detachOpener(win), 0);
}

/**
 * Walk up from the event target and resolve an in-app navigation href.
 * Buttons with data-nav-href are included; plain action buttons stop the walk
 * so parent row/card destinations are not incorrectly used.
 */
export function resolveNavigableHref(target) {
    if (!target) return '';

    let node = target instanceof Element ? target : target.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
        if (
            node.matches?.(
                '[data-no-nav-context-menu], input, textarea, select, [contenteditable="true"]',
            )
        ) {
            return '';
        }

        const marked = node.getAttribute?.('data-nav-href');
        if (marked) {
            const path = normalizeHref(marked);
            if (path) return path;
        }

        if (node.matches?.('a[href]')) {
            const href = node.getAttribute('href') || '';
            if (isInternalAppHref(href)) return normalizeHref(href);
            return '';
        }

        // Non-nav controls (Save/Delete/etc.) must not inherit a parent destination.
        if (node.matches?.('button, [data-row-nav-ignore]')) {
            return '';
        }

        node = node.parentElement;
    }

    return '';
}

/**
 * Show a chooser menu for non-link navigable controls (`data-nav-href` on buttons/rows).
 * Real <a>/<Link> keep the browser native menu — never auto-open on contextmenu.
 */
export function handleLinkContextMenu(event, href, _opts) {
    if (!event || !href) return;

    const path = normalizeHref(href);
    if (!path) return;

    const anchor =
        event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (anchor) {
        const anchorHref = anchor.getAttribute('href') || '';
        if (isInternalAppHref(anchorHref)) return;
    }

    event.preventDefault();
    showLinkContextMenu({ href: path, x: event.clientX, y: event.clientY });
}

export function handleGlobalNavContextMenu(event) {
    if (!event || typeof window === 'undefined') return;

    const href = resolveNavigableHref(event.target);
    if (!href) return;

    const anchor =
        event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (anchor) {
        const anchorHref = anchor.getAttribute('href') || '';
        if (isInternalAppHref(anchorHref)) return;
    }

    event.preventDefault();
    showLinkContextMenu({ href, x: event.clientX, y: event.clientY });
}
