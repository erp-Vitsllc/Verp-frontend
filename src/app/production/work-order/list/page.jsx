'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import WorkOrderList from '../WorkOrderList';

export default function WorkOrderListPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            router.replace('/login?redirectTo=/production/work-order/list');
            return;
        }
        setReady(true);
    }, [router]);

    if (!ready) return null;

    return (
        <PermissionGuard moduleId="production" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f3f7fb]">
                <Sidebar />
                <div className="flex min-w-0 w-full max-w-full flex-1 flex-col">
                    <Navbar />
                    <main className="w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-[#f3f7fb] p-3 sm:p-5 lg:p-6">
                        <WorkOrderList />
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
