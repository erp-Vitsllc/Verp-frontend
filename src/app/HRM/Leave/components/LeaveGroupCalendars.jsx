'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    getDay,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { handleNavigateFromListClick } from '@/utils/listReturnNavigation';
import {
    GROUP_CALENDAR_DAY_STYLE,
    GROUP_CALENDAR_LEGEND,
    groupCalendarDayKind,
    groupCalendarDayLabel,
} from '../utils/groupCalendarDay';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function currentMonthKey() {
    return format(new Date(), 'yyyy-MM');
}

export function LeaveGroupPicker({ groups = [], activeKey = 'all', onSelect }) {
    return (
        <section>
            <h2 className="mb-2 text-sm font-bold text-[#1B2A4A]">Groups</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => {
                    const active = group.key === activeKey;
                    const preview = (group.names || []).slice(0, 3);
                    const extra = Math.max(0, (group.count || 0) - preview.length);
                    const people =
                        group.key === 'all'
                            ? 'Every employee'
                            : preview.length
                              ? `${preview.join(' · ')}${extra ? ` · +${extra}` : ''}`
                              : 'No employees';
                    return (
                        <button
                            key={group.key}
                            type="button"
                            onClick={() => onSelect?.(group.key)}
                            aria-pressed={active}
                            className={`rounded-xl border bg-white px-3.5 py-3 text-left shadow-sm transition ${
                                active
                                    ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
                                    : 'border-[#E6EDF5] hover:border-[#BFDBFE]'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#2563EB]">
                                    <Users size={15} />
                                </span>
                                <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#475569]">
                                    {group.count || 0}
                                </span>
                            </div>
                            <p className="mt-2 truncate text-[14px] font-bold text-[#1B2A4A]">{group.label}</p>
                            <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-[#64748B]">
                                {people}
                            </p>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

function MonthNavigator({ monthKey, onChange }) {
    const current = currentMonthKey();
    const anchor = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);
    const nextKey = format(addMonths(anchor, 1), 'yyyy-MM');

    return (
        <div className="relative flex h-9 items-center justify-center">
            <div className="inline-flex h-9 items-center rounded-lg border border-[#E6EDF5] bg-white">
                <button
                    type="button"
                    onClick={() => onChange?.(format(addMonths(anchor, -1), 'yyyy-MM'))}
                    className="inline-flex h-9 w-9 items-center justify-center text-[#64748B]"
                    aria-label="Previous month"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="min-w-[8rem] text-center text-[14px] font-semibold text-[#1B2A4A]">
                    {format(anchor, 'MMMM yyyy')}
                </span>
                <button
                    type="button"
                    onClick={() => onChange?.(nextKey)}
                    disabled={nextKey > current}
                    className="inline-flex h-9 w-9 items-center justify-center text-[#64748B] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next month"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
            <button
                type="button"
                onClick={() => onChange?.(current)}
                className="absolute right-0 h-9 rounded-lg border border-[#E6EDF5] bg-white px-3 text-[13px] font-semibold text-[#2563EB]"
            >
                Today
            </button>
        </div>
    );
}

function EmployeeMonthCalendar({ employee, monthKey, todayKey, holidayDates, offWeekdays }) {
    const router = useRouter();
    const anchor = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);
    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    });
    const href = `/HRM/Leave/${employee.id}`;
    const visibleFrom = String(employee.visibleFrom || '');

    return (
        <Link
            href={href}
            onClick={(event) => handleNavigateFromListClick(event, router, href)}
            className="block rounded-2xl border border-[#E6EDF5] bg-white px-3 py-3 shadow-sm transition hover:border-[#93C5FD] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
            aria-label={`Open attendance for ${employee.employeeName || 'employee'}`}
        >
            <div className="mb-2 flex items-start gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#2563EB]">
                    <CalendarDays size={16} strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-[#1B2A4A]">{employee.employeeName || 'Employee'}</p>
                    <p className="truncate text-[11px] font-medium text-[#64748B]">
                        {employee.employeeId || 'Attendance calendar'}
                    </p>
                </div>
            </div>
            <div className="mb-1.5 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="text-center text-[10px] font-medium text-[#94A3B8]">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const inMonth = dateKey.slice(0, 7) === monthKey;
                    const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                    const beforeStart = Boolean(visibleFrom) && dateKey < visibleFrom;
                    const kind = !inMonth
                        ? 'outside'
                        : groupCalendarDayKind(employee.days?.[dateKey], {
                              isFuture: dateKey > todayKey,
                              isToday: dateKey === todayKey,
                              isHoliday: holidayDates.has(dateKey),
                              isWeeklyOff: offWeekdays.has(weekdayKey),
                              beforeStart,
                          });
                    const label = inMonth ? groupCalendarDayLabel(kind) : '';
                    const tag = inMonth && !beforeStart ? String(employee.tags?.[dateKey] || '') : '';
                    const title = label
                        ? `${format(day, 'd MMMM yyyy')} · ${label}${tag ? ` · ${tag}` : ''}`
                        : undefined;
                    return (
                        <div
                            key={dateKey}
                            title={title}
                            className={`flex flex-col items-center justify-center rounded-[8px] text-[12px] font-semibold tabular-nums leading-none ${tag ? 'h-10' : 'h-9'} ${GROUP_CALENDAR_DAY_STYLE[kind] || GROUP_CALENDAR_DAY_STYLE.empty}`}
                        >
                            <span>{format(day, 'd')}</span>
                            {tag ? (
                                <span className="mt-0.5 max-w-full truncate px-px text-[6px] font-bold tracking-tight">
                                    {tag}
                                </span>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </Link>
    );
}

export default function LeaveGroupCalendarGrid({
    staffType,
    staffLabel = 'Group',
    monthKey,
    onMonthChange,
}) {
    const safeMonth = /^\d{4}-\d{2}$/.test(String(monthKey || '')) ? monthKey : currentMonthKey();
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!staffType || staffType === 'all') return undefined;
        let cancelled = false;
        setLoading(true);
        setError('');
        setPayload(null);
        axiosInstance
            .get('/Leave/group-calendars', {
                params: { month: safeMonth, staffType },
                skipToast: true,
            })
            .then((response) => {
                if (cancelled) return;
                setPayload(response.data || null);
            })
            .catch((err) => {
                if (cancelled) return;
                setPayload(null);
                setError(err?.response?.data?.message || err.message || 'Failed to load group calendars.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey, safeMonth, staffType]);

    const todayKey = payload?.today || format(new Date(), 'yyyy-MM-dd');
    const holidayDates = useMemo(
        () => new Set((payload?.holidays || []).map((row) => row.date).filter(Boolean)),
        [payload],
    );
    const offWeekdays = useMemo(
        () => new Set(Array.isArray(payload?.offWeekdays) ? payload.offWeekdays : ['saturday', 'sunday']),
        [payload],
    );
    const employees = Array.isArray(payload?.employees) ? payload.employees : [];

    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-[#F8FAFC] p-3">
            <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#2563EB]">
                    <CalendarDays size={16} strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-bold text-[#1B2A4A]">{staffLabel} attendance</h2>
                    <p className="text-[12px] font-medium text-[#64748B]">Click a calendar to open that employee&apos;s attendance.</p>
                </div>
            </div>
            <MonthNavigator monthKey={safeMonth} onChange={onMonthChange} />
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                {GROUP_CALENDAR_LEGEND.map((item) => (
                    <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${item.swatch}`} />
                        {item.label}
                    </span>
                ))}
            </div>
            {error ? (
                <div className="mt-3">
                    <ErpErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} />
                </div>
            ) : null}
            {loading ? (
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {[0, 1, 2].map((key) => (
                        <div key={key} className="h-64 animate-pulse rounded-2xl border border-[#E6EDF5] bg-white" />
                    ))}
                </div>
            ) : null}
            {!loading && !error && employees.length ? (
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {employees.map((employee) => (
                        <EmployeeMonthCalendar
                            key={employee.id}
                            employee={employee}
                            monthKey={safeMonth}
                            todayKey={todayKey}
                            holidayDates={holidayDates}
                            offWeekdays={offWeekdays}
                        />
                    ))}
                </div>
            ) : null}
            {!loading && !error && !employees.length ? (
                <p className="mt-4 rounded-xl border border-dashed border-[#E6EDF5] bg-white px-4 py-8 text-center text-sm text-[#64748B]">
                    No employees in this group.
                </p>
            ) : null}
        </section>
    );
}
