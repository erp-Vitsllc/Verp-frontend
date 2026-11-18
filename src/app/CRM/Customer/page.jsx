'use client';

import { Suspense } from 'react';
import ItemMasterShell from '@/app/inventory/item-master/ItemMasterShell';
import CustomerManagementList from './CustomerManagementList';
import { useCrmAccess } from './crmAccess';

export default function CrmCustomerPage() {
    const access = useCrmAccess();

    return (
        <ItemMasterShell>
            {access.ready && !access.canView ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">
                    You do not have permission to view Customer.
                </p>
            ) : (
                <Suspense fallback={<p className="text-sm text-slate-500">Loading customers...</p>}>
                    <CustomerManagementList />
                </Suspense>
            )}
        </ItemMasterShell>
    );
}
