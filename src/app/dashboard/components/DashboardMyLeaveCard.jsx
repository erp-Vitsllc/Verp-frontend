'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { markAttendanceHref } from '@/app/HRM/Attendance/utils/markAttendanceHref';
import { cn } from '@/lib/utils';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardItem } from './dashboardMotion';
import { DashboardCard, SectionHeader } from './ui';
import DashboardSalaryEnrollLock, {
    EMPTY_SALARY_LOCK,
    salaryLockFromAttendancePayload,
} from './DashboardSalaryEnrollLock';
import CompOffRequestModal from './CompOffRequestModal';

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
    periodOpen: false,
};

const DETAIL_BOXES = [
    { key: 'on_leave', label: 'Annual leave', wrap: 'bg-indigo-50/70 text-indigo-700', inner: 'bg-white/75' },
    { key: 'authorized_leave', label: 'Authorized leave', wrap: 'bg-blue-50/70 text-blue-700', inner: 'bg-white/75' },
    { key: 'unauthorized_leave', label: 'Unauthorized leave', wrap: 'bg-rose-50/70 text-rose-700', inner: 'bg-white/75' },
    { key: 'sick_leave', label: 'Sick leave', wrap: 'bg-emerald-50/70 text-emerald-700', inner: 'bg-white/75' },
    { key: 'compoff_leave', label: 'Comp off leave', wrap: 'bg-violet-50/70 text-violet-700', inner: 'bg-white/75' },
    { key: 'late_early', label: 'Late arrival / Early go', wrap: 'bg-amber-50/70 text-amber-800', inner: 'bg-white/75' },
    { key: 'mispunch', label: 'Miss punch', wrap: 'bg-sky-50/70 text-sky-700', inner: 'bg-white/75' },
    { key: 'attendance', label: 'Attendance', wrap: 'bg-green-50/70 text-green-700', inner: 'bg-white/75' },
];

const BOX_STATUS_KEYS = {
    present: ['on_office', 'work_from_home', 'late_arrived', 'early_go', 'mispunch'],
    absent: ['authorized_leave', 'sick_leave', 'compoff_leave', 'unauthorized_leave'],
    holiday: ['holiday'],
    on_leave: ['on_leave'],
    authorized_leave: ['authorized_leave'],
    unauthorized_leave: ['unauthorized_leave'],
    sick_leave: ['sick_leave'],
    compoff_leave: ['compoff_leave'],
    late_early: ['late_arrived', 'early_go'],
    mispunch: ['mispunch'],
    attendance: ['on_office', 'work_from_home', 'unauthorized_leave', 'authorized_leave', 'sick_leave', 'on_leave', 'compoff_leave'],
};

const LIST_TITLES = {
    present: 'Present days',
    absent: 'Absent days',
    holiday: 'Holidays',
};

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

function pendingDays(entries, keys) {
    const wanted = new Set(keys);
    return (Array.isArray(entries) ? entries : []).reduce((sum, row) => {
        if (!wanted.has(row?.statusKey)) return sum;
        if (String(row?.leaveRequestStatus || '').toLowerCase() !== 'pending') return sum;
        const stored = Number(row?.days) || 0;
        return sum + (!row?.date && stored > 0 ? stored : 1);
    }, 0);
}

function periodMetrics(boxKey, { counts, summary, entries, leaveBalances }) {
    const used = (key) => n(counts?.[key]);
    const remainingOf = (key) => {
        const value = leaveBalances?.[key]?.remaining;
        return value == null || value === '' ? 0 : n(value);
    };
    const pendingUsedRemaining = (pending, taken, remaining) => [
        { label: 'Pending', value: n(pending) },
        { label: 'Used', value: n(taken) },
        { label: 'Remaining', value: n(remaining) },
    ];

    if (boxKey === 'on_leave' || boxKey === 'sick_leave' || boxKey === 'compoff_leave') {
        return pendingUsedRemaining(pendingDays(entries, [boxKey]), used(boxKey), remainingOf(boxKey));
    }
    if (boxKey === 'authorized_leave' || boxKey === 'unauthorized_leave') {
        return pendingUsedRemaining(pendingDays(entries, [boxKey]), used(boxKey), 0);
    }
    if (boxKey === 'late_early') {
        return pendingUsedRemaining(
            pendingDays(entries, ['late_arrived', 'early_go']),
            used('late_arrived') + used('early_go'),
            0,
        );
    }
    if (boxKey === 'mispunch') {
        return pendingUsedRemaining(pendingDays(entries, ['mispunch']), used('mispunch'), 0);
    }
    return [
        { label: 'Office', value: used('on_office') + used('late_arrived') + used('early_go') + used('mispunch') },
        { label: 'WFH', value: used('work_from_home') },
        { label: 'Absent', value: n(summary?.absentDays) },
    ];
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

function dayRowsForList(entries, holidayDates, boxKey) {
    if (boxKey === 'holiday') {
        return (Array.isArray(holidayDates) ? holidayDates : [])
            .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')))
            .map((date) => ({
                date,
                type: 'Holiday',
                reason: '',
                source: 'Holiday',
            }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }
    const keys = new Set(BOX_STATUS_KEYS[boxKey] || []);
    return (Array.isArray(entries) ? entries : [])
        .filter((row) => keys.has(row?.statusKey) && /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || '')))
        .map((row) => ({
            date: String(row.date),
            type: row.statusLabel || row.statusKey,
            reason: row.reason || '',
            source: row.source || 'Attendance',
        }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function MiniStat({ value, label, hint, valueClass, onClick }) {
    const className = 'min-h-[84px] w-full rounded-xl border border-[#E7EBF1] bg-white px-3.5 py-3 flex flex-col justify-center text-left';
    const body = (
        <>
            <p className={cn('text-[26px] font-bold tabular-nums leading-none text-[#111827]', valueClass)}>
                {value}
            </p>
            <p className="text-[11px] font-medium text-[#8792A6] mt-1.5 leading-tight">{label}</p>
            {hint ? <p className="text-[10px] text-[#8792A6] mt-0.5 leading-tight">{hint}</p> : null}
        </>
    );
    if (!onClick) return <div className={className}>{body}</div>;
    return (
        <button type="button" onClick={onClick} className={`${className} hover:border-[#D8DEE8]`}>
            {body}
        </button>
    );
}

function SplitMetric({ label, value, hint, wrap }) {
    return (
        <div className={cn('rounded-lg px-2 py-1.5 min-w-0', wrap)}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] opacity-70 leading-none">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums leading-none">{value}</p>
            {hint ? <p className="mt-0.5 text-[9px] leading-tight opacity-70">{hint}</p> : null}
        </div>
    );
}

function LeaveDetailModal({ open, title, period, rows, onClose, onOpenDay }) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden border border-[#E7EBF1]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEF2F6]">
                    <div>
                        <h3 className="text-base font-bold text-[#111827]">{title}</h3>
                        <p className="text-xs text-[#8792A6] mt-0.5">
                            {period ? `${period} · ` : ''}
                            {rows.length} day{rows.length === 1 ? '' : 's'} · open a row to see that day in Mark Attendance
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-[#8792A6] hover:text-slate-700 hover:bg-slate-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-auto max-h-[calc(80vh-4.5rem)]">
                    {rows.length === 0 ? (
                        <p className="text-sm text-[#8792A6] py-10 text-center">No records for this category.</p>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white">
                                <tr className="border-b border-[#EEF2F6] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                    <th className="px-4 py-2.5 font-semibold">Date</th>
                                    <th className="px-4 py-2.5 font-semibold">Type</th>
                                    <th className="px-4 py-2.5 font-semibold">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr
                                        key={`${row.date}-${row.type}-${index}`}
                                        onClick={() => onOpenDay?.(row.date)}
                                        className="cursor-pointer border-b border-[#F1F5F9] last:border-0 hover:bg-sky-50"
                                    >
                                        <td className="px-4 py-2.5 text-[13px] font-semibold text-[#2563EB]">{formatLeaveDate(row.date)}</td>
                                        <td className="px-4 py-2.5 text-[13px] text-[#0F172A]">{row.type}</td>
                                        <td className="px-4 py-2.5 text-[13px] text-[#64748B]">{row.reason || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function DashboardMyLeaveCard() {
    const router = useRouter();
    const [filterKey, setFilterKey] = useState('current_month');
    const [customMonth, setCustomMonth] = useState(currentMonthKey);
    const [counts, setCounts] = useState(EMPTY_COUNTS);
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [leaveBalances, setLeaveBalances] = useState({});
    const [leavePolicy, setLeavePolicy] = useState(null);
    const [entries, setEntries] = useState([]);
    const [holidayDates, setHolidayDates] = useState([]);
    const [detailKey, setDetailKey] = useState('');
    const [salaryLock, setSalaryLock] = useState(EMPTY_SALARY_LOCK);
    const [compOffOpen, setCompOffOpen] = useState(false);
    const [reloadTick, setReloadTick] = useState(0);

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
                const lock = salaryLockFromAttendancePayload(res.data);
                if (lock.locked && !lock.enrolledWaiting) {
                    setSalaryLock(lock);
                    setCounts(EMPTY_COUNTS);
                    setSummary(EMPTY_SUMMARY);
                    setLeaveBalances({});
                    setLeavePolicy(null);
                    setEntries([]);
                    setHolidayDates([]);
                    return;
                }
                if (lock.locked && lock.enrolledWaiting) {
                    setSalaryLock(EMPTY_SALARY_LOCK);
                    setCounts(EMPTY_COUNTS);
                    setLeaveBalances({});
                    setLeavePolicy(res.data.leavePolicy || null);
                    setEntries([]);
                    setHolidayDates([]);
                    setSummary({
                        ...EMPTY_SUMMARY,
                        workingDays: n(res.data.workingDays),
                    });
                    return;
                }
                setSalaryLock(EMPTY_SALARY_LOCK);
                setCounts({ ...EMPTY_COUNTS, ...(res.data.counts || {}) });
                setLeaveBalances(res.data.leaveBalances || {});
                setLeavePolicy(res.data.leavePolicy || null);
                setEntries(Array.isArray(res.data.entries) ? res.data.entries : []);
                setHolidayDates(Array.isArray(res.data.holidayDates) ? res.data.holidayDates : []);
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
                    periodOpen: Boolean(res.data.periodOpen),
                });
            } catch (err) {
                if (!cancelled) {
                    const payload = err?.response?.data;
                    const lock =
                        payload?.salaryEnrolled === false || payload?.attendanceLocked
                            ? salaryLockFromAttendancePayload(payload)
                            : EMPTY_SALARY_LOCK;
                    if (lock.locked && lock.enrolledWaiting) {
                        setSalaryLock(EMPTY_SALARY_LOCK);
                        setSummary({
                            ...EMPTY_SUMMARY,
                            workingDays: n(payload?.workingDays),
                        });
                    } else {
                        setSalaryLock(lock.locked ? lock : EMPTY_SALARY_LOCK);
                        setSummary(EMPTY_SUMMARY);
                    }
                    setCounts(EMPTY_COUNTS);
                    setLeaveBalances({});
                    setLeavePolicy(payload?.leavePolicy || null);
                    setEntries([]);
                    setHolidayDates([]);
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
    }, [query.month, query.year, reloadTick]);

    const metricsByBox = useMemo(() => {
        const ctx = { counts, summary, entries, leaveBalances };
        return Object.fromEntries(DETAIL_BOXES.map((box) => [box.key, periodMetrics(box.key, ctx)]));
    }, [counts, summary, entries, leaveBalances]);

    const detailHint = (key) => {
        if (key === 'authorized_leave') {
            const paid = n(counts.authorized_leave_paid);
            const unpaid = n(counts.authorized_leave_unpaid);
            if (!paid && !unpaid) return '';
            return `Paid ${paid} · Unpaid ${unpaid}`;
        }
        if (key === 'unauthorized_leave') {
            const deduction = leaveBalances.unauthorized_leave?.deductionDays;
            const multiplier = leaveBalances.unauthorized_leave?.multiplier;
            if (multiplier != null && Number(multiplier) !== 1 && n(leaveBalances.unauthorized_leave?.taken) > 0) {
                return `Policy deduction ${deduction} days`;
            }
            return '';
        }
        if (key === 'on_leave' && summary.lastAnnualLeaveDate) {
            return `Last taken ${formatLeaveDate(summary.lastAnnualLeaveDate)}`;
        }
        if (key === 'sick_leave' && leavePolicy?.sickPeriod) {
            return `${leavePolicy.sickAllowedDays ?? leavePolicy.allowedSickLeaveDaysPerYear ?? 0} days ${leavePolicy.sickPeriod} from salary policy`;
        }
        return '';
    };

    const activeBox = DETAIL_BOXES.find((box) => box.key === detailKey) || null;
    const activeTitle = LIST_TITLES[detailKey] || activeBox?.label || '';
    const detailRows = useMemo(
        () => (detailKey ? dayRowsForList(entries, holidayDates, detailKey) : []),
        [detailKey, entries, holidayDates],
    );

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
                                    onClick={() => {
                                        setDetailKey('');
                                        setFilterKey(opt.key);
                                    }}
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

            <div className="mt-3 flex justify-end">
                <button
                    type="button"
                    onClick={() => setCompOffOpen(true)}
                    className="h-8 px-3 rounded-full border border-violet-200 bg-violet-50 text-[11px] font-semibold text-violet-700"
                >
                    Request comp-off
                </button>
            </div>

            <div className="mt-3 grid grid-cols-2 min-[1200px]:grid-cols-4 gap-3">
                <MiniStat
                    value={summary.presentDays}
                    label="Present days"
                    valueClass="text-emerald-700"
                    onClick={() => setDetailKey('present')}
                />
                <MiniStat
                    value={summary.absentDays}
                    label="Absent days"
                    valueClass="text-rose-700"
                    hint={`Auth ${summary.absentAuth} · Sick ${summary.absentSick} · Unauth ${summary.absentUnauthorized}`}
                    onClick={() => setDetailKey('absent')}
                />
                <MiniStat
                    value={summary.workingDays}
                    label="Total Working Days"
                    hint={summary.periodOpen ? 'Through today' : 'In this period'}
                />
                <MiniStat
                    value={summary.holidayCount}
                    label="Holidays"
                    onClick={() => setDetailKey('holiday')}
                />
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {DETAIL_BOXES.map((box) => {
                    const metrics = metricsByBox[box.key] || [];
                    const hint = detailHint(box.key);
                    return (
                        <button
                            key={box.key}
                            type="button"
                            onClick={() => setDetailKey(box.key)}
                            className={`rounded-xl px-2 py-2 min-w-0 text-left transition-transform hover:-translate-y-px hover:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${box.wrap}`}
                        >
                            <p className="text-[11px] font-medium leading-tight px-0.5">{box.label}</p>
                            <div className={`mt-1.5 grid gap-1.5 ${metrics.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                {metrics.map((metric) => (
                                    <SplitMetric
                                        key={metric.label}
                                        label={metric.label}
                                        value={metric.value}
                                        wrap={box.inner}
                                    />
                                ))}
                            </div>
                            {hint ? (
                                <p className="text-[10px] mt-1 px-0.5 leading-tight opacity-80">{hint}</p>
                            ) : null}
                        </button>
                    );
                })}
            </div>
            <DashboardSalaryEnrollLock {...salaryLock} />
            <LeaveDetailModal
                open={Boolean(activeTitle)}
                title={activeTitle}
                period={periodLabel(filterKey, customMonth)}
                rows={detailRows}
                onClose={() => setDetailKey('')}
                onOpenDay={(date) => router.push(markAttendanceHref({ date }))}
            />
            <CompOffRequestModal
                open={compOffOpen}
                onClose={() => setCompOffOpen(false)}
                onSent={() => setReloadTick((value) => value + 1)}
            />
        </DashboardCard>
    );
}
