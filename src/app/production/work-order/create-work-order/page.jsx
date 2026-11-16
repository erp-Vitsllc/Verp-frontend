'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import CreateWorkOrderFlow from '../CreateWorkOrderFlow';

export default function CreateWorkOrderPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            router.replace('/login?redirectTo=/production/work-order/create-work-order');
            return;
        }
        setReady(true);
        axiosInstance.get('/WorkOrder', { skipToast: true }).then((response) => {
            setOrders(Array.isArray(response.data?.workOrders) ? response.data.workOrders : []);
        }).catch(() => setOrders([]));
    }, [router]);

    if (!ready) return null;

    const back = () => router.push('/production/work-order');

    return (
        <PermissionGuard moduleId="production" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f3f7fb]">
                <Sidebar />
                <div className="flex min-w-0 w-full max-w-full flex-1 flex-col">
                    <Navbar />
                    <main className="w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-[#f3f7fb] p-3 sm:p-5 lg:p-6">
                        <CreateWorkOrderFlow
                            existingNumbers={orders.map((order) => order.workOrderNo).filter(Boolean)}
                            projects={[...new Set(orders.map((order) => order.projectName).filter(Boolean))]}
                            onClose={back}
                            onSaved={back}
                        />
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
