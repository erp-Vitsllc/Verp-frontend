'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ItemMasterShell from '../../item-master/ItemMasterShell';
import { useInventoryAccess } from '../../item-master/itemMasterAccess';
import VendorDetail from '../VendorDetail';
import { getVendor, vendorApiMessage } from '../vendorManagementApi';

export default function VendorDetailPage() {
    const params = useParams();
    const vendorId = String(params?.id || '');
    const access = useInventoryAccess();
    const [vendor, setVendor] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        if (!vendorId) return undefined;
        setLoading(true);
        setError('');
        let cancelled = false;
        getVendor(vendorId)
            .then((row) => {
                if (!cancelled) setVendor(row);
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setVendor(null);
                    setError(vendorApiMessage(loadError, 'Could not open this vendor.'));
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [vendorId]);

    useEffect(() => {
        if (!access.ready || !access.canViewVendors) return undefined;
        return load();
    }, [access.ready, access.canViewVendors, load]);

    return (
        <ItemMasterShell>
            {access.ready && !access.canViewVendors ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">
                    You do not have permission to view Vendor Management.
                </p>
            ) : null}
            {access.canViewVendors && error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {access.canViewVendors && vendor ? <VendorDetail vendor={vendor} onReload={load} /> : null}
            {access.canViewVendors && loading && !vendor && !error ? <p className="text-sm text-slate-500">Loading vendor...</p> : null}
        </ItemMasterShell>
    );
}
