'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ItemMasterShell from '../ItemMasterShell';
import ItemForm from '../ItemForm';
import { useInventoryAccess } from '../itemMasterAccess';
import { apiMessage, createItem } from '../itemMasterApi';
import { clearItemDuplicateDraft, readItemDuplicateDraft } from '../itemDuplicateDraft';
import { useToast } from '@/hooks/use-toast';

export default function DuplicateInventoryItemPage() {
    const router = useRouter();
    const { toast } = useToast();
    const access = useInventoryAccess();
    const [draft, setDraft] = useState(null);
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setDraft(readItemDuplicateDraft());
        setReady(true);
    }, []);

    const leave = () => {
        const sourceId = /^[a-f\d]{24}$/i.test(String(draft?.sourceId || '')) ? draft.sourceId : '';
        clearItemDuplicateDraft();
        router.push(sourceId ? `/inventory/item-master/${sourceId}` : '/inventory/item-master');
    };

    const save = async (payload) => {
        setSaving(true);
        setError('');
        try {
            const saved = await createItem(payload);
            clearItemDuplicateDraft();
            toast({ title: 'New item saved', description: saved.itemCode });
            router.push(`/inventory/item-master/${saved._id}`);
        } catch (err) {
            const message = apiMessage(err, 'Could not save the new item.');
            setError(message);
            toast({ title: 'Could not save', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <ItemMasterShell>
            {access.ready && !access.canCreateItem ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">You do not have permission to duplicate an item.</p>
            ) : null}
            {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {access.canCreateItem && ready && !draft ? (
                <div className="rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">No copied item is waiting. Open an item and choose Duplicate.</p>
                    <button
                        type="button"
                        onClick={() => router.push('/inventory/item-master')}
                        className="mt-3 h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                    >
                        Back to Item Master
                    </button>
                </div>
            ) : null}
            {access.canCreateItem && draft ? (
                <ItemForm
                    initial={draft}
                    onSubmit={save}
                    onCancel={leave}
                    saving={saving}
                    requireChange
                />
            ) : null}
        </ItemMasterShell>
    );
}
