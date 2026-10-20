'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isNextDayCheckout, NextDayCheckoutTime } from '@/app/HRM/Attendance/utils/nextDayCheckout';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { handleNavigateFromListClick } from '@/utils/listReturnNavigation';
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
import {
    AlertTriangle,
    BarChart3,
    Briefcase,
    CalendarCheck,
    Coins,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    Fingerprint,
    Gift,
    LogOut,
    Plane,
    Plus,
    Search,
    UserRound,
    Users,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { MonthPicker } from '@/components/ui/date-picker';
import { holidayAppliesToStaff } from '@/utils/holidayScope';
import { getEmployeeInitials } from '@/utils/employeeProfileImage';
import { normalizeWorkLocationKey, weekForStaffType } from '@/utils/workLocations';
import useWorkLocations from '@/hooks/useWorkLocations';
import { markAttendanceHref } from '@/app/HRM/Attendance/utils/markAttendanceHref';
import DashboardSalaryEnrollLock, {
    EMPTY_SALARY_LOCK,
    salaryLockFromAttendancePayload,
} from '@/app/dashboard/components/DashboardSalaryEnrollLock';
import { ATTENDANCE_CHECK_CHANGED } from '@/app/dashboard/components/DashboardCheckInOutCard';
import {
    approvalPlacedAsNextDay,
    buildMonthAdditionChoices,
    buildMonthWorkWeeks,
    buildWeeklySalaryAddition,
    emptyWeeklySalaryAddition,
    compOffReferenceLinks,
    formatHourMeasure,
    leaveDatesTakenByOvertime,
} from '../utils/weeklySalaryAddition';
import { employeePendingRequests } from '../utils/pendingCalendarDays';
import { punchAttendanceKind } from '../utils/punchAttendanceKind';
import { mispunchDayAmounts, mispunchPolicyRule } from '../utils/mispunchDeduction';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_STYLE = {
    present: 'bg-[#4ADE80] text-white',
    attention: 'bg-[#FACC15] text-[#713F12]',
    absent: 'bg-[#F87171] text-white',
    sick: 'bg-[#86EFAC] text-[#14532D]',
    authorized: 'bg-[#3B82F6] text-white',
    annual: 'bg-[#A78BFA] text-white',
    compoff: 'bg-[#2DD4BF] text-white',
    holiday: 'bg-[#FDBA74] text-[#7C2D12]',
    weekend: 'bg-[#E8EDF3] text-[#94A3B8]',
    empty: 'bg-[#F8FAFC] text-[#CBD5E1]',
    future: 'bg-[#F8FAFC] text-[#94A3B8]',
    outside: 'bg-[#F1F5F9] text-[#94A3B8]',
    suspended: 'bg-[#64748B] text-white',
};

const LEGEND = [
    { key: 'present', label: 'Present', swatch: 'bg-[#4ADE80]' },
    { key: 'attention', label: 'Late / Missed Punch', swatch: 'bg-[#FACC15]' },
    { key: 'absent', label: 'Unauthorized / Absent', swatch: 'bg-[#F87171]' },
    { key: 'sick', label: 'Sick Leave', swatch: 'bg-[#86EFAC]' },
    { key: 'authorized', label: 'Authorized Leave', swatch: 'bg-[#3B82F6]' },
    { key: 'annual', label: 'Annual Leave', swatch: 'bg-[#A78BFA]' },
    { key: 'compoff', label: 'Comp Off', swatch: 'bg-[#2DD4BF]' },
    { key: 'holiday', label: 'Holiday', swatch: 'bg-[#FDBA74]' },
    { key: 'weekend', label: 'Weekly Off', swatch: 'bg-[#CBD5E1]' },
    { key: 'suspended', label: 'Suspended', swatch: 'bg-[#64748B]' },
];

const TIP_TONE = {
    present: { dot: 'bg-[#22C55E]', text: 'text-[#16A34A]' },
    attention: { dot: 'bg-[#EAB308]', text: 'text-[#CA8A04]' },
    absent: { dot: 'bg-[#EF4444]', text: 'text-[#DC2626]' },
    sick: { dot: 'bg-[#4ADE80]', text: 'text-[#16A34A]' },
    authorized: { dot: 'bg-[#3B82F6]', text: 'text-[#2563EB]' },
    annual: { dot: 'bg-[#A78BFA]', text: 'text-[#7C3AED]' },
    compoff: { dot: 'bg-[#2DD4BF]', text: 'text-[#0F766E]' },
    holiday: { dot: 'bg-[#FB923C]', text: 'text-[#C2410C]' },
    weekend: { dot: 'bg-[#CBD5E1]', text: 'text-[#64748B]' },
    future: { dot: 'bg-[#CBD5E1]', text: 'text-[#64748B]' },
    empty: { dot: 'bg-[#CBD5E1]', text: 'text-[#64748B]' },
    suspended: { dot: 'bg-[#64748B]', text: 'text-[#334155]' },
};

function n(value) {
    return Number(value) || 0;
}

const SALARY_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function yearMonthOf(value) {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
    const named = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!named) return '';
    const index = SALARY_MONTHS.indexOf(named[1].toLowerCase());
    return index >= 0 ? `${named[2]}-${String(index + 1).padStart(2, '0')}` : '';
}

function salaryRowAmount(row) {
    return n(row?.total) || n(row?.monthlySalary) || n(row?.basic);
}

function salaryForMonth(salary, history, monthKey) {
    const rows = Array.isArray(history) ? history : [];
    const fromOf = (row) => yearMonthOf(row?.fromDate) || yearMonthOf(row?.month);
    const covers = rows
        .filter((row) => {
            const from = fromOf(row);
            const to = yearMonthOf(row?.toDate);
            if (!from && !to) return false;
            if (from && monthKey && from > monthKey) return false;
            if (to && monthKey && to < monthKey) return false;
            return salaryRowAmount(row) > 0;
        })
        .sort((a, b) => fromOf(b).localeCompare(fromOf(a)));
    let entry = covers[0] || null;
    if (!entry) {
        const started = rows
            .filter((row) => {
                const from = fromOf(row);
                return salaryRowAmount(row) > 0 && (!from || !monthKey || from <= monthKey);
            })
            .sort((a, b) => fromOf(b).localeCompare(fromOf(a)));
        entry = started[0] || null;
    }
    if (entry) {
        const monthlySalary = salaryRowAmount(entry);
        const basic = n(entry.basic);
        return { monthlySalary, basic, other: Math.max(0, monthlySalary - basic) };
    }
    const monthlySalary = n(salary?.monthlySalary) || n(salary?.totalSalary);
    const basic = n(salary?.basic);
    return {
        monthlySalary,
        basic,
        other: n(salary?.other) || Math.max(0, monthlySalary - basic),
    };
}

function employeeTaskListHref(name) {
    const key = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const params = new URLSearchParams({
        scope: 'All Task',
        status: 'All Status',
    });
    if (key) params.set('employee', key);
    return `/task-manager?${params.toString()}`;
}

function employeeTaskDetailsHref(task) {
    const direct = String(task?.href || '').trim();
    if (direct.startsWith('/')) return direct;
    const id = String(task?.actionId || '').trim();
    if (!id) return '';
    const params = new URLSearchParams();
    if (task.taskNumber) params.set('no', task.taskNumber);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return `/task-manager/${encodeURIComponent(id)}${suffix}`;
}

function employeeTaskTypeClass(type) {
    if (type === 'System Task') return 'bg-[#EFF6FF] text-[#2563EB]';
    if (type === 'Workflow Task') return 'bg-[#F5F3FF] text-[#7C3AED]';
    if (type === 'General Task') return 'bg-[#FFF7ED] text-[#C2410C]';
    return 'bg-[#F8FAFC] text-[#64748B]';
}

function employeeTaskStatusClass(status) {
    if (status === 'Completed') return 'bg-[#ECFDF3] text-[#16A34A]';
    if (status === 'Overdue') return 'bg-[#FEF2F2] text-[#DC2626]';
    if (status === 'Closed') return 'bg-[#F1F5F9] text-[#64748B]';
    return 'bg-[#FFF7ED] text-[#EA580C]';
}

function dubaiTodayKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function shiftDateKey(dateKey, days) {
    const raw = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const [year, month, day] = raw.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function inclusiveDays(from, to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return 0;
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    return Math.round((b - a) / 86400000) + 1;
}

function monthEndKey(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return '';
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${monthKey}-${String(last).padStart(2, '0')}`;
}

function formatDayLabel(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '—';
    const [year, month, day] = dateKey.split('-').map(Number);
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
    return `${String(day).padStart(2, '0')}-${monthName}-${year}`;
}

function employmentTypeLabel(status) {
    const value = String(status || '').trim();
    if (!value) return '—';
    if (value === 'Left User') return 'Left';
    return value;
}

function formatMonthLabel(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return '—';
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function formatAed(value, digits = 0) {
    const amount = Number(value) || 0;
    return `AED ${amount.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
}

function formatAedNumber(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clockToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock12(value) {
    if (String(value || '').trim() === 'OT') return 'OT';
    const minutes = clockToMinutes(value);
    if (minutes == null) return '—';
    const hour24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour = hour24 % 12 || 12;
    return `${hour}:${String(mins).padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes) {
    if (minutes == null || minutes < 0) return '—';
    return formatHourMinute(minutes);
}

function formatHourMinute(totalMinutes) {
    if (totalMinutes == null || !Number.isFinite(Number(totalMinutes))) return '—';
    const sign = Number(totalMinutes) < 0 ? '-' : '';
    const abs = Math.abs(Math.round(Number(totalMinutes)));
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    return `${sign}${hours}h ${String(mins).padStart(2, '0')}m`;
}

/** Calendar gaps are hours. 39 minutes is 0 Hours 39 Minutes, never "39 minutes". */
function formatHourlyGap(totalMinutes) {
    if (totalMinutes == null || !Number.isFinite(Number(totalMinutes))) return '—';
    const negative = Number(totalMinutes) < -0.5;
    const abs = Math.abs(Math.round(Number(totalMinutes)));
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    const sign = negative ? '-' : '';
    const hourText = `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;
    if (!mins) return `${sign}${hourText}`;
    const minuteText = `${mins} ${mins === 1 ? 'Minute' : 'Minutes'}`;
    return `${sign}${hourText} ${minuteText}`;
}

function minutesInReason(reason, pattern) {
    const match = String(reason || '').match(pattern);
    return match ? Number(match[1]) : null;
}

function sumStatusMinutes(records, week, statusKey, direction) {
    const rows = (records || []).filter((row) => String(row?.statusKey || '') === statusKey);
    if (!rows.length) return 0;
    let total = 0;
    let known = 0;
    rows.forEach((row) => {
        const fromReason = direction === 'in'
            ? minutesInReason(row.reason, /(\d+)\s*minutes?\s+late/i)
            : minutesInReason(row.reason, /(\d+)\s*minutes?\s+early/i);
        if (fromReason != null) {
            total += fromReason;
            known += 1;
            return;
        }
        const shift = shiftForDate(week, row?.date);
        if (!shift) return;
        const actual = clockToMinutes(direction === 'in' ? row?.timeIn : row?.timeOut);
        if (actual == null) return;
        const gap = direction === 'in' ? actual - shift.start : shift.end - actual;
        if (gap > 0) {
            total += gap;
            known += 1;
        }
    });
    return known ? total : null;
}

function eventCount(bucket) {
    const approved = n(bucket?.approved);
    const requested = n(bucket?.requested);
    const used = n(bucket?.used);
    if (approved > 0) return approved;
    if (requested > 0) return requested;
    return used;
}

function workedMinutes(timeIn, timeOut) {
    const start = clockToMinutes(timeIn);
    const end = clockToMinutes(timeOut);
    if (start == null || end == null) return null;
    let diff = end - start;
    if (diff <= 0) diff += 24 * 60;
    return diff;
}

function spanWorkedMinutes(date, span) {
    const inn = String(span?.timeIn || '').trim();
    const out = String(span?.timeOut || '').trim();
    if (!inn || !out || inn === 'OT' || out === 'OT') return null;
    const start = clockToMinutes(inn);
    const end = clockToMinutes(out);
    if (start == null || end == null) return null;
    const outDate = String(span?.timeOutDate || '').trim();
    if (outDate && date && outDate > date) {
        const from = new Date(`${date}T12:00:00.000Z`);
        const to = new Date(`${outDate}T12:00:00.000Z`);
        const days = Math.round((to.getTime() - from.getTime()) / 86400000);
        if (days > 0) return end - start + days * 24 * 60;
    }
    let diff = end - start;
    if (diff <= 0) diff += 24 * 60;
    return diff;
}

function recordWorkedMinutes(record) {
    const inn = String(record?.timeIn || '').trim();
    const out = String(record?.timeOut || '').trim();
    if (inn === 'OT' || out === 'OT') {
        const hours = Number(record?.flexibleWorkedHours) || 0;
        return hours > 0 ? Math.round(hours * 60) : null;
    }
    const date = String(record?.date || '').trim();
    const spans = [
        ...(Array.isArray(record?.punchSessions) ? record.punchSessions : []),
        { timeIn: record?.timeIn, timeOut: record?.timeOut, timeOutDate: record?.timeOutDate },
    ];
    let total = 0;
    let any = false;
    spans.forEach((span) => {
        const minutes = spanWorkedMinutes(date, span);
        if (minutes == null) return;
        any = true;
        total += minutes;
    });
    if (any) return total;
    const hours = Number(record?.flexibleWorkedHours) || 0;
    return hours > 0 ? Math.round(hours * 60) : null;
}

/** The leave-day placeholder. The overtime work day stays, and its date is moved to the leave. */
function overtimePlaceholderDay(row) {
    if (String(row?.statusKey || '') === 'compoff_leave') return true;
    const inn = String(row?.timeIn || '').trim();
    const out = String(row?.timeOut || '').trim();
    if (inn === 'OT' || out === 'OT') return true;
    return Boolean(String(row?.flexibleFromOtDate || '').trim());
}

function punchRowRank(row) {
    const inn = String(row?.timeIn || '').trim();
    return inn && inn !== 'OT' ? 1 : 0;
}

function buildApprovedOtRows(records, monthKey, notesByDate = {}, countTo = '') {
    const prefix = String(monthKey || '');
    const taken = leaveDatesTakenByOvertime(records, monthKey);
    const byDate = new Map();
    (records || []).forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (prefix && !date.startsWith(prefix))) return;
        if (String(row?.flexibleOtStatus || '').trim() !== 'approved') return;
        if (!((Number(row?.flexibleOtApprovedHours) || 0) > 0)) return;
        if (overtimePlaceholderDay(row)) return;
        const uses = taken.get(date) || [];
        if (approvalPlacedAsNextDay(row, uses)) return;
        const inside = !countTo || date <= countTo;
        const noted = Number(notesByDate?.[date]?.otHours) || 0;
        const stored = Number(row.flexibleOtApprovedHours) || 0;
        const approvedHours = inside && noted > 0 ? noted : stored;
        if (!(approvedHours > 0)) return;
        if (inside && !(noted > 0) && !taken.has(date) && !String(notesByDate?.[date]?.givenTo || '').trim()) return;
        const current = byDate.get(date);
        if (!current || punchRowRank(row) >= punchRowRank(current.row)) {
            byDate.set(date, { row, approvedHours });
        }
    });
    return [...byDate.values()]
        .flatMap(({ row, approvedHours }) => {
            const minutes = recordWorkedMinutes(row);
            const base = {
                id: String(row._id || row.date),
                date: row.date,
                dateLabel: formatDayLabel(row.date),
                workDate: row.date,
                timeIn: formatClock12(row.timeIn),
                timeOut: formatClock12(row.timeOut),
                timeOutNextDay: isNextDayCheckout({
                    date: row.date,
                    timeIn: row.timeIn,
                    timeOut: row.timeOut,
                    timeOutDate: row.timeOutDate,
                }),
                workedLabel: minutes == null ? '—' : formatHourMinute(minutes),
                approvedHours,
                approvedLabel: formatHourMeasure(approvedHours),
                description: String(row.flexibleOtReason || '').trim(),
                placedOn: '',
            };
            return rowsForLeaveTaken(base, taken.get(row.date) || [], notesByDate?.[row.date]);
        })
        .sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

function rowOnLeaveDate(row, leaveDate, hours = row.approvedHours) {
    const approvedHours = Math.round((Number(hours) || 0) * 100) / 100;
    return {
        ...row,
        id: `${row.id}-${leaveDate}`,
        date: leaveDate,
        dateLabel: formatDayLabel(leaveDate),
        workDate: row.workDate || row.date,
        approvedHours,
        approvedLabel: formatHourMeasure(approvedHours),
    };
}

/** The date shown is the leave day taken, not the overtime request or approval day. */
function rowsForLeaveTaken(row, uses, note) {
    const whole = (uses || []).find((use) => !(Number(use?.hours) > 0));
    const given = String(note?.givenTo || '').trim();
    if (whole?.date) return [rowOnLeaveDate(row, whole.date)];
    const parts = (uses || []).filter((use) => Number(use?.hours) > 0 && use?.date);
    if (!parts.length) {
        return [given && given !== row.date ? rowOnLeaveDate(row, given) : row];
    }
    const placed = [];
    let left = Math.round((Number(row.approvedHours) || 0) * 100) / 100;
    parts.forEach((use) => {
        const hours = Math.round(Math.min(left, Number(use.hours) || 0) * 100) / 100;
        if (!(hours > 0)) return;
        left = Math.round((left - hours) * 100) / 100;
        placed.push(rowOnLeaveDate(row, use.date, hours));
    });
    if (left > 0) {
        placed.push({
            ...row,
            approvedHours: left,
            approvedLabel: formatHourMeasure(left),
        });
    }
    return placed.length ? placed : [row];
}

function hasRealClock(row) {
    const inn = String(row?.timeIn || '').trim();
    const out = String(row?.timeOut || '').trim();
    return Boolean((inn && inn !== 'OT') || (out && out !== 'OT'));
}

function dayCountLabel(count) {
    const total = Math.max(0, Math.round(Number(count) || 0));
    return `${total} ${total === 1 ? 'day' : 'days'}`;
}

function buildCompOffReferenceRows(records, monthKey) {
    const byDate = new Map();
    (records || []).forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const current = byDate.get(date);
        if (!current || punchRowRank(row) >= punchRowRank(current)) byDate.set(date, row);
    });
    return compOffReferenceLinks(records, monthKey).map((link) => {
        const day = byDate.get(link.date) || {};
        const source = (link.sourceDates || [])
            .map((date) => byDate.get(date))
            .find((row) => row && hasRealClock(row)) || null;
        const punch = hasRealClock(day) ? day : (source || day);
        const minutes = recordWorkedMinutes(punch);
        const approvedDates = (link.sourceDates || []).map((date) => formatDayLabel(date)).filter((label) => label && label !== '—');
        return {
            id: String(day._id || link.date),
            date: link.date,
            dateLabel: formatDayLabel(link.date),
            timeIn: formatClock12(punch?.timeIn),
            timeOut: formatClock12(punch?.timeOut),
            timeOutNextDay: isNextDayCheckout({
                date: punch?.date || link.date,
                timeIn: punch?.timeIn,
                timeOut: punch?.timeOut,
                timeOutDate: punch?.timeOutDate,
            }),
            workedLabel: minutes == null ? '—' : formatHourMinute(minutes),
            otApprovedLabel: approvedDates.length ? approvedDates.join(', ') : '—',
            description: link.description,
        };
    });
}

function dubaiNowMinutes() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
}

const placeNameCache = new Map();

function meaningfulPlaceLabel(value) {
    const label = String(value || '').trim();
    if (!label || /^pinned location$/i.test(label)) return '';
    return label;
}

function punchSpot(spot) {
    const label = meaningfulPlaceLabel(spot?.label);
    const latitude = Number(spot?.latitude);
    const longitude = Number(spot?.longitude);
    const hasMap = Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
    return {
        label,
        latitude: hasMap ? latitude : null,
        longitude: hasMap ? longitude : null,
        hasMap,
        mapHref: hasMap ? `https://www.google.com/maps?q=${latitude},${longitude}` : '',
    };
}

function locationOf(record) {
    return punchSpot(
        record?.checkInLocation?.latitude != null
            ? record.checkInLocation
            : record?.checkOutLocation?.latitude != null
              ? record.checkOutLocation
              : record?.checkInLocation || record?.checkOutLocation,
    );
}

function dayLateText(record, week) {
    if (!record) return '—';
    const shift = shiftForDate(week, record.date);
    const actual = clockToMinutes(record.timeIn);
    if (shift && actual != null) return formatHourlyGap(Math.max(0, actual - shift.start));
    const fromReason = minutesInReason(record.reason, /(\d+)\s*minutes?\s+late/i);
    if (fromReason != null) return formatHourlyGap(fromReason);
    if (record.timeIn) return formatHourlyGap(0);
    return '—';
}

function placeFromGeocode(data) {
    const parts = [data?.locality, data?.city, data?.principalSubdivision]
        .map((part) => String(part || '').trim())
        .filter(Boolean);
    return [...new Set(parts)].slice(0, 2).join(', ');
}

function deductFraction(deduct) {
    const key = String(deduct || '').trim().toLowerCase();
    if (key === 'full') return 1;
    if (key === 'half') return 0.5;
    if (key === 'quarter') return 0.25;
    return 0;
}

function deductDayLabel(deduct) {
    const fraction = deductFraction(deduct);
    if (fraction === 1) return '1 day';
    if (fraction === 0.5) return 'half day';
    if (fraction === 0.25) return 'quarter day';
    return '';
}

function eventBundle(events) {
    const per = Number(events);
    return Number.isFinite(per) && per > 0 ? per : 0;
}

function chargeableBundles(count, events) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const per = eventBundle(events);
    if (!per) return total;
    if (total <= per) return 0;
    return Math.floor((total - 1) / per);
}

function policyDeductionAmount(daily, count, rule) {
    const fraction = deductFraction(rule?.deduct);
    if (!fraction) return 0;
    return money2((Number(daily) || 0) * fraction * chargeableBundles(count, rule?.events));
}

function money2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function splitMoney(total, weights) {
    const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
    const sum = entries.reduce((totalWeight, [, weight]) => totalWeight + weight, 0);
    const shares = Object.fromEntries(Object.keys(weights).map((key) => [key, 0]));
    if (sum <= 0 || total <= 0) return shares;
    entries.forEach(([key, weight]) => {
        shares[key] = money2(total * (weight / sum));
    });
    const drift = money2(total - Object.values(shares).reduce((sumShares, amount) => sumShares + amount, 0));
    if (drift) {
        const [key] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
        shares[key] = money2(shares[key] + drift);
    }
    return shares;
}

function isMispunchTitle(title) {
    return /miss(?:ed)?[\s-]*punch|mis[\s-]*punch/i.test(String(title || ''));
}

function mispunchRuleOf(rules) {
    return (Array.isArray(rules) ? rules : []).find((row) => isMispunchTitle(row?.title) && deductFraction(row?.deduct)) || null;
}

function ruleDirection(rule) {
    const title = String(rule?.title || '').toLowerCase();
    if (/late\s*out|early\s*out|early/.test(title)) return 'out';
    if (/late\s*in/.test(title)) return 'in';
    return '';
}

function dayPartToMinutes(day, which) {
    if (!day) return null;
    const isStart = which === 'start';
    let hour = Number(isStart ? day.startHour : day.endHour);
    const minute = Number(isStart ? day.startMinute : day.endMinute);
    const meridiem = String((isStart ? day.startMeridiem : day.endMeridiem) || 'AM').toUpperCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    return hour * 60 + minute;
}

function shiftForDate(week, dateKey) {
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
    const day = week[WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]];
    if (!day || day.isOffDay) return null;
    const start = dayPartToMinutes(day, 'start');
    const end = dayPartToMinutes(day, 'end');
    if (start == null || end == null || end <= start) return null;
    return { start, end };
}

const TIMED_RULE_SKIP = new Set([
    'holiday',
    'weekly_off',
    'on_leave',
    'sick_leave',
    'authorized_leave',
    'unauthorized_leave',
    'compoff_leave',
]);

function timedPolicyCounts(records, rules, week) {
    const timed = (Array.isArray(rules) ? rules : [])
        .map((rule, index) => ({ rule, index, direction: ruleDirection(rule) }))
        .filter((row) => row.direction && deductFraction(row.rule?.deduct) && !isMispunchTitle(row.rule?.title));
    if (String(week?.timingMode || '').toLowerCase() === 'flexible') {
        return {
            rows: timed.map((row) => ({ ...row, count: 0 })),
            consumed: { in: 0, out: 0 },
        };
    }
    const counts = timed.map(() => 0);
    const consumed = { in: 0, out: 0 };
    const order = { in: [], out: [] };
    timed.forEach((row, index) => order[row.direction].push(index));
    order.in.sort((a, b) => n(timed[b].rule.minutes) - n(timed[a].rule.minutes));
    order.out.sort((a, b) => n(timed[b].rule.minutes) - n(timed[a].rule.minutes));
    (Array.isArray(records) ? records : []).forEach((record) => {
        const key = String(record?.statusKey || '');
        if (TIMED_RULE_SKIP.has(key)) return;
        const shift = shiftForDate(week, record?.date);
        if (!shift) return;
        const actualIn = clockToMinutes(record?.timeIn);
        const actualOut = clockToMinutes(record?.timeOut);
        const lateIn = actualIn == null ? 0 : actualIn - shift.start;
        const lateOut = actualOut == null ? 0 : shift.end - actualOut;
        ['in', 'out'].forEach((side) => {
            const minutes = side === 'in' ? lateIn : lateOut;
            if (minutes <= 0) return;
            const match = order[side].find((index) => minutes >= Math.max(0, n(timed[index].rule.minutes)));
            if (match == null) return;
            counts[match] += 1;
            if (side === 'in' && key === 'late_arrived') consumed.in += 1;
            if (side === 'out' && key === 'early_go') consumed.out += 1;
        });
    });
    return {
        rows: timed.map((row, index) => ({ ...row, count: counts[index] })),
        consumed,
    };
}

function lateDirectionNote(extraRows, sharedCount, combinedShared, lateRule, daily, direction) {
    const parts = [];
    for (const row of extraRows) {
        const minutes = Math.max(0, Math.floor(n(row.rule?.minutes)));
        const band = minutes > 0 ? `${minutes} min` : 'the stricter rule';
        parts.push(`${row.count} at ${band}: ${extraPolicyNote(row.count, row.rule, daily)}`);
    }
    if (sharedCount > 0) {
        parts.push(
            `${sharedCount} shorter ${direction} · ${eventPolicyNote(combinedShared, lateRule, daily)}`,
        );
    } else if (!parts.length) {
        parts.push(eventPolicyNote(0, lateRule, daily));
    }
    return parts.join(' · ');
}

function extraPolicyNote(count, rule, daily) {
    const minutes = Math.max(0, Math.floor(n(rule?.minutes)));
    const minuteText = minutes > 0 ? `${minutes} minutes above schedule` : 'Above schedule';
    return `${minuteText} · ${eventPolicyNote(count, rule, daily)}`;
}

function eventPolicyNote(count, rule, daily) {
    const dayLabel = deductDayLabel(rule?.deduct);
    if (!dayLabel) return 'This group policy has no deduct amount for this status';
    const per = eventBundle(rule?.events);
    const unitAmount = money2((Number(daily) || 0) * deductFraction(rule?.deduct));
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const bundles = chargeableBundles(total, rule?.events);
    const startsAt = per > 0 ? per + 1 : 1;
    const ruleText = per > 0
        ? `events 1–${per} do not deduct. Event ${startsAt} deducts ${dayLabel} (${formatAed(unitAmount, 2)})`
        : `each event deducts ${dayLabel} (${formatAed(unitAmount, 2)})`;
    if (!total) return `Policy: ${ruleText}`;
    if (!bundles) return `${total} so far · ${ruleText}`;
    const amount = policyDeductionAmount(daily, total, rule);
    return `${total} events · ${bundles} deduct${bundles === 1 ? '' : 's'} from event ${startsAt} · ${dayLabel} = ${formatAed(amount, 2)}`;
}

function monthChoices(joinKey, todayKey) {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(joinKey || ''))
        ? String(joinKey).slice(0, 7)
        : `${Number(todayKey.slice(0, 4)) - 5}-01`;
    const end = todayKey.slice(0, 7);
    const choices = [];
    let cursor = start > end ? end : start;
    while (cursor <= end && choices.length < 360) {
        choices.push(cursor);
        const [year, month] = cursor.split('-').map(Number);
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        cursor = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    }
    return choices.reverse();
}

function monthKeysBetween(fromKey, toKey) {
    const start = String(fromKey || '').slice(0, 7);
    const end = String(toKey || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) return [];
    const months = [];
    let cursor = start;
    while (cursor <= end && months.length < 84) {
        months.push(cursor);
        const [year, month] = cursor.split('-').map(Number);
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        cursor = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    }
    return months;
}

function isNextDayCompOffRow(row) {
    if (String(row?.flexibleFromOtDate || '').trim()) return true;
    return String(row?.timeIn || '').trim() === 'OT' && String(row?.timeOut || '').trim() === 'OT';
}

function dayAdjustment(row) {
    const nextDay = String(row?.flexibleOtNextDayDate || '').trim();
    const fromDay = String(row?.flexibleFromOtDate || '').trim();
    if (fromDay) return { withDate: fromDay, direction: 'from', compOff: false };
    if (nextDay) return { withDate: nextDay, direction: 'to', compOff: false };
    if (String(row?.statusKey || '') === 'compoff_leave' && String(row?.compOff?.state || '') === 'adjusted') {
        return { withDate: '', direction: 'from', compOff: true };
    }
    return null;
}

function rememberAdjustment(map, date, withDate, compOff, direction) {
    const key = String(date || '').trim();
    if (!key || map.has(key)) return;
    map.set(key, {
        date: key,
        withDate: String(withDate || '').trim(),
        compOff: Boolean(compOff),
        direction: direction === 'to' ? 'to' : 'from',
    });
}

function adjustmentNote(item) {
    if (!item) return '';
    if (item.compOff || !item.withDate) return '(adjusted from overtime)';
    const other = formatDayLabel(item.withDate);
    if (!other || other === '—') return '(adjusted from overtime)';
    return item.direction === 'to' ? `(adjusted to ${other})` : `(adjusted from ${other})`;
}

function buildAdjustmentIndex(records) {
    const map = new Map();
    (records || []).forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!date) return;
        const link = dayAdjustment(row);
        if (!link) return;
        rememberAdjustment(map, date, link.withDate, link.compOff, link.direction);
        if (link.withDate) {
            const opposite = link.direction === 'to' ? 'from' : 'to';
            rememberAdjustment(map, link.withDate, date, false, opposite);
        }
    });
    return map;
}

function adjInk(kind) {
    if (kind === 'attention' || kind === 'sick' || kind === 'holiday' || kind === 'weekend' || kind === 'empty' || kind === 'future') {
        return 'text-[#5B21B6]';
    }
    return 'text-white';
}

function hourCountLabel(hours) {
    return formatHourMeasure(hours);
}

function measureLabel(value, singular, plural) {
    const total = Math.round((Number(value) || 0) * 100) / 100;
    const amount = Object.is(total, -0) ? 0 : total;
    const shown = Math.abs(amount);
    return `${amount < 0 ? '-' : ''}${shown} ${shown === 1 ? singular : plural}`;
}

function countEndForMonth(monthKey, todayKey) {
    const end = monthEndKey(monthKey);
    if (!end) return '';
    if (monthKey < todayKey.slice(0, 7)) return end;
    if (monthKey > todayKey.slice(0, 7)) return '';
    const yesterday = shiftDateKey(todayKey, -1);
    if (!yesterday || yesterday < `${monthKey}-01`) return '';
    return yesterday < end ? yesterday : end;
}

function bucketOf(stats, key) {
    return stats?.[key] || {};
}

function profilePeriodStats(profile) {
    const counts = profile?.summary?.counts || {};
    const card = profile?.summary?.yearCard || {};
    const stats = profile?.summary?.requestStats || {};
    const usedOf = (key) => (card?.used?.[key] != null ? n(card.used[key]) : n(counts[key]));
    const requestedOf = (key) => n(bucketOf(stats, key).request) + n(bucketOf(stats, key).approved);
    const approvedOf = (key) => n(bucketOf(stats, key).approved);
    const leave = (key) => ({
        requested: requestedOf(key),
        approved: approvedOf(key),
        used: usedOf(key),
    });
    return {
        annual: leave('on_leave'),
        sick: leave('sick_leave'),
        authorized: leave('authorized_leave'),
        unauthorized: leave('unauthorized_leave'),
        compoffUsed: usedOf('compoff_leave'),
        compoffPending: n(card?.pending?.compoff_leave) || n(bucketOf(stats, 'compoff_leave').request),
        lateIn: n(counts.late_arrived) || (n(counts.early_go) ? 0 : n(card?.used?.late_early)),
        earlyOut: n(counts.early_go),
        missed: n(counts.mispunch) || n(card?.used?.mispunch),
        present: n(card?.office) || n(profile?.summary?.enrollAttendance?.office) || n(profile?.summary?.presentDays),
        wfh: n(card?.wfh) || n(profile?.summary?.enrollAttendance?.wfh),
        absent: null,
    };
}

function addPeriodStats(total, next) {
    const sumLeave = (key) => ({
        requested: n(total[key]?.requested) + n(next[key]?.requested),
        approved: n(total[key]?.approved) + n(next[key]?.approved),
        used: n(total[key]?.used) + n(next[key]?.used),
    });
    return {
        annual: sumLeave('annual'),
        sick: sumLeave('sick'),
        authorized: sumLeave('authorized'),
        unauthorized: sumLeave('unauthorized'),
        compoffUsed: n(total.compoffUsed) + n(next.compoffUsed),
        compoffPending: n(total.compoffPending) + n(next.compoffPending),
        lateIn: n(total.lateIn) + n(next.lateIn),
        earlyOut: n(total.earlyOut) + n(next.earlyOut),
        missed: n(total.missed) + n(next.missed),
        present: n(total.present) + n(next.present),
        wfh: n(total.wfh) + n(next.wfh),
        absent: null,
    };
}

function leaveDayWeight(row, authorized) {
    const part = String(row?.leaveRequestDayPart || '');
    const fraction = part === 'half' ? 0.5 : part === 'quarter' ? 0.25 : 1;
    const doubled = authorized && Number(row?.leaveDeductionTimes) === 2 ? 2 : 1;
    return fraction * doubled;
}

function leaveChargeDays(records, key) {
    return (records || []).reduce((sum, row) => {
        if (String(row?.statusKey || '') !== key) return sum;
        return sum + leaveDayWeight(row, key === 'authorized_leave');
    }, 0);
}

function deductionKind(row) {
    if (String(row?.hourAdjustStatus || '') === 'approved' && row?.hourAdjustKind) {
        return String(row.hourAdjustKind);
    }
    return punchAttendanceKind(row) || String(row?.statusKey || '');
}

function shownEventKind(record) {
    const kind = deductionKind(record);
    if (kind === 'late_arrived' || kind === 'early_go' || kind === 'mispunch') return kind;
    return '';
}

function dayHoursOf(week, dateKey) {
    const shift = shiftForDate(week, dateKey);
    if (shift) return (shift.end - shift.start) / 60;
    return 8;
}

function flowchartMinutes(week, dateKey, record) {
    const stored = Number(record?.flexibleRequiredHours);
    if (stored > 0) return Math.round(stored * 60);
    if (isFlexibleWeek(week)) {
        const flexible = flexibleDayHours(week, dateKey);
        return flexible > 0 ? Math.round(flexible * 60) : 0;
    }
    const shift = shiftForDate(week, dateKey);
    if (shift) return Math.max(0, shift.end - shift.start);
    return 0;
}

function isFlexibleWeek(week) {
    return String(week?.timingMode || '').toLowerCase() === 'flexible';
}

/** Hours still short of that day's working time. Extra time is not a shortfall. */
function flexibleShortMinutes(record, week) {
    if (!isFlexibleWeek(week) || !record?.date) return null;
    const required = flowchartMinutes(week, record.date, record);
    const worked = recordWorkedMinutes(record);
    if (!(required > 0) || worked == null) return null;
    return required - worked;
}

function flexibleDayHours(week, dateKey) {
    if (String(week?.timingMode || '').toLowerCase() !== 'flexible') return 0;
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return 0;
    const day = week[WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]];
    if (!day || day.isOffDay) return 0;
    const hours = Number(day.workingHours);
    if (Number.isFinite(hours) && hours > 0) return Math.min(24, hours);
    const weekHours = Number(week.hoursPerDay);
    if (Number.isFinite(weekHours) && weekHours > 0) return Math.min(24, weekHours);
    return 9;
}

function wholeHourCount(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours + 1e-9);
}

/** Finished hours short of the flexible day. 7 hours 45 minutes on a 10-hour day is 3. */
function flexibleLossHoursOf(record, week) {
    const required = wholeHourCount(flexibleDayHours(week, record?.date));
    let worked = Number(record?.flexibleWorkedHours) || 0;
    if (!(worked > 0)) {
        const minutes = recordWorkedMinutes(record);
        worked = minutes == null ? 0 : Math.max(0, minutes) / 60;
    }
    return Math.max(0, required - wholeHourCount(worked));
}

/** Exact hours short from the punches. 4:50 PM to 11:05 PM on a 10-hour day is 3 hours 45 minutes. */
function flexibleExactLossHoursOf(record, week) {
    const required = flexibleDayHours(week, record?.date);
    const minutes = recordWorkedMinutes(record);
    const worked = minutes != null
        ? Math.max(0, minutes) / 60
        : Math.max(0, Number(record?.flexibleWorkedHours) || 0);
    return Math.max(0, required - worked);
}

function exactHourLabel(hours) {
    const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
    const whole = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (!mins) return `${whole} hr`;
    if (!whole) return `${mins} min`;
    return `${whole} hr ${mins} min`;
}

/** Late-in and early-out hours on a scheduled day. Flexible time has no punch window. */
function scheduledGapHours(row, week) {
    const shift = shiftForDate(week, row?.date);
    if (!shift) return null;
    const inn = clockToMinutes(row?.timeIn);
    const out = clockToMinutes(row?.timeOut);
    return {
        late: inn == null ? 0 : Math.max(0, inn - shift.start) / 60,
        early: out == null ? 0 : Math.max(0, shift.end - out) / 60,
    };
}

function takenHoursOf(row, week, kind) {
    if (kind === 'early_go' || kind === 'late_arrived') {
        const gaps = scheduledGapHours(row, week);
        if (gaps) return gaps.late + gaps.early;
    }
    return dayHoursOf(week, row?.date);
}

function hourDeductionAmount(row, week, daily, kind, unauthTimes) {
    const approved = String(row?.hourAdjustStatus || '') === 'approved';
    const flexiblePunch = isFlexibleWeek(week) && (kind === 'early_go' || kind === 'late_arrived');
    const dayHours = flexiblePunch
        ? (flexibleDayHours(week, row?.date) || 8)
        : ((approved ? flexibleDayHours(week, row?.date) : 0) || dayHoursOf(week, row?.date) || 8);
    const missedHours = flexiblePunch
        ? (approved ? n(row.hoursApproved) : flexibleExactLossHoursOf(row, week))
        : (approved ? n(row.hoursApproved) : takenHoursOf(row, week, kind));
    const hours = approved ? missedHours : missedHours * unauthTimes;
    if (!(hours > 0) || !(daily > 0) || !(dayHours > 0)) return 0;
    return money2((hours / dayHours) * daily);
}

function deductionTimes(record, policy) {
    const key = deductionKind(record);
    const authTimes = policy?.authorizedDeductionDays == null ? 1 : n(policy.authorizedDeductionDays);
    const unauthTimes = policy?.unauthorizedDeductionDays == null ? 2 : n(policy.unauthorizedDeductionDays);
    const approvedHours = String(record?.hourAdjustStatus || '') === 'approved';
    if (key === 'early_go' || key === 'late_arrived' || key === 'mispunch') {
        return approvedHours ? 1 : unauthTimes;
    }
    if (key === 'unauthorized_leave') return approvedHours ? 1 : unauthTimes;
    if (key === 'authorized_leave') {
        return Number(record?.leaveDeductionTimes) === 2 ? 2 : authTimes;
    }
    return 1;
}

function attendanceDeductionAmount(record, week, daily, policy, mispunchAmounts) {
    if (record?.deductionWaived === true) return 0;
    const key = deductionKind(record);
    const authTimes = policy?.authorizedDeductionDays == null ? 1 : n(policy.authorizedDeductionDays);
    const unauthTimes = policy?.unauthorizedDeductionDays == null ? 2 : n(policy.unauthorizedDeductionDays);
    if (key === 'mispunch') {
        return money2(mispunchAmounts?.get(String(record?.date || '')) || 0);
    }
    if (key === 'early_go' || key === 'late_arrived') {
        return hourDeductionAmount(record, week, daily, key, unauthTimes);
    }
    if (key === 'authorized_leave' || key === 'unauthorized_leave') {
        if (String(record?.hourAdjustStatus || '') === 'approved') {
            return hourDeductionAmount(record, week, daily, key, 1);
        }
        const times = key === 'authorized_leave' ? authTimes : unauthTimes;
        return money2(leaveDayWeight(record, key === 'authorized_leave') * times * (Number(daily) || 0));
    }
    return 0;
}

const ATTENDANCE_DEDUCTION_LABEL = {
    authorized_leave: 'Authorized Leave',
    unauthorized_leave: 'Unauthorized Leave',
    late_arrived: 'Late In',
    early_go: 'Late Out',
    mispunch: 'Missed Punch',
};

const ATTENDANCE_TYPE_RANK = {
    authorized_leave: 0,
    unauthorized_leave: 1,
    late_arrived: 2,
    early_go: 3,
    mispunch: 4,
};

function incrementalPolicyAmount(count, rule, daily) {
    if (!rule || count <= 0) return 0;
    return money2(policyDeductionAmount(daily, count, rule) - policyDeductionAmount(daily, count - 1, rule));
}

function parseLabelDate(label) {
    const match = String(label || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (!match) return '';
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[2].toLowerCase()) + 1;
    if (!month) return '';
    return `${match[3]}-${String(month).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

function deductionEventDetail(record, week) {
    const key = deductionKind(record);
    if (key === 'late_arrived' || key === 'early_go') {
        const approved = String(record?.hourAdjustStatus || '') === 'approved';
        if (isFlexibleWeek(week)) {
            if (approved) return `${n(record.hoursApproved)} approved hr`;
            const loss = flexibleExactLossHoursOf(record, week);
            const required = flexibleDayHours(week, record?.date);
            return `${exactHourLabel(loss)} short of ${exactHourLabel(required)}`;
        }
    }
    if (key === 'late_arrived' || key === 'early_go') {
        const approved = String(record?.hourAdjustStatus || '') === 'approved';
        if (approved) return `${n(record.hoursApproved)} approved hr`;
        const gaps = scheduledGapHours(record, week);
        if (gaps && (gaps.late > 0 || gaps.early > 0)) {
            const parts = [];
            if (gaps.late > 0) parts.push(`Late ${exactHourLabel(gaps.late)}`);
            if (gaps.early > 0) parts.push(`Early ${exactHourLabel(gaps.early)}`);
            return parts.join(' · ');
        }
        if (key === 'late_arrived') {
            const minutes = dayLateText(record, week);
            const time = formatClock12(record?.timeIn);
            return [time !== '—' ? `In ${time}` : '', minutes !== '—' ? minutes : ''].filter(Boolean).join(' · ') || 'Late in';
        }
        const time = formatClock12(record?.timeOut);
        return time !== '—' ? `Out ${time}` : 'Early out';
    }
    if (key === 'mispunch') {
        const inn = String(record?.timeIn || '').trim();
        const out = String(record?.timeOut || '').trim();
        if (!inn && !out) return 'No punch';
        if (!inn) return 'Missing check-in';
        if (!out) return 'Missing check-out';
        return String(record?.reason || 'Missed punch').trim();
    }
    const weight = leaveDayWeight(record, key === 'authorized_leave');
    const reason = String(record?.reason || record?.leaveRequestReason || '').trim();
    const dayText = `${Number(weight).toFixed(1)} ${Number(weight) === 1 ? 'Day' : 'Days'}`;
    return reason ? `${dayText} · ${reason}` : dayText;
}

function deductionLossHours(record, week) {
    const key = deductionKind(record);
    const approved = String(record?.hourAdjustStatus || '') === 'approved';
    if (approved) return n(record.hoursApproved);
    if (isFlexibleWeek(week) && (key === 'early_go' || key === 'late_arrived')) {
        return flexibleExactLossHoursOf(record, week);
    }
    if (key === 'early_go' || key === 'late_arrived') return takenHoursOf(record, week, key);
    if (key === 'authorized_leave' || key === 'unauthorized_leave') {
        const weight = leaveDayWeight(record, key === 'authorized_leave');
        return weight * (dayHoursOf(week, record?.date) || 8);
    }
    if (n(record?.hoursTaken) > 0) return n(record.hoursTaken);
    return takenHoursOf(record, week, key);
}

function formatLossHours(hours) {
    if (hours == null || !Number.isFinite(Number(hours)) || Number(hours) < 0) return '—';
    return formatDuration(Math.round(Number(hours) * 60));
}

function attendanceDeductionRows(records, policy, week, daily) {
    const labeled = (records || []).filter((row) => ATTENDANCE_DEDUCTION_LABEL[deductionKind(row)]);
    const mispunchAmounts = mispunchDayAmounts(
        labeled.filter((row) => deductionKind(row) === 'mispunch'),
        policy,
        daily,
    );
    const byMonth = new Map();
    labeled.forEach((row) => {
        const month = String(row?.date || '').slice(0, 7) || 'unknown';
        if (!byMonth.has(month)) byMonth.set(month, []);
        byMonth.get(month).push(row);
    });
    const rows = [];
    for (const monthRows of byMonth.values()) {
        const ordered = [...monthRows].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        ordered.forEach((record) => {
            const key = deductionKind(record);
            const amount = attendanceDeductionAmount(record, week, daily, policy, mispunchAmounts);
            rows.push({
                id: String(record?._id || `${record?.date}-${key}`),
                section: 'attendance',
                rank: ATTENDANCE_TYPE_RANK[key] ?? 9,
                sort: String(record?.date || ''),
                date: formatDayLabel(record?.date),
                type: ATTENDANCE_DEDUCTION_LABEL[key],
                detail: deductionEventDetail(record, week),
                in: formatClock12(record?.timeIn),
                out: (
                    <NextDayCheckoutTime
                        time={formatClock12(record?.timeOut)}
                        nextDay={isNextDayCheckout({
                            date: record?.date,
                            timeIn: record?.timeIn,
                            timeOut: record?.timeOut,
                            timeOutDate: record?.timeOutDate,
                        })}
                    />
                ),
                lossHrs: formatLossHours(deductionLossHours(record, week)),
                amount: formatAedNumber(amount),
            });
        });
    }
    return rows;
}

function financialDeductionRows({ fines, loans, advances, utilityItems, from, to, period }) {
    const months = new Set(monthKeysBetween(from, to));
    const inSpan = (dateKey) => Boolean(dateKey && from && to && dateKey >= from && dateKey <= to);
    const rows = [];
    const pushMoney = (row) => {
        if (period !== 'month' && !inSpan(row.sort)) return;
        rows.push(row);
    };
    (fines || []).forEach((row) => {
        if (!(n(row.outstanding) > 0)) return;
        const sort = parseLabelDate(row.dateLabel);
        pushMoney({
            id: `fine-${row.id}`,
            section: 'loan',
            rank: 2,
            sort,
            date: row.dateLabel || '—',
            type: 'Fine',
            detail: [row.code, row.type, row.status].map((part) => String(part || '').trim()).filter(Boolean).join(' · ') || 'Fine',
            amount: formatAedNumber(row.outstanding),
        });
    });
    (utilityItems || []).forEach((row) => {
        if (!(n(row.amount) > 0)) return;
        const month = /^\d{4}-\d{2}$/.test(String(row.billMonth || '')) ? row.billMonth : '';
        if (period !== 'month' && month && !months.has(month)) return;
        if (period !== 'month' && !month) return;
        rows.push({
            id: `utility-${row.id}`,
            section: 'loan',
            rank: 3,
            sort: month ? `${month}-01` : '',
            date: row.billMonthLabel || row.billMonth || '—',
            type: 'Utility Excess',
            detail: [row.utilityType, row.status].map((part) => String(part || '').trim()).filter(Boolean).join(' · ') || 'Utility excess',
            amount: formatAedNumber(row.amount),
        });
    });
    (loans || []).forEach((row) => {
        if (!(n(row.outstanding) > 0)) return;
        const sort = parseLabelDate(row.dateLabel);
        pushMoney({
            id: `loan-${row.id}`,
            section: 'loan',
            rank: 0,
            sort,
            date: row.dateLabel || '—',
            type: 'Loan',
            detail: [row.code, row.reason, row.status].map((part) => String(part || '').trim()).filter(Boolean).join(' · ') || 'Loan',
            amount: formatAedNumber(row.outstanding),
        });
    });
    (advances || []).forEach((row) => {
        if (!(n(row.outstanding) > 0)) return;
        const sort = parseLabelDate(row.dateLabel);
        pushMoney({
            id: `advance-${row.id}`,
            section: 'loan',
            rank: 1,
            sort,
            date: row.dateLabel || '—',
            type: 'Advance',
            detail: [row.code, row.reason, row.status].map((part) => String(part || '').trim()).filter(Boolean).join(' · ') || 'Advance',
            amount: formatAedNumber(row.outstanding),
        });
    });
    return rows;
}

function leaveTallies(records, key) {
    const groups = new Map();
    let used = 0;
    for (const row of records) {
        const status = String(row?.statusKey || '');
        const requested = String(row?.requestedStatusKey || '');
        const decision = String(row?.leaveRequestStatus || '');
        if (status === key) used += 1;
        const isRequest = decision && (requested === key || status === key);
        const isDirect = !decision && status === key;
        if (!isRequest && !isDirect) continue;
        const id = String(row?.leaveRequestGroupId || `${row?.date || ''}-${key}`);
        const prev = groups.get(id) || { status: isDirect ? 'direct' : decision };
        if (decision === 'pending') prev.status = 'pending';
        else if (prev.status !== 'pending') prev.status = isDirect ? 'direct' : decision || prev.status;
        groups.set(id, prev);
    }
    let requested = 0;
    let approved = 0;
    for (const group of groups.values()) {
        if (group.status === 'rejected') continue;
        requested += 1;
        if (group.status === 'approved' || group.status === 'direct') approved += 1;
    }
    return { requested, approved, used };
}

function recordsInWindow(records, from, to) {
    if (!from || !to) return [];
    return (records || []).filter((row) => {
        const date = String(row?.date || '');
        return date >= from && date <= to;
    });
}

function requestApproved(record) {
    return [record?.leaveRequestStatus, record?.approvalStatus].some(
        (value) => String(value || '').trim().toLowerCase() === 'approved',
    );
}

function dayKind(record, { isFuture, isToday, isHoliday, isWeeklyOff }) {
    const key = String(record?.statusKey || '');
    if (key === 'suspended' || record?.attendanceSuspended) return 'suspended';
    // A future day stays blank until leave is approved. Unauthorized leave is only a past day.
    const unapprovedFuture = Boolean(isFuture) && !requestApproved(record);
    if (shownEventKind(record) && !unapprovedFuture) return 'attention';
    if (key === 'on_office' || key === 'work_from_home') return 'present';
    if (key === 'sick_leave') return 'sick';
    if (key === 'authorized_leave') return 'authorized';
    if (key === 'on_leave') return 'annual';
    if (key === 'compoff_leave') return 'compoff';
    if (key === 'holiday' || isHoliday) return 'holiday';
    if (key === 'weekly_off' || isWeeklyOff) return 'weekend';
    if (isFuture) return 'future';
    if (key === 'unauthorized_leave' || key === 'not_marked') return 'absent';
    if (isToday) return 'future';
    if (!record) return 'absent';
    return 'empty';
}

function kindLabel(kind) {
    return LEGEND.find((item) => item.key === kind)?.label || 'No mark';
}

function attentionLabel(record) {
    const kind = shownEventKind(record);
    if (kind === 'mispunch') return 'Missed Punch';
    if (kind === 'early_go') return 'Early Go';
    if (kind === 'late_arrived') return 'Late Arrival';
    return '';
}

function dayEarlyText(record, week) {
    if (!record) return '';
    const shift = shiftForDate(week, record.date);
    const actual = clockToMinutes(record.timeOut);
    if (shift && actual != null) return formatHourlyGap(Math.max(0, shift.end - actual));
    if (shownEventKind(record) !== 'early_go') return '';
    const fromReason = minutesInReason(record.reason, /(\d+)\s*minutes?\s+early/i);
    if (fromReason != null) return formatHourlyGap(fromReason);
    return '—';
}

function dayApprovalLabel(record) {
    if (!record) return '';
    const key = String(record.statusKey || '');
    if (key === 'on_office' || key === 'work_from_home' || key === 'authorized_leave' || key === 'unauthorized_leave') return '';
    const marks = [
        record.hourAdjustStatus,
        record.leaveRequestStatus,
        record.flexibleOtStatus,
        record.approvalStatus,
    ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
    if (marks.includes('approved')) return 'Approved';
    if (marks.some((value) => value === 'pending' || value === 'rejected')) return 'Not approved';
    if (key === 'unauthorized_leave' || key === 'not_marked' || key === 'late_arrived' || key === 'early_go' || key === 'mispunch') {
        return 'Not approved';
    }
    if (key === 'authorized_leave' || key === 'on_leave' || key === 'sick_leave' || key === 'compoff_leave') {
        return 'Approved';
    }
    return '';
}

function dayDescription(record) {
    if (!record) return '';
    const parts = [
        record.reason,
        record.leaveRequestReason,
        record.hourAdjustReason,
        record.flexibleOtReason,
    ].map((part) => String(part || '').trim()).filter(Boolean);
    const unique = [];
    const seen = new Set();
    parts.forEach((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(part);
    });
    if (String(record.hourAdjustStatus || '') === 'approved') unique.push(`${n(record.hoursApproved)} approved hr`);
    return unique.join(' · ');
}

function eventRowsFromRecords(records, key) {
    return (records || [])
        .filter((row) => String(row?.statusKey || '') === key)
        .map((row) => {
            const link = dayAdjustment(row);
            return {
            id: String(row._id || `${row.date}-${key}`),
            date: row.date,
            statusKey: row.statusKey,
            statusLabel: row.statusLabel || kindLabel(dayKind(row, {})),
            reason: String(row.reason || row.leaveRequestReason || '').trim(),
            adjusted: Boolean(link),
            adjustWith: link?.withDate ? formatDayLabel(link.withDate) : '',
            adjustLabel: adjustmentNote(link ? { date: row.date, ...link } : null),
            attachmentName: String(row.attachmentName || '').trim(),
            leavePayType: String(row.leavePayType || '').trim(),
            };
        });
}

function TipMoney({ label, value, tone, wrap = false }) {
    return (
        <p className="min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">{label}</span>
            <span className={`mt-0.5 block text-[12px] font-semibold ${wrap ? 'whitespace-normal leading-snug' : 'truncate'} ${tone || 'text-[#1B2A4A]'}`}>{value}</span>
        </p>
    );
}

function TipMap({ spot }) {
    if (!spot?.hasMap && !spot?.label) return <span className="text-[12px] font-semibold text-[#1B2A4A]">—</span>;
    if (!spot.hasMap) return <span className="block truncate text-[12px] font-semibold text-[#1B2A4A]">{spot.label}</span>;
    return (
        <a href={spot.mapHref} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-[12px] font-semibold text-[#2563EB]">
            <span className="truncate">{spot.label || 'Map'}</span>
            <ExternalLink size={11} className="shrink-0" />
        </a>
    );
}

function DayTip({
    dateLabel,
    statusText,
    statusClass,
    approvalText = '',
    dotClass,
    timeIn,
    timeOut,
    timeOutNextDay = false,
    inSpot,
    outSpot,
    workedText,
    paymentText,
    balanceText,
    deductText,
    lateText = '',
    earlyText = '',
    sickReason = '',
    sickAttachment = null,
    moreLines,
    otText = '',
    compOffLines = [],
    requestLines = [],
    alignRight,
}) {
    const [more, setMore] = useState(false);
    const approvalClass = approvalText === 'Approved' ? 'text-[#16A34A]' : 'text-[#DC2626]';
    return (
        <div className={`absolute z-30 w-80 rounded-xl border border-[#E6EDF5] bg-white p-3 text-left shadow-xl ${alignRight ? 'right-0' : 'left-1/2'} top-full mt-1`}>
            {requestLines.length ? (
                <div className="mb-2 space-y-1 rounded-lg bg-[#FEF2F2] px-2 py-1.5">
                    {requestLines.map((line, index) => (
                        <p key={`${line.label}-${line.requestedBy}-${line.pendingWith}-${index}`} className="text-[12px] leading-snug text-[#991B1B]">
                            <span className="font-semibold">{line.label}</span>
                            <span className="font-medium"> — requested by {line.requestedBy}</span>
                            {line.pendingWith ? (
                                <span className="mt-0.5 block font-medium">Pending with {line.pendingWith}</span>
                            ) : null}
                        </p>
                    ))}
                </div>
            ) : null}
            <p className="text-[13px] font-bold text-[#1B2A4A]">{dateLabel}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-semibold">
                <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                <span className="font-medium text-[#64748B]">Status</span>
                <span className={statusClass}>{statusText}</span>
                {approvalText ? <span className={approvalClass}>· {approvalText}</span> : null}
            </p>
            {sickReason ? (
                <p className="mt-1 text-[12px] leading-snug text-[#1B2A4A]">
                    <span className="font-medium text-[#94A3B8]">Reason </span>
                    {sickReason}
                </p>
            ) : null}
            {sickAttachment?.name ? (
                sickAttachment.url ? (
                    <a
                        href={sickAttachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center text-[12px] font-semibold text-[#2563EB] hover:underline"
                    >
                        <span className="truncate">Attachment: {sickAttachment.name}</span>
                    </a>
                ) : (
                    <p className="mt-1 truncate text-[12px] font-medium text-[#64748B]">Attachment: {sickAttachment.name}</p>
                )
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <TipMoney label="Time In" value={timeIn} />
                <TipMoney
                    label="Time Out"
                    wrap={timeOutNextDay}
                    value={<NextDayCheckoutTime time={timeOut} nextDay={timeOutNextDay} />}
                />
                <p className="min-w-0">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">Location In</span>
                    <span className="mt-0.5 block"><TipMap spot={inSpot} /></span>
                </p>
                <p className="min-w-0">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">Location Out</span>
                    <span className="mt-0.5 block"><TipMap spot={outSpot} /></span>
                </p>
                <TipMoney label="Worked" value={workedText} />
                <TipMoney label="Payment" value={paymentText} tone="text-[#16A34A]" />
                {lateText ? <TipMoney label="Late Arrival" value={lateText} /> : null}
                {earlyText ? <TipMoney label="Early Go" value={earlyText} /> : null}
                <TipMoney label="Remaining" value={balanceText} />
                <TipMoney label="Deduct" value={deductText} tone="text-[#DC2626]" />
            </div>
            {moreLines.length ? (
                <button
                    type="button"
                    onClick={() => setMore((open) => !open)}
                    className="mt-2 text-[12px] font-semibold text-[#2563EB]"
                >
                    {more ? 'Show less' : 'Show more'}
                </button>
            ) : null}
            {otText || compOffLines.length ? (
                <div className="mt-2 space-y-1 border-t border-[#EEF2F6] pt-2">
                    {otText ? (
                        <p className="flex items-start justify-between gap-3 text-[12px]">
                            <span className="shrink-0 font-medium text-[#94A3B8]">Overtime</span>
                            <span className="text-right font-semibold text-[#1B2A4A]">{otText}</span>
                        </p>
                    ) : null}
                    {compOffLines.map((line) => (
                        <p key={line} className="text-[12px] font-semibold leading-snug text-[#0F766E]">{line}</p>
                    ))}
                </div>
            ) : null}
            {more ? (
                <div className="mt-2 space-y-1.5 border-t border-[#EEF2F6] pt-2">
                    {moreLines.map((line) => (
                        <p key={line.label} className="flex items-start justify-between gap-3 text-[12px]">
                            <span className="shrink-0 text-[#94A3B8]">{line.label}</span>
                            <span className="text-right font-medium text-[#1B2A4A]">{line.value}</span>
                        </p>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function AttendanceDayCell({ day, ctx, hoveredDate, setHoveredDate, compact = false, markTarget = null }) {
    const router = useRouter();
    const dateKey = format(day, 'yyyy-MM-dd');
    const inMonth = dateKey.slice(0, 7) === ctx.monthKey;
    const record = inMonth ? ctx.recordsByDate[dateKey] : null;
    const weekdayKey = WEEKDAY_KEYS[getDay(day)];
    const beforeStart = Boolean(ctx.visibleFrom) && dateKey < ctx.visibleFrom;
    const isHoliday = inMonth && !beforeStart && (ctx.holidayDates.has(dateKey) || record?.statusKey === 'holiday');
    const isWeeklyOff = inMonth && !beforeStart && !isHoliday && (record?.statusKey === 'weekly_off' || ctx.offWeekdays.has(weekdayKey));
    const isFuture = dateKey > ctx.todayKey;
    const kind = !inMonth
        ? 'outside'
        : beforeStart
          ? 'empty'
          : ctx.salaryLock?.locked
            ? 'future'
            : dayKind(record, { isFuture, isToday: dateKey === ctx.todayKey, isHoliday, isWeeklyOff });
    const worked = recordWorkedMinutes(record);
    const tone = TIP_TONE[kind] || TIP_TONE.empty;
    const column = (getDay(day) + 6) % 7;
    const yellowLabel = kind === 'attention' ? attentionLabel(record) : '';
    const flexibleDay = isFlexibleWeek(ctx.scheduleWeek);
    const earlyText = dayEarlyText(record, ctx.scheduleWeek);
    const description = dayDescription(record);
    const adjustment = inMonth && !beforeStart && !ctx.salaryLock?.locked ? ctx.adjustmentByDate.get(dateKey) : null;
    const adjustmentText = adjustmentNote(adjustment ? { date: dateKey, ...adjustment } : null);
    const approval = kind === 'future' ? '' : dayApprovalLabel(record);
    const scheduled = flowchartMinutes(ctx.scheduleWeek, dateKey, record);
    const balance = worked == null || !(scheduled > 0) ? null : scheduled - worked;
    const flexibleShort = flexibleDay ? flexibleShortMinutes(record, ctx.scheduleWeek) : null;
    const counted = Boolean(ctx.countTo) && dateKey >= ctx.countFrom && dateKey <= ctx.countTo;
    const extraPay = ctx.additionPayByDate.get(dateKey) || 0;
    const syntheticOt = String(record?.timeIn || '').trim() === 'OT'
        || String(record?.timeOut || '').trim() === 'OT'
        || Boolean(String(record?.flexibleFromOtDate || '').trim());
    const deductedLeave = kind === 'authorized' || kind === 'absent';
    const earnsDayRate = counted && !deductedLeave && !syntheticOt && !isHoliday && !isWeeklyOff && kind !== 'future' && kind !== 'suspended';
    const dayRate = Number(ctx.salaryDaily) || 0;
    const payment = !counted && !(extraPay > 0)
        ? null
        : money2((earnsDayRate ? dayRate : 0) + extraPay);
    const deductionWaived = record?.deductionWaived === true;
    const deduct = counted
        ? money2(attendanceDeductionAmount(record, ctx.scheduleWeek, ctx.salaryDaily, ctx.leavePolicy || {}, ctx.mispunchAmounts))
        : null;
    const doubleDeduction = deduct > 0 && deductionTimes(record, ctx.leavePolicy || {}) === 2;
    const lateText = dayLateText(record, ctx.scheduleWeek);
    const visibleLate = lateText && lateText !== '—' && lateText !== '0 Hours' ? lateText : '';
    const visibleEarly = earlyText && earlyText !== '—' && earlyText !== '0 Hours' ? earlyText : '';
    const typeLabel = visibleLate && visibleEarly
        ? 'Late Arrival · Early Go'
        : (yellowLabel || kindLabel(kind));
    const moreLines = [];
    if (ctx.holidayNamesByDate[dateKey]) moreLines.push({ label: 'Holiday', value: ctx.holidayNamesByDate[dateKey] });
    if (adjustmentText) moreLines.push({ label: 'Adjusted', value: adjustmentText });
    if (description) moreLines.push({ label: 'Description', value: description });
    const dayNote = ctx.calendarNotes[dateKey] || null;
    const otText = dayNote?.otHours > 0 ? formatHourMeasure(dayNote.otHours) : '';
    const compOffLines = [];
    if (dayNote?.givenTo) compOffLines.push(`Comp off given to ${formatDayLabel(dayNote.givenTo)}`);
    if (dayNote?.takenFrom) compOffLines.push(`Comp off taken from ${formatDayLabel(dayNote.takenFrom)}`);
    const showTip = hoveredDate === dateKey && inMonth && !beforeStart && !ctx.salaryLock?.locked;
    const canOpenMark = Boolean(markTarget?.employeeId) && inMonth && !beforeStart;
    const requestLines = inMonth && !beforeStart
        ? (ctx.pendingRequestsByDate?.get(dateKey) || [])
        : [];
    const requestPending = requestLines.length > 0;
    const openMarkPage = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!canOpenMark) return;
        router.push(markAttendanceHref({
            date: dateKey,
            staffType: markTarget.staffType,
            blinkEmployee: markTarget.employeeId,
        }));
    };
    return (
        <div
            className={`relative ${canOpenMark ? 'cursor-pointer' : ''}`}
            data-attendance-day={canOpenMark ? dateKey : undefined}
            title={requestPending ? undefined : (canOpenMark ? 'Double-click to mark this day' : undefined)}
            onMouseEnter={() => inMonth && !beforeStart && setHoveredDate(dateKey)}
            onMouseLeave={() => setHoveredDate('')}
            onClick={(event) => {
                if (canOpenMark) event.stopPropagation();
            }}
            onDoubleClick={openMarkPage}
        >
            <div className={`${compact
                ? 'flex h-8 w-full items-center justify-center rounded-[7px] text-[11px] font-semibold tabular-nums leading-none'
                : 'flex min-h-12 w-full flex-col items-center justify-center rounded-[9px] px-0.5 py-1 text-[13px] font-semibold tabular-nums leading-none'
            } ${DAY_STYLE[kind] || DAY_STYLE.empty}${requestPending ? ' attendance-request-blink' : ''}`}>
                <span>{format(day, 'd')}</span>
                {!compact && adjustmentText ? (
                    <span className={`mt-0.5 text-center text-[8px] font-bold leading-tight ${adjInk(kind)}`}>
                        {adjustmentText}
                    </span>
                ) : null}
            </div>
            {showTip ? (
                <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                    <DayTip
                        dateLabel={format(day, 'd MMMM yyyy')}
                        statusText={typeLabel}
                        statusClass={tone.text}
                        approvalText={approval}
                        dotClass={tone.dot}
                        timeIn={formatClock12(record?.timeIn)}
                        timeOut={formatClock12(record?.timeOut)}
                        timeOutNextDay={isNextDayCheckout({
                            date: dateKey,
                            timeIn: record?.timeIn,
                            timeOut: record?.timeOut,
                            timeOutDate: record?.timeOutDate,
                        })}
                        inSpot={punchSpot(record?.checkInLocation)}
                        outSpot={punchSpot(record?.checkOutLocation)}
                        workedText={worked == null ? '—' : formatHourlyGap(worked)}
                        lateText={visibleLate}
                        earlyText={visibleEarly}
                        otText={otText}
                        compOffLines={compOffLines}
                        paymentText={payment == null ? '—' : formatAed(payment, 2)}
                        balanceText={flexibleShort != null ? formatHourlyGap(Math.max(0, flexibleShort)) : formatHourlyGap(balance)}
                        deductText={deductionWaived ? 'Waived' : deduct == null ? '—' : `${formatAed(deduct, 2)}${doubleDeduction ? ' (double deduction)' : ''}`}
                        sickReason={kind === 'sick' ? String(record?.leaveRequestReason || record?.reason || '').trim() : ''}
                        sickAttachment={kind === 'sick' && String(record?.attachmentName || '').trim()
                            ? { name: String(record.attachmentName).trim(), url: String(record?.attachmentUrl || '').trim() }
                            : null}
                        moreLines={moreLines}
                        requestLines={requestLines}
                        alignRight={column >= 4}
                    />
                </div>
            ) : null}
        </div>
    );
}

function groupPendingRequests(requests) {
    const byDate = new Map();
    for (const row of Array.isArray(requests) ? requests : []) {
        const date = String(row?.date || '').trim();
        const label = String(row?.label || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label) continue;
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push({
            label,
            requestedBy: String(row?.requestedBy || '').trim() || 'Employee',
            pendingWith: String(row?.pendingWith || '').trim(),
        });
    }
    return byDate;
}

function buildMonthCalendarContext({
    monthKey,
    todayKey,
    records,
    scheduleWeek,
    offWeekdays,
    staffType,
    holidayRows,
    leavePolicy,
    monthlySalary,
    joinKey,
    visibleFrom,
    pendingRequests = [],
}) {
    const recordsByDate = {};
    (records || []).forEach((row) => {
        if (row?.date) recordsByDate[row.date] = row;
    });
    const holidayDates = new Set();
    const holidayNamesByDate = {};
    (holidayRows || []).forEach((row) => {
        if (!row?.date || !holidayAppliesToStaff(row, staffType)) return;
        holidayDates.add(row.date);
        holidayNamesByDate[row.date] = row.name || row.note || 'Holiday';
    });
    const anchor = new Date(`${monthKey}-01T12:00:00`);
    const monthDays = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
    let weekOffs = 0;
    monthDays.forEach((day) => {
        if (offWeekdays.has(WEEKDAY_KEYS[getDay(day)])) weekOffs += 1;
    });
    const salaryDaily = monthlySalary > 0 && monthDays.length
        ? money2(monthlySalary / Math.max(monthDays.length - weekOffs, 1))
        : 0;
    const countFrom = joinKey && joinKey.startsWith(monthKey) && joinKey > `${monthKey}-01` ? joinKey : `${monthKey}-01`;
    const countTo = countEndForMonth(monthKey, todayKey);
    const monthRecords = records || [];
    const counted = recordsInWindow(monthRecords, countFrom, countTo);
    const policy = leavePolicy || {};
    const mispunchAmounts = mispunchDayAmounts(
        counted.filter((row) => deductionKind(row) === 'mispunch'),
        policy,
        salaryDaily,
    );
    const additionWeeks = buildMonthWorkWeeks(monthKey);
    const dayInfo = (dateKey) => {
        const record = recordsByDate[dateKey];
        const weekdayKey = WEEKDAY_KEYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
        const isHoliday = holidayDates.has(dateKey) || record?.statusKey === 'holiday';
        const isWeeklyOff = !isHoliday && (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
        const required = Boolean(countTo)
            && dateKey <= countTo
            && (!joinKey || dateKey >= joinKey)
            && dateKey.startsWith(monthKey)
            && !isHoliday
            && !isWeeklyOff;
        const flexibleWeek = isFlexibleWeek(scheduleWeek);
        return {
            required,
            scheduledHours: required
                ? (flexibleWeek ? flexibleDayHours(scheduleWeek, dateKey) : dayHoursOf(scheduleWeek, dateKey))
                : 0,
            weeklyOff: isWeeklyOff,
            holiday: isHoliday,
        };
    };
    const monthWorkingDays = monthDays.filter((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const isHoliday = holidayDates.has(dateKey);
        const isWeeklyOff = !isHoliday && offWeekdays.has(WEEKDAY_KEYS[getDay(day)]);
        return !isHoliday && !isWeeklyOff;
    }).length;
    const additionInput = {
        monthKey,
        countTo,
        joinKey,
        records: monthRecords,
        daily: salaryDaily,
        flexible: isFlexibleWeek(scheduleWeek),
        dayInfo,
        monthlySalary,
        monthWorkingDays,
    };
    const payByDate = new Map();
    const calendarNotes = {};
    const mergeCalendar = (calendar) => {
        Object.entries(calendar || {}).forEach(([date, note]) => {
            const current = calendarNotes[date] || { otHours: 0, givenTo: '', takenFrom: '' };
            calendarNotes[date] = {
                otHours: note?.otHours > 0 ? note.otHours : current.otHours,
                givenTo: note?.givenTo || current.givenTo,
                takenFrom: note?.takenFrom || current.takenFrom,
            };
        });
    };
    additionWeeks.forEach((week) => {
        const report = buildWeeklySalaryAddition({
            ...additionInput,
            weekDates: week.dates,
            extraDates: week.extraDates,
        });
        report.details.forEach((row) => {
            payByDate.set(row.date, money2((payByDate.get(row.date) || 0) + (Number(row.amount) || 0)));
        });
        mergeCalendar(report.calendar);
    });
    return {
        monthKey,
        todayKey,
        recordsByDate,
        salaryLock: { locked: false },
        holidayDates,
        holidayNamesByDate,
        offWeekdays,
        scheduleWeek,
        countFrom,
        countTo,
        salaryDaily,
        leavePolicy: policy,
        mispunchAmounts,
        additionPayByDate: payByDate,
        calendarNotes,
        adjustmentByDate: buildAdjustmentIndex(monthRecords),
        visibleFrom: visibleFrom || '',
        pendingRequestsByDate: groupPendingRequests(pendingRequests),
    };
}

function GroupEmployeeCalendar({ employee, payload, holidayRows, leavePolicy, onOpen }) {
    const [hoveredDate, setHoveredDate] = useState('');
    const monthKey = payload?.month || '';
    const ctx = useMemo(() => {
        if (!payload || !monthKey) return null;
        const offWeekdays = new Set(Array.isArray(payload.offWeekdays) && payload.offWeekdays.length
            ? payload.offWeekdays
            : ['saturday', 'sunday']);
        return buildMonthCalendarContext({
            monthKey,
            todayKey: payload.today || format(new Date(), 'yyyy-MM-dd'),
            records: employee.records || [],
            scheduleWeek: weekForStaffType(payload.workingTime, payload.staffType || employee.staffType) || payload.scheduleWeek || null,
            offWeekdays,
            staffType: payload.staffType || employee.staffType,
            holidayRows,
            leavePolicy,
            monthlySalary: Number(employee.monthlySalary) || 0,
            joinKey: employee.visibleFrom || '',
            visibleFrom: employee.visibleFrom || '',
            pendingRequests: employee.pendingRequests,
        });
    }, [employee, holidayRows, leavePolicy, monthKey, payload]);
    const anchor = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);
    const days = useMemo(() => eachDayOfInterval({
        start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    }), [anchor]);
    if (!ctx) return null;
    return (
        <article
            className={`cursor-pointer rounded-2xl border border-[#E6EDF5] bg-white px-3 py-3 shadow-sm transition hover:border-[#93C5FD] ${hoveredDate ? 'relative z-30' : 'relative z-0'}`}
            onClick={(event) => {
                if (event.target.closest('[data-attendance-day]')) return;
                onOpen(employee.id);
            }}
        >
            <div className="mb-2 min-w-0">
                <p className="truncate text-[14px] font-bold text-[#1B2A4A]">{employee.employeeName || 'Employee'}</p>
                <p className="truncate text-[11px] font-medium text-[#64748B]">{employee.employeeId || 'Attendance'}</p>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="text-center text-[10px] font-medium text-[#94A3B8]">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day) => (
                    <AttendanceDayCell
                        key={format(day, 'yyyy-MM-dd')}
                        day={day}
                        ctx={ctx}
                        hoveredDate={hoveredDate}
                        setHoveredDate={setHoveredDate}
                        compact
                        markTarget={{
                            employeeId: employee.id,
                            staffType: payload.staffType || employee.staffType,
                        }}
                    />
                ))}
            </div>
        </article>
    );
}

function GroupAttendanceBoard({ groupKey, groupLabel, monthKey, holidayRows, leavePolicy, onOpenEmployee }) {
    const [payload, setPayload] = useState(null);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [loadedFor, setLoadedFor] = useState('');
    const requestKey = `${groupKey}|${monthKey}|${reloadKey}`;
    const loading = Boolean(groupKey) && loadedFor !== requestKey;

    useEffect(() => {
        if (!groupKey || !/^\d{4}-\d{2}$/.test(monthKey)) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/Leave/group-calendars', {
                params: { month: monthKey, staffType: groupKey, detail: '1' },
                skipToast: true,
            })
            .then((response) => {
                if (cancelled) return;
                setPayload(response.data || null);
                setError('');
                setLoadedFor(requestKey);
            })
            .catch((err) => {
                if (cancelled) return;
                setPayload(null);
                setError(err?.response?.data?.message || 'Could not load this group.');
                setLoadedFor(requestKey);
            });
        return () => {
            cancelled = true;
        };
    }, [groupKey, monthKey, reloadKey, requestKey]);

    const employees = Array.isArray(payload?.employees) ? payload.employees : [];
    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-[#F8FAFC] p-3">
            <style>{`
                @keyframes attendance-request-blink {
                    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                    45% { opacity: 0.35; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.45); }
                    70% { opacity: 1; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                }
                .attendance-request-blink {
                    animation: attendance-request-blink 2.4s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .attendance-request-blink {
                        animation: none;
                        box-shadow: inset 0 0 0 2px rgba(220, 38, 38, 0.75);
                    }
                }
            `}</style>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-[15px] font-bold text-[#1B2A4A]">{groupLabel} attendance</h2>
                    <p className="text-[12px] font-medium text-[#64748B]">Three calendars per row. Click a name to open that employee. Double-click a day to mark attendance. A day blinks only while it still has a pending attendance request, such as leave, missed punch, late in, or early out. Hover that day to see the request and who sent it.</p>
                </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
                {LEGEND.map((item) => (
                    <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${item.swatch}`} />
                        {item.label}
                    </span>
                ))}
            </div>
            {loading ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {[0, 1, 2].map((key) => (
                        <div key={key} className="h-64 animate-pulse rounded-2xl border border-[#E6EDF5] bg-white" />
                    ))}
                </div>
            ) : null}
            {!loading && error ? (
                <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="text-[13px] font-semibold text-red-500">
                    {error} · Retry
                </button>
            ) : null}
            {!loading && !error && employees.length ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {employees.map((employee) => (
                        <GroupEmployeeCalendar
                            key={employee.id}
                            employee={employee}
                            payload={payload}
                            holidayRows={holidayRows}
                            leavePolicy={leavePolicy}
                            onOpen={onOpenEmployee}
                        />
                    ))}
                </div>
            ) : null}
            {!loading && !error && !employees.length ? (
                <p className="rounded-xl border border-dashed border-[#E6EDF5] bg-white px-4 py-8 text-center text-sm text-[#64748B]">
                    No employees in this group.
                </p>
            ) : null}
        </section>
    );
}

function Panel({ title, aside, children }) {
    return (
        <section className="relative rounded-2xl border border-[#E6EDF5] bg-white p-3">
            {title ? (
                <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-[13px] font-bold text-[#1B2A4A]">{title}</h2>
                    {aside ? <div className="shrink-0 text-[12px] font-medium text-[#94A3B8]">{aside}</div> : null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

function prepStatusLabel(row) {
    const explicit = String(row?.status || '').trim();
    if (explicit) return explicit;
    const key = String(row?.appliedKey || '');
    const title = String(row?.title || '');
    if (key === 'mispunch' || key === 'late_arrived' || key === 'early_go') return 'Awaiting Explanation';
    if (key === 'utility' || /utility|clarification/i.test(title)) return 'Review Pending';
    if (/fine|deduct/i.test(title)) return 'Deduction Pending';
    return 'Approval Pending';
}

function salaryPrepRowTouchesMonth(row, monthKey) {
    const from = String(row?.fromDate || row?.dateKey || '').slice(0, 7);
    const to = String(row?.toDate || row?.fromDate || row?.dateKey || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(from)) return true;
    const end = /^\d{4}-\d{2}$/.test(to) ? to : from;
    return from <= monthKey && monthKey <= end;
}

function tableToneClass(label) {
    const text = String(label || '');
    if (/deduct|^high$/i.test(text)) return 'text-[#EF4444]';
    if (/^medium$/i.test(text)) return 'text-[#F59E0B]';
    if (/await|explanation|approv|review|pending|waiting/i.test(text)) return 'text-[#F97316]';
    return 'text-[#64748B]';
}

function TableTone({ label }) {
    if (!label) return <span className="text-[13px] text-[#94A3B8]">—</span>;
    return <span className={`whitespace-nowrap text-[13px] font-semibold ${tableToneClass(label)}`}>{label}</span>;
}

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[12px] font-medium text-[#94A3B8]';
const TD = 'px-3 py-2.5 align-middle text-[13px] text-[#1B2A4A]';
const OUTLINE_BTN = 'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-[#93C5FD] bg-white px-2.5 text-[12px] font-semibold text-[#2563EB]';
const CARD_PAGE_SIZE = 10;

function pageWindow(page, pageCount) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
    const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pageCount));
    return [...pages].sort((left, right) => left - right);
}

function CardPageBar({ page, pageCount, total, onPage }) {
    const start = total ? (page - 1) * CARD_PAGE_SIZE + 1 : 0;
    const end = total ? Math.min(total, page * CARD_PAGE_SIZE) : 0;
    const pages = pageWindow(page, pageCount);
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F6] px-4 py-2.5">
            <p className="text-[12px] text-[#64748B]">
                {total ? `Showing ${start}–${end} of ${total}` : 'Showing 0'}
            </p>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => onPage(page - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E6EDF5] text-[#64748B] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                >
                    <ChevronLeft size={14} />
                </button>
                {pages.map((value, index) => {
                    const previous = pages[index - 1];
                    const gap = previous && value - previous > 1;
                    return (
                        <span key={value} className="inline-flex items-center gap-1">
                            {gap ? <span className="px-0.5 text-[12px] text-[#94A3B8]">…</span> : null}
                            <button
                                type="button"
                                onClick={() => onPage(value)}
                                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[12px] font-semibold ${
                                    value === page
                                        ? 'bg-[#2563EB] text-white'
                                        : 'border border-[#E6EDF5] text-[#64748B]'
                                }`}
                                aria-current={value === page ? 'page' : undefined}
                            >
                                {value}
                            </button>
                        </span>
                    );
                })}
                <button
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() => onPage(page + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E6EDF5] text-[#64748B] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
const SOLID_BTN = 'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md bg-[#2563EB] px-2.5 text-[12px] font-semibold text-white';

function LeaveStat({ label, value, accent = false }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] font-medium leading-none text-[#94A3B8]">{label}</p>
            <p className={`mt-1 text-[16px] font-bold leading-none tabular-nums ${accent ? 'text-[#16A34A]' : 'text-[#1B2A4A]'}`}>{value}</p>
        </div>
    );
}

function LeaveBox({ tone, iconBg, icon: Icon, title, columns, children }) {
    return (
        <div className={`rounded-lg px-2.5 py-2 ${tone}`}>
            <div className="mb-2 flex items-center gap-2">
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${iconBg}`}>
                    <Icon size={16} strokeWidth={2.25} />
                </span>
                <p className="text-[13px] font-bold text-[#1B2A4A]">{title}</p>
            </div>
            <div className={`grid gap-2 ${columns}`}>{children}</div>
        </div>
    );
}

function SummaryCard({ icon: Icon, iconClass, rounded = 'rounded-lg', title, onClick, children, className = '' }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`flex items-center gap-2 rounded-xl border border-[#E8EEF5] bg-white px-2 py-1.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
        >
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center ${rounded} ${iconClass}`}>
                <Icon size={18} strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold leading-tight text-[#1B2A4A]">{title}</span>
                <span className="mt-0.5 block">{children}</span>
            </span>
        </Tag>
    );
}

function SplitStats({ items }) {
    return (
        <div className={`grid gap-1 ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {items.map((item) => (
                <div key={item.label} className="min-w-0">
                    <p className="text-[10px] font-medium leading-none text-[#94A3B8]">{item.label}</p>
                    <p className="mt-0.5 text-[15px] font-bold leading-none tabular-nums text-[#1B2A4A]">{item.value}</p>
                </div>
            ))}
        </div>
    );
}

function figureParts(value, singular, plural) {
    if (value === '—' || value == null || value === '') return { text: '—', word: singular };
    const amount = Number(value);
    if (!Number.isFinite(amount)) return { text: value, word: plural };
    return { text: amount, word: amount === 1 ? singular : plural };
}

function AdditionWeekSelect({ weeks, value, onChange, id }) {
    return (
        <select
            id={id}
            aria-label="Salary addition week"
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 w-full rounded-lg border border-[#E6EDF5] bg-white px-2 text-[12px] font-semibold text-[#1B2A4A] outline-none"
        >
            {weeks.map((week) => (
                <option key={week.id} value={week.id}>
                    {week.id === 'all'
                        ? (week.empty
                            ? 'All (current month)'
                            : `All (${formatDayLabel(week.from)} to ${formatDayLabel(week.to)})`)
                        : `Week ${week.index} (${formatDayLabel(week.from)} to ${formatDayLabel(week.to)})`}
                </option>
            ))}
        </select>
    );
}

const ADDITION_LISTS = {
    requiredDays: { title: 'Required working days', rows: 'requiredRows', empty: 'No required working days in this range.' },
    requiredHours: { title: 'Required working hours', rows: 'requiredRows', empty: 'No required working hours in this range.' },
    workedDays: { title: 'Actual worked days', rows: 'workedRows', empty: 'No days worked in this range.' },
    workedHours: { title: 'Actual worked hours', rows: 'workedRows', empty: 'No hours worked in this range.' },
    compOff: { title: 'Comp off', rows: 'compOffRows', empty: 'No approved comp off in this range.' },
    overtime: { title: 'Overtime', rows: 'otRows', empty: 'No approved overtime in this range.' },
    amount: { title: 'Amount to pay', rows: '', empty: '' },
};

function AdditionPayCount({ label, value, valueClass = 'text-[#1B2A4A]', onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="min-w-0 rounded-lg border border-[#E6EDF5] bg-white px-2 py-1.5 text-left hover:border-[#93C5FD] hover:bg-[#F8FAFC]"
        >
            <span className="block text-[10px] font-medium leading-none text-[#94A3B8]">{label}</span>
            <span className={`mt-1 block truncate text-[14px] font-bold leading-none tabular-nums ${valueClass}`}>{value}</span>
        </button>
    );
}

function AdditionPayCard({ title, children, columns }) {
    return (
        <div className="min-w-0 rounded-xl border border-[#E6EDF5] bg-[#F8FAFC] px-2 py-2">
            <p className="mb-1.5 text-[12px] font-bold leading-tight text-[#1B2A4A]">{title}</p>
            <div className={`grid gap-1.5 ${columns}`}>{children}</div>
        </div>
    );
}

function compOffWorkedRows(pay) {
    const workedDates = new Set((pay?.workedRows || []).map((row) => row.date));
    return (pay?.compOffRows || []).filter((row) => (
        String(row?.text || '').startsWith('Comp off taken') && !workedDates.has(row.date)
    ));
}

function AdditionPayBoxes({ ready, pay, onOpen }) {
    const row = pay || {};
    const compOffWorked = compOffWorkedRows(row);
    const workedDays = (Number(row.workedDays) || 0) + compOffWorked.length;
    const workedHours = (Number(row.workedHours) || 0) + compOffWorked.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
    const daysText = (value) => (ready ? measureLabel(value, 'Day', 'Days') : '—');
    const hoursText = (value) => (ready ? formatHourMeasure(value) : '—');
    const amount = Number(row.amount) || 0;
    const short = ready && amount < -0.004;
    const extra = ready && amount > 0.004;
    const amountClass = short ? 'text-[#DC2626]' : extra ? 'text-[#16A34A]' : 'text-[#1B2A4A]';
    const amountText = ready ? `${extra ? '+' : ''}${formatAedNumber(amount)}` : '—';
    return (
        <div className="space-y-2 px-3 pb-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <AdditionPayCard title="Required working" columns="grid-cols-2">
                    <AdditionPayCount label="Days" value={daysText(row.requiredDays)} onClick={() => onOpen('requiredDays')} />
                    <AdditionPayCount label="Hours" value={hoursText(row.requiredHours)} onClick={() => onOpen('requiredHours')} />
                </AdditionPayCard>
                <AdditionPayCard title="Actual worked" columns="grid-cols-2">
                    <AdditionPayCount label="Days" value={daysText(workedDays)} onClick={() => onOpen('workedDays')} />
                    <AdditionPayCount label="Hours" value={hoursText(workedHours)} onClick={() => onOpen('workedHours')} />
                </AdditionPayCard>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <AdditionPayCard title="Comp off" columns="grid-cols-1">
                    <AdditionPayCount label="Days" value={daysText(row.compOffDays)} onClick={() => onOpen('compOff')} />
                </AdditionPayCard>
                <AdditionPayCard title="Overtime" columns="grid-cols-1">
                    <AdditionPayCount label="Hours" value={hoursText(row.otHours)} onClick={() => onOpen('overtime')} />
                </AdditionPayCard>
                <AdditionPayCard title="Amount to pay" columns="grid-cols-1">
                    <AdditionPayCount label="AED" value={amountText} valueClass={amountClass} onClick={() => onOpen('amount')} />
                </AdditionPayCard>
            </div>
        </div>
    );
}

function SalaryAdditionListModal({ mode, ready, pay, staffType, employeeId, onClose }) {
    const router = useRouter();
    useEffect(() => {
        if (!mode) return undefined;
        function onKey(event) {
            if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [mode, onClose]);
    if (!mode || typeof document === 'undefined') return null;
    const spec = ADDITION_LISTS[mode];
    if (!spec) return null;
    const rows = spec.rows
        ? (mode === 'workedDays' || mode === 'workedHours'
            ? [...(pay?.[spec.rows] || []), ...compOffWorkedRows(pay)]
            : (pay?.[spec.rows] || []))
        : [];
    const lines = Array.isArray(pay?.calculation) ? pay.calculation : [];
    const openDay = (date) => {
        if (!date) return;
        router.push(markAttendanceHref({
            date,
            staffType,
            blinkEmployee: employeeId,
        }));
    };
    return createPortal(
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="salary-addition-list-title"
                className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] px-5 py-4">
                    <h3 id="salary-addition-list-title" className="text-[15px] font-bold text-[#1B2A4A]">{spec.title}</h3>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1B2A4A]" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-auto px-5 py-3">
                    {mode === 'amount' ? (
                        <div className="space-y-2">
                            {ready && lines.length ? lines.map((line, index) => {
                                const last = index === lines.length - 1;
                                const amount = Number(pay?.amount) || 0;
                                const tone = !last
                                    ? 'text-[#1B2A4A]'
                                    : amount < -0.004
                                        ? 'text-[#DC2626]'
                                        : amount > 0.004
                                            ? 'text-[#16A34A]'
                                            : 'text-[#1B2A4A]';
                                return (
                                    <p key={`${index}-${line}`} className={`text-[13px] font-medium leading-snug ${tone}`}>{line}</p>
                                );
                            }) : (
                                <p className="py-6 text-center text-[13px] text-[#94A3B8]">No amount to show for this range.</p>
                            )}
                        </div>
                    ) : rows.length && ready ? (
                        <div className="divide-y divide-[#F4F7FB]">
                            {rows.map((row, index) => (
                                <button
                                    key={`${row.date}-${row.text || index}`}
                                    type="button"
                                    onClick={() => openDay(row.date)}
                                    className="flex w-full items-start justify-between gap-3 py-2.5 text-left hover:bg-[#F8FAFC]"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-[13px] font-semibold text-[#1B2A4A]">{row.text || row.label}</span>
                                        {row.text ? <span className="mt-0.5 block text-[11px] text-[#64748B]">{row.label}</span> : null}
                                    </span>
                                    <span className="shrink-0 text-right text-[12px] font-semibold tabular-nums text-[#2563EB]">
                                        {formatHourMeasure(row.hours)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="py-6 text-center text-[13px] text-[#94A3B8]">{spec.empty}</p>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function FigureLine({ value, singular, plural, noteValue, noteSingular, notePlural }) {
    const main = figureParts(value, singular, plural);
    const note = noteValue == null ? null : figureParts(noteValue, noteSingular, notePlural);
    return (
        <div>
            <p className="leading-none">
                <span className="text-[15px] font-bold tabular-nums text-[#1B2A4A]">{main.text}</span>
                <span className="ml-1 text-[12px] font-semibold text-[#1B2A4A]">{main.word}</span>
            </p>
            {note ? (
                <p className="mt-0.5 text-[11px] font-medium leading-none text-[#94A3B8]">
                    {note.text} {note.word}
                </p>
            ) : null}
        </div>
    );
}

function EmployeeProfileSwitcher({ employeeMongoId, name }) {
    const router = useRouter();
    const rootRef = useRef(null);
    const searchRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
        };
        const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const frame = requestAnimationFrame(() => searchRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [open]);

    useEffect(() => {
        if (!open || employees.length || failed) return undefined;
        let cancelled = false;
        setLoading(true);
        axiosInstance
            .get('/Leave/employees', { params: { year: 'all' }, skipToast: true })
            .then((response) => {
                if (cancelled) return;
                const list = Array.isArray(response.data?.employees) ? response.data.employees : [];
                setEmployees(list);
                setFailed(false);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, employees.length, failed]);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return employees
            .map((row) => ({
                id: String(row?._id || '').trim(),
                name: String(row?.employeeName || '').trim(),
                code: String(row?.employeeId || '').trim(),
            }))
            .filter((row) => row.id && row.name)
            .filter((row) => !needle || `${row.name} ${row.code}`.toLowerCase().includes(needle))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [employees, query]);

    function choose(id) {
        setOpen(false);
        setQuery('');
        if (!id || id === String(employeeMongoId || '')) return;
        router.push(`/HRM/Leave/${id}`);
    }

    return (
        <div ref={rootRef} className="relative min-w-0">
            <button
                type="button"
                onClick={() => {
                    setQuery('');
                    setFailed(false);
                    setOpen((value) => !value);
                }}
                className="flex min-w-0 items-center gap-1 text-left"
                aria-expanded={open}
                aria-haspopup="listbox"
            >
                <h1 className="truncate text-[16px] font-bold leading-tight text-[#1B2A4A]">{name || 'Employee'}</h1>
                <ChevronDown size={16} className={`shrink-0 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
                <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[#E6EDF5] bg-white shadow-xl">
                    <div className="flex items-center gap-2 border-b border-[#E6EDF5] px-3 py-2">
                        <Search size={14} className="shrink-0 text-[#94A3B8]" />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search employee"
                            className="w-full bg-transparent text-[13px] font-medium text-[#1B2A4A] outline-none placeholder:text-[#94A3B8]"
                        />
                    </div>
                    <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
                        {loading ? (
                            <li className="px-3 py-3 text-[13px] text-[#94A3B8]">Loading employees...</li>
                        ) : failed ? (
                            <li className="px-3 py-3 text-[13px] text-[#94A3B8]">Could not load employees.</li>
                        ) : filtered.length === 0 ? (
                            <li className="px-3 py-3 text-[13px] text-[#94A3B8]">No employees found.</li>
                        ) : (
                            filtered.map((row) => {
                                const current = row.id === String(employeeMongoId || '');
                                return (
                                    <li key={row.id}>
                                        <button
                                            type="button"
                                            onClick={() => choose(row.id)}
                                            className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#F8FAFC] ${current ? 'bg-[#EFF6FF]' : ''}`}
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px] font-semibold text-[#1B2A4A]">{row.name}</span>
                                                <span className="block truncate text-[11px] font-medium text-[#94A3B8]">{row.code || '—'}</span>
                                            </span>
                                            {current ? <Check size={14} className="shrink-0 text-[#2563EB]" /> : null}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

export default function EmployeeInformationDashboard({
    employeeMongoId,
    profile,
    annualCalendarHref,
    onYearChange,
    onOpenAnnual,
    onOpenCategory,
    onOpenFinancial,
    onDeductionDetails,
    onDownload,
    onOpenPayroll,
    onOpenSalary,
    onOpenLeaveList,
}) {
    const router = useRouter();
    const { tabs: staffGroups } = useWorkLocations();
    const todayKey = dubaiTodayKey();
    const currentMonth = todayKey.slice(0, 7);
    const employee = profile?.employee || {};
    const joinKey = String(employee.dateOfJoining || '').trim();
    const [period, setPeriod] = useState('month');
    const [monthKey, setMonthKey] = useState(currentMonth);
    const [recordsByDate, setRecordsByDate] = useState({});
    const [monthRecords, setMonthRecords] = useState([]);
    const [offWeekdays, setOffWeekdays] = useState(() => new Set(['saturday', 'sunday']));
    const [scheduleWeek, setScheduleWeek] = useState(null);
    const [staffType, setStaffType] = useState('office');
    const [holidayRows, setHolidayRows] = useState([]);
    const [monthLoading, setMonthLoading] = useState(true);
    const [monthError, setMonthError] = useState('');
    const [salaryLock, setSalaryLock] = useState(EMPTY_SALARY_LOCK);
    const [todayRecord, setTodayRecord] = useState(null);
    const [allTimeStats, setAllTimeStats] = useState(null);
    const [allTimeLoading, setAllTimeLoading] = useState(false);
    const [allTimeNote, setAllTimeNote] = useState('');
    const [hoveredDate, setHoveredDate] = useState('');
    const [pinnedPlace, setPinnedPlace] = useState('');
    const [spanRecords, setSpanRecords] = useState([]);
    const [spanLoading, setSpanLoading] = useState(false);
    const [additionWeekId, setAdditionWeekId] = useState('all');
    const [additionModal, setAdditionModal] = useState('');
    const [otPage, setOtPage] = useState(1);
    const [otView, setOtView] = useState(null);
    const [compOffPage, setCompOffPage] = useState(1);
    const [compOffView, setCompOffView] = useState(null);
    const [groupKey, setGroupKey] = useState('');
    const [groupMenuOpen, setGroupMenuOpen] = useState(false);
    const [prepPage, setPrepPage] = useState(1);
    const [taskPage, setTaskPage] = useState(1);
    const groupMenuRef = useRef(null);

    useEffect(() => {
        setPrepPage(1);
        setOtPage(1);
        setCompOffPage(1);
    }, [employeeMongoId, period, monthKey]);

    useEffect(() => {
        setTaskPage(1);
    }, [employeeMongoId]);

    useEffect(() => {
        if (!groupMenuOpen) return undefined;
        const close = (event) => {
            if (groupMenuRef.current && !groupMenuRef.current.contains(event.target)) setGroupMenuOpen(false);
        };
        const onKey = (event) => {
            if (event.key === 'Escape') setGroupMenuOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [groupMenuOpen]);

    const monthAnchor = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);
    const choices = useMemo(() => monthChoices(joinKey, todayKey), [joinKey, todayKey]);

    const loadMonth = useCallback(async () => {
        if (!employeeMongoId || !/^\d{4}-\d{2}$/.test(monthKey)) return;
        setMonthLoading(true);
        setMonthError('');
        try {
            const response = await axiosInstance.get('/Attendance/me', {
                params: { month: monthKey, forEmployeeId: employeeMongoId },
                skipToast: true,
            });
            const rows = Array.isArray(response.data?.records) ? response.data.records : [];
            const map = {};
            rows.forEach((row) => {
                if (row?.date) map[row.date] = row;
            });
            setMonthRecords(rows);
            setRecordsByDate(map);
            const nextStaffType = normalizeWorkLocationKey(response.data?.employee?.staffType || employee.staffType);
            setStaffType(nextStaffType);
            setScheduleWeek(weekForStaffType(response.data?.workingTime, nextStaffType));
            setOffWeekdays(
                new Set(
                    Array.isArray(response.data?.offWeekdays) && response.data.offWeekdays.length
                        ? response.data.offWeekdays
                        : ['saturday', 'sunday'],
                ),
            );
            setSalaryLock(salaryLockFromAttendancePayload(response.data));
            if (monthKey === currentMonth) {
                setTodayRecord(response.data?.todayRecord || map[todayKey] || null);
            }
        } catch (err) {
            setMonthRecords([]);
            setRecordsByDate({});
            setScheduleWeek(null);
            if (err?.response?.data?.salaryEnrolled === false || err?.response?.data?.attendanceLocked) {
                setSalaryLock(salaryLockFromAttendancePayload(err.response.data));
                setMonthError('');
            } else {
                setSalaryLock(EMPTY_SALARY_LOCK);
                setMonthError(err?.response?.data?.message || 'Could not load attendance.');
            }
        } finally {
            setMonthLoading(false);
        }
    }, [employeeMongoId, monthKey, currentMonth, todayKey, employee.staffType]);

    useEffect(() => {
        loadMonth();
    }, [loadMonth]);

    useEffect(() => {
        if (monthKey === currentMonth) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/Attendance/me', {
                params: { month: currentMonth, forEmployeeId: employeeMongoId },
                skipToast: true,
            })
            .then((response) => {
                if (cancelled) return;
                const rows = Array.isArray(response.data?.records) ? response.data.records : [];
                const found = response.data?.todayRecord || rows.find((row) => row?.date === todayKey) || null;
                setTodayRecord(found);
            })
            .catch(() => {
                if (!cancelled) setTodayRecord(null);
            });
        return () => {
            cancelled = true;
        };
    }, [monthKey, currentMonth, employeeMongoId, todayKey]);

    useEffect(() => {
        const year = Number(monthKey.slice(0, 4));
        if (!year) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/Holiday', { params: { year }, skipToast: true })
            .then((response) => {
                if (!cancelled) setHolidayRows(Array.isArray(response.data?.holidays) ? response.data.holidays : []);
            })
            .catch(() => {
                if (!cancelled) setHolidayRows([]);
            });
        return () => {
            cancelled = true;
        };
    }, [monthKey]);

    useEffect(() => {
        if (period !== 'all' || !employeeMongoId) return undefined;
        const nowYear = Number(todayKey.slice(0, 4));
        const joinYear = Number(String(joinKey).slice(0, 4));
        const start = Number.isFinite(joinYear) && joinYear >= 2000 ? joinYear : nowYear;
        const years = [];
        for (let year = start; year <= nowYear; year += 1) years.push(year);
        let cancelled = false;
        setAllTimeStats(null);
        setAllTimeLoading(true);
        setAllTimeNote('');
        Promise.all(
            years.map((year) =>
                axiosInstance
                    .get(`/Leave/employees/${employeeMongoId}/attendance-profile`, {
                        params: { year },
                        skipToast: true,
                    })
                    .then((response) => response.data)
                    .catch(() => null),
            ),
        )
            .then((rows) => {
                if (cancelled) return;
                const loaded = rows.filter(Boolean);
                const missing = rows.length - loaded.length;
                const summed = loaded.reduce(
                    (total, row) => addPeriodStats(total, profilePeriodStats(row)),
                    addPeriodStats({}, {}),
                );
                setAllTimeStats(summed);
                setAllTimeNote(missing ? `${missing} year${missing === 1 ? '' : 's'} could not be loaded.` : '');
            })
            .finally(() => {
                if (!cancelled) setAllTimeLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [period, employeeMongoId, joinKey, todayKey]);

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

    const days = useMemo(
        () => eachDayOfInterval({ start: startOfMonth(monthAnchor), end: endOfMonth(monthAnchor) }),
        [monthAnchor],
    );

    const countFrom = joinKey.startsWith(monthKey) && joinKey > `${monthKey}-01` ? joinKey : `${monthKey}-01`;
    const countTo = countEndForMonth(monthKey, todayKey);
    const countedRecords = useMemo(
        () => recordsInWindow(monthRecords, countFrom, countTo),
        [monthRecords, countFrom, countTo],
    );
    const detailWindow = useMemo(() => {
        if (period === 'year') {
            const year = String(profile?.year || monthKey.slice(0, 4));
            const yearStart = `${year}-01-01`;
            const from = joinKey.startsWith(year) && joinKey > yearStart ? joinKey : yearStart;
            const end = `${year}-12-31`;
            if (year > todayKey.slice(0, 4)) return { from, to: '' };
            if (year < todayKey.slice(0, 4)) return { from, to: end };
            const yesterday = shiftDateKey(todayKey, -1);
            return { from, to: yesterday >= from ? (yesterday < end ? yesterday : end) : '' };
        }
        if (period === 'all') {
            const from = /^\d{4}-\d{2}-\d{2}$/.test(joinKey) ? joinKey : `${todayKey.slice(0, 4)}-01-01`;
            const to = shiftDateKey(todayKey, -1);
            return { from, to: to && to >= from ? to : '' };
        }
        return { from: `${monthKey}-01`, to: countTo };
    }, [period, profile?.year, monthKey, joinKey, todayKey, countFrom, countTo]);

    useEffect(() => {
        if (period === 'month' || !employeeMongoId || !detailWindow.from || !detailWindow.to) {
            setSpanRecords([]);
            setSpanLoading(false);
            return undefined;
        }
        const months = monthKeysBetween(detailWindow.from, detailWindow.to).filter((key) => key !== monthKey);
        let cancelled = false;
        setSpanLoading(true);
        const load = async () => {
            const rows = [];
            for (let index = 0; index < months.length; index += 4) {
                const chunk = months.slice(index, index + 4);
                const groups = await Promise.all(
                    chunk.map((month) =>
                        axiosInstance
                            .get('/Attendance/me', {
                                params: { month, forEmployeeId: employeeMongoId },
                                skipToast: true,
                            })
                            .then((response) => (Array.isArray(response.data?.records) ? response.data.records : []))
                            .catch(() => []),
                    ),
                );
                groups.forEach((group) => rows.push(...group));
            }
            if (!cancelled) setSpanRecords(rows);
        };
        load().finally(() => {
            if (!cancelled) setSpanLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [period, employeeMongoId, detailWindow.from, detailWindow.to, monthKey]);

    const monthStats = useMemo(() => {
        const annual = leaveTallies(countedRecords, 'on_leave');
        const sick = leaveTallies(countedRecords, 'sick_leave');
        const authorized = leaveTallies(
            countedRecords.filter((row) => deductionKind(row) === 'authorized_leave'),
            'authorized_leave',
        );
        const unauthorized = leaveTallies(
            countedRecords.filter((row) => deductionKind(row) === 'unauthorized_leave'),
            'unauthorized_leave',
        );
        let present = 0;
        let wfh = 0;
        let lateIn = 0;
        let earlyOut = 0;
        let missed = 0;
        let compoffUsed = 0;
        let compoffPending = 0;
        countedRecords.forEach((row) => {
            const stored = String(row?.statusKey || '');
            const key = stored !== 'compoff_leave' && isNextDayCompOffRow(row) ? 'compoff_leave' : stored;
            const kind = deductionKind(row);
            if (key === 'on_office') present += 1;
            if (key === 'work_from_home') wfh += 1;
            if (kind === 'late_arrived') lateIn += 1;
            if (kind === 'early_go') earlyOut += 1;
            if (kind === 'mispunch') missed += 1;
            if (key === 'compoff_leave') {
                compoffUsed += 1;
                if (stored === 'compoff_leave') {
                    const state = String(row?.compOff?.state || '');
                    if (!state || state === 'open') compoffPending += 1;
                }
            }
        });
        let absent = 0;
        if (countTo) {
            days.forEach((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                if (dateKey < countFrom || dateKey > countTo) return;
                if (joinKey && dateKey < joinKey) return;
                const record = recordsByDate[dateKey];
                const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                const isHoliday = holidayDates.has(dateKey) || record?.statusKey === 'holiday';
                const isWeeklyOff = !isHoliday && (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
                if (isHoliday || isWeeklyOff) return;
                const key = String(record?.statusKey || '');
                if (!record || key === 'not_marked') absent += 1;
            });
        }
        return {
            annual,
            sick,
            authorized,
            unauthorized,
            compoffUsed,
            compoffPending,
            lateIn,
            earlyOut,
            missed,
            present,
            wfh,
            absent,
        };
    }, [countedRecords, days, recordsByDate, holidayDates, offWeekdays, countFrom, countTo, joinKey]);

    const attendanceMinutes = useMemo(() => {
        if (period === 'all') return { late: null, early: null };
        const source = period === 'month' ? countedRecords : (profile?.events || []);
        return {
            late: sumStatusMinutes(source, scheduleWeek, 'late_arrived', 'in'),
            early: sumStatusMinutes(source, scheduleWeek, 'early_go', 'out'),
        };
    }, [period, countedRecords, profile?.events, scheduleWeek]);

    const yearStats = useMemo(() => profilePeriodStats(profile), [profile]);
    const activeStats = period === 'all' ? allTimeStats || profilePeriodStats(null) : period === 'year' ? yearStats : monthStats;
    const statsLocked = period === 'month' && salaryLock.locked;
    const showValue = (value) => (statsLocked ? '—' : value);

    const balances = profile?.leaveBalances || {};
    const annualLeave = profile?.annualLeave || {};
    const sickRemaining = balances.sick_leave?.remaining == null ? '—' : n(balances.sick_leave.remaining);
    const annualBalance = balances.on_leave?.remaining == null ? n(annualLeave.remainingDays) : n(balances.on_leave.remaining);
    const compoffBalance = n(balances.compoff_leave?.remaining);
    const compoffEarned = balances.compoff_leave?.allowed != null
        ? n(balances.compoff_leave.allowed)
        : n(profile?.summary?.counts?.compoff_leave) + compoffBalance;

    const financial = profile?.financial || {};
    const salary = financial.salary || {};
    const monthPay = salaryForMonth(salary, financial.salaryHistory, monthKey);
    const monthlySalary = monthPay.monthlySalary;
    const increment = financial.increment;
    const loans = Array.isArray(financial.loans) ? financial.loans : [];
    const advances = Array.isArray(financial.advances) ? financial.advances : [];
    const fines = Array.isArray(financial.fines) ? financial.fines : [];
    const rewards = Array.isArray(financial.rewards) ? financial.rewards : [];
    const utilityItems = Array.isArray(financial.utilityItems) ? financial.utilityItems : [];
    const loanOutstanding = loans.reduce((sum, row) => sum + n(row.outstanding), 0);
    const loanPaid = loans.reduce(
        (sum, row) => sum + (row.paid != null && row.paid !== '' ? n(row.paid) : Math.max(0, n(row.total) - n(row.outstanding))),
        0,
    );
    const advanceTotal = advances.reduce((sum, row) => sum + n(row.total), 0);
    const loanTotal = loans.reduce((sum, row) => sum + n(row.total), 0);
    const advanceOutstanding = advances.reduce((sum, row) => sum + n(row.outstanding), 0);
    const advancePaid = advances.reduce(
        (sum, row) => sum + (row.paid != null && row.paid !== '' ? n(row.paid) : Math.max(0, n(row.total) - n(row.outstanding))),
        0,
    );
    const fineOutstanding = fines.reduce((sum, row) => sum + n(row.outstanding), 0);
    const utilityOutstanding = utilityItems.length
        ? utilityItems.reduce((sum, row) => sum + n(row.amount), 0)
        : n(financial.utility?.outstanding);

    const monthRewardLabel = formatMonthLabel(monthKey);
    const monthRewards = rewards.filter(
        (row) => String(row?.dateLabel || '').trim().toLowerCase() === monthRewardLabel.toLowerCase(),
    );
    const rewardAmount = monthRewards.reduce((sum, row) => sum + n(row.amount), 0);
    const rewardLead = monthRewards[0];

    const detailRecords = useMemo(() => {
        if (period === 'month') return recordsInWindow(monthRecords, detailWindow.from, detailWindow.to);
        const byDate = new Map();
        recordsInWindow(spanRecords, detailWindow.from, detailWindow.to).forEach((row) => {
            const date = String(row?.date || '');
            if (date) byDate.set(date, row);
        });
        recordsInWindow(monthRecords, detailWindow.from, detailWindow.to).forEach((row) => {
            const date = String(row?.date || '');
            if (date) byDate.set(date, row);
        });
        return [...byDate.values()];
    }, [period, spanRecords, monthRecords, detailWindow.from, detailWindow.to]);
    const overtimeRange = detailWindow.from && detailWindow.to
        ? `${formatDayLabel(detailWindow.from)} to ${formatDayLabel(detailWindow.to)}`
        : '—';

    const salaryBasis = useMemo(() => {
        let weekOffs = 0;
        days.forEach((day) => {
            if (offWeekdays.has(WEEKDAY_KEYS[getDay(day)])) weekOffs += 1;
        });
        const calendarDays = days.length;
        const workingDays = Math.max(calendarDays - weekOffs, 1);
        const daily = monthlySalary > 0 && calendarDays > 0 ? money2(monthlySalary / workingDays) : 0;
        return { calendarDays, weekOffs, workingDays, daily };
    }, [days, offWeekdays, monthlySalary]);
    const additionWeeks = useMemo(() => buildMonthWorkWeeks(monthKey), [monthKey]);
    const additionChoices = useMemo(
        () => buildMonthAdditionChoices(monthKey, todayKey),
        [monthKey, todayKey],
    );
    const additionWeek = useMemo(() => {
        const picked = additionChoices.find((week) => week.id === (additionWeekId || 'all'));
        if (picked) return picked;
        return additionChoices.find((week) => week.id === 'all') || additionChoices[0] || null;
    }, [additionChoices, additionWeekId]);
    const additionReady = !monthLoading && !(period === 'month' && salaryLock.locked);
    const additionBundle = useMemo(() => {
        const dayInfo = (dateKey) => {
            const record = recordsByDate[dateKey];
            const weekdayKey = WEEKDAY_KEYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
            const isHoliday = holidayDates.has(dateKey) || record?.statusKey === 'holiday';
            const isWeeklyOff = !isHoliday && (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
            const required = Boolean(countTo)
                && dateKey <= countTo
                && (!joinKey || dateKey >= joinKey)
                && dateKey.startsWith(monthKey)
                && !isHoliday
                && !isWeeklyOff;
            const flexibleWeek = isFlexibleWeek(scheduleWeek);
            return {
                required,
                scheduledHours: required
                    ? (flexibleWeek ? flexibleDayHours(scheduleWeek, dateKey) : dayHoursOf(scheduleWeek, dateKey))
                    : 0,
                weeklyOff: isWeeklyOff,
                holiday: isHoliday,
            };
        };
        const monthWorkingDays = days.filter((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isHoliday = holidayDates.has(dateKey);
            const isWeeklyOff = !isHoliday && offWeekdays.has(WEEKDAY_KEYS[getDay(day)]);
            return !isHoliday && !isWeeklyOff;
        }).length;
        const additionInput = {
            monthKey,
            countTo,
            joinKey,
            records: monthRecords,
            daily: salaryBasis.daily,
            flexible: String(scheduleWeek?.timingMode || '').toLowerCase() === 'flexible',
            dayInfo,
            monthlySalary,
            monthWorkingDays,
        };
        const payByDate = new Map();
        const calendarNotes = {};
        const mergeCalendar = (calendar) => {
            Object.entries(calendar || {}).forEach(([date, note]) => {
                const current = calendarNotes[date] || { otHours: 0, givenTo: '', takenFrom: '' };
                calendarNotes[date] = {
                    otHours: note?.otHours > 0 ? note.otHours : current.otHours,
                    givenTo: note?.givenTo || current.givenTo,
                    takenFrom: note?.takenFrom || current.takenFrom,
                };
            });
        };
        const reports = additionWeeks.map((week) => buildWeeklySalaryAddition({
            ...additionInput,
            weekDates: week.dates,
            extraDates: week.extraDates,
        }));
        reports.forEach((report) => {
            report.details.forEach((row) => {
                payByDate.set(row.date, money2((payByDate.get(row.date) || 0) + (Number(row.amount) || 0)));
            });
            mergeCalendar(report.calendar);
        });
        const picked = additionWeeks.findIndex((week) => week.id === additionWeek?.id);
        const selected = additionWeek?.id === 'all'
            ? buildWeeklySalaryAddition({
                ...additionInput,
                weekDates: additionWeek.dates,
                extraDates: additionWeek.extraDates,
            })
            : reports[picked];
        mergeCalendar(selected?.calendar);
        return {
            report: selected || emptyWeeklySalaryAddition(),
            payByDate,
            calendarNotes,
        };
    }, [
        additionWeeks,
        additionWeek,
        monthKey,
        countTo,
        joinKey,
        monthRecords,
        salaryBasis.daily,
        monthlySalary,
        days,
        scheduleWeek,
        recordsByDate,
        holidayDates,
        offWeekdays,
    ]);
    const salaryAddition = additionBundle.report;
    const additionPayByDate = additionBundle.payByDate;
    const calendarNotes = additionBundle.calendarNotes || {};
    const mispunchAmounts = useMemo(
        () => mispunchDayAmounts(
            countedRecords.filter((row) => deductionKind(row) === 'mispunch'),
            profile?.leavePolicy || {},
            salaryBasis.daily,
        ),
        [countedRecords, profile?.leavePolicy, salaryBasis.daily],
    );
    const deductionRows = useMemo(() => {
        const policy = profile?.leavePolicy || {};
        const daily = salaryBasis.daily;
        const authDays = money2(countedRecords.reduce((sum, row) => {
            if (deductionKind(row) !== 'authorized_leave') return sum;
            if (String(row?.hourAdjustStatus || '') === 'approved') {
                const dayHours = flexibleDayHours(scheduleWeek, row.date) || dayHoursOf(scheduleWeek, row.date) || 8;
                return sum + (n(row.hoursApproved) / dayHours);
            }
            return sum + leaveDayWeight(row, true);
        }, 0));
        const unauthDays = money2(countedRecords.reduce((sum, row) => {
            if (deductionKind(row) !== 'unauthorized_leave') return sum;
            return sum + leaveDayWeight(row, false);
        }, 0));
        const authTimes = policy.authorizedDeductionDays == null ? 1 : n(policy.authorizedDeductionDays);
        const unauthTimes = policy.unauthorizedDeductionDays == null ? 2 : n(policy.unauthorizedDeductionDays);
        const punchShare = (row, kind) => {
            const key = deductionKind(row);
            if (key !== 'late_arrived' && key !== 'early_go') return 0;
            if (isFlexibleWeek(scheduleWeek)) return key === kind ? 1 : 0;
            const gaps = scheduledGapHours(row, scheduleWeek);
            const total = gaps ? gaps.late + gaps.early : 0;
            if (!(total > 0)) return key === kind ? 1 : 0;
            const hours = kind === 'late_arrived' ? gaps.late : gaps.early;
            return hours > 0 ? hours / total : 0;
        };
        const punchAmountOf = (kind) => countedRecords.reduce((sum, row) => {
            const share = punchShare(row, kind);
            if (!(share > 0)) return sum;
            return sum + attendanceDeductionAmount(row, scheduleWeek, daily, policy) * share;
        }, 0);
        const punchCountOf = (kind) => countedRecords.filter((row) => punchShare(row, kind) > 0).length;
        const punchAmount = money2([...mispunchAmounts.values()].reduce((sum, amount) => sum + amount, 0));
        const dayRate = formatAed(daily, 2);
        const hourNote = isFlexibleWeek(scheduleWeek)
            ? 'Flexible time deducts only the missed hours. Late arrival and early go do not use the salary policy.'
            : 'Until approval this uses the unauthorized leave rate. After approval, only the approved hours are deducted.';
        const missedRule = mispunchPolicyRule(policy);
        return [
            {
                key: 'late_arrived',
                type: 'Late arrival',
                count: punchCountOf('late_arrived'),
                amount: money2(punchAmountOf('late_arrived')),
                note: hourNote,
            },
            {
                key: 'early_go',
                type: 'Early go',
                count: punchCountOf('early_go'),
                amount: money2(punchAmountOf('early_go')),
                note: hourNote,
            },
            {
                key: 'mispunch',
                type: 'Missed punch',
                count: punchCountOf('mispunch'),
                amount: punchAmount,
                note: eventPolicyNote(punchCountOf('mispunch'), missedRule, daily),
            },
            {
                key: 'authorized_leave',
                type: 'Authorized leave',
                count: authDays,
                amount: money2(countedRecords.reduce((sum, row) => {
                    if (deductionKind(row) !== 'authorized_leave') return sum;
                    return sum + attendanceDeductionAmount(row, scheduleWeek, daily, policy);
                }, 0)),
                note: authDays
                    ? `${authDays} × ${authTimes} day × ${dayRate}`
                    : `1 authorized day deducts ${authTimes} × ${dayRate}`,
            },
            {
                key: 'unauthorized_leave',
                type: 'Unauthorized leave',
                count: unauthDays,
                amount: money2(unauthDays * unauthTimes * daily),
                note: unauthDays
                    ? `${unauthDays} × ${unauthTimes} day × ${dayRate}`
                    : `1 unauthorized day deducts ${unauthTimes} × ${dayRate}`,
            },
        ];
    }, [countedRecords, profile?.leavePolicy, salaryBasis.daily, scheduleWeek, mispunchAmounts]);
    const deductionDetailRows = useMemo(() => {
        const attendance = attendanceDeductionRows(detailRecords, profile?.leavePolicy || {}, scheduleWeek, salaryBasis.daily);
        const moneyRows = financialDeductionRows({
            fines,
            loans,
            advances,
            utilityItems,
            from: detailWindow.from,
            to: detailWindow.to,
            period,
        });
        const byCategory = (a, b) => {
            const rank = (Number(a.rank) || 0) - (Number(b.rank) || 0);
            if (rank) return rank;
            return String(b.sort || '').localeCompare(String(a.sort || ''));
        };
        return [...attendance.sort(byCategory), ...moneyRows.sort(byCategory)];
    }, [
        detailRecords,
        profile?.leavePolicy,
        scheduleWeek,
        salaryBasis.daily,
        fines,
        loans,
        advances,
        utilityItems,
        detailWindow.from,
        detailWindow.to,
        period,
    ]);
    const deductionHint = spanLoading && period !== 'month'
        ? `Loading ${overtimeRange}`
        : deductionDetailRows.length
          ? `${deductionDetailRows.length} record${deductionDetailRows.length === 1 ? '' : 's'} · ${overtimeRange}`
          : overtimeRange;
    useEffect(() => {
        onDeductionDetails?.({ rows: deductionDetailRows, hint: deductionHint });
    }, [onDeductionDetails, deductionDetailRows, deductionHint]);
    const salaryTableRows = [
        ...deductionRows.map((row) => ({
            ...row,
            type: ({
                'Late in': 'Late In',
                'Late out': 'Early Out',
                'Missed punch': 'Missed Punch',
                'Authorized leave': 'Authorized Leave',
                'Unauthorized leave': 'Unauthorized Leave',
            })[row.type] || row.type,
        })),
        { key: 'fine', type: 'Fine', count: null, amount: fineOutstanding },
        { key: 'utility', type: 'Utility Excess', count: null, amount: utilityOutstanding },
        { key: 'loan_recovery', type: 'Loan Recovery', count: null, amount: loanOutstanding },
        { key: 'advance_recovery', type: 'Advance Recovery', count: null, amount: advanceOutstanding },
    ];
    const deductionTotal = salaryTableRows.reduce((sum, row) => sum + (row.amount == null ? 0 : row.amount), 0);

    const elapsedWorkingDays = countFrom && countTo
        ? days.filter((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            return dateKey >= countFrom && dateKey <= countTo && !offWeekdays.has(WEEKDAY_KEYS[getDay(day)]);
        }).length
        : 0;
    const monthDeduction = deductionRows.reduce((sum, row) => sum + (row.amount == null ? 0 : Number(row.amount) || 0), 0);
    const accumulated = monthlySalary > 0
        ? Math.max(0, money2(salaryBasis.daily * elapsedWorkingDays - monthDeduction))
        : 0;
    const accumulatedPct = monthlySalary > 0 ? Math.round((accumulated / monthlySalary) * 10000) / 100 : 0;

    const pendingRows = Array.isArray(profile?.requests?.pending) ? profile.requests.pending : [];
    const pending = pendingRows.filter((row) =>
        row?.ownRequest !== false &&
        !row?.reassigned &&
        (period === 'month' ? Boolean(row.spanAllMonths) || salaryPrepRowTouchesMonth(row, monthKey) : true),
    );
    const workTasks = Array.isArray(profile?.requests?.workTasks) ? profile.requests.workTasks : [];
    const prepPageCount = Math.max(1, Math.ceil(pending.length / CARD_PAGE_SIZE));
    const taskPageCount = Math.max(1, Math.ceil(workTasks.length / CARD_PAGE_SIZE));
    const prepPageSafe = Math.min(prepPage, prepPageCount);
    const taskPageSafe = Math.min(taskPage, taskPageCount);
    const approvedOtRows = useMemo(
        () => buildApprovedOtRows(monthRecords, monthKey, calendarNotes, countTo),
        [monthRecords, monthKey, calendarNotes, countTo],
    );
    const approvedOtTotal = approvedOtRows.reduce((sum, row) => sum + row.approvedHours, 0);
    const otPageCount = Math.max(1, Math.ceil(approvedOtRows.length / CARD_PAGE_SIZE));
    const otPageSafe = Math.min(otPage, otPageCount);
    const otPageRows = approvedOtRows.slice((otPageSafe - 1) * CARD_PAGE_SIZE, otPageSafe * CARD_PAGE_SIZE);
    const compOffRows = useMemo(
        () => buildCompOffReferenceRows(monthRecords, monthKey),
        [monthRecords, monthKey],
    );
    const compOffPageCount = Math.max(1, Math.ceil(compOffRows.length / CARD_PAGE_SIZE));
    const compOffPageSafe = Math.min(compOffPage, compOffPageCount);
    const compOffPageRows = compOffRows.slice((compOffPageSafe - 1) * CARD_PAGE_SIZE, compOffPageSafe * CARD_PAGE_SIZE);
    const pendingPageRows = pending.slice((prepPageSafe - 1) * CARD_PAGE_SIZE, prepPageSafe * CARD_PAGE_SIZE);
    const taskPageRows = workTasks.slice((taskPageSafe - 1) * CARD_PAGE_SIZE, taskPageSafe * CARD_PAGE_SIZE);
    const oldestMonth = choices[choices.length - 1] || currentMonth;
    const newestMonth = choices[0] || currentMonth;
    const headerRange = (() => {
        if (period === 'year') {
            const year = profile?.year || monthKey.slice(0, 4);
            return `01-Jan-${year} – 31-Dec-${year}`;
        }
        if (period === 'all') {
            return `${formatDayLabel(joinKey)} – ${formatDayLabel(shiftDateKey(todayKey, -1))}`;
        }
        const end = monthEndKey(monthKey);
        return end ? `${formatDayLabel(`${monthKey}-01`)} – ${formatDayLabel(end)}` : formatMonthLabel(monthKey);
    })();
    const headerNote = (() => {
        if (period === 'month' && monthKey === currentMonth) return '(For current month, data up to yesterday)';
        if (period === 'year' && String(profile?.year || monthKey.slice(0, 4)) === todayKey.slice(0, 4)) {
            return '(For current year, data up to yesterday)';
        }
        if (period === 'all') return '(From joining date through yesterday)';
        return '';
    })();

    const nameParts = String(employee.name || '').trim().split(/\s+/);
    const initials = getEmployeeInitials(nameParts[0], nameParts.slice(1).join(' '));
    const isActive = employee.isActive !== false;
    const attendanceSuspending = Boolean(employee.attendanceSuspending);
    const profileBadge = attendanceSuspending ? 'Suspending' : (isActive ? 'Active' : 'Inactive');
    const adjustmentByDate = useMemo(() => buildAdjustmentIndex(monthRecords), [monthRecords]);
    const calendarDays = eachDayOfInterval({
        start: startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 }),
    });
    const calendarCtx = {
        monthKey,
        todayKey,
        recordsByDate,
        salaryLock,
        holidayDates,
        holidayNamesByDate,
        offWeekdays,
        scheduleWeek,
        countFrom,
        countTo,
        salaryDaily: salaryBasis.daily,
        leavePolicy: profile?.leavePolicy || {},
        mispunchAmounts,
        additionPayByDate,
        calendarNotes,
        adjustmentByDate,
        visibleFrom: '',
        pendingRequestsByDate: employeePendingRequests({
            records: monthRecords,
            pending: pendingRows,
            monthKey,
            employeeName: employee.name,
        }),
    };
    const selectedGroupLabel = staffGroups.find((group) => group.key === groupKey)?.label || '';

    function openGroupEmployee(id) {
        setGroupMenuOpen(false);
        if (!id || String(id) === String(employeeMongoId || '')) {
            setGroupKey('');
            return;
        }
        router.push(`/HRM/Leave/${id}`);
    }

    function selectMonth(nextKey) {
        if (!choices.includes(nextKey)) return;
        setMonthKey(nextKey);
        setPeriod('month');
        const nextYear = Number(String(nextKey).slice(0, 4));
        if (nextYear) onYearChange?.(nextYear);
    }

    function shiftMonth(delta) {
        selectMonth(format(addMonths(monthAnchor, delta), 'yyyy-MM'));
    }

    const prevMonthKey = format(addMonths(monthAnchor, -1), 'yyyy-MM');
    const nextMonthKey = format(addMonths(monthAnchor, 1), 'yyyy-MM');
    const identityLine = [employee.employeeId, employee.designation, employee.department]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' | ');

    function openRecords(key) {
        if (key === 'on_leave') {
            onOpenAnnual?.();
            return;
        }
        const keys = key === 'on_office' ? ['on_office', 'work_from_home'] : [key];
        const source = period === 'month' ? countedRecords : profile?.events || [];
        const rows = (source || []).filter((row) => {
            if (key === 'compoff_leave') {
                return String(row?.statusKey || '') === 'compoff_leave' || isNextDayCompOffRow(row);
            }
            if (key === 'late_arrived' || key === 'early_go' || key === 'mispunch' || key === 'unauthorized_leave') {
                return deductionKind(row) === key;
            }
            return keys.includes(String(row?.statusKey || ''));
        }).map((row) => {
            if (key === 'compoff_leave' && String(row?.statusKey || '') !== 'compoff_leave' && isNextDayCompOffRow(row)) {
                return { ...row, statusKey: 'compoff_leave', statusLabel: 'Comp Off Leave' };
            }
            return row;
        });
        onOpenCategory?.(
            key,
            period === 'month' ? rows.flatMap((row) => eventRowsFromRecords([row], row.statusKey)) : rows,
        );
    }

    const todayLocation = locationOf(todayRecord);
    useEffect(() => {
        const saved = todayLocation.label;
        if (saved) {
            setPinnedPlace(saved);
            return undefined;
        }
        if (!todayLocation.hasMap) {
            setPinnedPlace('');
            return undefined;
        }
        const key = `${todayLocation.latitude.toFixed(4)},${todayLocation.longitude.toFixed(4)}`;
        const coords = `${todayLocation.latitude.toFixed(5)}, ${todayLocation.longitude.toFixed(5)}`;
        const cached = placeNameCache.get(key);
        if (cached) {
            setPinnedPlace(cached);
            return undefined;
        }
        let cancelled = false;
        setPinnedPlace(coords);
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${todayLocation.latitude}&longitude=${todayLocation.longitude}&localityLanguage=en`)
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                const place = placeFromGeocode(data) || coords;
                placeNameCache.set(key, place);
                if (!cancelled) setPinnedPlace(place);
            })
            .catch(() => {
                placeNameCache.set(key, coords);
                if (!cancelled) setPinnedPlace(coords);
            });
        return () => {
            cancelled = true;
        };
    }, [todayLocation.label, todayLocation.hasMap, todayLocation.latitude, todayLocation.longitude]);
    const locationText = todayLocation.label || pinnedPlace || '—';
    const todayIn = todayRecord?.timeIn;
    const todaySuspended = String(todayRecord?.statusKey || '') === 'suspended' || Boolean(todayRecord?.attendanceSuspended) || attendanceSuspending;
    const todayOut = todayRecord?.timeOut;
    const openMinutes = !todayOut && clockToMinutes(todayIn) != null
        ? Math.max(0, (dubaiNowMinutes() ?? 0) - clockToMinutes(todayIn))
        : null;
    const todayWorked = todayIn ? workedMinutes(todayIn, todayOut) ?? openMinutes : null;

    return (
        <div className="space-y-3">
            <section className="relative z-20 rounded-xl border border-[#E6EDF5] bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex min-w-0 items-center gap-3">
                        {employee.profilePicture ? (
                            <img src={employee.profilePicture} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-[18px] font-bold text-[#1D4ED8]">
                                {initials}
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <EmployeeProfileSwitcher employeeMongoId={employeeMongoId} name={employee.name} />
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${attendanceSuspending ? 'bg-slate-200 text-slate-700' : isActive ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-slate-100 text-slate-500'}`}>
                                    {profileBadge}
                                </span>
                            </div>
                            <p className="mt-0.5 truncate text-[12px] font-medium leading-tight text-[#64748B]">
                                {identityLine || '—'}
                            </p>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
                        {[
                            { icon: CalendarDays, label: 'Joining Date', value: formatDayLabel(joinKey) },
                            { icon: UserRound, label: 'Reporting Manager', value: employee.reportsTo || '—' },
                            { icon: Briefcase, label: 'Employment Type', value: employmentTypeLabel(employee.status) },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center gap-2">
                                <item.icon size={16} strokeWidth={1.75} className="shrink-0 text-[#94A3B8]" />
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium leading-tight text-[#94A3B8]">{item.label}</p>
                                    <p className="truncate text-[13px] font-semibold leading-tight text-[#1B2A4A]">{item.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="ml-auto flex items-start gap-4">
                        <div ref={groupMenuRef} className="relative">
                            <p className="mb-1 text-[12px] font-medium leading-none text-[#64748B]">Group</p>
                            <button
                                type="button"
                                onClick={() => setGroupMenuOpen((open) => !open)}
                                aria-expanded={groupMenuOpen}
                                aria-haspopup="listbox"
                                className="flex h-8 min-w-[10.5rem] items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[13px] font-semibold text-[#1B2A4A]"
                            >
                                <span className="truncate">{staffGroups.find((group) => group.key === groupKey)?.label || 'Select group'}</span>
                                <ChevronDown size={14} className={`shrink-0 text-[#64748B] transition-transform ${groupMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {groupMenuOpen ? (
                                <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-[#E6EDF5] bg-white py-1 shadow-xl">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setGroupKey('');
                                            setGroupMenuOpen(false);
                                        }}
                                        className={`flex w-full px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#F8FAFC] ${groupKey ? 'text-[#64748B]' : 'bg-[#EFF6FF] text-[#2563EB]'}`}
                                    >
                                        Current profile
                                    </button>
                                    {staffGroups.length ? staffGroups.map((group) => (
                                        <button
                                            key={group.key}
                                            type="button"
                                            onClick={() => {
                                                setGroupKey(group.key);
                                                setGroupMenuOpen(false);
                                            }}
                                            className={`flex w-full px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#F8FAFC] ${groupKey === group.key ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#1B2A4A]'}`}
                                        >
                                            {group.label}
                                        </button>
                                    )) : (
                                        <p className="px-3 py-2 text-[13px] text-[#94A3B8]">No groups</p>
                                    )}
                                </div>
                            ) : null}
                        </div>
                        <div>
                            <p className="mb-1 text-[12px] font-medium leading-none text-[#64748B]">Period</p>
                            <div className="inline-flex rounded-lg bg-[#F1F5F9] p-0.5">
                                {[
                                    { id: 'month', label: 'Monthly' },
                                    { id: 'year', label: 'Yearly' },
                                    { id: 'all', label: 'All Time' },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setPeriod(item.id)}
                                        className={`h-8 rounded-md px-3 text-[13px] font-semibold ${period === item.id ? 'bg-[#2563EB] text-white' : 'text-[#64748B]'}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="mb-1 text-[12px] font-medium leading-none text-[#64748B]">Month</p>
                            <div className="flex items-center gap-1.5">
                                <div className="relative">
                                    <MonthPicker
                                        value={choices.includes(monthKey) ? monthKey : newestMonth}
                                        onChange={selectMonth}
                                        minMonth={oldestMonth}
                                        maxMonth={newestMonth}
                                        fromYear={Number(oldestMonth.slice(0, 4))}
                                        toYear={Number(newestMonth.slice(0, 4))}
                                        placeholder="Select month"
                                        className="h-8 w-auto min-w-[10.5rem] gap-1.5 rounded-lg border-[#E2E8F0] bg-white px-2.5 pr-7 text-[13px] font-semibold text-[#1B2A4A] shadow-none hover:bg-white [&_svg]:mr-0 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-[#64748B]"
                                    />
                                    <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => shiftMonth(-1)}
                                    disabled={!choices.includes(prevMonthKey)}
                                    aria-label="Previous month"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => shiftMonth(1)}
                                    disabled={!choices.includes(nextMonthKey)}
                                    aria-label="Next month"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                            <p className="mt-1 text-right text-[11px] font-medium leading-tight text-[#64748B]">{headerRange}</p>
                            {headerNote ? (
                                <p className="text-right text-[11px] font-medium leading-tight text-[#94A3B8]">{headerNote}</p>
                            ) : null}
                            {period === 'all' && allTimeLoading ? (
                                <p className="text-right text-[11px] font-medium leading-tight text-[#94A3B8]">Loading…</p>
                            ) : null}
                            {allTimeNote ? (
                                <p className="text-right text-[11px] font-medium leading-tight text-[#94A3B8]">{allTimeNote}</p>
                            ) : null}
                        </div>
                        <div className="mt-4 flex items-center gap-1.5">
                            <button type="button" onClick={onOpenSalary} className="h-8 rounded-lg border border-[#E2E8F0] px-2.5 text-[13px] font-semibold text-[#64748B]">
                                Salary setup
                            </button>
                            <button type="button" onClick={onDownload} className="h-8 rounded-lg border border-[#E2E8F0] px-2.5 text-[13px] font-semibold text-[#64748B]">
                                Report
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {groupKey ? (
                <GroupAttendanceBoard
                    groupKey={groupKey}
                    groupLabel={selectedGroupLabel || 'Group'}
                    monthKey={monthKey}
                    holidayRows={holidayRows}
                    leavePolicy={profile?.leavePolicy || {}}
                    onOpenEmployee={openGroupEmployee}
                />
            ) : (
            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-3">
                    <section className="relative rounded-2xl border border-[#E6EDF5] bg-white p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EEF2FF] text-[#4F46E5]">
                                    <Users size={15} />
                                </span>
                                <h2 className="truncate text-[15px] font-bold text-[#1B2A4A]">Attendance & Leave Summary</h2>
                            </div>
                            <span className="shrink-0 text-[13px] font-semibold text-[#2563EB]">
                                {period === 'month' ? formatMonthLabel(monthKey) : period === 'year' ? `Year ${profile?.year || ''}` : 'All time'}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 items-start gap-2">
                            <SummaryCard icon={Plane} iconClass="bg-[#EDE9FE] text-[#7C3AED]" title="Annual Leave" onClick={() => openRecords('on_leave')}>
                                <SplitStats
                                    items={[
                                        { label: 'Applied', value: showValue(activeStats.annual.requested) },
                                        { label: 'Approved', value: showValue(activeStats.annual.approved) },
                                        { label: 'Used', value: showValue(activeStats.annual.used) },
                                    ]}
                                />
                            </SummaryCard>
                            <SummaryCard icon={Plus} iconClass="bg-[#22C55E] text-white" rounded="rounded-full" title="Sick Leave" onClick={() => openRecords('sick_leave')}>
                                <SplitStats
                                    items={[
                                        { label: 'Used', value: showValue(activeStats.sick.used) },
                                        { label: 'Remaining', value: sickRemaining },
                                    ]}
                                />
                            </SummaryCard>
                            <SummaryCard icon={Clock} iconClass="bg-[#DBEAFE] text-[#2563EB]" rounded="rounded-full" title="Comp Off" onClick={() => openRecords('compoff_leave')}>
                                <SplitStats
                                    items={[
                                        { label: 'Pending', value: showValue(activeStats.compoffPending) },
                                        { label: 'Available', value: compoffBalance },
                                    ]}
                                />
                            </SummaryCard>
                            <SummaryCard icon={X} iconClass="bg-[#FEE2E2] text-[#EF4444]" title="Unauthorized Leave" onClick={() => openRecords('unauthorized_leave')}>
                                <FigureLine
                                    value={showValue(activeStats.unauthorized.used)}
                                    singular="Day"
                                    plural="Days"
                                    noteValue={showValue(eventCount(activeStats.unauthorized))}
                                    noteSingular="Event"
                                    notePlural="Events"
                                />
                            </SummaryCard>
                            <SummaryCard icon={CalendarDays} iconClass="bg-[#DBEAFE] text-[#2563EB]" title="Authorized Leave" onClick={() => openRecords('authorized_leave')}>
                                <FigureLine
                                    value={showValue(activeStats.authorized.used)}
                                    singular="Day"
                                    plural="Days"
                                    noteValue={showValue(eventCount(activeStats.authorized))}
                                    noteSingular="Event"
                                    notePlural="Events"
                                />
                            </SummaryCard>
                            <SummaryCard icon={Clock} iconClass="bg-[#FEF3C7] text-[#F59E0B]" title="Late In" onClick={() => openRecords('late_arrived')}>
                                <FigureLine
                                    value={showValue(activeStats.lateIn)}
                                    singular="Event"
                                    plural="Events"
                                    noteValue={showValue(attendanceMinutes.late)}
                                    noteSingular="Minute"
                                    notePlural="Minutes"
                                />
                            </SummaryCard>
                            <SummaryCard icon={LogOut} iconClass="bg-[#FFE4E6] text-[#F43F5E]" title="Early Out" onClick={() => openRecords('early_go')}>
                                <FigureLine
                                    value={showValue(activeStats.earlyOut)}
                                    singular="Event"
                                    plural="Events"
                                    noteValue={showValue(attendanceMinutes.early)}
                                    noteSingular="Minute"
                                    notePlural="Minutes"
                                />
                            </SummaryCard>
                            <SummaryCard icon={Fingerprint} iconClass="bg-[#FFEDD5] text-[#F97316]" title="Missed Punch" onClick={() => openRecords('mispunch')}>
                                <FigureLine
                                    value={showValue(activeStats.missed)}
                                    singular="Event"
                                    plural="Events"
                                />
                            </SummaryCard>
                            <SummaryCard icon={Check} iconClass="bg-[#DCFCE7] text-[#16A34A]" title="Present" onClick={() => openRecords('on_office')}>
                                <FigureLine
                                    value={showValue(n(activeStats.present) + n(activeStats.wfh))}
                                    singular="Day"
                                    plural="Days"
                                />
                            </SummaryCard>
                            {todayLocation.mapHref ? (
                                <a
                                    href={todayLocation.mapHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="col-span-2 flex items-center gap-2.5 rounded-xl border border-[#E8EEF5] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                                >
                                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${todayIn ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                                        <CalendarCheck size={18} strokeWidth={2.25} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[12px] font-semibold leading-tight text-[#1B2A4A]">Current Attendance (Today)</span>
                                        <span className="mt-0.5 block text-[13px] font-bold leading-tight text-[#1B2A4A]">
                                            {todaySuspended ? 'Suspended account' : todayIn ? `Checked In – ${formatClock12(todayIn)}` : 'No punch yet'}
                                        </span>
                                        <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-[#64748B]">
                                            Working Duration: {todayIn ? formatDuration(todayWorked) : '—'} | Location: {locationText}
                                        </span>
                                    </span>
                                    <ChevronRight size={16} className="shrink-0 text-[#94A3B8]" />
                                </a>
                            ) : (
                                <div className="col-span-2 flex items-center gap-2.5 rounded-xl border border-[#E8EEF5] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${todayIn ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                                        <CalendarCheck size={18} strokeWidth={2.25} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-semibold leading-tight text-[#1B2A4A]">Current Attendance (Today)</p>
                                        <p className="mt-0.5 text-[13px] font-bold leading-tight text-[#1B2A4A]">
                                            {todaySuspended ? 'Suspended account' : todayIn ? `Checked In – ${formatClock12(todayIn)}` : 'No punch yet'}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-[#64748B]">
                                            Working Duration: {todayIn ? formatDuration(todayWorked) : '—'} | Location: {locationText}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="shrink-0 text-[#94A3B8]" />
                                </div>
                            )}
                            <SummaryCard icon={UserRound} iconClass="bg-[#FEE2E2] text-[#EF4444]" title="Absent">
                                <FigureLine
                                    value={activeStats.absent == null || statsLocked ? '—' : activeStats.absent}
                                    singular="Day"
                                    plural="Days"
                                />
                            </SummaryCard>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[#E6EDF5] bg-white p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3B82F6] text-white">
                                    <Coins size={13} strokeWidth={2.4} />
                                </span>
                                <h2 className="truncate text-[15px] font-bold text-[#1B2A4A]">Salary & Financial Details</h2>
                            </div>
                            <span className="shrink-0 text-[13px] font-medium text-[#64748B]">{formatMonthLabel(monthKey)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={onOpenPayroll} className="flex items-center gap-2 rounded-xl bg-[#EAF3FF] px-2.5 py-2 text-left">
                                <Coins size={22} strokeWidth={2.1} className="shrink-0 text-[#2563EB]" />
                                <span className="min-w-0">
                                    <span className="block text-[11px] font-medium leading-none text-[#64748B]">Monthly Salary</span>
                                    <span className="mt-1 block text-[18px] font-bold leading-none tabular-nums text-[#1B2A4A]">{formatAed(monthlySalary)}</span>
                                </span>
                            </button>
                            <div className="flex items-start gap-2 rounded-xl bg-[#F0FDF4] px-2.5 py-2">
                                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#22C55E]">
                                    <BarChart3 size={15} strokeWidth={2.4} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold leading-none text-[#1B2A4A]">Current Accumulated Salary</p>
                                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                                        <div
                                            className="h-full rounded-full bg-[#4ADE80]"
                                            style={{ width: `${monthlySalary > 0 ? Math.min(100, Math.max(0, accumulatedPct)) : 0}%` }}
                                        />
                                    </div>
                                    <div className="mt-1 flex items-baseline justify-between gap-2">
                                        <p className="truncate text-[12px] font-bold tabular-nums text-[#1B2A4A]">
                                            {monthlySalary > 0 ? `${formatAed(accumulated, 2)} / ${formatAed(monthlySalary)}` : '—'}
                                        </p>
                                        <p className="shrink-0 text-[12px] font-medium tabular-nums text-[#64748B]">
                                            {monthlySalary > 0 ? `${accumulatedPct.toFixed(2)}%` : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="flex flex-col rounded-xl border border-[#E7EEF6] bg-white px-2.5 py-2">
                                <p className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-[#1B2A4A]">
                                    <BarChart3 size={12} className="text-[#2563EB]" /> Last Increment
                                </p>
                                <div className="mt-1.5 space-y-1 text-[10px] leading-snug">
                                    <p className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Previous Salary</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{increment?.fromTotal ? formatAed(increment.fromTotal) : '—'}</span></p>
                                    <p className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Increment</span><span className="shrink-0 font-semibold tabular-nums text-[#16A34A]">{increment?.amount ? formatAed(increment.amount) : formatAed(0)}</span></p>
                                    <p className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">New Salary</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{increment?.toTotal ? formatAed(increment.toTotal) : formatAed(n(salary.monthlySalary) || n(salary.totalSalary))}</span></p>
                                    <p className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Effective Date</span><span className="shrink-0 font-semibold text-[#1B2A4A]">{increment?.dateLabel || '—'}</span></p>
                                </div>
                                <button type="button" onClick={() => onOpenFinancial?.('increment')} className="mt-auto inline-flex items-center self-end pt-1 text-[10px] font-semibold text-[#2563EB]">
                                    View History <ChevronRight size={12} />
                                </button>
                            </div>
                            <div className="rounded-xl border border-[#E7EEF6] bg-white px-2.5 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold leading-tight text-[#1B2A4A]">Financial Obligations</p>
                                    <button type="button" onClick={onOpenPayroll} className="inline-flex items-center text-[10px] font-semibold text-[#2563EB]">
                                        View Details <ChevronRight size={12} />
                                    </button>
                                </div>
                                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                    <button type="button" onClick={() => onOpenFinancial?.('advance')} className="flex flex-col rounded-lg bg-[#F5F3FF] px-2 py-1.5 text-left">
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#8B5CF6] text-white">
                                                <Wallet size={10} strokeWidth={2.3} />
                                            </span>
                                            <span className="text-[10px] font-semibold leading-tight text-[#1B2A4A]">Salary Advance</span>
                                        </span>
                                        <span className="mt-1 space-y-0.5 text-[10px] leading-snug">
                                            <span className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Total:</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAedNumber(advanceTotal)}</span></span>
                                            <span className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Paid:</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAedNumber(advancePaid)}</span></span>
                                            <span className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Pending:</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAedNumber(advanceOutstanding)}</span></span>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('loan')} className="flex flex-col rounded-lg bg-[#FEF2F2] px-2 py-1.5 text-left">
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#EF4444] text-white">
                                                <UserRound size={10} strokeWidth={2.3} />
                                            </span>
                                            <span className="text-[10px] font-semibold leading-tight text-[#1B2A4A]">Loan</span>
                                        </span>
                                        <span className="mt-1 space-y-0.5 text-[10px] leading-snug">
                                            <span className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Total:</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAedNumber(loanTotal)}</span></span>
                                            <span className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Recovered:</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAedNumber(loanPaid)}</span></span>
                                            <span className="flex items-baseline justify-between gap-2"><span className="text-[#64748B]">Pending:</span><span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAedNumber(loanOutstanding)}</span></span>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('fines')} className="flex flex-col rounded-lg bg-[#FFF7ED] px-2 py-1.5 text-left">
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#F59E0B] text-white">
                                                <AlertTriangle size={10} strokeWidth={2.3} />
                                            </span>
                                            <span className="text-[10px] font-semibold leading-tight text-[#1B2A4A]">Outstanding Fines</span>
                                        </span>
                                        <span className="mt-1 flex items-baseline justify-between gap-2 text-[10px] leading-snug">
                                            <span className="text-[#64748B]">Amount:</span>
                                            <span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAed(fineOutstanding)}</span>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('utility')} className="flex flex-col rounded-lg bg-[#EFF6FF] px-2 py-1.5 text-left">
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#3B82F6] text-white">
                                                <Zap size={10} strokeWidth={2.3} />
                                            </span>
                                            <span className="text-[10px] font-semibold leading-tight text-[#1B2A4A]">Utility Excess</span>
                                        </span>
                                        <span className="mt-1 flex items-baseline justify-between gap-2 text-[10px] leading-snug">
                                            <span className="text-[#64748B]">Amount:</span>
                                            <span className="shrink-0 font-semibold tabular-nums text-[#1B2A4A]">{formatAed(utilityOutstanding)}</span>
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#8B5CF6] text-white">
                                <Gift size={13} strokeWidth={2.3} />
                            </span>
                            <p className="text-[13px] font-bold text-[#1B2A4A]">Rewards & Overtime</p>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => onOpenFinancial?.('rewards')} className="flex items-start gap-2 rounded-xl border border-[#E7EEF6] bg-white px-2.5 py-2 text-left">
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6] text-white">
                                    <Gift size={15} strokeWidth={2.2} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[11px] font-medium leading-none text-[#64748B]">Rewards Earned</span>
                                    <span className="mt-1 block text-[16px] font-bold leading-none tabular-nums text-[#1B2A4A]">{formatAed(rewardAmount)}</span>
                                    <span className="mt-1 block text-[11px] leading-tight text-[#64748B]">Date: <span className="font-medium text-[#1B2A4A]">{rewardLead?.dateLabel || '—'}</span></span>
                                    <span className="block text-[11px] text-[#64748B]">Reason: <span className="font-medium text-[#1B2A4A]">{rewardLead?.type || (rewardAmount ? 'Reward' : `None in ${monthRewardLabel}`)}</span></span>
                                </span>
                            </button>
                        </div>
                        {isFlexibleWeek(scheduleWeek) ? (
                        <div className="mt-2 overflow-hidden rounded-xl border border-[#E7EEF6]">
                            <div className="px-3 pt-2.5">
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Salary Addition</p>
                            </div>
                            <div className="px-3 pb-2 pt-1.5">
                                <AdditionWeekSelect
                                    id="salary-addition-week"
                                    weeks={additionChoices}
                                    value={additionWeek?.id}
                                    onChange={setAdditionWeekId}
                                />
                                {additionWeek && countTo && additionWeek.to > countTo ? (
                                    <p className="mt-1 text-[11px] font-medium text-[#64748B]">
                                        {additionWeek.from > countTo ? 'Not counted yet' : `Counts through ${formatDayLabel(countTo)}`}
                                    </p>
                                ) : null}
                            </div>
                            <AdditionPayBoxes
                                ready={additionReady}
                                pay={salaryAddition.balancePay}
                                onOpen={setAdditionModal}
                            />
                        </div>
                        ) : null}
                        <div className="mt-2 overflow-hidden rounded-xl border border-[#E7EEF6]">
                            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                <p className="text-[13px] font-bold text-[#1B2A4A]">Salary Deduction for {formatMonthLabel(monthKey)}</p>
                                <button
                                    type="button"
                                    onClick={() => onOpenFinancial?.('deductions', {
                                        rows: deductionDetailRows,
                                        hint: deductionHint,
                                    })}
                                    className="inline-flex shrink-0 items-center text-[12px] font-semibold text-[#2563EB]"
                                >
                                    View Calculation Details <ChevronRight size={14} />
                                </button>
                            </div>
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-t border-[#EEF2F6]">
                                        <th className={`${TH} w-8`}>#</th>
                                        <th className={TH}>Deduction Type</th>
                                        <th className={TH}>Count / Days</th>
                                        <th className="whitespace-nowrap px-2.5 py-2 text-right text-[11px] font-medium text-[#94A3B8]">Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salaryTableRows.map((row, index) => {
                                        const leaveRow = row.key === 'authorized_leave' || row.key === 'unauthorized_leave';
                                        const countText = salaryLock.locked
                                            ? '—'
                                            : row.count == null || row.count === ''
                                              ? '—'
                                              : leaveRow
                                                ? (Number(row.count) ? `${Number(row.count).toFixed(1)} ${Number(row.count) === 1 ? 'Day' : 'Days'}` : '—')
                                                : row.count;
                                        return (
                                            <tr key={row.key} className="border-t border-[#F4F7FB]">
                                                <td className={`${TD} text-[#94A3B8]`}>{index + 1}</td>
                                                <td className={TD}>{row.type}</td>
                                                <td className={`${TD} tabular-nums`}>{countText}</td>
                                                <td className={`${TD} text-right font-medium tabular-nums`}>
                                                    {salaryLock.locked ? '—' : formatAedNumber(row.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="border-t border-[#E2E8F0]">
                                        <td className={`${TD} font-bold`} colSpan={3}>Total Deduction</td>
                                        <td className={`${TD} text-right font-bold tabular-nums text-[#DC2626]`}>{salaryLock.locked ? '—' : formatAedNumber(deductionTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                    <section className="relative rounded-2xl border border-[#E6EDF5] bg-white px-4 py-[14px]">
                        <style>{`
                            @keyframes attendance-request-blink {
                                0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                                45% { opacity: 0.35; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.45); }
                                70% { opacity: 1; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                            }
                            .attendance-request-blink {
                                animation: attendance-request-blink 2.4s ease-in-out infinite;
                            }
                            @media (prefers-reduced-motion: reduce) {
                                .attendance-request-blink {
                                    animation: none;
                                    box-shadow: inset 0 0 0 2px rgba(220, 38, 38, 0.75);
                                }
                            }
                        `}</style>
                        <div className="mb-2.5 flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#2563EB]">
                                <CalendarDays size={16} strokeWidth={2.25} />
                            </span>
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Attendance Calendar</h2>
                        </div>
                        {monthError ? (
                            <button type="button" onClick={loadMonth} className="py-6 text-[12px] text-red-500">{monthError} · Retry</button>
                        ) : monthLoading ? (
                            <p className="py-6 text-center text-[12px] text-[#94A3B8]">Loading calendar…</p>
                        ) : (
                            <>
                                <div className="relative mb-2.5 flex h-9 items-center justify-center">
                                    <div className="inline-flex h-9 items-center rounded-lg border border-[#E6EDF5] bg-white">
                                        <button type="button" onClick={() => shiftMonth(-1)} className="inline-flex h-9 w-9 items-center justify-center text-[#64748B]" aria-label="Previous month"><ChevronLeft size={16} /></button>
                                        <span className="min-w-[8rem] text-center text-[14px] font-semibold text-[#1B2A4A]">{formatMonthLabel(monthKey)}</span>
                                        <button type="button" onClick={() => shiftMonth(1)} className="inline-flex h-9 w-9 items-center justify-center text-[#64748B]" aria-label="Next month"><ChevronRight size={16} /></button>
                                    </div>
                                    <button type="button" onClick={() => selectMonth(currentMonth)} className="absolute right-0 h-9 rounded-lg border border-[#E6EDF5] bg-white px-3 text-[13px] font-semibold text-[#2563EB]">Today</button>
                                </div>
                                <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 grid grid-cols-7 gap-x-[7px]">
                                        {WEEKDAYS.map((day) => (
                                            <div key={day} className="text-center text-[11px] font-medium text-[#94A3B8]">{day}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-x-[7px] gap-y-[7px]">
                                        {calendarDays.map((day) => (
                                            <AttendanceDayCell
                                                key={format(day, 'yyyy-MM-dd')}
                                                day={day}
                                                ctx={calendarCtx}
                                                hoveredDate={hoveredDate}
                                                setHoveredDate={setHoveredDate}
                                                markTarget={{
                                                    employeeId: employeeMongoId,
                                                    staffType,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="w-[9.5rem] shrink-0 space-y-1.5 pt-1">
                                    <p className="text-[13px] font-semibold text-[#64748B]">Legend</p>
                                    {LEGEND.map((item) => (
                                        <span key={item.key} className="flex items-center gap-1.5 text-[11px] leading-tight text-[#64748B]">
                                            <span className={`h-2 w-2 shrink-0 rounded-full ${item.swatch}`} />
                                            {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            </>
                        )}
                        <DashboardSalaryEnrollLock {...salaryLock} />
                    </section>

                    <section className="rounded-2xl border border-[#E6EDF5] bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <h2 className="text-[14px] font-bold text-[#1B2A4A]">
                                Leave Details ({period === 'month' ? formatMonthLabel(monthKey) : period === 'year' ? profile?.year || '' : 'All time'})
                            </h2>
                            <button type="button" onClick={onOpenLeaveList} className="inline-flex shrink-0 items-center text-[12px] font-semibold text-[#2563EB]">
                                View Leave History <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <LeaveBox tone="bg-[#F3F0FF]" iconBg="bg-[#8B5CF6]" icon={Plane} title="Annual Leave" columns="grid-cols-4">
                                <LeaveStat label="Requested" value={showValue(activeStats.annual.requested)} />
                                <LeaveStat label="Approved" value={showValue(activeStats.annual.approved)} />
                                <LeaveStat label="Used" value={showValue(activeStats.annual.used)} />
                                <LeaveStat label="Balance" value={annualBalance} accent />
                            </LeaveBox>
                            <LeaveBox tone="bg-[#EEF4FF]" iconBg="bg-[#3B82F6]" icon={CalendarDays} title="Authorized Leave" columns="grid-cols-3">
                                <LeaveStat label="Requested" value={showValue(activeStats.authorized.requested)} />
                                <LeaveStat label="Approved" value={showValue(activeStats.authorized.approved)} />
                                <LeaveStat label="Used" value={showValue(activeStats.authorized.used)} />
                            </LeaveBox>
                            <LeaveBox tone="bg-[#ECFDF3]" iconBg="bg-[#22C55E]" icon={Plus} title="Sick Leave" columns="grid-cols-4">
                                <LeaveStat label="Requested" value={showValue(activeStats.sick.requested)} />
                                <LeaveStat label="Approved" value={showValue(activeStats.sick.approved)} />
                                <LeaveStat label="Used" value={showValue(activeStats.sick.used)} />
                                <LeaveStat label="Balance" value={sickRemaining} accent />
                            </LeaveBox>
                            <LeaveBox tone="bg-[#F0FDFA]" iconBg="bg-[#2DD4BF]" icon={Clock} title="Comp Off" columns="grid-cols-4">
                                <LeaveStat label="Earned" value={showValue(compoffEarned)} />
                                <LeaveStat label="Used" value={showValue(activeStats.compoffUsed)} />
                                <LeaveStat label="Balance" value={compoffBalance} accent />
                                <LeaveStat label="Pending" value={showValue(activeStats.compoffPending)} />
                            </LeaveBox>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-[#FECACA] bg-white">
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-1 bg-[#FEF2F2] px-4 py-3">
                            <p className="flex items-center gap-2 text-[14px] font-bold text-[#991B1B]">
                                <AlertTriangle size={16} strokeWidth={2.4} className="shrink-0 text-[#EF4444]" />
                                Salary Preparation Status
                            </p>
                            {pending.length ? (
                                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#EF4444]">
                                    <AlertTriangle size={14} strokeWidth={2.4} className="shrink-0" />
                                    Salary Processing Blocked — {pending.length} Pending Item{pending.length === 1 ? '' : 's'}
                                </p>
                            ) : (
                                <p className="text-[13px] font-semibold text-[#16A34A]">Clear</p>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#EEF2F6]">
                                        <th className={`${TH} w-10`}>#</th>
                                        <th className={TH}>Pending Item</th>
                                        <th className={TH}>Reference</th>
                                        <th className={TH}>Date</th>
                                        <th className={TH}>Responsible User</th>
                                        <th className={TH}>Status</th>
                                        <th className={`${TH} w-[7.5rem]`}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingPageRows.length ? pendingPageRows.map((row, index) => {
                                        const statusLabel = prepStatusLabel(row);
                                        const takeAction = /pending|waiting|await|review/i.test(statusLabel);
                                        const href = String(row?.href || '').trim();
                                        return (
                                            <tr key={row.id} className="border-b border-[#F4F7FB] last:border-0">
                                                <td className={`${TD} text-[#94A3B8]`}>{(prepPageSafe - 1) * CARD_PAGE_SIZE + index + 1}</td>
                                                <td className={`${TD} truncate font-medium`}>{row.title}</td>
                                                <td className={`${TD} truncate`}>{row.subtitle || '—'}</td>
                                                <td className={`${TD} whitespace-nowrap`}>{row.dateLabel || '—'}</td>
                                                <td className={`${TD} truncate`}>{row.owner || '—'}</td>
                                                <td className={TD}><TableTone label={statusLabel} /></td>
                                                <td className={TD}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (href) {
                                                                router.push(href);
                                                                return;
                                                            }
                                                            onOpenLeaveList?.();
                                                        }}
                                                        className={takeAction ? SOLID_BTN : OUTLINE_BTN}
                                                    >
                                                        {takeAction ? 'Take Action' : 'View Task'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={7} className="px-3 py-3 text-[13px] text-[#94A3B8]">No pending items.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <CardPageBar
                            page={prepPageSafe}
                            pageCount={prepPageCount}
                            total={pending.length}
                            onPage={setPrepPage}
                        />
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white">
                        <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] px-4 py-3">
                            <p className="text-[14px] font-bold text-[#1B2A4A]">Pending Tasks</p>
                            <Link href={employeeTaskListHref(employee.name)} className="inline-flex shrink-0 items-center text-[13px] font-semibold text-[#2563EB]">
                                View All Tasks <ChevronRight size={16} />
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#EEF2F6]">
                                        <th className={`${TH} w-[7.5rem]`}>Task No</th>
                                        <th className={TH}>Task Type</th>
                                        <th className={TH}>Requester</th>
                                        <th className={TH}>Requested Date</th>
                                        <th className={TH}>Due Date</th>
                                        <th className={`${TH} w-[6.5rem]`}>Status</th>
                                        <th className={`${TH} w-[4.5rem]`}>Open</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {taskPageRows.length ? taskPageRows.map((task) => {
                                        const href = employeeTaskDetailsHref(task);
                                        return (
                                            <tr key={task.actionId || task.taskNumber} className="border-b border-[#F4F7FB] last:border-0">
                                                <td className={`${TD} whitespace-nowrap font-medium`}>{task.taskNumber || '—'}</td>
                                                <td className={TD}>
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${employeeTaskTypeClass(task.taskType)}`}>
                                                        {task.taskType || '—'}
                                                    </span>
                                                </td>
                                                <td className={`${TD} max-w-[10rem] truncate`}>{task.requesterName || '—'}</td>
                                                <td className={`${TD} whitespace-nowrap`}>{task.requestedDate || '—'}</td>
                                                <td className={`${TD} whitespace-nowrap`}>{task.dueDate || '—'}</td>
                                                <td className={TD}>
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${employeeTaskStatusClass(task.status)}`}>
                                                        {task.status || 'Pending'}
                                                    </span>
                                                </td>
                                                <td className={TD}>
                                                    {href ? (
                                                        <Link
                                                            href={href}
                                                            onClick={(event) => handleNavigateFromListClick(
                                                                event,
                                                                router,
                                                                href,
                                                                `${window.location.pathname}${window.location.search}`,
                                                            )}
                                                            className={OUTLINE_BTN}
                                                        >
                                                            Open
                                                        </Link>
                                                    ) : (
                                                        <span className="text-[13px] text-[#94A3B8]">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={7} className="px-3 py-3 text-[13px] text-[#94A3B8]">No pending tasks for this employee.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <CardPageBar
                            page={taskPageSafe}
                            pageCount={taskPageCount}
                            total={workTasks.length}
                            onPage={setTaskPage}
                        />
                    </section>

                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E6EDF5] bg-white px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><CalendarDays size={18} strokeWidth={2.25} /></span>
                            <div className="min-w-0">
                                <p className="text-[14px] font-bold leading-tight text-[#1B2A4A]">Annual Attendance Calendar</p>
                                <p className="mt-0.5 truncate text-[12px] leading-tight text-[#94A3B8]">View full year attendance with monthly breakdown and summary statistics.</p>
                            </div>
                        </div>
                        <Link href={annualCalendarHref || '/HRM/Leave/annual-leave'} className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[#2563EB] px-3.5 text-[13px] font-semibold text-white">
                            View Annual Calendar
                        </Link>
                    </div>

                    <section className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white">
                        <div className="border-b border-[#EEF2F6] px-4 py-3">
                            <p className="text-[14px] font-bold text-[#1B2A4A]">
                                OT reference ({monthLoading ? '…' : formatHourMeasure(approvedOtTotal)} approved)
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#94A3B8]">
                                Approved overtime in {formatMonthLabel(monthKey)}. When it covers a leave, the date is that leave day.
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-x-auto">
                            <table className="w-full min-w-[720px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#EEF2F6]">
                                        <th className={TH}>Date</th>
                                        <th className={TH}>Time In</th>
                                        <th className={TH}>Time Out</th>
                                        <th className={TH}>Total hrs worked</th>
                                        <th className={TH}>OT approved hours</th>
                                        <th className={`${TH} w-[5.5rem]`}>View</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-6 text-center text-[13px] text-[#94A3B8]">
                                                Loading overtime…
                                            </td>
                                        </tr>
                                    ) : otPageRows.length ? otPageRows.map((row) => (
                                        <tr key={row.id} className="border-b border-[#F4F7FB] last:border-0">
                                            <td className={`${TD} whitespace-nowrap font-medium`}>{row.dateLabel}</td>
                                            <td className={`${TD} whitespace-nowrap`}>{row.timeIn}</td>
                                            <td className={`${TD} whitespace-nowrap`}>
                                                <NextDayCheckoutTime time={row.timeOut} nextDay={row.timeOutNextDay} />
                                            </td>
                                            <td className={`${TD} whitespace-nowrap tabular-nums`}>{row.workedLabel}</td>
                                            <td className={`${TD} whitespace-nowrap font-semibold tabular-nums text-[#16A34A]`}>{row.approvedLabel}</td>
                                            <td className={TD}>
                                                <button
                                                    type="button"
                                                    onClick={() => setOtView(row)}
                                                    className={OUTLINE_BTN}
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-6 text-[13px] text-[#94A3B8]">
                                                No approved overtime in {formatMonthLabel(monthKey)}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <CardPageBar
                            page={otPageSafe}
                            pageCount={otPageCount}
                            total={approvedOtRows.length}
                            onPage={setOtPage}
                        />
                    </section>

                    <section className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white">
                        <div className="border-b border-[#EEF2F6] px-4 py-3">
                            <p className="text-[14px] font-bold text-[#1B2A4A]">
                                Comp off reference ({monthLoading ? '…' : dayCountLabel(compOffRows.length)})
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#94A3B8]">
                                Comp off days in {formatMonthLabel(monthKey)}.
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-x-auto">
                            <table className="w-full min-w-[720px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#EEF2F6]">
                                        <th className={TH}>Date</th>
                                        <th className={TH}>Time In</th>
                                        <th className={TH}>Time Out</th>
                                        <th className={TH}>Total hrs worked</th>
                                        <th className={TH}>OT approved date</th>
                                        <th className={`${TH} w-[5.5rem]`}>View</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-6 text-center text-[13px] text-[#94A3B8]">
                                                Loading comp off…
                                            </td>
                                        </tr>
                                    ) : compOffPageRows.length ? compOffPageRows.map((row) => (
                                        <tr key={row.id} className="border-b border-[#F4F7FB] last:border-0">
                                            <td className={`${TD} whitespace-nowrap font-medium`}>{row.dateLabel}</td>
                                            <td className={`${TD} whitespace-nowrap`}>{row.timeIn}</td>
                                            <td className={`${TD} whitespace-nowrap`}>
                                                <NextDayCheckoutTime time={row.timeOut} nextDay={row.timeOutNextDay} />
                                            </td>
                                            <td className={`${TD} whitespace-nowrap tabular-nums`}>{row.workedLabel}</td>
                                            <td className={`${TD} whitespace-nowrap font-semibold`}>{row.otApprovedLabel}</td>
                                            <td className={TD}>
                                                <button
                                                    type="button"
                                                    onClick={() => setCompOffView(row)}
                                                    className={OUTLINE_BTN}
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-6 text-[13px] text-[#94A3B8]">
                                                No comp off in {formatMonthLabel(monthKey)}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <CardPageBar
                            page={compOffPageSafe}
                            pageCount={compOffPageCount}
                            total={compOffRows.length}
                            onPage={setCompOffPage}
                        />
                    </section>
                </div>
            </div>
            )}
            {otView && typeof document !== 'undefined' ? createPortal(
                <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 p-4" onClick={() => setOtView(null)} role="presentation">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ot-approved-description-title"
                        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] px-5 py-4">
                            <div>
                                <h3 id="ot-approved-description-title" className="text-[15px] font-bold text-[#1B2A4A]">
                                    OT approved
                                </h3>
                                <p className="mt-0.5 text-[12px] text-[#64748B]">
                                    {otView.dateLabel} · {otView.approvedLabel}
                                </p>
                                {otView.workDate && otView.workDate !== otView.date ? (
                                    <p className="mt-1 text-[12px] text-[#64748B]">
                                        Leave taken on this date. Overtime was worked on {formatDayLabel(otView.workDate)}.
                                    </p>
                                ) : null}
                            </div>
                            <button type="button" onClick={() => setOtView(null)} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1B2A4A]" aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Description</p>
                            <p className="mt-1.5 text-[13px] font-medium leading-snug text-[#1B2A4A]">
                                {otView.description || 'No description was saved for this approval.'}
                            </p>
                            {otView.placedOn ? (
                                <p className="mt-3 text-[12px] text-[#64748B]">
                                    Present from this overtime was placed on {formatDayLabel(otView.placedOn)}.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>,
                document.body,
            ) : null}
            {compOffView && typeof document !== 'undefined' ? createPortal(
                <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 p-4" onClick={() => setCompOffView(null)} role="presentation">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="comp-off-description-title"
                        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] px-5 py-4">
                            <div>
                                <h3 id="comp-off-description-title" className="text-[15px] font-bold text-[#1B2A4A]">
                                    Comp off
                                </h3>
                                <p className="mt-0.5 text-[12px] text-[#64748B]">
                                    {compOffView.dateLabel}
                                    {compOffView.otApprovedLabel && compOffView.otApprovedLabel !== '—'
                                        ? ` · OT approved ${compOffView.otApprovedLabel}`
                                        : ''}
                                </p>
                            </div>
                            <button type="button" onClick={() => setCompOffView(null)} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1B2A4A]" aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Description</p>
                            <p className="mt-1.5 text-[13px] font-medium leading-snug text-[#1B2A4A]">
                                {compOffView.description || 'No description was saved for this comp off.'}
                            </p>
                        </div>
                    </div>
                </div>,
                document.body,
            ) : null}
            <SalaryAdditionListModal
                mode={additionModal}
                ready={additionReady}
                pay={salaryAddition.balancePay}
                staffType={staffType}
                employeeId={employeeMongoId}
                onClose={() => setAdditionModal('')}
            />
        </div>
    );
}

/** Same month calendar as the attendance profile, for the logged-in employee or one team member. */
export function AttendanceProfileCalendar({ forEmployeeId = '', className = '' }) {
    const todayKey = dubaiTodayKey();
    const currentMonth = todayKey.slice(0, 7);
    const [monthKey, setMonthKey] = useState(currentMonth);
    const [records, setRecords] = useState([]);
    const [scheduleWeek, setScheduleWeek] = useState(null);
    const [offWeekdays, setOffWeekdays] = useState(() => new Set(['saturday', 'sunday']));
    const [staffType, setStaffType] = useState('');
    const [holidayRows, setHolidayRows] = useState([]);
    const [salaryLock, setSalaryLock] = useState(EMPTY_SALARY_LOCK);
    const [employeeId, setEmployeeId] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hoveredDate, setHoveredDate] = useState('');

    const loadMonth = useCallback(async () => {
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
        setLoading(true);
        setError('');
        try {
            const params = { month: monthKey };
            const requestedId = String(forEmployeeId || '').trim();
            if (requestedId) params.forEmployeeId = requestedId;
            const response = await axiosInstance.get('/Attendance/me', { params, skipToast: true });
            const rows = Array.isArray(response.data?.records) ? response.data.records : [];
            setRecords(rows);
            const nextStaff = normalizeWorkLocationKey(response.data?.employee?.staffType);
            setStaffType(nextStaff);
            setScheduleWeek(weekForStaffType(response.data?.workingTime, nextStaff));
            setOffWeekdays(new Set(
                Array.isArray(response.data?.offWeekdays) && response.data.offWeekdays.length
                    ? response.data.offWeekdays
                    : ['saturday', 'sunday'],
            ));
            setEmployeeId(String(response.data?.employee?.id || requestedId || ''));
            setEmployeeName(String(response.data?.employee?.name || '').trim());
            setSalaryLock(salaryLockFromAttendancePayload(response.data));
        } catch (err) {
            setRecords([]);
            if (err?.response?.data?.salaryEnrolled === false || err?.response?.data?.attendanceLocked) {
                setSalaryLock(salaryLockFromAttendancePayload(err.response.data));
                setError('');
            } else {
                setSalaryLock(EMPTY_SALARY_LOCK);
                setError(err?.response?.data?.message || 'Could not load attendance.');
            }
        } finally {
            setLoading(false);
        }
    }, [forEmployeeId, monthKey]);

    useEffect(() => {
        loadMonth();
    }, [loadMonth]);

    useEffect(() => {
        const year = Number(monthKey.slice(0, 4));
        if (!year) return undefined;
        let cancelled = false;
        axiosInstance.get('/Holiday', { params: { year }, skipToast: true })
            .then((response) => {
                if (!cancelled) setHolidayRows(Array.isArray(response.data?.holidays) ? response.data.holidays : []);
            })
            .catch(() => {
                if (!cancelled) setHolidayRows([]);
            });
        return () => {
            cancelled = true;
        };
    }, [monthKey]);

    useEffect(() => {
        const refresh = () => loadMonth();
        window.addEventListener(ATTENDANCE_CHECK_CHANGED, refresh);
        window.addEventListener('verp:holidays-changed', refresh);
        window.addEventListener('verp:working-time-changed', refresh);
        return () => {
            window.removeEventListener(ATTENDANCE_CHECK_CHANGED, refresh);
            window.removeEventListener('verp:holidays-changed', refresh);
            window.removeEventListener('verp:working-time-changed', refresh);
        };
    }, [loadMonth]);

    const anchor = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);
    const calendarDays = useMemo(() => eachDayOfInterval({
        start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    }), [anchor]);
    const calendarCtx = useMemo(() => {
        const built = buildMonthCalendarContext({
            monthKey,
            todayKey,
            records,
            scheduleWeek,
            offWeekdays,
            staffType,
            holidayRows,
            leavePolicy: {},
            monthlySalary: 0,
            joinKey: '',
            visibleFrom: '',
            pendingRequests: [],
        });
        return {
            ...built,
            salaryLock,
            pendingRequestsByDate: employeePendingRequests({
                records,
                pending: [],
                monthKey,
                employeeName,
            }),
        };
    }, [employeeName, holidayRows, monthKey, offWeekdays, records, salaryLock, scheduleWeek, staffType, todayKey]);

    function shiftMonth(delta) {
        const next = format(addMonths(anchor, delta), 'yyyy-MM');
        if (next > currentMonth) return;
        setMonthKey(next);
    }

    return (
        <section className={`relative col-span-12 overflow-visible rounded-2xl border border-[#E6EDF5] bg-white px-4 py-[14px] shadow-sm lg:col-span-6 ${hoveredDate ? 'z-30' : 'z-0'} ${className}`.trim()}>
            <style>{`
                @keyframes attendance-request-blink {
                    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                    45% { opacity: 0.35; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.45); }
                    70% { opacity: 1; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                }
                .attendance-request-blink {
                    animation: attendance-request-blink 2.4s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .attendance-request-blink {
                        animation: none;
                        box-shadow: inset 0 0 0 2px rgba(220, 38, 38, 0.75);
                    }
                }
            `}</style>
            <div className="mb-2.5 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#2563EB]">
                    <CalendarDays size={16} strokeWidth={2.25} />
                </span>
                <h2 className="text-[15px] font-bold text-[#1B2A4A]">Attendance Calendar</h2>
            </div>
            {error ? (
                <button type="button" onClick={loadMonth} className="py-6 text-[12px] text-red-500">{error} · Retry</button>
            ) : loading ? (
                <p className="py-6 text-center text-[12px] text-[#94A3B8]">Loading calendar…</p>
            ) : (
                <>
                    <div className="relative mb-2.5 flex h-9 items-center justify-center">
                        <div className="inline-flex h-9 items-center rounded-lg border border-[#E6EDF5] bg-white">
                            <button type="button" onClick={() => shiftMonth(-1)} className="inline-flex h-9 w-9 items-center justify-center text-[#64748B]" aria-label="Previous month"><ChevronLeft size={16} /></button>
                            <span className="min-w-[8rem] text-center text-[14px] font-semibold text-[#1B2A4A]">{formatMonthLabel(monthKey)}</span>
                            <button type="button" onClick={() => shiftMonth(1)} disabled={monthKey >= currentMonth} className="inline-flex h-9 w-9 items-center justify-center text-[#64748B] disabled:opacity-30" aria-label="Next month"><ChevronRight size={16} /></button>
                        </div>
                        <button type="button" onClick={() => setMonthKey(currentMonth)} className="absolute right-0 h-9 rounded-lg border border-[#E6EDF5] bg-white px-3 text-[13px] font-semibold text-[#2563EB]">Today</button>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="mb-1.5 grid grid-cols-7 gap-x-[7px]">
                                {WEEKDAYS.map((day) => (
                                    <div key={day} className="text-center text-[11px] font-medium text-[#94A3B8]">{day}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-x-[7px] gap-y-[7px]">
                                {calendarDays.map((day) => (
                                    <AttendanceDayCell
                                        key={format(day, 'yyyy-MM-dd')}
                                        day={day}
                                        ctx={calendarCtx}
                                        hoveredDate={hoveredDate}
                                        setHoveredDate={setHoveredDate}
                                        markTarget={{
                                            employeeId,
                                            staffType,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="w-full shrink-0 space-y-1.5 pt-1 sm:w-[9.5rem]">
                            <p className="text-[13px] font-semibold text-[#64748B]">Legend</p>
                            {LEGEND.map((item) => (
                                <span key={item.key} className="flex items-center gap-1.5 text-[11px] leading-tight text-[#64748B]">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${item.swatch}`} />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </>
            )}
            <DashboardSalaryEnrollLock {...salaryLock} />
        </section>
    );
}
