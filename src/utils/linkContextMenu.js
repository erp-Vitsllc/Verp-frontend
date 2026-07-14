const listeners = new Set();

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

export function openLinkInNewTab(href) {
    const path = normalizeHref(href);
    if (!path || typeof window === 'undefined') return;
    window.open(path, '_blank', 'noopener,noreferrer');
}

export function openLinkInNewWindow(href) {
    const path = normalizeHref(href);
    if (!path || typeof window === 'undefined') return;
    window.open(
        path,
        '_blank',
        'noopener,noreferrer,width=1280,height=800,menubar=yes,toolbar=yes,location=yes,status=yes,scrollbars=yes,resizable=yes',
    );
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
 * Attach to a navigable element when you already know the href.
 * Prefer data-nav-href + the global listener for app-wide coverage.
 */
export function handleLinkContextMenu(event, href, { enabled = true } = {}) {
    if (!enabled || event?.defaultPrevented) return;
    const path = normalizeHref(href);
    if (!path) return;

    const blocked = event.target?.closest?.(
        'input, textarea, select, [contenteditable="true"], [data-no-nav-context-menu], [data-row-nav-ignore]',
    );
    if (blocked) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
    }
    showLinkContextMenu({ href: path, x: event.clientX, y: event.clientY });
}

/**
 * Main app-wide right-click handler. Mount once (capture phase).
 * Shows Open in new tab / window for links and navigational buttons.
 */
export function handleGlobalNavContextMenu(event) {
    if (event.defaultPrevented) return;
    if (event.target?.closest?.('[data-link-context-menu]')) {
        event.preventDefault();
        return;
    }

    const href = resolveNavigableHref(event.target);
    if (!href) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
    }
    showLinkContextMenu({ href, x: event.clientX, y: event.clientY });
}
