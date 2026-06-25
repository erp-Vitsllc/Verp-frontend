'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Square } from 'lucide-react';
import {
    hideLinkContextMenu,
    openLinkInNewTab,
    openLinkInNewWindow,
    subscribeLinkContextMenu,
} from '@/utils/linkContextMenu';

function clampMenuPosition(x, y, menuWidth = 220, menuHeight = 88) {
    if (typeof window === 'undefined') return { x, y };
    const padding = 8;
    const maxX = window.innerWidth - menuWidth - padding;
    const maxY = window.innerHeight - menuHeight - padding;
    return {
        x: Math.max(padding, Math.min(x, maxX)),
        y: Math.max(padding, Math.min(y, maxY)),
    };
}

export default function LinkContextMenuHost() {
    const [menu, setMenu] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => subscribeLinkContextMenu(setMenu), []);

    useEffect(() => {
        if (!menu) return undefined;

        const close = () => hideLinkContextMenu();

        const onPointerDown = (event) => {
            if (event.target?.closest?.('[data-link-context-menu]')) return;
            close();
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('scroll', close, true);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', close);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', close);
        };
    }, [menu]);

    if (!mounted || !menu) return null;

    const position = clampMenuPosition(menu.x, menu.y);

    return createPortal(
        <div
            data-link-context-menu
            role="menu"
            className="fixed z-[9999] min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 text-sm animate-in fade-in zoom-in-95 duration-100"
            style={{ left: position.x, top: position.y }}
            onContextMenu={(event) => event.preventDefault()}
        >
            <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => {
                    openLinkInNewTab(menu.href);
                    hideLinkContextMenu();
                }}
            >
                <ExternalLink size={16} className="text-gray-500 shrink-0" />
                Open in new tab
            </button>
            <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => {
                    openLinkInNewWindow(menu.href);
                    hideLinkContextMenu();
                }}
            >
                <Square size={16} className="text-gray-500 shrink-0" />
                Open in new window
            </button>
        </div>,
        document.body,
    );
}
