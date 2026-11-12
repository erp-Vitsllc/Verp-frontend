'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

const TITLES = {
    'item-master': 'Item Master',
    'vendor-management': 'Vendor Management',
};

export default function InventorySectionPage() {
    const router = useRouter();
    const params = useParams();
    const section = String(params?.section || '');
    const title = TITLES[section] || 'Inventory';
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
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex min-w-0 w-full max-w-full flex-1 flex-col">
                <Navbar />
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
                    <p className="mt-1 text-sm text-slate-500">Open this section from Inventory.</p>
                </main>
            </div>
        </div>
    );
}
