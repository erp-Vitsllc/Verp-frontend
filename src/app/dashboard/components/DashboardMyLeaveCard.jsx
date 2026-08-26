'use client';

import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardItem } from './dashboardMotion';
import { DashboardCard, SectionHeader } from './ui';
import DashboardSalaryEnrollLock from './DashboardSalaryEnrollLock';

const EMPTY_COUNTS = {
    on_leave: 0,
    sick_leave: 0,
    compoff_leave: 0,
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
    { key: 'authorized_leave', label: 'Authorized leave', wrap: 'bg-blue-50/70 text-blue-700' },
    { key: 'unauthorized_leave', label: 'Unauthorized leave', wrap: 'bg-rose-50/70 text-rose-700' },
    { key: 'sick_leave', label: 'Sick leave', wrap: 'bg-emerald-50/70 text-emerald-700' },
    { key: 'compoff_leave', label: 'Comp off leave', wrap: 'bg-violet-50/70 text-violet-700' },
    { key: 'work_from_home', label: 'Work from home', wrap: 'bg-green-50/70 text-green-700' },
    { key: 'late_group', label: 'Late / Mispunch / Early', wrap: 'bg-amber-50/70 text-amber-800' },
    { key: 'annual_leave', label: 'Annual leave', wrap: 'bg-indigo-50/70 text-indigo-700' },
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

function MiniStat({ value, label, hint, valueClass }) {
    return (
        <div className="min-h-[84px] rounded-xl border border-[#E7EBF1] bg-white px-3.5 py-3 flex flex-col justify-center">
            <p className={cn('text-[26px] font-bold tabular-nums leading-none text-[#111827]', valueClass)}>
                {value}
            </p>
            <p className="text-[11px] font-medium text-[#8792A6] mt-1.5 leading-tight">{label}</p>
            {hint ? <p className="text-[10px] text-[#8792A6] mt-0.5 leading-tight">{hint}</p> : null}
        </div>
    );
}

export default function DashboardMyLeaveCard() {
    const [filterKey, setFilterKey] = useState('current_month');
    const [customMonth, setCustomMonth] = useState(currentMonthKey);
    const [counts, setCounts] = useState(EMPTY_COUNTS);
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [salaryLocked, setSalaryLocked] = useState(false);

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
                if (res.data.salaryEnrolled === false) {
                    setSalaryLocked(true);
                    setCounts(EMPTY_COUNTS);
                    setSummary(EMPTY_SUMMARY);
                    return;
                }
                setSalaryLocked(false);
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
                    setSalaryLocked(false);
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
        <DashboardCard variants={dashboardItem} className="relative overflow-hidden px-4 py-3.5">
            <SectionHeader
                icon={CalendarDays}
                iconWrap="bg-sky-50 text-sky-600"
                title="My Attendance"
                subtitle={periodLabel(filterKey, customMonth)}
                action={
                    <div className="flex flex-wrap items-center justify-end gap-1 max-w-full">
                        {PERIOD_FILTERS.map((opt) => {
                            const active = filterKey === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setFilterKey(opt.key)}
                                    className={`h-7 px-2 rounded-full text-[11px] font-semibold border transition-colors duration-200 ${
                                        active
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-[#8792A6] border-[#E7EBF1] hover:bg-slate-50'
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
                                className="h-7 w-[8.5rem] px-2 rounded-full border border-[#E7EBF1] bg-white text-[11px] font-semibold text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
                            />
                        ) : null}
                    </div>
                }
            />

            <div className="mt-3 grid grid-cols-2 min-[1200px]:grid-cols-4 gap-3">
                <MiniStat value={summary.presentDays} label="Present days" valueClass="text-emerald-700" />
                <MiniStat
                    value={summary.absentDays}
                    label="Absent days"
                    valueClass="text-rose-700"
                    hint={`Auth ${summary.absentAuth} · Sick ${summary.absentSick} · Unauth ${summary.absentUnauthorized}`}
                />
                <MiniStat value={summary.workingDays} label="Total Working Days" />
                <MiniStat value={summary.holidayCount} label="Holidays" />
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 min-[1200px]:grid-cols-6 gap-2">
                {DETAIL_BOXES.map((box) => {
                    const hint = detailHint(box.key);
                    const isDate = box.key === 'annual_leave';
                    return (
                        <div
                            key={box.key}
                            className={`rounded-xl px-2.5 py-2.5 min-w-0 min-h-[72px] flex flex-col justify-center ${box.wrap}`}
                        >
                            <p
                                className={`font-bold tabular-nums leading-none ${
                                    isDate ? 'text-[13px]' : 'text-lg'
                                }`}
                            >
                                {detailValue(box.key)}
                            </p>
                            <p className="text-[11px] font-medium mt-1 leading-tight">{box.label}</p>
                            {hint ? (
                                <p className="text-[10px] mt-0.5 leading-tight opacity-80">{hint}</p>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            <DashboardSalaryEnrollLock locked={salaryLocked} />
        </DashboardCard>
    );
}
