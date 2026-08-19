'use client';

import { Suspense, use } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import EmployeeAttendanceProfileView from '../components/EmployeeAttendanceProfileView';

function EmployeeAttendanceProfilePageInner({ employeeMongoId }) {
    const router = useRouter();
    const handleListReturnBack = useListReturnBack(() => router.push('/HRM/Leave'));

    return (
        <PermissionGuard moduleId="hrm_leave" permissionType="view">
            <div
                className="flex min-h-screen w-full max-w-full overflow-x-hidden"
                style={{ backgroundColor: '#F2F6F9' }}
            >
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div
                        className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden"
                        style={{ backgroundColor: '#F2F6F9' }}
                    >
                        <ListReturnBackButton onNavigate={handleListReturnBack} />
                        <EmployeeAttendanceProfileView employeeMongoId={employeeMongoId} />
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}

export default function EmployeeAttendanceProfilePage({ params }) {
    const { id } = use(params);
    const employeeMongoId = String(id || '').trim();

    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
                    Loading attendance profile...
                </div>
            }
        >
            <EmployeeAttendanceProfilePageInner employeeMongoId={employeeMongoId} />
        </Suspense>
    );
}
