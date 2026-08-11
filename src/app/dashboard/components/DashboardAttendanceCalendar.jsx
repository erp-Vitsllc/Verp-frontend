'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    isSameMonth,
    parseISO,
    startOfMonth,
} from 'date-fns';
import { Clock, Users } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import AttendanceTeamTreeModal from './AttendanceTeamTreeModal';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRESENT_KEYS = new Set(['on_office', 'work_from_home', 'late_arrived']);
const LEAVE_KEYS = new Set(['on_leave', 'sick_leave', 'authorized_leave', 'unauthorized_leave']);

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
    const s = String(value).trim();
    if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
    return s;
}

function toTitleName(name) {
    if (!name) return '';
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function dayTone({ record, isSunday, isFuture }) {
    if (isFuture) {
        return {
            cell: 'bg-slate-300 text-slate-600',
            label: 'Upcoming',
        };
    }
    if (record && LEAVE_KEYS.has(record.statusKey)) {
        return {
            cell: 'bg-[#4A90E2] text-white',
            label: record.statusLabel || 'On Leave',
        };
    }
    if (record && (PRESENT_KEYS.has(record.statusKey) || record.timeIn)) {
        return {
            cell: 'bg-[#2ECC71] text-white',
            label: record.statusLabel || 'Present',
        };
    }
    if (isSunday) {
        return {
            cell: 'bg-[#E74C3C] text-white',
            label: 'Absent',
        };
    }
    return {
        cell: 'bg-[#F5A623] text-white',
        label: 'Not marked',
    };
}

export default function DashboardAttendanceCalendar() {
    const todayKey = getDubaiDateKey();
    const monthAnchor = useMemo(() => {
        try {
            return startOfMonth(parseISO(todayKey));
        } catch {
            return startOfMonth(new Date());
        }
    }, [todayKey]);

    const monthKey = format(monthAnchor, 'yyyy-MM');
    const [recordsByDate, setRecordsByDate] = useState({});
    const [todayRecord, setTodayRecord] = useState(null);
    const [employeeName, setEmployeeName] = useState('');
    const [selfEmployeeId, setSelfEmployeeId] = useState('');
    const [viewEmployeeId, setViewEmployeeId] = useState('');
    const [isSelf, setIsSelf] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [teamOpen, setTeamOpen] = useState(false);

    const activeEmployeeId = viewEmployeeId || selfEmployeeId;

    const loadMonth = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = { month: monthKey };
            if (viewEmployeeId) params.forEmployeeId = viewEmployeeId;
            const res = await axiosInstance.get('/Attendance/me', {
                params,
                skipToast: true,
            });
            const map = {};
            (res.data?.records || []).forEach((r) => {
                map[r.date] = r;
            });
            setRecordsByDate(map);
            setTodayRecord(res.data?.todayRecord || map[todayKey] || null);
            setEmployeeName(res.data?.employee?.name || '');
            setIsSelf(res.data?.isSelf !== false);
            if (!viewEmployeeId && res.data?.employee?.id) {
                setSelfEmployeeId(String(res.data.employee.id));
            }
        } catch (err) {
            setRecordsByDate({});
            setTodayRecord(null);
            setError(err?.response?.data?.message || 'Could not load attendance.');
        } finally {
            setLoading(false);
        }
    }, [monthKey, todayKey, viewEmployeeId]);

    useEffect(() => {
        loadMonth();
    }, [loadMonth]);

    useEffect(() => {
        const onChanged = () => {
            if (!viewEmployeeId) loadMonth();
        };
        window.addEventListener(ATTENDANCE_CHECK_CHANGED, onChanged);
        return () => window.removeEventListener(ATTENDANCE_CHECK_CHANGED, onChanged);
    }, [loadMonth, viewEmployeeId]);

    const days = useMemo(() => {
        const start = startOfMonth(monthAnchor);
        const end = endOfMonth(monthAnchor);
        return eachDayOfInterval({ start, end });
    }, [monthAnchor]);

    const leadingBlanks = getDay(startOfMonth(monthAnchor));
    const timeInLabel = formatClock(todayRecord?.timeIn);
    const timeOutLabel = formatClock(todayRecord?.timeOut);
    const viewingOther = !isSelf;

    return (
        <>
            <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl sm:rounded-[20px] p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[220px] sm:min-h-[280px] lg:h-[380px] lg:max-h-[380px] lg:min-h-[380px]">
                <div className="flex items-start justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em]">
                            My Attendance
                        </p>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                            {format(monthAnchor, 'MMMM yyyy')}
                        </h3>
                        <p className="text-xs text-slate-400 tabular-nums mt-0.5">{todayKey}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <button
                                type="button"
                                onClick={() => setTeamOpen(true)}
                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white text-slate-700 text-[11px] font-semibold border border-slate-200 hover:bg-slate-50"
                            >
                                <Users className="w-3.5 h-3.5" />
                                See Teams
                            </button>
                            {viewingOther ? (
                                <button
                                    type="button"
                                    onClick={() => setViewEmployeeId('')}
                                    className="inline-flex items-center h-7 px-2.5 rounded-full bg-sky-50 text-sky-700 text-[11px] font-semibold border border-sky-100"
                                >
                                    Back to me
                                </button>
                            ) : null}
                        </div>

                        <div className="text-right min-w-0">
                            {employeeName ? (
                                <p className="text-xs sm:text-sm text-slate-500 font-medium truncate">
                                    {toTitleName(employeeName)}
                                    {viewingOther ? (
                                        <span className="ml-1 text-[10px] text-sky-600 font-semibold">
                                            Team
                                        </span>
                                    ) : null}
                                </p>
                            ) : null}
                            {timeInLabel ? (
                                <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 tabular-nums mt-0.5">
                                    <Clock
                                        className="w-3.5 h-3.5 text-slate-400 shrink-0"
                                        strokeWidth={2}
                                    />
                                    <span>
                                        In {timeInLabel}
                                        {timeOutLabel ? ` · Out ${timeOutLabel}` : ''}
                                    </span>
                                </p>
                            ) : (
                                <p className="text-xs text-slate-300 mt-0.5">Not checked in</p>
                            )}
                        </div>
                    </div>
                </div>

                {error ? <p className="text-[11px] text-red-500 mt-1 shrink-0">{error}</p> : null}

                {loading ? (
                    <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-slate-400">
                        Loading calendar…
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden mt-2 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-7 gap-1 shrink-0 mb-1.5">
                            {WEEKDAYS.map((d) => (
                                <div
                                    key={d}
                                    className="text-center text-[9px] font-semibold uppercase tracking-wider text-slate-400 leading-none"
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* 6 equal rows so the full month always fits in the card */}
                        <div className="grid grid-cols-7 grid-rows-6 gap-x-2 gap-y-2 flex-1 min-h-0">
                            {Array.from({ length: leadingBlanks }).map((_, i) => (
                                <div key={`blank-${i}`} className="min-h-0" />
                            ))}
                            {days.map((day) => {
                                if (!isSameMonth(day, monthAnchor)) return null;
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const isSunday = getDay(day) === 0;
                                const isFuture = dateKey > todayKey;
                                const record = recordsByDate[dateKey];
                                const tone = dayTone({ record, isSunday, isFuture });
                                const isToday = dateKey === todayKey;

                                return (
                                    <div
                                        key={dateKey}
                                        title={tone.label}
                                        className="min-h-0 flex items-center justify-center"
                                    >
                                        <div
                                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-semibold tabular-nums leading-none shadow-sm ${tone.cell} ${
                                                isToday ? 'ring-2 ring-sky-400 ring-offset-1' : ''
                                            }`}
                                        >
                                            {format(day, 'd')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 shrink-0">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#2ECC71]" /> Present
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#E74C3C]" /> Absent
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#4A90E2]" /> On Leave
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <AttendanceTeamTreeModal
                open={teamOpen}
                selectedId={activeEmployeeId}
                onClose={() => setTeamOpen(false)}
                onSelect={(person) => {
                    const id = String(person?._id || '');
                    if (!id) return;
                    if (selfEmployeeId && id === String(selfEmployeeId)) {
                        setViewEmployeeId('');
                        return;
                    }
                    setViewEmployeeId(id);
                }}
                onMarked={() => {
                    loadMonth();
                }}
            />
        </>
    );
}
