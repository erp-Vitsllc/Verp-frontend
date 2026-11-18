'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import ItemMasterShell from '@/app/inventory/item-master/ItemMasterShell';
import CustomerDetail from '../CustomerDetail';
import { useCrmAccess } from '../crmAccess';
import { customerApiMessage, getCustomer } from '../customerApi';

export default function CustomerDetailPage() {
    const params = useParams();
    const customerId = String(params?.id || '');
    const access = useCrmAccess();
    const [customer, setCustomer] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const requestSeq = useRef(0);

    const load = useCallback(() => {
        if (!customerId) return undefined;
        const seq = ++requestSeq.current;
        setLoading(true);
        setError('');
        let cancelled = false;
        getCustomer(customerId)
            .then((row) => {
                if (cancelled || seq !== requestSeq.current) return;
                setCustomer(row);
            })
            .catch((loadError) => {
                if (cancelled || seq !== requestSeq.current) return;
                setCustomer(null);
                setError(customerApiMessage(loadError, 'Could not open this customer.'));
            })
            .finally(() => {
                if (!cancelled && seq === requestSeq.current) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [customerId]);

    useEffect(() => {
        if (!access.ready || !access.canView) return undefined;
        return load();
    }, [access.ready, access.canView, load]);

    return (
        <ItemMasterShell>
            {access.ready && !access.canView ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">
                    You do not have permission to view Customer.
                </p>
            ) : null}
            {access.canView && error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {access.canView && customer ? <CustomerDetail customer={customer} onReload={load} /> : null}
            {access.canView && loading && !customer && !error ? <p className="text-sm text-slate-500">Loading customer...</p> : null}
        </ItemMasterShell>
    );
}
