'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    addDays,
    addMonths,
    addWeeks,
    addYears,
    eachDayOfInterval,
    eachMonthOfInterval,
    endOfMonth,
    endOfWeek,
    endOfYear,
    format,
    isAfter,
    isSameDay,
    isSameMonth,
    isToday,
    startOfDay,
    startOfMonth,
    startOfWeek,
    startOfYear,
    subMonths,
    subWeeks,
    subYears,
} from 'date-fns';
import {
    ChevronLeft,
    ChevronRight,
    Users,
    UserCheck,
    Plane,
    Clock,
    Stethoscope,
    Home,
    UserMinus,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AttendanceDayDetailPanel, { emptyDayDetailStats } from './AttendanceDayDetailPanel';

const VIEW_OPTIONS = ['Day', 'Week', 'Month', 'Year'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ICON_LEGEND = [
    { key: 'total', icon: Users, label: 'Total staff', iconClass: 'text-slate-700' },
    { key: 'present', icon: UserCheck, label: 'Present', iconClass: 'text-blue-600' },
    { key: 'onLeave', icon: Plane, label: 'On leave', iconClass: 'text-indigo-700' },
    { key: 'late', icon: Clock, label: 'Late arrival', iconClass: 'text-amber-700' },
    { key: 'sick', icon: Stethoscope, label: 'Sick leave', iconClass: 'text-red-600' },
    { key: 'wfh', icon: Home, label: 'Work from home', iconClass: 'text-blue-700' },
    { key: 'notMarked', icon: UserMinus, label: 'Not marked / Unauthorized', iconClass: 'text-gray-500' },
];

function emptyDayAttendanceStats(strengthCount = 0) {
    const total = Number(strengthCount) || 0;
    return {
        activeEmployees: total,
        present: 0,
        onLeave: 0,
        lateArrived: 0,
        sickLeave: 0,
        workFromHome: 0,
        notMarked: 0,
        holiday: 0,
        weeklyOff: 0,
        isWeeklyOff: false,
        officePresent: 0,
        officeTotal: total,
        sitePresent: 0,
        siteTotal: 0,
        totalPresent: 0,
        absentAuthorized: 0,
        absentUnauthorized: 0,
        totalStaff: total,
    };
}

function mapApiDayStats(raw, strengthCount = 0) {
    if (!raw || typeof raw !== 'object') return emptyDayAttendanceStats(strengthCount);
    const total = Number(raw.activeEmployees ?? raw.totalStaff ?? strengthCount) || 0;
    const notMarked = Number(raw.notMarked) || 0;
    return {
        activeEmployees: total,
        present: Number(raw.present) || 0,
        onLeave: Number(raw.onLeave) || 0,
        lateArrived: Number(raw.lateArrived) || 0,
        sickLeave: Number(raw.sickLeave) || 0,
        workFromHome: Number(raw.workFromHome) || 0,
        notMarked,
        holiday: Number(raw.holiday) || 0,
        weeklyOff: Number(raw.weeklyOff) || 0,
        isWeeklyOff: Boolean(raw.isWeeklyOff),
        officePresent: Number(raw.officePresent) || 0,
        officeTotal: Number(raw.officeTotal ?? total) || 0,
        sitePresent: Number(raw.sitePresent) || 0,
        siteTotal: Number(raw.siteTotal) || 0,
        totalPresent: Number(raw.totalPresent) || 0,
        absentAuthorized: Number(raw.absentAuthorized) || 0,
        // Unauthorized and not marked share the same count.
        absentUnauthorized: notMarked,
        totalStaff: total,
    };
}

function IconCount({ icon: Icon, count, label, iconClass = 'text-gray-500', countFirst = false, large = false }) {
    const value = Number(count) || 0;
    if (value === 0) return null;

    const iconEl = (
        <Icon
            className={`${large ? 'h-4 w-4 sm:h-[18px] sm:w-[18px]' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} shrink-0 ${iconClass}`}
            strokeWidth={1.75}
            aria-hidden
        />
    );
    const countEl = (
        <span
            className={`${
                large ? 'text-sm sm:text-base lg:text-lg' : 'text-[11px] sm:text-xs lg:text-sm'
            } font-medium text-gray-600 tabular-nums leading-none no-underline`}
        >
            {value}
        </span>
    );

    return (
        <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 min-w-0 cursor-default no-underline text-inherit">
                    {countFirst ? (
                        <>
                            {countEl}
                            {iconEl}
                        </>
                    ) : (
                        <>
                            {iconEl}
                            {countEl}
                        </>
                    )}
                </span>
            </TooltipTrigger>
            <TooltipContent
                side="top"
                className="bg-gray-900 text-white border-gray-900 text-xs font-medium px-2.5 py-1.5"
            >
                {label}
            </TooltipContent>
        </Tooltip>
    );
}

function IconLegend() {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
            {ICON_LEGEND.map((item) => (
                <div key={item.key} className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-600">
                    <item.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${item.iconClass}`} strokeWidth={2} />
                    <span className="font-medium whitespace-nowrap">{item.label}</span>
                </div>
            ))}
        </div>
    );
}

function getMonthGridDays(anchorDate) {
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

function getWeekDays(anchorDate) {
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

/** Month cell: date top-right + evenly spaced icon stats (no underlines). */
function DayCellStats({ day, today, inMonth, isFuture, stats }) {
    if (isFuture) {
        return (
            <div className="h-full w-full flex flex-col p-2 sm:p-2.5">
                <div className="flex justify-end shrink-0">
                    <span className="text-sm sm:text-base font-normal text-gray-300 tabular-nums leading-none">
                        {day.getDate()}
                    </span>
                </div>
            </div>
        );
    }

    if (stats?.isWeeklyOff) {
        return (
            <div className="h-full w-full flex flex-col p-2 sm:p-2.5 overflow-hidden bg-[#9B59B6]/10">
                <div className="flex justify-end shrink-0">
                    {today ? (
                        <span className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-600 text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center tabular-nums">
                            {day.getDate()}
                        </span>
                    ) : (
                        <span
                            className={`text-sm sm:text-base font-normal tabular-nums leading-none ${
                                inMonth ? 'text-gray-900' : 'text-gray-500'
                            }`}
                        >
                            {day.getDate()}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#9B59B6]" />
                    <span className="text-[10px] sm:text-xs font-bold text-[#9B59B6] uppercase tracking-wider">
                        Off Day
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                        {stats.activeEmployees || 0} staff
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col p-2 sm:p-2.5 overflow-hidden">
            {/* Date — top right, left empty */}
            <div className="flex justify-end shrink-0">
                {today ? (
                    <span className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-600 text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center tabular-nums">
                        {day.getDate()}
                    </span>
                ) : (
                    <span
                        className={`text-sm sm:text-base font-normal tabular-nums leading-none ${
                            inMonth ? 'text-gray-900' : 'text-gray-500'
                        }`}
                    >
                        {day.getDate()}
                    </span>
                )}
            </div>

            {/* Data rows — hide icon/count when 0; hide whole row if all zero */}
            <div className="flex-1 min-h-0 flex flex-col justify-evenly gap-1 py-1">
                {(stats.activeEmployees > 0 || stats.present > 0) && (
                    <div className="flex items-center justify-between gap-2 px-0.5">
                        <IconCount
                            icon={Users}
                            count={stats.activeEmployees}
                            label="Total staff"
                            iconClass="text-slate-600"
                            large
                        />
                        <IconCount
                            icon={UserCheck}
                            count={stats.present}
                            label="Present"
                            iconClass="text-blue-600"
                            countFirst
                            large
                        />
                    </div>
                )}

                {(stats.onLeave > 0 || stats.lateArrived > 0 || stats.sickLeave > 0) && (
                    <div className="flex items-center justify-between gap-1 px-0.5">
                        <IconCount
                            icon={Plane}
                            count={stats.onLeave}
                            label="On leave"
                            iconClass="text-indigo-700"
                        />
                        <IconCount
                            icon={Clock}
                            count={stats.lateArrived}
                            label="Late arrival"
                            iconClass="text-amber-700"
                        />
                        <IconCount
                            icon={Stethoscope}
                            count={stats.sickLeave}
                            label="Sick leave"
                            iconClass="text-red-600"
                            countFirst
                        />
                    </div>
                )}

                {(stats.workFromHome > 0 || stats.notMarked > 0) && (
                    <div className="flex items-center justify-between gap-2 px-0.5">
                        <IconCount
                            icon={Home}
                            count={stats.workFromHome}
                            label="Work from home"
                            iconClass="text-blue-700"
                        />
                        <IconCount
                            icon={UserMinus}
                            count={stats.notMarked}
                            label="Not marked / Unauthorized"
                            iconClass="text-gray-500"
                            countFirst
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/** Compact cell (year view): date only. */
function DayCellDate({ day, today, inMonth, isFuture, compact = false }) {
    return (
        <div className={`flex justify-end h-full ${compact ? 'p-0.5' : 'p-1 sm:p-1.5'}`}>
            <span
                className={`inline-flex items-center justify-center leading-none tabular-nums ${
                    compact ? 'text-[10px] font-medium' : 'text-xs sm:text-sm font-medium'
                } ${
                    today
                        ? `${compact ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 sm:h-6 sm:w-6'} rounded-full bg-blue-600 text-white`
                        : isFuture
                          ? 'text-gray-300'
                          : inMonth
                            ? 'text-gray-900'
                            : 'text-gray-500'
                }`}
            >
                {day.getDate()}
            </span>
        </div>
    );
}

/** Week view: date + weekday; details open in the modal on click. */
function DayStatsRow({ day, selected }) {
    const today = isToday(day);
    const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));

    return (
        <div
            className={`h-full w-full flex items-center gap-3 sm:gap-5 px-3 sm:px-4 transition-colors ${
                isFuture
                    ? 'bg-gray-50'
                    : selected && !today
                      ? 'bg-blue-50/40'
                      : 'bg-white'
            }`}
        >
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {today ? (
                    <span className="h-7 w-7 text-sm bg-blue-600 text-white font-medium inline-flex items-center justify-center shrink-0">
                        {day.getDate()}
                    </span>
                ) : (
                    <span
                        className={`font-medium tabular-nums w-7 text-center shrink-0 text-base sm:text-lg ${
                            isFuture ? 'text-gray-300' : 'text-gray-700'
                        }`}
                    >
                        {day.getDate()}
                    </span>
                )}
                <span
                    className={`font-medium truncate text-sm sm:text-base ${
                        isFuture ? 'text-gray-300' : 'text-gray-500'
                    }`}
                >
                    {format(day, 'EEE')}
                </span>
            </div>
        </div>
    );
}

function DayStatsPanel({ day, compact = false }) {
    const today = isToday(day);
    const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));

    return (
        <div
            className={`h-full w-full bg-white flex flex-col items-center justify-center overflow-hidden ${
                compact ? 'p-1.5 sm:p-2' : 'p-4 sm:p-6'
            } ${isFuture ? 'bg-gray-50 opacity-60' : ''}`}
        >
            <span
                className={`font-medium text-gray-500 mb-2 ${
                    compact ? 'text-[10px] sm:text-xs' : 'text-base sm:text-lg'
                }`}
            >
                {compact ? format(day, 'EEE') : format(day, 'EEEE')}
            </span>
            {today ? (
                <span
                    className={`bg-blue-600 text-white font-medium inline-flex items-center justify-center ${
                        compact ? 'h-8 w-8 text-sm' : 'h-14 w-14 sm:h-16 sm:w-16 text-2xl sm:text-3xl'
                    }`}
                >
                    {day.getDate()}
                </span>
            ) : (
                <span
                    className={`font-medium text-gray-700 tabular-nums ${
                        compact ? 'text-xl sm:text-2xl' : 'text-5xl sm:text-6xl'
                    }`}
                >
                    {day.getDate()}
                </span>
            )}
            {!compact && !isFuture ? (
                <p className="mt-4 text-sm text-gray-400">Click for attendance details</p>
            ) : null}
        </div>
    );
}

function MonthGrid({
    cursorDate,
    selectedDate,
    strengthCount = 0,
    dayStatsByDate = {},
    onSelectDay,
    compact = false,
}) {
    const days = useMemo(() => getMonthGridDays(cursorDate), [cursorDate]);
    const weekCount = Math.max(1, Math.ceil(days.length / 7));

    return (
        <div className={`border-t border-gray-200 overflow-x-hidden overflow-y-auto flex flex-col min-h-0 ${compact ? '' : 'flex-1'}`}>
            <div className="grid grid-cols-7 border-b border-gray-200 shrink-0">
                {WEEKDAYS.map((label) => (
                    <div
                        key={label}
                        className={`text-center font-semibold uppercase tracking-wide text-gray-500 border-r border-gray-200 [&:nth-child(7n)]:border-r-0 ${
                            compact ? 'px-1 py-1 text-[10px]' : 'px-2 py-2.5 text-[11px] sm:text-xs'
                        }`}
                    >
                        {compact ? label.charAt(0) : label}
                    </div>
                ))}
            </div>

            <div
                className={`grid grid-cols-7 min-h-0 ${compact ? '' : 'flex-1'}`}
                style={
                    compact
                        ? undefined
                        : { gridTemplateRows: `repeat(${weekCount}, minmax(148px, 1fr))` }
                }
            >
                {days.map((day) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const inMonth = isSameMonth(day, cursorDate);
                    const today = isToday(day);
                    const selected = isSameDay(day, selectedDate);
                    const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));
                    const stats = dayStatsByDate[dayKey] || emptyDayAttendanceStats(strengthCount);

                    return (
                        <div
                            key={dayKey}
                            className={`relative w-full border-r border-b border-gray-200 [&:nth-child(7n)]:border-r-0 ${
                                compact ? 'aspect-square' : 'min-h-[148px] h-full'
                            }`}
                        >
                            <button
                                type="button"
                                disabled={isFuture}
                                onClick={() => {
                                    if (isFuture) return;
                                    onSelectDay(day);
                                }}
                                className={`absolute inset-0 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 p-0 ${
                                    isFuture
                                        ? 'bg-gray-50 cursor-not-allowed'
                                        : inMonth
                                          ? 'bg-white hover:bg-gray-50'
                                          : 'bg-[#f7f7f8] hover:bg-gray-50'
                                } ${selected && !today && !isFuture ? 'bg-blue-50/60' : ''}`}
                            >
                                {compact ? (
                                    <DayCellDate
                                        day={day}
                                        today={today}
                                        inMonth={inMonth}
                                        isFuture={isFuture}
                                        compact
                                    />
                                ) : (
                                    <DayCellStats
                                        day={day}
                                        today={today}
                                        inMonth={inMonth}
                                        isFuture={isFuture}
                                        stats={stats}
                                    />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function AttendanceMonthCalendar({ staffType = null }) {
    const [view, setView] = useState('Month');
    const [cursorDate, setCursorDate] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [strengthCount, setStrengthCount] = useState(0);
    const [detailDay, setDetailDay] = useState(() => new Date());
    const [dayStatsByDate, setDayStatsByDate] = useState({});

    const fetchRange = useMemo(() => {
        if (view === 'Week') {
            const days = getWeekDays(cursorDate);
            return {
                from: format(days[0], 'yyyy-MM-dd'),
                to: format(days[days.length - 1], 'yyyy-MM-dd'),
            };
        }
        if (view === 'Day') {
            const key = format(cursorDate, 'yyyy-MM-dd');
            return { from: key, to: key };
        }
        if (view === 'Year') {
            return {
                from: format(startOfYear(cursorDate), 'yyyy-MM-dd'),
                to: format(endOfYear(cursorDate), 'yyyy-MM-dd'),
            };
        }
        const gridDays = getMonthGridDays(cursorDate);
        return {
            from: format(gridDays[0], 'yyyy-MM-dd'),
            to: format(gridDays[gridDays.length - 1], 'yyyy-MM-dd'),
        };
    }, [cursorDate, view]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const params = {
                    from: fetchRange.from,
                    to: fetchRange.to,
                    month: format(cursorDate, 'yyyy-MM'),
                };
                if (staffType === 'site' || staffType === 'office') {
                    params.staffType = staffType;
                }
                const res = await axiosInstance.get('/Attendance/calendar', {
                    params,
                    skipToast: true,
                });
                const total = Number(res.data?.totalStaff) || 0;
                const daysPayload =
                    res.data?.days && typeof res.data.days === 'object' ? res.data.days : {};
                const mapped = {};
                for (const [dateKey, raw] of Object.entries(daysPayload)) {
                    mapped[dateKey] = mapApiDayStats(raw, total);
                }
                if (!cancelled) {
                    setStrengthCount(total);
                    setDayStatsByDate(mapped);
                }
            } catch {
                if (!cancelled) {
                    setDayStatsByDate({});
                }
            }
        };
        load();
        const onWorkingTime = () => load();
        const onHolidays = () => load();
        window.addEventListener('verp:working-time-changed', onWorkingTime);
        window.addEventListener('verp:holidays-changed', onHolidays);
        return () => {
            cancelled = true;
            window.removeEventListener('verp:working-time-changed', onWorkingTime);
            window.removeEventListener('verp:holidays-changed', onHolidays);
        };
    }, [fetchRange.from, fetchRange.to, cursorDate, staffType]);

    const weekDays = useMemo(() => getWeekDays(cursorDate), [cursorDate]);
    const yearMonths = useMemo(() => {
        const start = startOfYear(cursorDate);
        const end = endOfYear(cursorDate);
        return eachMonthOfInterval({ start, end });
    }, [cursorDate]);

    const detailStats = useMemo(() => {
        if (!detailDay) return emptyDayDetailStats(strengthCount);
        const key = format(detailDay, 'yyyy-MM-dd');
        const fromApi = dayStatsByDate[key];
        if (!fromApi) return emptyDayDetailStats(strengthCount);

        const hasMarkedActivity =
            (fromApi.present || 0) > 0 ||
            (fromApi.onLeave || 0) > 0 ||
            (fromApi.lateArrived || 0) > 0 ||
            (fromApi.sickLeave || 0) > 0 ||
            (fromApi.workFromHome || 0) > 0 ||
            (fromApi.notMarked || 0) > 0 ||
            (fromApi.weeklyOff || 0) > 0 ||
            (fromApi.holiday || 0) > 0 ||
            Boolean(fromApi.isWeeklyOff);

        // Day with no marks yet — detail treats everyone as not marked / unauthorized.
        if (!hasMarkedActivity && strengthCount > 0) {
            return emptyDayDetailStats(strengthCount);
        }
        return fromApi;
    }, [detailDay, dayStatsByDate, strengthCount]);

    const title = useMemo(() => {
        if (view === 'Day') return format(cursorDate, 'EEEE, d MMMM yyyy');
        if (view === 'Week') {
            const weekStart = startOfWeek(cursorDate, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(cursorDate, { weekStartsOn: 1 });
            return `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM yyyy')}`;
        }
        if (view === 'Year') return format(cursorDate, 'yyyy');
        return format(cursorDate, 'MMMM yyyy');
    }, [cursorDate, view]);

    const goToday = () => {
        const now = new Date();
        setCursorDate(now);
        setSelectedDate(now);
        setDetailDay(now);
    };

    const goPrev = () => {
        if (view === 'Day') setCursorDate((d) => addDays(d, -1));
        else if (view === 'Week') setCursorDate((d) => subWeeks(d, 1));
        else if (view === 'Year') setCursorDate((d) => subYears(d, 1));
        else setCursorDate((d) => subMonths(d, 1));
    };

    const goNext = () => {
        if (view === 'Day') setCursorDate((d) => addDays(d, 1));
        else if (view === 'Week') setCursorDate((d) => addWeeks(d, 1));
        else if (view === 'Year') setCursorDate((d) => addYears(d, 1));
        else setCursorDate((d) => addMonths(d, 1));
    };

    const openDayDetail = (day) => {
        setSelectedDate(day);
        setCursorDate(day);
        setDetailDay(day);
    };

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch w-full">
                <div className="w-full lg:w-3/4 min-w-0">
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden flex flex-col min-w-0 w-full relative z-0">
                {/* Title */}
                <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                        Attendance Calendar
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Track presence, leave, sick days, and remote work across your team.
                    </p>
                </div>

                {/* Day / Week / Month / Year — keep existing style */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-2 border-y border-gray-200 bg-gray-50 shrink-0">
                    <div className="flex items-center justify-center sm:justify-start">
                        <div className="inline-flex items-center bg-gray-100 p-0.5">
                            {VIEW_OPTIONS.map((option) => {
                                const active = view === option;
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setView(option)}
                                        className={`px-3 sm:px-4 py-1.5 text-sm font-medium transition-colors ${
                                            active
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={goPrev}
                                className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                                aria-label="Previous"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="min-w-[7.5rem] text-center text-sm font-semibold text-gray-800 px-1">
                                {title}
                            </span>
                            <button
                                type="button"
                                onClick={goNext}
                                className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                                aria-label="Next"
                            >
                                <ChevronRight size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={goToday}
                                className="h-8 px-3 ml-1 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                Today
                            </button>
                        </div>
                </div>

                {/* Icon legend — full meanings */}
                <IconLegend />

                {/* Views */}
                {view === 'Month' && (
                    <MonthGrid
                    cursorDate={cursorDate}
                    selectedDate={selectedDate}
                    strengthCount={strengthCount}
                    dayStatsByDate={dayStatsByDate}
                    onSelectDay={openDayDetail}
                />
                )}

                {view === 'Week' && (
                    <div className="border-t border-gray-200 flex flex-col flex-1 min-h-0">
                        {weekDays.map((day) => {
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));

                            return (
                                <div
                                    key={dayKey}
                                    className="relative flex-1 min-h-0 border-b border-gray-200 last:border-b-0"
                                >
                                    <button
                                        type="button"
                                        disabled={isFuture}
                                        onClick={() => {
                                            if (isFuture) return;
                                            openDayDetail(day);
                                        }}
                                        className="absolute inset-0 text-left disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                    >
                                        <DayStatsRow
                                            day={day}
                                            selected={isSameDay(day, selectedDate)}
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {view === 'Day' && (
                    <div
                        className="border-t border-gray-200 flex-1 min-h-0 flex cursor-pointer"
                        onClick={() => openDayDetail(cursorDate)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openDayDetail(cursorDate);
                            }
                        }}
                        role="button"
                        tabIndex={0}
                    >
                        <DayStatsPanel day={cursorDate} />
                    </div>
                )}

                {view === 'Year' && (
                    <div className="border-t border-gray-200 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto">
                        {yearMonths.map((monthDate) => (
                            <div key={format(monthDate, 'yyyy-MM')} className="border border-gray-200 bg-white">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCursorDate(monthDate);
                                        setView('Month');
                                    }}
                                    className="w-full text-left px-3 py-2 border-b border-gray-200 hover:bg-gray-50"
                                >
                                    <span className="text-sm font-bold text-gray-800">
                                        {format(monthDate, 'MMMM')}
                                    </span>
                                </button>
                                <MonthGrid
                                    cursorDate={monthDate}
                                    selectedDate={selectedDate}
                                    strengthCount={strengthCount}
                                    dayStatsByDate={dayStatsByDate}
                                    compact
                                    onSelectDay={openDayDetail}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
                </div>

                <div className="w-full lg:w-1/4 min-w-0 lg:sticky lg:top-4 self-start">
                    <AttendanceDayDetailPanel
                        day={detailDay}
                        stats={detailStats}
                        totalStaff={strengthCount}
                        onClose={() => setDetailDay(new Date())}
                    />
                </div>
            </div>
        </TooltipProvider>
    );
}
