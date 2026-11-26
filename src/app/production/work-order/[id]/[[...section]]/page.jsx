'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import WorkOrderDetails from '../../WorkOrderDetails';

export default function WorkOrderRecordPage() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
    const [ready, setReady] = useState(false);
    const rawId = String(params?.id || '');
    let id = rawId;
    try {
        id = decodeURIComponent(rawId);
    } catch {
        id = rawId;
    }
    const section = Array.isArray(params?.section)
        ? params.section
        : params?.section
            ? [String(params.section)]
            : [];

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            const next = pathname || '/production/work-order';
            router.replace(`/login?redirectTo=${encodeURIComponent(next)}`);
            return;
        }
        setReady(true);
    }, [pathname, router]);

    if (!ready || !id) return null;

    return (
        <PermissionGuard moduleId="production" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f3f7fb]">
                <Sidebar />
                <div className="flex min-w-0 w-full max-w-full flex-1 flex-col">
                    <Navbar />
                    <main className="w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-[#f3f7fb] p-3 sm:p-5 lg:p-6">
                        <WorkOrderDetails id={id} tabSlug={section[0] || ''} viewSlug={section[1] || ''} />
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
