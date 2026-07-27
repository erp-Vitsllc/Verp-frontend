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
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import axiosInstance from '@/utils/axios';

const VIEW_OPTIONS = ['Day', 'Week', 'Month', 'Year'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LEAVE_ROWS = [
    { key: 'medicalLeave', label: 'Medical Leave', color: 'bg-rose-50 text-rose-600 ring-rose-200' },
    { key: 'authorizedLeave', label: 'Authorized Leave', color: 'bg-blue-50 text-blue-600 ring-blue-200' },
    { key: 'unauthorizedLeave', label: 'Unauthorized Leave', color: 'bg-amber-50 text-amber-600 ring-amber-200' },
    { key: 'annualLeave', label: 'Annual Leave', color: 'bg-violet-50 text-violet-600 ring-violet-200' },
    { key: 'remote', label: 'Remote', color: 'bg-teal-50 text-teal-600 ring-teal-200' },
];

/** Placeholder day stats until attendance API is wired. Strength = Active employees. */
function getDayAttendanceStats(_day, strengthCount = 0) {
    return {
        strength: strengthCount,
        present: 0,
        medicalLeave: 0,
        authorizedLeave: 0,
        unauthorizedLeave: 0,
        annualLeave: 0,
        remote: 0,
    };
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

function DayHoverCard({ day, today, stats }) {
    return (
        <div className="h-full w-full flex flex-col p-2.5 overflow-hidden" role="tooltip">
            <div className="flex justify-end shrink-0">
                {today ? (
                    <span className="h-6 w-6 bg-black text-white text-xs font-semibold inline-flex items-center justify-center">
                        {day.getDate()}
                    </span>
                ) : (
                    <span className="text-sm font-semibold text-gray-700 tabular-nums">{day.getDate()}</span>
                )}
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center gap-5">
                <span className="text-3xl sm:text-4xl font-black text-gray-900 tabular-nums leading-none">
                    {stats.strength}
                </span>
                <div className="h-10 w-px bg-gray-200 shrink-0" aria-hidden />
                <span className="text-3xl sm:text-4xl font-black text-emerald-600 tabular-nums leading-none">
                    {stats.present}
                </span>
            </div>

            <div className="border-t border-gray-200 shrink-0" />

            <div className="shrink-0 pt-3 pb-0.5 flex items-center justify-evenly gap-2">
                {LEAVE_ROWS.map((row) => (
                    <span
                        key={row.key}
                        title={row.label}
                        className={`h-6 min-w-[1.5rem] px-1 rounded-none ring-1 inline-flex items-center justify-center text-[11px] sm:text-xs font-bold tabular-nums shrink-0 ${row.color}`}
                    >
                        {stats[row.key]}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Week view: one day per horizontal line — date only until hover, then enlarge + show stats. */
function DayStatsRow({ day, strengthCount, selected, enlarged }) {
    const today = isToday(day);
    const stats = getDayAttendanceStats(day, strengthCount);
    const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));

    return (
        <div
            className={`h-full w-full flex items-center gap-3 sm:gap-5 px-3 sm:px-4 transition-colors ${
                isFuture
                    ? 'bg-gray-50'
                    : enlarged
                      ? 'bg-white'
                      : selected && !today
                        ? 'bg-blue-50/40'
                        : 'bg-white'
            }`}
        >
            {/* Day + date — always visible */}
            <div className="flex items-center gap-2 sm:gap-3 w-24 sm:w-36 shrink-0">
                {today ? (
                    <span
                        className={`bg-black text-white font-semibold inline-flex items-center justify-center shrink-0 ${
                            enlarged ? 'h-8 w-8 text-base' : 'h-7 w-7 text-sm'
                        }`}
                    >
                        {day.getDate()}
                    </span>
                ) : (
                    <span
                        className={`font-bold tabular-nums w-7 text-center shrink-0 ${
                            enlarged ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
                        } ${isFuture ? 'text-gray-300' : 'text-gray-900'}`}
                    >
                        {day.getDate()}
                    </span>
                )}
                <span
                    className={`font-medium truncate ${enlarged ? 'text-base sm:text-lg' : 'text-sm sm:text-base'} ${
                        isFuture ? 'text-gray-300' : 'text-gray-500'
                    }`}
                >
                    {format(day, 'EEE')}
                </span>
            </div>

            {enlarged && !isFuture ? (
                <>
                    {/* Strength | Present */}
                    <div className="flex items-center justify-center gap-4 sm:gap-6 shrink-0">
                        <span className="text-2xl sm:text-3xl font-black tabular-nums leading-none text-gray-900">
                            {stats.strength}
                        </span>
                        <div className="h-8 sm:h-10 w-px bg-gray-200 shrink-0" aria-hidden />
                        <span className="text-2xl sm:text-3xl font-black tabular-nums leading-none text-emerald-600">
                            {stats.present}
                        </span>
                    </div>

                    {/* Leave counts */}
                    <div className="flex-1 min-w-0 flex items-center justify-end gap-2 sm:gap-3">
                        {LEAVE_ROWS.map((row) => (
                            <span
                                key={row.key}
                                title={row.label}
                                className={`h-7 sm:h-8 min-w-[1.75rem] sm:min-w-[2rem] px-1 rounded-none ring-1 inline-flex items-center justify-center text-xs sm:text-sm font-bold tabular-nums shrink-0 ${row.color}`}
                            >
                                {stats[row.key]}
                            </span>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function DayStatsPanel({ day, strengthCount, compact = false }) {
    const today = isToday(day);
    const stats = getDayAttendanceStats(day, strengthCount);
    const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));

    return (
        <div
            className={`h-full w-full bg-white flex flex-col overflow-hidden ${
                compact ? 'p-1.5 sm:p-2 min-h-[160px] sm:min-h-[200px]' : 'p-4 sm:p-6 min-h-[280px] sm:min-h-[360px]'
            } ${isFuture ? 'bg-gray-50 opacity-60' : ''}`}
        >
            <div className="flex items-start justify-between shrink-0 gap-1">
                <span
                    className={`font-medium text-gray-500 truncate ${
                        compact ? 'text-[10px] sm:text-xs' : 'text-base sm:text-lg'
                    }`}
                >
                    {compact ? format(day, 'EEE') : format(day, 'EEEE')}
                </span>
                {today ? (
                    <span
                        className={`bg-black text-white font-semibold inline-flex items-center justify-center shrink-0 ${
                            compact ? 'h-5 w-5 text-[10px]' : 'h-10 w-10 sm:h-12 sm:w-12 text-lg sm:text-xl'
                        }`}
                    >
                        {day.getDate()}
                    </span>
                ) : (
                    <span
                        className={`font-bold text-gray-800 tabular-nums shrink-0 ${
                            compact ? 'text-xs sm:text-sm' : 'text-2xl sm:text-3xl'
                        }`}
                    >
                        {day.getDate()}
                    </span>
                )}
            </div>

            <div className={`flex-1 min-h-0 flex items-center justify-center ${compact ? 'gap-2 sm:gap-3' : 'gap-8 sm:gap-10'}`}>
                <span
                    className={`font-black text-gray-900 tabular-nums leading-none ${
                        compact ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-5xl sm:text-6xl lg:text-7xl'
                    }`}
                >
                    {stats.strength}
                </span>
                <div
                    className={`w-px bg-gray-200 shrink-0 ${compact ? 'h-7 sm:h-8' : 'h-14 sm:h-16'}`}
                    aria-hidden
                />
                <span
                    className={`font-black text-emerald-600 tabular-nums leading-none ${
                        compact ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-5xl sm:text-6xl lg:text-7xl'
                    }`}
                >
                    {stats.present}
                </span>
            </div>

            <div className="border-t border-gray-200 shrink-0" />

            <div className={`shrink-0 flex items-center justify-evenly ${compact ? 'pt-1.5 gap-0.5' : 'pt-4 sm:pt-5 gap-3 sm:gap-4'}`}>
                {LEAVE_ROWS.map((row) => (
                    <span
                        key={row.key}
                        title={row.label}
                        className={`rounded-none ring-1 inline-flex items-center justify-center font-bold tabular-nums shrink-0 ${
                            compact
                                ? 'h-4 w-4 sm:h-5 sm:min-w-[1.25rem] sm:w-auto sm:px-0.5 text-[8px] sm:text-[10px]'
                                : 'h-10 sm:h-12 min-w-[2.5rem] sm:min-w-[3rem] px-2 text-base sm:text-lg'
                        } ${row.color}`}
                    >
                        {stats[row.key]}
                    </span>
                ))}
            </div>
        </div>
    );
}

function MonthGrid({
    cursorDate,
    selectedDate,
    strengthCount,
    hoveredDayKey,
    setHoveredDayKey,
    onSelectDay,
    compact = false,
}) {
    const days = useMemo(() => getMonthGridDays(cursorDate), [cursorDate]);

    return (
        <div className="border-t border-gray-200 overflow-visible">
            <div className="grid grid-cols-7 border-b border-gray-200">
                {WEEKDAYS.map((label) => (
                    <div
                        key={label}
                        className={`text-center font-medium text-gray-500 border-r border-gray-200 [&:nth-child(7n)]:border-r-0 ${
                            compact ? 'px-1 py-1 text-[10px]' : 'px-2 py-2 text-xs sm:text-sm'
                        }`}
                    >
                        {compact ? label.charAt(0) : label}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 overflow-visible">
                {days.map((day) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const inMonth = isSameMonth(day, cursorDate);
                    const today = isToday(day);
                    const selected = isSameDay(day, selectedDate);
                    const showMonthAbbrev = day.getDate() === 1;
                    const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));
                    const isHovered = !compact && hoveredDayKey === dayKey;
                    const stats = getDayAttendanceStats(day, strengthCount);

                    return (
                        <div
                            key={dayKey}
                            className={`relative aspect-square w-full border-r border-b border-gray-200 [&:nth-child(7n)]:border-r-0 ${
                                isHovered ? 'z-50' : 'z-0'
                            }`}
                            onMouseEnter={() => {
                                if (!compact && !isFuture) setHoveredDayKey(dayKey);
                            }}
                            onMouseLeave={() => {
                                if (!compact) setHoveredDayKey(null);
                            }}
                        >
                            <button
                                type="button"
                                disabled={isFuture}
                                onClick={() => {
                                    if (isFuture) return;
                                    onSelectDay(day);
                                }}
                                className={`text-left transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                                    isHovered && !isFuture
                                        ? 'absolute left-1/2 top-1/2 z-50 aspect-square w-[min(200%,14rem)] -translate-x-1/2 -translate-y-1/2 rounded-none bg-white p-0 shadow-md border border-gray-200'
                                        : `absolute inset-0 ${compact ? 'p-0.5' : 'p-1 sm:p-1.5'} ${
                                              isFuture
                                                  ? 'bg-gray-50 cursor-not-allowed'
                                                  : inMonth
                                                    ? 'bg-white hover:bg-gray-50'
                                                    : 'bg-[#f7f7f8] hover:bg-gray-50'
                                          } ${selected && !today && !isFuture ? 'bg-blue-50/60' : ''}`
                                }`}
                            >
                                {isHovered && !isFuture ? (
                                    <DayHoverCard day={day} today={today} stats={stats} />
                                ) : (
                                    <div className="flex justify-end">
                                        <span
                                            className={`inline-flex items-center justify-center leading-none ${
                                                compact
                                                    ? 'text-[10px]'
                                                    : 'text-[11px] sm:text-xs lg:text-sm'
                                            } ${
                                                today
                                                    ? `${compact ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 sm:h-6 sm:w-6'} rounded-full bg-black text-white font-semibold`
                                                    : isFuture
                                                      ? 'text-gray-300'
                                                      : inMonth
                                                        ? 'text-gray-900 font-medium'
                                                        : 'text-gray-400'
                                            }`}
                                        >
                                            {today
                                                ? day.getDate()
                                                : !compact && showMonthAbbrev
                                                  ? format(day, 'd MMM')
                                                  : day.getDate()}
                                        </span>
                                    </div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function AttendanceMonthCalendar() {
    const [view, setView] = useState('Month');
    const [cursorDate, setCursorDate] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredDayKey, setHoveredDayKey] = useState(null);
    const [strengthCount, setStrengthCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/Employee', {
                    params: { profileStatus: 'active', limit: 5000 },
                    skipToast: true,
                });
                const rows = Array.isArray(res.data?.employees)
                    ? res.data.employees
                    : Array.isArray(res.data)
                      ? res.data
                      : Array.isArray(res.data?.data)
                        ? res.data.data
                        : [];
                const fromPagination = Number(res.data?.pagination?.total);
                const activeCount = Number.isFinite(fromPagination)
                    ? fromPagination
                    : rows.filter((emp) => {
                          const profile = String(emp?.profileStatus || '').trim().toLowerCase();
                          const status = String(emp?.status || '').trim().toLowerCase();
                          return profile === 'active' || status === 'active';
                      }).length;
                if (!cancelled) setStrengthCount(activeCount);
            } catch {
                if (!cancelled) setStrengthCount(0);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const weekDays = useMemo(() => getWeekDays(cursorDate), [cursorDate]);
    const yearMonths = useMemo(() => {
        const start = startOfYear(cursorDate);
        const end = endOfYear(cursorDate);
        return eachMonthOfInterval({ start, end });
    }, [cursorDate]);

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
        // Keep current view mode; land on the week/month/day/year that contains today
        setHoveredDayKey(null);
    };

    const goPrev = () => {
        setHoveredDayKey(null);
        if (view === 'Day') setCursorDate((d) => addDays(d, -1));
        else if (view === 'Week') setCursorDate((d) => subWeeks(d, 1));
        else if (view === 'Year') setCursorDate((d) => subYears(d, 1));
        else setCursorDate((d) => subMonths(d, 1));
    };

    const goNext = () => {
        setHoveredDayKey(null);
        if (view === 'Day') setCursorDate((d) => addDays(d, 1));
        else if (view === 'Week') setCursorDate((d) => addWeeks(d, 1));
        else if (view === 'Year') setCursorDate((d) => addYears(d, 1));
        else setCursorDate((d) => addMonths(d, 1));
    };

    const selectDay = (day, nextView = 'Month') => {
        setSelectedDate(day);
        setCursorDate(day);
        setView(nextView);
        setHoveredDayKey(null);
    };

    return (
        <div className="bg-white shadow-sm border border-gray-200 overflow-visible flex flex-col min-w-0 w-full min-h-[560px] sm:min-h-[620px] relative z-0">
            {/* Top toolbar: Day / Week / Month / Year + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-4 lg:px-5 py-3 border-b border-gray-200">
                <div className="flex items-center justify-center sm:justify-start">
                    <div className="inline-flex items-center bg-gray-100 p-0.5">
                        {VIEW_OPTIONS.map((option) => {
                            const active = view === option;
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                        setView(option);
                                        setHoveredDayKey(null);
                                    }}
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

                <div className="relative w-full sm:w-56 lg:w-64">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search"
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                </div>
            </div>

            {/* Title + Today / arrows */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-4 lg:px-5 py-3 sm:py-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{title}</h2>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={goPrev}
                        className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                        aria-label="Previous"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={goToday}
                        className="h-8 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={goNext}
                        className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                        aria-label="Next"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Views */}
            {view === 'Month' && (
                <MonthGrid
                    cursorDate={cursorDate}
                    selectedDate={selectedDate}
                    strengthCount={strengthCount}
                    hoveredDayKey={hoveredDayKey}
                    setHoveredDayKey={setHoveredDayKey}
                    onSelectDay={(day) => selectDay(day, 'Month')}
                />
            )}

            {view === 'Week' && (
                <div className="border-t border-gray-200 flex flex-col flex-1 min-h-0 overflow-visible relative z-0">
                    {weekDays.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));
                        const isHovered = hoveredDayKey === dayKey;

                        return (
                            <div
                                key={dayKey}
                                className={`relative flex-1 min-h-[3.25rem] border-b border-gray-200 last:border-b-0 ${
                                    isHovered ? 'z-50' : 'z-0'
                                }`}
                                onMouseEnter={() => {
                                    if (!isFuture) setHoveredDayKey(dayKey);
                                }}
                                onMouseLeave={() => setHoveredDayKey(null)}
                            >
                                <button
                                    type="button"
                                    disabled={isFuture}
                                    onClick={() => {
                                        if (isFuture) return;
                                        selectDay(day, 'Day');
                                    }}
                                    className={`text-left disabled:cursor-not-allowed transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                                        isHovered && !isFuture
                                            ? 'absolute inset-x-0 top-1/2 z-50 h-[min(140%,5.5rem)] -translate-y-1/2 bg-white shadow-lg border border-gray-200'
                                            : 'absolute inset-0'
                                    }`}
                                >
                                    <DayStatsRow
                                        day={day}
                                        strengthCount={strengthCount}
                                        selected={isSameDay(day, selectedDate)}
                                        enlarged={isHovered && !isFuture}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {view === 'Day' && (
                <div className="border-t border-gray-200 flex-1 flex">
                    <DayStatsPanel day={cursorDate} strengthCount={strengthCount} />
                </div>
            )}

            {view === 'Year' && (
                <div className="border-t border-gray-200 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {yearMonths.map((monthDate) => (
                        <div key={format(monthDate, 'yyyy-MM')} className="border border-gray-200 bg-white">
                            <button
                                type="button"
                                onClick={() => {
                                    setCursorDate(monthDate);
                                    setView('Month');
                                    setHoveredDayKey(null);
                                }}
                                className="w-full text-left px-3 py-2 border-b border-gray-200 hover:bg-gray-50"
                            >
                                <span className="text-sm font-bold text-gray-800">{format(monthDate, 'MMMM')}</span>
                            </button>
                            <MonthGrid
                                cursorDate={monthDate}
                                selectedDate={selectedDate}
                                strengthCount={strengthCount}
                                hoveredDayKey={null}
                                setHoveredDayKey={() => {}}
                                compact
                                onSelectDay={(day) => selectDay(day, 'Month')}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
