'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Clock, LogIn, LogOut } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { normalizeWorkLocationKey } from '@/utils/workLocations';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import { dashboardHover, dashboardItem } from './dashboardMotion';
import DashboardSalaryEnrollLock from './DashboardSalaryEnrollLock';

export const ATTENDANCE_CHECK_CHANGED = 'verp:attendance-check-changed';

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

/** Parse HH:mm or HH:mm:ss as seconds since midnight. */
function clockToSeconds(clock) {
    if (!clock) return null;
    const parts = String(clock)
        .trim()
        .split(':')
        .map((n) => Number(n));
    if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
    const [h, m, s = 0] = parts;
    return h * 3600 + m * 60 + s;
}

function getDubaiNowSeconds() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23',
    }).formatToParts(new Date());
    const pick = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
    return pick('hour') * 3600 + pick('minute') * 60 + pick('second');
}

function formatElapsed(totalSeconds) {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

/** Current Dubai clock HH:mm:ss — used for optimistic check-in when API omits time. */
function getDubaiClockNow() {
    const sec = getDubaiNowSeconds();
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function notifyAttendanceChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(ATTENDANCE_CHECK_CHANGED));
    }
    notifyAttendancePendingInboxChanged();
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function weekdayKeyFromDateKey(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
    return WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()] || null;
}

function formatMeridiemClock(hour, minute, meridiem) {
    const h = String(hour || '09').padStart(2, '0');
    const m = String(minute || '00').padStart(2, '0');
    const mer = String(meridiem || 'AM').toUpperCase() === 'PM' ? 'PM' : 'AM';
    return `${Number(h)}:${m} ${mer}`;
}

function resolveTodayHours(week, dateKey) {
    const dayKey = weekdayKeyFromDateKey(dateKey);
    const day = dayKey ? week?.[dayKey] : null;
    if (!day) return { isOffDay: false, range: '' };
    if (day.isOffDay) return { isOffDay: true, range: '' };
    return {
        isOffDay: false,
        range: `${formatMeridiemClock(day.startHour, day.startMinute, day.startMeridiem)} – ${formatMeridiemClock(day.endHour, day.endMinute, day.endMeridiem)}`,
    };
}

function hoursText(hours) {
    if (!hours) return '—';
    if (hours.isOffDay) return 'Off day';
    return hours.range || '—';
}

export default function DashboardCheckInOutCard() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [dateKey, setDateKey] = useState(() => getDubaiDateKey());
    const [timeIn, setTimeIn] = useState('');
    const [timeOut, setTimeOut] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [staffType, setStaffType] = useState('office');
    const [officeHours, setOfficeHours] = useState({ isOffDay: false, range: '' });
    const [siteHours, setSiteHours] = useState({ isOffDay: false, range: '' });
    const [salaryLocked, setSalaryLocked] = useState(false);
    const tickRef = useRef(null);

    const checkedIn = Boolean(timeIn);
    const checkedOut = Boolean(timeOut);
    const running = checkedIn && !checkedOut;

    const loadToday = useCallback(async ({ soft = false } = {}) => {
        if (!soft) setLoading(true);
        try {
            const today = getDubaiDateKey();
            setDateKey(today);
            const month = today.slice(0, 7);
            const res = await axiosInstance.get('/Attendance/me', {
                params: { month },
                skipToast: true,
            });
            if (res.data?.salaryEnrolled === false) {
                setSalaryLocked(true);
                setTimeIn('');
                setTimeOut('');
                setError('');
                return;
            }
            setSalaryLocked(false);
            const record = res.data?.todayRecord || null;
            const nextStaff = normalizeWorkLocationKey(res.data?.employee?.staffType);
            setTimeIn(record?.timeIn || '');
            setTimeOut(record?.timeOut || '');
            setStaffType(nextStaff);
            setOfficeHours(resolveTodayHours(res.data?.workingTime?.office, today));
            setSiteHours(resolveTodayHours(res.data?.workingTime?.site, today));
            setError('');
        } catch (err) {
            if (err?.response?.data?.salaryEnrolled === false) {
                setSalaryLocked(true);
                setTimeIn('');
                setTimeOut('');
                setError('');
                return;
            }
            if (!soft) {
                setTimeIn('');
                setTimeOut('');
            }
            setError(err?.response?.data?.message || 'Could not load check-in status.');
        } finally {
            if (!soft) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadToday();
    }, [loadToday]);

    useEffect(() => {
        const onChanged = () => loadToday({ soft: true });
        window.addEventListener(ATTENDANCE_CHECK_CHANGED, onChanged);
        return () => window.removeEventListener(ATTENDANCE_CHECK_CHANGED, onChanged);
    }, [loadToday]);

    // Midnight rollover (Asia/Dubai) — timer resets; incomplete day becomes Unauthorized on server
    useEffect(() => {
        const checkDay = () => {
            const next = getDubaiDateKey();
            if (next !== dateKey) {
                setDateKey(next);
                setTimeIn('');
                setTimeOut('');
                setElapsed(0);
                loadToday();
                notifyAttendanceChanged();
            }
        };
        const id = setInterval(checkDay, 15 * 1000);
        const onVisible = () => {
            if (document.visibilityState === 'visible') checkDay();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', checkDay);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', checkDay);
        };
    }, [dateKey, loadToday]);

    // Live timer: starts on check-in, stops on check-out, resets after midnight
    useEffect(() => {
        if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
        }

        const inSec = clockToSeconds(timeIn);
        const outSec = clockToSeconds(timeOut);

        if (inSec == null) {
            setElapsed(0);
            return undefined;
        }

        if (outSec != null) {
            setElapsed(Math.max(0, outSec - inSec));
            return undefined;
        }

        const tick = () => {
            setElapsed(Math.max(0, getDubaiNowSeconds() - inSec));
        };
        tick();
        tickRef.current = setInterval(tick, 1000);
        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, [timeIn, timeOut]);

    const handleCheckIn = async () => {
        if (salaryLocked || checkedIn || saving || loading) return;
        setSaving(true);
        setError('');
        try {
            const res = await axiosInstance.post('/Attendance/me/check-in', {}, { skipToast: true });
            const nextIn =
                res.data?.timeIn ||
                res.data?.record?.timeIn ||
                getDubaiClockNow();
            setTimeIn(nextIn);
            setTimeOut('');
            // Notify calendar only — avoid hard reload wiping timer state
            notifyAttendanceChanged();
        } catch (err) {
            if (err?.response?.data?.salaryEnrolled === false) {
                setSalaryLocked(true);
                return;
            }
            const msg = err?.response?.data?.message || 'Check-in failed.';
            setError(msg);
            // If already checked in, sync times from record so timer can run
            const record = err?.response?.data?.record;
            if (record?.timeIn) {
                setTimeIn(record.timeIn);
                setTimeOut(record.timeOut || '');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCheckOut = async () => {
        if (salaryLocked || !checkedIn || checkedOut || saving || loading) return;
        setSaving(true);
        setError('');
        try {
            const res = await axiosInstance.post('/Attendance/me/check-out', {}, { skipToast: true });
            const nextOut =
                res.data?.timeOut ||
                res.data?.record?.timeOut ||
                getDubaiClockNow();
            setTimeOut(nextOut);
            notifyAttendanceChanged();
        } catch (err) {
            if (err?.response?.data?.salaryEnrolled === false) {
                setSalaryLocked(true);
                return;
            }
            const msg = err?.response?.data?.message || 'Check-out failed.';
            setError(msg);
            const record = err?.response?.data?.record;
            if (record?.timeOut) {
                setTimeOut(record.timeOut);
            }
            if (record?.timeIn) {
                setTimeIn(record.timeIn);
            }
        } finally {
            setSaving(false);
        }
    };

    const statusLabel = useMemo(() => {
        if (loading) return 'Loading…';
        if (checkedOut) return 'Present';
        if (checkedIn) return 'Checked in';
        return 'Not checked in';
    }, [loading, checkedIn, checkedOut]);

    const checkInButtonLabel = useMemo(() => {
        if (saving && !checkedIn) return 'Saving…';
        if (checkedIn) return `In ${formatClock(timeIn) || '—'}`;
        return 'Check In';
    }, [saving, checkedIn, timeIn]);

    const checkOutButtonLabel = useMemo(() => {
        if (saving && checkedIn && !checkedOut) return 'Saving…';
        if (checkedOut) return `Out ${formatClock(timeOut) || '—'}`;
        return 'Check Out';
    }, [saving, checkedIn, checkedOut, timeOut]);

    return (
        <motion.div
            variants={dashboardItem}
            whileHover={dashboardHover}
            className="dash-card-lift relative col-span-12 sm:col-span-6 lg:col-span-3 bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[220px] sm:min-h-[280px] lg:h-[380px] lg:min-h-[380px] lg:max-h-[380px] overflow-hidden"
        >
            <div>
                <h3 className="text-[10px] sm:text-xs lg:text-sm font-black text-slate-800 uppercase tracking-wider">
                    Check In / Out
                </h3>
                <div className="mt-1.5 space-y-0.5 text-[11px] sm:text-xs tabular-nums">
                    <p className={staffType === 'office' ? 'font-bold text-slate-800' : 'font-semibold text-slate-500'}>
                        Office hrs{' '}
                        <span className="font-semibold text-slate-600">· {hoursText(officeHours)}</span>
                    </p>
                    <p className={staffType === 'site' ? 'font-bold text-slate-800' : 'font-semibold text-slate-500'}>
                        Site hrs{' '}
                        <span className="font-semibold text-slate-600">· {hoursText(siteHours)}</span>
                    </p>
                </div>
                <p className="text-slate-400 text-[10px] sm:text-xs mt-1 sm:mt-2 leading-relaxed">
                    If you forget to check out, the day is auto-marked as mispunched. Check out to
                    mark the day Present. After midnight it resets to 00:00:00.
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums mt-2">{dateKey}</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-2 sm:py-3 gap-2 min-h-0">
                <div className="flex flex-col items-center justify-center">
                    <Clock
                        className={`w-5 h-5 mb-1 ${running ? 'text-[#EA3D2F]' : 'text-slate-300'}`}
                        strokeWidth={2}
                    />
                    <p
                        className={`text-xl sm:text-2xl lg:text-3xl font-black tabular-nums tracking-tight ${
                            running ? 'text-slate-900' : 'text-slate-500'
                        }`}
                    >
                        {loading ? '--:--:--' : formatElapsed(elapsed)}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                        {statusLabel}
                    </p>
                </div>

                <div className="w-full space-y-1 text-center">
                    {timeIn ? (
                        <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                            <span className="text-slate-400 font-medium">In</span>{' '}
                            <span className="font-semibold">{formatClock(timeIn)}</span>
                            {timeOut ? (
                                <>
                                    <span className="text-slate-300 mx-1.5">·</span>
                                    <span className="text-slate-400 font-medium">Out</span>{' '}
                                    <span className="font-semibold">{formatClock(timeOut)}</span>
                                </>
                            ) : (
                                <span className="text-amber-600 text-[11px] ml-1.5 font-medium">
                                    · Check out required
                                </span>
                            )}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-300">No check-in yet today</p>
                    )}
                    {error ? (
                        <div className="space-y-1">
                            <p className="text-[11px] text-red-500 px-1">{error}</p>
                            <button
                                type="button"
                                onClick={() => loadToday()}
                                className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 underline"
                            >
                                Retry
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                <button
                    type="button"
                    disabled={salaryLocked || saving || loading || checkedIn}
                    onClick={handleCheckIn}
                    className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B7A3E] hover:bg-[#086433] !text-white text-xs sm:text-sm font-bold transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-[#0B7A3E] disabled:hover:translate-y-0 disabled:!text-white"
                    title={checkedIn ? `Checked in at ${formatClock(timeIn)}` : 'Check in'}
                >
                    {checkedIn ? (
                        <Check className="w-4 h-4 shrink-0 !text-white" strokeWidth={2.5} />
                    ) : (
                        <LogIn className="w-4 h-4 shrink-0 !text-white" />
                    )}
                    <span className="truncate !text-white">{checkInButtonLabel}</span>
                </button>
                <button
                    type="button"
                    disabled={salaryLocked || saving || loading || !checkedIn || checkedOut}
                    onClick={handleCheckOut}
                    className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B71C1C] hover:bg-[#9A1616] !text-white text-xs sm:text-sm font-bold transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-[#B71C1C] disabled:hover:translate-y-0 disabled:!text-white"
                    title={
                        checkedOut
                            ? `Checked out at ${formatClock(timeOut)}`
                            : checkedIn
                              ? 'Check out'
                              : 'Check in first'
                    }
                >
                    {checkedOut ? (
                        <Check className="w-4 h-4 shrink-0 !text-white" strokeWidth={2.5} />
                    ) : (
                        <LogOut className="w-4 h-4 shrink-0 !text-white" />
                    )}
                    <span className="truncate !text-white">{checkOutButtonLabel}</span>
                </button>
            </div>
            <DashboardSalaryEnrollLock locked={salaryLocked} />
        </motion.div>
    );
}
