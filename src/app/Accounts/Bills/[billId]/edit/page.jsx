'use client';

import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import AddBillModal from '../../components/AddBillModal';

export default function EditBillPage() {
    const router = useRouter();
    const params = useParams();
    const billId = String(params?.billId || '').trim();

    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden overflow-y-auto">
                        <AddBillModal
                            variant="page"
                            billId={billId}
                            onClose={() => router.push('/Accounts/Bills')}
                            onSuccess={() => router.push('/Accounts/Bills')}
                        />
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
