'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import useWorkLocations from '@/hooks/useWorkLocations';
import { fetchAttendancePendingInbox } from '@/utils/pendingInboxFetch';
import {
    ATTENDANCE_PENDING_INBOX_CHANGED,
    countVisibleAttendancePendingInbox,
} from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import AttendanceHeaderSummary from './components/AttendanceHeaderSummary';
import AttendanceMonthCalendar from './components/AttendanceMonthCalendar';
import PendingAttendanceRequestsModal from './components/PendingAttendanceRequestsModal';
import { markAttendanceHref } from './utils/markAttendanceHref';

export default function AttendancePage() {
    const { tabs: staffTabs } = useWorkLocations();
    const [staffTab, setStaffTab] = useState('office');
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);

    const fetchPendingInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchAttendancePendingInbox(axiosInstance, {
                skipToast: true,
                force,
            });
            setPendingInboxCount(countVisibleAttendancePendingInbox(items));
        } catch {
            setPendingInboxCount(0);
        }
    }, []);

    useEffect(() => {
        fetchPendingInboxCount();
        const refresh = () => fetchPendingInboxCount({ force: true });
        if (typeof window !== 'undefined') {
            window.addEventListener(ATTENDANCE_PENDING_INBOX_CHANGED, refresh);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener(ATTENDANCE_PENDING_INBOX_CHANGED, refresh);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(ATTENDANCE_PENDING_INBOX_CHANGED, refresh);
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener(ATTENDANCE_PENDING_INBOX_CHANGED, refresh);
            }
        };
    }, [fetchPendingInboxCount]);

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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1">
                                    Attendance
                                </h1>
                                <p className="text-sm text-gray-600">
                                    Review staff attendance and pending approvals
                                </p>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-start sm:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setPendingInboxModalOpen(true)}
                                    className="relative p-1.5 sm:p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800 shrink-0"
                                    title="Attendance notifications"
                                >
                                    <Bell size={20} />
                                    {pendingInboxCount > 0 ? (
                                        <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                            {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
                                        </span>
                                    ) : null}
                                </button>
                                <Link
                                    href={markAttendanceHref({ staffType: staffTab })}
                                    className="h-9 sm:h-10 px-3 sm:px-4 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center whitespace-nowrap"
                                >
                                    Mark Attendance
                                </Link>
                            </div>
                        </div>

                        <AttendanceHeaderSummary
                            staffTabs={staffTabs}
                            onSelectGroup={setStaffTab}
                        />

                        <div className="mt-3 sm:mt-4 mb-3 flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-100 w-full sm:w-fit overflow-x-auto">
                            {staffTabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStaffTab(tab.key)}
                                    className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                                        staffTab === tab.key
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <AttendanceMonthCalendar
                            staffType={staffTab}
                            staffLabel={staffTabs.find((tab) => tab.key === staffTab)?.label || 'Staff'}
                        />
                    </div>
                </div>
            </div>

            <PendingAttendanceRequestsModal
                isOpen={pendingInboxModalOpen}
                onClose={() => setPendingInboxModalOpen(false)}
                onPendingInboxCount={(count) => setPendingInboxCount(count)}
            />
        </PermissionGuard>
    );
}
