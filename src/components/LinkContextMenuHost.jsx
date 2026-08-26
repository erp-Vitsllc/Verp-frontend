'use client';

import { useEffect, useState } from 'react';
import {
    hideLinkContextMenu,
    openLinkInNewTab,
    openLinkInNewWindow,
    subscribeLinkContextMenu,
} from '@/utils/linkContextMenu';

/**
 * Chooser menu for data-nav-href controls that are not real links.
 * Opens a destination only after the user picks an option — never on contextmenu alone.
 */
export default function LinkContextMenuHost() {
    const [menu, setMenu] = useState(null);

    useEffect(() => subscribeLinkContextMenu(setMenu), []);

    useEffect(() => {
        if (!menu) return;

        const close = () => {
            setMenu(null);
            hideLinkContextMenu();
        };

        const onPointerDown = (event) => {
            if (event.target?.closest?.('[data-link-context-menu]')) return;
            close();
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [menu]);

    if (!menu?.href) return null;

    const run = (action) => {
        const href = menu.href;
        setMenu(null);
        hideLinkContextMenu();
        action(href);
    };

    return (
        <div
            data-link-context-menu="1"
            className="fixed z-[9999] min-w-[190px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
            onContextMenu={(event) => event.preventDefault()}
        >
            <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => run(openLinkInNewTab)}
            >
                Open in new tab
            </button>
            <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => run(openLinkInNewWindow)}
            >
                Open in new window
            </button>
        </div>
    );
}
