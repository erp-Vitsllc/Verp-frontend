'use client';

import { Suspense } from 'react';
import ItemMasterShell from './ItemMasterShell';
import ItemMasterList from './ItemMasterList';

export default function ItemMasterPage() {
    return (
        <ItemMasterShell>
            <Suspense fallback={<p className="text-sm text-slate-500">Loading items...</p>}>
                <ItemMasterList />
            </Suspense>
        </ItemMasterShell>
    );
}
