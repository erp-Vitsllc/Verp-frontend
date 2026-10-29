'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { notifyAttendancePendingInboxChanged } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import { notifyLeavePendingInboxChanged } from '@/app/HRM/Leave/utils/leavePendingInboxCount';
import { hasPermission } from '@/utils/permissions';
import { isNextDayCheckout, NextDayCheckoutTime } from '@/app/HRM/Attendance/utils/nextDayCheckout';
import {
    markWithRequestableOt,
    otActionState,
} from '@/app/HRM/Attendance/mark/utils/otRequestButtons.logic.mjs';
import { nextCalendarDateKey, nonHrMarkableDateKeys } from '@/app/HRM/Attendance/utils/nonHrMarkWindow';
import { weekForStaffType } from '@/utils/workLocations';
import { handleNavigateFromListClick } from '@/utils/listReturnNavigation';
import { RECORD_FOCUS_BLINK_MS } from '@/utils/notificationFocusNavigation';
import MarkAttendanceDetailsModal, {
    getMarkFormConfig,
} from './MarkAttendanceDetailsModal';

async function openStoredLeaveFile(event, file) {
    event.preventDefault();
    event.stopPropagation();
    const ready = String(file?.url || '').trim();
    if (/^https?:\/\//i.test(ready)) {
        window.open(ready, '_blank', 'noopener,noreferrer');
        return;
    }
    const attendanceId = String(file?.attendanceId || '').trim();
    const response = await axiosInstance.get(`/Attendance/attachment/${attendanceId || 'lookup'}`, {
        params: {
            employeeMongoId: file?.employeeMongoId || '',
            date: file?.date || '',
            name: file?.name || '',
        },
    });
    const url = String(response?.data?.url || '').trim();
    if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
}
import {
    PunchLocationPinCell,
    PunchTypeCell,
    normalizePunchType,
    punchCoords,
} from './MarkAttendancePunchCells';
import FlexibleOtModal from './FlexibleOtModal';
import HourAdjustModal, { hourAdjustOffer } from './HourAdjustModal';
import MispunchRequestModal from './MispunchRequestModal';
import WaiveDeductionModal from './WaiveDeductionModal';
import CompOffSettleModal from '../../components/CompOffSettleModal';
import AttendanceLeaveDecideModal from '@/app/dashboard/components/AttendanceLeaveDecideModal';
import StatusApprovalTip from './StatusApprovalTip';

const MARK_OPTIONS = [
    { key: 'on_office', label: 'On work' },
    {
        key: 'on_leave',
        label: 'On leave',
        children: [
            { key: 'sick_leave', label: 'Sick leave' },
            { key: 'authorized_leave', label: 'Authorized leave' },
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

function workedHoursValue(mark) {
    const stored = Number(mark?.flexibleWorkedHours);
    if (Number.isFinite(stored) && stored > 0) return stored;
    const seconds = punchSpanSeconds(mark?.rawTimeIn, mark?.rawTimeOut, mark?.timeOutDate, mark?.date);
    if (seconds == null) return 0;
    return seconds / 3600;
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

function adjustmentLines(mark) {
    const lines = [];
    const fromDate = String(mark?.flexibleFromOtDate || '').trim();
    const toDate = String(mark?.flexibleOtNextDayDate || '').trim();
    if (fromDate) {
        const day = formatAdjDay(fromDate);
        lines.push(day ? `(adjusted from ${day})` : '(adjusted from overtime)');
    }
    if (toDate) {
        const day = formatAdjDay(toDate);
        if (day) lines.push(`(adjusted to ${day})`);
    }
    const compOffAdjusted = String(mark?.key || '') === 'compoff_leave' && String(mark?.compOffState || '') === 'adjusted';
    if (!lines.length && compOffAdjusted) lines.push('(adjusted from overtime)');
    return lines;
}

function formatDisplayTime(value) {
    if (!value) return '—';
    return value;
}

function attendanceProfileHref(employeeId) {
    const id = String(employeeId || '').trim();
    if (!/^[a-f\d]{24}$/i.test(id)) return '';
    return `/HRM/Leave/${encodeURIComponent(id)}`;
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

function scheduledLateMinutes(week, dateKey, timeIn) {
    const start = scheduledStartMinutes(week, dateKey);
    const actual = clockToMinutes(timeIn);
    if (start == null || actual == null || actual <= start) return 0;
    return actual - start;
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
    'Only the flowchart HR assignee can mark attendance outside today and the seven previous days. The next day can be marked Present (comp off) only. Holidays are included.';
const HR_ONLY_CLEAR_TITLE = 'Only the flowchart HR assignee can clear attendance.';
const RECENT_MARK_NOTE =
    'Present, and early go, late arrival, or mispunch with no hours, save immediately. The primary reportee and HR are emailed. Sick leave, authorized leave, other leave, overtime, and any deduction hours wait for the primary reportee, then HR.';
const NEXT_DAY_MARK_NOTE =
    'The next day can be marked Present (comp off) only. It saves immediately. The primary reportee and HR are emailed.';

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

function clockToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function scheduledStartMinutes(week, dateKey) {
    if (!week || String(week.timingMode || '').toLowerCase() === 'flexible') return null;
    const day = week[weekdayKeyFromDate(dateKey)];
    if (!day || day.isOffDay) return null;
    let hour = Number(day.startHour);
    const minute = Number(day.startMinute);
    const meridiem = String(day.startMeridiem || 'AM').toUpperCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    return hour * 60 + minute;
}

/** Stored reasons counted past the 15-minute grace. Show minutes from the scheduled start. */
function lateReasonFromSchedule(reason, timeIn, week, dateKey) {
    const raw = String(reason || '');
    if (!/^(\d+)\s+minutes?\s+late\b/i.test(raw)) return raw;
    const start = scheduledStartMinutes(week, dateKey);
    const actual = clockToMinutes(timeIn);
    if (start == null || actual == null || actual <= start) return raw;
    const late = actual - start;
    const label = `${late} minute${late === 1 ? '' : 's'} late`;
    return raw.replace(/^(\d+)\s+minutes?\s+late/i, label);
}

function markForNonWorkingDay(mark, timeIn, timeOut, dayBaseline) {
    if (!dayBaseline) return mark;
    const key = String(mark?.key || '').trim();
    const leave = ['sick_leave', 'on_leave', 'authorized_leave', 'compoff_leave', 'work_from_home', 'suspended'].includes(key);
    if (leave) return mark;
    if (dayBaseline === 'holiday') {
        return { ...(mark || {}), key: 'holiday', label: 'Holiday', reason: mark?.reason || 'Holiday' };
    }
    return { ...(mark || {}), key: 'weekly_off', label: 'Off Day', reason: mark?.reason || 'Weekly off' };
}

function countsAsOnTime(mark) {
    if (!mark) return false;
    if (mark.deductionWaived === true) return true;
    const key = String(mark.key || '').trim();
    if (key === 'authorized_leave' || key === 'sick_leave') return false;
    const approvedHours = Number(mark.hoursApproved);
    return String(mark.hourAdjustStatus || '') === 'approved' && !(approvedHours > 0);
}

function formatStatusLabel(mark, timeIn, pastDay = false) {
    const key = String(mark?.key || '').trim();
    const raw = String(mark?.label || '').trim();
    const kind = String(mark?.leaveRequestKind || '').trim();
    const punchedIn = Boolean(timeIn && timeIn !== '—');
    const missedDay = pastDay ? 'Unauth' : 'Absent';

    if (punchedIn && countsAsOnTime(mark)) return 'Present (On time)';
    if (key === 'suspended') return 'Suspended';
    // "Unauthorized Leave" contains "authorized leave", so this must run first.
    if (key === 'unauthorized_leave' || /^unauth/i.test(raw)) {
        const session = String(mark?.leaveRequestSession || '');
        const text = `${raw} ${mark?.reason || ''}`;
        if (session === 'pm' || /early/i.test(text) || /\(PM\)/i.test(text)) return 'Present (Early Go)';
        if (session === 'am' || /late arrival/i.test(text) || /\(AM\)/i.test(text)) return 'Present (Late Arrival)';
        return 'Unauth';
    }
    if (key === 'authorized_leave' || /auth(?:orized)? leave/i.test(raw)) {
        const halfAt = raw.indexOf('·');
        if (halfAt >= 0) {
            const rest = raw.slice(halfAt).replace(/\(approved\)/ig, '').trim();
            if (rest && !/leave/i.test(rest)) return `Auth ${rest}`;
        }
        return 'Auth';
    }
    if (/\(Approved\)/i.test(raw)) return raw;

    if (key === 'late_arrived' || /late arrival/i.test(raw)) return 'Present (Late Arrival)';
    if (key === 'early_go' || /early go/i.test(raw)) return 'Present (Early Go)';
    if (key === 'mispunch') return raw || 'Mispunched';
    if (key === 'sick_leave') return raw || 'Sick Leave';
    if (key === 'compoff_leave') return raw || 'Comp Off Leave';
    if (key === 'on_leave' || kind === 'future_annual') {
        if (!raw || /^on leave$/i.test(raw) || /annual/i.test(raw)) return 'Annual';
        return raw;
    }
    if (key === 'work_from_home') return raw || 'Work from home';
    if (key === 'weekly_off') return 'Off Day';
    if (key === 'holiday') return raw || 'Holiday';
    if (!punchedIn && (key === '' || key === 'not_marked' || key === 'absent' || key === 'on_office' || /^(on time|present|on work|on office)/i.test(raw))) return missedDay;
    if (
        punchedIn && (
            key === 'on_office' ||
            key === 'not_marked' ||
            /^(on time|present|on work|on office)$/i.test(raw)
        )
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

function isMispunchRequest(mark) {
    const pendingKind = String(mark?.pendingChange?.hourAdjustKind || '').trim();
    if (pendingKind) return pendingKind === 'mispunch';
    const storedKind = String(mark?.hourAdjustKind || '').trim();
    if (storedKind === 'mispunch' && String(mark?.hourAdjustStatus || '') === 'pending') return true;
    return hourAdjustOffer(mark)?.kind === 'mispunch';
}

const DEDUCTION_DAY_KEYS = new Set([
    'mispunch',
    'early_go',
    'late_arrived',
    'unauthorized_leave',
    'authorized_leave',
]);

function approvedHoursStillDeduct(mark) {
    return String(mark?.hourAdjustStatus || '') === 'approved' && Number(mark?.hoursApproved) > 0;
}

function canOfferDeductionWaive(mark, canWaiveDeduction) {
    if (!canWaiveDeduction || !mark?.attendanceId || mark.deductionWaived) return false;
    if (!DEDUCTION_DAY_KEYS.has(String(mark.key || '').trim())) return false;
    return Number(mark.deductionDays) > 0 || approvedHoursStillDeduct(mark);
}

function withWaiveOption(options, mark, canWaiveDeduction) {
    if (!canOfferDeductionWaive(mark, canWaiveDeduction)) return options;
    const waiveItem = { key: 'waive_deduction', label: 'Waive of deduction' };
    const next = [];
    let placed = false;
    for (const option of options) {
        if (!placed && option.key === 'clear_attendance') {
            next.push(waiveItem);
            placed = true;
        }
        next.push(option);
    }
    if (!placed) next.push(waiveItem);
    return next;
}

function rowMenuOptions(baseOptions, mark, { canReviewHour = false, canWaiveDeduction = false } = {}) {
    const offer = hourAdjustOffer(mark);
    if (!offer || String(mark?.hourAdjustStatus || '') === 'approved') {
        return withWaiveOption(baseOptions, mark, canWaiveDeduction);
    }
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
    return withWaiveOption(next, mark, canWaiveDeduction);
}

function statusChipClass(mark, label) {
    const key = String(mark?.key || '').trim();
    if (label === 'Present (On time)') return 'text-emerald-700 bg-emerald-50';
    if (key === 'suspended' || label === 'Suspended') return 'text-slate-700 bg-slate-100';
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

function pendingRecordScore(record) {
    let score = 0;
    if (String(record?.leaveRequestStatus || '') === 'pending') score += 4;
    if (String(record?.hourAdjustStatus || '') === 'pending') score += 2;
    if (String(record?.flexibleOtStatus || '') === 'pending') score += 2;
    return score;
}

const MISSING_CHECKOUT_SKIP = new Set([
    'holiday',
    'weekly_off',
    'on_leave',
    'sick_leave',
    'compoff_leave',
    'authorized_leave',
    'suspended',
]);

function punchTimePresent(value) {
    const text = String(value || '').trim();
    return Boolean(text && text !== '—' && text !== '-' && text !== 'OT');
}

/** A past day with check-in and no check-out is a mispunch on this table. */
function recordWithMissingCheckout(record, todayKey) {
    const date = String(record?.date || '').trim();
    if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !todayKey || date >= todayKey) return record;
    if (!punchTimePresent(record.timeIn) || punchTimePresent(record.timeOut)) return record;
    const key = String(record.statusKey || '').trim();
    if (MISSING_CHECKOUT_SKIP.has(key) || key === 'mispunch') return record;
    return {
        ...record,
        statusKey: 'mispunch',
        statusLabel: 'Mispunch',
        reason: String(record.reason || '').trim() || 'Mispunched — forgot to check out',
    };
}

function applyDayRecordsToState(employees, records) {
    const todayKey = dubaiDateKey();
    const byId = new Map();
    for (const record of Array.isArray(records) ? records : []) {
        const id = String(record?.employeeMongoId || '');
        if (!id) continue;
        const shown = recordWithMissingCheckout(record, todayKey);
        const current = byId.get(id);
        if (!current || pendingRecordScore(shown) >= pendingRecordScore(current)) byId.set(id, shown);
    }
    const nextMarks = {};
    const nextEmployees = employees.map((e) => {
        if (e.attendanceSuspended) {
            const note = String(e.attendanceSuspensionNote || e.attendanceSuspension?.description || 'Attendance suspended');
            nextMarks[e.id] = {
                key: 'suspended',
                label: 'Suspended',
                reason: note,
                date: '',
            };
            return { ...e, timeIn: '—', timeOut: '—' };
        }
        const rec = byId.get(e.id);
        if (!rec) {
            return { ...e, timeIn: '—', timeOut: '—' };
        }
        nextMarks[e.id] = {
            key: rec.statusKey,
            label: rec.statusLabel,
            reason: rec.reason || '',
            attachmentName: rec.attachmentName || '',
            attachmentUrl: rec.attachmentUrl || '',
            punchSource: rec.punchSource || '',
            checkOutSource: rec.checkOutSource || '',
            checkInLocation: rec.checkInLocation || null,
            checkOutLocation: rec.checkOutLocation || null,
            leaveRequestStatus: rec.leaveRequestStatus || '',
            leaveRequestKind: rec.leaveRequestKind || '',
            leaveRequestSession: rec.leaveRequestSession || '',
            leaveRequestReason: rec.leaveRequestReason || '',
            leaveRequestFromDate: rec.leaveRequestFromDate || '',
            leaveRequestToDate: rec.leaveRequestToDate || '',
            leaveRequestDayPart: rec.leaveRequestDayPart || '',
            leaveRequestTimeIn: rec.leaveRequestTimeIn || '',
            leaveRequestTimeOut: rec.leaveRequestTimeOut || '',
            previousStatusLabel: rec.previousStatusLabel || '',
            requestedStatusKey: rec.requestedStatusKey || '',
            requestedStatusLabel: rec.requestedStatusLabel || '',
            leaveApprovalStage: rec.leaveApprovalStage || '',
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
            punchMappedFromEmployeeMongoId: rec.punchMappedFromEmployeeMongoId || '',
            deductionWaived: rec.deductionWaived === true,
            deductionWaiveReason: rec.deductionWaiveReason || '',
            deductionDays: Number(rec.deductionDays) || 0,
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

function mergePendingChanges(nextMarks, pendingChanges, { dateKey = '', employeeIds = null } = {}) {
    const day = String(dateKey || '').trim();
    const allowed = employeeIds instanceof Set ? employeeIds : null;
    const next = { ...nextMarks };
    for (const change of pendingChanges || []) {
        const id = String(change?.employeeMongoId || '');
        if (!id) continue;
        if (allowed && !allowed.has(id)) continue;
        const changeDay = String(change?.date || '').trim();
        const targetDay = change?.confirmNextDay === true ? String(change?.targetDate || '').trim() : '';
        if (day && changeDay !== day && targetDay !== day) continue;
        next[id] = {
            ...(next[id] || {}),
            pendingChange: {
                id: String(change.id || ''),
                stage: change.stage || '',
                action: change.action || 'mark',
                statusKey: change.statusKey || '',
                statusLabel: change.statusLabel || '',
                requestedById: String(change.requestedById || ''),
                requestedByName: change.requestedByName || '',
                reporteeId: String(change.reporteeId || ''),
                reporteeName: change.reporteeName || '',
                hrName: change.hrName || '',
                reason: change.reason || '',
                attachmentName: change.attachmentName || '',
                attachmentUrl: change.attachmentUrl || '',
                rejectReason: change.rejectReason || '',
                rejectedByName: change.rejectedByName || '',
                hoursApproved: change.hoursApproved,
                flexibleOtApprovedHours: change.flexibleOtApprovedHours,
                flexibleOtHours: change.flexibleOtHours,
                createdAt: change.createdAt || null,
                decidedAtReportee: change.decidedAtReportee || null,
                hoursTaken: change.hoursTaken,
                hoursMax: change.hoursMax,
                hourAdjustKind: change.hourAdjustKind || '',
                previousStatusLabel: change.previousStatusLabel || '',
                hourAdjustMode: change.hourAdjustMode || '',
                hourRequestType: change.hourRequestType || '',
                hourAdjustFlexible: change.hourAdjustFlexible === true,
                timeIn: change.timeIn || '',
                timeOut: change.timeOut || '',
                date: changeDay,
                targetDate: String(change?.targetDate || '').trim(),
                confirmNextDay: change.confirmNextDay === true,
            },
        };
    }
    return next;
}

function mergeApprovalHistory(nextMarks, approvalHistory, { employeeIds = null } = {}) {
    const allowed = employeeIds instanceof Set ? employeeIds : null;
    const byEmployee = new Map();
    for (const row of approvalHistory || []) {
        const id = String(row?.employeeMongoId || '').trim();
        if (!id) continue;
        if (allowed && !allowed.has(id)) continue;
        const list = byEmployee.get(id) || [];
        list.push({
            id: String(row.id || ''),
            type: String(row.type || '').trim() || 'Request',
            approvedAt: row.approvedAt || '',
            approvedBy: String(row.approvedBy || '').trim(),
        });
        byEmployee.set(id, list);
    }
    const next = { ...nextMarks };
    for (const [id, approvals] of byEmployee) {
        next[id] = {
            ...(next[id] || {}),
            approvals,
        };
    }
    return next;
}

function withAttendanceOverlays(nextMarks, pendingChanges, approvalHistory, { dateKey, employeeIds }) {
    return mergeApprovalHistory(
        mergePendingChanges(nextMarks, pendingChanges, { dateKey, employeeIds }),
        approvalHistory,
        { employeeIds },
    );
}

function pendingRequestTitle(mark, kind) {
    if (kind === 'change') {
        return String(mark?.pendingChange?.statusLabel || '').trim() || 'Attendance change';
    }
    if (kind === 'leave') {
        const label = String(mark?.requestedStatusLabel || '').trim();
        if (label) return label;
        const requestKind = String(mark?.leaveRequestKind || '').toLowerCase();
        if (requestKind.includes('late')) return 'Late in';
        if (requestKind.includes('early')) return 'Early go';
        if (requestKind.includes('yellow')) return 'Present';
        return 'Leave';
    }
    if (kind === 'ot') return 'Overtime';
    if (kind === 'hour') return 'Hours';
    return 'Request';
}

function pendingApproverName(change, { flowchartHrName = '', reporteeName = '' } = {}) {
    const hr = String(change?.hrName || flowchartHrName || '').trim();
    const hod = String(change?.reporteeName || reporteeName || '').trim();
    const requester = String(change?.requestedByName || '').trim();
    if (change?.stage === 'pending_hr') return hr || 'HR';
    if (change?.stage === 'pending_requester') return requester || 'requester';
    return hod || 'HOD';
}

function waitingDecision(who, requestTitle, viewKind) {
    const name = String(who || '').trim() || 'approver';
    return {
        kind: 'waiting',
        viewKind: String(viewKind || '').trim(),
        approverName: name,
        title: `Waiting for ${name}`,
        requestTitle: String(requestTitle || '').trim(),
    };
}

function approverFirstName(name) {
    const text = String(name || '').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Approver';
    if (parts.length > 1 && /reportee|approver|requester/i.test(text)) return text;
    return parts[0];
}

function shortPendingRequestType(decision, mark) {
    const viewKind = String(decision?.viewKind || '').trim();
    const title = String(decision?.requestTitle || '').trim();
    const hourKind = String(mark?.pendingChange?.hourAdjustKind || mark?.hourAdjustKind || '').toLowerCase();
    const leaveKind = String(mark?.leaveRequestKind || '').toLowerCase();

    if (viewKind === 'ot' || /overtime/i.test(title)) return 'OT';
    if (hourKind === 'early_go' || leaveKind.includes('early') || /early/i.test(title)) return 'Early Go';
    if (hourKind === 'late_arrived' || leaveKind.includes('late') || /late/i.test(title)) return 'Late In';
    if (hourKind === 'mispunch' || /mispunch/i.test(title)) return 'Mispunch';
    if (hourKind === 'authorized_leave') return 'Auth Leave';
    if (viewKind === 'hour') return 'Hours';
    if (leaveKind === 'future_annual' || /annual/i.test(title)) return 'Annual';
    if (leaveKind === 'yellow' || /^present$/i.test(title)) return 'Present';
    if (/sick/i.test(title)) return 'Sick';
    if (/comp/i.test(title)) return 'Comp Off';
    if (viewKind === 'leave' || /leave/i.test(title)) return 'Leave';
    if (title && title.length <= 18) return title;
    return title ? title.split(/\s+/).slice(0, 2).join(' ') : 'Request';
}

function pendingApprovalLabel(decision, mark) {
    return `Pending - ${shortPendingRequestType(decision, mark)} - ${approverFirstName(decision?.approverName)}`;
}

function viewKindFromMark(mark) {
    const action = String(mark?.pendingChange?.action || '').trim();
    if (action === 'flexible_ot') return 'ot';
    if (action === 'hour_adjust') return 'hour';
    if (mark?.pendingChange?.id) return 'change';
    if (String(mark?.leaveRequestStatus || '') === 'pending') return 'leave';
    if (String(mark?.flexibleOtStatus || '') === 'pending') return 'ot';
    if (String(mark?.hourAdjustStatus || '') === 'pending') return 'hour';
    return '';
}

function PendingApprovalLink({ decision, mark, onOpen, className = '' }) {
    const label = pendingApprovalLabel(decision, mark);
    const detail = [decision?.requestTitle, decision?.title].filter(Boolean).join(' · ');
    return (
        <button
            type="button"
            onClick={() => onOpen?.('view')}
            title={detail || label}
            className={`cursor-pointer font-semibold leading-snug text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 ${className}`}
        >
            {label}
        </button>
    );
}

function waitingForApproval(change, mark, names) {
    const who = pendingApproverName(change, names);
    if (change?.action === 'hour_adjust') {
        return waitingDecision(who, pendingRequestTitle(mark, 'hour'), 'hour');
    }
    if (change?.action === 'flexible_ot') {
        return waitingDecision(who, pendingRequestTitle(mark, 'ot'), 'ot');
    }
    return waitingDecision(who, pendingRequestTitle(mark, 'change'), 'change');
}

function leaveWaitingOnHr(mark) {
    const stage = String(mark?.leaveApprovalStage || '').trim();
    if (stage === 'pending_hr') return true;
    if (stage === 'pending_reportee') return false;
    const kind = String(mark?.leaveRequestKind || '').trim();
    return kind === 'future_leave' || kind === 'future_annual';
}

function viewerCanDecideChange(change, { isFlowchartHr, viewer, isReportee }) {
    if (!change?.id) return false;
    if (change.stage === 'pending_hr') return isFlowchartHr;
    if (change.stage === 'pending_reportee') {
        return isReportee || (Boolean(viewer) && viewer === String(change.reporteeId || ''));
    }
    if (
        change.stage === 'pending_requester' &&
        (change.action === 'hour_adjust' || change.action === 'flexible_ot')
    ) {
        return Boolean(viewer) && viewer === String(change.requestedById || '');
    }
    return false;
}

function rowDecisionFor(mark, employee, {
    isFlowchartHr = false,
    viewerId = '',
    canApproveLeave = false,
    flowchartHrName = '',
} = {}) {
    if (!mark) return null;
    const viewer = String(viewerId || '').trim();
    const reportee = String(employee?.primaryReportee || '').trim();
    const isReportee = Boolean(viewer) && viewer === reportee;
    const names = {
        flowchartHrName,
        reporteeName: String(employee?.primaryReporteeName || '').trim(),
    };
    const change = mark.pendingChange;
    if (change?.id) {
        const canDecideChange = viewerCanDecideChange(change, { isFlowchartHr, viewer, isReportee });
        if (canDecideChange && change.action === 'flexible_ot') {
            return {
                kind: 'ot',
                id: String(change.id),
                attendanceId: String(mark.attendanceId || ''),
                title: 'OT Approval',
            };
        }
        if (canDecideChange && change.action === 'hour_adjust') {
            return {
                kind: 'hour',
                id: String(change.id),
                attendanceId: String(mark.attendanceId || ''),
                title: pendingRequestTitle(mark, 'hour'),
            };
        }
        if (canDecideChange) {
            return {
                kind: 'change',
                id: String(change.id),
                title: pendingRequestTitle(mark, 'change'),
            };
        }
        return waitingForApproval(change, mark, names);
    }
    if (String(mark.leaveRequestStatus || '') === 'pending' && mark.attendanceId) {
        const leaveWithHr = leaveWaitingOnHr(mark);
        const canDecideLeave = leaveWithHr ? isFlowchartHr : isReportee;
        if (canDecideLeave) {
            return {
                kind: 'leave',
                attendanceId: String(mark.attendanceId),
                title: pendingRequestTitle(mark, 'leave'),
            };
        }
        const who = leaveWithHr ? (flowchartHrName || 'HR') : (names.reporteeName || 'primary reportee');
        return waitingDecision(who, pendingRequestTitle(mark, 'leave'), 'leave');
    }
    if (String(mark.flexibleOtStatus || '') === 'pending' && mark.attendanceId) {
        if (isFlowchartHr) {
            return {
                kind: 'ot',
                attendanceId: String(mark.attendanceId),
                title: pendingRequestTitle(mark, 'ot'),
            };
        }
        return waitingDecision(flowchartHrName || 'HR', pendingRequestTitle(mark, 'ot'), 'ot');
    }
    if (String(mark.hourAdjustStatus || '') === 'pending' && mark.attendanceId) {
        if (isFlowchartHr) {
            return {
                kind: 'hour',
                attendanceId: String(mark.attendanceId),
                title: pendingRequestTitle(mark, 'hour'),
            };
        }
        return waitingDecision(flowchartHrName || 'HR', pendingRequestTitle(mark, 'hour'), 'hour');
    }
    return null;
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
        primaryReporteeName: String(emp?.primaryReporteeName || ''),
        timeIn: '—',
        timeOut: '—',
        attendanceSuspended: Boolean(emp?.attendanceSuspended),
        attendanceSuspensionNote: String(
            emp?.attendanceSuspension?.description || emp?.attendanceSuspensionNote || '',
        ),
    };
}

function findAttendanceRow(employeeId) {
    const id = String(employeeId || '').trim();
    if (!id || typeof document === 'undefined') return null;
    const byId = document.querySelector(`[data-attendance-employee="${CSS.escape(id)}"]`);
    if (byId) return byId;
    return document.querySelector(`[data-attendance-empno="${CSS.escape(id)}"]`);
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
    const span = punchSpanSeconds(mark?.rawTimeIn, mark?.rawTimeOut, mark?.timeOutDate, mark?.date);
    const durationHours = span != null ? span / 3600 : workedHoursValue(mark);
    const syntheticOt = isOtPunch(mark?.rawTimeIn) || isOtPunch(mark?.rawTimeOut);
    const flexibleTiming = String(ctx.scheduleWeek?.timingMode || '').toLowerCase() === 'flexible';
    const { otText, showOtRequest, showNextDayPresent } = otActionState({
        mark,
        durationHours,
        requiredHours: mark?.flexibleRequiredHours,
        syntheticOt,
        nonWorkingDay:
            (Boolean(ctx.dayBaseline) || weekdayKeyFromDate(mark?.date) === 'sunday') &&
            !syntheticOt &&
            durationHours > 0,
    });
    if (otText) return otText;
    if (!flexibleTiming || !showOtRequest) return null;
    if (ctx.isFlowchartHr) return showNextDayPresent ? 'next day present' : 'apply ot';
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
        `flex h-3.5 w-3.5 items-center justify-center rounded-sm leading-none ${on ? 'text-[#EA3D2F]' : 'text-gray-300 hover:text-gray-600'
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
                        className={`w-full px-3 py-2 text-left text-sm ${itemDisabled
                                ? 'cursor-not-allowed text-gray-300'
                                : 'hover:bg-gray-50'
                            } ${opt.key === 'clear_attendance'
                                ? 'border-t border-gray-100 mt-0.5'
                                : ''
                            } ${itemDisabled
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

function clockInputValue(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
    if (!match) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function AttendanceChangeReviewModal({ open, employee, mark, deciding, rejectFirst = false, readOnly = false, onClose, onDecide }) {
    const change = mark?.pendingChange || {};
    const showHours = change.action === 'hour_adjust' || change.action === 'flexible_ot';
    const [editing, setEditing] = useState(false);
    const [timeIn, setTimeIn] = useState('');
    const [timeOut, setTimeOut] = useState('');
    const [hours, setHours] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        if (!open) return;
        setEditing(false);
        setRejecting(Boolean(rejectFirst));
        setRejectReason('');
        setTimeIn(clockInputValue(change.timeIn));
        setTimeOut(clockInputValue(change.timeOut));
        const stored =
            change.action === 'flexible_ot' ? change.flexibleOtApprovedHours : change.hoursApproved;
        setHours(stored ? String(stored) : '');
    }, [
        open,
        change.id,
        change.timeIn,
        change.timeOut,
        change.hoursApproved,
        change.flexibleOtApprovedHours,
        change.action,
        rejectFirst,
    ]);

    if (!open) return null;
    const waitingOnHr = change.stage === 'pending_hr';
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={onClose}
                disabled={deciding}
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
                <div className="border-b border-slate-100 px-5 py-4">
                    <h2 className="text-base font-semibold text-slate-900">
                        {waitingOnHr ? 'HR approval' : 'Attendance request'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        {waitingOnHr
                            ? 'Approving this updates the attendance day.'
                            : 'Approving this sends the change to HR. The day stays as it is until HR approves.'}
                    </p>
                </div>
                <div className="space-y-2 px-5 py-4 text-sm text-slate-700">
                    <p>
                        <span className="text-slate-500">Employee: </span>
                        <strong>{employee?.name || 'Employee'}</strong>
                        {employee?.empNo ? ` (${employee.empNo})` : ''}
                    </p>
                    <p>
                        <span className="text-slate-500">Date: </span>
                        {change.date || mark?.date || '—'}
                    </p>
                    <p>
                        <span className="text-slate-500">Requested by: </span>
                        {change.requestedByName || '—'}
                    </p>
                    <p>
                        <span className="text-slate-500">Currently: </span>
                        {mark?.label || 'Not marked'}
                    </p>
                    <p>
                        <span className="text-slate-500">Requested: </span>
                        {change.statusLabel || 'Updated'}
                    </p>
                    {editing || readOnly ? (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <label className="text-xs text-slate-500">
                                Time in
                                <input
                                    type="time"
                                    value={timeIn}
                                    disabled={readOnly}
                                    onChange={(event) => setTimeIn(event.target.value)}
                                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                                />
                            </label>
                            <label className="text-xs text-slate-500">
                                Time out
                                <input
                                    type="time"
                                    value={timeOut}
                                    disabled={readOnly}
                                    onChange={(event) => setTimeOut(event.target.value)}
                                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                                />
                            </label>
                            {showHours ? (
                                <label className="col-span-2 text-xs text-slate-500">
                                    Approved hours
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        value={hours}
                                        disabled={readOnly}
                                        onChange={(event) => setHours(event.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                                    />
                                </label>
                            ) : null}
                        </div>
                    ) : change.timeIn || change.timeOut ? (
                        <p>
                            <span className="text-slate-500">Time: </span>
                            {change.timeIn || '—'} – {change.timeOut || '—'}
                        </p>
                    ) : null}
                    {change.confirmNextDay && change.targetDate ? (
                        <p>
                            <span className="text-slate-500">Day to mark present: </span>
                            {change.targetDate}
                        </p>
                    ) : null}
                    <p>
                        <span className="text-slate-500">Requester reason: </span>
                        <span className="whitespace-pre-wrap">{String(change.reason || '').trim() || '—'}</span>
                    </p>
                    {change.attachmentName ? (
                        <p>
                            <span className="text-slate-500">Attachment: </span>
                            {change.attachmentUrl ? (
                                <a
                                    href={change.attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-blue-600 hover:underline break-all"
                                >
                                    {change.attachmentName}
                                </a>
                            ) : (
                                <span className="break-all">{change.attachmentName}</span>
                            )}
                        </p>
                    ) : null}
                    {rejecting ? (
                        <label className="block text-xs font-semibold text-slate-500">
                            Reject reason
                            <textarea
                                value={rejectReason}
                                disabled={readOnly}
                                onChange={(event) => setRejectReason(event.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                        </label>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                    <button
                        type="button"
                        disabled={deciding}
                        onClick={onClose}
                        className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-600"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        disabled={deciding || readOnly}
                        onClick={() => {
                            if (readOnly) return;
                            setEditing((value) => !value);
                        }}
                        className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {editing ? 'Done' : 'Edit'}
                    </button>
                    <button
                        type="button"
                        disabled={readOnly || deciding || (rejecting && !String(rejectReason).trim())}
                        onClick={() => {
                            if (readOnly) return;
                            if (!rejecting) {
                                setRejecting(true);
                                return;
                            }
                            onDecide?.('rejected', { rejectReason: String(rejectReason).trim() });
                        }}
                        className="h-9 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {rejecting ? 'Confirm reject' : 'Reject'}
                    </button>
                    <button
                        type="button"
                        disabled={deciding || readOnly}
                        onClick={() => {
                            if (readOnly) return;
                            onDecide?.('approved', {
                                timeIn,
                                timeOut,
                                approvedHours: showHours && hours !== '' ? Number(hours) : undefined,
                            });
                        }}
                        className="h-9 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Approve
                    </button>
                </div>
            </div>
        </div>
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
    canWaiveDeduction = false,
    canRequestOt = false,
    otDirect = false,
    canReviewOt = false,
    rowDecision = null,
    deciding = false,
    onDecide,
    onOpenRequest,
    pastDay = false,
    dateKey = '',
    scheduleWeek = null,
    dayBaseline = '',
    actionLocked = false,
    actionTitle = '',
    menuOptions = MARK_OPTIONS,
    blink = false,
}) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState(null);
    const buttonRef = useRef(null);
    const profileHref = attendanceProfileHref(employee.id);

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
    const checkoutNextDay = isNextDayCheckout({
        date: mark?.date,
        timeIn: mark?.rawTimeIn || timeIn,
        timeOut: mark?.rawTimeOut || timeOut,
        timeOutDate: mark?.timeOutDate,
    });
    const baseMark = markForNonWorkingDay(mark, timeIn, timeOut, dayBaseline);
    const shownMark = baseMark
        ? {
            ...baseMark,
            reason: lateReasonFromSchedule(baseMark.reason, mark?.rawTimeIn || timeIn, scheduleWeek, dateKey),
        }
        : baseMark;
    const pendingLeaveLabel = String(mark?.leaveRequestStatus || '') === 'pending'
        ? String(mark?.requestedStatusLabel || rowDecision?.title || 'Leave').trim()
        : '';
    const rawIn = mark?.rawTimeIn || timeIn;
    const rawOut = mark?.rawTimeOut || timeOut;
    const syntheticOt = isOtPunch(rawIn) || isOtPunch(rawOut);
    const workedOffDay = Boolean(dayBaseline) && !syntheticOt && (
        (timeIn && timeIn !== '—') || (timeOut && timeOut !== '—')
    );
    const manualLeave = ['sick_leave', 'on_leave', 'authorized_leave', 'compoff_leave', 'work_from_home', 'suspended'].includes(
        String(shownMark?.key || ''),
    );
    const offDayWork = workedOffDay && !manualLeave;
    const sundayWork =
        !dayBaseline &&
        weekdayKeyFromDate(dateKey) === 'sunday' &&
        !syntheticOt &&
        !manualLeave &&
        ((timeIn && timeIn !== '—') || (timeOut && timeOut !== '—'));
    const compensableOffWork = offDayWork || sundayWork;
    const statusText = formatStatusLabel(shownMark, timeIn, pastDay);
    const statusFull = statusHoverTitle(statusText);
    const duration = syntheticOt
        ? hoursDurationLabel(mark?.flexibleWorkedHours)
        : punchDurationLabel(rawIn, rawOut, mark?.timeOutDate, mark?.date);
    const mispunchedHours = String(shownMark?.key || '') === 'mispunch' || /mispunch/i.test(statusText);
    const rowLocked = actionLocked;
    const lockTitle = actionLocked ? actionTitle : undefined;

    const shift = shiftMarks(mark?.rawTimeIn, mark?.rawTimeOut, mark?.timeOutDate, mark?.date);
    const adjustLines = adjustmentLines(mark);
    const adjustTitle = adjustLines.join(' ');
    const syntheticOtReason = /^Present \(On time\) from overtime$/i.test(String(shownMark?.reason || '').trim());
    const actionMenuOptions = rowMenuOptions(menuOptions, shownMark, { canReviewHour, canWaiveDeduction });
    const spanSeconds = syntheticOt ? null : punchSpanSeconds(rawIn, rawOut, mark?.timeOutDate, mark?.date);
    const durationHours = spanSeconds != null ? spanSeconds / 3600 : workedHoursValue(mark);
    const requiredHours = scheduleDayHours(scheduleWeek, dateKey) || Number(mark?.flexibleRequiredHours) || 0;
    const flexibleTiming = String(scheduleWeek?.timingMode || '').toLowerCase() === 'flexible';
    const lateMinutes = !flexibleTiming && /late/i.test(statusText)
        ? scheduledLateMinutes(scheduleWeek, dateKey, rawIn)
        : 0;
    const otState = otActionState({
        mark,
        durationHours,
        requiredHours,
        syntheticOt,
        nonWorkingDay: compensableOffWork && durationHours > 0,
    });
    const otText = otState.otText;
    const otHours = otState.otHours;
    const showOtRequest = otState.showOtRequest && (flexibleTiming || compensableOffWork);
    const showNextDayPresent = otState.showNextDayPresent && (flexibleTiming || compensableOffWork);
    const showCompOff = compensableOffWork && otState.showOtRequest;
    const requestMark = markWithRequestableOt(mark, otHours);
    const otButtonLabel = otDirect ? 'Apply OT' : 'Req OT';

    return (
        <tr
            data-attendance-employee={employee.id}
            data-attendance-empno={employee.empNo}
            className={`border-b border-gray-100 hover:bg-slate-50/80 ${blink ? 'record-focus-blink' : ''}`}
        >
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
                {profileHref ? (
                    <Link
                        href={profileHref}
                        className="hover:text-[#2563EB] hover:underline"
                        onClick={(event) => handleNavigateFromListClick(event, router, profileHref)}
                    >
                        {shortEmployeeName(employee.name)}
                    </Link>
                ) : (
                    shortEmployeeName(employee.name)
                )}
            </td>
            <td className="px-3 py-3 text-sm text-gray-600 tabular-nums align-middle">{employee.empNo}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">{isOtPunch(timeIn) ? '—' : timeIn}</td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle">
                {isOtPunch(timeOut) ? '—' : <NextDayCheckoutTime time={timeOut} nextDay={checkoutNextDay} />}
            </td>
            <td className="px-3 py-3 text-sm text-gray-700 tabular-nums align-middle whitespace-nowrap">
                {mispunchedHours ? (
                    <span className="font-medium text-amber-600">Mispunched</span>
                ) : (
                    <span>
                        {duration}
                        {lateMinutes > 0 ? (
                            <span className="mt-0.5 block text-[11px] font-medium text-amber-600">
                                {lateMinutes} minute{lateMinutes === 1 ? '' : 's'} late
                            </span>
                        ) : null}
                    </span>
                )}
            </td>
            <td className="px-3 py-3 align-middle min-w-[220px]">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <StatusApprovalTip
                        approvals={mark?.approvals}
                        statusTitle={[pendingLeaveLabel ? `${pendingLeaveLabel} pending` : statusFull, mark?.reason, adjustTitle, rowDecision ? `Pending: ${rowDecision.title}` : '']
                            .filter(Boolean)
                            .join(' — ')}
                        className={`inline-flex w-fit cursor-pointer border-0 text-left text-[11px] font-medium px-2 py-1 rounded max-w-full truncate ${
                            pendingLeaveLabel
                                ? 'text-amber-800 bg-amber-50'
                                : statusChipClass(shownMark, statusText)
                        }`}
                    >
                        {pendingLeaveLabel || statusText}
                    </StatusApprovalTip>
                    {pendingLeaveLabel ? (
                        <span className="text-[10px] font-semibold text-amber-700 whitespace-nowrap" title={pendingLeaveLabel}>
                            {pendingLeaveLabel} pending
                        </span>
                    ) : rowDecision?.kind === 'waiting' ? (
                        <PendingApprovalLink
                            decision={rowDecision}
                            mark={mark}
                            onOpen={onOpenRequest}
                            className="max-w-[220px] text-left text-[10px]"
                        />
                    ) : rowDecision ? (
                        <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap" title={rowDecision.title}>
                            {rowDecision.title} pending
                        </span>
                    ) : null}
                    {mark?.pendingChange?.rejectReason ? (
                        <span
                            className="text-[10px] font-semibold text-rose-700 max-w-[180px] truncate"
                            title={mark.pendingChange.rejectReason}
                        >
                            Rejected: {mark.pendingChange.rejectReason}
                        </span>
                    ) : null}
                    {adjustLines.map((line) => (
                        <span key={line} className="text-[10px] font-semibold text-violet-700 whitespace-nowrap" title={line}>
                            {line}
                        </span>
                    ))}
                    {mark?.deductionWaived ? (
                        <span
                            className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap"
                            title={mark.deductionWaiveReason || 'Deduction waived'}
                        >
                            Deduction waived
                        </span>
                    ) : null}
                    {shownMark?.reason && !(syntheticOtReason && adjustLines.length) && !(countsAsOnTime(mark) && /no punch-in or punch-out/i.test(String(shownMark.reason))) ? (
                        <span className="text-[10px] text-gray-500 max-w-[180px] truncate" title={shownMark.reason}>
                            {shownMark.reason}
                        </span>
                    ) : null}
                    {(() => {
                        const sick =
                            mark?.key === 'sick_leave' ||
                            mark?.requestedStatusKey === 'sick_leave' ||
                            mark?.pendingChange?.statusKey === 'sick_leave';
                        const requestReason = String(
                            mark?.leaveRequestReason || mark?.pendingChange?.reason || '',
                        ).trim();
                        const attachment = String(
                            mark?.attachmentName || mark?.pendingChange?.attachmentName || '',
                        ).trim();
                        if (!sick && !attachment) return null;
                        const attachmentUrl = String(
                            mark?.attachmentUrl || mark?.pendingChange?.attachmentUrl || '',
                        ).trim();
                        const reasonAlreadyShown =
                            requestReason && requestReason === String(shownMark?.reason || '').trim();
                        return (
                            <>
                                {requestReason && !reasonAlreadyShown ? (
                                    <span className="text-[10px] text-gray-500 max-w-[180px] truncate" title={requestReason}>
                                        {requestReason}
                                    </span>
                                ) : null}
                                {attachment ? (
                                    <button
                                        type="button"
                                        title={`Open ${attachment}`}
                                        onClick={(event) => openStoredLeaveFile(event, {
                                            url: attachmentUrl,
                                            attendanceId: mark?.attendanceId || '',
                                            employeeMongoId: employee?.id || '',
                                            date: mark?.date || '',
                                            name: attachment,
                                        })}
                                        className="max-w-[220px] truncate text-left text-[11px] font-bold text-blue-700 underline"
                                    >
                                        Open {attachment}
                                    </button>
                                ) : null}
                            </>
                        );
                    })()}
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
                <PunchLocationPinCell
                    location={mark?.checkOutLocation}
                    time={timeOut}
                    kind="out"
                    nextDay={checkoutNextDay}
                />
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
                {canReviewOt && rowDecision?.kind !== 'ot' && !rowLocked ? (
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
                    <div className="flex flex-col items-start gap-1">
                        {showNextDayPresent || showCompOff ? (
                            <button
                                type="button"
                                disabled={rowLocked || !canRequestOt}
                                title={
                                    canRequestOt
                                        ? 'Choose an authorized leave day in this month. That day becomes Present now. HR and the primary reportee are emailed.'
                                        : 'Enable Apply OT and next day present on your permission group'
                                }
                                onClick={() => {
                                    if (canRequestOt) onRequestOt?.(employee, requestMark, 'next-day');
                                }}
                                className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {showCompOff ? 'Comp Off' : 'Next day present'}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            disabled={rowLocked || !canRequestOt}
                            title={
                                canRequestOt
                                    ? otDirect
                                        ? 'Apply overtime now'
                                        : 'Send this for approval. The day stays unchanged until HR approves.'
                                    : 'Enable Apply OT and next day present on your permission group'
                            }
                            onClick={() => {
                                if (canRequestOt) onRequestOt?.(employee, requestMark, 'apply');
                            }}
                            className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {otButtonLabel}
                        </button>
                    </div>
                ) : (
                    <span className="text-gray-300">—</span>
                )}
            </td>
            <td className="px-2 py-3 align-middle text-right">
                <div className="relative inline-flex items-center justify-end gap-1 min-h-[32px]">
                    {rowDecision?.kind === 'waiting' ? (
                        <PendingApprovalLink
                            decision={rowDecision}
                            mark={mark}
                            onOpen={onOpenRequest}
                            className="whitespace-nowrap text-right text-[11px]"
                        />
                    ) : rowDecision ? (
                        <>
                            <button
                                type="button"
                                disabled={deciding}
                                title={`Reject ${rowDecision.title}`}
                                aria-label={`Reject ${rowDecision.title} for ${employee.name}`}
                                onClick={() => onOpenRequest?.('reject')}
                                className="h-7 whitespace-nowrap rounded-md border border-red-200 bg-white px-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                disabled={deciding}
                                title={`Open ${rowDecision.title}`}
                                aria-label={`${mark?.pendingChange?.rejectReason ? 'Reapply' : 'Approve'} ${rowDecision.title} for ${employee.name}`}
                                onClick={() => onOpenRequest?.(rowDecision.kind === 'hour' ? 'approve' : undefined)}
                                className="h-7 whitespace-nowrap rounded-md bg-blue-600 px-2 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {mark?.pendingChange?.rejectReason ? 'Reapply' : 'Approve'}
                            </button>
                        </>
                    ) : (
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
                    )}
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

export default function MarkAttendanceTable({
    dateKey,
    staffType = 'office',
    otAttendanceId = '',
    hourAttendanceId = '',
    leaveAttendanceId = '',
    changeRequestId = '',
    blinkEmployeeId = '',
    emailIntent = '',
}) {
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
    const [mispunchModal, setMispunchModal] = useState(null);
    const [waiveModal, setWaiveModal] = useState(null);
    const [leaveDecide, setLeaveDecide] = useState(null);
    const [leaveDeciding, setLeaveDeciding] = useState(false);
    const [leaveDecideError, setLeaveDecideError] = useState('');
    const [changeReview, setChangeReview] = useState(null);
    const [scheduleWeek, setScheduleWeek] = useState(null);
    const [compOffEmployee, setCompOffEmployee] = useState(null);
    const [decidingEmployeeId, setDecidingEmployeeId] = useState('');
    const [activeBlinkId, setActiveBlinkId] = useState('');
    const [focusRequest, setFocusRequest] = useState(null);
    const [canUseOtActions, setCanUseOtActions] = useState(false);
    const [flowchartHrName, setFlowchartHrName] = useState('');
    const [canApproveLeave, setCanApproveLeave] = useState(false);
    const viewerId = useMemo(() => currentEmployeeMongoId(), []);

    useEffect(() => {
        setCanUseOtActions(hasPermission('hrm_attendance_ot', 'isView'));
        setCanApproveLeave(
            hasPermission('hrm_leave', 'isView')
            || hasPermission('hrm_leave', 'isCreate')
            || hasPermission('hrm_leave', 'isEdit'),
        );
    }, []);
    const bulkButtonRef = useRef(null);
    const employeesRef = useRef([]);
    const dayRecordsRef = useRef([]);
    const focusStartedRef = useRef('');
    const focusTimerRef = useRef(0);

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
                    setFlowchartHrName(String(data?.name || '').trim());
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

        window.clearTimeout(focusTimerRef.current);
        focusStartedRef.current = '';
        setActiveBlinkId('');
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
                const approvalHistory = Array.isArray(res.data?.approvalHistory)
                    ? res.data.approvalHistory
                    : [];
                dayRecordsRef.current = records;
                // Roster is already filtered by staffType from API
                const { nextEmployees, nextMarks } = applyDayRecordsToState(allEmployees, records);
                const mergedMarks = withAttendanceOverlays(nextMarks, pendingChanges, approvalHistory, {
                    dateKey,
                    employeeIds: new Set(nextEmployees.map((row) => row.id)),
                });
                setEmployees(nextEmployees);
                setMarks(mergedMarks);
                let focusEmployeeId = String(blinkEmployeeId || '').trim();
                let focusKind = '';
                let focusEmployee = null;
                let focusMark = null;
                const takeFocus = (match, kind) => {
                    if (!match) return;
                    focusEmployeeId = String(match.id || focusEmployeeId || '');
                    focusKind = kind;
                    focusEmployee = match;
                    focusMark = mergedMarks[match.id];
                };
                if (otAttendanceId) {
                    const match = nextEmployees.find(
                        (row) => mergedMarks[row.id]?.attendanceId === String(otAttendanceId),
                    );
                    if (match && mergedMarks[match.id]?.flexibleOtStatus === 'pending') {
                        takeFocus(match, 'ot');
                    }
                }
                if (hourAttendanceId) {
                    const match = nextEmployees.find(
                        (row) => mergedMarks[row.id]?.attendanceId === String(hourAttendanceId),
                    );
                    if (match && mergedMarks[match.id]?.hourAdjustStatus === 'pending') {
                        takeFocus(match, 'hour');
                    }
                }
                if (leaveAttendanceId) {
                    const match = nextEmployees.find(
                        (row) => mergedMarks[row.id]?.attendanceId === String(leaveAttendanceId),
                    ) || nextEmployees.find(
                        (row) =>
                            String(row.id) === String(blinkEmployeeId || '') &&
                            mergedMarks[row.id]?.leaveRequestStatus === 'pending',
                    );
                    if (match && mergedMarks[match.id]?.leaveRequestStatus === 'pending') {
                        takeFocus(match, 'leave');
                    }
                }
                if (changeRequestId) {
                    const match = nextEmployees.find(
                        (row) => String(mergedMarks[row.id]?.pendingChange?.id || '') === String(changeRequestId),
                    );
                    const action = String(mergedMarks[match?.id]?.pendingChange?.action || '');
                    if (match && action === 'flexible_ot') takeFocus(match, 'ot');
                    else if (match && action === 'hour_adjust') takeFocus(match, 'hour');
                    else if (match) takeFocus(match, 'change');
                }
                if (focusEmployeeId || focusKind) {
                    setFocusRequest({
                        token: [
                            dateKey,
                            staffType,
                            otAttendanceId,
                            hourAttendanceId,
                            leaveAttendanceId,
                            changeRequestId,
                            focusKind,
                            focusEmployeeId,
                            dayReload,
                        ].join('|'),
                        dateKey,
                        employeeId: focusEmployeeId,
                        kind: focusKind,
                        employee: focusEmployee,
                        mark: focusMark,
                    });
                } else {
                    setFocusRequest(null);
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
    }, [dateKey, loading, allEmployees, dayReload, otAttendanceId, hourAttendanceId, leaveAttendanceId, changeRequestId, blinkEmployeeId]);

    useEffect(() => () => window.clearTimeout(focusTimerRef.current), []);

    useEffect(() => {
        if (!focusRequest || loading || dayLoading || focusRequest.dateKey !== dateKey) return undefined;
        if (focusRequest.kind === 'hour' && !hrReady) return undefined;
        if (focusStartedRef.current === focusRequest.token) return undefined;

        const requestedId = String(focusRequest.employeeId || '').trim();
        const node = findAttendanceRow(requestedId);
        if (requestedId && !node && employees.length === 0) return undefined;

        focusStartedRef.current = focusRequest.token;
        const rowId = node?.getAttribute('data-attendance-employee') || requestedId;
        if (node) {
            node.scrollIntoView({ block: 'center', behavior: 'auto' });
            setActiveBlinkId(rowId);
        }

        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = window.setTimeout(() => {
            setActiveBlinkId('');
            const { kind, employee, mark } = focusRequest;
            if (!kind || !employee || !mark) return;
            if (kind === 'ot') {
                setOtModal({ employee, mark, mode: 'review' });
                return;
            }
            if (kind === 'leave') {
                setLeaveDecideError('');
                setLeaveDecide({
                    employee,
                    mark,
                    rejectFirst: String(emailIntent || '').toLowerCase() === 'rejected',
                });
                return;
            }
            if (kind === 'change') {
                const sickChange =
                    String(mark?.pendingChange?.statusKey || '') === 'sick_leave' ||
                    /sick/i.test(String(mark?.pendingChange?.statusLabel || ''));
                if (sickChange) {
                    setLeaveDecideError('');
                    setLeaveDecide({
                        employee,
                        mark,
                        fromChange: true,
                        rejectFirst: String(emailIntent || '').toLowerCase() === 'rejected',
                    });
                    return;
                }
                setChangeReview({ employee, mark });
                return;
            }
            if (kind === 'hour' && isAuthorizedLeaveHour(mark)) {
                openAuthorizedLeaveDecision(employee, mark, {
                    rejectFirst: String(emailIntent || '').toLowerCase() === 'rejected',
                });
                return;
            }
            if (kind === 'hour') {
                const decision = rowDecisionFor(mark, employee, {
                    isFlowchartHr,
                    viewerId,
                    canApproveLeave,
                    flowchartHrName,
                });
                if (decision?.kind !== 'hour') return;
                const next = { employee, mark, mode: 'review' };
                if (isMispunchRequest(mark)) setMispunchModal(next);
                else setHourModal(next);
            }
        }, node ? RECORD_FOCUS_BLINK_MS + 150 : 0);

        return undefined;
    }, [
        focusRequest,
        dateKey,
        loading,
        dayLoading,
        hrReady,
        employees.length,
        isFlowchartHr,
        viewerId,
        canApproveLeave,
        flowchartHrName,
        emailIntent,
    ]);

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
    const earliestMarkKey = shiftDateKey(todayKey, -7);
    const tomorrowKey = nextCalendarDateKey(todayKey);
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
    const nextDayPresent = !isFlowchartHr && dateKey === tomorrowKey;
    const dayMode = isFlowchartHr || dateKey === todayKey || recentDayOpen
        ? 'full'
        : nextDayPresent
            ? 'next'
            : 'locked';
    const baseMenuOptions = nextDayPresent
        ? [{ key: 'on_office', label: 'Present (Comp off)' }]
        : MARK_OPTIONS;
    const menuOptions = (
        nextDayPresent || baseMenuOptions.some((option) => option.key === 'clear_attendance')
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
    const rowIsActionLocked = (employee) => dayMode === 'locked' || Boolean(employee?.attendanceSuspended);
    const filteredEmployees = useMemo(
        () => employees.filter((employee) =>
            (blinkEmployeeId && String(employee.id) === String(blinkEmployeeId)) ||
            employeeMatchesSearch(employee, searchQuery),
        ),
        [employees, searchQuery, blinkEmployeeId],
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
            scheduleWeek,
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
        scheduleWeek,
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
        const { markKey, markLabel, timeIn, timeOut, reason, attachmentName, attachmentFile, leavePayType } = payload;
        const attachmentData = await new Promise((resolve) => {
            if (!attachmentFile) {
                resolve('');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(attachmentFile);
        });

        const marksPayload = employeesRef.current
            .filter((e) => idSet.has(e.id) && !e.attendanceSuspended)
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
                attachmentData: attachmentData || '',
                leavePayType: leavePayType || '',
            }));

        setSaving(true);
        try {
            const dates = Array.isArray(payload.dates) && payload.dates.length ? payload.dates : [dateKey];
            let res = null;
            for (const date of dates) {
                res = await axiosInstance.post('/Attendance/mark', {
                    date,
                    marks: marksPayload,
                });
            }
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
            const approvalHistory = Array.isArray(dayRes.data?.approvalHistory)
                ? dayRes.data.approvalHistory
                : [];
            dayRecordsRef.current = dayRecords;
            const { nextEmployees, nextMarks } = applyDayRecordsToState(
                employeesRef.current,
                dayRecords,
            );
            setEmployees(nextEmployees);
            setMarks(withAttendanceOverlays(nextMarks, pendingChanges, approvalHistory, {
                    dateKey,
                    employeeIds: new Set(nextEmployees.map((row) => row.id)),
                }));
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
                const approvalHistory = Array.isArray(res.data?.approvalHistory)
                    ? res.data.approvalHistory
                    : [];
                dayRecordsRef.current = records;
                const { nextEmployees, nextMarks } = applyDayRecordsToState(
                    employeesRef.current,
                    records,
                );
                setEmployees(nextEmployees);
                setMarks(withAttendanceOverlays(nextMarks, pendingChanges, approvalHistory, {
                    dateKey,
                    employeeIds: new Set(nextEmployees.map((row) => row.id)),
                }));
            } catch {
                /* ignore */
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRequestMark = (employee, key, label) => {
        if (saving || rowIsActionLocked(employee)) return;
        if (key === 'waive_deduction') {
            if (!isFlowchartHr) return;
            setWaiveModal({ employee, mark: marks[employee.id] || null });
            return;
        }
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

    const isAuthorizedLeaveHour = (mark) =>
        String(mark?.pendingChange?.action || '') === 'hour_adjust' &&
        String(mark?.pendingChange?.hourAdjustKind || mark?.hourAdjustKind || '') === 'authorized_leave';

    const openAuthorizedLeaveDecision = (employee, mark, { rejectFirst = false, readOnly = false } = {}) => {
        setLeaveDecideError('');
        setLeaveDecide({
            employee,
            mark,
            fromHourLeave: true,
            rejectFirst,
            readOnly,
        });
    };

    const openRowRequest = (employee, decision, intent) => {
        if (!decision) return;
        const mark = marks[employee.id] || null;
        const readOnly = intent === 'view' || decision.kind === 'waiting';
        const kind = readOnly
            ? (decision.viewKind && decision.viewKind !== 'waiting' ? decision.viewKind : viewKindFromMark(mark))
            : decision.kind;
        if (!kind || kind === 'waiting') return;
        if (kind === 'hour' && isAuthorizedLeaveHour(mark)) {
            openAuthorizedLeaveDecision(employee, mark, {
                rejectFirst: !readOnly && intent === 'reject',
                readOnly,
            });
            return;
        }
        if (kind === 'hour') {
            const next = {
                employee,
                mark,
                mode: 'review',
                rejectFirst: !readOnly && intent === 'reject',
                readOnly,
            };
            if (isMispunchRequest(mark)) setMispunchModal(next);
            else setHourModal(next);
            return;
        }
        if (kind === 'ot') {
            setOtModal({
                employee,
                mark,
                intent: 'apply',
                mode: 'review',
                rejectFirst: !readOnly && intent === 'reject',
                readOnly,
            });
            return;
        }
        if (kind === 'leave') {
            setLeaveDecideError('');
            setLeaveDecide({
                employee,
                mark,
                rejectFirst: !readOnly && intent === 'reject',
                readOnly,
            });
            return;
        }
        if (kind === 'change') {
            const change = mark?.pendingChange || {};
            const sickChange =
                String(change.statusKey || '') === 'sick_leave' || /sick/i.test(String(change.statusLabel || ''));
            if (sickChange) {
                setLeaveDecideError('');
                setLeaveDecide({
                    employee,
                    mark,
                    rejectFirst: !readOnly && intent === 'reject',
                    readOnly,
                    fromChange: true,
                });
                return;
            }
            setChangeReview({
                employee,
                mark,
                rejectFirst: !readOnly && intent === 'reject',
                readOnly,
            });
        }
    };

    const submitLeaveDecision = async (choice, approvedStatusKey, _pay, edits) => {
        const attendanceId = String(leaveDecide?.mark?.attendanceId || '').trim();
        const changeId = String(leaveDecide?.mark?.pendingChange?.id || '').trim();
        if (leaveDeciding || leaveDecide?.readOnly) return;
        if (leaveDecide?.fromHourLeave ? !changeId : leaveDecide?.fromChange ? !changeId : !attendanceId) return;
        setLeaveDeciding(true);
        setLeaveDecideError('');
        try {
            const res = leaveDecide?.fromHourLeave
                ? await axiosInstance.post('/Attendance/change-request/decide', {
                    id: changeId,
                    decision: choice,
                    ...(choice === 'approved' ? { approvedStatusKey: approvedStatusKey || 'authorized_leave' } : {}),
                    ...(edits?.rejectReason ? { rejectReason: edits.rejectReason } : {}),
                })
                : leaveDecide?.fromChange
                ? await axiosInstance.post('/Attendance/change-request/decide', {
                    id: changeId,
                    decision: choice,
                    ...(choice === 'approved' && approvedStatusKey === 'authorized_leave'
                        ? { approvedStatusKey: 'authorized_leave' }
                        : {}),
                    ...(edits?.rejectReason ? { rejectReason: edits.rejectReason } : {}),
                })
                : await axiosInstance.post('/Leave/pending-requests/decide', {
                attendanceId,
                decision: choice,
                approvedStatusKey: approvedStatusKey || leaveDecide?.mark?.requestedStatusKey || '',
                ...(edits?.timeIn ? { timeIn: edits.timeIn } : {}),
                ...(edits?.timeOut ? { timeOut: edits.timeOut } : {}),
                ...(edits?.rejectReason ? { rejectReason: edits.rejectReason } : {}),
            });
            toast({
                title: choice === 'approved' ? 'Approved' : 'Rejected',
                description: res.data?.message || 'Leave request updated.',
            });
            notifyAttendancePendingInboxChanged();
            notifyLeavePendingInboxChanged();
            setLeaveDecide(null);
            setDayReload((value) => value + 1);
        } catch (error) {
            setLeaveDecideError(error?.response?.data?.message || 'The request was not updated.');
        } finally {
            setLeaveDeciding(false);
        }
    };

    const decideRowRequest = async (employee, decision, choice, edits) => {
        if (!decision || decidingEmployeeId) return;
        setDecidingEmployeeId(employee.id);
        try {
            let description = '';
            if (decision.kind === 'change') {
                const res = await axiosInstance.post('/Attendance/change-request/decide', {
                    id: decision.id,
                    decision: choice,
                    ...(edits?.timeIn ? { timeIn: edits.timeIn } : {}),
                    ...(edits?.timeOut ? { timeOut: edits.timeOut } : {}),
                    ...(Number(edits?.approvedHours) > 0 ? { approvedHours: edits.approvedHours } : {}),
                    ...(edits?.rejectReason ? { rejectReason: edits.rejectReason } : {}),
                    ...(edits?.statusKey ? { approvedStatusKey: edits.statusKey } : {}),
                });
                description = res.data?.message || '';
            } else if (decision.kind === 'leave') {
                const res = await axiosInstance.post('/Leave/pending-requests/decide', {
                    attendanceId: decision.attendanceId,
                    decision: choice,
                    ...(edits?.rejectReason ? { rejectReason: edits.rejectReason } : {}),
                });
                description = res.data?.message || '';
            } else if (decision.kind === 'ot') {
                const res = await axiosInstance.post('/Attendance/flexible-ot/decide', {
                    attendanceId: decision.attendanceId,
                    decision: choice,
                    confirmNextDay: false,
                    ...(edits?.rejectReason ? { rejectReason: edits.rejectReason } : {}),
                });
                description = res.data?.message || '';
            } else if (decision.kind === 'hour') {
                const res = await axiosInstance.post('/Attendance/hour-adjust/decide', {
                    attendanceId: decision.attendanceId,
                    decision: choice,
                    ...(edits?.rejectReason ? { rejectReason: edits.rejectReason } : {}),
                });
                description = res.data?.message || '';
            }
            toast({
                title: choice === 'approved' ? 'Approved' : 'Rejected',
                description: description || `${decision.title} updated.`,
            });
            notifyAttendancePendingInboxChanged();
            if (decision.kind === 'leave') notifyLeavePendingInboxChanged();
            setDayReload((value) => value + 1);
            return true;
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update',
                description: error?.response?.data?.message || 'The request was not updated.',
            });
            return false;
        } finally {
            setDecidingEmployeeId('');
        }
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
            {!isFlowchartHr && dayMode === 'full' ? (
                <div className="px-1 pb-2 text-xs text-slate-500">{RECENT_MARK_NOTE}</div>
            ) : null}
            {!isFlowchartHr && dayMode === 'next' ? (
                <div className="px-1 pb-2 text-xs text-slate-500">{NEXT_DAY_MARK_NOTE}</div>
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
                                blink={String(activeBlinkId || '') === String(employee.id || '')}
                                checked={selectedIds.has(employee.id)}
                                onToggle={toggleOne}
                                mark={marks[employee.id] || null}
                                pastDay={pastDay}
                                dateKey={dateKey}
                                scheduleWeek={scheduleWeek}
                                dayBaseline={dayBaseline}
                                actionLocked={rowIsActionLocked(employee)}
                                actionTitle={
                                    employee.attendanceSuspended
                                        ? 'Suspended account. Attendance cannot be marked.'
                                        : dayMode === 'locked'
                                            ? HR_ONLY_MARK_TITLE
                                            : ''
                                }
                                menuOptions={menuOptions}
                                onRequestMark={handleRequestMark}
                                canRequestOt={
                                    isFlowchartHr ||
                                    canUseOtActions ||
                                    (Boolean(viewerId) &&
                                        viewerId === String(employee.primaryReportee || ''))
                                }
                                rowDecision={rowDecisionFor(marks[employee.id] || null, employee, {
                                    isFlowchartHr,
                                    viewerId,
                                    canApproveLeave,
                                    flowchartHrName,
                                })}
                                deciding={decidingEmployeeId === employee.id}
                                onDecide={(choice) =>
                                    decideRowRequest(
                                        employee,
                                        rowDecisionFor(marks[employee.id] || null, employee, {
                                            isFlowchartHr,
                                            viewerId,
                                            canApproveLeave,
                                            flowchartHrName,
                                        }),
                                        choice,
                                    )
                                }
                                onOpenRequest={(intent) =>
                                    openRowRequest(
                                        employee,
                                        rowDecisionFor(marks[employee.id] || null, employee, {
                                            isFlowchartHr,
                                            viewerId,
                                            canApproveLeave,
                                            flowchartHrName,
                                        }),
                                        intent,
                                    )
                                }
                                canReviewOt={
                                    isFlowchartHr &&
                                    String(marks[employee.id]?.flexibleOtStatus || '') === 'pending'
                                }
                                onRequestOt={(row, mark, intent) =>
                                    setOtModal({
                                        employee: row,
                                        mark,
                                        intent: intent === 'next-day' ? 'next-day' : 'apply',
                                        mode:
                                            isFlowchartHr &&
                                                String(mark?.flexibleOtStatus || '') === 'pending'
                                                ? 'review'
                                                : 'request',
                                    })
                                }
                                onSettleCompOff={setCompOffEmployee}
                                canReviewHour={
                                    isFlowchartHr &&
                                    String(marks[employee.id]?.hourAdjustStatus || '') === 'pending'
                                }
                                canWaiveDeduction={isFlowchartHr}
                                onRequestHour={(row, mark) => {
                                    if (
                                        String(mark?.hourAdjustStatus || '') === 'pending' &&
                                        String(mark?.pendingChange?.hourAdjustKind || mark?.hourAdjustKind || '') === 'authorized_leave'
                                    ) {
                                        openAuthorizedLeaveDecision(row, mark);
                                        return;
                                    }
                                    const next = {
                                        employee: row,
                                        mark,
                                        mode:
                                            isFlowchartHr && String(mark?.hourAdjustStatus || '') === 'pending'
                                                ? 'review'
                                                : isFlowchartHr
                                                    ? 'direct'
                                                    : 'request',
                                    };
                                    if (isMispunchRequest(mark)) setMispunchModal(next);
                                    else setHourModal(next);
                                }}
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
                holidayDates={holidayDates}
                offWeekdays={offWeekdays}
                flowchartHr={isFlowchartHr}
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
                rejectFirst={hourModal?.rejectFirst === true}
                readOnly={hourModal?.readOnly === true}
                employee={hourModal?.employee}
                mark={hourModal?.mark}
                week={scheduleWeek}
                onClose={() => setHourModal(null)}
                onSaved={() => setDayReload((value) => value + 1)}
            />
            <WaiveDeductionModal
                open={Boolean(waiveModal)}
                employee={waiveModal?.employee}
                mark={waiveModal?.mark}
                dateKey={dateKey}
                onClose={() => setWaiveModal(null)}
                onSaved={() => setDayReload((value) => value + 1)}
            />
            <MispunchRequestModal
                open={Boolean(mispunchModal)}
                mode={mispunchModal?.mode}
                rejectFirst={mispunchModal?.rejectFirst === true}
                readOnly={mispunchModal?.readOnly === true}
                employee={mispunchModal?.employee}
                mark={mispunchModal?.mark}
                dateKey={dateKey}
                onClose={() => setMispunchModal(null)}
                onSaved={() => setDayReload((value) => value + 1)}
            />
            <CompOffSettleModal
                open={Boolean(compOffEmployee)}
                employeeMongoId={compOffEmployee?.id || ''}
                date={dateKey}
                onClose={() => setCompOffEmployee(null)}
                onChanged={() => setDayReload((value) => value + 1)}
            />
            <AttendanceLeaveDecideModal
                isOpen={Boolean(leaveDecide)}
                dateKey={leaveDecide?.mark?.date || dateKey}
                employeeName={leaveDecide?.employee?.name || ''}
                employeeMongoId={leaveDecide?.employee?.id || ''}
                requestedStatusKey={
                    leaveDecide?.fromHourLeave
                        ? 'authorized_leave'
                        : leaveDecide?.fromChange
                        ? leaveDecide?.mark?.pendingChange?.statusKey || 'sick_leave'
                        : leaveDecide?.mark?.requestedStatusKey || ''
                }
                currentLabel={
                    leaveDecide?.fromHourLeave
                        ? leaveDecide?.mark?.pendingChange?.previousStatusLabel || leaveDecide?.mark?.label || ''
                        : leaveDecide?.mark?.previousStatusLabel || leaveDecide?.mark?.label || ''
                }
                requestedLabel={
                    leaveDecide?.fromHourLeave
                        ? 'Authorized Leave'
                        : leaveDecide?.fromChange
                        ? leaveDecide?.mark?.pendingChange?.statusLabel || 'Sick leave'
                        : leaveDecide?.mark?.requestedStatusLabel || ''
                }
                reason={
                    leaveDecide?.mark?.leaveRequestReason ||
                    leaveDecide?.mark?.pendingChange?.reason ||
                    leaveDecide?.mark?.reason ||
                    ''
                }
                attachmentName={leaveDecide?.mark?.pendingChange?.attachmentName || leaveDecide?.mark?.attachmentName || ''}
                attachmentUrl={leaveDecide?.mark?.pendingChange?.attachmentUrl || leaveDecide?.mark?.attachmentUrl || ''}
                kind={leaveDecide?.mark?.leaveRequestKind || 'leave'}
                fromDate={leaveDecide?.mark?.leaveRequestFromDate || ''}
                toDate={leaveDecide?.mark?.leaveRequestToDate || ''}
                dayPart={leaveDecide?.mark?.leaveRequestDayPart || ''}
                session={leaveDecide?.mark?.leaveRequestSession || ''}
                requestTimeIn={leaveDecide?.mark?.leaveRequestTimeIn || ''}
                requestTimeOut={leaveDecide?.mark?.leaveRequestTimeOut || ''}
                timeIn={leaveDecide?.mark?.rawTimeIn || ''}
                timeOut={leaveDecide?.mark?.rawTimeOut || ''}
                changedBy={leaveDecide?.employee?.name || ''}
                hrReview={isFlowchartHr || canApproveLeave}
                deciding={leaveDeciding}
                readOnly={leaveDecide?.readOnly === true}
                rejectFirst={leaveDecide?.rejectFirst === true}
                error={leaveDecideError}
                onClose={() => {
                    if (leaveDeciding) return;
                    setLeaveDecide(null);
                    setLeaveDecideError('');
                }}
                onDecide={submitLeaveDecision}
            />
            <AttendanceChangeReviewModal
                open={Boolean(changeReview)}
                employee={changeReview?.employee}
                mark={changeReview?.mark}
                deciding={decidingEmployeeId === changeReview?.employee?.id}
                rejectFirst={changeReview?.rejectFirst === true}
                readOnly={changeReview?.readOnly === true}
                onClose={() => {
                    if (decidingEmployeeId) return;
                    setChangeReview(null);
                }}
                onDecide={(choice, edits) => {
                    if (changeReview?.readOnly) return;
                    const employee = changeReview?.employee;
                    const decision = employee
                        ? rowDecisionFor(changeReview?.mark, employee, { isFlowchartHr, viewerId, canApproveLeave, flowchartHrName })
                        : null;
                    if (!employee || !decision) return;
                    decideRowRequest(employee, decision, choice, edits).then((ok) => {
                        if (ok) setChangeReview(null);
                    });
                }}
            />
            <FlexibleOtModal
                open={Boolean(otModal)}
                mode={otModal?.mode || 'request'}
                intent={otModal?.intent || 'apply'}
                readOnly={otModal?.readOnly === true}
                employee={otModal?.employee}
                mark={otModal?.mark}
                dayHours={
                    Number(otModal?.mark?.flexibleRequiredHours) > 0
                        ? Number(otModal.mark.flexibleRequiredHours)
                        : scheduleDayHours(scheduleWeek, otModal?.mark?.date || dateKey)
                }
                hrName={flowchartHrName}
                viewerIsReportee={
                    Boolean(viewerId) &&
                    viewerId === String(otModal?.employee?.primaryReportee || '')
                }
                rejectFirst={otModal?.rejectFirst === true}
                onClose={() => setOtModal(null)}
                onSaved={() => setDayReload((value) => value + 1)}
            />
        </>
    );
}
