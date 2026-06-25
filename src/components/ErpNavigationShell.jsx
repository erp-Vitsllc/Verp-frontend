'use client';

import { Suspense } from 'react';
import ErpNavigationTracker from '@/components/ErpNavigationTracker';
import LinkContextMenuHost from '@/components/LinkContextMenuHost';

/** Client shell: route stack tracker for ERP back / filter restoration. */
export default function ErpNavigationShell() {
    return (
        <Suspense fallback={null}>
            <ErpNavigationTracker />
            <LinkContextMenuHost />
        </Suspense>
    );
}
