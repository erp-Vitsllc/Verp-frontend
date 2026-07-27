'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';

export default function LeavePage() {
    return (
        <PermissionGuard moduleId="hrm_leave">
            <div className="flex min-h-screen bg-gray-50">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <main className="flex-1 p-6">
                        <h1 className="text-2xl font-semibold text-slate-800">Leave</h1>
                        <p className="mt-2 text-slate-500">Leave module coming soon.</p>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
