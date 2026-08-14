'use client';

import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { motion } from 'motion/react';
import axiosInstance from '@/utils/axios';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardHover, dashboardItem } from './dashboardMotion';

const EMPTY_COUNTS = {
    on_leave: 0,
    sick_leave: 0,
    authorized_leave: 0,
    unauthorized_leave: 0,
    work_from_home: 0,
    on_office: 0,
    late_arrived: 0,
    early_go: 0,
    mispunch: 0,
    holiday: 0,
    weekly_off: 0,
};

const BOXES = [
    { key: 'on_leave', label: 'Leave', wrap: 'bg-red-50 text-red-700' },
    { key: 'sick_leave', label: 'Sick', wrap: 'bg-emerald-50 text-emerald-700' },
    { key: 'authorized_leave', label: 'Authorized', wrap: 'bg-orange-50 text-orange-700' },
    { key: 'unauthorized_leave', label: 'Unauthorized', wrap: 'bg-rose-50 text-rose-700' },
    { key: 'work_from_home', label: 'Work from home', wrap: 'bg-teal-50 text-teal-700' },
    { key: 'on_office', label: 'Present', wrap: 'bg-green-50 text-green-700' },
    { key: 'late_arrived', label: 'Late', wrap: 'bg-amber-50 text-amber-800' },
    { key: 'early_go', label: 'Early go', wrap: 'bg-yellow-50 text-yellow-800' },
    { key: 'mispunch', label: 'Mispunch', wrap: 'bg-yellow-50 text-yellow-800' },
    { key: 'holiday', label: 'Holiday', wrap: 'bg-slate-100 text-slate-600' },
    { key: 'weekly_off', label: 'Weekly off', wrap: 'bg-slate-100 text-slate-600' },
];

function currentYear() {
    return Number(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric' }).format(new Date()),
    );
}

export default function DashboardMyLeaveCard() {
    const [year, setYear] = useState(currentYear);
    const [leaveTotal, setLeaveTotal] = useState(0);
    const [counts, setCounts] = useState(EMPTY_COUNTS);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await axiosInstance.get('/Attendance/me/year-summary', { skipToast: true });
                if (cancelled || !res?.data) return;
                setYear(Number(res.data.year) || currentYear());
                setLeaveTotal(Number(res.data.leaveTotal) || 0);
                setCounts({ ...EMPTY_COUNTS, ...(res.data.counts || {}) });
            } catch {
                if (!cancelled) {
                    setYear(currentYear());
                    setLeaveTotal(0);
                    setCounts(EMPTY_COUNTS);
                }
            }
        };

        load();
        const onChange = () => load();
        window.addEventListener(ATTENDANCE_CHECK_CHANGED, onChange);
        return () => {
            cancelled = true;
            window.removeEventListener(ATTENDANCE_CHECK_CHANGED, onChange);
        };
    }, []);

    return (
        <motion.article
            variants={dashboardItem}
            whileHover={dashboardHover}
            className="dash-card-lift bg-white rounded-2xl border border-slate-100 shadow-sm px-4 pt-3 pb-3"
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <CalendarDays size={16} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800">My Leave</h3>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            {year} attendance
                        </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-slate-800 tabular-nums leading-none">{leaveTotal}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Leave days</p>
                </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {BOXES.map((box, index) => (
                    <div
                        key={box.key}
                        className={`dash-leave-box rounded-xl px-2 py-2.5 text-center min-w-0 ${box.wrap}`}
                        style={{ animationDelay: `${index * 40}ms` }}
                    >
                        <p className="text-lg sm:text-xl font-black tabular-nums leading-none">
                            {Number(counts[box.key]) || 0}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wide mt-1 leading-tight truncate">
                            {box.label}
                        </p>
                    </div>
                ))}
            </div>
        </motion.article>
    );
}
