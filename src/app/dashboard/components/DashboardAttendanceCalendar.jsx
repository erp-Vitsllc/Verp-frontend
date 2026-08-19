'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';
import axiosInstance from '@/utils/axios';
import { holidayAppliesToStaff } from '@/utils/holidayScope';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import AttendanceTeamTreeModal from './AttendanceTeamTreeModal';
import AttendanceLeaveRequestModal from './AttendanceLeaveRequestModal';
import AttendanceYellowRequestModal from './AttendanceYellowRequestModal';
import AttendanceFutureRequestModal from './AttendanceFutureRequestModal';
import AttendanceLeaveDecideModal from './AttendanceLeaveDecideModal';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardHover, dashboardItem, DASH_EASE } from './dashboardMotion';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const PRESENT_KEYS = new Set(['on_office', 'work_from_home']);
const LEAVE_KEYS = new Set(['on_leave']);
const SICK_LEAVE_KEYS = new Set(['sick_leave']);
const AUTHORIZED_LEAVE_KEYS = new Set(['authorized_leave']);
const UNAUTHORIZED_KEYS = new Set(['unauthorized_leave']);
const ABSENT_KEYS = new Set(['not_marked', 'absent']);
/** Late Arrival and Mispunch are yellow. Early Go is shown as Late Arrival. */
const LATE_ARRIVAL_KEYS = new Set(['late_arrived', 'early_go']);
const YELLOW_STATUS_KEYS = new Set(['late_arrived', 'early_go', 'mispunch']);
const OFF_DAY_KEYS = new Set(['holiday', 'weekly_off']);
const RED_CLICK_KEYS = new Set(['unauthorized_leave', 'on_leave']);

/** Calendar day colors (MY ATTENDANCE). */
const TONE = {
    present: 'bg-[#2ECC71] text-white',
    holiday: 'bg-[#9CA3AF] text-white',
    future: 'bg-white text-slate-500 border border-slate-200',
    unauthorized: 'bg-[#E74C3C] text-white',
    leave: 'bg-[#E74C3C] text-white',
    sickLeave: 'bg-[#22C55E] text-white',
    authorizedLeave: 'bg-[#2563EB] text-white',
    absent: 'bg-[#F97316] text-black',
    yellow: 'bg-[#F1C40F] text-black',
};

const TONE_FILL = {
    present: { backgroundColor: '#2ECC71', color: '#ffffff' },
    holiday: { backgroundColor: '#9CA3AF', color: '#ffffff' },
    unauthorized: { backgroundColor: '#E74C3C', color: '#ffffff' },
    leave: { backgroundColor: '#E74C3C', color: '#ffffff' },
    sickLeave: { backgroundColor: '#22C55E', color: '#ffffff' },
    authorizedLeave: { backgroundColor: '#2563EB', color: '#ffffff' },
    absent: { backgroundColor: '#F97316', color: '#000000' },
    yellow: { backgroundColor: '#F1C40F', color: '#000000' },
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

function isMispunchReason(reason) {
    return String(reason || '')
        .toLowerCase()
        .includes('mispunch');
}

function authorizedPayType(record) {
    const pay = String(record?.leavePayType || '').toLowerCase();
    if (pay === 'paid' || pay === 'unpaid') return pay;
    const label = String(record?.statusLabel || '').toLowerCase();
    if (label.includes('unpaid')) return 'unpaid';
    if (/\bpaid\b/.test(label) || label.includes('(paid)')) return 'paid';
    return '';
}

function isRedTone(toneCell) {
    return toneCell === TONE.unauthorized || toneCell === TONE.leave;
}

function isYellowTone(toneCell) {
    return toneCell === TONE.yellow;
}

function colorFromToneCell(cell) {
    const key = Object.keys(TONE).find((name) => TONE[name] === cell);
    return TONE_FILL[key]?.backgroundColor || '#64748b';
}

function shouldShowPunchTimes(record, tone) {
    if (!record) return false;
    if (tone?.cell === TONE.present || tone?.cell === TONE.yellow) return true;
    const key = String(record.statusKey || '');
    return (
        PRESENT_KEYS.has(key) ||
        LATE_ARRIVAL_KEYS.has(key) ||
        key === 'mispunch' ||
        isMispunchReason(record.reason)
    );
}

function CalendarDayTooltip({ hovered, reduceMotion }) {
    if (!hovered || typeof document === 'undefined') return null;

    const pad = 18;
    const estimatedWidth = 280;
    const estimatedHeight = hovered.showTimes ? 200 : hovered.payLabel ? 170 : 140;
    const left = Math.min(
        Math.max(12, hovered.x + pad),
        Math.max(12, window.innerWidth - estimatedWidth - 12),
    );
    const top = Math.min(
        Math.max(12, hovered.y - estimatedHeight - 8),
        Math.max(12, window.innerHeight - estimatedHeight - 12),
    );

    return createPortal(
        <AnimatePresence>
            <motion.div
                key={hovered.dateKey}
                initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: DASH_EASE }}
                className="pointer-events-none fixed z-[120]"
                style={{ left, top }}
            >
                <div
                    className="min-w-[230px] max-w-[290px] rounded-3xl border border-white/15 px-5 py-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.38)] backdrop-blur-md"
                    style={{
                        background: 'linear-gradient(180deg, rgba(15,23,42,0.97), rgba(15,23,42,0.9))',
                        boxShadow: `0 18px 44px ${hovered.color}55, 0 24px 60px rgba(15,23,42,0.38)`,
                    }}
                >
                    <div
                        className="h-1.5 w-full rounded-full mb-3"
                        style={{ background: `linear-gradient(90deg, ${hovered.color}, ${hovered.color}66)` }}
                    />
                    <div className="flex items-center gap-2.5 mb-1">
                        <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 ring-4 ring-white/15"
                            style={{ backgroundColor: hovered.color }}
                        />
                        <span className="text-base font-black tracking-tight leading-tight">
                            {hovered.status}
                        </span>
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                        {hovered.dateLabel}
                    </p>
                    {hovered.payLabel ? (
                        <span
                            className={`inline-flex items-center justify-center min-h-[22px] px-2.5 rounded-md text-[10px] font-bold uppercase tracking-wide mb-2 ${
                                hovered.payMuted ? 'bg-white/10 text-slate-300' : ''
                            }`}
                            style={
                                hovered.payMuted
                                    ? undefined
                                    : { backgroundColor: hovered.color, color: '#ffffff' }
                            }
                        >
                            {hovered.payLabel}
                        </span>
                    ) : null}
                    {hovered.showTimes ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                    {hovered.expectedTimes ? 'Expected in' : 'Check in'}
                                </p>
                                <p className="text-lg font-black tabular-nums leading-none mt-1">
                                    {hovered.timeIn || '—'}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                    {hovered.expectedTimes ? 'Expected out' : 'Check out'}
                                </p>
                                <p className="text-lg font-black tabular-nums leading-none mt-1">
                                    {hovered.timeOut || '—'}
                                </p>
                            </div>
                        </div>
                    ) : hovered.detail ? (
                        <p className="text-xs font-semibold text-slate-300 leading-snug mt-1">
                            {hovered.detail}
                        </p>
                    ) : null}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}

function nextDateKey(dateKey) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function firstEligibleAdvanceRequestDate(todayKey, holidayDates, offWeekdays) {
    let cursor = todayKey;
    let workingSeen = 0;
    for (let i = 0; i < 90; i += 1) {
        cursor = nextDateKey(cursor);
        const [year, month, day] = cursor.split('-').map(Number);
        const weekdayKey =
            WEEKDAY_KEYS[new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay()];
        if (holidayDates.has(cursor) || offWeekdays.has(weekdayKey)) continue;
        workingSeen += 1;
        if (workingSeen >= 2) return cursor;
    }
    return null;
}

function isApprovedFutureLateEarly(record) {
    const kind = String(record?.leaveRequestKind || '');
    const approved =
        record?.leaveRequestStatus === 'approved' || record?.approvalStatus === 'approved';
    return approved && (kind === 'future_late' || kind === 'future_early');
}

function dayTone({ record, isFuture, isHoliday, isWeeklyOff, holidayName, isToday }) {
    if (isHoliday || isWeeklyOff || (record && OFF_DAY_KEYS.has(record.statusKey))) {
        const why =
            holidayName ||
            record?.reason ||
            (record?.statusLabel &&
            record.statusLabel !== 'Holiday' &&
            record.statusLabel !== 'Off Day'
                ? record.statusLabel
                : '');
        return {
            cell: TONE.holiday,
            label: why ? `Holiday — ${why}` : 'Holiday',
        };
    }
    if (record && AUTHORIZED_LEAVE_KEYS.has(record.statusKey)) {
        return {
            cell: TONE.authorizedLeave,
            label: 'Authorized Leave',
            payType: authorizedPayType(record),
        };
    }
    if (isApprovedFutureLateEarly(record) && (isFuture || !record?.timeIn)) {
        return { cell: TONE.present, label: 'Late arrival approved' };
    }
    if (isFuture) {
        return {
            cell: TONE.future,
            label: 'Upcoming',
        };
    }
    if (record && UNAUTHORIZED_KEYS.has(record.statusKey) && isMispunchReason(record.reason)) {
        return {
            cell: TONE.yellow,
            label: 'Mispunched',
        };
    }
    if (record && UNAUTHORIZED_KEYS.has(record.statusKey)) {
        return {
            cell: TONE.unauthorized,
            label: 'Unauthorized Leave',
        };
    }
    if (record && SICK_LEAVE_KEYS.has(record.statusKey)) {
        return {
            cell: TONE.sickLeave,
            label: record.statusLabel || 'Sick Leave',
        };
    }
    if (record && LEAVE_KEYS.has(record.statusKey)) {
        return {
            cell: TONE.leave,
            label: record.statusLabel || 'On Leave',
        };
    }
    if (record && ABSENT_KEYS.has(record.statusKey)) {
        return {
            cell: TONE.absent,
            label: 'Absent',
        };
    }
    if (record && YELLOW_STATUS_KEYS.has(record.statusKey)) {
        if (LATE_ARRIVAL_KEYS.has(record.statusKey)) {
            const detail = record.reason ? ` — ${record.reason}` : '';
            return { cell: TONE.yellow, label: `Late Arrival${detail}` };
        }
        return { cell: TONE.yellow, label: 'Mispunched' };
    }
    if (
        record &&
        PRESENT_KEYS.has(record.statusKey) &&
        (record.timeOut || record.statusKey === 'work_from_home')
    ) {
        return {
            cell: TONE.present,
            label: record.statusLabel || 'Present',
        };
    }
    if (record?.timeIn && !record?.timeOut) {
        if (record.statusKey === 'late_arrived') {
            const detail = record.reason ? ` — ${record.reason}` : '';
            return {
                cell: TONE.yellow,
                label: `Late Arrival${detail}`,
            };
        }
        if (!isToday) {
            return {
                cell: TONE.yellow,
                label: 'Mispunched',
            };
        }
        return {
            cell: TONE.present,
            label: record.statusLabel || 'On time',
        };
    }
    if (!isFuture && !isToday) {
        return {
            cell: TONE.absent,
            label: 'Absent',
        };
    }
    return {
        cell: TONE.future,
        label: '—',
    };
}

export default function DashboardAttendanceCalendar({
    forEmployeeId = '',
    hideTeamControls = false,
    className = '',
}) {
    const searchParams = useSearchParams();
    const todayKey = getDubaiDateKey();
    const deepAttendanceDate = String(searchParams?.get('attendanceDate') || '').trim();
    const deepFocus = searchParams?.get('focusAttendance') === '1';

    const monthAnchor = useMemo(() => {
        const anchorKey =
            deepFocus && /^\d{4}-\d{2}-\d{2}$/.test(deepAttendanceDate)
                ? deepAttendanceDate
                : todayKey;
        try {
            return startOfMonth(parseISO(anchorKey));
        } catch {
            return startOfMonth(new Date());
        }
    }, [todayKey, deepFocus, deepAttendanceDate]);

    const monthKey = format(monthAnchor, 'yyyy-MM');
    const [recordsByDate, setRecordsByDate] = useState({});
    const [todayRecord, setTodayRecord] = useState(null);
    const [employeeName, setEmployeeName] = useState('');
    const [staffType, setStaffType] = useState('office');
    const [scheduleWeek, setScheduleWeek] = useState(null);
    const [offWeekdays, setOffWeekdays] = useState(() => new Set(['saturday', 'sunday']));
    const [selfEmployeeId, setSelfEmployeeId] = useState('');
    const lockedEmployeeId = String(forEmployeeId || '').trim();
    const [viewEmployeeId, setViewEmployeeId] = useState(lockedEmployeeId);
    const [isSelf, setIsSelf] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [teamOpen, setTeamOpen] = useState(false);
    const [holidayRows, setHolidayRows] = useState([]);

    const [requestModal, setRequestModal] = useState(null);
    const [requestSubmitting, setRequestSubmitting] = useState(false);
    const [requestError, setRequestError] = useState('');
    const [yellowModal, setYellowModal] = useState(null);
    const [yellowSubmitting, setYellowSubmitting] = useState(false);
    const [yellowError, setYellowError] = useState('');
    const [futureModal, setFutureModal] = useState(null);
    const [futureSubmitting, setFutureSubmitting] = useState(false);
    const [futureError, setFutureError] = useState('');
    const [decideModal, setDecideModal] = useState(null);
    const [decideSubmitting, setDecideSubmitting] = useState(false);
    const [decideError, setDecideError] = useState('');
    const [deepLinkApplied, setDeepLinkApplied] = useState(false);
    const [hoveredDay, setHoveredDay] = useState(null);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (lockedEmployeeId) setViewEmployeeId(lockedEmployeeId);
    }, [lockedEmployeeId]);

    const activeEmployeeId = viewEmployeeId || selfEmployeeId;

    const { holidayDates, holidayNamesByDate } = useMemo(() => {
        const dates = new Set();
        const names = {};
        holidayRows.forEach((h) => {
            if (!h?.date || !holidayAppliesToStaff(h, staffType)) return;
            dates.add(h.date);
            names[h.date] = h.name || h.note || 'Holiday';
        });
        return { holidayDates: dates, holidayNamesByDate: names };
    }, [holidayRows, staffType]);

    const loadHolidays = useCallback(async () => {
        try {
            const year = Number(monthKey.slice(0, 4));
            const res = await axiosInstance.get('/Holiday', {
                params: { year },
                skipToast: true,
            });
            setHolidayRows(Array.isArray(res.data?.holidays) ? res.data.holidays : []);
        } catch {
            setHolidayRows([]);
        }
    }, [monthKey]);

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
            const nextStaffType = res.data?.employee?.staffType === 'site' ? 'site' : 'office';
            setStaffType(nextStaffType);
            setScheduleWeek(res.data?.workingTime?.[nextStaffType] || null);
            setOffWeekdays(new Set(Array.isArray(res.data?.offWeekdays) ? res.data.offWeekdays : []));
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
        loadHolidays();
    }, [loadMonth, loadHolidays]);

    useEffect(() => {
        const onChanged = () => {
            if (!viewEmployeeId) loadMonth();
            else loadMonth();
        };
        const onHolidays = () => loadHolidays();
        const onWorkingTime = () => loadMonth();
        window.addEventListener(ATTENDANCE_CHECK_CHANGED, onChanged);
        window.addEventListener('verp:holidays-changed', onHolidays);
        window.addEventListener('verp:working-time-changed', onWorkingTime);
        return () => {
            window.removeEventListener(ATTENDANCE_CHECK_CHANGED, onChanged);
            window.removeEventListener('verp:holidays-changed', onHolidays);
            window.removeEventListener('verp:working-time-changed', onWorkingTime);
        };
    }, [loadMonth, loadHolidays, viewEmployeeId]);

    useEffect(() => {
        if (deepLinkApplied) return;
        const focus = searchParams?.get('focusAttendance');
        const empId = String(searchParams?.get('attendanceEmployeeId') || '').trim();
        const dateKey = String(searchParams?.get('attendanceDate') || '').trim();
        if (focus !== '1' || !empId) return;

        setViewEmployeeId(empId);
        setDeepLinkApplied(true);

        if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            setDecideModal({
                dateKey,
                pendingOpen: true,
            });
        }
    }, [searchParams, deepLinkApplied]);

    useEffect(() => {
        if (!decideModal?.pendingOpen || !decideModal?.dateKey || loading) return;
        const record = recordsByDate[decideModal.dateKey];
        if (!record || record.leaveRequestStatus !== 'pending') {
            setDecideModal(null);
            return;
        }
        setDecideModal({
            dateKey: decideModal.dateKey,
            record,
            pendingOpen: false,
        });
    }, [decideModal, recordsByDate, loading]);

    const days = useMemo(() => {
        const start = startOfMonth(monthAnchor);
        const end = endOfMonth(monthAnchor);
        return eachDayOfInterval({ start, end });
    }, [monthAnchor]);

    const leadingBlanks = getDay(startOfMonth(monthAnchor));
    const timeInLabel = formatClock(todayRecord?.timeIn);
    const timeOutLabel = formatClock(todayRecord?.timeOut);
    const viewingOther = !isSelf;
    const earliestFutureDate = useMemo(
        () => firstEligibleAdvanceRequestDate(todayKey, holidayDates, offWeekdays),
        [todayKey, holidayDates, offWeekdays],
    );

    const openRequestForDay = (dateKey, record, toneLabel) => {
        if (!isSelf) return;
        if (!record || !RED_CLICK_KEYS.has(record.statusKey)) return;
        if (isMispunchReason(record.reason)) return;
        if (record.leaveRequestStatus === 'pending') {
            setRequestError('A leave request is already pending for this date.');
            setRequestModal({ dateKey, record, label: toneLabel });
            return;
        }
        setRequestError('');
        setRequestModal({ dateKey, record, label: toneLabel });
    };

    const openYellowForDay = (dateKey, record, toneLabel) => {
        if (!isSelf) return;
        if (!record) return;
        if (record.leaveRequestStatus === 'pending') {
            setYellowError('A request is already pending for this date.');
            setYellowModal({ dateKey, record, label: toneLabel });
            return;
        }
        setYellowError('');
        setYellowModal({ dateKey, record, label: toneLabel });
    };

    const openFutureForDay = (dateKey, record) => {
        if (!isSelf) return;
        if (record?.leaveRequestStatus === 'pending') {
            setFutureError('A request is already pending for this date.');
            setFutureModal({ dateKey, record });
            return;
        }
        setFutureError('');
        setFutureModal({ dateKey, record: record || null });
    };

    const openDecideForDay = (dateKey, record) => {
        if (isSelf) return;
        if (!record || record.leaveRequestStatus !== 'pending') return;
        setDecideError('');
        setDecideModal({ dateKey, record, pendingOpen: false });
    };

    const submitLeaveRequest = async ({
        requestedStatusKey,
        reason,
        attachmentName,
    }) => {
        if (!requestModal?.dateKey || !requestedStatusKey) return;
        setRequestSubmitting(true);
        setRequestError('');
        try {
            await axiosInstance.post(
                '/Attendance/me/leave-request',
                {
                    date: requestModal.dateKey,
                    requestedStatusKey,
                    reason: reason || '',
                    attachmentName: attachmentName || '',
                },
                { skipToast: true },
            );
            notifyAttendancePendingInboxChanged();
            setRequestModal(null);
            await loadMonth();
        } catch (err) {
            setRequestError(err?.response?.data?.message || 'Could not send leave request.');
        } finally {
            setRequestSubmitting(false);
        }
    };

    const submitYellowRequest = async ({ reason, attachmentName }) => {
        if (!yellowModal?.dateKey) return;
        setYellowSubmitting(true);
        setYellowError('');
        try {
            await axiosInstance.post(
                '/Attendance/me/yellow-request',
                {
                    date: yellowModal.dateKey,
                    reason,
                    attachmentName: attachmentName || '',
                },
                { skipToast: true },
            );
            notifyAttendancePendingInboxChanged();
            setYellowModal(null);
            await loadMonth();
        } catch (err) {
            setYellowError(err?.response?.data?.message || 'Could not send clarification.');
        } finally {
            setYellowSubmitting(false);
        }
    };

    const submitFutureRequest = async ({
        kind,
        fromDate,
        toDate,
        dayPart,
        timeIn,
        timeOut,
        reason,
        attachmentName,
    }) => {
        if (!futureModal?.dateKey || !kind) return;
        setFutureSubmitting(true);
        setFutureError('');
        try {
            await axiosInstance.post(
                '/Attendance/me/future-request',
                {
                    date: fromDate || futureModal.dateKey,
                    fromDate: fromDate || futureModal.dateKey,
                    toDate: toDate || fromDate || futureModal.dateKey,
                    kind,
                    dayPart: dayPart || 'full',
                    timeIn: timeIn || '',
                    timeOut: timeOut || '',
                    reason,
                    attachmentName: attachmentName || '',
                },
                { skipToast: true },
            );
            notifyAttendancePendingInboxChanged();
            setFutureModal(null);
            await loadMonth();
        } catch (err) {
            setFutureError(err?.response?.data?.message || 'Could not send request.');
        } finally {
            setFutureSubmitting(false);
        }
    };

    const submitLeaveDecision = async (decision, approvedStatusKey, leavePayType) => {
        if (!decideModal?.record?._id && !decideModal?.dateKey) return;
        setDecideSubmitting(true);
        setDecideError('');
        try {
            await axiosInstance.post(
                '/Attendance/me/leave-request/decide',
                {
                    attendanceId: decideModal.record?._id,
                    date: decideModal.dateKey,
                    employeeMongoId: decideModal.record?.employeeMongoId || viewEmployeeId,
                    decision,
                    approvedStatusKey: approvedStatusKey || '',
                    leavePayType: leavePayType || '',
                },
                { skipToast: true },
            );
            notifyAttendancePendingInboxChanged();
            setDecideModal(null);
            await loadMonth();
        } catch (err) {
            setDecideError(err?.response?.data?.message || 'Could not update leave request.');
        } finally {
            setDecideSubmitting(false);
        }
    };

    return (
        <>
            <motion.div
                variants={dashboardItem}
                whileHover={hideTeamControls ? undefined : dashboardHover}
                className={`dash-card-lift col-span-12 lg:col-span-6 bg-white rounded-2xl sm:rounded-[20px] p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[220px] sm:min-h-[280px] lg:h-[380px] lg:max-h-[380px] lg:min-h-[380px] ${className}`.trim()}
            >
                <div className="flex items-start justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-[0.14em]">
                            {hideTeamControls || viewingOther ? 'Employee Attendance' : 'My Attendance'}
                            {staffType ? (
                                <span className="ml-1.5 text-slate-500 normal-case tracking-normal">
                                    · {staffType === 'site' ? 'Site' : 'Office'}
                                </span>
                            ) : null}
                        </p>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                            {format(monthAnchor, 'MMMM yyyy')}
                        </h3>
                        <p className="text-xs text-slate-400 tabular-nums mt-0.5">{todayKey}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-0">
                        {hideTeamControls ? null : (
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
                                    className="inline-flex items-center h-7 px-2.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200 hover:bg-slate-200"
                                >
                                    Back to me
                                </button>
                            ) : null}
                        </div>
                        )}
                        {viewingOther && employeeName ? (
                            <div className="text-right max-w-[200px]">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    User&apos;s account
                                </p>
                                <p className="text-sm font-bold text-slate-800 truncate">
                                    {toTitleName(employeeName)}
                                </p>
                            </div>
                        ) : employeeName && isSelf ? (
                            <p className="text-[11px] text-slate-500 truncate max-w-[180px] text-right">
                                {toTitleName(employeeName)}
                            </p>
                        ) : null}
                        {(timeInLabel || timeOutLabel) && isSelf ? (
                            <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 tabular-nums">
                                <Clock className="w-3 h-3" />
                                {timeInLabel || '—'}
                                {timeOutLabel ? ` – ${timeOutLabel}` : ''}
                            </p>
                        ) : null}
                    </div>
                </div>

                {error ? (
                    <div className="mt-3 flex-1 flex flex-col items-center justify-center gap-2">
                        <p className="text-[11px] text-red-500">{error}</p>
                        <button
                            type="button"
                            onClick={() => loadMonth()}
                            className="text-xs font-semibold text-sky-600 hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : loading ? (
                    <div className="mt-3 flex-1 flex items-center justify-center">
                        <p className="text-sm text-slate-400">Loading…</p>
                    </div>
                ) : (
                    <div className="mt-3 flex-1 flex flex-col min-h-0">
                        <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 shrink-0">
                            {WEEKDAYS.map((d) => (
                                <div
                                    key={d}
                                    className="text-center text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wide"
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="mt-1 grid grid-cols-7 gap-y-1 gap-x-0.5 flex-1 content-start">
                            {Array.from({ length: leadingBlanks }).map((_, i) => (
                                <div key={`blank-${i}`} className="min-h-0" />
                            ))}
                            {days.map((day) => {
                                if (!isSameMonth(day, monthAnchor)) return null;
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                                const record = recordsByDate[dateKey];
                                const isFuture = dateKey > todayKey;
                                const holidayName =
                                    holidayNamesByDate[dateKey] ||
                                    (record?.statusKey === 'holiday' ? record?.reason : '') ||
                                    '';
                                const isHoliday =
                                    holidayDates.has(dateKey) || record?.statusKey === 'holiday';
                                const isWeeklyOff =
                                    !isHoliday &&
                                    (record?.statusKey === 'weekly_off' ||
                                        offWeekdays.has(weekdayKey));
                                const tone = dayTone({
                                    record,
                                    isFuture,
                                    isHoliday,
                                    isWeeklyOff,
                                    holidayName,
                                    isToday: dateKey === todayKey,
                                });
                                const isToday = dateKey === todayKey;
                                const pendingLeave = record?.leaveRequestStatus === 'pending';
                                const canRequest =
                                    isSelf &&
                                    !isFuture &&
                                    record &&
                                    RED_CLICK_KEYS.has(record.statusKey) &&
                                    !isMispunchReason(record.reason) &&
                                    isRedTone(tone.cell);
                                const canYellowRequest =
                                    isSelf &&
                                    !isFuture &&
                                    record &&
                                    isYellowTone(tone.cell);
                                const alreadyApprovedFuture =
                                    record?.statusKey === 'authorized_leave' ||
                                    isApprovedFutureLateEarly(record);
                                const canFutureRequest =
                                    isSelf &&
                                    isFuture &&
                                    !isHoliday &&
                                    !isWeeklyOff &&
                                    Boolean(earliestFutureDate) &&
                                    dateKey >= earliestFutureDate &&
                                    record?.leaveRequestStatus !== 'pending' &&
                                    !alreadyApprovedFuture;
                                const canDecide = viewingOther && pendingLeave;

                                const hoverHint = pendingLeave
                                    ? 'Request pending'
                                    : canFutureRequest
                                      ? 'Request leave or late arrival'
                                      : isFuture &&
                                          !isHoliday &&
                                          !isWeeklyOff &&
                                          earliestFutureDate &&
                                          dateKey < earliestFutureDate
                                        ? `Requests open from ${earliestFutureDate}`
                                        : '';

                                const showDayHover = (event) => {
                                    const baseLabel = String(tone.label || 'Attendance').split(' — ')[0];
                                    const payType = tone.payType || authorizedPayType(record);
                                    const isAuthorizedLeave = AUTHORIZED_LEAVE_KEYS.has(record?.statusKey);
                                    const payWord = payType === 'paid' ? 'Paid' : payType === 'unpaid' ? 'Unpaid' : '';
                                    const statusLabel =
                                        isAuthorizedLeave && payWord ? `${baseLabel} (${payWord})` : baseLabel;
                                    const punchedIn = formatClock(record?.timeIn);
                                    const punchedOut = formatClock(record?.timeOut);
                                    const requestedIn = formatClock(record?.leaveRequestTimeIn);
                                    const requestedOut = formatClock(record?.leaveRequestTimeOut);
                                    // Future days have no punches yet, so the approved request window
                                    // is the only timing to show.
                                    const showExpected =
                                        !punchedIn &&
                                        !punchedOut &&
                                        Boolean(requestedIn || requestedOut);
                                    setHoveredDay({
                                        dateKey,
                                        dateLabel: format(day, 'd MMM yyyy'),
                                        status: statusLabel,
                                        detail: hoverHint || (tone.label !== baseLabel ? tone.label : ''),
                                        payLabel:
                                            payWord ||
                                            (isAuthorizedLeave ? 'Pay type not set' : ''),
                                        payMuted: isAuthorizedLeave && !payWord,
                                        color: colorFromToneCell(tone.cell),
                                        showTimes: shouldShowPunchTimes(record, tone) || showExpected,
                                        expectedTimes: showExpected,
                                        timeIn: showExpected ? requestedIn : punchedIn,
                                        timeOut: showExpected ? requestedOut : punchedOut,
                                        x: event.clientX,
                                        y: event.clientY,
                                    });
                                };

                                return (
                                    <div
                                        key={dateKey}
                                        onMouseEnter={showDayHover}
                                        onMouseMove={showDayHover}
                                        onMouseLeave={() => setHoveredDay(null)}
                                        className="min-h-0 flex items-center justify-center py-0.5 relative"
                                    >
                                        <button
                                            type="button"
                                            disabled={
                                                !canRequest &&
                                                !canYellowRequest &&
                                                !canFutureRequest &&
                                                !canDecide
                                            }
                                            onClick={() => {
                                                if (canDecide) openDecideForDay(dateKey, record);
                                                else if (canRequest)
                                                    openRequestForDay(dateKey, record, tone.label);
                                                else if (canYellowRequest)
                                                    openYellowForDay(dateKey, record, tone.label);
                                                else if (canFutureRequest)
                                                    openFutureForDay(dateKey, record);
                                            }}
                                            className={`dash-cal-day relative w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-semibold tabular-nums leading-none shadow-sm ${tone.cell} ${
                                                isToday ? 'ring-2 ring-sky-400 ring-offset-1' : ''
                                            } ${
                                                canRequest ||
                                                canYellowRequest ||
                                                canFutureRequest ||
                                                canDecide
                                                    ? 'cursor-pointer hover:brightness-95 hover:scale-110'
                                                    : 'cursor-default pointer-events-none'
                                            }`}
                                            style={{ animationDelay: `${Number(format(day, 'd')) * 18}ms` }}
                                        >
                                            {format(day, 'd')}
                                            {pendingLeave ? (
                                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-900 text-[9px] font-black leading-none flex items-center justify-center border border-white shadow">
                                                    !
                                                </span>
                                            ) : null}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </motion.div>

            <CalendarDayTooltip hovered={hoveredDay} reduceMotion={reduceMotion} />

            {hideTeamControls ? null : (
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
            )}

            <AttendanceLeaveRequestModal
                key={requestModal?.dateKey || 'leave-closed'}
                isOpen={Boolean(requestModal)}
                dateKey={requestModal?.dateKey}
                currentLabel={requestModal?.label || requestModal?.record?.statusLabel}
                submitting={requestSubmitting}
                error={requestError}
                onClose={() => {
                    if (requestSubmitting) return;
                    setRequestModal(null);
                    setRequestError('');
                }}
                onSubmit={submitLeaveRequest}
            />

            <AttendanceYellowRequestModal
                key={yellowModal?.dateKey || 'yellow-closed'}
                isOpen={Boolean(yellowModal)}
                dateKey={yellowModal?.dateKey}
                currentLabel={yellowModal?.label || yellowModal?.record?.statusLabel}
                submitting={yellowSubmitting}
                error={yellowError}
                onClose={() => {
                    if (yellowSubmitting) return;
                    setYellowModal(null);
                    setYellowError('');
                }}
                onSubmit={submitYellowRequest}
            />

            <AttendanceFutureRequestModal
                key={futureModal?.dateKey || 'future-closed'}
                isOpen={Boolean(futureModal)}
                dateKey={futureModal?.dateKey}
                earliestDate={earliestFutureDate || ''}
                scheduleWeek={scheduleWeek}
                submitting={futureSubmitting}
                error={futureError}
                onClose={() => {
                    if (futureSubmitting) return;
                    setFutureModal(null);
                    setFutureError('');
                }}
                onSubmit={submitFutureRequest}
            />

            <AttendanceLeaveDecideModal
                isOpen={Boolean(decideModal && !decideModal.pendingOpen && decideModal.record)}
                dateKey={decideModal?.dateKey}
                employeeName={employeeName}
                currentLabel={
                    decideModal?.record?.previousStatusLabel ||
                    decideModal?.record?.statusLabel ||
                    ''
                }
                requestedLabel={decideModal?.record?.requestedStatusLabel || ''}
                reason={
                    decideModal?.record?.leaveRequestReason || decideModal?.record?.reason || ''
                }
                attachmentName={decideModal?.record?.attachmentName || ''}
                kind={decideModal?.record?.leaveRequestKind || 'leave'}
                fromDate={decideModal?.record?.leaveRequestFromDate || ''}
                toDate={decideModal?.record?.leaveRequestToDate || ''}
                dayPart={decideModal?.record?.leaveRequestDayPart || ''}
                requestTimeIn={decideModal?.record?.leaveRequestTimeIn || ''}
                requestTimeOut={decideModal?.record?.leaveRequestTimeOut || ''}
                deciding={decideSubmitting}
                error={decideError}
                onClose={() => {
                    if (decideSubmitting) return;
                    setDecideModal(null);
                    setDecideError('');
                }}
                onDecide={submitLeaveDecision}
            />
        </>
    );
}
