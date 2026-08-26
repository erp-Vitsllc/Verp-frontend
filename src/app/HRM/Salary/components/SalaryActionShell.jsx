'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import SalaryHeaderActions from './SalaryHeaderActions';

export default function SalaryActionShell({ title }) {
    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_employees_view_salary', 'hrm']}
            permissionType="view"
        >
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
                        <ErpPageHeader title={title}>
                            <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                        </ErpPageHeader>
                        <div className={HEADER_PAIR_GRID}>
                            <div
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                            />
                            <div
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
