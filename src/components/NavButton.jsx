'use client';

import { useRouter } from 'next/navigation';
import {
    navHrefProps,
    openLinkInNewTab,
} from '@/utils/linkContextMenu';
import {
    handleNavigateFromListClick,
    navigateFromList,
} from '@/utils/listReturnNavigation';

/**
 * Button that navigates in-app and supports right-click Open in new tab/window.
 * Left-click uses router (optionally with list back-stack); Ctrl/Cmd and middle-click open a new tab.
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
    ...rest
}) {
    const hookRouter = useRouter();
    const router = routerProp || hookRouter;
    const path = typeof href === 'string' ? href.trim() : '';
    const navProps = enabled && path ? navHrefProps(path) : {};

    if (!enabled || !path) {
        return (
            <button type={type} onClick={onClick} onAuxClick={onAuxClick} {...rest}>
                {children}
            </button>
        );
    }

    const go = (event) => {
        if (typeof onNavigate === 'function') {
            onNavigate(path, event);
            return;
        }
        if (listReturnHref) {
            navigateFromList(router, path, listReturnHref);
            return;
        }
        router.push(path);
    };

    return (
        <button
            type={type}
            {...rest}
            {...navProps}
            onClick={(event) => {
                onClick?.(event);
                if (event.defaultPrevented) return;

                if (event.metaKey || event.ctrlKey) {
                    event.preventDefault();
                    openLinkInNewTab(path);
                    return;
                }

                go(event);
            }}
            onAuxClick={(event) => {
                onAuxClick?.(event);
                if (event.defaultPrevented) return;
                if (event.button === 1) {
                    event.preventDefault();
                    openLinkInNewTab(path);
                }
            }}
        >
            {children}
        </button>
    );
}

/**
 * Click props for non-button navigable elements (cards, divs, table cells).
 * Sets data-nav-href so the global context menu can open the same destination.
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
            if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                openLinkInNewTab(path);
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
                openLinkInNewTab(path);
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
