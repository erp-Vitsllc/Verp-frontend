'use client';

import { Children, cloneElement, isValidElement } from 'react';
import {
    handleNavigateFromListClick,
    navigateFromList,
} from '@/utils/listReturnNavigation';
import { handleLinkContextMenu } from '@/utils/linkContextMenu';

const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, label, [data-row-nav-ignore]';

function isInteractiveTarget(target) {
    return Boolean(target?.closest?.(INTERACTIVE_SELECTOR));
}

function enhanceFirstCellLink(tdChildren, href, onLinkClick) {
    let firstTdSeen = false;
    return Children.map(tdChildren, (child) => {
        if (!isValidElement(child) || (child.type !== 'td' && child.type !== 'th')) {
            return child;
        }
        if (!firstTdSeen) {
            firstTdSeen = true;
            return cloneElement(child, {
                className: [child.props.className, 'relative'].filter(Boolean).join(' '),
                children: (
                    <>
                        <a
                            href={href}
                            className="absolute inset-0 z-[1]"
                            tabIndex={-1}
                            aria-hidden="true"
                            onClick={onLinkClick}
                        />
                        <div className="relative z-[2]">{child.props.children}</div>
                    </>
                ),
            });
        }
        return cloneElement(child, {
            className: [child.props.className, 'relative z-[2]'].filter(Boolean).join(' '),
        });
    });
}

/**
 * Makes a <tr> navigable without wrapping it in <a> (invalid table HTML).
 * Left-click uses the list back-stack; Ctrl/Cmd+click and middle-click open a new tab.
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

    const handleRowClick = (event) => {
        children.props.onClick?.(event);
        if (event.defaultPrevented || isInteractiveTarget(event.target)) return;

        if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
        }

        handleNavigateFromListClick(event, router, href, listReturnHref);
    };

    const handleLinkClick = (event) => {
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }
        event.preventDefault();
        handleNavigateFromListClick(event, router, href, listReturnHref);
    };

    const handleAuxClick = (event) => {
        children.props.onAuxClick?.(event);
        if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
        if (event.button === 1) {
            event.preventDefault();
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    };

    const handleKeyDown = (event) => {
        children.props.onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigateFromList(router, href, listReturnHref);
        }
    };

    const handleRowContextMenu = (event) => {
        children.props.onContextMenu?.(event);
        if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
        handleLinkContextMenu(event, href, { enabled });
    };

    const rowChildren = enhanceFirstCellLink(
        children.props.children,
        href,
        handleLinkClick,
    );

    return cloneElement(children, {
        ...children.props,
        className: [children.props.className, 'relative'].filter(Boolean).join(' '),
        'data-nav-href': href,
        onClick: handleRowClick,
        onAuxClick: handleAuxClick,
        onContextMenu: handleRowContextMenu,
        onKeyDown: handleKeyDown,
        tabIndex: children.props.tabIndex ?? 0,
        role: children.props.role || 'link',
        children: rowChildren,
    });
}
