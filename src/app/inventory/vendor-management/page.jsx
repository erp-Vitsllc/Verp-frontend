'use client';

import { Suspense } from 'react';
import ItemMasterShell from '../item-master/ItemMasterShell';
import { useInventoryAccess } from '../item-master/itemMasterAccess';
import VendorManagementList from './VendorManagementList';

export default function VendorManagementPage() {
    const access = useInventoryAccess();

    return (
        <ItemMasterShell>
            {access.ready && !access.canViewVendors ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">
                    You do not have permission to view Vendor Management.
                </p>
            ) : (
                <Suspense fallback={<p className="text-sm text-slate-500">Loading vendors...</p>}>
                    <VendorManagementList />
                </Suspense>
            )}
        </ItemMasterShell>
    );
}
