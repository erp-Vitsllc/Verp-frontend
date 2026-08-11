'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import AttendanceMonthCalendar from './components/AttendanceMonthCalendar';

const STAFF_TABS = [
    { key: 'office', label: 'Office Staff' },
    { key: 'site', label: 'Site Staffs' },
];

const AnimatedCounter = ({ value, duration = 600 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime;
        let animationFrame;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;

            if (progress < duration) {
                const percentage = progress / duration;
                const easeOut = 1 - Math.pow(1 - percentage, 4);
                setCount(Math.floor(easeOut * value));
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{count}</>;
};

const OVERVIEW_STATS = [
    { label: 'Half Day', value: 0 },
    { label: 'Weekend', value: 0 },
    { label: 'Holiday', value: 0 },
    { label: 'Total Staff', value: 0 },
];

export default function AttendancePage() {
    const [staffTab, setStaffTab] = useState('office');

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
                        <div className="flex flex-wrap border-b border-gray-200 mb-4 sm:mb-6 bg-white rounded-t-xl px-2 sm:px-3">
                            {STAFF_TABS.map((tab) => {
                                const active = staffTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setStaffTab(tab.key)}
                                        className={`px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-all relative ${
                                            active
                                                ? 'text-[#EA3D2F]'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {tab.label}
                                        {active ? (
                                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#EA3D2F] rounded-t-full" />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Header pair: overview + summary. Calendar below stays full width. */}
                        <div className={HEADER_PAIR_GRID}>
                            <div
                                className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                            >
                                <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 shrink-0">
                                    Attendance Overview
                                    <span className="ml-2 font-semibold text-gray-500 normal-case tracking-normal">
                                        · {staffTab === 'site' ? 'Site Staffs' : 'Office Staff'}
                                    </span>
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 flex-1">
                                    {OVERVIEW_STATS.map((item) => (
                                        <div
                                            key={item.label}
                                            className="bg-gray-50 p-2 sm:p-3 lg:p-4 rounded-xl flex flex-col items-center justify-center text-center border border-transparent"
                                        >
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2 break-words text-center leading-tight">
                                                {item.label}
                                            </span>
                                            <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#EA3D2F]">
                                                <AnimatedCounter value={item.value} />
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div
                                className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col ${HEADER_PAIR_CARD_DASHBOARD}`}
                            >
                                <h3 className="text-xs sm:text-sm font-bold text-gray-400 text-center uppercase tracking-widest mb-2 sm:mb-4 shrink-0">
                                    Attendance Summary
                                </h3>
                                <div className="flex-1 flex items-center justify-center min-h-0">
                                    <p className="text-sm text-slate-400 text-center px-4">
                                        Charts and attendance trends will appear here.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <AttendanceMonthCalendar staffType={staffTab} />
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
