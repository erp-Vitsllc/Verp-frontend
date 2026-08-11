'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import MarkAttendanceTable from './components/MarkAttendanceTable';

function parseDateParam(value) {
    if (!value) return startOfDay(new Date());
    const parsed = parseISO(String(value));
    if (isValid(parsed)) return startOfDay(parsed);
    return startOfDay(new Date());
}

function MarkAttendanceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dateParam = searchParams.get('date');

    const selectedDate = useMemo(() => parseDateParam(dateParam), [dateParam]);

    const goToDate = useCallback(
        (nextDate) => {
            const date = format(startOfDay(nextDate), 'yyyy-MM-dd');
            router.replace(`/HRM/Attendance/mark?date=${date}`);
        },
        [router],
    );

    const goPrev = () => goToDate(addDays(selectedDate, -1));
    const goNext = () => goToDate(addDays(selectedDate, 1));

    const fullDateLabel = format(selectedDate, 'EEEE, d MMMM yyyy');
    const dateKey = format(selectedDate, 'yyyy-MM-dd');

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                        Mark Attendance
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Mark and review attendance for the selected date.
                    </p>
                </div>

                <div className="flex items-center gap-1 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={goPrev}
                        className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        aria-label="Previous day"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="min-w-[12rem] sm:min-w-[16rem] px-3 text-center">
                        <p className="text-sm sm:text-base font-semibold text-gray-900">{fullDateLabel}</p>
                        <p className="text-[11px] text-gray-400 tabular-nums mt-0.5">{dateKey}</p>
                    </div>
                    <button
                        type="button"
                        onClick={goNext}
                        className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        aria-label="Next day"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="px-2 sm:px-4 py-3">
                <MarkAttendanceTable dateKey={dateKey} />
            </div>
        </div>
    );
}

export default function MarkAttendancePage() {
    return (
        <PermissionGuard moduleId="hrm_attendance" permissionType="view">
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
                        <Suspense
                            fallback={
                                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                                    Loading...
                                </div>
                            }
                        >
                            <MarkAttendanceContent />
                        </Suspense>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
