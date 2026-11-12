'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ItemMasterShell from '../ItemMasterShell';
import ItemForm from '../ItemForm';
import { apiMessage, createItem } from '../itemMasterApi';
import { useToast } from '@/hooks/use-toast';

export default function AddInventoryItemPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const save = async (payload) => {
        setSaving(true);
        setError('');
        try {
            await createItem(payload);
            toast({ title: 'Item saved' });
            router.push('/inventory/item-master');
        } catch (err) {
            const message = apiMessage(err, 'Could not save the item.');
            setError(message);
            toast({ title: 'Could not save', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <ItemMasterShell>
            {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            <ItemForm onSubmit={save} saving={saving} />
        </ItemMasterShell>
    );
}
