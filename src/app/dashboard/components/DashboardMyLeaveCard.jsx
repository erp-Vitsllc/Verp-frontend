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
    authorized_leave_paid: 0,
    authorized_leave_unpaid: 0,
    unauthorized_leave: 0,
    work_from_home: 0,
    on_office: 0,
    late_arrived: 0,
    early_go: 0,
    mispunch: 0,
    holiday: 0,
    weekly_off: 0,
};

const EMPTY_SUMMARY = {
    presentDays: 0,
    absentDays: 0,
    absentAuth: 0,
    absentSick: 0,
    absentUnauthorized: 0,
    workingDays: 0,
    holidayCount: 0,
    weeklyOffCount: 0,
    lastAnnualLeaveDate: '',
};

const DETAIL_BOXES = [
    { key: 'authorized_leave', label: 'Authorized leave', wrap: 'bg-blue-50 text-blue-700' },
    { key: 'unauthorized_leave', label: 'Unauthorized leave', wrap: 'bg-rose-50 text-rose-700' },
    { key: 'sick_leave', label: 'Sick leave', wrap: 'bg-emerald-50 text-emerald-700' },
    { key: 'work_from_home', label: 'Work from home', wrap: 'bg-green-50 text-green-700' },
    { key: 'late_group', label: 'Late / Mispunch / Early', wrap: 'bg-yellow-50 text-yellow-800' },
    { key: 'annual_leave', label: 'Annual leave', wrap: 'bg-indigo-50 text-indigo-700' },
];

const PERIOD_FILTERS = [
    { key: 'current_month', label: 'Current month' },
    { key: 'prev_month', label: 'Prev month' },
    { key: 'current_year', label: 'Current year' },
    { key: 'prev_year', label: 'Previous year' },
    { key: 'custom', label: 'Custom' },
];

function currentMonthKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
        .format(new Date())
        .slice(0, 7);
}

function shiftMonthKey(monthKey, delta) {
    const [year, month] = String(monthKey).split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey) {
    try {
        const [year, month] = String(monthKey).split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        });
    } catch {
        return monthKey;
    }
}

function currentYear() {
    return Number(currentMonthKey().slice(0, 4));
}

function queryForFilter(filterKey, customMonth) {
    const nowMonth = currentMonthKey();
    const year = currentYear();
    if (filterKey === 'prev_month') return { month: shiftMonthKey(nowMonth, -1) };
    if (filterKey === 'current_year') return { year };
    if (filterKey === 'prev_year') return { year: year - 1 };
    if (filterKey === 'custom' && /^\d{4}-\d{2}$/.test(customMonth)) return { month: customMonth };
    return { month: nowMonth };
}

function periodLabel(filterKey, customMonth) {
    const q = queryForFilter(filterKey, customMonth);
    if (q.month) return monthLabel(q.month);
    if (q.year) return String(q.year);
    return '';
}

function n(value) {
    return Number(value) || 0;
}

function formatLeaveDate(value) {
    const key = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '—';
    try {
        const [year, month, day] = key.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day)).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        });
    } catch {
        return key;
    }
}

export default function DashboardMyLeaveCard() {
    const [filterKey, setFilterKey] = useState('current_month');
    const [customMonth, setCustomMonth] = useState(currentMonthKey);
    const [counts, setCounts] = useState(EMPTY_COUNTS);
    const [summary, setSummary] = useState(EMPTY_SUMMARY);

    const query = queryForFilter(filterKey, customMonth);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await axiosInstance.get('/Attendance/me/year-summary', {
                    params: query,
                    skipToast: true,
                });
                if (cancelled || !res?.data) return;
                setCounts({ ...EMPTY_COUNTS, ...(res.data.counts || {}) });
                setSummary({
                    presentDays: n(res.data.presentDays),
                    absentDays: n(res.data.absentDays),
                    absentAuth: n(res.data.absentAuth),
                    absentSick: n(res.data.absentSick),
                    absentUnauthorized: n(res.data.absentUnauthorized),
                    workingDays: n(res.data.workingDays),
                    holidayCount: n(res.data.holidayCount),
                    weeklyOffCount: n(res.data.weeklyOffCount),
                    lastAnnualLeaveDate: String(res.data.lastAnnualLeaveDate || ''),
                });
            } catch {
                if (!cancelled) {
                    setCounts(EMPTY_COUNTS);
                    setSummary(EMPTY_SUMMARY);
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
    }, [query.month, query.year]);

    const lateGroup = n(counts.late_arrived) + n(counts.mispunch) + n(counts.early_go);

    const detailValue = (key) => {
        if (key === 'late_group') return lateGroup;
        if (key === 'annual_leave') return formatLeaveDate(summary.lastAnnualLeaveDate);
        return n(counts[key]);
    };

    const detailHint = (key) => {
        if (key === 'authorized_leave') {
            const paid = n(counts.authorized_leave_paid);
            const unpaid = n(counts.authorized_leave_unpaid);
            if (!paid && !unpaid) return '';
            return `Paid ${paid} · Unpaid ${unpaid}`;
        }
        if (key === 'annual_leave') return summary.lastAnnualLeaveDate ? 'Last taken' : 'Not taken';
        return '';
    };

    return (
        <motion.article
            variants={dashboardItem}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 pt-3 pb-4"
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <CalendarDays size={16} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800">My Attendance</h3>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                            {periodLabel(filterKey, customMonth)}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-full">
                    {PERIOD_FILTERS.map((opt) => {
                        const active = filterKey === opt.key;
                        return (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => setFilterKey(opt.key)}
                                className={`h-7 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                                    active
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                    {filterKey === 'custom' ? (
                        <input
                            type="month"
                            value={customMonth}
                            onChange={(e) => {
                                const next = String(e.target.value || '').trim();
                                if (/^\d{4}-\d{2}$/.test(next)) setCustomMonth(next);
                            }}
                            className="h-7 w-[8.5rem] px-2 rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
                        />
                    ) : null}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <motion.div
                    whileHover={dashboardHover}
                    className="dash-card-lift rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 min-h-[168px]"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-green-50 text-green-800 px-3 py-3">
                            <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none">
                                {summary.presentDays}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wide mt-1.5">
                                Present days
                            </p>
                        </div>
                        <div className="rounded-xl bg-rose-50 text-rose-800 px-3 py-3">
                            <p className="text-2xl font-black tabular-nums leading-none">
                                {summary.absentDays}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wide mt-1">
                                Absent days
                            </p>
                            <div className="mt-2 grid grid-cols-3 gap-1">
                                <div className="rounded-md bg-white/80 px-1 py-1 text-center">
                                    <p className="text-sm font-black tabular-nums leading-none">
                                        {summary.absentAuth}
                                    </p>
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-blue-700 mt-0.5">
                                        Auth
                                    </p>
                                </div>
                                <div className="rounded-md bg-white/80 px-1 py-1 text-center">
                                    <p className="text-sm font-black tabular-nums leading-none">
                                        {summary.absentSick}
                                    </p>
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-700 mt-0.5">
                                        Sick
                                    </p>
                                </div>
                                <div className="rounded-md bg-white/80 px-1 py-1 text-center">
                                    <p className="text-sm font-black tabular-nums leading-none">
                                        {summary.absentUnauthorized}
                                    </p>
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-rose-700 mt-0.5">
                                        Unauth
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl bg-sky-50 text-sky-800 px-3 py-3">
                            <p className="text-2xl font-black tabular-nums leading-none">
                                {summary.workingDays}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wide mt-1.5 leading-tight">
                                Total working days
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-100 text-slate-700 px-3 py-3">
                            <p className="text-2xl font-black tabular-nums leading-none">
                                {summary.holidayCount}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wide mt-1.5">
                                Holidays
                            </p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    whileHover={dashboardHover}
                    className="dash-card-lift rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 min-h-[168px]"
                >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {DETAIL_BOXES.map((box, index) => {
                            const hint = detailHint(box.key);
                            const isDate = box.key === 'annual_leave';
                            return (
                                <div
                                    key={box.key}
                                    className={`dash-leave-box rounded-xl px-2 py-2.5 text-center min-w-0 ${box.wrap}`}
                                    style={{ animationDelay: `${index * 40}ms` }}
                                >
                                    <p
                                        className={`font-black tabular-nums leading-none ${
                                            isDate ? 'text-sm sm:text-[15px]' : 'text-lg sm:text-xl'
                                        }`}
                                    >
                                        {detailValue(box.key)}
                                    </p>
                                    <p className="text-[9px] font-bold uppercase tracking-wide mt-1 leading-tight">
                                        {box.label}
                                    </p>
                                    {hint ? (
                                        <p className="text-[8px] font-semibold mt-0.5 leading-tight opacity-80">
                                            {hint}
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            </div>
        </motion.article>
    );
}
