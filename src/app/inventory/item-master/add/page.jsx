'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import ItemMasterShell from '../ItemMasterShell';
import ItemForm from '../ItemForm';
import { useInventoryAccess } from '../itemMasterAccess';
import { apiMessage, createItem, decideBoqNewItem, listBoqNewItems } from '../itemMasterApi';
import { useToast } from '@/hooks/use-toast';

function detail(label, value) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm text-slate-800">{value || '—'}</dd>
        </div>
    );
}

function BoqItemReview({ workOrderId, itemKey }) {
    const router = useRouter();
    const { toast } = useToast();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        listBoqNewItems()
            .then((result) => {
                if (cancelled) return;
                const found = (Array.isArray(result?.items) ? result.items : []).find((row) => (
                    row.workOrderId === workOrderId && row.itemKey === itemKey
                ));
                setItem(found || null);
                setMissing(!found);
            })
            .catch(() => {
                if (!cancelled) setMissing(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [itemKey, workOrderId]);

    const decide = async (decision) => {
        if (saving) return;
        setSaving(true);
        try {
            await decideBoqNewItem({ workOrderId, itemKey, decision });
            toast({ title: decision === 'approve' ? 'Item approved' : 'Item rejected' });
            router.push('/inventory/item-master');
        } catch (err) {
            toast({
                title: decision === 'approve' ? 'Could not approve' : 'Could not reject',
                description: apiMessage(err, 'Try again.'),
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-sm text-slate-500">Loading item…</p>;
    if (missing || !item) {
        return <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">This new item is no longer waiting for approval.</p>;
    }

    return (
        <section className="rounded-2xl border border-yellow-300 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">New item</h1>
                    <p className="mt-1 text-sm text-amber-800">
                        {item.status === 'rejected' ? 'Rejected' : 'Pending for purchaser'}
                        {item.workOrderNo ? ` · ${item.workOrderNo}` : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.push('/inventory/item-master')}
                    className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                >
                    Back
                </button>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {detail('Category', item.category)}
                {detail('Subcategory', item.subcategory)}
                {detail('Item', item.item)}
                {detail('Brand', item.brand)}
                {detail('Model no', item.modelNo)}
                {detail('Description', item.description)}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={saving}
                    onClick={() => decide('approve')}
                    className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                    {saving ? 'Saving…' : 'Approve'}
                </button>
                <button
                    type="button"
                    disabled={saving}
                    onClick={() => decide('reject')}
                    className="h-10 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 disabled:opacity-60"
                >
                    Reject
                </button>
            </div>
        </section>
    );
}

function AddInventoryItemForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const access = useInventoryAccess();
    const workOrderId = searchParams.get('boqWorkOrder') || '';
    const itemKey = searchParams.get('boqItem') || '';

    const save = async (payload) => {
        setSaving(true);
        setError('');
        try {
            await createItem(payload);
            toast({ title: 'Item saved' });
            if (!tryNavigateListReturn(router)) router.push('/inventory/item-master');
        } catch (err) {
            const message = apiMessage(err, 'Could not save the item.');
            setError(message);
            toast({ title: 'Could not save', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    if (workOrderId && itemKey) return <BoqItemReview workOrderId={workOrderId} itemKey={itemKey} />;

    return (
        <>
            {access.ready && !access.canCreateItem ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">You do not have permission to add an item.</p>
            ) : null}
            {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {access.canCreateItem ? <ItemForm onSubmit={save} saving={saving} /> : null}
        </>
    );
}

export default function AddInventoryItemPage() {
    return (
        <ItemMasterShell>
            <Suspense fallback={<p className="text-sm text-slate-500">Loading item…</p>}>
                <AddInventoryItemForm />
            </Suspense>
        </ItemMasterShell>
    );
}
