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
import { Check, ChevronRight, Clock, Users } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import AttendanceTeamTreeModal from './AttendanceTeamTreeModal';
import MarkAttendanceDetailsModal, {
    getMarkFormConfig,
} from '@/app/HRM/Attendance/mark/components/MarkAttendanceDetailsModal';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRESENT_KEYS = new Set(['on_office', 'work_from_home', 'late_arrived']);
const LEAVE_KEYS = new Set(['on_leave', 'sick_leave', 'unauthorized_leave']);

const MARK_OPTIONS = [
    { key: 'work_from_home', label: 'Work from home' },
    { key: 'on_office', label: 'On office' },
    {
        key: 'on_leave',
        label: 'On leave',
        children: [
            { key: 'sick_leave', label: 'Sick leave' },
            { key: 'unauthorized_leave', label: 'Unauthorized leave' },
        ],
    },
    { key: 'late_arrived', label: 'Late arrived' },
    { key: 'not_marked', label: 'Not marked attendance' },
];

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

function dayTone({ record, isSunday }) {
    if (isSunday) {
        return {
            cell: 'bg-[#E8ECF1] text-slate-500',
            dot: 'bg-slate-400',
            label: 'Sunday',
        };
    }
    if (record && LEAVE_KEYS.has(record.statusKey)) {
        return {
            cell: 'bg-[#FCE8E8] text-red-800',
            dot: 'bg-red-500',
            label: record.statusLabel || 'Leave',
        };
    }
    if (record && (PRESENT_KEYS.has(record.statusKey) || record.timeIn)) {
        return {
            cell: 'bg-[#E4F7ED] text-emerald-900',
            dot: 'bg-emerald-500',
            label: record.statusLabel || 'Present',
        };
    }
    return {
        cell: 'bg-[#FFF1E0] text-amber-950',
        dot: 'bg-amber-400',
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
    const [employeeCode, setEmployeeCode] = useState('');
    const [selfEmployeeId, setSelfEmployeeId] = useState('');
    const [viewEmployeeId, setViewEmployeeId] = useState('');
    const [isSelf, setIsSelf] = useState(true);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [teamOpen, setTeamOpen] = useState(false);
    const [markMenuOpen, setMarkMenuOpen] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [formState, setFormState] = useState(null);

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
            setEmployeeCode(res.data?.employee?.employeeId || '');
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

    const days = useMemo(() => {
        const start = startOfMonth(monthAnchor);
        const end = endOfMonth(monthAnchor);
        return eachDayOfInterval({ start, end });
    }, [monthAnchor]);

    const leadingBlanks = getDay(startOfMonth(monthAnchor));

    const checkedIn = Boolean(todayRecord?.timeIn);
    const checkedOut = Boolean(todayRecord?.timeOut);
    const onLeaveToday =
        todayRecord && LEAVE_KEYS.has(todayRecord.statusKey) && !todayRecord.timeIn;

    const timeInLabel = formatClock(todayRecord?.timeIn);
    const timeOutLabel = formatClock(todayRecord?.timeOut);

    const targetBody = () =>
        viewEmployeeId && !isSelf ? { forEmployeeId: viewEmployeeId } : {};

    const handleCheckIn = async () => {
        setActionLoading(true);
        setError('');
        try {
            const res = await axiosInstance.post('/Attendance/me/check-in', targetBody(), {
                skipToast: true,
            });
            const record = res.data?.record;
            if (record?.date) {
                setRecordsByDate((prev) => ({ ...prev, [record.date]: record }));
                setTodayRecord(record);
            } else {
                await loadMonth();
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Check-in failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        setError('');
        try {
            const res = await axiosInstance.post('/Attendance/me/check-out', targetBody(), {
                skipToast: true,
            });
            const record = res.data?.record;
            if (record?.date) {
                setRecordsByDate((prev) => ({ ...prev, [record.date]: record }));
                setTodayRecord(record);
            } else {
                await loadMonth();
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Check-out failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const applyPersonMark = async (payload) => {
        if (!activeEmployeeId) return;
        setActionLoading(true);
        setError('');
        try {
            await axiosInstance.post('/Attendance/team/mark', {
                employeeMongoIds: [activeEmployeeId],
                statusKey: payload.markKey,
                statusLabel: payload.markLabel,
                timeIn: payload.timeIn ?? '',
                timeOut: payload.timeOut ?? '',
                reason: payload.reason || '',
                attachmentName: payload.attachmentName || '',
            });
            setFormState(null);
            setMarkMenuOpen(false);
            await loadMonth();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not mark attendance.');
        } finally {
            setActionLoading(false);
        }
    };

    const requestPersonMark = (key, label) => {
        const config = getMarkFormConfig(key);
        if (!config) {
            applyPersonMark({
                markKey: key,
                markLabel: label,
                timeIn: null,
                timeOut: null,
            });
            return;
        }
        setFormState({ markKey: key, markLabel: label });
        setMarkMenuOpen(false);
    };

    const viewingOther = !isSelf;

    return (
        <>
            <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl sm:rounded-[20px] p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[220px] sm:min-h-[280px] lg:h-[380px] lg:max-h-[380px] lg:min-h-[380px]">
                <div className="flex items-center justify-between gap-2 shrink-0">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em]">
                        My Attendance
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
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

                        {checkedIn && checkedOut ? (
                            <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#E4F7ED] text-emerald-700 text-[11px] font-semibold">
                                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                                Done
                            </span>
                        ) : null}
                        {onLeaveToday ? (
                            <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold border border-red-100">
                                On leave
                            </span>
                        ) : null}

                        <button
                            type="button"
                            disabled={actionLoading || loading || checkedIn || onLeaveToday}
                            onClick={handleCheckIn}
                            className="inline-flex items-center h-7 px-3 rounded-full bg-[#EA3D2F] hover:bg-[#d43528] text-white text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {actionLoading && !checkedIn ? 'Saving…' : 'Check In'}
                        </button>
                        <button
                            type="button"
                            disabled={
                                actionLoading || loading || !checkedIn || checkedOut || onLeaveToday
                            }
                            onClick={handleCheckOut}
                            className="inline-flex items-center h-7 px-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {actionLoading && checkedIn && !checkedOut ? 'Saving…' : 'Check Out'}
                        </button>

                        <div className="relative">
                            <button
                                type="button"
                                disabled={actionLoading || loading || !activeEmployeeId}
                                onClick={() => setMarkMenuOpen((v) => !v)}
                                className="inline-flex items-center h-7 px-2.5 rounded-full bg-white text-slate-700 text-[11px] font-semibold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                            >
                                Mark
                            </button>
                            {markMenuOpen ? (
                                <div className="absolute right-0 top-full mt-1 z-30 min-w-[200px] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                                    {MARK_OPTIONS.map((opt) => {
                                        if (opt.children?.length) {
                                            return (
                                                <div
                                                    key={opt.key}
                                                    className="relative"
                                                    onMouseEnter={() => setLeaveOpen(true)}
                                                    onMouseLeave={() => setLeaveOpen(false)}
                                                >
                                                    <button
                                                        type="button"
                                                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                                        onClick={() => setLeaveOpen((v) => !v)}
                                                    >
                                                        <span>{opt.label}</span>
                                                        <ChevronRight
                                                            size={14}
                                                            className="text-slate-400"
                                                        />
                                                    </button>
                                                    {leaveOpen ? (
                                                        <div className="absolute right-full top-0 mr-0.5 min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                                                            {opt.children.map((child) => (
                                                                <button
                                                                    key={child.key}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        requestPersonMark(
                                                                            child.key,
                                                                            child.label,
                                                                        )
                                                                    }
                                                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                                                >
                                                                    {child.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        }
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                onClick={() => requestPersonMark(opt.key, opt.label)}
                                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="flex items-baseline justify-between gap-2 mt-1.5 shrink-0">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none">
                        {format(monthAnchor, 'MMMM yyyy')}
                    </h3>
                    {employeeName ? (
                        <p className="text-xs sm:text-sm text-slate-400 font-medium truncate max-w-[45%] text-right">
                            {toTitleName(employeeName)}
                            {viewingOther ? (
                                <span className="ml-1 text-[10px] text-sky-600 font-semibold">Team</span>
                            ) : null}
                        </p>
                    ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 mt-1.5 shrink-0">
                    <p className="text-xs text-slate-400 tabular-nums">{todayKey}</p>
                    {timeInLabel ? (
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />
                            <span>
                                In {timeInLabel}
                                {timeOutLabel ? ` · Out ${timeOutLabel}` : ''}
                            </span>
                        </p>
                    ) : (
                        <p className="text-xs text-slate-300">Not checked in</p>
                    )}
                </div>

                {error ? <p className="text-[11px] text-red-500 mt-1 shrink-0">{error}</p> : null}

                {loading ? (
                    <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-slate-400">
                        Loading calendar…
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden mt-2.5">
                        <div className="grid grid-cols-7 gap-1 shrink-0 mb-1">
                            {WEEKDAYS.map((d) => (
                                <div
                                    key={d}
                                    className="text-center text-[9px] font-semibold uppercase tracking-wider text-slate-400 leading-none py-0.5"
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-1 min-h-0">
                            {Array.from({ length: leadingBlanks }).map((_, i) => (
                                <div key={`blank-${i}`} className="min-h-0" />
                            ))}
                            {days.map((day) => {
                                if (!isSameMonth(day, monthAnchor)) return null;
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const isSunday = getDay(day) === 0;
                                const record = recordsByDate[dateKey];
                                const tone = dayTone({ record, isSunday });
                                const isToday = dateKey === todayKey;

                                return (
                                    <div
                                        key={dateKey}
                                        title={tone.label}
                                        className={`min-h-0 rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold tabular-nums leading-none ${tone.cell} ${
                                            isToday ? 'ring-2 ring-sky-400 ring-offset-1' : ''
                                        }`}
                                    >
                                        <span>{format(day, 'd')}</span>
                                        <span className={`mt-0.5 h-1 w-1 rounded-full ${tone.dot}`} />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 shrink-0">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Not marked
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Present
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Leave
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Sunday
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

            <MarkAttendanceDetailsModal
                open={Boolean(formState)}
                employee={{
                    id: activeEmployeeId,
                    name: employeeName,
                    empNo: employeeCode,
                }}
                employeeIds={activeEmployeeId ? [activeEmployeeId] : []}
                markKey={formState?.markKey}
                markLabel={formState?.markLabel}
                onClose={() => setFormState(null)}
                onSave={(payload) => applyPersonMark(payload)}
            />
        </>
    );
}
