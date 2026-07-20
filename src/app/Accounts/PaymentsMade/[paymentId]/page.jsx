'use client';

import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ViewVendorPaymentDetail from '../components/ViewVendorPaymentDetail';

export default function ViewPaymentMadePage() {
    const router = useRouter();
    const params = useParams();
    const paymentId = String(params?.paymentId || '').trim();

    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col w-full max-w-full">
                    <Navbar />
                    <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden overflow-y-auto">
                        <ViewVendorPaymentDetail
                            paymentId={paymentId}
                            variant="page"
                            onClose={() =>
                                router.push(
                                    `/Accounts/PaymentsMade?paymentId=${encodeURIComponent(paymentId)}`,
                                )
                            }
                        />
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
