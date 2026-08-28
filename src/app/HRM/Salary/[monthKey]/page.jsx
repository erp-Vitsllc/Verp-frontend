'use client';

import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import SalaryMonthControlCentre from '../components/SalaryMonthControlCentre';

export default function SalaryMonthPage() {
    const params = useParams();
    const monthKey = String(params?.monthKey || '');

    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_employees_view_salary', 'hrm']}
            permissionType="view"
        >
            <div
                className="flex min-h-screen w-full max-w-full"
                style={{ backgroundColor: '#f6f7f9' }}
            >
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div
                        className="p-3 sm:p-5 lg:p-8 w-full max-w-full min-w-0"
                        style={{ backgroundColor: '#f6f7f9' }}
                    >
                        <SalaryMonthControlCentre monthKey={monthKey} />
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
