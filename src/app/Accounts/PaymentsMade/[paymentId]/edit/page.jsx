'use client';

import { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import AddVendorPaymentModal from '../../components/AddVendorPaymentModal';

function EditPaymentMadeContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const paymentId = String(params?.paymentId || '').trim();
    const organizationId = String(searchParams.get('organizationId') || '').trim();

    const goBackToDetail = () => {
        if (!paymentId) {
            router.push('/Accounts/PaymentsMade');
            return;
        }
        const qs = new URLSearchParams();
        qs.set('paymentId', paymentId);
        if (organizationId) qs.set('organizationId', organizationId);
        router.push(`/Accounts/PaymentsMade?${qs.toString()}`);
    };

    return (
        <AddVendorPaymentModal
            variant="page"
            paymentId={paymentId}
            prefill={organizationId ? { organizationId } : null}
            onClose={goBackToDetail}
            onSuccess={goBackToDetail}
        />
    );
}

export default function EditPaymentMadePage() {
    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden overflow-y-auto">
                        <Suspense
                            fallback={
                                <div className="py-10 text-center text-sm text-slate-500">
                                    Loading...
                                </div>
                            }
                        >
                            <EditPaymentMadeContent />
                        </Suspense>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
