'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import ItemMasterShell from '../ItemMasterShell';
import ItemForm from '../ItemForm';
import { useInventoryAccess } from '../itemMasterAccess';
import { apiMessage, createItem, decideBoqNewItem, listBoqNewItems } from '../itemMasterApi';
import { useToast } from '@/hooks/use-toast';

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

    const initial = useMemo(() => {
        if (!item) return null;
        const unit = item.unitOfMeasure;
        return {
            categoryId: item.categoryId || '',
            categoryName: item.category || '',
            subcategoryId: item.subcategoryId || '',
            subcategoryName: item.subcategory || '',
            itemOptionId: item.itemOptionId || '',
            itemName: item.item || '',
            brandId: item.brandId || '',
            brandName: item.brand || '',
            modelNumber: item.modelNo || '',
            unitOfMeasure: unit === 'Box' || unit === 'Metre' || unit === 'Quantity' ? unit : 'None',
            manufacturerPartNumber: item.manufacturerPartNumber || '',
            reservationQuantity: Number(item.reservationQuantity) || 0,
            hsCode: item.hsCode || '',
            countryOfOrigin: item.countryOfOrigin || '',
        };
    }, [item]);

    const run = async (decision, extra, titles) => {
        if (saving) return;
        setSaving(true);
        try {
            const result = await decideBoqNewItem({ workOrderId, itemKey, decision, ...extra });
            toast({ title: titles.ok, description: titles.detail });
            if (decision === 'save' && result?.item) {
                setItem(result.item);
                return;
            }
            router.push('/inventory/item-master');
        } catch (err) {
            toast({
                title: titles.fail,
                description: apiMessage(err, 'Try again.'),
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-sm text-slate-500">Loading item…</p>;
    if (missing || !item || !initial) {
        return <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">This new item is no longer waiting for approval.</p>;
    }

    const note = `${item.status === 'rejected' ? 'Rejected' : 'Pending for purchaser'}${item.workOrderNo ? ` · ${item.workOrderNo}` : ''}. Save updates the BOQ. Approve stores the item. Reject removes this row.`;

    return (
        <ItemForm
            initial={initial}
            saving={saving}
            pendingNote={note}
            onSubmit={(payload) => run('save', { item: payload }, {
                ok: 'BOQ updated',
                detail: 'The work order row now uses these details. The item is stored when you approve.',
                fail: 'Could not save',
            })}
            onApprove={(payload) => run('approve', { item: payload }, {
                ok: 'Item approved',
                detail: 'It is stored on Item Master and the BOQ was updated.',
                fail: 'Could not approve',
            })}
            onReject={(reason) => run('reject', { reason }, {
                ok: 'Item rejected',
                detail: 'That BOQ row was removed.',
                fail: 'Could not reject',
            })}
        />
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
