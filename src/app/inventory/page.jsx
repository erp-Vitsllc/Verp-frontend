'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import InventoryDashboard from '@/app/inventory/InventoryDashboard';
import { useInventoryAccess } from '@/app/inventory/item-master/itemMasterAccess';

export default function InventoryPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const access = useInventoryAccess();

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            router.replace('/login');
            return;
        }
        setReady(true);
    }, [router]);

    if (!ready) return null;

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F4F7FB]">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Navbar />
                {access.ready && !access.canOpenInventory ? (
                    <main className="flex-1 p-4 sm:p-6">
                        <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">You do not have permission to view Inventory.</p>
                    </main>
                ) : null}
                {access.canOpenInventory ? <InventoryDashboard /> : null}
            </div>
        </div>
    );
}
