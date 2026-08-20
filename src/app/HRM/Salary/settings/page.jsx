'use client';

import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import PayrollSettingsPanel from '../components/PayrollSettingsPanel';

export default function SalarySettingsPage() {
    const router = useRouter();

    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_leave', 'hrm_attendance', 'hrm']}
        >
            <div className="flex min-h-screen bg-[#F5F7FB]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <main className="flex-1 p-6 lg:p-8">
                        <PayrollSettingsPanel
                            open
                            onClose={() => router.push('/HRM/Salary')}
                        />
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
