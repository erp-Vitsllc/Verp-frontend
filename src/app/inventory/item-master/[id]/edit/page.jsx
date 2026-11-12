'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ItemMasterShell from '../../ItemMasterShell';
import ItemForm from '../../ItemForm';
import { useInventoryAccess } from '../../itemMasterAccess';
import { apiMessage, getItem, updateItem } from '../../itemMasterApi';
import { useToast } from '@/hooks/use-toast';

export default function EditInventoryItemPage() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const itemId = String(params?.id || '');
    const [initial, setInitial] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const access = useInventoryAccess();

    useEffect(() => {
        if (!itemId || !access.ready || !access.canEditItem) return undefined;
        let cancelled = false;
        getItem(itemId)
            .then((row) => {
                if (!cancelled) setInitial(row);
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not open this item.'));
            });
        return () => {
            cancelled = true;
        };
    }, [itemId, access.ready, access.canEditItem]);

    const save = async (payload) => {
        setSaving(true);
        setError('');
        try {
            await updateItem(itemId, payload);
            toast({ title: 'Item updated' });
            router.push(`/inventory/item-master/${itemId}`);
        } catch (err) {
            const message = apiMessage(err, 'Could not update the item.');
            setError(message);
            toast({ title: 'Could not update', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <ItemMasterShell>
            {access.ready && !access.canEditItem ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">You do not have permission to edit this item.</p>
            ) : null}
            {access.canEditItem && error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {access.canEditItem && initial ? <ItemForm initial={initial} onSubmit={save} saving={saving} /> : access.canEditItem && !error ? (
                <p className="text-sm text-slate-500">Loading item...</p>
            ) : null}
        </ItemMasterShell>
    );
}
