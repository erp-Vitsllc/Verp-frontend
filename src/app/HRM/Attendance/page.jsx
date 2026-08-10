'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import AttendanceMonthCalendar from './components/AttendanceMonthCalendar';

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
                        {/* Left column (~50%): overview + calendar. Right column left empty. */}
                        <div className={HEADER_PAIR_GRID}>
                            <div className="flex flex-col gap-3 sm:gap-4 lg:gap-6 min-w-0 w-full">
                                <div
                                    className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                                >
                                    <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 shrink-0">
                                        Attendance Overview
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

                                <AttendanceMonthCalendar />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
