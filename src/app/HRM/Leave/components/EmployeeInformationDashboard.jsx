'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
    MapPin,
    Plane,
    Plus,
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
import DashboardSalaryEnrollLock, {
    EMPTY_SALARY_LOCK,
    salaryLockFromAttendancePayload,
} from '@/app/dashboard/components/DashboardSalaryEnrollLock';

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

function taskHref(task, employeeMongoId) {
    const id = String(task?.id || '').trim();
    if (task?.kind === 'leave') return '/HRM/Leave/annual-leave';
    if (!id) return '/dashboard';
    const params = new URLSearchParams({ hubRequestId: id });
    if (employeeMongoId) params.set('viewEmployee', String(employeeMongoId));
    return `/dashboard?${params.toString()}`;
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
    const minutes = clockToMinutes(value);
    if (minutes == null) return '—';
    const hour24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour = hour24 % 12 || 12;
    return `${hour}:${String(mins).padStart(2, '0')} ${suffix}`;
}

function wholeOtHours(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours + 1e-9);
}

function formatDuration(minutes) {
    if (minutes == null || minutes < 0) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
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

function locationOf(record) {
    const spot = record?.checkInLocation?.latitude != null
        ? record.checkInLocation
        : record?.checkOutLocation?.latitude != null
          ? record.checkOutLocation
          : record?.checkInLocation || record?.checkOutLocation;
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

function dayLateText(record, week) {
    if (!record) return '—';
    const fromReason = minutesInReason(record.reason, /(\d+)\s*minutes?\s+late/i);
    if (fromReason != null) return `${fromReason} ${fromReason === 1 ? 'minute' : 'minutes'}`;
    const key = String(record.statusKey || '');
    if (key === 'late_arrived') {
        const shift = shiftForDate(week, record.date);
        const actual = clockToMinutes(record.timeIn);
        if (!shift || actual == null) return '—';
        const gap = Math.max(0, actual - shift.start);
        return `${gap} ${gap === 1 ? 'minute' : 'minutes'}`;
    }
    if (record.timeIn) return '0 minutes';
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

const WORKED_STATUS_KEYS = new Set(['on_office', 'work_from_home', 'late_arrived', 'early_go']);

function isSyntheticOtDay(row) {
    const inn = String(row?.timeIn || '').trim();
    const out = String(row?.timeOut || '').trim();
    return inn === 'OT' || out === 'OT' || Boolean(String(row?.flexibleFromOtDate || '').trim());
}

function rowWorkedMinutes(row) {
    if (isSyntheticOtDay(row)) return 0;
    const inn = String(row?.timeIn || '').trim();
    const out = String(row?.timeOut || '').trim();
    if (!inn) return 0;
    const stored = Number(row?.flexibleWorkedHours) || 0;
    if (stored > 0) return Math.round(stored * 60);
    if (!out) return 0;
    return workedMinutes(inn, out) || 0;
}

function dayCountLabel(count) {
    const total = Math.max(0, Math.round(Number(count) || 0));
    return `${total} ${total === 1 ? 'Day' : 'Days'}`;
}

function summarizeOvertimeDetails(records) {
    const byDate = new Map();
    (records || []).forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!date) return;
        const prev = byDate.get(date);
        if (!prev) {
            byDate.set(date, row);
            return;
        }
        const prevPunch = String(prev?.timeIn || '').trim();
        const nextPunch = String(row?.timeIn || '').trim();
        if ((!prevPunch || prevPunch === 'OT') && nextPunch && nextPunch !== 'OT') byDate.set(date, row);
    });
    let overtimeMinutes = 0;
    const convertedDays = new Set();
    let workedMinutesTotal = 0;
    const workedDates = new Set();
    byDate.forEach((row, date) => {
        const status = String(row?.flexibleOtStatus || '');
        const approved = n(row?.flexibleOtApprovedHours);
        const requested = n(row?.flexibleOtHours);
        const nextDay = String(row?.flexibleOtNextDayDate || '').trim();
        const converted = Boolean(nextDay) || (status === 'approved' && approved > 10);
        if (nextDay) convertedDays.add(nextDay);
        if (isSyntheticOtDay(row)) convertedDays.add(date);
        if (!converted) {
            const hours = status === 'approved' ? approved : requested;
            if (hours > 0 && hours <= 10) overtimeMinutes += Math.round(hours * 60);
        }
        if (isSyntheticOtDay(row)) return;
        const minutes = rowWorkedMinutes(row);
        const workedStatus = WORKED_STATUS_KEYS.has(String(row?.statusKey || ''));
        if (!workedStatus && minutes <= 0) return;
        workedDates.add(date);
        workedMinutesTotal += minutes;
    });
    return {
        overtimeMinutes,
        overDays: convertedDays.size,
        workedMinutes: workedMinutesTotal,
        workedDays: workedDates.size,
    };
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

const ATTENDANCE_DEDUCTION_LABEL = {
    late_arrived: 'Late In',
    early_go: 'Early Out',
    mispunch: 'Missed Punch',
    authorized_leave: 'Authorized Leave',
    unauthorized_leave: 'Unauthorized Leave',
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
    const key = String(record?.statusKey || '');
    if (key === 'late_arrived') {
        const minutes = dayLateText(record, week);
        const time = formatClock12(record?.timeIn);
        return [time !== '—' ? `In ${time}` : '', minutes !== '—' ? minutes : ''].filter(Boolean).join(' · ') || 'Late in';
    }
    if (key === 'early_go') {
        const shift = shiftForDate(week, record?.date);
        const actual = clockToMinutes(record?.timeOut);
        const gap = shift && actual != null ? Math.max(0, shift.end - actual) : null;
        const time = formatClock12(record?.timeOut);
        const minutes = gap == null ? '' : `${gap} ${gap === 1 ? 'minute' : 'minutes'}`;
        return [time !== '—' ? `Out ${time}` : '', minutes, String(record?.reason || '').trim()].filter(Boolean).join(' · ') || 'Early out';
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

function attendanceDeductionRows(records, policy, week, daily) {
    const labeled = (records || []).filter((row) => ATTENDANCE_DEDUCTION_LABEL[String(row?.statusKey || '')]);
    const byMonth = new Map();
    labeled.forEach((row) => {
        const month = String(row?.date || '').slice(0, 7) || 'unknown';
        if (!byMonth.has(month)) byMonth.set(month, []);
        byMonth.get(month).push(row);
    });
    const flexible = String(week?.timingMode || '').toLowerCase() === 'flexible';
    const lateRule = policy?.lateRule || null;
    const punchRule = deductFraction(policy?.missedPunchRule?.deduct)
        ? policy.missedPunchRule
        : mispunchRuleOf(policy?.extraLateRules);
    const authTimes = policy?.authorizedDeductionDays == null ? 1 : n(policy.authorizedDeductionDays);
    const unauthTimes = policy?.unauthorizedDeductionDays == null ? 2 : n(policy.unauthorizedDeductionDays);
    const timed = flexible
        ? []
        : (Array.isArray(policy?.extraLateRules) ? policy.extraLateRules : [])
            .map((rule, index) => ({ rule, index, direction: ruleDirection(rule) }))
            .filter((row) => row.direction && deductFraction(row.rule?.deduct) && !isMispunchTitle(row.rule?.title));
    const rows = [];
    for (const monthRows of byMonth.values()) {
        const ordered = [...monthRows].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        let sharedCount = 0;
        let punchCount = 0;
        const extraCounts = new Map();
        ordered.forEach((record) => {
            const key = String(record?.statusKey || '');
            let amount = 0;
            if (key === 'authorized_leave' || key === 'unauthorized_leave') {
                const times = key === 'authorized_leave' ? authTimes : unauthTimes;
                amount = money2(leaveDayWeight(record, key === 'authorized_leave') * times * (Number(daily) || 0));
            } else if (key === 'mispunch') {
                punchCount += 1;
                amount = punchRule ? incrementalPolicyAmount(punchCount, punchRule, daily) : 0;
            } else {
                const direction = key === 'early_go' ? 'out' : 'in';
                const shift = shiftForDate(week, record?.date);
                const actual = clockToMinutes(direction === 'in' ? record?.timeIn : record?.timeOut);
                const minutes = !shift || actual == null ? 0 : direction === 'in' ? actual - shift.start : shift.end - actual;
                const extra = timed
                    .filter((row) => row.direction === direction && minutes >= Math.max(0, n(row.rule?.minutes)))
                    .sort((a, b) => n(b.rule.minutes) - n(a.rule.minutes))[0];
                if (extra) {
                    const next = (extraCounts.get(extra.index) || 0) + 1;
                    extraCounts.set(extra.index, next);
                    amount = incrementalPolicyAmount(next, extra.rule, daily);
                } else {
                    sharedCount += 1;
                    amount = lateRule ? incrementalPolicyAmount(sharedCount, lateRule, daily) : 0;
                }
            }
            const pending = key === 'mispunch' && !amount;
            rows.push({
                id: String(record?._id || `${record?.date}-${key}`),
                sort: String(record?.date || ''),
                date: formatDayLabel(record?.date),
                type: ATTENDANCE_DEDUCTION_LABEL[key],
                detail: deductionEventDetail(record, week),
                amount: pending ? '0.00 (Pending)' : formatAedNumber(amount),
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
            sort,
            date: row.dateLabel || '—',
            type: 'Loan Recovery',
            detail: [row.code, row.reason, row.status].map((part) => String(part || '').trim()).filter(Boolean).join(' · ') || 'Loan',
            amount: formatAedNumber(row.outstanding),
        });
    });
    (advances || []).forEach((row) => {
        if (!(n(row.outstanding) > 0)) return;
        const sort = parseLabelDate(row.dateLabel);
        pushMoney({
            id: `advance-${row.id}`,
            sort,
            date: row.dateLabel || '—',
            type: 'Advance Recovery',
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

function dayKind(record, { isFuture, isToday, isHoliday, isWeeklyOff }) {
    const key = String(record?.statusKey || '');
    if (key === 'on_office' || key === 'work_from_home') return 'present';
    if (key === 'late_arrived' || key === 'early_go' || key === 'mispunch') return 'attention';
    if (key === 'unauthorized_leave' || key === 'not_marked') return 'absent';
    if (key === 'sick_leave') return 'sick';
    if (key === 'authorized_leave') return 'authorized';
    if (key === 'on_leave') return 'annual';
    if (key === 'compoff_leave') return 'compoff';
    if (key === 'holiday' || isHoliday) return 'holiday';
    if (key === 'weekly_off' || isWeeklyOff) return 'weekend';
    if (isFuture || isToday) return 'future';
    if (!record) return 'absent';
    return 'empty';
}

function kindLabel(kind) {
    return LEGEND.find((item) => item.key === kind)?.label || 'No mark';
}

function attentionLabel(record) {
    const key = String(record?.statusKey || '');
    if (key === 'mispunch') return 'Missed Punch';
    if (key === 'early_go') return 'Early Out';
    if (key === 'late_arrived') return 'Late Arrival';
    return '';
}

function eventRowsFromRecords(records, key) {
    return (records || [])
        .filter((row) => String(row?.statusKey || '') === key)
        .map((row) => ({
            id: String(row._id || `${row.date}-${key}`),
            date: row.date,
            statusKey: row.statusKey,
            statusLabel: row.statusLabel || kindLabel(dayKind(row, {})),
            reason: String(row.reason || row.leaveRequestReason || '').trim(),
            attachmentName: String(row.attachmentName || '').trim(),
            leavePayType: String(row.leavePayType || '').trim(),
        }));
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
    const key = String(row?.appliedKey || '');
    const title = String(row?.title || '');
    if (key === 'mispunch' || key === 'late_arrived' || key === 'early_go') return 'Awaiting Explanation';
    if (key === 'utility' || /utility|clarification/i.test(title)) return 'Review Pending';
    if (/fine|deduct/i.test(title)) return 'Deduction Pending';
    return 'Approval Pending';
}

function tableToneClass(label) {
    const text = String(label || '');
    if (/deduct|^high$/i.test(text)) return 'text-[#EF4444]';
    if (/^medium$/i.test(text)) return 'text-[#F59E0B]';
    if (/await|explanation|approv|review|pending/i.test(text)) return 'text-[#F97316]';
    return 'text-[#64748B]';
}

function TableTone({ label }) {
    if (!label) return <span className="text-[13px] text-[#94A3B8]">—</span>;
    return <span className={`whitespace-nowrap text-[13px] font-semibold ${tableToneClass(label)}`}>{label}</span>;
}

const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[12px] font-medium text-[#94A3B8]';
const TD = 'px-3 py-2.5 align-middle text-[13px] text-[#1B2A4A]';
const OUTLINE_BTN = 'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-[#93C5FD] bg-white px-2.5 text-[12px] font-semibold text-[#2563EB]';
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
        const authorized = leaveTallies(countedRecords, 'authorized_leave');
        const unauthorized = leaveTallies(countedRecords, 'unauthorized_leave');
        let present = 0;
        let wfh = 0;
        let lateIn = 0;
        let earlyOut = 0;
        let missed = 0;
        let compoffUsed = 0;
        let compoffPending = 0;
        countedRecords.forEach((row) => {
            const key = String(row?.statusKey || '');
            if (key === 'on_office') present += 1;
            if (key === 'work_from_home') wfh += 1;
            if (key === 'late_arrived') lateIn += 1;
            if (key === 'early_go') earlyOut += 1;
            if (key === 'mispunch') missed += 1;
            if (key === 'compoff_leave') {
                compoffUsed += 1;
                const state = String(row?.compOff?.state || '');
                if (!state || state === 'open') compoffPending += 1;
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
    const overtime = useMemo(() => summarizeOvertimeDetails(detailRecords), [detailRecords]);
    const overtimeRange = detailWindow.from && detailWindow.to
        ? `${formatDayLabel(detailWindow.from)} to ${formatDayLabel(detailWindow.to)}`
        : '—';
    const overtimeReady = !(period === 'month' && salaryLock.locked) && !(period !== 'month' && spanLoading);

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
    const deductionRows = useMemo(() => {
        const policy = profile?.leavePolicy || {};
        const daily = salaryBasis.daily;
        const lateCount = n(monthStats.lateIn);
        const earlyCount = n(monthStats.earlyOut);
        const missedCount = n(monthStats.missed);
        const authDays = money2(leaveChargeDays(countedRecords, 'authorized_leave'));
        const unauthDays = money2(leaveChargeDays(countedRecords, 'unauthorized_leave'));
        const authTimes = policy.authorizedDeductionDays == null ? 1 : n(policy.authorizedDeductionDays);
        const unauthTimes = policy.unauthorizedDeductionDays == null ? 2 : n(policy.unauthorizedDeductionDays);
        const lateRule = policy.lateRule || null;
        const timed = timedPolicyCounts(countedRecords, policy.extraLateRules, scheduleWeek);
        const extraIn = timed.rows.filter((row) => row.direction === 'in' && row.count > 0);
        const extraOut = timed.rows.filter((row) => row.direction === 'out' && row.count > 0);
        const sharedLateIn = Math.max(0, lateCount - timed.consumed.in);
        const sharedLateOut = Math.max(0, earlyCount - timed.consumed.out);
        const combinedShared = sharedLateIn + sharedLateOut;
        const lateTotal = policyDeductionAmount(daily, combinedShared, lateRule);
        const lateShares = splitMoney(lateTotal, { late: sharedLateIn, early: sharedLateOut });
        const extraInAmount = extraIn.reduce((sum, row) => sum + policyDeductionAmount(daily, row.count, row.rule), 0);
        const extraOutAmount = extraOut.reduce((sum, row) => sum + policyDeductionAmount(daily, row.count, row.rule), 0);
        const punchRule = deductFraction(policy.missedPunchRule?.deduct)
            ? policy.missedPunchRule
            : mispunchRuleOf(policy.extraLateRules);
        const punchAmount = punchRule ? policyDeductionAmount(daily, missedCount, punchRule) : 0;
        const dayRate = formatAed(daily, 2);
        const lateInNote = lateDirectionNote(extraIn, sharedLateIn, combinedShared, lateRule, daily, 'late in');
        const lateOutNote = lateDirectionNote(extraOut, sharedLateOut, combinedShared, lateRule, daily, 'late out');
        return [
            {
                key: 'late_arrived',
                type: 'Late in',
                count: sharedLateIn + extraIn.reduce((sum, row) => sum + row.count, 0),
                amount: money2((lateShares.late || 0) + extraInAmount),
                note: lateInNote,
            },
            {
                key: 'early_go',
                type: 'Late out',
                count: sharedLateOut + extraOut.reduce((sum, row) => sum + row.count, 0),
                amount: money2((lateShares.early || 0) + extraOutAmount),
                note: lateOutNote,
            },
            {
                key: 'mispunch',
                type: 'Missed punch',
                count: missedCount,
                amount: punchAmount,
                note: punchRule
                    ? eventPolicyNote(missedCount, punchRule, daily)
                    : 'No missed-punch rule on this employee group policy',
            },
            {
                key: 'authorized_leave',
                type: 'Authorized leave',
                count: authDays,
                amount: money2(authDays * authTimes * daily),
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
    }, [countedRecords, profile?.leavePolicy, salaryBasis.daily, monthStats, scheduleWeek]);
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
        return [...attendance, ...moneyRows].sort((a, b) => String(b.sort || '').localeCompare(String(a.sort || '')));
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

    const elapsedDays = countFrom && countTo ? inclusiveDays(countFrom, countTo) : 0;
    const daysInMonth = days.length || 0;
    const dailySalary = monthlySalary > 0 && daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
    const monthDeduction = deductionRows.reduce((sum, row) => sum + (row.amount == null ? 0 : Number(row.amount) || 0), 0);
    const accumulated = monthlySalary > 0
        ? Math.max(0, money2(dailySalary * elapsedDays - monthDeduction))
        : 0;
    const accumulatedPct = monthlySalary > 0 ? Math.round((accumulated / monthlySalary) * 10000) / 100 : 0;

    const pending = profile?.requests?.pending || [];
    const workTasks = Array.isArray(profile?.requests?.workTasks) ? profile.requests.workTasks : [];
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
    const calendarDays = eachDayOfInterval({
        start: startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 }),
    });

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
        const rows = (source || []).filter((row) => keys.includes(String(row?.statusKey || '')));
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
    const todayOut = todayRecord?.timeOut;
    const openMinutes = !todayOut && clockToMinutes(todayIn) != null
        ? Math.max(0, (dubaiNowMinutes() ?? 0) - clockToMinutes(todayIn))
        : null;
    const todayWorked = todayIn ? workedMinutes(todayIn, todayOut) ?? openMinutes : null;

    return (
        <div className="space-y-3">
            <section className="rounded-xl border border-[#E6EDF5] bg-white px-4 py-3">
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
                                <h1 className="truncate text-[16px] font-bold leading-tight text-[#1B2A4A]">{employee.name || 'Employee'}</h1>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${isActive ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-slate-100 text-slate-500'}`}>
                                    {isActive ? 'Active' : 'Inactive'}
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
                                            {todayIn ? `Checked In – ${formatClock12(todayIn)}` : 'No punch yet'}
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
                                            {todayIn ? `Checked In – ${formatClock12(todayIn)}` : 'No punch yet'}
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
                                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1B2A4A]">
                                    <BarChart3 size={14} className="text-[#2563EB]" /> Last Increment
                                </p>
                                <div className="mt-1.5 space-y-0.5 text-[11px]">
                                    <p className="flex justify-between gap-2"><span className="text-[#64748B]">Previous Salary</span><span className="font-semibold tabular-nums text-[#1B2A4A]">{increment?.fromTotal ? formatAed(increment.fromTotal) : '—'}</span></p>
                                    <p className="flex justify-between gap-2"><span className="text-[#64748B]">Increment</span><span className="font-semibold tabular-nums text-[#16A34A]">{increment?.amount ? formatAed(increment.amount) : formatAed(0)}</span></p>
                                    <p className="flex justify-between gap-2"><span className="text-[#64748B]">New Salary</span><span className="font-semibold tabular-nums text-[#1B2A4A]">{increment?.toTotal ? formatAed(increment.toTotal) : formatAed(n(salary.monthlySalary) || n(salary.totalSalary))}</span></p>
                                    <p className="flex justify-between gap-2"><span className="text-[#64748B]">Effective Date</span><span className="font-semibold text-[#1B2A4A]">{increment?.dateLabel || '—'}</span></p>
                                </div>
                                <button type="button" onClick={() => onOpenFinancial?.('increment')} className="mt-auto inline-flex items-center self-end pt-1 text-[11px] font-semibold text-[#2563EB]">
                                    View History <ChevronRight size={14} />
                                </button>
                            </div>
                            <div className="rounded-xl border border-[#E7EEF6] bg-white px-2.5 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[12px] font-semibold text-[#1B2A4A]">Financial Obligations</p>
                                    <button type="button" onClick={onOpenPayroll} className="inline-flex items-center text-[11px] font-semibold text-[#2563EB]">
                                        View Details <ChevronRight size={14} />
                                    </button>
                                </div>
                                <div className="mt-1.5 grid grid-cols-2 gap-1">
                                    <button type="button" onClick={() => onOpenFinancial?.('advance')} className="flex items-start gap-1.5 rounded-lg bg-[#F5F3FF] px-1.5 py-1.5 text-left">
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#8B5CF6] text-white">
                                            <Wallet size={13} strokeWidth={2.3} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[12px] font-semibold leading-tight text-[#1B2A4A]">Salary Advance</span>
                                            <span className="mt-1 block text-[11px] leading-tight text-[#64748B]">Total: <span className="font-semibold text-[#1B2A4A]">{formatAedNumber(advanceTotal)}</span></span>
                                            <span className="block text-[11px] leading-tight text-[#64748B]">Paid: <span className="font-semibold text-[#1B2A4A]">{formatAedNumber(advancePaid)}</span></span>
                                            <span className="block text-[11px] leading-tight text-[#64748B]">Pending: <span className="font-semibold text-[#1B2A4A]">{formatAedNumber(advanceOutstanding)}</span></span>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('loan')} className="flex items-start gap-1.5 rounded-lg bg-[#FEF2F2] px-1.5 py-1.5 text-left">
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#EF4444] text-white">
                                            <UserRound size={13} strokeWidth={2.3} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[12px] font-semibold leading-tight text-[#1B2A4A]">Loan</span>
                                            <span className="mt-1 block text-[11px] leading-tight text-[#64748B]">Total: <span className="font-semibold text-[#1B2A4A]">{formatAedNumber(loanTotal)}</span></span>
                                            <span className="block text-[11px] leading-tight text-[#64748B]">Recovered: <span className="font-semibold text-[#1B2A4A]">{formatAedNumber(loanPaid)}</span></span>
                                            <span className="block text-[11px] leading-tight text-[#64748B]">Pending: <span className="font-semibold text-[#1B2A4A]">{formatAedNumber(loanOutstanding)}</span></span>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('fines')} className="flex items-start gap-1.5 rounded-lg bg-[#FFF7ED] px-1.5 py-1.5 text-left">
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F59E0B] text-white">
                                            <AlertTriangle size={13} strokeWidth={2.3} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[12px] font-semibold leading-tight text-[#1B2A4A]">Outstanding Fines</span>
                                            <span className="mt-1 block text-[14px] font-bold leading-tight text-[#1B2A4A]">{formatAed(fineOutstanding)}</span>
                                        </span>
                                    </button>
                                    <button type="button" onClick={() => onOpenFinancial?.('utility')} className="flex items-start gap-1.5 rounded-lg bg-[#EFF6FF] px-1.5 py-1.5 text-left">
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#3B82F6] text-white">
                                            <Zap size={13} strokeWidth={2.3} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[12px] font-semibold leading-tight text-[#1B2A4A]">Utility Excess</span>
                                            <span className="mt-1 block text-[14px] font-bold leading-tight text-[#1B2A4A]">{formatAed(utilityOutstanding)}</span>
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
                            <div className="rounded-xl border border-[#E7EEF6] bg-white px-2.5 py-2">
                                <div className="flex items-start gap-2">
                                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6] text-white">
                                        <Clock size={15} strokeWidth={2.2} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-semibold leading-tight text-[#1B2A4A]">
                                            Overtime details
                                            <span className="font-medium text-[#64748B]"> (working days {overtimeRange})</span>
                                        </p>
                                        <div className="mt-1.5 space-y-0.5 text-[11px]">
                                            <p className="flex justify-between gap-2"><span className="text-[#64748B]">Over time</span><span className="font-semibold tabular-nums text-[#1B2A4A]">{overtimeReady ? wholeOtHours(overtime.overtimeMinutes / 60) : '—'}</span></p>
                                            <p className="flex justify-between gap-2"><span className="text-[#64748B]">Over days</span><span className="font-semibold tabular-nums text-[#1B2A4A]">{overtimeReady ? dayCountLabel(overtime.overDays) : '—'}</span></p>
                                            <p className="flex justify-between gap-2"><span className="text-[#64748B]">Worked hours</span><span className="font-semibold tabular-nums text-[#1B2A4A]">{overtimeReady ? formatDuration(overtime.workedMinutes) : '—'}</span></p>
                                            <p className="flex justify-between gap-2"><span className="text-[#64748B]">Worked days</span><span className="font-semibold tabular-nums text-[#1B2A4A]">{overtimeReady ? dayCountLabel(overtime.workedDays) : '—'}</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
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
                                        const pendingPunch = !salaryLock.locked && row.key === 'mispunch' && n(row.count) > 0 && !n(row.amount);
                                        return (
                                            <tr key={row.key} className="border-t border-[#F4F7FB]">
                                                <td className={`${TD} text-[#94A3B8]`}>{index + 1}</td>
                                                <td className={TD}>{row.type}</td>
                                                <td className={`${TD} tabular-nums`}>{countText}</td>
                                                <td className={`${TD} text-right font-medium tabular-nums ${pendingPunch ? 'text-[#D97706]' : ''}`}>
                                                    {salaryLock.locked ? '—' : pendingPunch ? '0.00 (Pending)' : formatAedNumber(row.amount)}
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
                    <section className="relative rounded-2xl border border-[#E6EDF5] bg-white p-4">
                        <div className="mb-3 flex items-center gap-2">
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
                            <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="relative mb-3 flex h-9 items-center justify-center">
                                        <div className="inline-flex h-9 items-center rounded-lg border border-[#E6EDF5] bg-white">
                                            <button type="button" onClick={() => shiftMonth(-1)} className="inline-flex h-9 w-9 items-center justify-center text-[#64748B]" aria-label="Previous month"><ChevronLeft size={16} /></button>
                                            <span className="min-w-[8rem] text-center text-[14px] font-semibold text-[#1B2A4A]">{formatMonthLabel(monthKey)}</span>
                                            <button type="button" onClick={() => shiftMonth(1)} className="inline-flex h-9 w-9 items-center justify-center text-[#64748B]" aria-label="Next month"><ChevronRight size={16} /></button>
                                        </div>
                                        <button type="button" onClick={() => selectMonth(currentMonth)} className="absolute right-0 h-9 rounded-lg border border-[#E6EDF5] bg-white px-3.5 text-[13px] font-semibold text-[#2563EB]">Today</button>
                                    </div>
                                    <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                                        {WEEKDAYS.map((day) => (
                                            <div key={day} className="text-center text-[12px] font-medium text-[#94A3B8]">{day}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {calendarDays.map((day) => {
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            const inMonth = dateKey.slice(0, 7) === monthKey;
                                            const record = inMonth ? recordsByDate[dateKey] : null;
                                            const weekdayKey = WEEKDAY_KEYS[getDay(day)];
                                            const isHoliday = inMonth && (holidayDates.has(dateKey) || record?.statusKey === 'holiday');
                                            const isWeeklyOff = inMonth && !isHoliday && (record?.statusKey === 'weekly_off' || offWeekdays.has(weekdayKey));
                                            const isFuture = dateKey > todayKey;
                                            const kind = !inMonth
                                                ? 'outside'
                                                : salaryLock.locked
                                                  ? 'future'
                                                  : dayKind(record, { isFuture, isToday: dateKey === todayKey, isHoliday, isWeeklyOff });
                                            const place = locationOf(record);
                                            const worked = record?.timeIn ? workedMinutes(record.timeIn, record.timeOut) : null;
                                            const tone = TIP_TONE[kind] || TIP_TONE.empty;
                                            const column = (getDay(day) + 6) % 7;
                                            const placeText = place.label || (place.hasMap ? `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}` : '—');
                                            const yellowLabel = kind === 'attention' ? attentionLabel(record) : '';
                                            return (
                                                <div
                                                    key={dateKey}
                                                    className="relative"
                                                    onMouseEnter={() => inMonth && setHoveredDate(dateKey)}
                                                    onMouseLeave={() => setHoveredDate('')}
                                                >
                                                    <div className={`flex aspect-square items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums ${DAY_STYLE[kind] || DAY_STYLE.empty}`}>{format(day, 'd')}</div>
                                                    {hoveredDate === dateKey && inMonth && !salaryLock.locked ? (
                                                        <div className={`absolute z-30 w-56 rounded-xl border border-[#E6EDF5] bg-white p-3 text-left shadow-xl ${column >= 4 ? 'right-0' : 'left-1/2'} top-full mt-1`}>
                                                            <p className="text-[13px] font-bold text-[#1B2A4A]">{format(day, 'd MMMM yyyy')}</p>
                                                            <p className={`mt-1 flex items-center gap-1.5 text-[12px] font-semibold ${tone.text}`}>
                                                                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                                                                {yellowLabel || kindLabel(kind)}
                                                                {!yellowLabel && holidayNamesByDate[dateKey] ? ` · ${holidayNamesByDate[dateKey]}` : ''}
                                                            </p>
                                                            {yellowLabel ? null : (
                                                                <>
                                                                    <div className="mt-2 space-y-1.5 text-[12px] text-[#1B2A4A]">
                                                                        <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[#94A3B8]"><Clock size={12} /> Time In</span><span className="font-medium">{formatClock12(record?.timeIn)}</span></p>
                                                                        <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[#94A3B8]"><Clock size={12} /> Time Out</span><span className="font-medium">{formatClock12(record?.timeOut)}</span></p>
                                                                        <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[#94A3B8]"><Clock size={12} /> Worked</span><span className="font-medium">{worked == null ? '—' : formatDuration(worked)}</span></p>
                                                                        <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[#94A3B8]"><Clock size={12} /> Late</span><span className="font-medium">{dayLateText(record, scheduleWeek)}</span></p>
                                                                        <p className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[#94A3B8]"><MapPin size={12} /> Location</span><span className="text-right font-medium">{placeText}</span></p>
                                                                    </div>
                                                                    {place.mapHref ? (
                                                                        <a href={place.mapHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB]">
                                                                            View on Map <ExternalLink size={12} />
                                                                        </a>
                                                                    ) : null}
                                                                </>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="w-[9.25rem] shrink-0 space-y-1.5 pt-2">
                                    <p className="text-[13px] font-semibold text-[#64748B]">Legend</p>
                                    {LEGEND.map((item) => (
                                        <span key={item.key} className="flex items-center gap-2 text-[12px] leading-tight text-[#64748B]">
                                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.swatch}`} />
                                            {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
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
                                    {pending.length ? pending.map((row, index) => {
                                        const statusLabel = prepStatusLabel(row);
                                        const takeAction = statusLabel === 'Approval Pending';
                                        return (
                                            <tr key={row.id} className="border-b border-[#F4F7FB] last:border-0">
                                                <td className={`${TD} text-[#94A3B8]`}>{index + 1}</td>
                                                <td className={`${TD} truncate font-medium`}>{row.title}</td>
                                                <td className={`${TD} truncate`}>{row.subtitle || '—'}</td>
                                                <td className={`${TD} whitespace-nowrap`}>{row.dateLabel || '—'}</td>
                                                <td className={`${TD} truncate`}>{row.owner || '—'}</td>
                                                <td className={TD}><TableTone label={statusLabel} /></td>
                                                <td className={TD}>
                                                    <button type="button" onClick={onOpenLeaveList} className={takeAction ? SOLID_BTN : OUTLINE_BTN}>
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
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-[#E6EDF5] bg-white">
                        <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] px-4 py-3">
                            <p className="text-[14px] font-bold text-[#1B2A4A]">Pending Employee Tasks</p>
                            <Link href="/dashboard" className="inline-flex shrink-0 items-center text-[13px] font-semibold text-[#2563EB]">
                                View All Tasks <ChevronRight size={16} />
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#EEF2F6]">
                                        <th className={`${TH} w-10`}>#</th>
                                        <th className={TH}>Task Number</th>
                                        <th className={TH}>Task Name</th>
                                        <th className={TH}>Task Type</th>
                                        <th className={TH}>Assigned To</th>
                                        <th className={TH}>Due Date</th>
                                        <th className={`${TH} w-[4.5rem]`}>Priority</th>
                                        <th className={`${TH} w-[5.5rem]`}>Status</th>
                                        <th className={`${TH} w-[4.5rem]`}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workTasks.length ? workTasks.map((task, index) => (
                                        <tr key={task.id} className="border-b border-[#F4F7FB] last:border-0">
                                            <td className={`${TD} text-[#94A3B8]`}>{index + 1}</td>
                                            <td className={`${TD} truncate font-medium`}>{task.taskNumber || String(task.id || '').slice(-8) || '—'}</td>
                                            <td className={`${TD} truncate font-medium`}>{task.title || 'Task'}</td>
                                            <td className={`${TD} truncate`}>{task.taskType || task.kind || '—'}</td>
                                            <td className={`${TD} truncate`}>{employee.name || task.requesterName || '—'}</td>
                                            <td className={`${TD} whitespace-nowrap`}>{task.dueDate || '—'}</td>
                                            <td className={TD}>{task.priority ? <TableTone label={task.priority} /> : <span className="text-[13px] text-[#94A3B8]">—</span>}</td>
                                            <td className={TD}><TableTone label={task.status || 'Pending'} /></td>
                                            <td className={TD}>
                                                <Link href={taskHref(task, employeeMongoId)} className={OUTLINE_BTN}>Open</Link>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={9} className="px-3 py-3 text-[13px] text-[#94A3B8]">No pending tasks.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
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
                </div>
            </div>
        </div>
    );
}
