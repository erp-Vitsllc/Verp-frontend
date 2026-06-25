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
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
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
 * Attach to navigable rows/links. Skips when the event target is a button, input, etc.
 */
export function handleLinkContextMenu(event, href, { enabled = true } = {}) {
    if (!enabled) return;
    const path = normalizeHref(href);
    if (!path) return;

    const blocked = event.target?.closest?.(
        'button, input, textarea, select, label, [data-row-nav-ignore], a:not([aria-hidden="true"])',
    );
    if (blocked) return;

    event.preventDefault();
    event.stopPropagation();
    showLinkContextMenu({ href: path, x: event.clientX, y: event.clientY });
}
