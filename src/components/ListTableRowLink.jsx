'use client';

import { Children, cloneElement, isValidElement } from 'react';
import {
    handleNavigateFromListClick,
    navigateFromList,
} from '@/utils/listReturnNavigation';

const INTERACTIVE_SELECTOR =
    'button, input, textarea, select, label, [data-row-nav-ignore], a[href]:not([data-row-nav-link])';

function isInteractiveTarget(target) {
    return Boolean(target?.closest?.(INTERACTIVE_SELECTOR));
}

/**
 * Every cell gets a real <a> so right-click uses the browser native menu
 * (Open link in new tab / window) across the whole row.
 */
function enhanceCellsWithNativeLink(tdChildren, href, onLinkClick) {
    return Children.map(tdChildren, (child) => {
        if (!isValidElement(child) || (child.type !== 'td' && child.type !== 'th')) {
            return child;
        }
        return cloneElement(child, {
            className: [child.props.className, 'relative'].filter(Boolean).join(' '),
            children: (
                <>
                    <a
                        href={href}
                        data-row-nav-link="1"
                        className="absolute inset-0 z-[1]"
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={onLinkClick}
                    />
                    <div className="relative z-[2] pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_textarea]:pointer-events-auto [&_label]:pointer-events-auto [&_[data-row-nav-ignore]]:pointer-events-auto">
                        {child.props.children}
                    </div>
                </>
            ),
        });
    });
}

/**
 * Makes a <tr> navigable without wrapping it in <a> (invalid table HTML).
 * Left-click uses the list back-stack; Ctrl/Cmd+click, middle-click, and
 * right-click use the real cell links (browser native new-tab behavior).
 */
export default function ListTableRowLink({
    href,
    router,
    listReturnHref,
    enabled = true,
    children,
}) {
    if (!enabled || !href || !isValidElement(children)) {
        return children;
    }

    const handleLinkClick = (event) => {
        if (event.defaultPrevented) return;
        // Modifier / non-primary clicks → browser handles new tab / window.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }
        // Must navigate here — do not call handleNavigateFromListClick after preventDefault,
        // that helper bails when defaultPrevented and left the row click a no-op.
        event.preventDefault();
        navigateFromList(router, href, listReturnHref);
    };

    const handleRowClick = (event) => {
        children.props.onClick?.(event);
        if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
        // Clicks on the overlay <a> are handled by handleLinkClick.
        if (event.target?.closest?.('a[data-row-nav-link]')) return;
        // Right/middle-click must not navigate — only the browser menu or auxclick on the real <a>.
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        handleNavigateFromListClick(event, router, href, listReturnHref);
    };

    const handleKeyDown = (event) => {
        children.props.onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigateFromList(router, href, listReturnHref);
        }
    };

    const rowChildren = enhanceCellsWithNativeLink(
        children.props.children,
        href,
        handleLinkClick,
    );

    return cloneElement(children, {
        ...children.props,
        className: [children.props.className, 'relative'].filter(Boolean).join(' '),
        onClick: handleRowClick,
        onKeyDown: handleKeyDown,
        tabIndex: children.props.tabIndex ?? 0,
        role: children.props.role || 'link',
        children: rowChildren,
    });
}
