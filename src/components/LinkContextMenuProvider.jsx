'use client';

import { useEffect } from 'react';
import { handleGlobalNavContextMenu } from '@/utils/linkContextMenu';
import LinkContextMenuHost from '@/components/LinkContextMenuHost';

/** Global right-click handler for data-nav-href rows/buttons (not real links). */
export default function LinkContextMenuProvider({ children }) {
    useEffect(() => {
        const onContextMenu = (event) => handleGlobalNavContextMenu(event);
        document.addEventListener('contextmenu', onContextMenu);
        return () => document.removeEventListener('contextmenu', onContextMenu);
    }, []);

    return (
        <>
            {children}
            <LinkContextMenuHost />
        </>
    );
}
