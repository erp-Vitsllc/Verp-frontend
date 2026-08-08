'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { navHrefProps } from '@/utils/linkContextMenu';
import {
    handleNavigateFromListClick,
    navigateFromList,
} from '@/utils/listReturnNavigation';

/**
 * Navigational control rendered as a real link so right-click / Ctrl+click /
 * middle-click use the browser native new-tab behavior.
 * Plain left-click keeps list back-stack navigation when listReturnHref is set.
 */
export default function NavButton({
    href,
    router: routerProp,
    listReturnHref,
    onNavigate,
    enabled = true,
    type = 'button',
    children,
    onClick,
    onAuxClick,
    className = '',
    ...rest
}) {
    const hookRouter = useRouter();
    const router = routerProp || hookRouter;
    const path = typeof href === 'string' ? href.trim() : '';

    if (!enabled || !path) {
        return (
            <button type={type} className={className} onClick={onClick} onAuxClick={onAuxClick} {...rest}>
                {children}
            </button>
        );
    }

    return (
        <Link
            href={path}
            className={className}
            {...navHrefProps(path)}
            {...rest}
            onClick={(event) => {
                onClick?.(event);
                if (event.defaultPrevented) return;
                // Ctrl/Cmd/Shift/middle → browser native new tab / window.
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                    return;
                }
                if (typeof onNavigate === 'function') {
                    event.preventDefault();
                    onNavigate(path, event);
                    return;
                }
                if (listReturnHref) {
                    event.preventDefault();
                    navigateFromList(router, path, listReturnHref);
                }
            }}
        >
            {children}
        </Link>
    );
}

/**
 * Click props for non-button navigable elements (cards, divs, table cells).
 * Prefer wrapping with a real <Link>/<a> when right-click new-tab is required.
 */
export function getNavClickHandlers({
    href,
    router,
    listReturnHref,
    onNavigate,
    enabled = true,
}) {
    const path = typeof href === 'string' ? href.trim() : '';
    if (!enabled || !path) return {};

    return {
        ...navHrefProps(path),
        role: 'link',
        tabIndex: 0,
        onClick: (event) => {
            if (event.defaultPrevented) return;
            if (event.target?.closest?.('button, input, textarea, select, a, [data-row-nav-ignore]')) {
                return;
            }
            // Modifier clicks: open a real temporary link so the browser owns new-tab behavior.
            if (event.metaKey || event.ctrlKey || event.shiftKey) {
                event.preventDefault();
                const anchor = document.createElement('a');
                anchor.href = path;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.style.display = 'none';
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                return;
            }
            if (typeof onNavigate === 'function') {
                onNavigate(path, event);
                return;
            }
            if (listReturnHref) {
                handleNavigateFromListClick(event, router, path, listReturnHref);
                return;
            }
            router?.push?.(path);
        },
        onAuxClick: (event) => {
            if (event.defaultPrevented) return;
            if (event.target?.closest?.('button, input, textarea, select, a, [data-row-nav-ignore]')) {
                return;
            }
            if (event.button === 1) {
                event.preventDefault();
                const anchor = document.createElement('a');
                anchor.href = path;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.style.display = 'none';
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
            }
        },
        onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            if (event.target?.closest?.('button, input, textarea, select, a, [data-row-nav-ignore]')) {
                return;
            }
            event.preventDefault();
            if (typeof onNavigate === 'function') {
                onNavigate(path, event);
                return;
            }
            if (listReturnHref) {
                navigateFromList(router, path, listReturnHref);
                return;
            }
            router?.push?.(path);
        },
    };
}
