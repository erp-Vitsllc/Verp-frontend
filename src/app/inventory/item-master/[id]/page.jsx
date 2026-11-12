'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ItemMasterShell from '../ItemMasterShell';
import ItemDetail from '../ItemDetail';
import { useInventoryAccess } from '../itemMasterAccess';
import { apiMessage, getItem } from '../itemMasterApi';

export default function InventoryItemDetailPage() {
    const params = useParams();
    const itemId = String(params?.id || '');
    const [item, setItem] = useState(null);
    const [error, setError] = useState('');
    const access = useInventoryAccess();

    useEffect(() => {
        if (!itemId || !access.ready || !access.canViewItems) return undefined;
        let cancelled = false;
        getItem(itemId)
            .then((row) => {
                if (!cancelled) setItem(row);
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not open this item.'));
            });
        return () => {
            cancelled = true;
        };
    }, [itemId, access.ready, access.canViewItems]);

    return (
        <ItemMasterShell>
            {access.ready && !access.canViewItems ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">You do not have permission to view this item.</p>
            ) : null}
            {access.canViewItems && error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {access.canViewItems && item ? <ItemDetail item={item} /> : access.canViewItems && !error ? <p className="text-sm text-slate-500">Loading item...</p> : null}
        </ItemMasterShell>
    );
}
