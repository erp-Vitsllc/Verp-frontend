'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardItem } from './dashboardMotion';
import { DashboardCard, SectionHeader } from './ui';
import DashboardSalaryEnrollLock, {
    EMPTY_SALARY_LOCK,
    salaryLockFromAttendancePayload,
} from './DashboardSalaryEnrollLock';

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

const BOX_STATUS_KEYS = {
    authorized_leave: ['authorized_leave'],
    unauthorized_leave: ['unauthorized_leave'],
    sick_leave: ['sick_leave'],
    compoff_leave: ['compoff_leave'],
    work_from_home: ['work_from_home'],
    late_group: ['late_arrived', 'early_go', 'mispunch'],
    annual_leave: ['on_leave'],
};

function shiftDateKey(dateKey, days) {
    const raw = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const [year, month, day] = raw.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(
        next.getUTCDate(),
    ).padStart(2, '0')}`;
}

function leaveSpansForBox(entries, boxKey) {
    const keys = new Set(BOX_STATUS_KEYS[boxKey] || []);
    const rows = (Array.isArray(entries) ? entries : []).filter((row) => keys.has(row?.statusKey));
    const grouped = new Map();
    const daily = [];
    const countOnly = [];

    for (const row of rows) {
        const groupId = String(row?.leaveRequestGroupId || '').trim();
        const date = String(row?.date || '').trim();
        const storedDays = Math.max(0, Number(row?.days) || 0);
        if (row?.countOnly || (!date && storedDays > 0)) {
            countOnly.push({
                type: row.statusKey === 'on_leave' ? 'Annual leave' : row.statusLabel || row.statusKey,
                statusKey: row.statusKey,
                startDate: '',
                endDate: '',
                days: storedDays || 1,
                source: row.source || 'Salary enrollment',
                leavePayType: row.leavePayType || '',
                reason: row.reason || '',
            });
            continue;
        }
        if (groupId) {
            const mapKey = `${groupId}|${row.statusKey}`;
            const existing = grouped.get(mapKey);
            if (!existing) {
                grouped.set(mapKey, {
                    type: row.statusKey === 'on_leave' ? 'Annual leave' : row.statusLabel || row.statusKey,
                    statusKey: row.statusKey,
                    startDate: date,
                    endDate: date,
                    fromDate: String(row.fromDate || date).trim(),
                    toDate: String(row.toDate || date).trim(),
                    days: storedDays || 1,
                    source: row.source || 'Attendance',
                    leavePayType: row.leavePayType || '',
                    reason: row.reason || '',
                });
            } else {
                if (date && (!existing.startDate || date < existing.startDate)) existing.startDate = date;
                if (date && date > existing.endDate) existing.endDate = date;
                if (!storedDays) existing.days += 1;
                if (row.fromDate && row.fromDate < existing.fromDate) existing.fromDate = row.fromDate;
                if (row.toDate && row.toDate > existing.toDate) existing.toDate = row.toDate;
                if (row.reason && !existing.reason) existing.reason = row.reason;
            }
            continue;
        }
        daily.push(row);
    }

    const spans = [...grouped.values()].map((row) => ({
        type: row.type,
        statusKey: row.statusKey,
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(row.fromDate) ? row.fromDate : row.startDate,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(row.toDate) ? row.toDate : row.endDate,
        days: row.days,
        source: row.source,
        leavePayType: row.leavePayType,
        reason: row.reason,
    }));

    const mergedDaily = [];
    const sortedDaily = [...daily].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    for (const row of sortedDaily) {
        const date = String(row.date || '').trim();
        const source = row.source || 'Attendance';
        const pay = row.leavePayType || '';
        const last = mergedDaily[mergedDaily.length - 1];
        if (
            last &&
            last.statusKey === row.statusKey &&
            last.leavePayType === pay &&
            last.source === source &&
            shiftDateKey(last.endDate, 1) === date
        ) {
            last.endDate = date;
            last.days += 1;
            if (row.reason && !last.reason) last.reason = row.reason;
            continue;
        }
        mergedDaily.push({
            type: row.statusKey === 'on_leave' ? 'Annual leave' : row.statusLabel || row.statusKey,
            statusKey: row.statusKey,
            startDate: date,
            endDate: date,
            days: 1,
            source,
            leavePayType: pay,
            reason: row.reason || '',
        });
    }

    return [...countOnly, ...spans, ...mergedDaily].sort((a, b) =>
        String(a.startDate).localeCompare(String(b.startDate)),
    );
}

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

function LeaveDetailModal({ open, title, period, rows, onClose }) {
    if (!open) return null;
    const showPay = rows.some((row) => row.leavePayType);
    const showReason = rows.some((row) => row.reason);
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
                            {rows.length} record{rows.length === 1 ? '' : 's'}
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
                        <table className="w-full min-w-[640px] text-left">
                            <thead className="sticky top-0 bg-white">
                                <tr className="border-b border-[#EEF2F6] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                    <th className="px-4 py-2.5 font-semibold">SL</th>
                                    <th className="px-4 py-2.5 font-semibold">Type</th>
                                    <th className="px-4 py-2.5 font-semibold">Start date</th>
                                    <th className="px-4 py-2.5 font-semibold">End date</th>
                                    <th className="px-4 py-2.5 font-semibold">Days</th>
                                    <th className="px-4 py-2.5 font-semibold">Source</th>
                                    {showPay ? <th className="px-4 py-2.5 font-semibold">Pay</th> : null}
                                    {showReason ? <th className="px-4 py-2.5 font-semibold">Reason</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={`${row.statusKey}-${row.startDate}-${index}`} className="border-b border-[#F1F5F9] last:border-0">
                                        <td className="px-4 py-2.5 text-[13px] tabular-nums text-[#64748B]">{index + 1}</td>
                                        <td className="px-4 py-2.5 text-[13px] font-semibold text-[#0F172A]">{row.type}</td>
                                        <td className="px-4 py-2.5 text-[13px] text-[#334155]">{formatLeaveDate(row.startDate)}</td>
                                        <td className="px-4 py-2.5 text-[13px] text-[#334155]">{formatLeaveDate(row.endDate)}</td>
                                        <td className="px-4 py-2.5 text-[13px] tabular-nums text-[#334155]">{row.days}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="inline-flex rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#475569]">
                                                {row.source}
                                            </span>
                                        </td>
                                        {showPay ? (
                                            <td className="px-4 py-2.5 text-[13px] capitalize text-[#64748B]">
                                                {row.leavePayType || '—'}
                                            </td>
                                        ) : null}
                                        {showReason ? (
                                            <td className="px-4 py-2.5 text-[13px] text-[#64748B]">{row.reason || '—'}</td>
                                        ) : null}
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
    const [filterKey, setFilterKey] = useState('current_month');
    const [customMonth, setCustomMonth] = useState(currentMonthKey);
    const [counts, setCounts] = useState(EMPTY_COUNTS);
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [leaveBalances, setLeaveBalances] = useState({});
    const [entries, setEntries] = useState([]);
    const [detailKey, setDetailKey] = useState('');
    const [salaryLock, setSalaryLock] = useState(EMPTY_SALARY_LOCK);

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
                    setEntries([]);
                    return;
                }
                setSalaryLock(EMPTY_SALARY_LOCK);
                setCounts({ ...EMPTY_COUNTS, ...(res.data.counts || {}) });
                setLeaveBalances(res.data.leaveBalances || {});
                setEntries(Array.isArray(res.data.entries) ? res.data.entries : []);
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
                    setSalaryLock(EMPTY_SALARY_LOCK);
                    setCounts(EMPTY_COUNTS);
                    setSummary(EMPTY_SUMMARY);
                    setLeaveBalances({});
                    setEntries([]);
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
        if (leaveBalances[key]?.taken != null) return n(leaveBalances[key].taken);
        return n(counts[key]);
    };

    const detailHint = (key) => {
        if (key === 'authorized_leave') {
            const paid = n(counts.authorized_leave_paid);
            const unpaid = n(counts.authorized_leave_unpaid);
            if (!paid && !unpaid) return '';
            return `Paid ${paid} · Unpaid ${unpaid}`;
        }
        if (key === 'sick_leave') {
            const remaining = leaveBalances.sick_leave?.remaining;
            return remaining == null ? '' : `${remaining} remaining this year`;
        }
        if (key === 'unauthorized_leave') {
            const deduction = leaveBalances.unauthorized_leave?.deductionDays;
            const multiplier = leaveBalances.unauthorized_leave?.multiplier;
            if (multiplier != null && Number(multiplier) !== 1) {
                return `Policy deduction ${deduction} days`;
            }
            return '';
        }
        if (key === 'annual_leave') {
            const remaining = leaveBalances.on_leave?.remaining;
            const last = summary.lastAnnualLeaveDate ? 'Last taken' : 'Not taken';
            return remaining == null ? last : `${remaining} remaining this year`;
        }
        return '';
    };

    const activeBox = DETAIL_BOXES.find((box) => box.key === detailKey) || null;
    const detailRows = useMemo(
        () => (detailKey ? leaveSpansForBox(entries, detailKey) : []),
        [detailKey, entries],
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
                        <button
                            key={box.key}
                            type="button"
                            onClick={() => setDetailKey(box.key)}
                            className={`rounded-xl px-2.5 py-2.5 min-w-0 min-h-[72px] flex flex-col justify-center text-left transition-transform hover:-translate-y-px hover:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${box.wrap}`}
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
                        </button>
                    );
                })}
            </div>
            <DashboardSalaryEnrollLock {...salaryLock} />
            <LeaveDetailModal
                open={Boolean(activeBox)}
                title={activeBox?.label || 'Leave details'}
                period={periodLabel(filterKey, customMonth)}
                rows={detailRows}
                onClose={() => setDetailKey('')}
            />
        </DashboardCard>
    );
}
