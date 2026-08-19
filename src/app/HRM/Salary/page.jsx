'use client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import PayrollDashboard from './components/PayrollDashboard';

export default function SalaryPage() {
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
            <PayrollDashboard />
          </main>
        </div>
      </div>
    </PermissionGuard>
  );
}
