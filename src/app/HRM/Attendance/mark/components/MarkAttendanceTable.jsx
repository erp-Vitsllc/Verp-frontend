'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import { nonHrMarkableDateKeys } from '@/app/HRM/Attendance/utils/nonHrMarkWindow';
import { weekForStaffType } from '@/utils/workLocations';
import MarkAttendanceDetailsModal, {
    getMarkFormConfig,
} from './MarkAttendanceDetailsModal';
import {
    PunchLocationPinCell,
    PunchTypeCell,
    normalizePunchType,
    punchCoords,
} from './MarkAttendancePunchCells';
import FlexibleOtModal from './FlexibleOtModal';
import HourAdjustModal, { hourAdjustOffer } from './HourAdjustModal';
import CompOffSettleModal from '../../components/CompOffSettleModal';

const MARK_OPTIONS = [
    { key: 'on_office', label: 'On work' },
    {
        key: 'on_leave',
        label: 'On leave',
        children: [
            { key: 'sick_leave', label: 'Sick leave' },
            { key: 'authorized_leave', label: 'Authorized leave' },
            { key: 'compoff_leave', label: 'Comp off leave' },
        ],
    },
    { key: 'clear_attendance', label: 'Clear attendance' },
];

function shiftMarks(timeIn, timeOut, timeOutDate, date) {
    const toMinutes = (value) => {
        const parts = String(value || '').split(':').map(Number);
        if (parts.length < 2 || parts.slice(0, 2).some((n) => Number.isNaN(n))) return null;
        return parts[0] * 60 + parts[1];
    };
    const inMin = toMinutes(timeIn);
    const outMin = toMinutes(timeOut);
    if (inMin == null || outMin == null) return { sun: false, moon: false };
    // Same calendar day is a day shift, including late arrival and early go.
    // Night is only a check-out after the next midnight.
    const crossesMidnight = Boolean(timeOutDate && date && timeOutDate !== date) || outMin < inMin;
    if (crossesMidnight) return { sun: false, moon: true };
    return { sun: true, moon: false };
}

function currentEmployeeMongoId() {
    if (typeof window === 'undefined') return '';
    try {
        for (const key of ['employeeUser', 'user']) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const user = JSON.parse(raw);
            const id = user?.employeeObjectId || user?.employeeMongoId || '';
            if (id) return String(id);
        }
    } catch {
        return '';
    }
    return '';
}

function wholeHourCount(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours + 1e-9);
}

function isOtPunch(value) {
    return String(value || '').trim() === 'OT';
}

function hoursDurationLabel(hours) {
    const value = Number(hours);
    if (!Number.isFinite(value) || value <= 0) return '—';
    const totalMinutes = Math.round(value * 60);
    const whole = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${whole}h ${String(mins).padStart(2, '0')}m`;
}

function coversWorkingDay(otHours, requiredHours) {
    const hours = Number(otHours) || 0;
    const required = Number(requiredHours) || 0;
    if (required > 0) return hours + 1e-9 >= required;
    return hours > 10;
}

function scheduleDayHours(week, dateKey) {
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return 0;
    const key = weekdayKeyFromDate(dateKey);
    const day = key ? week[key] : null;
    if (day && !day.isOffDay) {
        const hours = Number(day.workingHours);
        if (Number.isFinite(hours) && hours > 0) return hours;
    }
    const standard = Number(week.hoursPerDay);
    return Number.isFinite(standard) && standard > 0 ? standard : 0;
}

function formatAdjDay(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
    const [year, month, day] = dateKey.split('-').map(Number);
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
    return `${String(day).padStart(2, '0')}-${monthName}-${year}`;
}

function otCellLabel(mark) {
    const status = String(mark?.flexibleOtStatus || '');
    const approved = Number(mark?.flexibleOtApprovedHours) || 0;
    const required = Number(mark?.flexibleRequiredHours) || 0;
    const nextDay = String(mark?.flexibleOtNextDayDate || '').trim();
    if (status === 'approved') {
        if (nextDay || (!required && approved > 10)) return 'Next day';
        return `OT: ${wholeHourCount(approved)} hr`;
    }
    if (status === 'rejected') return 'OT: 0 hr';
    if (status === 'pending') return 'Pending';
    return '';
}

function formatDisplayTime(value) {
    if (!value) return '—';
    return value;
}

function shortEmployeeName(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return '—';
    if (parts.length === 1) return parts[0];
    const letter = parts[1].charAt(0).toUpperCase();
    return letter ? `${parts[0]} ${letter}` : parts[0];
}

function clockSortSeconds(value, nextDay = false) {
    const text = String(value || '').trim();
    if (!text || text === '—') return null;
    const parts = text.split(':').map(Number);
    if (parts.length < 2 || parts.slice(0, 2).some((n) => Number.isNaN(n))) return null;
    const seconds = parts.length > 2 && !Number.isNaN(parts[2]) ? parts[2] : 0;
    return parts[0] * 3600 + parts[1] * 60 + seconds + (nextDay ? 24 * 3600 : 0);
}

function punchSpanSeconds(timeIn, timeOut, timeOutDate, date) {
    const start = clockSortSeconds(timeIn);
    const end = clockSortSeconds(timeOut);
    if (start == null || end == null) return null;
    let diff = end - start;
    const nextDay = Boolean(timeOutDate && date && timeOutDate !== date);
    if (nextDay || diff < 0) diff += 24 * 3600;
    if (diff < 0) return null;
    return diff;
}

function punchDurationLabel(timeIn, timeOut, timeOutDate, date) {
    const diff = punchSpanSeconds(timeIn, timeOut, timeOutDate, date);
    if (diff == null) return '—';
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function dubaiDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function shiftDateKey(dateKey, deltaDays) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const HR_ONLY_MARK_TITLE =
    'Only the flowchart HR assignee can mark attendance outside today and the two previous days, including future days. Holidays are skipped.';
const HR_ONLY_CLEAR_TITLE = 'Only the flowchart HR assignee can clear attendance.';
const RECENT_MARK_NOTE =
    'Any status can be marked for today and the two previous days. Holidays are skipped.';

function storedViewerUser() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('user') || localStorage.getItem('employeeUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function viewerIsDesignatedFlowchartHr(user, holder) {
    if (!user || !holder?.ok) return false;
    const holderId = String(holder.empObjectId || '').trim();
    const myIds = [user.employeeObjectId, user.empObjectId, user._id, user.id]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    if (holderId && myIds.includes(holderId)) return true;
    const myEid = String(user.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    const hrEid = String(holder.employeeId || '').trim().toLowerCase().replace(/\s+/g, '');
    return Boolean(myEid && hrEid && myEid === hrEid);
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function weekdayKeyFromDate(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
    const dayIndex = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
    return WEEKDAY_KEYS[dayIndex] || '';
}

function markForNonWorkingDay(mark, timeIn, timeOut, dayBaseline) {
    const punched =
        (timeIn && timeIn !== '—') || (timeOut && timeOut !== '—');
    const key = String(mark?.key || '').trim();
    const blank = !key || key === 'not_marked' || key === 'absent' || key === 'unauthorized_leave';
    if (!dayBaseline || punched || !blank) return mark;
    if (dayBaseline === 'holiday') {
        return { ...(mark || {}), key: 'holiday', label: 'Holiday', reason: 'Holiday' };
    }
    return { ...(mark || {}), key: 'weekly_off', label: 'Off Day', reason: 'Weekly off' };
}

function formatStatusLabel(mark, timeIn, pastDay = false) {
    const key = String(mark?.key || '').trim();
    const raw = String(mark?.label || '').trim();
    if (/\(Approved\)/i.test(raw)) return raw;
    const kind = String(mark?.leaveRequestKind || '').trim();
    const punchedIn = Boolean(timeIn && timeIn !== '—');
    const missedDay = pastDay ? 'Unauth' : 'Absent';

    if (key === 'late_arrived' || /late arrival/i.test(raw)) return 'Present (Late Arrival)';
    if (key === 'early_go' || /early go/i.test(raw)) return 'Present (Early Go)';
    if (key === 'mispunch') return raw || 'Mispunched';
    if (key === 'unauthorized_leave') {
        const session = String(mark?.leaveRequestSession || '');
        const text = `${raw} ${mark?.reason || ''}`;
        if (session === 'pm' || /early/i.test(text) || /\(PM\)/i.test(text)) return 'Present (Early Go)';
        if (session === 'am' || /late arrival/i.test(text) || /\(AM\)/i.test(text)) return 'Present (Late Arrival)';
        return 'Unauth';
    }
    if (key === 'authorized_leave') {
        const halfAt = raw.indexOf('·');
        if (halfAt >= 0) return `Auth ${raw.slice(halfAt).trim()}`;
        return 'Auth';
    }
    if (key === 'sick_leave') return raw || 'Sick Leave';
    if (key === 'compoff_leave') return raw || 'Comp Off Leave';
    if (key === 'on_leave' || kind === 'future_annual') {
        if (!raw || /^on leave$/i.test(raw) || /annual/i.test(raw)) return 'Annual';
        return raw;
    }
    if (key === 'work_from_home') return raw || 'Work from home';
    if (key === 'weekly_off') return 'Off Day';
    if (key === 'holiday') return raw || 'Holiday';
    if (!punchedIn && (key === '' || key === 'not_marked' || key === 'absent')) return missedDay;
    if (
        key === 'on_office' ||
        key === 'not_marked' ||
        /^(on time|present|on work|on office)$/i.test(raw)
    ) {
        return 'Present (On time)';
    }
    return raw || missedDay;
}

function statusHoverTitle(statusText) {
    const text = String(statusText || '');
    if (text === 'Unauth') return 'Unauthorized Leave';
    if (text === 'Annual') return 'Annual Leave';
    if (text === 'Auth' || text.startsWith('Auth ')) return text.replace(/^Auth/, 'Authorized Leave');
    return text;
}

function rowMenuOptions(baseOptions, mark, { canReviewHour = false } = {}) {
    const offer = hourAdjustOffer(mark);
    if (!offer || String(mark?.hourAdjustStatus || '') === 'approved') return baseOptions;
    const pending = String(mark?.hourAdjustStatus || '') === 'pending';
    const hourItem = {
        key: 'hour_adjust',
        label: pending ? (canReviewHour ? 'Review hours' : 'Hours pending') : offer.button,
        disabled: pending && !canReviewHour,
        disabledTitle: 'Waiting for HR approval',
    };
    const next = [];
    let placed = false;
    for (const option of baseOptions) {
        if (!placed && option.key === 'clear_attendance') {
            next.push(hourItem);
            placed = true;
        }
        next.push(option);
    }
    if (!placed) next.push(hourItem);
    return next;
}

function statusChipClass(mark, label) {
    const key = String(mark?.key || '').trim();
    if (/\(Approved\)/i.test(label) || label === 'Present (Early Go)' || label === 'Present (Late Arrival)') {
        return 'text-amber-800 bg-amber-50';
    }
    if (
        label === 'Absent' ||
        label === 'Unauth' ||
        label === 'Unauthorized Leave' ||
        key === 'absent' ||
        key === 'unauthorized_leave'
    ) {
        return 'text-rose-700 bg-rose-50';
    }
    if (key === 'on_leave' || /^annual$/i.test(label) || /annual leave/i.test(label)) {
        return 'text-indigo-700 bg-indigo-50';
    }
    if (key === 'authorized_leave') return 'text-orange-700 bg-orange-50';
    if (key === 'compoff_leave') return 'text-violet-700 bg-violet-50';
    if (key === 'weekly_off' || key === 'holiday') return 'text-[#9B59B6] bg-purple-50';
    if (key === 'late_arrived' || key === 'early_go' || key === 'mispunch' || label.startsWith('Present (')) {
        if (label === 'Present (On time)') return 'text-emerald-700 bg-emerald-50';
        return 'text-amber-800 bg-amber-50';
    }
    return 'text-emerald-700 bg-emerald-50';
}

function applyDayRecordsToState(employees, records) {
    const byId = new Map(
        (Array.isArray(records) ? records : []).map((r) => [String(r.employeeMongoId), r]),
    );
    const nextMarks = {};
    const nextEmployees = employees.map((e) => {
        const rec = byId.get(e.id);
        if (!rec) {
            return { ...e, timeIn: '—', timeOut: '—' };
        }
        nextMarks[e.id] = {
            key: rec.statusKey,
            label: rec.statusLabel,
            reason: rec.reason || '',
            attachmentName: rec.attachmentName || '',
            punchSource: rec.punchSource || '',
            checkOutSource: rec.checkOutSource || '',
            checkInLocation: rec.checkInLocation || null,
            checkOutLocation: rec.checkOutLocation || null,
            leaveRequestStatus: rec.leaveRequestStatus || '',
            leaveRequestKind: rec.leaveRequestKind || '',
            leaveRequestSession: rec.leaveRequestSession || '',
            hourAdjustStatus: rec.hourAdjustStatus || '',
            hourAdjustKind: rec.hourAdjustKind || '',
            hoursTaken: rec.hoursTaken || 0,
            hoursMax: rec.hoursMax || 0,
            hoursApproved: rec.hoursApproved || 0,
            hourAdjustReason: rec.hourAdjustReason || '',
            approvalStatus: rec.approvalStatus || '',
            attendanceId: String(rec._id || ''),
            date: rec.date || '',
            rawTimeIn: rec.timeIn || '',
            rawTimeOut: rec.timeOut || '',
            timeOutDate: rec.timeOutDate || '',
            flexibleWorkedHours: rec.flexibleWorkedHours || 0,
            flexibleRequiredHours: rec.flexibleRequiredHours || 0,
            flexibleOtHours: rec.flexibleOtHours || 0,
            flexibleOtStatus: rec.flexibleOtStatus || '',
            flexibleOtApprovedHours: rec.flexibleOtApprovedHours || 0,
            flexibleOtReason: rec.flexibleOtReason || '',
            flexibleOtNextDayDate: rec.flexibleOtNextDayDate || '',
            flexibleFromOtDate: rec.flexibleFromOtDate || '',
            compOffState: rec.compOff?.state || '',
        };
        return {
            ...e,
            timeIn: rec.timeIn ? formatDisplayTime(rec.timeIn) : '—',
            timeOut: rec.timeOut ? formatDisplayTime(rec.timeOut) : '—',
        };
    });
    return { nextEmployees, nextMarks };
}

function mergePendingChanges(nextMarks, pendingChanges) {
    const next = { ...nextMarks };
    for (const change of pendingChanges || []) {
        const id = String(change?.employeeMongoId || '');
        if (!id) continue;
        next[id] = {
            ...(next[id] || {}),
            pendingChange: {
                id: String(change.id || ''),
                stage: change.stage || '',
                statusLabel: change.statusLabel || '',
                requestedByName: change.requestedByName || '',
            },
        };
    }
    return next;
}

function mapActiveEmployee(emp) {
    const id = String(emp?._id || emp?.id || emp?.employeeId || '');
    const name =
        [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() ||
        emp?.name ||
        emp?.employeeName ||
        '—';
    const empNo = emp?.employeeId || emp?.empNo || emp?.employeeNo || emp?.employeeCode || '—';
    const staffType = String(emp?.staffType || '').trim().toLowerCase() || 'office';
    return {
        id,
        empNo: String(empNo),
        name,
        staffType,
        primaryReportee: String(emp?.primaryReportee || ''),
        timeIn: '—',
        timeOut: '—',
    };
}

function extractEmployeeRows(payload) {
    if (Array.isArray(payload?.employees)) return payload.employees;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
}

function isActiveEmployee(emp) {
    const profile = String(emp?.profileStatus || '').trim().toLowerCase();
    const status = String(emp?.status || '').trim().toLowerCase();
    return profile === 'active' || status === 'active' || (!profile && !status);
}

function matchesStaffType(emp, staffType) {
    const wanted = String(staffType || 'office').trim().toLowerCase() || 'office';
    const actual = String(emp?.staffType || '').trim().toLowerCase() || 'office';
    return actual === wanted;
}

function employeeMatchesSearch(employee, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    const name = String(employee?.name || '').toLowerCase();
    const empNo = String(employee?.empNo || '').toLowerCase();
    return name.includes(q) || empNo.includes(q);
}

function compareAttendanceSortValues(a, b, direction) {
    const dir = direction === 'desc' ? -1 : 1;
    const aEmpty = a == null || a === '';
    const bEmpty = b == null || b === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
    return (
        String(a).localeCompare(String(b), undefined, {
            numeric: true,
            sensitivity: 'base',
        }) * dir
    );
}

function locationSortText(location) {
    const coords = punchCoords(location);
    if (!coords) return null;
    if (coords.label) return coords.label;
    return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}

function typeSortText(mark, timeOut) {
    const inType = normalizePunchType(mark?.punchSource);
    const outType = normalizePunchType(mark?.checkOutSource);
    const hasOut = Boolean(timeOut && timeOut !== '—');
    if (!inType && !outType) return null;
    if (hasOut && outType && inType && outType !== inType) return `${inType} / ${outType}`;
    return inType || outType;
}

function shiftSortText(mark) {
    const shift = shiftMarks(mark?.rawTimeIn, mark?.rawTimeOut, mark?.timeOutDate, mark?.date);
    if (shift.sun) return 'day';
    if (shift.moon) return 'night';
    return null;
}

function otSortText(mark, ctx) {
    const canReviewOt = ctx.isFlowchartHr && String(mark?.flexibleOtStatus || '') === 'pending';
    if (canReviewOt) return 'review';
    const text = otCellLabel(mark);
    if (text) return text;
    if (!(Number(mark?.flexibleOtHours) > 0)) return null;
    if (ctx.isFlowchartHr) {
        return coversWorkingDay(mark?.flexibleOtHours, mark?.flexibleRequiredHours) ? 'next day present' : 'apply ot';
    }
    return 'req ot';
}

function attendanceSortValue(column, employee, mark, ctx) {
    const timeIn = employee.timeIn || '—';
    const timeOut = employee.timeOut || '—';
    const shownMark = markForNonWorkingDay(mark, timeIn, timeOut, ctx.dayBaseline);
    const outNextDay = Boolean(mark?.timeOutDate && mark?.date && mark.timeOutDate !== mark.date);
    switch (column) {
        case 'slNo':
            return ctx.rosterIndex;
        case 'name':
            return employee.name || '';
        case 'empNo':
            return employee.empNo || '';
        case 'timeIn':
            return clockSortSeconds(mark?.rawTimeIn || timeIn);
        case 'timeOut':
            return clockSortSeconds(mark?.rawTimeOut || timeOut, outNextDay);
        case 'duration': {
            if (isOtPunch(mark?.rawTimeIn || timeIn) || isOtPunch(mark?.rawTimeOut || timeOut)) {
                const credited = Number(mark?.flexibleWorkedHours) || 0;
                return credited > 0 ? Math.round(credited * 3600) : null;
            }
            return punchSpanSeconds(
                mark?.rawTimeIn || timeIn,
                mark?.rawTimeOut || timeOut,
                mark?.timeOutDate,
                mark?.date,
            );
        }
        case 'status':
            return formatStatusLabel(shownMark, timeIn, ctx.pastDay);
        case 'location':
            return [locationSortText(mark?.checkInLocation), locationSortText(mark?.checkOutLocation)]
                .filter(Boolean)
                .join(' / ') || null;
        case 'checkIn':
            return locationSortText(mark?.checkInLocation);
        case 'checkOut':
            return locationSortText(mark?.checkOutLocation);
        case 'type':
            return typeSortText(mark, timeOut);
        case 'shift':
            return shiftSortText(mark);
        case 'ot':
            return otSortText(mark, ctx);
        case 'action':
            return ctx.actionLocked ? 'locked' : 'mark';
        default:
            return employee.name || '';
    }
}

function ColumnSortArrows({ label, columnKey, sortKey, sortDirection, onSort }) {
    const upOn = sortKey === columnKey && sortDirection === 'asc';
    const downOn = sortKey === columnKey && sortDirection === 'desc';
    const buttonClass = (on) =>
        `flex h-3.5 w-3.5 items-center justify-center rounded-sm leading-none ${
            on ? 'text-[#EA3D2F]' : 'text-gray-300 hover:text-gray-600'
        }`;
    return (
        <span className="inline-flex shrink-0 flex-col">
            <button
                type="button"
                className={buttonClass(upOn)}
                aria-label={`Sort ${label} ascending`}
                aria-pressed={upOn}
                title={`Sort ${label} ascending`}
                onClick={() => onSort(columnKey, 'asc')}
            >
                <ChevronUp size={12} strokeWidth={2.75} />
            </button>
            <button
                type="button"
                className={buttonClass(downOn)}
                aria-label={`Sort ${label} descending`}
                aria-pressed={downOn}
                title={`Sort ${label} descending`}
                onClick={() => onSort(columnKey, 'desc')}
            >
                <ChevronDown size={12} strokeWidth={2.75} />
            </button>
        </span>
    );
}

function SortableTh({
    label,
    columnKey,
    sortKey,
    sortDirection,
    onSort,
    className = '',
    align = 'left',
    rowSpan,
    colSpan,
}) {
    const justify =
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    const active = sortKey === columnKey;
    return (
        <th
            rowSpan={rowSpan}
            colSpan={colSpan}
            className={className}
            aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <div className={`flex w-full items-center gap-0.5 whitespace-nowrap ${justify}`}>
                <span>{label}</span>
                <ColumnSortArrows
                    label={label}
                    columnKey={columnKey}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                />
            </div>
        </th>
    );
}

function MarkAttendanceMenu({ anchorRect, onSelect, onClose, options = MARK_OPTIONS }) {
    const [openLeave, setOpenLeave] = useState(false);
    const menuRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useLayoutEffect(() => {
        if (!anchorRect) return;
        const menuWidth = 210;
        const gap = 4;
        let left = anchorRect.right - menuWidth;
        let top = anchorRect.bottom + gap;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        if (top + 220 > window.innerHeight) {
            top = Math.max(8, anchorRect.top - 220 - gap);
        }
        setPos({ top, left });
    }, [anchorRect]);

    useEffect(() => {
        const onDocClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose?.();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg py-1"
            style={{ top: pos.top, left: pos.left }}
            role="menu"
        >
            {options.map((opt) => {
                if (opt.children?.length) {
                    return (
                        <div
                            key={opt.key}
                            className="relative"
                            onMouseEnter={() => setOpenLeave(true)}
                            onMouseLeave={() => setOpenLeave(false)}
                        >
                            <button
                                type="button"
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setOpenLeave((v) => !v)}
                            >
                                <span>{opt.label}</span>
                                <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            </button>
                            {openLeave ? (
                                <div className="absolute right-full top-0 mr-0.5 min-w-[190px] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                                    {opt.children.map((child) => (
                                        <button
                                            key={child.key}
                                            type="button"
                                            role="menuitem"
                                            onClick={() => onSelect(child.key, child.label)}
                                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            {child.label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                }

                const itemDisabled = Boolean(opt.disabled);
                return (
                    <button
                        key={opt.key}
                        type="button"
                        role="menuitem"
                        disabled={itemDisabled}
                        title={itemDisabled ? opt.disabledTitle || undefined : undefined}
                        onClick={() => {
                            if (itemDisabled) return;
                            onSelect(opt.key, opt.label);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm ${
                            itemDisabled
                                ? 'cursor-not-allowed text-gray-300'
                                : 'hover:bg-gray-50'
                        } ${
                            opt.key === 'clear_attendance'
                                ? 'border-t border-gray-100 mt-0.5'
                                : ''
                        } ${
                            itemDisabled
                                ? ''
                                : opt.key === 'hour_adjust'
                                  ? 'font-semibold text-blue-700'
                                  : opt.key === 'clear_attendance'
                                    ? 'text-gray-500'
                                    : 'text-gray-700'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}

function EmployeeRow({
    index,
    employee,
    checked,
    onToggle,
    mark,
    onRequestMark,
    onRequestOt,
    onSettleCompOff,
    onRequestHour,
    canReviewHour = false,
    canRequestOt = false,
    otDirect = false,
    canReviewOt = false,
    pastDay = false,
    dayBaseline = '',
    actionLocked = false,
    actionTitle = '',
    menuOptions = MARK_OPTIONS,
    dayHoursFallback = 0,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState(null);
    const buttonRef = useRef(null);

    const openMenu = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) setAnchorRect(rect);
        setMenuOpen(true);
    };

    const closeMenu = () => {
        setMenuOpen(false);
        setAnchorRect(null);
    };

    const timeIn = employee.timeIn || '—';
    const timeOut = employee.timeOut || '—';
    const shownMark = markForNonWorkingDay(mark, timeIn, timeOut, dayBaseline);
    const statusText = formatStatusLabel(shownMark, timeIn, pastDay);
    const statusFull = statusHoverTitle(statusText);
    const rawIn = mark?.rawTimeIn || timeIn;
    const rawOut = mark?.rawTimeOut || timeOut;
    const syntheticOt = isOtPunch(rawIn) || isOtPunch(rawOut);
    const duration = syntheticOt
        ? hoursDurationLabel(mark?.flexibleWorkedHours)
        : punchDurationLabel(rawIn, rawOut, mark?.timeOutDate, mark?.date);
    const rowLocked = actionLocked;
    const lockTitle = actionLocked ? actionTitle : undefined;

    const shift = shiftMarks(mark?.rawTimeIn, mark?.rawTimeOut, mark?.timeOutDate, mark?.date);
    const otText = otCellLabel(mark);
    const adjustDate = String(mark?.flexibleOtNextDayDate || mark?.flexibleFromOtDate || '').trim();
    const compOffAdjusted = String(mark?.key || '') === 'compoff_leave' && String(mark?.compOffState || '') === 'adjusted';
    const adjustTitle = adjustDate
        ? `Adjusted with ${formatAdjDay(adjustDate)}`
        : compOffAdjusted
          ? 'Adjusted from overtime'
          : '';
    const actionMenuOptions = rowMenuOptions(menuOptions, shownMark, { canReviewHour });
    const dayHours =
        Number(mark?.flexibleRequiredHours) > 0 ? Number(mark.flexibleRequiredHours) : Number(dayHoursFallback) || 0;
    const showOtRequest = Number(mark?.flexibleOtHours) > 0 && !otText;
    const nextDayOt = coversWorkingDay(mark?.flexibleOtHours, dayHours);
    const remainingOt = syntheticOt && !nextDayOt && Number(mark?.flexibleOtHours) > 0;
    const otButtonLabel = nextDayOt
        ? 'Next day present'
        : remainingOt
          ? `OT ${wholeHourCount(mark?.flexibleOtHours)} hr`
          : otDirect
            ? 'Apply OT'
            : 'Req OT';

    return (
        <tr className="border-b border-gray-100 hover:bg-slate-50/80 transition-colors">
            <td className="px-3 py-3 align-middle">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={rowLocked}
                    onChange={() => {
                        if (!rowLocked) onToggle(employee.id);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-[#EA3D2F] focus:ring-[#EA3D2F]/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Select ${employee.name}`}
                />
            </td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{index}</td>
            <td className="px-3 py-3 text-sm font-medium text-gray-900 align-middle whitespace-nowrap" title={employee.name}>
                {shortEmployeeName(employee.name)}
            </td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{employee.empNo}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{isOtPunch(timeIn) ? '—' : timeIn}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{isOtPunch(timeOut) ? '—' : timeOut}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle whitespace-nowrap">{duration}</td>
            <td className="px-3 py-3 align-middle min-w-[140px]">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                        className={`inline-flex w-fit text-[11px] font-medium px-2 py-1 rounded max-w-full truncate ${statusChipClass(shownMark, statusText)}`}
                        title={[statusFull, mark?.reason, adjustTitle].filter(Boolean).join(' — ')}
                    >
                        {statusText}
                    </span>
                    {mark?.pendingChange ? (
                        <span
                            className="text-[10px] font-semibold text-amber-700"
                            title={
                                mark.pendingChange.stage === 'pending_hr'
                                    ? 'Waiting for HR approval'
                                    : 'Waiting for primary reportee approval'
                            }
                        >
                            {mark.pendingChange.stage === 'pending_hr'
                                ? 'Waiting for HR'
                                : 'Waiting for primary reportee'}
                            {mark.pendingChange.statusLabel
                                ? ` · ${mark.pendingChange.statusLabel}`
                                : ''}
                        </span>
                    ) : null}
                    {adjustTitle ? (
                        <span className="text-[10px] font-semibold text-violet-700" title={adjustTitle}>
                            (Adj)
                        </span>
                    ) : null}
                    {shownMark?.reason ? (
                        <span className="text-[10px] text-gray-500 max-w-[180px] truncate" title={shownMark.reason}>
                            {shownMark.reason}
                        </span>
                    ) : null}
                    {mark?.key === 'compoff_leave' ? (
                        <button
                            type="button"
                            onClick={() => onSettleCompOff?.(employee)}
                            className="w-fit text-[11px] font-semibold text-violet-700 hover:underline"
                        >
                            Settle comp-off
                        </button>
                    ) : null}
                </div>
            </td>
            <td className="px-3 py-3 align-middle text-center min-w-[88px]">
                <PunchLocationPinCell location={mark?.checkInLocation} time={timeIn} kind="in" />
            </td>
            <td className="px-3 py-3 align-middle text-center min-w-[88px]">
                <PunchLocationPinCell location={mark?.checkOutLocation} time={timeOut} kind="out" />
            </td>
            <td className="px-3 py-3 align-middle min-w-[90px]">
                <PunchTypeCell
                    punchSource={mark?.punchSource}
                    checkOutSource={mark?.checkOutSource}
                    timeOut={timeOut}
                />
            </td>
            <td className="px-3 py-3 align-middle text-center text-base">
                {shift.sun ? <span title="Day shift">☀</span> : null}
                {shift.moon ? <span title="Night shift">☾</span> : null}
                {!shift.sun && !shift.moon ? <span className="text-gray-300">—</span> : null}
            </td>
            <td className="px-3 py-3 align-middle">
                {canReviewOt ? (
                    <button
                        type="button"
                        onClick={() => onRequestOt?.(employee, mark)}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700"
                    >
                        Review
                    </button>
                ) : otText ? (
                    <span className="text-xs font-bold text-slate-700">{otText}</span>
                ) : showOtRequest ? (
                    <button
                        type="button"
                        disabled={!canRequestOt}
                        title={
                            canRequestOt
                                ? remainingOt
                                    ? 'Apply the remaining overtime from the previous day'
                                    : otDirect
                                      ? nextDayOt
                                          ? 'Mark the next day Present (On time) for one working day. Hours above that day stay as overtime there.'
                                          : 'Apply overtime now'
                                      : 'Request overtime for HR approval'
                                : 'Only the primary reportee or flowchart HR can use overtime'
                        }
                        onClick={() => {
                            if (canRequestOt) onRequestOt?.(employee, mark);
                        }}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {otButtonLabel}
                    </button>
                ) : (
                    <span className="text-gray-300">—</span>
                )}
            </td>
            <td className="px-2 py-3 align-middle text-right">
                <div className="relative inline-flex items-center justify-end min-h-[32px]">
                    <button
                        ref={buttonRef}
                        type="button"
                        disabled={rowLocked}
                        title={lockTitle || 'Mark Attendance'}
                        aria-label={`Mark attendance for ${employee.name}`}
                        onClick={() => {
                            if (rowLocked) return;
                            if (menuOpen) closeMenu();
                            else openMenu();
                        }}
                        className="h-7 px-2 rounded-md bg-[#EA3D2F] text-white text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-[#d43528] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#EA3D2F]"
                    >
                        Mark
                    </button>
                    {menuOpen && anchorRect ? (
                        <MarkAttendanceMenu
                            anchorRect={anchorRect}
                            options={actionMenuOptions}
                            onClose={closeMenu}
                            onSelect={(key, label) => {
                                closeMenu();
                                if (key === 'hour_adjust') {
                                    onRequestHour?.(employee, mark);
                                    return;
                                }
                                onRequestMark(employee, key, label);
                            }}
                        />
                    ) : null}
                </div>
            </td>
        </tr>
    );
}

export default function MarkAttendanceTable({ dateKey, staffType = 'office', otAttendanceId = '', hourAttendanceId = '' }) {
    const { toast } = useToast();
    const [allEmployees, setAllEmployees] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dayLoading, setDayLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [marks, setMarks] = useState({});
    const [formState, setFormState] = useState(null);
    const [isFlowchartHr, setIsFlowchartHr] = useState(false);
    const [hrReady, setHrReady] = useState(false);
    const [holidayDates, setHolidayDates] = useState([]);
    const [offWeekdays, setOffWeekdays] = useState([]);
    const [holidaysReady, setHolidaysReady] = useState(false);
    const [dayReload, setDayReload] = useState(0);
    const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
    const [bulkAnchorRect, setBulkAnchorRect] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [otModal, setOtModal] = useState(null);
    const [hourModal, setHourModal] = useState(null);
    const [scheduleWeek, setScheduleWeek] = useState(null);
    const [compOffEmployee, setCompOffEmployee] = useState(null);
    const viewerId = useMemo(() => currentEmployeeMongoId(), []);
    const bulkButtonRef = useRef(null);
    const employeesRef = useRef([]);
    const dayRecordsRef = useRef([]);

    useEffect(() => {
        employeesRef.current = employees;
    }, [employees]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axiosInstance.get('/Flowchart/active-holder/hr', {
                    skipToast: true,
                });
                if (!cancelled) {
                    setIsFlowchartHr(viewerIsDesignatedFlowchartHr(storedViewerUser(), data));
                }
            } catch {
                if (!cancelled) setIsFlowchartHr(false);
            } finally {
                if (!cancelled) setHrReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setHolidaysReady(false);
        const year = Number(dubaiDateKey().slice(0, 4));
        (async () => {
            try {
                const [currentYear, previousYear] = await Promise.all([
                    axiosInstance.get('/Holiday', {
                        params: { year, staffType },
                        skipToast: true,
                    }),
                    axiosInstance.get('/Holiday', {
                        params: { year: year - 1, staffType },
                        skipToast: true,
                    }),
                ]);
                const dates = [currentYear, previousYear].flatMap((res) => {
                    const rows = Array.isArray(res.data?.holidays) ? res.data.holidays : [];
                    return rows.map((row) => String(row?.date || '').trim()).filter(Boolean);
                });
                const timeRes = await axiosInstance.get('/WorkingTime', { skipToast: true });
                const week = weekForStaffType(timeRes.data?.workingTime || timeRes.data || {}, staffType);
                const offs = WEEKDAY_KEYS.filter((key) => Boolean(week?.[key]?.isOffDay));
                if (!cancelled) {
                    setHolidayDates(dates);
                    setOffWeekdays(offs);
                    setScheduleWeek(week);
                }
            } catch {
                if (!cancelled) {
                    setHolidayDates([]);
                    setOffWeekdays([]);
                }
            } finally {
                if (!cancelled) setHolidaysReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [staffType]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError('');
            try {
                // Lean roster — avoids heavy /Employee aggregation that timed out / lagged.
                const res = await axiosInstance.get('/Attendance/mark-roster', {
                    params: { staffType, date: dateKey },
                    skipToast: true,
                });
                const rows = extractEmployeeRows(res.data)
                    .filter((e) => !/\(company\)\s*$/i.test(
                        `${e?.firstName || ''} ${e?.lastName || ''} ${e?.name || ''}`.trim(),
                    ))
                    .map(mapActiveEmployee)
                    .filter((e) => e.id);
                rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                if (!cancelled) setAllEmployees(rows);
            } catch (err) {
                if (!cancelled) {
                    setAllEmployees([]);
                    setLoadError(err?.response?.data?.message || 'Could not load active employees.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [staffType, dateKey]);

    // Load stored attendance for the selected day
    useEffect(() => {
        if (loading) return;
        let cancelled = false;

        setSelectedIds(new Set());
        setFormState(null);
        setBulkMenuOpen(false);
        setBulkAnchorRect(null);

        (async () => {
            setDayLoading(true);
            try {
                const res = await axiosInstance.get('/Attendance', {
                    params: { date: dateKey },
                    skipToast: true,
                });
                if (cancelled) return;
                const records = Array.isArray(res.data?.records) ? res.data.records : [];
                const pendingChanges = Array.isArray(res.data?.pendingChanges)
                    ? res.data.pendingChanges
                    : [];
                dayRecordsRef.current = records;
                // Roster is already filtered by staffType from API
                const { nextEmployees, nextMarks } = applyDayRecordsToState(allEmployees, records);
                setEmployees(nextEmployees);
                setMarks(mergePendingChanges(nextMarks, pendingChanges));
                if (otAttendanceId) {
                    const match = nextEmployees.find(
                        (row) => nextMarks[row.id]?.attendanceId === String(otAttendanceId),
                    );
                    if (match && nextMarks[match.id]?.flexibleOtStatus === 'pending') {
                        setOtModal({ employee: match, mark: nextMarks[match.id], mode: 'review' });
                    }
                }
                if (hourAttendanceId) {
                    const match = nextEmployees.find(
                        (row) => nextMarks[row.id]?.attendanceId === String(hourAttendanceId),
                    );
                    if (match && nextMarks[match.id]?.hourAdjustStatus === 'pending') {
                        setHourModal({ employee: match, mark: nextMarks[match.id], mode: 'review' });
                    }
                }
            } catch {
                if (!cancelled) {
                    dayRecordsRef.current = [];
                    setEmployees(allEmployees.map((e) => ({ ...e, timeIn: '—', timeOut: '—' })));
                    setMarks({});
                }
            } finally {
                if (!cancelled) setDayLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [dateKey, loading, allEmployees, dayReload, otAttendanceId, hourAttendanceId]);

    useEffect(() => {
        setSearchQuery('');
    }, [dateKey, staffType]);

    useEffect(() => {
        if (selectedIds.size <= 1) {
            setBulkMenuOpen(false);
            setBulkAnchorRect(null);
        }
    }, [selectedIds.size]);

    const todayKey = dubaiDateKey();
    const earliestMarkKey = shiftDateKey(todayKey, -2);
    const allowedMarkDates = useMemo(
        () => nonHrMarkableDateKeys(todayKey, holidayDates),
        [todayKey, holidayDates],
    );
    const pastDay = Boolean(dateKey) && dateKey < todayKey;
    const dayBaseline = holidayDates.includes(dateKey)
        ? 'holiday'
        : offWeekdays.includes(weekdayKeyFromDate(dateKey))
          ? 'weekly_off'
          : '';
    const windowReady = hrReady && holidaysReady;
    const recentDayOpen = windowReady
        ? allowedMarkDates.has(dateKey)
        : Boolean(dateKey) && dateKey <= todayKey && dateKey >= earliestMarkKey;
    const dayMode = isFlowchartHr || dateKey === todayKey || recentDayOpen ? 'full' : 'locked';
    const baseMenuOptions = MARK_OPTIONS;
    const menuOptions = (
        baseMenuOptions.some((option) => option.key === 'clear_attendance')
            ? baseMenuOptions
            : [...baseMenuOptions, MARK_OPTIONS.find((option) => option.key === 'clear_attendance')]
    ).map((option) =>
        option.key === 'clear_attendance'
            ? {
                  ...option,
                  disabled: !isFlowchartHr,
                  disabledTitle: HR_ONLY_CLEAR_TITLE,
              }
            : option,
    );
    const rowIsActionLocked = () => dayMode === 'locked';
    const filteredEmployees = useMemo(
        () => employees.filter((employee) => employeeMatchesSearch(employee, searchQuery)),
        [employees, searchQuery],
    );
    const rosterIndexById = useMemo(() => {
        const map = new Map();
        employees.forEach((employee, index) => map.set(employee.id, index));
        return map;
    }, [employees]);
    const sortedEmployees = useMemo(() => {
        const ctx = {
            pastDay,
            dayBaseline,
            isFlowchartHr,
            actionLocked: dayMode === 'locked',
        };
        return [...filteredEmployees].sort((a, b) => {
            const cmp = compareAttendanceSortValues(
                attendanceSortValue(sortKey, a, marks[a.id] || null, {
                    ...ctx,
                    rosterIndex: rosterIndexById.get(a.id) ?? 0,
                }),
                attendanceSortValue(sortKey, b, marks[b.id] || null, {
                    ...ctx,
                    rosterIndex: rosterIndexById.get(b.id) ?? 0,
                }),
                sortDirection,
            );
            if (cmp !== 0) return cmp;
            const nameCmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                sensitivity: 'base',
            });
            return sortDirection === 'desc' ? -nameCmp : nameCmp;
        });
    }, [
        filteredEmployees,
        marks,
        sortKey,
        sortDirection,
        pastDay,
        dayBaseline,
        isFlowchartHr,
        dayMode,
        rosterIndexById,
    ]);
    const handleColumnSort = (key, direction) => {
        setSortKey(key);
        setSortDirection(direction);
    };
    const filteredIdSet = useMemo(
        () => new Set(filteredEmployees.map((employee) => employee.id)),
        [filteredEmployees],
    );
    const markableEmployees = filteredEmployees.filter((employee) => !rowIsActionLocked(employee));
    const allChecked =
        markableEmployees.length > 0 && markableEmployees.every((employee) => selectedIds.has(employee.id));
    const someChecked =
        markableEmployees.some((employee) => selectedIds.has(employee.id)) && !allChecked;
    const visibleSelectedCount = filteredEmployees.filter((employee) => selectedIds.has(employee.id)).length;
    const showBulkMark = visibleSelectedCount > 1;

    const toggleAll = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allChecked) {
                markableEmployees.forEach((employee) => next.delete(employee.id));
                return next;
            }
            markableEmployees.forEach((employee) => next.add(employee.id));
            return next;
        });
    };

    const toggleOne = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const applyMarkToIds = async (ids, payload) => {
        if (dayMode === 'locked') return;
        if (payload?.markKey === 'clear_attendance' && !isFlowchartHr) return;
        const idSet = new Set(ids);
        if (idSet.size === 0) return;
        const { markKey, markLabel, timeIn, timeOut, reason, attachmentName, leavePayType } = payload;

        const marksPayload = employeesRef.current
            .filter((e) => idSet.has(e.id))
            .map((e) => ({
                employeeMongoId: e.id,
                employeeId: e.empNo,
                employeeName: e.name,
                statusKey: markKey,
                statusLabel: markLabel,
                timeIn: timeIn != null ? timeIn : '',
                timeOut: timeOut != null ? timeOut : '',
                reason: reason || '',
                attachmentName: attachmentName || '',
                leavePayType: leavePayType || '',
            }));

        setSaving(true);
        try {
            const res = await axiosInstance.post('/Attendance/mark', {
                date: dateKey,
                marks: marksPayload,
            });
            const records = Array.isArray(res.data?.records) ? res.data.records : [];
            const pending = Array.isArray(res.data?.pending) ? res.data.pending : [];
            if (pending.length) {
                toast({
                    title: 'Sent for approval',
                    description: res.data?.message || 'Attendance stays unchanged until HR approves.',
                });
            }
            const dayRes = await axiosInstance.get('/Attendance', {
                params: { date: dateKey },
                skipToast: true,
            });
            const dayRecords = Array.isArray(dayRes.data?.records) ? dayRes.data.records : records;
            const pendingChanges = Array.isArray(dayRes.data?.pendingChanges)
                ? dayRes.data.pendingChanges
                : [];
            dayRecordsRef.current = dayRecords;
            const { nextEmployees, nextMarks } = applyDayRecordsToState(
                employeesRef.current,
                dayRecords,
            );
            setEmployees(nextEmployees);
            setMarks(mergePendingChanges(nextMarks, pendingChanges));
            notifyAttendancePendingInboxChanged();
        } catch (err) {
            console.error('Failed to save attendance', err);
            toast({
                variant: 'destructive',
                title: 'Could not save attendance',
                description: err?.response?.data?.message || 'The attendance change was not saved.',
            });
            try {
                const res = await axiosInstance.get('/Attendance', {
                    params: { date: dateKey },
                    skipToast: true,
                });
                const records = Array.isArray(res.data?.records) ? res.data.records : [];
                const pendingChanges = Array.isArray(res.data?.pendingChanges)
                    ? res.data.pendingChanges
                    : [];
                dayRecordsRef.current = records;
                const { nextEmployees, nextMarks } = applyDayRecordsToState(
                    employeesRef.current,
                    records,
                );
                setEmployees(nextEmployees);
                setMarks(mergePendingChanges(nextMarks, pendingChanges));
            } catch {
                /* ignore */
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRequestMark = (employee, key, label) => {
        if (saving || rowIsActionLocked(employee)) return;
        if (key === 'clear_attendance' && !isFlowchartHr) return;
        const config = getMarkFormConfig(key);
        if (!config) {
            applyMarkToIds([employee.id], {
                markKey: key,
                markLabel: label,
                timeIn: null,
                timeOut: null,
                reason: '',
                attachmentName: '',
            });
            return;
        }
        setFormState({
            mode: 'single',
            employee,
            employeeIds: [employee.id],
            markKey: key,
            markLabel: label,
        });
    };

    const handleBulkRequestMark = (key, label) => {
        if (saving || dayMode === 'locked') return;
        if (key === 'clear_attendance' && !isFlowchartHr) return;
        const ids = Array.from(selectedIds).filter((id) => filteredIdSet.has(id));
        if (ids.length === 0) return;
        const config = getMarkFormConfig(key);
        if (!config) {
            applyMarkToIds(ids, {
                markKey: key,
                markLabel: label,
                timeIn: null,
                timeOut: null,
                reason: '',
                attachmentName: '',
            });
            return;
        }
        setFormState({
            mode: 'bulk',
            employee: null,
            employeeIds: ids,
            markKey: key,
            markLabel: label,
        });
    };

    const openBulkMenu = () => {
        const rect = bulkButtonRef.current?.getBoundingClientRect();
        if (rect) setBulkAnchorRect(rect);
        setBulkMenuOpen(true);
    };

    const closeBulkMenu = () => {
        setBulkMenuOpen(false);
        setBulkAnchorRect(null);
    };

    if (loading) {
        return <div className="py-12 text-center text-sm text-gray-400">Loading active employees…</div>;
    }

    if (loadError) {
        return <div className="py-12 text-center text-sm text-red-500">{loadError}</div>;
    }

    if (employees.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-gray-400">
                No enrolled staff for this date.
            </div>
        );
    }

    return (
        <>
            {dayLoading ? (
                <div className="px-1 pb-2 text-xs text-gray-400">Loading day attendance…</div>
            ) : null}
            {saving ? (
                <div className="px-1 pb-2 text-xs text-gray-400">Saving attendance…</div>
            ) : null}
            {dayMode === 'locked' ? (
                <div className="px-1 pb-2 text-xs text-amber-700">{HR_ONLY_MARK_TITLE}</div>
            ) : null}
            {!isFlowchartHr && dayMode === 'full' && dateKey && dateKey < todayKey ? (
                <div className="px-1 pb-2 text-xs text-slate-500">{RECENT_MARK_NOTE}</div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pb-3">
                <div className="relative w-full sm:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search name or emp no"
                        aria-label="Search employees by name or employee number"
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#EA3D2F]/40 focus:outline-none focus:ring-2 focus:ring-[#EA3D2F]/20"
                    />
                    {searchQuery ? (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            aria-label="Clear search"
                        >
                            <X size={14} />
                        </button>
                    ) : null}
                </div>
                {searchQuery.trim() ? (
                    <p className="text-xs text-gray-500 tabular-nums">
                        {filteredEmployees.length} of {employees.length}
                    </p>
                ) : null}
            </div>

            {showBulkMark ? (
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">{visibleSelectedCount}</span> employees
                        selected
                    </p>
                    <div className="relative">
                        <button
                            ref={bulkButtonRef}
                            type="button"
                            disabled={saving || dayMode === 'locked'}
                            onClick={() => {
                                if (dayMode === 'locked') return;
                                if (bulkMenuOpen) closeBulkMenu();
                                else openBulkMenu();
                            }}
                            className="h-8 px-2.5 rounded-md bg-[#EA3D2F] hover:bg-[#d43528] text-white text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-60"
                        >
                            Mark all
                        </button>
                        {bulkMenuOpen && bulkAnchorRect ? (
                            <MarkAttendanceMenu
                                anchorRect={bulkAnchorRect}
                                options={menuOptions}
                                onClose={closeBulkMenu}
                                onSelect={(key, label) => {
                                    closeBulkMenu();
                                    handleBulkRequestMark(key, label);
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full min-w-[1040px] border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-3 text-left w-10" rowSpan={2}>
                                <input
                                    type="checkbox"
                                    checked={allChecked}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someChecked;
                                    }}
                                    onChange={toggleAll}
                                    disabled={dayMode === 'locked' || markableEmployees.length === 0}
                                    className="h-4 w-4 rounded border-gray-300 text-[#EA3D2F] focus:ring-[#EA3D2F]/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Select all employees"
                                    title={allChecked ? 'Uncheck all' : 'Check all'}
                                />
                            </th>
                            <SortableTh
                                label="Sl No"
                                columnKey="slNo"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Emp Name"
                                columnKey="name"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Emp No"
                                columnKey="empNo"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Time In"
                                columnKey="timeIn"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Time Out"
                                columnKey="timeOut"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Duration"
                                columnKey="duration"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Status"
                                columnKey="status"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Location"
                                columnKey="location"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                align="center"
                                colSpan={2}
                                className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 border-l border-gray-200"
                            />
                            <SortableTh
                                label="Type"
                                columnKey="type"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 border-l border-gray-200"
                            />
                            <SortableTh
                                label="Shift"
                                columnKey="shift"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                align="center"
                                rowSpan={2}
                                className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="OT"
                                columnKey="ot"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                rowSpan={2}
                                className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                            <SortableTh
                                label="Action"
                                columnKey="action"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                align="right"
                                rowSpan={2}
                                className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500"
                            />
                        </tr>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <SortableTh
                                label="Check-in"
                                columnKey="checkIn"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                align="center"
                                className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 border-l border-t border-gray-200"
                            />
                            <SortableTh
                                label="Check-out"
                                columnKey="checkOut"
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleColumnSort}
                                align="center"
                                className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 border-t border-gray-200"
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={14} className="px-3 py-12 text-center text-sm text-gray-400">
                                    No employees match “{searchQuery.trim()}”.
                                </td>
                            </tr>
                        ) : null}
                        {sortedEmployees.map((employee, index) => (
                            <EmployeeRow
                                key={employee.id}
                                index={index + 1}
                                employee={employee}
                                checked={selectedIds.has(employee.id)}
                                onToggle={toggleOne}
                                mark={marks[employee.id] || null}
                                pastDay={pastDay}
                                dayBaseline={dayBaseline}
                                actionLocked={rowIsActionLocked(employee)}
                                actionTitle={dayMode === 'locked' ? HR_ONLY_MARK_TITLE : ''}
                                dayHoursFallback={scheduleDayHours(scheduleWeek, dateKey)}
                                menuOptions={menuOptions}
                                onRequestMark={handleRequestMark}
                                canRequestOt={
                                    isFlowchartHr ||
                                    (Boolean(viewerId) &&
                                        viewerId === String(employee.primaryReportee || ''))
                                }
                                otDirect={isFlowchartHr}
                                canReviewOt={
                                    isFlowchartHr &&
                                    String(marks[employee.id]?.flexibleOtStatus || '') === 'pending'
                                }
                                onRequestOt={(row, mark) =>
                                    setOtModal({
                                        employee: row,
                                        mark,
                                        mode:
                                            isFlowchartHr &&
                                            String(mark?.flexibleOtStatus || '') === 'pending'
                                                ? 'review'
                                                : isFlowchartHr
                                                  ? 'direct'
                                                  : 'request',
                                    })
                                }
                                onSettleCompOff={setCompOffEmployee}
                                canReviewHour={
                                    isFlowchartHr &&
                                    String(marks[employee.id]?.hourAdjustStatus || '') === 'pending'
                                }
                                onRequestHour={(row, mark) =>
                                    setHourModal({
                                        employee: row,
                                        mark,
                                        mode:
                                            isFlowchartHr && String(mark?.hourAdjustStatus || '') === 'pending'
                                                ? 'review'
                                                : isFlowchartHr
                                                  ? 'direct'
                                                  : 'request',
                                    })
                                }
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            <MarkAttendanceDetailsModal
                open={Boolean(formState)}
                employee={formState?.employee}
                employeeIds={formState?.employeeIds}
                employees={employees}
                markKey={formState?.markKey}
                markLabel={formState?.markLabel}
                dateKey={dateKey}
                staffType={staffType}
                onClose={() => setFormState(null)}
                onMapped={() => setDayReload((value) => value + 1)}
                onSave={(payload) => {
                    const ids = formState?.employeeIds?.length
                        ? formState.employeeIds
                        : formState?.employee?.id
                          ? [formState.employee.id]
                          : [];
                    setFormState(null);
                    if (ids.length) applyMarkToIds(ids, payload);
                }}
            />
            <HourAdjustModal
                open={Boolean(hourModal)}
                mode={hourModal?.mode}
                employee={hourModal?.employee}
                mark={hourModal?.mark}
                week={scheduleWeek}
                onClose={() => setHourModal(null)}
                onSaved={() => setDayReload((value) => value + 1)}
            />
            <CompOffSettleModal
                open={Boolean(compOffEmployee)}
                employeeMongoId={compOffEmployee?.id || ''}
                date={dateKey}
                onClose={() => setCompOffEmployee(null)}
                onChanged={() => setDayReload((value) => value + 1)}
            />
            <FlexibleOtModal
                open={Boolean(otModal)}
                mode={otModal?.mode || 'request'}
                employee={otModal?.employee}
                mark={otModal?.mark}
                dayHours={
                    Number(otModal?.mark?.flexibleRequiredHours) > 0
                        ? Number(otModal.mark.flexibleRequiredHours)
                        : scheduleDayHours(scheduleWeek, otModal?.mark?.date || dateKey)
                }
                onClose={() => setOtModal(null)}
                onSaved={() => setDayReload((value) => value + 1)}
            />
        </>
    );
}
