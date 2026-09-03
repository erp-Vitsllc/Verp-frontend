'use client';

import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import SalarySlipMonthView from '../../../SalarySlipMonthView';

export default function SalarySlipMonthPage() {
    const params = useParams();
    const employeeId = decodeURIComponent(String(params?.employeeId || ''));
    const monthKey = decodeURIComponent(String(params?.monthKey || ''));

    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_employees_view_salary', 'hrm']}
            permissionType="view"
        >
            <div className="flex min-h-screen w-full" style={{ backgroundColor: '#F4F7FB' }}>
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                    <Navbar />
                    <SalarySlipMonthView employeeId={employeeId} monthKey={monthKey} />
                </div>
            </div>
        </PermissionGuard>
    );
}
