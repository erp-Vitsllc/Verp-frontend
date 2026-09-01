'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    startOfMonth,
} from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { holidayAppliesToStaff } from '@/utils/holidayScope';
import { normalizeWorkLocationKey } from '@/utils/workLocations';
import DashboardSalaryEnrollLock, {
    salaryLockFromAttendancePayload,
} from '@/app/dashboard/components/DashboardSalaryEnrollLock';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const TONE = {
    present: {
        cell: 'bg-[#E8F5E9] border-[#A5D6A7] text-[#2E7D32]',
        label: 'Present',
    },
    late: {
        cell: 'bg-[#FFF3E0] border-[#FFCC80] text-[#EF6C00]',
        label: 'Late',
    },
    leave: {
        cell: 'bg-[#F3E5F5] border-[#CE93D8] text-[#7B1FA2]',
        label: 'On leave',
    },
    wfh: {
        cell: 'bg-[#E3F2FD] border-[#90CAF9] text-[#1565C0]',
        label: 'WFH',
    },
    miss: {
        cell: 'bg-[#FFEBEE] border-[#EF9A9A] text-[#C62828]',
        label: 'Miss punch',
    },
    weekend: {
        cell: 'bg-[#EAF7F0] border-[#C5E6D4] text-[#6B8F7C]',
        label: 'Weekend',
    },
    empty: {
        cell: 'bg-white border-[#E6EAF0] text-[#64748B]',
        label: '',
    },
};

const LEGEND = [
    { key: 'present', label: 'Present', dot: 'bg-[#34C759]' },
    { key: 'late', label: 'Late', dot: 'bg-[#FF9500]' },
    { key: 'leave', label: 'On leave', dot: 'bg-[#AF52DE]' },
    { key: 'wfh', label: 'WFH', dot: 'bg-[#007AFF]' },
    { key: 'miss', label: 'Miss punch', dot: 'bg-[#FF3B30]' },
    { key: 'weekend', label: 'Weekend', dot: 'bg-[#C7CDD6]' },
];

const LEAVE_CHIPS = {
    on_leave: 'AL',
    authorized_leave: 'AUT',
    unauthorized_leave: 'UA',
    sick_leave: 'SL',
    compoff_leave: 'CO',
};

function getDubaiDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function formatClock(value) {
    if (!value) return '';
    const text = String(value).trim();
    if (/^\d{2}:\d{2}/.test(text)) return text.slice(0, 5);
    return text;
}

function mondayLeadingBlanks(anchor) {
    const sundayIndex = getDay(startOfMonth(anchor));
    return (sundayIndex + 6) % 7;
}

function punchTime(record) {
    return formatClock(record?.timeIn) || formatClock(record?.timeOut);
}

function dayTone(record, { isFuture, isHoliday, isWeeklyOff }) {
    const key = String(record?.statusKey || '');
    if (key === 'work_from_home') return { ...TONE.wfh, chipText: 'WFH' };
    if (key === 'late_arrived') {
        const time = punchTime(record);
        return { ...TONE.late, chipText: time ? `LATE ${time}` : 'LATE' };
    }
    if (key === 'early_go') {
        const time = punchTime(record);
        return { ...TONE.late, chipText: time ? `EG ${time}` : 'EG' };
    }
    if (key === 'mispunch') {
        return { ...TONE.miss, chipText: 'MP' };
    }
    if (LEAVE_CHIPS[key]) {
        return { ...TONE.leave, chipText: LEAVE_CHIPS[key] };
    }
    if (key === 'on_office') {
        return { ...TONE.present, chipText: punchTime(record) };
    }
    if (isHoliday || key === 'holiday') {
        return { ...TONE.miss, chipText: '' };
    }
    if (isWeeklyOff || key === 'weekly_off') {
        return { ...TONE.weekend, chipText: '' };
    }
    if (isFuture || !record) return { ...TONE.empty, chipText: '' };
    if (record?.timeIn && !record?.timeOut) {
        return { ...TONE.miss, chipText: 'MP' };
    }
    return { ...TONE.empty, chipText: '' };
}

function monthOptions(year) {
    return Array.from({ length: 12 }, (_, index) => {
        const date = new Date(year, index, 1);
        return {
            value: format(date, 'yyyy-MM'),
            label: format(date, 'MMMM yyyy'),
        };
    });
}

export default function EmployeeOverviewAttendanceCard({ employeeMongoId, year }) {
    const todayKey = getDubaiDateKey();
    const currentYear = Number(String(todayKey).slice(0, 4));
    const selectedYear = Number(year) || currentYear;

    const [monthAnchor, setMonthAnchor] = useState(() => {
        if (selectedYear === currentYear) return startOfMonth(new Date(`${todayKey}T12:00:00`));
        return new Date(selectedYear, 0, 1);
    });
    const [recordsByDate, setRecordsByDate] = useState({});
    const [offWeekdays, setOffWeekdays] = useState(() => new Set(['saturday', 'sunday']));
    const [staffType, setStaffType] = useState('office');
    const [holidayRows, setHolidayRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [salaryLocked, setSalaryLocked] = useState(false);
    const [salaryLockMessage, setSalaryLockMessage] = useState('');

    useEffect(() => {
        if (selectedYear === currentYear) {
            setMonthAnchor(startOfMonth(new Date(`${todayKey}T12:00:00`)));
            return;
        }
        setMonthAnchor(new Date(selectedYear, 0, 1));
    }, [selectedYear, currentYear, todayKey]);

    const monthKey = format(monthAnchor, 'yyyy-MM');
    const monthYear = monthAnchor.getFullYear();

    const { holidayDates, holidayNamesByDate } = useMemo(() => {
        const dates = new Set();
        const names = {};
        holidayRows.forEach((row) => {
            if (!row?.date || !holidayAppliesToStaff(row, staffType)) return;
            dates.add(row.date);
            names[row.date] = row.name || row.note || 'Holiday';
        });
        return { holidayDates: dates, holidayNamesByDate: names };
    }, [holidayRows, staffType]);

    const loadMonth = useCallback(async () => {
        if (!employeeMongoId) return;
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/Attendance/me', {
                params: { month: monthKey, forEmployeeId: employeeMongoId },
                skipToast: true,
            });
            const map = {};
            (response.data?.records || []).forEach((row) => {
                map[row.date] = row;
            });
            setRecordsByDate(map);
            setStaffType(normalizeWorkLocationKey(response.data?.employee?.staffType));
            setOffWeekdays(
                new Set(
                    Array.isArray(response.data?.offWeekdays)
                        ? response.data.offWeekdays
                        : ['saturday', 'sunday'],
                ),
            );
            const lock = salaryLockFromAttendancePayload(response.data);
            setSalaryLocked(lock.locked);
            setSalaryLockMessage(lock.message);
        } catch (err) {
            setRecordsByDate({});
            if (err?.response?.data?.salaryEnrolled === false || err?.response?.data?.attendanceLocked) {
                const lock = salaryLockFromAttendancePayload(err.response.data);
                setSalaryLocked(true);
                setSalaryLockMessage(lock.message);
                setError('');
            } else {
                setSalaryLocked(false);
                setSalaryLockMessage('');
                setError(err?.response?.data?.message || 'Could not load attendance.');
            }
        } finally {
            setLoading(false);
        }
    }, [employeeMongoId, monthKey]);

    const loadHolidays = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Holiday', {
                params: { year: monthYear },
                skipToast: true,
            });
            setHolidayRows(Array.isArray(response.data?.holidays) ? response.data.holidays : []);
        } catch {
            setHolidayRows([]);
        }
    }, [monthYear]);

    useEffect(() => {
        loadMonth();
        loadHolidays();
    }, [loadMonth, loadHolidays]);

    const days = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(monthAnchor),
            end: endOfMonth(monthAnchor),
        });
    }, [monthAnchor]);

    const monthStats = useMemo(() => {
        const stats = { present: 0, leave: 0, late: 0, wfh: 0 };
        days.forEach((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const record = recordsByDate[dateKey];
            const key = String(record?.statusKey || '');
            if (key === 'on_office') stats.present += 1;
            else if (key === 'work_from_home') stats.wfh += 1;
            else if (key === 'late_arrived' || key === 'early_go') stats.late += 1;
            else if (LEAVE_CHIPS[key]) stats.leave += 1;
        });
        return stats;
    }, [days, recordsByDate]);

    const canGoPrev = monthYear > selectedYear || monthAnchor.getMonth() > 0;
    const canGoNext = monthYear < selectedYear || monthAnchor.getMonth() < 11;
    const options = monthOptions(selectedYear);

    const shiftMonth = (delta) => {
        setMonthAnchor((current) => {
            const next = addMonths(current, delta);
            if (next.getFullYear() < selectedYear || next.getFullYear() > selectedYear) return current;
            return next;
        });
    };

    return (
        <div
            className={`rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden h-full flex flex-col relative ${
                salaryLocked
                    ? 'bg-slate-100 border-slate-200'
                    : 'bg-white border-[#E6EAF0]'
            }`}
        >
            <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between gap-3">
                <div>
                    <h2
                        className={`text-[15px] font-bold tracking-tight ${
                            salaryLocked ? 'text-slate-400' : 'text-[#1B2A4A]'
                        }`}
                    >
                        My attendance
                    </h2>
                    <p className="text-[11px] text-[#8B95A7] mt-0.5">
                        {salaryLocked
                            ? 'Attendance unlocks after salary enrollment'
                            : 'Requests and approvals update each calendar date'}
                    </p>
                </div>
                <div
                    className={`inline-flex h-8 items-center rounded-lg border shrink-0 ${
                        salaryLocked
                            ? 'border-slate-200 bg-slate-50 pointer-events-none opacity-50'
                            : 'border-[#D9DEE7] bg-white'
                    }`}
                >
                    <button
                        type="button"
                        disabled={salaryLocked || !canGoPrev}
                        onClick={() => shiftMonth(-1)}
                        className="h-8 w-7 inline-flex items-center justify-center text-[#64748B] hover:bg-slate-50 disabled:opacity-40 rounded-l-lg"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <div className="relative min-w-[124px] border-x border-[#D9DEE7]">
                        <select
                            value={monthKey}
                            disabled={salaryLocked}
                            onChange={(event) => {
                                const [nextYear, nextMonth] = event.target.value.split('-').map(Number);
                                setMonthAnchor(new Date(nextYear, nextMonth - 1, 1));
                            }}
                            className="h-8 w-full appearance-none bg-transparent pl-2 pr-6 text-[12px] font-semibold text-[#1B2A4A] outline-none cursor-pointer disabled:cursor-not-allowed"
                        >
                            {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={13}
                            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8B95A7]"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={salaryLocked || !canGoNext}
                        onClick={() => shiftMonth(1)}
                        className="h-8 w-7 inline-flex items-center justify-center text-[#64748B] hover:bg-slate-50 disabled:opacity-40 rounded-r-lg"
                        aria-label="Next month"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            <div
                className={`flex-1 flex flex-col min-h-0 ${
                    salaryLocked ? 'grayscale opacity-40 pointer-events-none select-none' : ''
                }`}
            >
            <div className="grid grid-cols-4 gap-2 px-4 pb-2.5">
                {[
                    { label: 'Present', value: monthStats.present },
                    { label: 'On leave', value: monthStats.leave },
                    { label: 'Late', value: monthStats.late },
                    { label: 'WFH', value: monthStats.wfh },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-lg border border-[#E6EAF0] bg-[#F7F8FA] px-2.5 py-1.5"
                    >
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8B95A7]">
                            {stat.label}
                        </p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums leading-none text-[#1B2A4A]">
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="px-4 pb-2 flex-1">
                {error ? (
                    <div className="py-10 text-center">
                        <p className="text-xs text-red-500">{error}</p>
                        <button
                            type="button"
                            onClick={loadMonth}
                            className="mt-2 text-xs font-semibold text-sky-600 hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : loading ? (
                    <p className="py-10 text-center text-sm text-slate-400">Loading calendar…</p>
                ) : (
                    <>
                        <div className="grid grid-cols-7 gap-1.5 mb-1">
                            {WEEKDAYS.map((day) => (
                                <div
                                    key={day}
                                    className="text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8B95A7]"
                                >
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1.5">
                            {Array.from({ length: mondayLeadingBlanks(monthAnchor) }).map((_, index) => (
                                <div key={`blank-${index}`} />
                            ))}
                            {days.map((day) => {
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                                const record = recordsByDate[dateKey];
                                const isHoliday = holidayDates.has(dateKey) || record?.statusKey === 'holiday';
                                const isWeeklyOff =
                                    !isHoliday &&
                                    (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
                                const isFuture = dateKey > todayKey;
                                const tone = salaryLocked
                                    ? { ...TONE.empty, chipText: '', label: '' }
                                    : dayTone(record, { isFuture, isHoliday, isWeeklyOff });
                                const pending = !salaryLocked && record?.leaveRequestStatus === 'pending';
                                const title = [
                                    format(day, 'd MMM yyyy'),
                                    tone.label,
                                    holidayNamesByDate[dateKey],
                                    pending ? 'Request pending' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' · ');

                                return (
                                    <div
                                        key={dateKey}
                                        title={title}
                                        className={`relative h-[42px] rounded-md border px-1.5 py-1 flex flex-col justify-between overflow-hidden ${tone.cell}`}
                                    >
                                        <span className="self-end text-[11px] font-semibold tabular-nums leading-none">
                                            {format(day, 'd')}
                                        </span>
                                        <span className="text-[9px] font-bold leading-none tracking-wide truncate">
                                            {tone.chipText || '\u00A0'}
                                        </span>
                                        {pending ? (
                                            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 border border-white" />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1">
                {LEGEND.map((item) => (
                    <span
                        key={item.key}
                        className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#64748B]"
                    >
                        <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                        {item.label}
                    </span>
                ))}
            </div>
            </div>

            <DashboardSalaryEnrollLock locked={salaryLocked} message={salaryLockMessage} />
        </div>
    );
}
