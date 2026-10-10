'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    CalendarDays,
    Check,
    ChevronRight,
    Clock,
    Paperclip,
    Plane,
    Stethoscope,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { weekForStaffType, workLocationLabel } from '@/utils/workLocations';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { getEmployeeInitials } from '@/utils/employeeProfileImage';
import EmployeeInformationDashboard from './EmployeeInformationDashboard';
import HistoricalSalarySetupView from '@/app/HRM/Salary/enroll/HistoricalSalarySetupView';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { salaryRegisterHref } from '@/app/HRM/Salary/utils/salaryRegisterHref';
import { employeeDataMetrics } from '@/app/HRM/Leave/utils/employeeDataMetrics';
import CompOffSettleModal from '@/app/HRM/Attendance/components/CompOffSettleModal';

const DATA_ROWS = [
    {
        key: 'on_leave',
        label: 'Annual leave',
        Icon: Plane,
        iconWrap: 'bg-[#DCEBFF] text-[#2563EB]',
        statusKeys: ['on_leave'],
    },
    {
        key: 'authorized_leave',
        label: 'Authorized leave',
        Icon: Check,
        iconWrap: 'bg-[#D8F5DE] text-[#1F7A3A]',
        statusKeys: ['authorized_leave'],
    },
    {
        key: 'unauthorized_leave',
        label: 'Unauthorized leave',
        Icon: AlertTriangle,
        iconWrap: 'bg-[#F8D5D5] text-[#B42318]',
        statusKeys: ['unauthorized_leave'],
    },
    {
        key: 'sick_leave',
        label: 'Sick leave',
        Icon: Stethoscope,
        iconWrap: 'bg-[#E8D9F8] text-[#6B3FA0]',
        statusKeys: ['sick_leave'],
    },
    {
        key: 'compoff_leave',
        label: 'Comp off leave',
        Icon: CalendarDays,
        iconWrap: 'bg-[#EDE9FE] text-[#6D28D9]',
        statusKeys: ['compoff_leave'],
    },
    {
        key: 'late_early',
        label: 'Late arrival / Early go',
        Icon: Clock,
        iconWrap: 'bg-[#FDE7D0] text-[#C05621]',
        statusKeys: ['late_arrived', 'early_go'],
    },
    {
        key: 'mispunch',
        label: 'Miss punch',
        Icon: Clock,
        iconWrap: 'bg-[#DCEBFF] text-[#2563EB]',
        statusKeys: ['mispunch'],
    },
    {
        key: 'attendance',
        label: 'Attendance',
        Icon: BarChart3,
        iconWrap: 'bg-[#D8F5DE] text-[#1F7A3A]',
        statusKeys: [
            'on_office',
            'work_from_home',
            'unauthorized_leave',
            'authorized_leave',
            'sick_leave',
            'on_leave',
            'compoff_leave',
        ],
    },
];

const DATA_ROW_LABEL = {
    ...Object.fromEntries(DATA_ROWS.map((row) => [row.key, row.label])),
    late_arrived: 'Late arrival',
    early_go: 'Early go',
    on_office: 'Present days',
    work_from_home: 'Work from home',
};
const DEDUCTION_EVENT_KEYS = ['authorized_leave', 'unauthorized_leave', 'late_arrived', 'early_go'];
const DEFAULT_TAKEN_COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'detail', label: 'Detail' },
    { key: 'amount', label: 'Amount', align: 'right', wide: true },
];
const DEDUCTION_COLUMNS = [
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'date', label: 'Date' },
];

function n(value) {
    return Number(value) || 0;
}

function currentDubaiYear() {
    return Number(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dubai',
            year: 'numeric',
        }).format(new Date()),
    );
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
    const a = new Date(`${from}T00:00:00Z`);
    const b = new Date(`${to}T00:00:00Z`);
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function formatLeaveDate(dateKey) {
    const key = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '—';
    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function mergeAnnualLeaveDates(dates) {
    const sorted = [...new Set((dates || []).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)))].sort();
    const ranges = [];
    for (const date of sorted) {
        const last = ranges[ranges.length - 1];
        if (last && shiftDateKey(last.to, 1) === date) {
            last.to = date;
            last.days += 1;
            continue;
        }
        ranges.push({
            id: `att-${date}`,
            from: date,
            to: date,
            days: 1,
            year: date.slice(0, 4),
        });
    }
    return ranges;
}

function annualLeavePeriodFromRecord(row, index) {
    const from = String(row?.fromDate || row?.startDate || '').trim().slice(0, 10);
    const to = String(row?.toDate || row?.endDate || from).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : from;
    const days =
        n(row?.calendarDays) ||
        n(row?.actualDays) ||
        n(row?.eligibleWorkingDays) ||
        inclusiveDays(from, end);
    return {
        id: String(row?.id || row?._id || `hist-${from}-${end}-${index}`),
        from,
        to: end,
        days,
        year: from.slice(0, 4),
    };
}

function combineAnnualLeavePeriods(attendanceRanges, historicalRows) {
    const byKey = new Map();
    for (const row of attendanceRanges || []) {
        byKey.set(`${row.from}|${row.to}`, row);
    }
    (historicalRows || []).forEach((row, index) => {
        const period = annualLeavePeriodFromRecord(row, index);
        if (!period) return;
        const key = `${period.from}|${period.to}`;
        if (!byKey.has(key)) byKey.set(key, period);
    });
    return [...byKey.values()].sort((a, b) => String(b.from).localeCompare(String(a.from)));
}

function formatAed(value) {
    const amount = Number(value) || 0;
    return `AED ${Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function isApprovedFinancialRow(row) {
    const s = String(row?.status || '').toLowerCase();
    if (!s) return false;
    if (s.includes('pending') || s.includes('draft') || s.includes('reject') || s.includes('cancel')) {
        return false;
    }
    return (
        s === 'approved' ||
        s.startsWith('approved') ||
        s === 'paid' ||
        s.includes('(paid)') ||
        s === 'active' ||
        s === 'completed' ||
        s === 'recovered'
    );
}

function approvedFinancialRows(list) {
    return (Array.isArray(list) ? list : []).filter(isApprovedFinancialRow);
}

function formatSignedAed(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return `+ ${formatAed(amount)}`;
    if (amount < 0) return `− ${formatAed(amount)}`;
    return formatAed(0);
}

function detailBits(...parts) {
    return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' · ');
}

const FINANCIAL_MODAL_META = {
    salary: { title: 'Salary', hint: 'Salary periods · click a row for salary history' },
    increment: { title: 'Latest increment', hint: 'Salary increases · click a row for salary history' },
    advance: { title: 'Advance', hint: 'Taken advances · click a row to open the record' },
    loan: { title: 'Loan', hint: 'Taken loans · click a row to open the record' },
    rewards: { title: 'Rewards earned', hint: 'Taken rewards · click a row to open the record' },
    fines: { title: 'Fines', hint: 'Taken fines · click a row to open the record' },
    utility: { title: 'Utility excess', hint: 'Taken utility bills · click a row to open the bill' },
    deductions: {
        title: 'Deductions',
        hint: 'Authorized, unauthorized and attendance deductions · click a row for salary history',
        columns: DEDUCTION_COLUMNS,
    },
};

function deductionTypeLabel(event) {
    const key = String(event?.statusKey || '').trim();
    if (key === 'sick_leave') return 'Sick leave (paid)';
    if (key === 'authorized_leave') return 'Authorized leave';
    if (key === 'unauthorized_leave') return 'Unauthorized leave';
    return DATA_ROW_LABEL[key] || event?.statusLabel || key || 'Deduction';
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function deductFraction(deduct) {
    const key = String(deduct || '').trim().toLowerCase();
    if (key === 'full') return 1;
    if (key === 'half') return 0.5;
    if (key === 'quarter') return 0.25;
    return 0;
}

function chargeableUnits(totalEvents, policyEvents) {
    const total = Math.max(0, Math.floor(Number(totalEvents) || 0));
    const per = Number(policyEvents);
    if (!Number.isFinite(per) || per <= 0) return total;
    if (total <= per) return 0;
    return Math.floor((total - 1) / per);
}

function clockToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
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
    if (!week || String(week.timingMode || '').toLowerCase() === 'flexible') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
    const day = week[WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00Z`).getUTCDay()]];
    if (!day || day.isOffDay) return null;
    const start = dayPartToMinutes(day, 'start');
    const end = dayPartToMinutes(day, 'end');
    if (start == null || end == null || end <= start) return null;
    return { start, end };
}

function ruleDirection(rule) {
    const title = String(rule?.title || '').toLowerCase();
    if (/late\s*out|early\s*out|early/.test(title)) return 'out';
    if (/late\s*in/.test(title)) return 'in';
    return '';
}

function isMispunchTitle(title) {
    return /miss(?:ed)?[\s-]*punch|mis[\s-]*punch/i.test(String(title || ''));
}

function salaryCutPhrase(days) {
    const fraction = Math.round((Number(days) || 0) * 100) / 100;
    if (!fraction) return 'No salary cut';
    if (fraction === 0.25) return '1/4 salary cut';
    if (fraction === 0.5) return '1/2 salary cut';
    if (fraction === 0.75) return '3/4 salary cut';
    if (fraction === 1) return '1 salary cut';
    if (fraction === 1.5) return '1 1/2 salary cut';
    if (fraction === 2) return '2 salary cut';
    return `${fraction} salary cut`;
}

function formatSalaryCut(days, monthlySalary) {
    const phrase = salaryCutPhrase(days);
    const monthly = n(monthlySalary);
    if (!days || monthly <= 0) return phrase;
    return `${phrase} · ${formatAed((monthly / 30) * days)}`;
}

function leavePortion(event) {
    const part = String(event?.leaveRequestDayPart || '').trim().toLowerCase();
    if (part === 'half') return 0.5;
    if (part === 'quarter') return 0.25;
    const fraction = Number(event?.leaveDayFraction);
    if (fraction > 0 && fraction < 1) return fraction;
    return 1;
}

function lateGapMinutes(event, week, direction) {
    const shift = shiftForDate(week, event?.date);
    if (!shift) return null;
    if (direction === 'in') {
        const actual = clockToMinutes(event?.timeIn);
        return actual == null ? null : actual - shift.start;
    }
    const actual = clockToMinutes(event?.timeOut);
    return actual == null ? null : shift.end - actual;
}

function highestExtraRule(rules, direction, minutes) {
    if (minutes == null || minutes <= 0) return null;
    return (Array.isArray(rules) ? rules : [])
        .map((rule, index) => ({ rule, index, direction: ruleDirection(rule) }))
        .filter(
            (row) =>
                row.direction === direction &&
                deductFraction(row.rule?.deduct) > 0 &&
                !isMispunchTitle(row.rule?.title) &&
                minutes >= Math.max(0, Number(row.rule?.minutes) || 0),
        )
        .sort((a, b) => (Number(b.rule?.minutes) || 0) - (Number(a.rule?.minutes) || 0))[0] || null;
}

function addedCutDays(nextCount, rule) {
    const before = chargeableUnits(nextCount - 1, rule?.events);
    const after = chargeableUnits(nextCount, rule?.events);
    return Math.max(0, after - before) * deductFraction(rule?.deduct);
}

function leaveCutDays(event, policy) {
    const key = String(event?.statusKey || '');
    const portion = leavePortion(event);
    const doubled = Number(event?.leaveDeductionTimes) === 2 ? 2 : 1;
    if (key === 'authorized_leave') {
        const times = policy?.authorizedDeductionDays == null ? 1 : n(policy.authorizedDeductionDays);
        return portion * times * doubled;
    }
    if (key === 'unauthorized_leave') {
        const times = policy?.unauthorizedDeductionDays == null ? 2 : n(policy.unauthorizedDeductionDays);
        return portion * times * doubled;
    }
    return null;
}

function deductionCutTexts(events, policy, week) {
    const texts = new Map();
    const byMonth = new Map();
    for (const event of events || []) {
        const month = String(event?.date || '').slice(0, 7);
        if (!byMonth.has(month)) byMonth.set(month, []);
        byMonth.get(month).push(event);
    }
    for (const rows of byMonth.values()) {
        const ordered = [...rows].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        let sharedCount = 0;
        const extraCounts = new Map();
        for (const event of ordered) {
            const leaveDays = leaveCutDays(event, policy);
            if (leaveDays != null) {
                texts.set(event.id, leaveDays);
                continue;
            }
            const key = String(event?.statusKey || '');
            const direction = key === 'early_go' ? 'out' : key === 'late_arrived' ? 'in' : '';
            if (!direction) {
                texts.set(event.id, 0);
                continue;
            }
            const extra = highestExtraRule(policy?.extraLateRules, direction, lateGapMinutes(event, week, direction));
            if (extra) {
                const next = (extraCounts.get(extra.index) || 0) + 1;
                extraCounts.set(extra.index, next);
                texts.set(event.id, addedCutDays(next, extra.rule));
                continue;
            }
            sharedCount += 1;
            texts.set(event.id, addedCutDays(sharedCount, policy?.lateRule));
        }
    }
    return texts;
}

function financialTakenRows(key, ctx) {
    const salaryHref = ctx.salaryHref;
    if (key === 'salary') {
        const rows = (ctx.salaryHistory || []).map((row) => ({
            id: row.id,
            date: row.dateLabel || row.month || '—',
            detail: detailBits(row.month, row.toLabel ? `To ${row.toLabel}` : '', `Basic ${formatAed(row.basic)}`),
            amount: formatAed(row.total),
            href: salaryHref,
        }));
        if (rows.length) return rows;
        if (n(ctx.monthlySalary)) {
            return [
                {
                    id: 'current-salary',
                    date: 'Current',
                    detail: detailBits(
                        `Basic ${formatAed(ctx.salary?.basic)}`,
                        `Other ${formatAed(ctx.salaryOther)}`,
                    ),
                    amount: formatAed(ctx.monthlySalary),
                    href: salaryHref,
                },
            ];
        }
        return [];
    }
    if (key === 'increment') {
        return (ctx.increments || []).map((row) => ({
            id: row.id,
            date: row.dateLabel || '—',
            detail: `From ${formatAed(row.fromTotal)} to ${formatAed(row.toTotal)}`,
            amount: formatSignedAed(row.amount),
            href: salaryHref,
        }));
    }
    if (key === 'advance' || key === 'loan') {
        const items = key === 'advance' ? ctx.advances : ctx.loans;
        const path = '/HRM/LoanAndAdvance';
        return (items || []).map((row) => ({
            id: row.id,
            date: row.dateLabel || '—',
            detail: detailBits(row.code, row.reason, row.status),
            amount: formatAed(row.outstanding || row.total),
            href: `${path}/${encodeURIComponent(row.id)}`,
        }));
    }
    if (key === 'rewards') {
        return (ctx.rewards || []).map((row) => ({
            id: row.id,
            date: row.dateLabel || '—',
            detail: detailBits(row.code, row.type, row.status),
            amount: formatAed(row.amount),
            href: `/HRM/Reward/${encodeURIComponent(row.id)}`,
        }));
    }
    if (key === 'fines') {
        return (ctx.fines || []).map((row) => ({
            id: row.id,
            date: row.dateLabel || '—',
            detail: detailBits(row.code, row.type, row.status),
            amount: formatAed(row.outstanding || row.total),
            href: `/HRM/Fine/${encodeURIComponent(row.id)}`,
        }));
    }
    if (key === 'utility') {
        return (ctx.utilityItems || []).map((row) => ({
            id: row.id,
            date: row.billMonthLabel || row.billMonth || '—',
            detail: detailBits(row.utilityType, row.status),
            amount: formatAed(row.amount),
            href: `/HRM/Asset/UtilityBills/details/${encodeURIComponent(row.id)}`,
        }));
    }
    if (key === 'deductions') {
        const events = ctx.deductionEvents || [];
        const cuts = deductionCutTexts(events, ctx.leavePolicy, ctx.scheduleWeek);
        return events.map((event) => ({
            id: event.id,
            type: deductionTypeLabel(event),
            date: formatLeaveDate(event.date),
            amount: formatSalaryCut(cuts.get(event.id) || 0, ctx.monthlySalary),
            href: salaryHref,
        }));
    }
    return [];
}

function ProfileHero({ employee, year, presentDays, nextBirthday }) {
    const nameParts = String(employee?.name || '').trim().split(/\s+/);
    const initials = getEmployeeInitials(nameParts[0], nameParts.slice(1).join(' '));
    const staffLabel = `${workLocationLabel(employee?.staffType)} staff`;
    const isActive = employee?.isActive !== false;

    return (
        <div
            className="rounded-2xl px-4 sm:px-5 py-3.5 mb-4 overflow-hidden text-white"
            style={{
                background: 'linear-gradient(105deg, #0C2238 0%, #14344C 52%, #1A5F62 100%)',
            }}
        >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-[#C5E4F7] text-[#1B4F72] flex items-center justify-center text-sm font-black">
                            {initials}
                        </div>
                        <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#14344C] ${
                                isActive ? 'bg-[#34C759]' : 'bg-slate-400'
                            }`}
                        />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate uppercase text-white">
                            {employee?.name || 'Employee'}
                        </h1>
                        <p className="text-sm text-white/65 mt-0.5 truncate">
                            {staffLabel}
                            {employee?.employeeId ? (
                                <>
                                    {' | '}
                                    <Link
                                        href={`/emp/${employee.employeeId}`}
                                        className="hover:text-white hover:underline"
                                    >
                                        {employee.employeeId}
                                    </Link>
                                </>
                            ) : null}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 min-w-0 xl:flex-1 xl:max-w-3xl xl:px-4">
                    {[
                        { label: 'Designation', value: employee?.designation || '—' },
                        { label: 'Years of Service', value: employee?.yearsOfServiceLabel || '—' },
                        { label: 'Reports To', value: employee?.reportsTo || '—' },
                        { label: 'Birthday', value: employee?.birthdayLabel || '—' },
                    ].map((item, index) => (
                        <div
                            key={item.label}
                            className={`min-w-0 px-3 sm:px-4 ${
                                index % 2 === 1 ? 'border-l border-white/25' : ''
                            } ${index > 0 ? 'lg:border-l lg:border-white/25' : ''}`}
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                                {item.label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white truncate">{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className="shrink-0 xl:text-right space-y-1.5">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isActive
                                ? 'bg-[#2F9E6B] text-white'
                                : 'bg-white/15 text-white/80'
                        }`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {isActive ? 'Active' : employee?.status || 'Inactive'}
                    </span>
                    {nextBirthday?.name ? (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                            Next birthday
                            <span className="block mt-0.5 text-[12px] font-semibold normal-case tracking-normal text-white/90">
                                {nextBirthday.name} — {nextBirthday.dateLabel}
                            </span>
                        </p>
                    ) : null}
                    <p className="text-[12px] font-medium text-white/80">
                        {n(presentDays)} present days in {year}
                    </p>
                </div>
            </div>
        </div>
    );
}

function EventsDetailPanel({ title, events, onClose, onOpenCompOff }) {
    return (
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{events.length} record(s)</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-4.5rem)] px-5 py-3">
                    {events.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6 text-center">No records for this category.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {events.map((event) => (
                                <li key={event.id} className="py-3">
                                    {event.statusKey === 'compoff_leave' && onOpenCompOff ? (
                                        <button
                                            type="button"
                                            onClick={() => onOpenCompOff(event)}
                                            className="text-sm font-semibold text-violet-700 hover:underline"
                                        >
                                            {event.date}
                                            {event.adjusted ? (
                                                <span className="ml-1.5 text-[11px] font-semibold" title={event.adjustWith ? `Adjusted with ${event.adjustWith}` : 'Adjusted from overtime'}>
                                                    (Adj)
                                                </span>
                                            ) : null}
                                        </button>
                                    ) : (
                                        <p className="text-sm font-semibold text-gray-900">
                                            {event.date}
                                            {event.adjusted ? (
                                                <span className="ml-1.5 text-[11px] font-semibold text-violet-700" title={event.adjustWith ? `Adjusted with ${event.adjustWith}` : 'Adjusted from overtime'}>
                                                    (Adj)
                                                </span>
                                            ) : null}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-0.5">{event.statusLabel}</p>
                                    {event.reason ? (
                                        <p className="text-sm text-gray-700 mt-2">{event.reason}</p>
                                    ) : null}
                                    {event.leavePayType ? (
                                        <p className="text-xs text-gray-500 mt-1 capitalize">
                                            Pay type: {event.leavePayType}
                                        </p>
                                    ) : null}
                                    {event.attachmentName ? (
                                        <p className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2">
                                            <Paperclip size={12} />
                                            {event.attachmentName}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function AnnualLeavePeriodsModal({ open, periods, loading, onClose, onSelect }) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Annual leave</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {loading ? 'Loading records…' : `${periods.length} record(s) · click a row for salary history`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-4.5rem)]">
                    {loading ? (
                        <p className="text-sm text-gray-500 py-10 text-center">Loading annual leave…</p>
                    ) : periods.length === 0 ? (
                        <p className="text-sm text-gray-500 py-10 text-center">No annual leave records.</p>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-slate-50 border-b border-gray-100">
                                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-2.5 font-semibold">Date from</th>
                                    <th className="px-3 py-2.5 font-semibold">To</th>
                                    <th className="px-3 py-2.5 font-semibold">Days</th>
                                    <th className="px-3 py-2.5 font-semibold">Year</th>
                                    <th className="px-5 py-2.5 w-8" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {periods.map((row) => (
                                    <tr key={row.id}>
                                        <td colSpan={5} className="p-0">
                                            <button
                                                type="button"
                                                onClick={() => onSelect(row)}
                                                className="w-full grid grid-cols-[1fr_1fr_4.5rem_4.5rem_2rem] items-center px-5 py-3 text-left hover:bg-slate-50/90"
                                            >
                                                <span className="text-sm font-semibold text-[#1B2A4A]">
                                                    {formatLeaveDate(row.from)}
                                                </span>
                                                <span className="text-sm font-semibold text-[#1B2A4A]">
                                                    {formatLeaveDate(row.to)}
                                                </span>
                                                <span className="text-sm font-bold tabular-nums text-[#1B2A4A]">
                                                    {row.days}
                                                </span>
                                                <span className="text-sm font-semibold tabular-nums text-slate-600">
                                                    {row.year}
                                                </span>
                                                <ChevronRight size={16} className="text-slate-300 justify-self-end" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function TakenItemsModal({ open, title, hint, rows, columns, onClose, onSelect }) {
    if (!open) return null;
    const cols = columns?.length ? columns : DEFAULT_TAKEN_COLUMNS;
    const useCells = cols.some((col) => col.cell);
    return (
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className={`bg-white rounded-2xl shadow-2xl w-full max-h-[80vh] overflow-hidden border border-gray-200 ${useCells ? 'max-w-3xl' : 'max-w-2xl'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {hint || `${rows.length} record(s)`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-4.5rem)]">
                    {rows.length === 0 ? (
                        <p className="text-sm text-gray-500 py-10 text-center">No records.</p>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-slate-50 border-b border-gray-100">
                                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {cols.map((col) => (
                                        <th
                                            key={col.key}
                                            className={`${useCells ? 'whitespace-nowrap ' : ''}px-3 py-2.5 font-semibold first:pl-5 ${
                                                col.align === 'right' ? 'text-right' : ''
                                            }`}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-5 py-2.5 w-8" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map((row) => {
                                    const linked = Boolean(String(row?.href || '').trim());
                                    if (useCells) {
                                        return (
                                            <tr
                                                key={row.id}
                                                onClick={() => linked && onSelect(row)}
                                                onKeyDown={(event) => {
                                                    if (!linked) return;
                                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                                    event.preventDefault();
                                                    onSelect(row);
                                                }}
                                                tabIndex={linked ? 0 : undefined}
                                                role={linked ? 'button' : undefined}
                                                className={linked ? 'cursor-pointer hover:bg-slate-50/90' : undefined}
                                            >
                                                {cols.map((col) => (
                                                    <td
                                                        key={col.key}
                                                        className={`px-3 py-3 text-sm whitespace-nowrap text-[#1B2A4A] first:pl-5 ${
                                                            col.align === 'right'
                                                                ? 'text-right font-bold tabular-nums'
                                                                : 'font-semibold tabular-nums'
                                                        }`}
                                                    >
                                                        {row[col.key] || '—'}
                                                    </td>
                                                ))}
                                                <td className="w-8 pr-5 text-right">
                                                    {linked ? <ChevronRight size={16} className="ml-auto text-slate-300" /> : null}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    return (
                                    <tr key={row.id}>
                                        <td colSpan={cols.length + 1} className="p-0">
                                            <button
                                                type="button"
                                                onClick={() => linked && onSelect(row)}
                                                className={`w-full flex items-center px-5 py-3 text-left gap-3 ${linked ? 'hover:bg-slate-50/90' : 'cursor-default'}`}
                                            >
                                                {cols.map((col) => (
                                                    <span
                                                        key={col.key}
                                                        className={`text-sm min-w-0 ${
                                                            col.key === 'type' || col.key === 'detail'
                                                                ? 'flex-1 font-semibold text-[#1B2A4A] truncate'
                                                                : col.align === 'right'
                                                                  ? `${col.wide ? 'w-56' : 'w-40'} shrink-0 font-bold tabular-nums text-[#1B2A4A] text-right whitespace-normal leading-snug`
                                                                  : 'w-28 shrink-0 font-semibold text-[#1B2A4A]'
                                                        }`}
                                                    >
                                                        {row[col.key] || '—'}
                                                    </span>
                                                ))}
                                                {linked ? <ChevronRight size={16} className="text-slate-300 shrink-0" /> : <span className="w-4 shrink-0" />}
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function downloadSummaryCsv(profile) {
    const counts = profile?.summary?.counts || {};
    const ctx = {
        counts,
        leaveBalances: profile?.leaveBalances || {},
        requestStats: profile?.summary?.requestStats || {},
        leavePolicy: profile?.leavePolicy || {},
        annualLeave: profile?.annualLeave || {},
        enrollAttendance: profile?.summary?.enrollAttendance || {},
        presentDays: n(profile?.summary?.presentDays),
        absentDays: n(profile?.summary?.enrollAttendance?.absent ?? profile?.summary?.absentDays),
        yearCard: profile?.summary?.yearCard || null,
    };
    const rows = [
        ['Leave type', 'Metric 1', 'Value 1', 'Metric 2', 'Value 2', 'Metric 3', 'Value 3'],
        ...DATA_ROWS.map((row) => {
            const metrics = employeeDataMetrics(row, ctx);
            return [
                row.label,
                metrics[0]?.label || '',
                String(metrics[0]?.value ?? ''),
                metrics[1]?.label || '',
                String(metrics[1]?.value ?? ''),
                metrics[2]?.label || '',
                String(metrics[2]?.value ?? ''),
            ];
        }),
    ];
    const csv = rows.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile?.employee?.employeeId || 'employee'}-leave-${profile?.year || ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function EmployeeAttendanceProfileView({ employeeMongoId }) {
    const router = useRouter();
    const pathname = usePathname();
    const [year, setYear] = useState(currentDubaiYear);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);
    const [expandedStatKey, setExpandedStatKey] = useState('');
    const [annualLeaveOpen, setAnnualLeaveOpen] = useState(false);
    const [financialModalKey, setFinancialModalKey] = useState('');
    const [deductionList, setDeductionList] = useState(null);
    const [historicalAnnualLeave, setHistoricalAnnualLeave] = useState([]);
    const [historicalAnnualLoading, setHistoricalAnnualLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('attendance');
    const [salaryTabVisited, setSalaryTabVisited] = useState(false);
    const [compOffDate, setCompOffDate] = useState('');
    const [categoryRows, setCategoryRows] = useState(null);
    const [workingTime, setWorkingTime] = useState(null);

    const fetchProfile = useCallback(async () => {
        if (!employeeMongoId) return;
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get(
                `/Leave/employees/${employeeMongoId}/attendance-profile`,
                { params: { year }, skipToast: true },
            );
            setProfile(response.data || null);
        } catch (err) {
            setProfile(null);
            setError(err?.response?.data?.message || err.message || 'Failed to load profile.');
        } finally {
            setLoading(false);
        }
    }, [employeeMongoId, year]);

    useEffect(() => {
        setProfile(null);
        setExpandedStatKey('');
        setAnnualLeaveOpen(false);
        setFinancialModalKey('');
        setHistoricalAnnualLeave([]);
        setCategoryRows(null);
        setActiveTab('attendance');
        setSalaryTabVisited(false);
    }, [employeeMongoId]);

    useEffect(() => {
        if (!employeeMongoId) return;
        fetchProfile();
    }, [employeeMongoId, fetchProfile]);

    useEffect(() => {
        let cancelled = false;
        axiosInstance
            .get('/WorkingTime', { skipToast: true })
            .then((response) => {
                if (!cancelled) setWorkingTime(response.data?.workingTime || response.data || null);
            })
            .catch(() => {
                if (!cancelled) setWorkingTime(null);
            });
        return () => {
            cancelled = true;
        };
    }, [employeeMongoId]);

    const eventsByKey = useMemo(() => {
        const map = {};
        const yearPrefix = profile?.year ? `${profile.year}-` : '';
        for (const row of DATA_ROWS) map[row.key] = [];
        for (const event of profile?.events || []) {
            const statusKey = event.statusKey;
            if (statusKey === 'compoff_leave') {
                const date = String(event.date || '').trim();
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
                if (yearPrefix && !date.startsWith(yearPrefix)) continue;
            }
            if (!map[statusKey]) map[statusKey] = [];
            map[statusKey].push(event);
            for (const row of DATA_ROWS) {
                if (row.key === statusKey) continue;
                if ((row.statusKeys || []).includes(statusKey)) map[row.key].push(event);
            }
        }
        return map;
    }, [profile?.events, profile?.year]);

    const expandedEvents = expandedStatKey ? eventsByKey[expandedStatKey] || [] : [];
    const expandedLabel = DATA_ROWS.find((row) => row.key === expandedStatKey)?.label || '';

    const attendanceAnnualPeriods = useMemo(
        () => mergeAnnualLeaveDates((eventsByKey.on_leave || []).map((event) => event.date)),
        [eventsByKey.on_leave],
    );

    const annualLeavePeriods = useMemo(
        () => combineAnnualLeavePeriods(attendanceAnnualPeriods, historicalAnnualLeave),
        [attendanceAnnualPeriods, historicalAnnualLeave],
    );

    useEffect(() => {
        if (!annualLeaveOpen) return undefined;
        const employeeId = String(profile?.employee?.employeeId || '').trim();
        if (!employeeId) {
            setHistoricalAnnualLeave([]);
            return undefined;
        }
        let cancelled = false;
        setHistoricalAnnualLoading(true);
        axiosInstance
            .get(`/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical`, {
                skipToast: true,
            })
            .then((res) => {
                if (cancelled) return;
                setHistoricalAnnualLeave(
                    Array.isArray(res.data?.annualLeaveRecords) ? res.data.annualLeaveRecords : [],
                );
            })
            .catch(() => {
                if (!cancelled) setHistoricalAnnualLeave([]);
            })
            .finally(() => {
                if (!cancelled) setHistoricalAnnualLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [annualLeaveOpen, profile?.employee?.employeeId]);

    function openSalaryHistory() {
        const code = String(profile?.employee?.employeeId || '').trim();
        if (!code) return;
        setAnnualLeaveOpen(false);
        setFinancialModalKey('');
        setActiveTab('salary');
        setSalaryTabVisited(true);
    }

    function openFinancialItem(row) {
        const href = String(row?.href || '').trim();
        setFinancialModalKey('');
        if (!href) return;
        const returnHref =
            typeof window !== 'undefined'
                ? `${pathname || ''}${window.location.search || ''}`
                : pathname;
        navigateFromList(router, href, returnHref);
    }

    const navigateHrm = (path) => {
        router.push(path);
    };

    const employee = profile?.employee;
    const annualLeaveCalendarHref = useMemo(() => {
        const params = new URLSearchParams();
        const code = String(employee?.employeeId || '').trim();
        const name = String(employee?.name || '').trim();
        if (code) params.set('employeeId', code);
        if (name) params.set('employeeName', name);
        const query = params.toString();
        return query ? `/HRM/Leave/annual-leave?${query}` : '/HRM/Leave/annual-leave';
    }, [employee?.employeeId, employee?.name]);
    const financial = profile?.financial || {};
    const salary = financial.salary || {};
    const yearPresentDays = n(profile?.summary?.yearPresentDays ?? profile?.summary?.counts?.on_office);
    const loans = approvedFinancialRows(financial.loans);
    const advances = approvedFinancialRows(financial.advances);
    const fines = approvedFinancialRows(financial.fines);
    const rewards = approvedFinancialRows(financial.rewards);
    const utilityItems = approvedFinancialRows(financial.utilityItems);
    const monthlySalary = n(salary.monthlySalary) || n(salary.totalSalary);
    const salaryOther = n(salary.other) || Math.max(0, monthlySalary - n(salary.basic));
    const employeeCode = String(employee?.employeeId || '').trim();
    const salaryHref = employeeCode
        ? `/HRM/Salary/enroll/${encodeURIComponent(employeeCode)}`
        : '';
    const payrollRegisterHref = salaryRegisterHref({ employeeId: employeeCode });

    function portalReturnHref() {
        return typeof window !== 'undefined'
            ? `${pathname || ''}${window.location.search || ''}`
            : pathname;
    }

    function openFilteredSalaryRegister() {
        navigateFromList(router, payrollRegisterHref, portalReturnHref());
    }
    const financialModalMeta = FINANCIAL_MODAL_META[financialModalKey] || null;
    const usingDeductionList = financialModalKey === 'deductions' && deductionList;
    const deductionColumns = [
        { key: 'date', label: 'Date', cell: true },
        { key: 'type', label: 'Type', cell: true },
        { key: 'in', label: 'In', cell: true },
        { key: 'out', label: 'Out', cell: true },
        { key: 'lossHrs', label: 'Loss of hrs', cell: true },
        { key: 'amount', label: 'Loss of pay', align: 'right', cell: true },
    ];
    const financialModalRows = usingDeductionList
        ? deductionList.rows || []
        : financialTakenRows(financialModalKey, {
        salaryHref,
        salary,
        salaryOther,
        monthlySalary,
        leaveBalances: profile?.leaveBalances || {},
        leavePolicy: profile?.leavePolicy || {},
        scheduleWeek: weekForStaffType(workingTime, employee?.staffType),
        salaryHistory: financial.salaryHistory || [],
        increments: financial.increments || [],
        advances,
        loans,
        rewards,
        fines,
        utilityItems,
        deductionEvents: DEDUCTION_EVENT_KEYS.flatMap((key) => eventsByKey[key] || []).sort((a, b) =>
            String(b.date || '').localeCompare(String(a.date || '')),
        ),
    });

    if (loading && !profile) {
        return <div className="py-16 text-center text-sm text-gray-500">Loading HR profile...</div>;
    }

    if (error && !profile) {
        return <ErpErrorBanner className="mb-4" message={error} onRetry={fetchProfile} />;
    }

    if (!profile) return null;

    return (
        <>
            {activeTab === 'salary' ? (
                <div className="mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab('attendance')}
                        className="mb-3 text-sm font-semibold text-[#2563EB]"
                    >
                        Back to attendance dashboard
                    </button>
                    <ProfileHero
                        employee={employee}
                        year={profile.year}
                        presentDays={yearPresentDays}
                        nextBirthday={profile.nextBirthday}
                    />
                </div>
            ) : (
                <EmployeeInformationDashboard
                    employeeMongoId={employeeMongoId}
                    profile={profile}
                    annualCalendarHref={annualLeaveCalendarHref}
                    onYearChange={(nextYear) => {
                        if (nextYear && nextYear !== year) setYear(nextYear);
                    }}
                    onOpenAnnual={() => setAnnualLeaveOpen(true)}
                    onOpenCategory={(key, rows) => {
                        setCategoryRows(Array.isArray(rows) ? rows : []);
                        setExpandedStatKey(key);
                    }}
                    onDeductionDetails={setDeductionList}
                    onOpenFinancial={(key, extra) => {
                        setFinancialModalKey(key);
                        setDeductionList(key === 'deductions' ? extra || deductionList || { rows: [], hint: '' } : null);
                    }}
                    onDownload={() => downloadSummaryCsv(profile)}
                    onOpenPayroll={openFilteredSalaryRegister}
                    onOpenSalary={() => {
                        setActiveTab('salary');
                        setSalaryTabVisited(true);
                    }}
                    onOpenLeaveList={() => navigateHrm('/HRM/Leave')}
                />
            )}

            {salaryTabVisited && employee?.employeeId ? (
                <div className={activeTab === 'salary' ? '' : 'hidden'}>
                    <HistoricalSalarySetupView
                        employeeId={employee.employeeId}
                        embedded
                    />
                </div>
            ) : activeTab === 'salary' ? (
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-12 text-center text-sm text-slate-500">
                    Salary setup is unavailable for this employee.
                </div>
            ) : null}

            {expandedStatKey && expandedStatKey !== 'on_leave' ? (
                <EventsDetailPanel
                    title={expandedLabel}
                    events={categoryRows ?? expandedEvents}
                    onClose={() => {
                        setExpandedStatKey('');
                        setCategoryRows(null);
                    }}
                    onOpenCompOff={(event) => setCompOffDate(String(event?.date || ''))}
                />
            ) : null}
            <CompOffSettleModal
                open={Boolean(compOffDate)}
                employeeMongoId={employeeMongoId}
                date={compOffDate}
                onClose={() => setCompOffDate('')}
                onChanged={fetchProfile}
            />
            <AnnualLeavePeriodsModal
                open={annualLeaveOpen}
                periods={annualLeavePeriods}
                loading={historicalAnnualLoading && annualLeavePeriods.length === 0}
                onClose={() => setAnnualLeaveOpen(false)}
                onSelect={openSalaryHistory}
            />
            <TakenItemsModal
                open={Boolean(financialModalMeta)}
                title={usingDeductionList ? 'Deduction details' : financialModalMeta?.title || ''}
                hint={
                    usingDeductionList
                        ? deductionList.hint || `${financialModalRows.length} record(s)`
                        : financialModalMeta
                          ? `${financialModalRows.length} record(s) · ${financialModalMeta.hint}`
                          : ''
                }
                rows={financialModalRows}
                columns={usingDeductionList ? deductionColumns : financialModalMeta?.columns}
                onClose={() => {
                    setFinancialModalKey('');
                    setDeductionList(null);
                }}
                onSelect={openFinancialItem}
            />
        </>
    );
}
