'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ItemMasterShell from '../ItemMasterShell';
import ItemDetail from '../ItemDetail';
import { apiMessage, getItem } from '../itemMasterApi';

export default function InventoryItemDetailPage() {
    const params = useParams();
    const itemId = String(params?.id || '');
    const [item, setItem] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!itemId) return undefined;
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
    }, [itemId]);

    return (
        <ItemMasterShell>
            {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {item ? <ItemDetail item={item} /> : !error ? <p className="text-sm text-slate-500">Loading item...</p> : null}
        </ItemMasterShell>
    );
}
