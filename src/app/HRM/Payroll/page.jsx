'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import PayrollDashboard from '@/app/HRM/Salary/components/PayrollDashboard';

export default function PayrollPage() {
    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_leave', 'hrm_attendance', 'hrm']}
        >
            <div className="flex min-h-screen bg-[#FAFAFB]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <main className="flex-1 min-w-0 overflow-x-hidden">
                        <PayrollDashboard />
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
