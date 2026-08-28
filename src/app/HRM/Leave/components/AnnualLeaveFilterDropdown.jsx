'use client';

import { CalendarDays } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnnualLeaveFilterModal from './AnnualLeaveFilterModal';

export default function AnnualLeaveFilterDropdown({ employees = [] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const handleApply = useCallback(
        ({ employeeId, startDate, endDate, employee, leaveMode }) => {
            const params = new URLSearchParams({
                employeeId,
                from: startDate,
                to: endDate,
                leaveType: leaveMode === 'authorized' ? 'authorized' : 'annual',
                sourceEmployeeId: employeeId,
                sourceFrom: startDate,
                sourceTo: endDate,
            });
            if (employee?.employeeName) {
                params.set('employeeName', employee.employeeName);
                params.set('sourceEmployeeName', employee.employeeName);
            }
            setOpen(false);
            router.push(`/HRM/Leave/annual-leave?${params.toString()}`);
        },
        [router],
    );

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap border border-gray-800/20"
            >
                <CalendarDays size={18} />
                Apply Leave
            </button>
            <AnnualLeaveFilterModal
                open={open}
                onClose={() => setOpen(false)}
                employees={employees}
                onApply={handleApply}
                applyLabel="Apply"
            />
        </>
    );
}
