'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import InventoryDashboard from '@/app/inventory/InventoryDashboard';

export default function InventoryPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);

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
                <InventoryDashboard />
            </div>
        </div>
    );
}
