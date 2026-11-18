'use client';

import ItemMasterShell from '../item-master/ItemMasterShell';
import { useInventoryAccess } from '../item-master/itemMasterAccess';
import DeliveryBoard from './DeliveryBoard';

export default function InventoryDeliveryPage() {
    const access = useInventoryAccess();

    return (
        <ItemMasterShell>
            {access.ready && !access.canOpenInventory ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">
                    You do not have permission to view Delivery.
                </p>
            ) : (
                <DeliveryBoard />
            )}
        </ItemMasterShell>
    );
}
