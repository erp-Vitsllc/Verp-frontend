'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Calendar,
    CalendarDays,
    Check,
    ChevronRight,
    ExternalLink,
    Eye,
    EyeOff,
    FileText,
    Info,
    Loader2,
    Lock,
    Pencil,
    Plus,
    RotateCcw,
    Undo2,
    Trash2,
    Wallet,
    X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import PaymentInvoiceModal from './LeavePaymentInvoiceDocument';
import { DatePicker, MonthPicker } from '@/components/ui/date-picker';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { hasPermission } from '@/utils/permissions';
import {
    addDays,
    calculateAnnualLeaveEntitlement,
    calculateHistoricalEligibility,
    consolidateCountOnlyLeaveRecords,
    formatLeaveMultiplier,
    inclusiveCalendarDays,
    isCountOnlyLeaveType,
    isDatedLeaveType,
    isOptionalDateLeaveType,
    leaveMultiplier,
    policyLeaveMultipliers,
    policyLeaveWorkingDays,
    policyTicketRate,
    resolveEntitlementCalculationStart,
    uniqueConsumingCycles,
    validateLeaveDates,
    workflowIsLocked,
    liveLeaveRecordsInProcessingWindow,
    overtimeHoursToDays,
    overtimeHoursRemainder,
    OVERTIME_HOURS_PER_DAY,
    roundMoney,
} from '../utils/salaryHistoricalCalculations';
import { notifySalaryPendingInboxChanged } from '../utils/salaryPendingInboxCount';
import SalaryPolicyRequiredModal from '../components/SalaryPolicyRequiredModal';
import { navigateFromList } from '@/utils/listReturnNavigation';
import SalarySlipPreviewPanel from './SalarySlipPreviewPanel';
import { salarySlipMonthHref } from './salarySlipEdit';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';
import { getUaeHolidaysBetween } from '@/app/Settings/FlowChart/utils/uaeHolidaysCatalog';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LEAVE_TYPES = [
    { key: 'sick', label: 'Sick Leave', color: '#F59E0B' },
    { key: 'authorized', label: 'Authorized', color: '#3B82F6' },
    { key: 'unauthorized', label: 'Unauthorized', color: '#EF4444' },
    { key: 'annual', label: 'Annual Leave', color: '#8B5CF6' },
    { key: 'holiday', label: 'Holiday', color: '#0F766E' },
];
const LEAVE_SOURCES = [
    { key: 'manual', label: 'Manual' },
    { key: 'system', label: 'System' },
];
const CARD =
    'rounded-[12px] border border-[#E6EAF0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6';

function prettyDateTime(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).formatToParts(date);
    const pick = (type) => parts.find((part) => part.type === type)?.value || '';
    const day = pick('day');
    const month = pick('month');
    const year = pick('year');
    const hour = pick('hour');
    const minute = pick('minute');
    const dayPeriod = (pick('dayPeriod') || '').toUpperCase();
    return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

function prettyDate(value) {
    if (!value) return '—';
    const parsed = ISO.test(value) ? parseISO(value) : new Date(value);
    if (!isValid(parsed)) return value;
    return format(parsed, 'd MMM yyyy');
}

function toMonthKey(value) {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : '';
}

function toMonthStartDate(value) {
    const month = toMonthKey(value);
    return month ? `${month}-01` : '';
}

function nextMonthStartDate(value) {
    const month = toMonthKey(value);
    if (!month) return '';
    const year = Number(month.slice(0, 4));
    const monthIndex = Number(month.slice(5, 7));
    if (monthIndex === 12) return `${year + 1}-01-01`;
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** First month whose 1st is after the joining date (VERP start is always day 1). */
function firstVerpMonthAfterJoining(joiningDate) {
    if (!ISO.test(joiningDate)) return '';
    const year = Number(joiningDate.slice(0, 4));
    const month = Number(joiningDate.slice(5, 7));
    if (month === 12) return `${year + 1}-01`;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** VERP start cannot be before the current month, or the month after joining. */
function earliestSelectableVerpMonth(joiningDate) {
    const afterJoining = firstVerpMonthAfterJoining(joiningDate);
    const current = currentMonthKey();
    if (!afterJoining) return current;
    return afterJoining > current ? afterJoining : current;
}

function formatSignedDays(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '0';
    return String(n);
}

function formatDeductionDays(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n === 0) return '0';
    return `− ${n}`;
}

function eligibilityLeaveDetailRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row, index) => {
        const from = row.fromDate || row.startDate || '';
        const to = row.toDate || row.endDate || from;
        const dated = ISO.test(String(from || '').trim());
        const date =
            !dated
                ? '—'
                : to && to !== from
                  ? `${prettyDate(from)} — ${prettyDate(to)}`
                  : prettyDate(from);
        return {
            key: String(row.id || `${leaveTypeKey(row)}-${from}-${index}`),
            date,
            type: leaveMeta(leaveTypeKey(row)).label,
            count: Number(row.deductionDays ?? row.deduction ?? row.eligibleWorkingDays ?? row.actualDays) || 0,
        };
    });
}

function eligibilityWorkingDayRows({ from, to, workingDays, weeklyOffs, calendarDays }) {
    const date =
        from && to ? `${prettyDate(from)} — ${prettyDate(to)}` : prettyDate(from || to) || '—';
    return [
        { key: 'calendar', date, type: 'Calendar days', count: Number(calendarDays) || 0 },
        { key: 'offs', date, type: 'Weekly offs excluded', count: Number(weeklyOffs) || 0 },
        { key: 'working', date, type: 'Working days', count: Number(workingDays) || 0 },
    ];
}

function signedDayCount(value) {
    const n = Number(value) || 0;
    if (n === 0) return '0';
    return n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`;
}

function formatHoursLabel(value) {
    const n = Math.max(0, Number(value) || 0);
    const rounded = Math.round(n * 10) / 10;
    return `${rounded} h`;
}

function eligibilityTowardNextRows({
    historicalWorkingDays,
    liveWorkingDays,
    overtimeDays,
    liveEnabled,
    historicalFrom,
    historicalTo,
    liveFrom,
    liveTo,
    historicalLeave,
    attendanceLeave,
    reservedDays,
    reservedCount,
    cycleDays,
}) {
    const historicalDate =
        historicalFrom && historicalTo
            ? `${prettyDate(historicalFrom)} — ${prettyDate(historicalTo)}`
            : prettyDate(historicalFrom || historicalTo) || '—';
    const liveDate =
        liveFrom && liveTo
            ? `${prettyDate(liveFrom)} — ${prettyDate(liveTo)}`
            : prettyDate(liveFrom || liveTo) || '—';
    const rows = [
        {
            key: 'hist-wd',
            date: historicalDate,
            type: 'Historical working days',
            count: Number(historicalWorkingDays) || 0,
        },
    ];
    if (liveEnabled) {
        rows.push({
            key: 'live-wd',
            date: liveDate,
            type: 'Working days since VERP start',
            count: Number(liveWorkingDays) || 0,
        });
        const otDays = Number(overtimeDays) || 0;
        if (otDays > 0) {
            rows.push({
                key: 'live-ot',
                date: liveDate,
                type: 'Overtime days',
                count: otDays,
            });
        }
    }
    rows.push({
        key: 'hist-leave',
        date: historicalDate,
        type: 'Historical leave deduction',
        count: -(Number(historicalLeave) || 0),
    });
    if (liveEnabled) {
        rows.push({
            key: 'att-leave',
            date: liveDate,
            type: 'Attendance leave (policy)',
            count: -(Number(attendanceLeave) || 0),
        });
    }
    if (Number(reservedCount) > 0) {
        rows.push({
            key: 'reserved',
            date: `${reservedCount} × ${cycleDays} days`,
            type: 'Leave salary reserved',
            count: -(Number(reservedDays) || 0),
        });
    }
    return rows;
}

function formatTowardNextFormula(rows, remaining) {
    const parts = (Array.isArray(rows) ? rows : [])
        .map((row) => Number(row.count) || 0)
        .filter((n, index) => index === 0 || n !== 0);
    if (!parts.length) return `0 = ${Number(remaining) || 0}`;
    const expression = parts
        .map((n, index) => {
            const abs = Math.abs(n);
            if (index === 0) return n < 0 ? `− ${abs}` : String(abs);
            return n < 0 ? `− ${abs}` : `+ ${abs}`;
        })
        .join(' ');
    return `${expression} = ${Number(remaining) || 0}`;
}

function toTitleName(value) {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function nameInitials(value) {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return `${first}${second}`.toUpperCase() || 'EE';
}

function leaveMeta(type) {
    return LEAVE_TYPES.find((row) => row.key === type) || LEAVE_TYPES[0];
}

function leaveTypeKey(row) {
    return String(row?.leaveType || '').toLowerCase();
}

function holidayRowDate(row) {
    return String(row?.fromDate || row?.toDate || row?.date || '').trim();
}

async function fetchHolidaysInPeriod(fromDate, toDate) {
    const from = String(fromDate || '').trim();
    const to = String(toDate || '').trim();
    if (!ISO.test(from) || !ISO.test(to) || to < from) return [];
    const fromYear = Number(from.slice(0, 4));
    const toYear = Number(to.slice(0, 4));
    const years = [];
    for (let year = fromYear; year <= toYear; year += 1) years.push(year);
    const lists = await Promise.all(
        years.map(async (year) => {
            try {
                const res = await axiosInstance.get('/Holiday', { params: { year }, skipToast: true });
                return Array.isArray(res.data?.holidays) ? res.data.holidays : [];
            } catch {
                return [];
            }
        }),
    );
    return mergeHolidaysInPeriod(from, to, lists.flat());
}

function mergeHolidaysInPeriod(fromDate, toDate, savedHolidays = []) {
    const from = String(fromDate || '').trim();
    const to = String(toDate || '').trim();
    const byDate = new Map();
    getUaeHolidaysBetween(from, to).forEach((row) => {
        byDate.set(row.date, { date: row.date, name: row.name, source: 'catalog' });
    });
    (Array.isArray(savedHolidays) ? savedHolidays : []).forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!ISO.test(date) || date < from || date > to) return;
        const name = String(row?.name || row?.note || '').trim() || byDate.get(date)?.name || 'Holiday';
        byDate.set(date, { date, name, source: 'calendar' });
    });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function holidayLeaveRow(holiday, existing) {
    const name = String(holiday?.name || existing?.remarks || 'Holiday').trim() || 'Holiday';
    if (existing) {
        return {
            ...existing,
            leaveType: 'holiday',
            fromDate: holiday.date,
            toDate: holiday.date,
            calendarDays: 1,
            actualDays: 1,
            eligibleWorkingDays: 1,
            multiplier: 1,
            rule: 1,
            deductionDays: 1,
            deduction: 1,
            remarks: name,
            status: existing.status || 'approved',
        };
    }
    return {
        id: newLeaveRecordId(),
        leaveType: 'holiday',
        fromDate: holiday.date,
        toDate: holiday.date,
        calendarDays: 1,
        actualDays: 1,
        eligibleWorkingDays: 1,
        multiplier: 1,
        rule: 1,
        deductionDays: 1,
        deduction: 1,
        source: 'manual',
        status: 'approved',
        remarks: name,
    };
}

function annualLeaveKey(row) {
    return [
        String(row?.fromDate || row?.startDate || '').trim(),
        String(row?.toDate || row?.endDate || '').trim(),
    ].join('|');
}

function ordinalAnnualLeaveLabel(index) {
    if (index <= 0) return 'Annual leave';
    const n = index + 1;
    const mod100 = n % 100;
    const suffix =
        mod100 >= 11 && mod100 <= 13
            ? 'th'
            : n % 10 === 1
              ? 'st'
              : n % 10 === 2
                ? 'nd'
                : n % 10 === 3
                  ? 'rd'
                  : 'th';
    return `${n}${suffix} annual leave`;
}

function annualLeaveOptionLabel(index, row) {
    const from = row?.fromDate || row?.startDate || '';
    const to = row?.toDate || row?.endDate || '';
    const range = from || to ? `${prettyDate(from)} — ${prettyDate(to)}` : 'no dates';
    return `${ordinalAnnualLeaveLabel(index)} (${range})`;
}

function listAnnualLeaveOptions(rows) {
    const seen = new Set();
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (leaveTypeKey(row) !== 'annual') return;
        const from = row.fromDate || row.startDate || '';
        const to = row.toDate || row.endDate || '';
        if (!from && !to) return;
        const key = annualLeaveKey({ fromDate: from, toDate: to });
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ ...row, fromDate: from, toDate: to, key });
    });
    out.sort((a, b) => String(a.fromDate).localeCompare(String(b.fromDate)));
    return out.map((row, index) => ({
        ...row,
        label: annualLeaveOptionLabel(index, row),
    }));
}

function recordIncludesLeave(row) {
    if (row && typeof row.includeLeave === 'boolean') return row.includeLeave;
    return Number(row?.leaveSalaryAmount ?? row?.leaveSalary) > 0;
}

function recordIncludesTicket(row) {
    if (row && typeof row.includeTicket === 'boolean') return row.includeTicket;
    return Number(row?.ticketAmount) > 0;
}

function cycleAnnualLeaveKey(cycle) {
    const key = String(cycle?.annualLeaveKey || '').trim();
    if (key) return key;
    return annualLeaveKey({
        fromDate: cycle?.eligibilityStartDate,
        toDate: cycle?.eligibilityEndDate,
    });
}

function annualLeaveAlreadyReduced(cycles, leaveKey, excludeIndex = -1) {
    const key = String(leaveKey || '').trim();
    if (!key) return false;
    return (Array.isArray(cycles) ? cycles : []).some((cycle, index) => {
        if (index === excludeIndex) return false;
        if (cycleAnnualLeaveKey(cycle) !== key) return false;
        const status = String(cycle?.paymentStatus || cycle?.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'rejected' || status === 'draft') return false;
        return recordReducesWorkingDays(cycle, false);
    });
}

function recordReducesWorkingDays(row, fallback = true) {
    if (row && typeof row.reduceHistoricalWorkingDays === 'boolean') {
        return row.reduceHistoricalWorkingDays;
    }
    return fallback;
}

function leaveDateLabel(cycle, annualLeaves = []) {
    const option =
        (annualLeaves || []).find((row) => row.key === cycle?.annualLeaveKey) ||
        (annualLeaves || []).find(
            (row) =>
                row.fromDate === cycle?.eligibilityStartDate && row.toDate === cycle?.eligibilityEndDate,
        );
    if (option?.fromDate || option?.toDate) {
        return `${prettyDate(option.fromDate)} — ${prettyDate(option.toDate)}`;
    }
    const from = cycle?.eligibilityStartDate || '';
    const to = cycle?.eligibilityEndDate || '';
    if (from || to) return `${prettyDate(from)} — ${prettyDate(to)}`;
    return '—';
}

function cycleLeaveSalaryPaid(cycles) {
    return (Array.isArray(cycles) ? cycles : []).reduce(
        (sum, row) => sum + (Number(row?.leaveSalaryAmount ?? row?.leaveSalary) || 0),
        0,
    );
}

function cycleTicketPaid(cycles) {
    return (Array.isArray(cycles) ? cycles : []).reduce(
        (sum, row) => sum + (Number(row?.ticketAmount) || 0),
        0,
    );
}

function payableBalance(totalDue, alreadyPaid) {
    const remaining = (Number(totalDue) || 0) - (Number(alreadyPaid) || 0);
    return remaining > 0 ? roundMoney(remaining) : 0;
}

function entitlementDateOptions(entitlement) {
    return (Array.isArray(entitlement?.entitlements) ? entitlement.entitlements : [])
        .filter((row) => row?.entitlementDate)
        .map((row) => ({
            date: row.entitlementDate,
            entitlementNo: row.entitlementNo,
            leaveSalary: Number(row.leaveSalary) || 0,
            ticketAmount: Number(row.ticketAmount) || 0,
            label: `Leave Salary ${row.entitlementNo} · ${prettyDate(row.entitlementDate)}`,
        }));
}

function nextUnpaidEntitlementOption(options, cycles, kind, excludeIndex = -1) {
    const list = Array.isArray(options) ? options : [];
    const used = new Set();
    (Array.isArray(cycles) ? cycles : []).forEach((cycle, index) => {
        if (index === excludeIndex) return;
        const status = String(cycle?.paymentStatus || cycle?.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'rejected' || status === 'draft') return;
        if (kind === 'ticket' && !recordIncludesTicket(cycle)) return;
        if (kind !== 'ticket' && !recordIncludesLeave(cycle)) return;
        const date =
            kind === 'ticket'
                ? cycle?.ticketPaymentDate || cycle?.entitlementDate
                : cycle?.leaveSalaryPaymentDate || cycle?.entitlementDate;
        if (date) used.add(String(date));
    });
    return list.find((row) => row.date && !used.has(String(row.date))) || list[0] || null;
}

function isActivePaymentCycle(cycle) {
    const status = String(cycle?.paymentStatus || cycle?.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'rejected' && status !== 'draft';
}

function cycleKindPaymentDate(cycle, kind) {
    if (kind === 'ticket') {
        return String(cycle?.ticketPaymentDate || cycle?.entitlementDate || cycle?.paymentDate || '').trim();
    }
    return String(cycle?.leaveSalaryPaymentDate || cycle?.entitlementDate || cycle?.paymentDate || '').trim();
}

function cyclePaymentMatchesEntitlement(cycle, row, kind) {
    if (!cycle || !row) return false;
    const date = String(row.entitlementDate || row.date || '').trim();
    const paymentDate = cycleKindPaymentDate(cycle, kind);
    if (date && paymentDate && paymentDate === date) return true;
    const entitlementNo = Number(row.entitlementNo);
    if (entitlementNo > 0 && Number(cycle.entitlementNo) === entitlementNo) return true;
    return false;
}

function cycleKindAmount(cycle, kind) {
    if (kind === 'ticket') {
        if (!recordIncludesTicket(cycle)) return 0;
        return Number(cycle?.ticketAmount) || 0;
    }
    if (!recordIncludesLeave(cycle)) return 0;
    return Number(cycle?.leaveSalaryAmount ?? cycle?.leaveSalary) || 0;
}

function cycleAllocationAmountForEntitlement(cycle, row, kind) {
    const allocs = Array.isArray(cycle?.allocations) ? cycle.allocations : [];
    const kindAllocs = allocs.filter((item) => String(item?.kind || 'leave') === kind);
    if (!kindAllocs.length) return null;
    const entitlementNo = Number(row?.entitlementNo);
    const date = String(row?.entitlementDate || row?.date || '').trim();
    return roundMoney(
        kindAllocs.reduce((sum, item) => {
            const itemNo = Number(item?.entitlementNo) || 0;
            const itemDate = String(item?.entitlementDate || '').trim();
            const matchNo = entitlementNo > 0 && itemNo === entitlementNo;
            const matchDate = Boolean(date && itemDate && itemDate === date);
            if (!matchNo && !matchDate) return sum;
            return sum + (Number(item?.amount) || 0);
        }, 0),
    );
}

function entitlementKindPaidAmount(row, cycles, kind) {
    return (Array.isArray(cycles) ? cycles : []).reduce((sum, cycle) => {
        if (!isActivePaymentCycle(cycle)) return sum;
        const allocated = cycleAllocationAmountForEntitlement(cycle, row, kind);
        if (allocated != null) return sum + allocated;
        const amount = cycleKindAmount(cycle, kind);
        if (amount <= 0 || !cyclePaymentMatchesEntitlement(cycle, row, kind)) return sum;
        return sum + amount;
    }, 0);
}

function remainingKindAmount(row, cycles, kind) {
    const due = Number(kind === 'ticket' ? row?.ticketAmount : row?.leaveSalary) || 0;
    return payableBalance(due, entitlementKindPaidAmount(row, cycles, kind));
}

function invoiceReductionLines({ cycle, cycleIndex, kind, entitlements, cycles }) {
    const kindKey = kind === 'ticket' ? 'ticket' : 'leave';
    const options = entitlementDateOptions(entitlements);
    const others = (Array.isArray(cycles) ? cycles : []).filter((_, index) => index !== cycleIndex);
    const allocs = (Array.isArray(cycle?.allocations) ? cycle.allocations : []).filter(
        (item) => String(item?.kind || 'leave') === kindKey && Number(item?.amount) > 0,
    );
    const parts = allocs.length
        ? allocs.map((item) => ({
              entitlementNo: Number(item.entitlementNo) || 0,
              entitlementDate: String(item.entitlementDate || ''),
              amount: roundMoney(item.amount),
          }))
        : allocatePaymentAcrossEntitlements(
              options,
              others,
              kindKey,
              cycleKindAmount(cycle, kindKey),
          ).filter((part) => part.entitlementDate || Number(part.entitlementNo) > 0);
    const label = kindKey === 'ticket' ? 'Ticket' : 'Leave salary';
    const lines = parts.map((part) => {
        const opt =
            options.find((row) =>
                entitlementOptionMatchesTarget(row, {
                    entitlementNo: part.entitlementNo,
                    entitlementDate: part.entitlementDate,
                    date: part.entitlementDate,
                }),
            ) || {};
        const row = {
            ...opt,
            entitlementDate: opt.date || opt.entitlementDate || part.entitlementDate,
            entitlementNo: opt.entitlementNo || part.entitlementNo,
        };
        const due = Number(kindKey === 'ticket' ? row.ticketAmount : row.leaveSalary) || 0;
        const paidAll = entitlementKindPaidAmount(row, cycles, kindKey);
        const applied = roundMoney(part.amount);
        const paidBefore = roundMoney(Math.max(0, paidAll - applied));
        const paidAfter = roundMoney(paidBefore + applied);
        return {
            label: `${label} ${row.entitlementNo || '—'}`,
            entitlementDate: row.entitlementDate || part.entitlementDate || '',
            due,
            paidBefore,
            applied,
            paidAfter,
            balanceBefore: payableBalance(due, paidBefore),
            balanceAfter: payableBalance(due, paidAfter),
        };
    });
    const paidAmount = cycleKindAmount(cycle, kindKey);
    if (!lines.length && paidAmount > 0) {
        return [
            {
                label: `${label} payment`,
                entitlementDate: '',
                due: 0,
                paidBefore: 0,
                applied: paidAmount,
                paidAfter: paidAmount,
                balanceBefore: 0,
                balanceAfter: 0,
            },
        ];
    }
    return lines;
}

function entitlementHasKindPayment(row, cycles, kind) {
    const due = Number(kind === 'ticket' ? row?.ticketAmount : row?.leaveSalary) || 0;
    const paid = entitlementKindPaidAmount(row, cycles, kind);
    if (due <= 0) return paid > 0;
    return remainingKindAmount(row, cycles, kind) <= 0;
}

function entitlementPaymentStatus(row, cycles) {
    const leaveDue = Number(row?.leaveSalary) || 0;
    const ticketDue = Number(row?.ticketAmount) || 0;
    if (leaveDue <= 0 && ticketDue <= 0) {
        return entitlementHasKindPayment(row, cycles, 'leave') ||
            entitlementHasKindPayment(row, cycles, 'ticket')
            ? 'Paid'
            : 'Not paid';
    }
    const leaveSettled = leaveDue <= 0 || remainingKindAmount(row, cycles, 'leave') <= 0;
    const ticketSettled = ticketDue <= 0 || remainingKindAmount(row, cycles, 'ticket') <= 0;
    return leaveSettled && ticketSettled ? 'Paid' : 'Not paid';
}

function salarySlipMonthKeyFromCycle(cycle) {
    const key = String(cycle?.salarySlipMonthKey || '').trim();
    if (/^\d{4}-\d{2}$/.test(key)) return key;
    const match = String(cycle?.paymentReference || '').match(/salary-slip:(\d{4}-\d{2})/i);
    return match ? match[1] : '';
}

function cyclesMatchingEntitlement(row, cycles) {
    return (Array.isArray(cycles) ? cycles : [])
        .map((cycle, cycleIndex) => ({ cycle, cycleIndex }))
        .filter(({ cycle }) => {
            if (!isActivePaymentCycle(cycle)) return false;
            const leaveHit =
                cycleKindAmount(cycle, 'leave') > 0 && cyclePaymentMatchesEntitlement(cycle, row, 'leave');
            const ticketHit =
                cycleKindAmount(cycle, 'ticket') > 0 && cyclePaymentMatchesEntitlement(cycle, row, 'ticket');
            return leaveHit || ticketHit;
        })
        .sort((a, b) => {
            const dateA = String(
                a.cycle?.paymentDate || a.cycle?.leaveSalaryPaymentDate || a.cycle?.ticketPaymentDate || '',
            );
            const dateB = String(
                b.cycle?.paymentDate || b.cycle?.leaveSalaryPaymentDate || b.cycle?.ticketPaymentDate || '',
            );
            return dateB.localeCompare(dateA) || b.cycleIndex - a.cycleIndex;
        });
}

/** Latest payment for this entitlement → salary slip redirect or payment-cycle edit. */
function resolveEntitlementPaymentClick(row, cycles) {
    const matches = cyclesMatchingEntitlement(row, cycles);
    if (!matches.length) return null;
    const primary = matches[0];
    if (isSalarySlipPayment(primary.cycle)) {
        const monthKey = salarySlipMonthKeyFromCycle(primary.cycle);
        if (!monthKey) return null;
        return { type: 'salarySlip', monthKey, cycle: primary.cycle, cycleIndex: primary.cycleIndex };
    }
    return { type: 'paymentCycle', cycle: primary.cycle, cycleIndex: primary.cycleIndex };
}

function remainingEntitlementOptions(options, cycles, { includeLeave = true, includeTicket = false, excludeIndex = -1 } = {}) {
    const active = (Array.isArray(cycles) ? cycles : []).filter((_, index) => index !== excludeIndex);
    return (Array.isArray(options) ? options : []).filter((opt) => {
        const row = {
            ...opt,
            entitlementDate: opt.date || opt.entitlementDate,
            entitlementNo: opt.entitlementNo,
        };
        const leaveLeft = remainingKindAmount(row, active, 'leave');
        const ticketLeft = remainingKindAmount(row, active, 'ticket');
        if (includeLeave && includeTicket) return leaveLeft > 0 || ticketLeft > 0;
        if (includeLeave) return leaveLeft > 0;
        if (includeTicket) return ticketLeft > 0;
        return true;
    });
}

/** Pay oldest unpaid entitlement first; leftover keeps going to the next row.
 *  Pass `target` to apply the amount only to that unpaid/partial row. */
function allocatePaymentAcrossEntitlements(options, cycles, kind, amount, excludeIndex = -1, target = null) {
    const active = (Array.isArray(cycles) ? cycles : []).filter((_, index) => index !== excludeIndex);
    let left = roundMoney(Math.max(0, Number(amount) || 0));
    const parts = [];
    const list = (Array.isArray(options) ? options : []).filter((opt) =>
        target ? entitlementOptionMatchesTarget(opt, target) : true,
    );
    for (const opt of list) {
        if (left <= 0) break;
        const row = {
            ...opt,
            entitlementDate: opt.date || opt.entitlementDate,
            entitlementNo: opt.entitlementNo,
            leaveSalary: opt.leaveSalary,
            ticketAmount: opt.ticketAmount,
        };
        const unpaid = remainingKindAmount(row, active, kind);
        if (unpaid <= 0) continue;
        const take = roundMoney(Math.min(unpaid, left));
        if (take <= 0) continue;
        parts.push({
            entitlementNo: Number(row.entitlementNo) || parts.length + 1,
            entitlementDate: String(row.entitlementDate || ''),
            amount: take,
        });
        left = roundMoney(left - take);
    }
    if (left > 0) {
        parts.push({ entitlementNo: 0, entitlementDate: '', amount: left });
    }
    return parts;
}

function entitlementOptionMatchesTarget(opt, target) {
    if (!target) return true;
    const tNo = Number(target.entitlementNo) || 0;
    const tDate = String(target.entitlementDate || target.date || '');
    const oNo = Number(opt?.entitlementNo) || 0;
    const oDate = String(opt?.date || opt?.entitlementDate || '');
    if (tNo && oNo) return tNo === oNo && (!tDate || !oDate || tDate === oDate);
    return Boolean(tDate && oDate && tDate === oDate);
}

function entitlementRowKey(row) {
    return `${Number(row?.entitlementNo) || 0}|${String(row?.date || row?.entitlementDate || '')}`;
}

function parseEntitlementRowKey(key) {
    const value = String(key || '');
    if (!value) return null;
    const splitAt = value.indexOf('|');
    if (splitAt < 0) return { entitlementNo: Number(value) || 0, entitlementDate: '', date: '' };
    return {
        entitlementNo: Number(value.slice(0, splitAt)) || 0,
        entitlementDate: value.slice(splitAt + 1),
        date: value.slice(splitAt + 1),
    };
}

function remainingAmountForTarget(options, cycles, kind, target, excludeIndex = -1) {
    if (!target) return 0;
    const active = (Array.isArray(cycles) ? cycles : []).filter((_, index) => index !== excludeIndex);
    const opt = (Array.isArray(options) ? options : []).find((row) => entitlementOptionMatchesTarget(row, target));
    if (!opt) return 0;
    return remainingKindAmount(
        {
            ...opt,
            entitlementDate: opt.date || opt.entitlementDate,
            entitlementNo: opt.entitlementNo,
        },
        active,
        kind,
    );
}

function mergeAllocatedPaymentParts(leaveParts, ticketParts) {
    const byKey = new Map();
    const rowKey = (part) =>
        String(part.entitlementDate || '') || `no:${Number(part.entitlementNo) || 0}`;
    (Array.isArray(leaveParts) ? leaveParts : []).forEach((part) => {
        byKey.set(rowKey(part), {
            entitlementNo: part.entitlementNo,
            entitlementDate: part.entitlementDate,
            leaveAmount: part.amount,
            ticketAmount: 0,
        });
    });
    (Array.isArray(ticketParts) ? ticketParts : []).forEach((part) => {
        const key = rowKey(part);
        const existing = byKey.get(key);
        if (existing) {
            existing.ticketAmount = part.amount;
            return;
        }
        byKey.set(key, {
            entitlementNo: part.entitlementNo,
            entitlementDate: part.entitlementDate,
            leaveAmount: 0,
            ticketAmount: part.amount,
        });
    });
    return [...byKey.values()];
}

function totalRemainingKind(options, cycles, kind, excludeIndex = -1) {
    const active = (Array.isArray(cycles) ? cycles : []).filter((_, index) => index !== excludeIndex);
    return roundMoney(
        (Array.isArray(options) ? options : []).reduce((sum, opt) => {
            const row = {
                ...opt,
                entitlementDate: opt.date || opt.entitlementDate,
                entitlementNo: opt.entitlementNo,
            };
            return sum + remainingKindAmount(row, active, kind);
        }, 0),
    );
}

function entitlementPaymentPreview(options, cycles, kind, enteredAmount, excludeIndex = -1, target = null) {
    const parts = allocatePaymentAcrossEntitlements(
        options,
        cycles,
        kind,
        enteredAmount,
        excludeIndex,
        target,
    );
    const takeByKey = new Map();
    let leftover = 0;
    (Array.isArray(parts) ? parts : []).forEach((part) => {
        const amount = Number(part?.amount) || 0;
        if (amount <= 0) return;
        if (!part.entitlementDate && !(Number(part.entitlementNo) > 0)) {
            leftover += amount;
            return;
        }
        const key = `${Number(part.entitlementNo) || 0}|${String(part.entitlementDate || '')}`;
        takeByKey.set(key, roundMoney((takeByKey.get(key) || 0) + amount));
    });
    const rows = (Array.isArray(options) ? options : [])
        .map((opt) => {
            const row = {
                ...opt,
                entitlementDate: opt.date || opt.entitlementDate,
                entitlementNo: opt.entitlementNo,
            };
            const due = Number(kind === 'ticket' ? row.ticketAmount : row.leaveSalary) || 0;
            if (due <= 0) return null;
            const alreadyPaid = entitlementKindPaidAmount(row, cycles, kind);
            const thisPay =
                takeByKey.get(`${Number(row.entitlementNo) || 0}|${String(row.entitlementDate || '')}`) || 0;
            const paid = roundMoney(alreadyPaid + thisPay);
            const balance = payableBalance(due, paid);
            const status = balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
            return {
                entitlementNo: Number(row.entitlementNo) || 0,
                date: row.entitlementDate,
                total: due,
                paid,
                thisPay,
                balance,
                status,
            };
        })
        .filter(Boolean);
    return { rows, leftover: roundMoney(leftover) };
}

function buildCycleAllocations(ctx) {
    const allocations = [];
    if (ctx.saveLeave) {
        allocatePaymentAcrossEntitlements(
            ctx.dateOptions,
            ctx.paymentCycles,
            'leave',
            ctx.leaveAmt,
            ctx.editingIndex,
            ctx.leaveTarget,
        ).forEach((part) => {
            if (!(Number(part.amount) > 0) || (!part.entitlementDate && !(Number(part.entitlementNo) > 0))) return;
            allocations.push({
                kind: 'leave',
                entitlementNo: Number(part.entitlementNo) || 0,
                entitlementDate: String(part.entitlementDate || ''),
                amount: roundMoney(part.amount),
            });
        });
    }
    if (ctx.saveTicket) {
        allocatePaymentAcrossEntitlements(
            ctx.dateOptions,
            ctx.paymentCycles,
            'ticket',
            ctx.ticketAmt,
            ctx.editingIndex,
            ctx.ticketTarget,
        ).forEach((part) => {
            if (!(Number(part.amount) > 0) || (!part.entitlementDate && !(Number(part.entitlementNo) > 0))) return;
            allocations.push({
                kind: 'ticket',
                entitlementNo: Number(part.entitlementNo) || 0,
                entitlementDate: String(part.entitlementDate || ''),
                amount: roundMoney(part.amount),
            });
        });
    }
    return allocations;
}

function EntitlementAllocationTable({
    kind,
    rows = [],
    leftover = 0,
    selectedKey = '',
    onSelectRow,
    disabled = false,
}) {
    const title = kind === 'ticket' ? 'Ticket' : 'Leave salary';
    const visibleRows = (Array.isArray(rows) ? rows : []).filter((row) => {
        const remainingBefore = roundMoney(
            (Number(row.balance) || 0) + (Number(row.thisPay) || 0),
        );
        return remainingBefore > 0;
    });
    if (!visibleRows.length) {
        return (
            <p className="rounded-[10px] border border-[#E6EAF0] px-3 py-4 text-center text-[12px] text-[#94A3B8]">
                No unpaid {title.toLowerCase()} rows.
            </p>
        );
    }
    return (
        <div className="overflow-x-auto rounded-[10px] border border-[#E6EAF0]">
            <table className="w-full min-w-[560px] text-left">
                <thead>
                    <tr className="border-b border-[#EEF2F6] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                        <th className="px-3 py-2 font-semibold">{title}</th>
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Total</th>
                        <th className="px-3 py-2 font-semibold">Paid</th>
                        <th className="px-3 py-2 font-semibold">Balance</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {visibleRows.map((row) => {
                        const key = entitlementRowKey(row);
                        const remainingBefore = roundMoney(
                            (Number(row.balance) || 0) + (Number(row.thisPay) || 0),
                        );
                        const selectable = !disabled && remainingBefore > 0;
                        const selected = selectedKey === key;
                        return (
                            <tr
                                key={`${kind}-${row.entitlementNo}-${row.date}`}
                                className={`border-b border-[#F1F5F9] last:border-0 ${
                                    selected
                                        ? 'bg-[#EEF4FF]'
                                        : row.thisPay > 0
                                          ? 'bg-[#F8FBFF]'
                                          : ''
                                } ${selectable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                onClick={() => {
                                    if (!selectable) return;
                                    onSelectRow?.(row);
                                }}
                            >
                                <td className="px-3 py-2 text-[13px] font-medium text-[#0F172A]">
                                    {title} {row.entitlementNo || '—'}
                                </td>
                                <td className="px-3 py-2 text-[13px] text-[#334155]">{prettyDate(row.date)}</td>
                                <td className="px-3 py-2 text-[13px] tabular-nums text-[#334155]">{aedMoney(row.total)}</td>
                                <td className="px-3 py-2 text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                    {aedMoney(row.paid)}
                                </td>
                                <td className="px-3 py-2 text-[13px] tabular-nums text-[#334155]">{aedMoney(row.balance)}</td>
                                <td className="px-3 py-2">
                                    <EntitlementStatusBadge status={row.status} clickable={selectable} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {leftover > 0 ? (
                <p className="border-t border-[#EEF2F6] px-3 py-2 text-[12px] text-amber-700">
                    Amount above unpaid total {aedMoney(leftover)}
                </p>
            ) : null}
        </div>
    );
}

function isSalarySlipPayment(cycle) {
    return (
        String(cycle?.source || '').toLowerCase() === 'salaryslip' ||
        String(cycle?.paymentReference || '').startsWith('salary-slip:') ||
        Boolean(String(cycle?.salarySlipMonthKey || '').trim())
    );
}

function formatCycleSl(cycleNumber, fallback = 1) {
    const n = Number(cycleNumber);
    const value = Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
    return `CYC-${String(value).padStart(3, '0')}`;
}

function paymentKindRows(cycles, kind, annualLeaves = []) {
    const list = Array.isArray(cycles) ? cycles : [];
    return list
        .map((cycle, cycleIndex) => ({ cycle, cycleIndex }))
        .filter(({ cycle }) => (kind === 'ticket' ? recordIncludesTicket(cycle) : recordIncludesLeave(cycle)))
        .map(({ cycle, cycleIndex }) => ({
            slNo: formatCycleSl(cycle.cycleNumber, cycleIndex + 1),
            cycleIndex,
            cycle,
            fromSalarySlip: isSalarySlipPayment(cycle),
            paymentDate:
                kind === 'ticket'
                    ? cycle.ticketProcessDate || cycle.paymentDate || cycle.ticketPaymentDate
                    : cycle.leaveProcessDate || cycle.paymentDate || cycle.leaveSalaryPaymentDate,
            leaveDate: leaveDateLabel(cycle, annualLeaves),
            amount: kind === 'ticket' ? cycle.ticketAmount : cycle.leaveSalaryAmount,
            mode: isSalarySlipPayment(cycle) ? 'Payroll' : 'Manual',
            currency: cycle.currency,
        }));
}

function PaymentKindCard({
    title,
    rows = [],
    emptyMessage,
    eligibleLabel,
    eligibleValue,
    canManage = false,
    onAdd,
    onOpen,
    onEdit,
    onDelete,
    onModeClick,
}) {
    const list = Array.isArray(rows) ? rows : [];
    const totalPayment = roundMoney(
        list.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    );
    const canMutateRow = (row) => canManage && !row.fromSalarySlip;
    return (
        <div className="min-w-0 rounded-[10px] border border-[#E6EAF0] bg-white">
            <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] px-3 py-2.5">
                <h4 className="text-[13px] font-semibold text-[#0F172A]">{title}</h4>
                <div className="flex min-w-0 items-start gap-3">
                    {eligibleValue ? (
                        <div className="min-w-0 text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                {eligibleLabel}
                            </p>
                            <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0F172A]">{eligibleValue}</p>
                        </div>
                    ) : null}
                    {canManage ? (
                        <button
                            type="button"
                            onClick={() => onAdd?.()}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#D6DEE8] px-2.5 text-[12px] font-semibold text-[#2563EB] hover:bg-[#F8FAFC]"
                        >
                            <Plus size={14} /> Add
                        </button>
                    ) : null}
                </div>
            </div>
            {list.length ? (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left">
                        <thead>
                            <tr className="border-b border-[#EEF2F6] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                <th className="px-3 py-2 font-semibold">SL No</th>
                                <th className="px-3 py-2 font-semibold">Payment Date</th>
                                <th className="px-3 py-2 font-semibold">Paid Amount</th>
                                <th className="px-3 py-2 font-semibold">Mode</th>
                                <th className="px-3 py-2 text-right font-semibold">
                                    {canManage ? 'Actions' : 'Open'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((row) => (
                                <tr
                                    key={`${title}-${row.cycleIndex}-${row.slNo}`}
                                    className={`border-b border-[#F1F5F9] last:border-0 ${
                                        row.fromSalarySlip ? 'bg-amber-50' : ''
                                    }`}
                                >
                                    <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">{row.slNo}</td>
                                    <td className="px-3 py-2.5 text-[13px] text-[#334155]">
                                        {prettyDate(row.paymentDate)}
                                    </td>
                                    <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                        {aed(row.amount, row.currency)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <button
                                            type="button"
                                            onClick={() => onModeClick?.(row.cycleIndex, row.cycle, row)}
                                            title={
                                                row.fromSalarySlip
                                                    ? 'Open salary slip'
                                                    : 'View payment invoice'
                                            }
                                            className="rounded-md text-[13px] font-semibold text-[#2563EB] hover:underline"
                                        >
                                            {row.mode || (row.fromSalarySlip ? 'Payroll' : 'Manual')}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <div className="inline-flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    onOpen?.(row.cycleIndex, row.cycle);
                                                }}
                                                className="rounded-md px-1.5 py-1 text-[12px] font-semibold text-[#2563EB] hover:bg-slate-50 hover:underline"
                                            >
                                                Open
                                            </button>
                                            {canManage ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={!canMutateRow(row)}
                                                        onClick={() => onEdit?.(row.cycleIndex, row.cycle)}
                                                        title={
                                                            row.fromSalarySlip
                                                                ? 'Salary slip payments are edited from the salary slip'
                                                                : 'Edit payment'
                                                        }
                                                        className="rounded-md p-1 text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-30"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!canMutateRow(row)}
                                                        onClick={() => onDelete?.(row.cycleIndex, row.cycle)}
                                                        title={
                                                            row.fromSalarySlip
                                                                ? 'Salary slip payments are not deleted here'
                                                                : 'Delete payment'
                                                        }
                                                        className="rounded-md p-1 text-[#94A3B8] hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="px-3 py-8 text-center text-[13px] text-[#94A3B8]">{emptyMessage}</p>
            )}
            <div className="flex items-center justify-between border-t border-[#EEF2F6] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Total Payment</p>
                <p className="text-[13px] font-semibold tabular-nums text-[#0F172A]">{aedMoney(totalPayment)}</p>
            </div>
        </div>
    );
}

function buildPaymentInvoice({
    cycle,
    cycleIndex,
    kind,
    entitlements,
    cycles,
    employeeName,
    employeeId,
    companyName,
    designation,
    department,
}) {
    const kindKey = kind === 'ticket' ? 'ticket' : 'leave';
    const title = kindKey === 'ticket' ? 'Ticket payment' : 'Leave salary payment';
    const slNo = formatCycleSl(cycle?.cycleNumber, (Number(cycleIndex) || 0) + 1);
    return {
        invoiceNo: `${slNo}-${kindKey === 'ticket' ? 'TK' : 'LS'}`,
        slNo,
        title,
        kindLabel: kindKey === 'ticket' ? 'Ticket' : 'Leave salary',
        paidAmount: cycleKindAmount(cycle, kindKey),
        paymentDate:
            kindKey === 'ticket'
                ? cycle?.ticketProcessDate || cycle?.paymentDate || cycle?.ticketPaymentDate
                : cycle?.leaveProcessDate || cycle?.paymentDate || cycle?.leaveSalaryPaymentDate,
        issuedOn: format(new Date(), 'd MMM yyyy'),
        mode: isSalarySlipPayment(cycle) ? 'Payroll' : 'Manual',
        currency: cycle?.currency || 'AED',
        remarks: String(cycle?.remarks || '').trim(),
        employeeName: employeeName || '—',
        employeeId: employeeId || '—',
        companyName: companyName || '',
        designation: designation || '',
        department: department || '',
        lines: invoiceReductionLines({
            cycle,
            cycleIndex,
            kind: kindKey,
            entitlements,
            cycles,
        }),
    };
}

function EntitlementStatusBadge({ status, clickable = false }) {
    const key = String(status || '').toLowerCase();
    const tone =
        key === 'eligible' || key === 'paid'
            ? 'bg-emerald-50 text-emerald-700'
            : key === 'in progress' ||
                key === 'calculated' ||
                key === 'not completed' ||
                key === 'not paid' ||
                key === 'unpaid' ||
                key === 'partial'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-slate-100 text-slate-600';
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${tone} ${
                clickable ? 'cursor-pointer underline-offset-2 hover:underline' : ''
            }`}
        >
            {status || '—'}
        </span>
    );
}

function EntitlementDetailsModal({ open, entitlement, cycleDays, policyLabel, onClose }) {
    if (!open || !entitlement) return null;
    const leaveTaken = entitlement.leaveTaken || {};
    const breakdown = Array.isArray(entitlement.monthlyBreakdown) ? entitlement.monthlyBreakdown : [];
    return (
        <ModalShell
            open={open}
            title={`Leave Salary Entitlement #${entitlement.entitlementNo}`}
            onClose={onClose}
            width="max-w-3xl"
            zClass="z-[100]"
        >
            <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
                    <DetailStat label="Date" value={prettyDate(entitlement.entitlementDate || entitlement.salaryPeriodEnd)} />
                    <DetailStat
                        label="Eligible working days"
                        value={`${Number(entitlement.eligibleDays) || 0} / ${Number(cycleDays) || 0}`}
                    />
                    <DetailStat label="Leave start" value={leaveTaken.startDate ? prettyDate(leaveTaken.startDate) : '—'} />
                    <DetailStat label="Leave end" value={leaveTaken.endDate ? prettyDate(leaveTaken.endDate) : '—'} />
                    <DetailStat label="Leave days taken" value={leaveTaken.days ? String(leaveTaken.days) : '—'} />
                    <DetailStat label="Leave salary" value={aedMoney(entitlement.leaveSalary)} />
                    <DetailStat label="Ticket" value={aedMoney(entitlement.ticketAmount)} />
                    <DetailStat label="Salary policy" value={policyLabel || 'Applicable salary policy'} />
                </div>
                <div className="overflow-x-auto rounded-[10px] border border-[#E6EAF0]">
                    <table className="w-full min-w-[640px] text-left">
                        <thead>
                            <tr className="border-b border-[#EEF2F6] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                <th className="px-3 py-2 font-semibold">Month</th>
                                <th className="px-3 py-2 font-semibold">Basic salary</th>
                                <th className="px-3 py-2 font-semibold">Applicable days</th>
                                <th className="px-3 py-2 font-semibold">Calculation</th>
                                <th className="px-3 py-2 text-right font-semibold">Leave salary accrual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {breakdown.map((row) => {
                                const segments = Array.isArray(row.segments) ? row.segments : [];
                                if (segments.length) {
                                    return (
                                        <Fragment key={row.month}>
                                            {segments.map((segment, index) => (
                                                <tr key={`${row.month}-${segment.from}-${index}`} className="border-b border-[#F1F5F9]">
                                                    <td className="px-3 py-2 text-[13px] text-[#334155]">
                                                        {index === 0 ? prettyMonth(row.month) : ''}
                                                        <span className="mt-0.5 block text-[11px] text-[#94A3B8]">
                                                            {prettyDate(segment.from)} — {prettyDate(segment.to)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-[13px] tabular-nums text-[#334155]">
                                                        {aedMoney(segment.basicSalary)}
                                                    </td>
                                                    <td className="px-3 py-2 text-[13px] text-[#334155]">{segment.days} days</td>
                                                    <td className="px-3 py-2 text-[12px] text-[#64748B]">{segment.calculation}</td>
                                                    <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                                        {aedMoney(segment.accrual)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    );
                                }
                                return (
                                    <tr key={row.month} className="border-b border-[#F1F5F9]">
                                        <td className="px-3 py-2 text-[13px] text-[#334155]">{prettyMonth(row.month)}</td>
                                        <td className="px-3 py-2 text-[13px] tabular-nums text-[#334155]">
                                            {row.basicSalary == null ? '—' : aedMoney(row.basicSalary)}
                                        </td>
                                        <td className="px-3 py-2 text-[13px] text-[#334155]">{row.applicableDays || '—'}</td>
                                        <td className="px-3 py-2 text-[12px] text-[#64748B]">{row.calculation || '—'}</td>
                                        <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                            {aedMoney(row.leaveSalaryAccrual)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-right text-[13px] font-semibold text-[#0F172A]">
                    Total: {aedMoney(entitlement.leaveSalary)}
                </p>
            </div>
            <div className="mt-4 flex justify-end">
                <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold">
                    Close
                </button>
            </div>
        </ModalShell>
    );
}

function DetailStat({ label, value, tone = 'default' }) {
    const danger = tone === 'danger';
    return (
        <div
            className={`rounded-[10px] border px-3 py-2 ${
                danger ? 'border-red-200 bg-red-50' : 'border-[#EEF2F6] bg-[#F8FAFC]'
            }`}
        >
            <p
                className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    danger ? 'text-red-500' : 'text-[#94A3B8]'
                }`}
            >
                {label}
            </p>
            <p className={`mt-0.5 text-[13px] font-medium ${danger ? 'text-red-600' : 'text-[#0F172A]'}`}>
                {value || '—'}
            </p>
        </div>
    );
}

function SplitKindStat({ label, leaveValue, ticketValue, tone = 'default' }) {
    const danger = tone === 'danger';
    return (
        <div
            className={`rounded-[10px] border px-3 py-2 ${
                danger ? 'border-red-200 bg-red-50' : 'border-[#EEF2F6] bg-[#F8FAFC]'
            }`}
        >
            <p
                className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    danger ? 'text-red-500' : 'text-[#94A3B8]'
                }`}
            >
                {label}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/80 bg-white px-2 py-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                        Leave salary
                    </p>
                    <p className={`mt-0.5 text-[13px] font-medium tabular-nums ${danger ? 'text-red-600' : 'text-[#0F172A]'}`}>
                        {leaveValue}
                    </p>
                </div>
                <div className="rounded-lg border border-white/80 bg-white px-2 py-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                        Ticket
                    </p>
                    <p className={`mt-0.5 text-[13px] font-medium tabular-nums ${danger ? 'text-red-600' : 'text-[#0F172A]'}`}>
                        {ticketValue}
                    </p>
                </div>
            </div>
        </div>
    );
}

function completedOverTotal(done, total) {
    return `${Math.max(0, Number(done) || 0)}/${Math.max(0, Number(total) || 0)}`;
}

function EntitlementTable({ entitlement, paymentCycles = [], onSeeDetails, onPaymentStatusClick }) {
    const rows = Array.isArray(entitlement?.entitlements) ? entitlement.entitlements : [];
    const next = entitlement?.nextEntitlement;
    const showNext = next && Number(next.accumulatedDays) > 0;
    if (!rows.length && !showNext) {
        return (
            <p className="rounded-[10px] border border-[#E6EAF0] px-3 py-8 text-center text-[13px] text-[#94A3B8]">
                No leave salary entitlements yet. Eligible working days must reach the policy leave working days.
            </p>
        );
    }
    return (
        <div className="overflow-x-auto rounded-[10px] border border-[#E6EAF0]">
            <table className="w-full min-w-[980px] text-left">
                <thead>
                    <tr className="border-b border-[#EEF2F6] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Entitlement</th>
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Eligible days</th>
                        <th className="px-3 py-2 font-semibold">Leave days taken</th>
                        <th className="px-3 py-2 font-semibold">Leave salary</th>
                        <th className="px-3 py-2 font-semibold">Ticket</th>
                        <th className="px-3 py-2 font-semibold">Total</th>
                        <th className="px-3 py-2 font-semibold">Balance</th>
                        <th className="px-3 py-2 font-semibold">Payment status</th>
                        <th className="px-3 py-2 font-semibold" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const leaveAmt = Number(row.leaveSalary) || 0;
                        const ticketAmt = Number(row.ticketAmount) || 0;
                        const totalAmt = roundMoney(leaveAmt + ticketAmt);
                        const balanceAmt = roundMoney(
                            remainingKindAmount(row, paymentCycles, 'leave') +
                                remainingKindAmount(row, paymentCycles, 'ticket'),
                        );
                        const paymentStatus = entitlementPaymentStatus(row, paymentCycles);
                        const paymentAction = resolveEntitlementPaymentClick(row, paymentCycles);
                        return (
                        <tr
                            key={`entitlement-${row.entitlementNo}`}
                            className="cursor-pointer border-b border-[#F1F5F9] hover:bg-slate-50"
                            onClick={() => onSeeDetails?.(row)}
                        >
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">{row.entitlementNo}</td>
                            <td className="px-3 py-2.5 text-[13px] font-medium text-[#0F172A]">
                                Leave Salary {row.entitlementNo}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] text-[#334155]">
                                {prettyDate(row.entitlementDate || row.salaryPeriodEnd)}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">{row.eligibleDays}</td>
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">
                                {row.leaveTaken?.days || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">
                                {aedMoney(leaveAmt)}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">
                                {aedMoney(ticketAmt)}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">
                                {aedMoney(totalAmt)}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] font-bold tabular-nums text-[#0F172A]">
                                {aedMoney(balanceAmt)}
                            </td>
                            <td className="px-3 py-2.5">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onPaymentStatusClick?.(
                                            row,
                                            paymentAction || { type: 'addPaymentCycle', row },
                                        );
                                    }}
                                    className="rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/ring-offset-1"
                                    title={
                                        paymentAction?.type === 'salarySlip'
                                            ? 'Open salary slip'
                                            : paymentAction?.type === 'paymentCycle'
                                              ? 'View payment cycle'
                                              : 'Add a payment from Add payment cycle'
                                    }
                                >
                                    <EntitlementStatusBadge status={paymentStatus} clickable />
                                </button>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onSeeDetails?.(row);
                                    }}
                                    className="text-[12px] font-semibold text-[#2563EB] hover:underline"
                                >
                                    See Details
                                </button>
                            </td>
                        </tr>
                        );
                    })}
                    {showNext ? (
                        <tr className="bg-[#F8FAFC]">
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#94A3B8]">
                                {rows.length + 1}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] font-medium text-[#64748B]">Next entitlement</td>
                            <td className="px-3 py-2.5 text-[13px] text-[#64748B]">
                                {prettyDate(next.entitlementDate || next.endDate)}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#64748B]">
                                {next.accumulatedDays} / {next.requiredDays}
                            </td>
                            <td className="px-3 py-2.5 text-[13px] text-[#94A3B8]">—</td>
                            <td className="px-3 py-2.5 text-[13px] text-[#94A3B8]">Not eligible</td>
                            <td className="px-3 py-2.5 text-[13px] text-[#94A3B8]">—</td>
                            <td className="px-3 py-2.5 text-[13px] text-[#94A3B8]">—</td>
                            <td className="px-3 py-2.5 text-[13px] text-[#94A3B8]">—</td>
                            <td className="px-3 py-2.5">
                                <EntitlementStatusBadge status="Not paid" />
                            </td>
                            <td className="px-3 py-2.5" />
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
    );
}

function LeaveSalaryDetailsModal({
    open,
    entitlement,
    paymentCycles = [],
    onSeeDetails,
    onPaymentStatusClick,
    onClose,
}) {
    return (
        <ModalShell open={open} title="Leave salary details" onClose={onClose} width="max-w-[96vw] xl:max-w-7xl">
            <p className="mt-1 text-[12px] text-[#64748B]">
                Click a row to open that entitlement&apos;s calculation details. Click Paid / Not paid to view the
                payment cycle or salary slip. Use Add payment cycle to save a new payment.
            </p>
            <div className="mt-4 max-h-[78vh] overflow-y-auto pr-1">
                <EntitlementTable
                    entitlement={entitlement}
                    paymentCycles={paymentCycles}
                    onSeeDetails={onSeeDetails}
                    onPaymentStatusClick={onPaymentStatusClick}
                />
            </div>
            <div className="mt-4 flex justify-end">
                <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold">
                    Close
                </button>
            </div>
        </ModalShell>
    );
}

function LeaveTypeFilter({ value, onChange, rows }) {
    const counts = useMemo(() => {
        const next = { all: Array.isArray(rows) ? rows.length : 0 };
        LEAVE_TYPES.forEach((type) => {
            next[type.key] = 0;
        });
        (rows || []).forEach((row) => {
            const key = leaveTypeKey(row);
            if (Object.prototype.hasOwnProperty.call(next, key)) next[key] += 1;
        });
        return next;
    }, [rows]);

    const options = [{ key: '', label: 'All', color: '#64748B' }, ...LEAVE_TYPES];

    return (
        <div
            className="flex flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap"
            role="tablist"
            aria-label="Filter leave types"
        >
            {options.map((option) => {
                const selected = (option.key || '') === (value || '');
                const count = option.key ? counts[option.key] || 0 : counts.all;
                return (
                    <button
                        key={option.key || 'all'}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(selected && option.key ? '' : option.key)}
                        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
                            selected
                                ? 'border-slate-800 bg-slate-800 text-white'
                                : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        {option.key ? (
                            <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: option.color }}
                            />
                        ) : null}
                        {option.label}
                        <span className={selected ? 'text-white/80' : 'text-[#94A3B8]'}>{count}</span>
                    </button>
                );
            })}
        </div>
    );
}

function AddHolidaysModal({
    open,
    onClose,
    onSave,
    fromDate,
    toDate,
    existingHolidayDates = [],
    locked,
}) {
    const [loading, setLoading] = useState(false);
    const [holidays, setHolidays] = useState([]);
    const [selected, setSelected] = useState(() => new Set());
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        const savedKey = (existingHolidayDates || [])
            .map((date) => String(date || '').trim())
            .filter((date) => ISO.test(date))
            .join('|');
        setError('');
        setLoading(true);
        (async () => {
            try {
                const list = await fetchHolidaysInPeriod(fromDate, toDate);
                if (cancelled) return;
                setHolidays(list);
                setSelected(new Set(savedKey ? savedKey.split('|') : []));
            } catch {
                if (cancelled) return;
                const list = mergeHolidaysInPeriod(fromDate, toDate, []);
                setHolidays(list);
                setSelected(new Set(savedKey ? savedKey.split('|') : []));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, fromDate, toDate, existingHolidayDates]);

    const checkedCount = selected.size;
    const allChecked = holidays.length > 0 && holidays.every((row) => selected.has(row.date));

    function toggle(date) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    }

    function toggleAll() {
        if (allChecked) {
            setSelected(new Set());
            return;
        }
        setSelected(new Set(holidays.map((row) => row.date)));
    }

    return (
        <ModalShell open={open} title="Add the holidays" onClose={onClose} width="max-w-lg" zClass="z-[100]">
            <p className="mt-1 text-[12px] text-[#64748B]">
                Check the holidays to save. Only checked days are listed in Historical Leave History, and each row
                reduces 1 day from the eligible day total.
            </p>
            {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
            <div className="mt-3 flex items-center justify-between">
                <button
                    type="button"
                    disabled={locked || !holidays.length}
                    onClick={toggleAll}
                    className="text-[12px] font-semibold text-[#2563EB] hover:underline disabled:opacity-50"
                >
                    {allChecked ? 'Clear all' : 'Select all'}
                </button>
                <span className="text-[12px] text-[#64748B]">
                    {checkedCount} selected · {holidays.length} in period
                </span>
            </div>
            <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-xl border border-[#E6EAF0]">
                {loading ? (
                    <p className="px-3 py-8 text-center text-[13px] text-[#94A3B8]">Loading UAE holidays…</p>
                ) : holidays.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[13px] text-[#94A3B8]">
                        No UAE holidays fall between the contract joining date and salary processing start.
                    </p>
                ) : (
                    <ul className="divide-y divide-[#F1F5F9]">
                        {holidays.map((row) => (
                            <li key={row.date}>
                                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={selected.has(row.date)}
                                        disabled={locked}
                                        onChange={() => toggle(row.date)}
                                    />
                                    <span>
                                        <span className="block text-[13px] font-medium text-[#0F172A]">{row.name}</span>
                                        <span className="block text-[12px] text-[#64748B]">{prettyDate(row.date)}</span>
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={locked || loading}
                    onClick={() => {
                        const chosen = holidays.filter((row) => selected.has(row.date));
                        if (!fromDate || !toDate) {
                            setError('Set the contract joining date and salary processing start first.');
                            return;
                        }
                        onSave(chosen);
                        onClose();
                    }}
                    className="h-10 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    Save holidays
                </button>
            </div>
        </ModalShell>
    );
}

function aed(value, currency = 'AED') {
    const n = Number(value) || 0;
    return `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function aedMoney(value, currency = 'AED') {
    const n = Number(value);
    const amount = Number.isFinite(n) ? n : 0;
    return `${currency} ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function prettyMonth(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return monthKey || '—';
    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));
    return format(new Date(year, month - 1, 1), 'MMM yyyy');
}

function FieldLabel({ children, required }) {
    return (
        <span className="mb-1.5 block text-[12px] font-medium text-[#64748B]">
            {children}
            {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </span>
    );
}

function ReadinessRing({ value }) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    const size = 72;
    const stroke = 6;
    const r = (size - stroke) / 2 - 2;
    const c = 2 * Math.PI * r;
    return (
        <div
            className="relative h-[68px] w-[68px] shrink-0 rounded-full"
            style={{ boxShadow: '0 0 0 1.5px #111827' }}
        >
            <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * c} ${c}`}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[14px] font-bold tabular-nums text-[#16A34A]">{pct}%</span>
            </div>
        </div>
    );
}

function CardIcon({ children, tone = 'blue' }) {
    const tones = {
        blue: 'bg-[#E8F1FF] text-[#2563EB]',
        red: 'bg-[#FDECEC] text-[#E11D48]',
        violet: 'bg-[#F3E8FF] text-[#7C3AED]',
        teal: 'bg-[#E8F8F4] text-[#0F766E]',
    };
    return (
        <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${tones[tone] || tones.blue}`}
        >
            {children}
        </div>
    );
}

function CompleteBadge({ complete }) {
    if (complete) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-medium text-[#15803D]">
                <Check size={11} strokeWidth={2.6} /> Complete
            </span>
        );
    }
    return (
        <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium text-[#D97706]">
            Incomplete
        </span>
    );
}

function GhostButton({ children, ...props }) {
    return (
        <button
            type="button"
            {...props}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] font-semibold text-[#2563EB] hover:bg-slate-50 disabled:opacity-50"
        >
            {children}
        </button>
    );
}

function ModalShell({ open, title, onClose, children, width = 'max-w-md', zClass = 'z-[90]' }) {
    if (!open) return null;
    return (
        <div className={`fixed inset-0 ${zClass} flex items-center justify-center p-4`}>
            <button type="button" className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-label="Close" />
            <div className={`relative w-full ${width} rounded-2xl bg-white p-5 shadow-2xl`}>
                <h3 className="text-base font-bold text-slate-800">{title}</h3>
                {children}
            </div>
        </div>
    );
}

function leaveSourceKey(row) {
    const raw = String(row?.source || 'manual').trim().toLowerCase();
    if (raw === 'erp' || raw === 'system') return 'system';
    return 'manual';
}

function leaveRowsForGroup(rows, type, source) {
    return (Array.isArray(rows) ? rows : []).filter(
        (row) => leaveTypeKey(row) === type && leaveSourceKey(row) === source,
    );
}

function summarizeLeaveHistoryGroups(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const groups = [];
    for (const type of LEAVE_TYPES) {
        for (const source of LEAVE_SOURCES) {
            const items = leaveRowsForGroup(list, type.key, source.key);
            if (!items.length) continue;
            let actualDays = 0;
            let deductionDays = 0;
            const multipliers = new Set();
            items.forEach((row) => {
                actualDays += Number(row.actualDays ?? row.eligibleWorkingDays) || 0;
                deductionDays += Number(row.deductionDays ?? row.deduction) || 0;
                multipliers.add(formatLeaveMultiplier(row.multiplier ?? row.rule));
            });
            groups.push({
                type: type.key,
                source: source.key,
                label: type.label,
                color: type.color,
                sourceLabel: source.label,
                count: items.length,
                actualDays,
                deductionDays,
                rule: multipliers.size === 1 ? [...multipliers][0] : 'Mixed',
            });
        }
    }
    return groups;
}

function isSystemLeave(row) {
    return leaveSourceKey(row) === 'system';
}

function toHiddenSystemLeave(value) {
    const seen = new Set();
    const out = [];
    for (const row of Array.isArray(value) ? value : []) {
        const leaveType = String(row?.leaveType || '').trim().toLowerCase();
        if (!leaveType) continue;
        const fromDate = String(row?.fromDate || row?.startDate || '').trim();
        if (fromDate === '*') {
            const key = `${leaveType}|*|*`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ leaveType, fromDate: '*', toDate: '*' });
            continue;
        }
        const toDate = String(row?.toDate || row?.endDate || fromDate).trim() || fromDate;
        if (!fromDate) continue;
        const key = `${leaveType}|${fromDate}|${toDate}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ leaveType, fromDate, toDate });
    }
    return out;
}

function isHiddenSystemLeaveRow(row, hidden) {
    const type = String(row?.leaveType || '').trim().toLowerCase();
    const from = String(row?.fromDate || row?.startDate || '').trim();
    const to = String(row?.toDate || row?.endDate || from).trim() || from;
    if (!type) return false;
    return (hidden || []).some((item) => {
        if (String(item?.leaveType || '').toLowerCase() !== type) return false;
        if (String(item?.fromDate || '') === '*') return true;
        const hideFrom = String(item?.fromDate || '').trim();
        const hideTo = String(item?.toDate || hideFrom).trim() || hideFrom;
        if (!from || !hideFrom) return false;
        return from <= hideTo && to >= hideFrom;
    });
}

function filterHiddenSystemLeave(rows, hidden) {
    const list = toHiddenSystemLeave(hidden);
    if (!list.length) return Array.isArray(rows) ? rows : [];
    return (Array.isArray(rows) ? rows : []).filter((row) => !isHiddenSystemLeaveRow(row, list));
}

function mergeServerLeave(local, incoming) {
    const imported = Array.isArray(incoming) ? incoming : [];
    const importedKeys = new Set(
        imported.map((row) =>
            [
                String(row?.leaveType || '').toLowerCase(),
                row?.fromDate || row?.startDate || '',
                row?.toDate || row?.endDate || '',
            ].join('|'),
        ),
    );
    const manual = (Array.isArray(local) ? local : []).filter((row) => {
        if (isSystemLeave(row)) return false;
        const key = [
            String(row?.leaveType || '').toLowerCase(),
            row?.fromDate || row?.startDate || '',
            row?.toDate || row?.endDate || '',
        ].join('|');
        return !importedKeys.has(key);
    });
    return [...imported, ...manual].filter((row) => !isSystemLeave(row));
}

function historicalLeaveOnly(rows) {
    return (Array.isArray(rows) ? rows : []).filter((row) => !isSystemLeave(row));
}

function mergeAdjacentSystemLeave(rows, leaveMultipliers) {
    const list = (Array.isArray(rows) ? rows : [])
        .map((row) => {
            const fromDate = row.fromDate || row.startDate || '';
            const toDate = row.toDate || row.endDate || fromDate;
            const eligible = Math.max(0, Number(row.eligibleWorkingDays ?? row.actualDays) || 0);
            const multiplier = leaveMultiplier(row.leaveType, row.multiplier ?? row.rule, leaveMultipliers);
            return {
                ...row,
                source: 'system',
                fromDate,
                toDate,
                startDate: fromDate,
                endDate: toDate,
                eligibleWorkingDays: eligible,
                actualDays: eligible,
                multiplier,
                rule: multiplier,
                deductionDays: eligible * multiplier,
                deduction: eligible * multiplier,
            };
        })
        .sort((a, b) => {
            const type = String(a.leaveType || '').localeCompare(String(b.leaveType || ''));
            if (type !== 0) return type;
            return String(a.fromDate || '').localeCompare(String(b.fromDate || ''));
        });

    const out = [];
    for (const row of list) {
        const last = out[out.length - 1];
        const nextFrom = addDays(last?.toDate, 1);
        if (
            last &&
            String(last.leaveType || '').toLowerCase() === String(row.leaveType || '').toLowerCase() &&
            nextFrom &&
            nextFrom === row.fromDate &&
            String(last.remarks || '') === String(row.remarks || '')
        ) {
            last.toDate = row.toDate;
            last.endDate = row.toDate;
            last.eligibleWorkingDays += row.eligibleWorkingDays;
            last.actualDays += row.actualDays;
            last.calendarDays = inclusiveCalendarDays(last.fromDate, last.toDate);
            last.deductionDays = last.eligibleWorkingDays * last.multiplier;
            last.deduction = last.deductionDays;
            continue;
        }
        out.push({ ...row, id: row.id || `system-${row.leaveType}-${row.fromDate}-${out.length}` });
    }
    return out;
}

function systemLeaveHistoryRows(rows, leaveMultipliers) {
    const dated = [];
    const counted = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        if (isCountOnlyLeaveType(leaveTypeKey(row))) counted.push(row);
        else dated.push(row);
    }
    return [
        ...mergeAdjacentSystemLeave(dated, leaveMultipliers),
        ...consolidateCountOnlyLeaveRecords(
            counted.map((row) => ({ ...row, source: 'system' })),
            leaveMultipliers,
        ),
    ];
}

function upsertCountOnlyLeave(list, row, editingIndex, leaveMultipliers) {
    const type = leaveTypeKey(row);
    const records = Array.isArray(list) ? list : [];
    if (!isCountOnlyLeaveType(type)) {
        if (Number.isInteger(editingIndex)) {
            return records.map((existing, i) => (i === editingIndex ? { ...existing, ...row } : existing));
        }
        return [...records, row];
    }
    const addDaysCount = Math.max(0, Number(row?.eligibleWorkingDays ?? row?.actualDays) || 0);
    const multiplier = leaveMultiplier(type, row?.multiplier ?? row?.rule, leaveMultipliers);
    const withCount = (existing, days) => ({
        ...(existing || {}),
        ...row,
        id: existing?.id || row?.id,
        leaveType: type,
        source: 'manual',
        fromDate: '',
        toDate: '',
        startDate: '',
        endDate: '',
        eligibleWorkingDays: days,
        actualDays: days,
        calendarDays: days,
        multiplier,
        rule: multiplier,
        deductionDays: days * multiplier,
        deduction: days * multiplier,
    });
    if (Number.isInteger(editingIndex) && records[editingIndex]) {
        return records.map((item, i) => (i === editingIndex ? withCount(item, addDaysCount) : item));
    }
    const existingIndex = records.findIndex(
        (item) => leaveTypeKey(item) === type && leaveSourceKey(item) !== 'system',
    );
    if (existingIndex >= 0) {
        const existing = records[existingIndex];
        const days = (Number(existing.eligibleWorkingDays ?? existing.actualDays) || 0) + addDaysCount;
        return records.map((item, i) => (i === existingIndex ? withCount(existing, days) : item));
    }
    return [...records, withCount(row, addDaysCount)];
}

function asLeaveRecord(row, fallbackType = '') {
    if (!row) return row;
    const fromDate = row.fromDate || row.startDate || '';
    const toDate = row.toDate || row.endDate || '';
    return {
        ...row,
        leaveType: String(row.leaveType || fallbackType || 'sick').toLowerCase(),
        fromDate,
        toDate,
        startDate: row.startDate || fromDate,
        endDate: row.endDate || toDate,
    };
}

function combineLeaveRows(leaveRecords, annualLeaveRecords) {
    const keys = new Set();
    const out = [];
    const push = (row, fallbackType) => {
        const normalized = asLeaveRecord(row, fallbackType);
        const key = normalized.id
            ? `id:${normalized.id}`
            : [
                  normalized.leaveType,
                  normalized.fromDate,
                  normalized.toDate,
                  normalized.eligibleWorkingDays || normalized.actualDays || '',
                  normalized.remarks || '',
              ].join('|');
        if (keys.has(key)) return;
        keys.add(key);
        out.push(normalized);
    };
    (leaveRecords || []).forEach((row) => push(row, row?.leaveType || 'sick'));
    (annualLeaveRecords || []).forEach((row) => push(row, 'annual'));
    return out;
}

function splitLeavePayload(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const leaveRecords = list.filter((row) => String(row?.leaveType || '').toLowerCase() !== 'annual');
    const annualLeaveRecords = list
        .filter((row) => String(row?.leaveType || '').toLowerCase() === 'annual')
        .map((row) => ({
            ...row,
            leaveType: 'annual',
            startDate: row.startDate || row.fromDate,
            endDate: row.endDate || row.toDate,
            fromDate: row.fromDate || row.startDate,
            toDate: row.toDate || row.endDate,
            returnToWorkDate: row.returnToWorkDate || addDays(row.toDate || row.endDate, 1),
        }));
    return { leaveRecords, annualLeaveRecords };
}

function snapshotLeaveRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
        id: String(row.id || row._id || ''),
        leaveType: String(row.leaveType || '').toLowerCase(),
        fromDate: String(row.fromDate || row.startDate || ''),
        toDate: String(row.toDate || row.endDate || ''),
        actualDays: Number(row.actualDays ?? row.eligibleWorkingDays) || 0,
        remarks: String(row.remarks || ''),
        includeLeave: Boolean(row.includeLeave),
        includeTicket: Boolean(row.includeTicket),
        leaveSalaryAmount: Number(row.leaveSalaryAmount) || 0,
        ticketAmount: Number(row.ticketAmount) || 0,
        reduceHistoricalWorkingDays: Boolean(row.reduceHistoricalWorkingDays),
    }));
}

function snapshotPaymentCycles(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
        id: String(row.id || row._id || ''),
        cycleNumber: Number(row.cycleNumber) || 0,
        leaveProcessDate: String(row.leaveProcessDate || ''),
        ticketProcessDate: String(row.ticketProcessDate || ''),
        leaveSalaryPaymentDate: String(row.leaveSalaryPaymentDate || ''),
        leaveSalaryAmount: Number(row.leaveSalaryAmount) || 0,
        ticketPaymentDate: String(row.ticketPaymentDate || ''),
        ticketAmount: Number(row.ticketAmount) || 0,
        includeLeave: row.includeLeave !== false,
        includeTicket: row.includeTicket !== false,
        reduceHistoricalWorkingDays: row.reduceHistoricalWorkingDays !== false,
        annualLeaveKey: String(row.annualLeaveKey || ''),
        currency: String(row.currency || ''),
        paymentReference: String(row.paymentReference || ''),
        paymentStatus: String(row.paymentStatus || ''),
        remarks: String(row.remarks || ''),
        attachment: String(row.attachment?.name || row.attachment?.url || ''),
    }));
}

function buildFormSnapshot({
    joiningDate = '',
    verpStartDate = '',
    companyMolCode = '',
    employeeMolId = '',
    salarySlip = false,
    leaveRecords = [],
    paymentCycles = [],
    leaveComplete = false,
    benefitsComplete = false,
    hiddenSystemLeave = [],
} = {}) {
    return JSON.stringify({
        joiningDate: String(joiningDate || ''),
        verpStartDate: String(verpStartDate || ''),
        companyMolCode: String(companyMolCode || '').trim(),
        employeeMolId: String(employeeMolId || '').trim(),
        salarySlip: Boolean(salarySlip),
        leaveRecords: snapshotLeaveRows(leaveRecords),
        paymentCycles: snapshotPaymentCycles(paymentCycles),
        leaveComplete: Boolean(leaveComplete),
        benefitsComplete: Boolean(benefitsComplete),
        hiddenSystemLeave: toHiddenSystemLeave(hiddenSystemLeave),
    });
}

async function fileToAttachment(file) {
    if (!file) return null;
    const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    return { name: file.name, mimeType: file.type, data };
}

function dateKeyToLocalDate(value) {
    if (!ISO.test(String(value || '').trim())) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
}

function leaveDateDisabledDays(minKey, maxKey) {
    const min = dateKeyToLocalDate(minKey);
    const max = dateKeyToLocalDate(maxKey);
    if (min && max && String(minKey) > String(maxKey)) return true;
    if (min && max) return { before: min, after: max };
    if (min) return { before: min };
    if (max) return { after: max };
    return undefined;
}

function newLeaveRecordId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `leave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function leaveCountFromRow(row) {
    const n = Number(row?.eligibleWorkingDays ?? row?.actualDays ?? row?.calendarDays);
    if (Number.isFinite(n) && n > 0) return String(n);
    const from = row?.fromDate || row?.startDate || '';
    const to = row?.toDate || row?.endDate || from;
    const days = inclusiveCalendarDays(from, to);
    return days > 0 ? String(days) : '';
}

function AddLeaveModal({
    open,
    onClose,
    onSave,
    periodStart,
    periodEnd,
    locked,
    leaveMultipliers,
    initial,
}) {
    const editing = Boolean(initial);
    const [leaveType, setLeaveType] = useState(initial?.leaveType || 'sick');
    const [fromDate, setFromDate] = useState(initial?.fromDate || initial?.startDate || '');
    const [toDate, setToDate] = useState(initial?.toDate || initial?.endDate || '');
    const [daysCount, setDaysCount] = useState(() => leaveCountFromRow(initial));
    const [remarks, setRemarks] = useState(initial?.remarks || '');
    const [file, setFile] = useState(null);
    const skipDateAutoCount = useRef(true);

    const resolvedFrom = fromDate || toDate;
    const resolvedTo = toDate || fromDate;
    const autoDays = inclusiveCalendarDays(resolvedFrom, resolvedTo);

    useEffect(() => {
        if (skipDateAutoCount.current) {
            skipDateAutoCount.current = false;
            return;
        }
        if (autoDays > 0) setDaysCount(String(autoDays));
    }, [autoDays]);

    const countNum = Math.max(0, Number(daysCount) || 0);
    const isAnnual = String(leaveType).toLowerCase() === 'annual';
    const datesRequired = isDatedLeaveType(leaveType);
    const showDates = datesRequired || isOptionalDateLeaveType(leaveType);
    const multiplier = leaveMultiplier(leaveType, null, leaveMultipliers);
    const existingAttachmentName = initial?.attachment?.name || '';
    const dateError = showDates
        ? validateLeaveDates(
              { leaveType, fromDate, toDate, eligibleWorkingDays: Math.max(countNum, 1) },
              periodStart,
              periodEnd,
          )
        : '';
    const startDisabledDays = leaveDateDisabledDays(periodStart);
    const endDisabledDays = leaveDateDisabledDays(fromDate || periodStart);
    const canSave = countNum > 0 && !locked && !dateError && (!datesRequired || (fromDate && toDate));

    return (
        <ModalShell open={open} title={editing ? 'Edit leave record' : 'Add leave record'} onClose={onClose} width="max-w-lg" zClass="z-[100]">
            <div className="mt-4 space-y-3">
                <label className="block">
                    <FieldLabel>Leave type</FieldLabel>
                    <select
                        value={leaveType}
                        onChange={(e) => {
                            const nextType = e.target.value;
                            setLeaveType(nextType);
                            if (isCountOnlyLeaveType(nextType)) {
                                setFromDate('');
                                setToDate('');
                            }
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                        {LEAVE_TYPES.filter(
                            (row) => row.key !== 'holiday' || String(leaveType).toLowerCase() === 'holiday',
                        ).map((row) => (
                            <option key={row.key} value={row.key}>
                                {row.label} (× {formatLeaveMultiplier(leaveMultiplier(row.key, null, leaveMultipliers))})
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                        Deduction follows this employee&apos;s work location / group salary policy.
                    </p>
                </label>
                {showDates ? (
                    <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <FieldLabel required={datesRequired}>Start date</FieldLabel>
                                <DatePicker
                                    value={fromDate}
                                    onChange={(value) => {
                                        setFromDate(value);
                                        if (value && toDate && toDate < value) setToDate('');
                                    }}
                                    disabled={locked}
                                    disabledDays={startDisabledDays}
                                    className="h-11 w-full rounded-xl"
                                />
                            </label>
                            <label className="block">
                                <FieldLabel required={datesRequired}>End date</FieldLabel>
                                <DatePicker
                                    value={toDate}
                                    onChange={setToDate}
                                    disabled={locked}
                                    disabledDays={endDisabledDays}
                                    className="h-11 w-full rounded-xl"
                                />
                            </label>
                        </div>
                ) : null}
                <label className="block">
                    <FieldLabel required>Day count</FieldLabel>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={daysCount}
                        onChange={(e) => setDaysCount(e.target.value)}
                        disabled={locked}
                        placeholder="Days"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-[#F8FAFC]"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                        {datesRequired
                            ? `Start and end dates are required. The count fills in from those dates and you can still change it.${
                                  isAnnual
                                      ? ` End date can be after the historical period (${prettyDate(periodStart)} — ${prettyDate(periodEnd)}).`
                                      : ''
                              }`
                            : showDates
                              ? 'Start and end dates are optional. If you pick dates, the count fills in from those dates and you can still change it.'
                              : editing
                                ? 'Dates are not used. Saving replaces the Manual count for this leave type. System leave stays on its own row.'
                                : 'Dates are not used. This count is added to the existing Manual row for this leave type. System leave stays on its own row.'}
                    </p>
                </label>
                {dateError ? <p className="text-xs font-medium text-red-600">{dateError}</p> : null}
                <label className="block">
                    <FieldLabel>Remarks</FieldLabel>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                </label>
                <label className="block text-sm text-slate-600">
                    Supporting document
                    <input type="file" className="mt-1 block w-full text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    {!file && existingAttachmentName ? (
                        <p className="mt-1 text-[11px] text-slate-400">Current file: {existingAttachmentName}</p>
                    ) : null}
                </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!canSave}
                    onClick={async () => {
                        if (!canSave) return;
                        const uploaded = await fileToAttachment(file);
                        onSave({
                            ...(initial || {}),
                            id: initial?.id || newLeaveRecordId(),
                            leaveType,
                            fromDate: showDates ? fromDate : '',
                            toDate: showDates ? toDate : '',
                            calendarDays: showDates ? autoDays || countNum : countNum,
                            actualDays: countNum,
                            eligibleWorkingDays: countNum,
                            multiplier,
                            rule: multiplier,
                            deductionDays: countNum * multiplier,
                            deduction: countNum * multiplier,
                            source: 'manual',
                            status: 'approved',
                            remarks,
                            includeLeave: Boolean(initial?.includeLeave),
                            includeTicket: Boolean(initial?.includeTicket),
                            leaveSalaryAmount: Number(initial?.leaveSalaryAmount) || 0,
                            ticketAmount: Number(initial?.ticketAmount) || 0,
                            reduceHistoricalWorkingDays: Boolean(initial?.reduceHistoricalWorkingDays),
                            attachment: uploaded || initial?.attachment || null,
                        });
                        onClose();
                    }}
                    className="h-10 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {editing ? 'Save' : 'Add record'}
                </button>
            </div>
        </ModalShell>
    );
}

function PaymentTypeFields({
    includeLeave,
    includeTicket,
    onLeaveChange,
    onTicketChange,
    leaveSalaryAmount,
    ticketAmount,
    onLeaveAmountChange,
    onTicketAmountChange,
    leaveSalaryPaymentDate,
    ticketPaymentDate,
    onLeaveDateChange,
    onTicketDateChange,
    reduceHistoricalWorkingDays,
    onReduceChange,
    reduceLocked = false,
    cycleDays,
    defaultLeaveSalary,
    showDates = true,
    dateOptions = [],
    showReduce = true,
}) {
    const options = Array.isArray(dateOptions) ? dateOptions : [];
    function DateField({ value, onChange, label }) {
        if (options.length) {
            return (
                <label className="block">
                    <FieldLabel>{label}</FieldLabel>
                    <select
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                        <option value="">Select date</option>
                        {options.map((row) => (
                            <option key={row.date} value={row.date}>
                                {row.label}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }
        return (
            <label className="block">
                <FieldLabel>{label}</FieldLabel>
                <DatePicker
                    value={value}
                    onChange={onChange}
                    className="h-11 w-full rounded-xl"
                />
            </label>
        );
    }
    return (
        <div className="col-span-2 space-y-3">
            <div>
                <FieldLabel>Payment type</FieldLabel>
                <div className="mt-1 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-[13px] text-[#334155]">
                        <input
                            type="checkbox"
                            checked={includeLeave}
                            onChange={(e) => onLeaveChange(e.target.checked)}
                        />
                        Leave
                    </label>
                    <label className="inline-flex items-center gap-2 text-[13px] text-[#334155]">
                        <input
                            type="checkbox"
                            checked={includeTicket}
                            onChange={(e) => onTicketChange(e.target.checked)}
                        />
                        Ticket
                    </label>
                </div>
            </div>
            {includeLeave || includeTicket ? (
                <div className="grid grid-cols-2 gap-3">
                    {includeLeave ? (
                        <>
                            {showDates ? (
                                <DateField
                                    label="Leave salary date"
                                    value={leaveSalaryPaymentDate}
                                    onChange={onLeaveDateChange}
                                />
                            ) : null}
                            <label className={`block ${showDates ? '' : 'col-span-2 sm:col-span-1'}`}>
                                <FieldLabel>Leave salary amount</FieldLabel>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={leaveSalaryAmount}
                                    onChange={(e) => onLeaveAmountChange(e.target.value)}
                                    className="h-11 w-full rounded-xl border px-3 text-sm"
                                />
                                {options.length ? (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        Filled from the selected date. You can change it.
                                    </p>
                                ) : defaultLeaveSalary ? (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        Auto-filled from this employee&apos;s leave salary. You can change it.
                                    </p>
                                ) : null}
                            </label>
                        </>
                    ) : null}
                    {includeTicket ? (
                        <>
                            {showDates ? (
                                <DateField
                                    label="Ticket payment date"
                                    value={ticketPaymentDate}
                                    onChange={onTicketDateChange}
                                />
                            ) : null}
                            <label className={`block ${showDates ? '' : 'col-span-2 sm:col-span-1'}`}>
                                <FieldLabel>Ticket amount</FieldLabel>
                                <input
                                    type="number"
                                    min="0"
                                    value={ticketAmount}
                                    onChange={(e) => onTicketAmountChange(e.target.value)}
                                    className="h-11 w-full rounded-xl border px-3 text-sm"
                                />
                                {options.length ? (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        Filled from the selected date. You can change it.
                                    </p>
                                ) : null}
                            </label>
                        </>
                    ) : null}
                </div>
            ) : null}
            {showReduce ? (
            <label className={`inline-flex items-start gap-2 text-[13px] ${reduceLocked ? 'text-[#94A3B8]' : 'text-[#334155]'}`}>
                <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={reduceHistoricalWorkingDays}
                    disabled={reduceLocked}
                    onChange={(e) => onReduceChange(e.target.checked)}
                />
                <span>
                    Reduce the historical working day ( {cycleDays})
                    {reduceLocked ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-[#64748B]">
                            Already reduced once for this annual leave. It stays applied and cannot be reduced again.
                        </span>
                    ) : null}                              
                </span>
            </label>
            ) : null}
        </div>
    );
}

function amountInputValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    return String(n);
}

function clampMoneyInput(raw, maxAmount) {
    const cap = roundMoney(Math.max(0, Number(maxAmount) || 0));
    if (raw === '' || raw == null) return '';
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return '';
    if (n > cap) return cap > 0 ? String(cap) : '';
    return raw;
}

function pendingKindAmount(kind, dateOptions, previewCycles, dueTotal) {
    const hasDueRows = (Array.isArray(dateOptions) ? dateOptions : []).some(
        (opt) => (Number(kind === 'ticket' ? opt.ticketAmount : opt.leaveSalary) || 0) > 0,
    );
    if (hasDueRows) return totalRemainingKind(dateOptions, previewCycles, kind);
    const paid =
        kind === 'ticket' ? cycleTicketPaid(previewCycles) : cycleLeaveSalaryPaid(previewCycles);
    return payableBalance(dueTotal, paid);
}

function makePaymentCycleRow(ctx, { part, index, rowPaymentDate, leave, ticket, attachment, inheritInitial }) {
    const rowIncludesLeave = leave > 0;
    const rowIncludesTicket = ticket > 0;
    const baseCycle = Number(ctx.initial?.cycleNumber) || ctx.nextNumber || 1;
    return {
        ...(inheritInitial ? ctx.initial || {} : {}),
        cycleNumber: baseCycle + index,
        eligibilityStartDate: ctx.selectedLeave?.fromDate || ctx.initial?.eligibilityStartDate || '',
        eligibilityEndDate: ctx.selectedLeave?.toDate || ctx.initial?.eligibilityEndDate || '',
        entitlementDays:
            index === 0 && (ctx.thisCycleReduced || (!ctx.othersReduced && ctx.reduceChecked))
                ? ctx.cycleDays
                : 0,
        includeLeave: rowIncludesLeave,
        includeTicket: rowIncludesTicket,
        leaveProcessDate: rowIncludesLeave ? ctx.leavePaymentDate || rowPaymentDate : '',
        ticketProcessDate: rowIncludesTicket ? ctx.ticketPaymentDate || rowPaymentDate : '',
        leaveSalaryPaymentDate: rowIncludesLeave ? part.entitlementDate || rowPaymentDate : '',
        leaveSalaryAmount: leave,
        leaveSalary: leave,
        ticketPaymentDate: rowIncludesTicket ? part.entitlementDate || rowPaymentDate : '',
        ticketAmount: ticket,
        paymentDate: ctx.leavePaymentDate || ctx.ticketPaymentDate || rowPaymentDate,
        entitlementDate: part.entitlementDate || '',
        entitlementNo: part.entitlementNo || 0,
        reduceHistoricalWorkingDays:
            index === 0 ? (ctx.thisCycleReduced ? true : ctx.othersReduced ? false : ctx.reduceChecked) : false,
        currency: ctx.currency,
        paymentReference: ctx.paymentReference,
        paymentStatus: ctx.paymentStatus,
        verificationStatus: ctx.initial?.verificationStatus || 'verified',
        remarks: ctx.remarks,
        annualLeaveKey: ctx.annualLeaveKeyValue,
        attachment,
    };
}

function buildAllocatedPaymentCycleRows(ctx) {
    const allocations = buildCycleAllocations(ctx);
    const first = allocations[0] || {};
    return [
        {
            ...makePaymentCycleRow(ctx, {
                part: {
                    entitlementNo: first.entitlementNo || 0,
                    entitlementDate: first.entitlementDate || '',
                },
                index: 0,
                rowPaymentDate: ctx.leavePaymentDate || ctx.ticketPaymentDate,
                leave: ctx.saveLeave ? roundMoney(ctx.leaveAmt) : 0,
                ticket: ctx.saveTicket ? roundMoney(ctx.ticketAmt) : 0,
                attachment: ctx.attachment,
                inheritInitial: true,
            }),
            cycleNumber: Number(ctx.initial?.cycleNumber) || ctx.nextNumber || 1,
            allocations,
        },
    ];
}

function buildEditedPaymentCycleRow(ctx) {
    const allocations = buildCycleAllocations(ctx);
    const first = allocations[0] || {};
    return [
        {
            ...(ctx.initial || {}),
            cycleNumber: Number(ctx.initial?.cycleNumber) || ctx.nextNumber || 1,
            eligibilityStartDate: ctx.selectedLeave?.fromDate || ctx.initial?.eligibilityStartDate || '',
            eligibilityEndDate: ctx.selectedLeave?.toDate || ctx.initial?.eligibilityEndDate || '',
            entitlementDays: ctx.thisCycleReduced || (!ctx.othersReduced && ctx.reduceChecked) ? ctx.cycleDays : 0,
            includeLeave: ctx.saveLeave,
            includeTicket: ctx.saveTicket,
            leaveProcessDate: ctx.saveLeave ? ctx.leavePaymentDate : '',
            ticketProcessDate: ctx.saveTicket ? ctx.ticketPaymentDate : '',
            leaveSalaryPaymentDate: ctx.saveLeave
                ? first.kind === 'leave'
                    ? first.entitlementDate || ctx.leavePaymentDate
                    : ctx.initial?.entitlementDate || ctx.initial?.leaveSalaryPaymentDate || ctx.leavePaymentDate
                : '',
            leaveSalaryAmount: ctx.saveLeave ? ctx.leaveAmt : 0,
            leaveSalary: ctx.saveLeave ? ctx.leaveAmt : 0,
            ticketPaymentDate: ctx.saveTicket
                ? first.kind === 'ticket'
                    ? first.entitlementDate || ctx.ticketPaymentDate
                    : ctx.initial?.entitlementDate || ctx.initial?.ticketPaymentDate || ctx.ticketPaymentDate
                : '',
            ticketAmount: ctx.saveTicket ? ctx.ticketAmt : 0,
            paymentDate: ctx.saveLeave ? ctx.leavePaymentDate : ctx.ticketPaymentDate,
            entitlementDate: first.entitlementDate || ctx.initial?.entitlementDate || '',
            entitlementNo: first.entitlementNo || ctx.initial?.entitlementNo || 0,
            reduceHistoricalWorkingDays: ctx.thisCycleReduced ? true : ctx.othersReduced ? false : ctx.reduceChecked,
            currency: ctx.currency,
            paymentReference: ctx.paymentReference,
            paymentStatus: ctx.paymentStatus,
            verificationStatus: ctx.initial?.verificationStatus || 'verified',
            remarks: ctx.remarks,
            annualLeaveKey: ctx.annualLeaveKeyValue,
            attachment: ctx.attachment,
            allocations,
        },
    ];
}

function PaymentCycleKindFields({
    dateLabel,
    amountLabel,
    amount,
    onAmountChange,
    paymentDate,
    onDateChange,
    disabled = false,
    pendingAmount = 0,
    selectedLabel = '',
}) {
    const pending = roundMoney(Math.max(0, Number(pendingAmount) || 0));
    const pendingHint = selectedLabel
        ? `Selected ${selectedLabel} · ${aedMoney(pending)}`
        : pending > 0
          ? `Pending ${aedMoney(pending)} · enter this or less`
          : 'No pending amount';
    return (
        <div className="space-y-3 rounded-[10px] border border-[#E6EAF0] bg-[#F8FAFC] p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                    <FieldLabel>{dateLabel}</FieldLabel>
                    <DatePicker
                        value={paymentDate}
                        onChange={onDateChange}
                        disabled={disabled}
                        className="h-11 w-full rounded-xl"
                    />
                </label>
                <label className="block">
                    <FieldLabel>{amountLabel}</FieldLabel>
                    <input
                        type="number"
                        min="0"
                        max={pending}
                        step="0.01"
                        disabled={disabled || pending <= 0}
                        value={amount}
                        onChange={(e) => onAmountChange(clampMoneyInput(e.target.value, pending))}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums disabled:bg-slate-50"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">{pendingHint}</p>
                </label>
            </div>
        </div>
    );
}

function AddCycleModal({
    open,
    onClose,
    onSave,
    onDelete,
    cycleDays,
    nextNumber,
    locked,
    viewOnly = false,
    initial,
    editing,
    defaultTab = 'leave',
    annualLeaves = [],
    paymentCycles = [],
    editingIndex = -1,
    entitlements,
    leaveDueTotal = 0,
    ticketDueTotal = 0,
}) {
    const options = Array.isArray(annualLeaves) ? annualLeaves : [];
    const dateOptions = entitlementDateOptions(entitlements);
    const [annualLeaveKeyValue] = useState(
        () => initial?.annualLeaveKey || (initial?.eligibilityStartDate
            ? annualLeaveKey({ fromDate: initial.eligibilityStartDate, toDate: initial.eligibilityEndDate })
            : ''),
    );
    const [paymentTab, setPaymentTab] = useState(() => {
        if (defaultTab === 'ticket' || defaultTab === 'leave') {
            if (!initial) return defaultTab;
        }
        if (initial && recordIncludesTicket(initial) && !recordIncludesLeave(initial)) return 'ticket';
        return 'leave';
    });
    const cycleSl = formatCycleSl(initial?.cycleNumber || nextNumber || 1);
    const [leavePaymentDate, setLeavePaymentDate] = useState(() => {
        if (initial && recordIncludesLeave(initial)) {
            return initial?.leaveProcessDate || initial?.paymentDate || initial?.leaveSalaryPaymentDate || '';
        }
        return '';
    });
    const [ticketPaymentDate, setTicketPaymentDate] = useState(() => {
        if (initial && recordIncludesTicket(initial)) {
            return initial?.ticketProcessDate || initial?.paymentDate || initial?.ticketPaymentDate || '';
        }
        return '';
    });
    const [leaveSalaryAmount, setLeaveSalaryAmount] = useState(() => {
        if (initial && recordIncludesLeave(initial)) {
            return amountInputValue(initial?.leaveSalaryAmount ?? initial?.leaveSalary);
        }
        return '';
    });
    const [ticketAmount, setTicketAmount] = useState(() => {
        if (initial && recordIncludesTicket(initial)) {
            return amountInputValue(initial?.ticketAmount);
        }
        return '';
    });
    const [selectedLeaveKey, setSelectedLeaveKey] = useState('');
    const [selectedTicketKey, setSelectedTicketKey] = useState('');
    const [reduceHistoricalWorkingDays] = useState(
        () => recordReducesWorkingDays(initial, false),
    );
    const currency = 'AED';
    const paymentReference = String(initial?.paymentReference || '');
    const paymentStatus = initial?.paymentStatus || 'paid';
    const [remarks, setRemarks] = useState(initial?.remarks || '');
    const [file, setFile] = useState(null);
    const existingAttachmentName = initial?.attachment?.name || '';

    const selectedLeave = options.find((row) => row.key === annualLeaveKeyValue);
    const leaveKey = annualLeaveKeyValue || cycleAnnualLeaveKey(initial);
    const thisCycleReduced = recordReducesWorkingDays(initial, false);
    const othersReduced = annualLeaveAlreadyReduced(paymentCycles, leaveKey, editingIndex);
    const reduceLocked = thisCycleReduced || othersReduced;
    const reduceChecked = reduceLocked ? true : reduceHistoricalWorkingDays;
    const previewCycles = Number.isInteger(editingIndex)
        ? paymentCycles.filter((_, index) => index !== editingIndex)
        : paymentCycles;
    const leaveTarget = parseEntitlementRowKey(selectedLeaveKey);
    const ticketTarget = parseEntitlementRowKey(selectedTicketKey);
    const leavePending = leaveTarget
        ? remainingAmountForTarget(dateOptions, previewCycles, 'leave', leaveTarget)
        : pendingKindAmount('leave', dateOptions, previewCycles, leaveDueTotal);
    const ticketPending = ticketTarget
        ? remainingAmountForTarget(dateOptions, previewCycles, 'ticket', ticketTarget)
        : pendingKindAmount('ticket', dateOptions, previewCycles, ticketDueTotal);
    const leaveAmt = roundMoney(Math.min(Number(leaveSalaryAmount) || 0, leavePending));
    const ticketAmt = roundMoney(Math.min(Number(ticketAmount) || 0, ticketPending));
    const saveLeave = leaveAmt > 0 && Boolean(leavePaymentDate);
    const saveTicket = ticketAmt > 0 && Boolean(ticketPaymentDate);
    const fieldsDisabled = Boolean(locked || viewOnly);
    const canSave =
        !fieldsDisabled &&
        (saveLeave || saveTicket) &&
        leaveAmt <= leavePending &&
        ticketAmt <= ticketPending;
    const combinedTotal = roundMoney((saveLeave ? leaveAmt : 0) + (saveTicket ? ticketAmt : 0));
    const leavePreview = entitlementPaymentPreview(
        dateOptions,
        previewCycles,
        'leave',
        leaveAmt,
        -1,
        leaveTarget,
    );
    const ticketPreview = entitlementPaymentPreview(
        dateOptions,
        previewCycles,
        'ticket',
        ticketAmt,
        -1,
        ticketTarget,
    );
    const selectedLeaveLabel = leaveTarget
        ? `Leave salary ${leaveTarget.entitlementNo || ''}`.trim()
        : '';
    const selectedTicketLabel = ticketTarget
        ? `Ticket ${ticketTarget.entitlementNo || ''}`.trim()
        : '';

    function selectPayableRow(kind, row) {
        const status = String(row?.status || '').toLowerCase();
        if (fieldsDisabled || status === 'paid' || !(Number(row?.balance) > 0 || Number(row?.thisPay) > 0)) {
            return;
        }
        const key = entitlementRowKey(row);
        const remaining = roundMoney((Number(row.balance) || 0) + (Number(row.thisPay) || 0));
        if (kind === 'leave') {
            if (selectedLeaveKey === key) {
                setSelectedLeaveKey('');
                return;
            }
            setSelectedLeaveKey(key);
            setLeaveSalaryAmount(amountInputValue(remaining));
            return;
        }
        if (selectedTicketKey === key) {
            setSelectedTicketKey('');
            return;
        }
        setSelectedTicketKey(key);
        setTicketAmount(amountInputValue(remaining));
    }

    function cycleSaveContext(attachment) {
        return {
            initial,
            nextNumber,
            selectedLeave,
            thisCycleReduced,
            othersReduced,
            reduceChecked,
            cycleDays,
            saveLeave,
            saveTicket,
            leaveAmt,
            ticketAmt,
            leavePaymentDate,
            ticketPaymentDate,
            dateOptions,
            paymentCycles,
            editingIndex,
            currency,
            paymentReference,
            paymentStatus,
            remarks,
            annualLeaveKeyValue,
            attachment,
            leaveTarget,
            ticketTarget,
        };
    }

    function handleSaveClick() {
        if (!canSave) return;
        fileToAttachment(file).then((uploaded) => {
            const attachment = uploaded || initial?.attachment || null;
            const ctx = cycleSaveContext(attachment);
            const rows = editing ? buildEditedPaymentCycleRow(ctx) : buildAllocatedPaymentCycleRows(ctx);
            if (!rows.length) return;
            onSave(rows);
            onClose();
        });
    }

    if (!open) return null;

    return (
        <ModalShell
            open={open}
            title={viewOnly ? 'Payment cycle' : editing ? 'Edit payment cycle' : 'Add payment cycle'}
            onClose={onClose}
            width="max-w-3xl"
        >
            <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] text-[#64748B]">
                        Use the Leave tab, Ticket tab, or both. Same cycle number is used when both are added.
                    </p>
                    <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-[#2563EB]">
                        {cycleSl}
                    </span>
                </div>
                <div className="flex items-center gap-6 border-b border-slate-200" role="tablist" aria-label="Payment type">
                    {[
                        { key: 'leave', label: 'Leave salary' },
                        { key: 'ticket', label: 'Ticket' },
                    ].map((tab) => {
                        const active = paymentTab === tab.key;
                        const filled =
                            tab.key === 'leave'
                                ? leaveAmt > 0 && Boolean(leavePaymentDate)
                                : ticketAmt > 0 && Boolean(ticketPaymentDate);
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setPaymentTab(tab.key)}
                                className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                                    active
                                        ? "text-blue-600 after:content-[''] after:absolute after:left-0 after:-bottom-px after:h-0.5 after:w-full after:bg-blue-500"
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {tab.label}
                                {filled ? (
                                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-600">
                                        Added
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
                <fieldset
                    disabled={fieldsDisabled}
                    className={`min-w-0 space-y-3 border-0 p-0 ${fieldsDisabled ? 'pointer-events-none' : ''}`}
                >
                {paymentTab === 'leave' ? (
                    <PaymentCycleKindFields
                        dateLabel="Leave process date"
                        amountLabel="Leave salary amount"
                        amount={leaveSalaryAmount}
                        onAmountChange={setLeaveSalaryAmount}
                        paymentDate={leavePaymentDate}
                        onDateChange={setLeavePaymentDate}
                        disabled={fieldsDisabled}
                        pendingAmount={leavePending}
                        selectedLabel={selectedLeaveLabel}
                    />
                ) : (
                    <PaymentCycleKindFields
                        dateLabel="Ticket process date"
                        amountLabel="Ticket price"
                        amount={ticketAmount}
                        onAmountChange={setTicketAmount}
                        paymentDate={ticketPaymentDate}
                        onDateChange={setTicketPaymentDate}
                        disabled={fieldsDisabled}
                        pendingAmount={ticketPending}
                        selectedLabel={selectedTicketLabel}
                    />
                )}
                {paymentTab === 'leave' ? (
                    <EntitlementAllocationTable
                        kind="leave"
                        rows={leavePreview.rows}
                        leftover={leavePreview.leftover}
                        selectedKey={selectedLeaveKey}
                        disabled={fieldsDisabled}
                        onSelectRow={(row) => selectPayableRow('leave', row)}
                    />
                ) : (
                    <EntitlementAllocationTable
                        kind="ticket"
                        rows={ticketPreview.rows}
                        leftover={ticketPreview.leftover}
                        selectedKey={selectedTicketKey}
                        disabled={fieldsDisabled}
                        onSelectRow={(row) => selectPayableRow('ticket', row)}
                    />
                )}
                <div className="flex items-center justify-between rounded-[10px] border border-[#E6EAF0] bg-[#F8FAFC] px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                        Total (leave salary + ticket)
                    </p>
                    <p className="text-[14px] font-semibold tabular-nums text-[#0F172A]">{aedMoney(combinedTotal)}</p>
                </div>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks"
                    className="min-h-[64px] w-full rounded-xl border px-3 py-2 text-sm"
                />
                <label className="block text-sm text-slate-600">
                    <FieldLabel>Attachment</FieldLabel>
                    <input
                        type="file"
                        className="mt-1 block w-full text-xs"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Optional supporting document.</p>
                    {!file && existingAttachmentName ? (
                        <p className="mt-1 text-[11px] text-slate-400">Current file: {existingAttachmentName}</p>
                    ) : null}
                </label>
                </fieldset>
            </div>
            <div className="mt-5 flex justify-end gap-2">
                {viewOnly ? (
                    <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm font-semibold">
                        Cancel
                    </button>
                ) : (
                    <>
                {editing && onDelete ? (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="mr-auto h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                        Delete
                    </button>
                ) : null}
                <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!canSave}
                    onClick={handleSaveClick}
                    className="h-10 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {editing ? 'Save' : 'Add'}
                </button>
                    </>
                )}
            </div>
        </ModalShell>
    );
}

function ReasonModal({ open, title, confirmLabel, onClose, onConfirm, description }) {
    const [reason, setReason] = useState('');
    return (
        <ModalShell open={open} title={title} onClose={onClose}>
            {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-4 min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Reason"
            />
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!reason.trim()}
                    onClick={() => onConfirm(reason.trim())}
                    className="h-10 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {confirmLabel}
                </button>
            </div>
        </ModalShell>
    );
}

function SalarySetupLayout({ children }) {
    return (
        <div className="flex min-h-screen w-full" style={{ backgroundColor: '#F4F7FB' }}>
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Navbar />
                {children}
            </div>
        </div>
    );
}

export default function HistoricalSalarySetupView({ employeeId, embedded = false }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const hrEdit =
        hasPermission('hrm_salary', 'isEdit') || hasPermission('hrm_employees_view_salary', 'isEdit');
    const canSeePayrollCodes =
        hasPermission('hrm_salary', 'isView') ||
        hasPermission('hrm_employees_view_salary', 'isView') ||
        hrEdit;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [joiningDate, setJoiningDate] = useState('');
    const [joiningDateReason, setJoiningDateReason] = useState('');
    const [joiningDatePrompt, setJoiningDatePrompt] = useState('');
    const [verpStartDate, setVerpStartDate] = useState('');
    const [companyMolCode, setCompanyMolCode] = useState('');
    const [employeeMolId, setEmployeeMolId] = useState('');
    const [salarySlip, setSalarySlip] = useState(false);
    const [setupTab, setSetupTab] = useState(() =>
        !embedded && searchParams?.get('tab') === 'details' ? 'details' : 'slip',
    );
    const [openingSalarySlip, setOpeningSalarySlip] = useState(false);
    const [leaveRecords, setLeaveRecords] = useState([]);
    const [hiddenSystemLeave, setHiddenSystemLeave] = useState([]);
    const [paymentCycles, setPaymentCycles] = useState([]);
    const [leaveComplete, setLeaveComplete] = useState(false);
    const [benefitsComplete, setBenefitsComplete] = useState(false);
    const [leaveModal, setLeaveModal] = useState(false);
    const [holidaysModal, setHolidaysModal] = useState(false);
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
    const [systemLeaveTypeFilter, setSystemLeaveTypeFilter] = useState('');
    const [leaveGroupModal, setLeaveGroupModal] = useState(null);
    const [leaveDraftIndex, setLeaveDraftIndex] = useState(null);
    const [cycleModal, setCycleModal] = useState(false);
    const [cycleDraft, setCycleDraft] = useState(null);
    const [cycleDraftIndex, setCycleDraftIndex] = useState(null);
    const [cycleModalViewOnly, setCycleModalViewOnly] = useState(false);
    const [cycleModalDefaultTab, setCycleModalDefaultTab] = useState('leave');
    const [cycleDeleteIndex, setCycleDeleteIndex] = useState(null);
    const [leaveDeleteRow, setLeaveDeleteRow] = useState(null);
    const [entitlementDetail, setEntitlementDetail] = useState(null);
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [leaveSalaryDetailsOpen, setLeaveSalaryDetailsOpen] = useState(false);
    const [eligibilityDetail, setEligibilityDetail] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createReason, setCreateReason] = useState('');
    const [showApprove, setShowApprove] = useState(false);
    const [showRevoke, setShowRevoke] = useState(false);
    const [reopenModal, setReopenModal] = useState(false);
    const [returnModal, setReturnModal] = useState(false);
    const [rejectModal, setRejectModal] = useState(false);
    const [policyModal, setPolicyModal] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [slipListEpoch, setSlipListEpoch] = useState(0);
    const lastFetchedPeriodRef = useRef('');
    const [savedSnapshot, setSavedSnapshot] = useState('');

    const applyPayload = useCallback((payload) => {
        const nextJoining = payload?.contractJoiningDate || payload?.joiningDate || '';
        const nextVerp = payload?.verpStartDate || '';
        const nextCompanyMol = payload?.companyMolCode || '';
        const nextEmployeeMol = payload?.employeeMolId || '';
        const nextSalarySlip = Boolean(payload?.salarySlip);
        const nextLeave = consolidateCountOnlyLeaveRecords(
            historicalLeaveOnly(combineLeaveRows(payload?.leaveRecords, payload?.annualLeaveRecords)),
            payload?.leaveMultipliers,
        );
        const nextCycles = Array.isArray(payload?.paymentCycles) ? payload.paymentCycles : [];
        const nextHiddenSystemLeave = toHiddenSystemLeave(payload?.hiddenSystemLeave);
        const nextLeaveComplete = Boolean(payload?.leaveHistoryComplete);
        const nextBenefitsComplete = Boolean(payload?.benefitsComplete);
        setData(payload);
        setJoiningDate(nextJoining);
        setVerpStartDate(nextVerp);
        setCompanyMolCode(nextCompanyMol);
        setEmployeeMolId(nextEmployeeMol);
        setSalarySlip(nextSalarySlip);
        setLeaveRecords(nextLeave);
        setHiddenSystemLeave(nextHiddenSystemLeave);
        setPaymentCycles(nextCycles);
        setLeaveComplete(nextLeaveComplete);
        setBenefitsComplete(nextBenefitsComplete);
        lastFetchedPeriodRef.current = `${nextJoining}|${nextVerp}`;
        setJoiningDateReason(String(payload?.joiningDateReason || '').trim());
        setJoiningDatePrompt('');
        setSavedSnapshot(
            buildFormSnapshot({
                joiningDate: nextJoining,
                verpStartDate: nextVerp,
                companyMolCode: nextCompanyMol,
                employeeMolId: nextEmployeeMol,
                salarySlip: nextSalarySlip,
                leaveRecords: nextLeave,
                paymentCycles: nextCycles,
                leaveComplete: nextLeaveComplete,
                benefitsComplete: nextBenefitsComplete,
                hiddenSystemLeave: nextHiddenSystemLeave,
            }),
        );
    }, []);

    useEffect(() => {
        if (embedded) return;
        const next = searchParams?.get('tab') === 'details' ? 'details' : 'slip';
        setSetupTab((prev) => (prev === next ? prev : next));
    }, [embedded, searchParams]);

    function selectSetupTab(key) {
        setSetupTab(key);
        if (embedded || !employeeId) return;
        const base = `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}`;
        router.replace(key === 'details' ? `${base}?tab=details` : base, { scroll: false });
    }

    const fetchProfile = useCallback(async () => {
        if (!employeeId) return;
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get(
                `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical`,
                { skipToast: true },
            );
            applyPayload(res.data);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load salary setup.');
        } finally {
            setLoading(false);
        }
    }, [employeeId, applyPayload]);

    useEffect(() => {
        if (employeeId) fetchProfile();
    }, [employeeId, fetchProfile]);

    useEffect(() => {
        if (!employeeId || loading || !verpStartDate || !joiningDate) return undefined;
        const periodKey = `${joiningDate}|${verpStartDate}`;
        if (lastFetchedPeriodRef.current === periodKey) return undefined;
        const handle = setTimeout(async () => {
            try {
                const res = await axiosInstance.get(
                    `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical`,
                    { skipToast: true, params: { verpStartDate, contractJoiningDate: joiningDate } },
                );
                lastFetchedPeriodRef.current = periodKey;
                setData((prev) => ({
                    ...(prev || {}),
                    workingDays: res.data?.workingDays || 0,
                    weeklyOffs: res.data?.weeklyOffs || 0,
                    holidays: res.data?.holidays || 0,
                    calendarDays: res.data?.calendarDays || 0,
                    historicalFrom: res.data?.historicalFrom || joiningDate,
                    historicalTo: res.data?.historicalTo || '',
                    cycleDays: res.data?.cycleDays || prev?.cycleDays,
                    policy: res.data?.policy || prev?.policy,
                    calculation: res.data?.calculation || prev?.calculation,
                    leaveMultipliers: res.data?.leaveMultipliers || prev?.leaveMultipliers,
                    eligibleBalance: res.data?.eligibleBalance,
                    salaryHistory: res.data?.salaryHistory || prev?.salaryHistory,
                    leaveSalaryEntitlement: res.data?.leaveSalaryEntitlement || prev?.leaveSalaryEntitlement,
                    employeeLeaveSalary: res.data?.employeeLeaveSalary ?? prev?.employeeLeaveSalary,
                    liveAttendance: res.data?.liveAttendance || prev?.liveAttendance,
                }));
                setLeaveRecords((prev) =>
                    mergeServerLeave(
                        prev,
                        combineLeaveRows(res.data?.leaveRecords, res.data?.annualLeaveRecords),
                    ),
                );
                if (res.data?.permissions?.canEdit !== false) {
                    await axiosInstance.put(
                        `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical`,
                        {
                            verpStartDate,
                            contractJoiningDate: joiningDate,
                            joiningDateReason,
                        },
                        { skipToast: true },
                    );
                }
            } catch {
                /* keep last totals */
            }
        }, 280);
        return () => clearTimeout(handle);
    }, [employeeId, joiningDate, joiningDateReason, verpStartDate, loading]);

    const historicalTo = verpStartDate ? addDays(verpStartDate, -1) : '';
    const cycleDays = policyLeaveWorkingDays(data?.policy, data?.cycleDays);
    const leaveMultipliers = data?.leaveMultipliers || policyLeaveMultipliers(data?.policy);
    const splitLeave = splitLeavePayload(leaveRecords);
    const liveLeaveRecords = useMemo(() => {
        const liveEnabled = Boolean(data?.liveAttendance?.enabled || data?.liveAttendance?.processingMonthReached);
        if (!liveEnabled) return [];
        const rows = filterHiddenSystemLeave(
            Array.isArray(data?.liveAttendance?.leaveRecords) ? data.liveAttendance.leaveRecords : [],
            hiddenSystemLeave,
        );
        const from = data?.liveAttendance?.from || toMonthStartDate(verpStartDate);
        const to = data?.liveAttendance?.to || '';
        return liveLeaveRecordsInProcessingWindow(rows, from, to);
    }, [
        data?.liveAttendance?.enabled,
        data?.liveAttendance?.from,
        data?.liveAttendance?.leaveRecords,
        data?.liveAttendance?.processingMonthReached,
        data?.liveAttendance?.to,
        hiddenSystemLeave,
        verpStartDate,
    ]);
    const historicalLeaveHistoryRows = useMemo(() => {
        return (leaveRecords || []).map((row, storedIndex) => {
            const next = {
                ...row,
                source: 'manual',
                storedIndex,
            };
            if (leaveTypeKey(row) === 'holiday') {
                next.multiplier = 1;
                next.rule = 1;
                next.actualDays = Math.max(1, Number(row.actualDays ?? row.eligibleWorkingDays) || 1);
                next.eligibleWorkingDays = next.actualDays;
                next.deductionDays = next.actualDays;
                next.deduction = next.actualDays;
            }
            return next;
        });
    }, [leaveRecords]);
    const systemLeaveHistoryList = useMemo(() => {
        return systemLeaveHistoryRows(liveLeaveRecords, leaveMultipliers).map((row) => {
            if (leaveTypeKey(row) !== 'holiday') return row;
            const actualDays = Math.max(1, Number(row.actualDays ?? row.eligibleWorkingDays) || 1);
            return {
                ...row,
                multiplier: 1,
                rule: 1,
                actualDays,
                eligibleWorkingDays: actualDays,
                deductionDays: actualDays,
                deduction: actualDays,
            };
        });
    }, [leaveMultipliers, liveLeaveRecords]);
    const existingLeaveHistoryRows = useMemo(
        () => [...historicalLeaveHistoryRows, ...systemLeaveHistoryList],
        [historicalLeaveHistoryRows, systemLeaveHistoryList],
    );
    const filteredLeaveHistoryRows = useMemo(() => {
        if (!leaveTypeFilter) return historicalLeaveHistoryRows;
        return historicalLeaveHistoryRows.filter((row) => leaveTypeKey(row) === leaveTypeFilter);
    }, [historicalLeaveHistoryRows, leaveTypeFilter]);
    const filteredSystemLeaveHistoryRows = useMemo(() => {
        if (!systemLeaveTypeFilter) return systemLeaveHistoryList;
        return systemLeaveHistoryList.filter((row) => leaveTypeKey(row) === systemLeaveTypeFilter);
    }, [systemLeaveHistoryList, systemLeaveTypeFilter]);
    const leaveHistoryGroups = useMemo(
        () => summarizeLeaveHistoryGroups(filteredLeaveHistoryRows),
        [filteredLeaveHistoryRows],
    );
    const leaveGroupRows = useMemo(() => {
        if (!leaveGroupModal) return [];
        const pool =
            leaveGroupModal.source === 'system' ? systemLeaveHistoryList : historicalLeaveHistoryRows;
        return leaveRowsForGroup(pool, leaveGroupModal.type, leaveGroupModal.source);
    }, [historicalLeaveHistoryRows, leaveGroupModal, systemLeaveHistoryList]);
    useEffect(() => {
        if (!leaveGroupModal) return;
        if (!leaveGroupRows.length) setLeaveGroupModal(null);
    }, [leaveGroupModal, leaveGroupRows.length]);
    const annualLeaveOptions = useMemo(
        () => listAnnualLeaveOptions(existingLeaveHistoryRows),
        [existingLeaveHistoryRows],
    );
    const existingHolidayDates = useMemo(
        () =>
            (leaveRecords || [])
                .filter((row) => leaveTypeKey(row) === 'holiday')
                .map((row) => holidayRowDate(row))
                .filter((date) => ISO.test(date)),
        [leaveRecords],
    );
    const leavePaymentRows = useMemo(
        () => paymentKindRows(paymentCycles, 'leave', annualLeaveOptions),
        [annualLeaveOptions, paymentCycles],
    );
    const ticketPaymentRows = useMemo(
        () => paymentKindRows(paymentCycles, 'ticket', annualLeaveOptions),
        [annualLeaveOptions, paymentCycles],
    );
    const historicalCalc = calculateHistoricalEligibility({
        workingDays: Number(data?.workingDays) || 0,
        calendarDays: Number(data?.calendarDays) || 0,
        leaveRecords: splitLeave.leaveRecords,
        annualLeaveRecords: splitLeave.annualLeaveRecords,
        paymentCycles,
        cycleDays,
        leaveMultipliers,
    });
    const liveOvertimeHours = Number(data?.liveAttendance?.overtimeHours) || 0;
    const liveOvertimeDays = overtimeHoursToDays(liveOvertimeHours);
    const liveOvertimeRemainderHours = overtimeHoursRemainder(liveOvertimeHours);
    const calc = calculateHistoricalEligibility({
        workingDays:
            (Number(data?.workingDays) || 0) +
            (Number(data?.liveAttendance?.workingDays) || 0) +
            liveOvertimeDays,
        calendarDays: Number(data?.calendarDays) || 0,
        leaveRecords: [...(splitLeave.leaveRecords || []), ...liveLeaveRecords],
        annualLeaveRecords: splitLeave.annualLeaveRecords,
        paymentCycles,
        cycleDays,
        leaveMultipliers,
    });
    const attendanceLeaveDeduction = Math.max(
        0,
        (Number(calc.totalLeaveDeduction) || 0) - (Number(historicalCalc.totalLeaveDeduction) || 0),
    );
    const annualLeaveHistory = useMemo(
        () => [
            ...(splitLeave.annualLeaveRecords || []),
            ...(splitLeave.leaveRecords || []).filter((row) => String(row?.leaveType || '').toLowerCase() === 'annual'),
            ...(liveLeaveRecords || []).filter((row) => String(row?.leaveType || '').toLowerCase() === 'annual'),
        ],
        [liveLeaveRecords, splitLeave.annualLeaveRecords, splitLeave.leaveRecords],
    );
    const calculationStartDate = resolveEntitlementCalculationStart({
        joiningDate,
        annualLeaveRecords: annualLeaveHistory,
        paymentCycles,
        cycleDays,
    });
    const recordedTicketRate = [...(paymentCycles || [])]
        .reverse()
        .map((row) => Number(row?.ticketAmount) || 0)
        .find((amount) => amount > 0) || 0;
    const ticketRate = policyTicketRate(data?.policy, recordedTicketRate);
    const salaryHistory =
        Array.isArray(data?.salaryHistory) && data.salaryHistory.length
            ? data.salaryHistory
            : data?.employeeLeaveSalary
              ? [{ effectiveFrom: calculationStartDate || joiningDate, basicSalary: data.employeeLeaveSalary }]
              : [];
    const reducingCycles = uniqueConsumingCycles(paymentCycles, cycleDays);
    const leaveSalaryEntitlement = calculateAnnualLeaveEntitlement({
        calculationStartDate,
        calculationEndDate: data?.liveAttendance?.to || historicalTo,
        eligibleWorkingDays: Math.max(0, Number(calc.netQualifyingDays) || 0),
        consumedEntitlements: reducingCycles.length,
        reducingCycles,
        requiredDaysPerEntitlement: cycleDays,
        salaryHistory,
        annualLeaveHistory,
        salaryPolicyHistory: [
            {
                effectiveFrom: calculationStartDate || joiningDate,
                airTicketAmount: ticketRate,
            },
        ],
        ticketRate,
    });
    const liveAttendanceEnabled = Boolean(data?.liveAttendance?.enabled);
    const reservedLeaveDays =
        Number(leaveSalaryEntitlement.availableEntitlements) *
        Number(leaveSalaryEntitlement.requiredDaysPerEntitlement || 0);
    const towardNextRows = eligibilityTowardNextRows({
        historicalWorkingDays: historicalCalc.workingDays,
        liveWorkingDays: Number(data?.liveAttendance?.workingDays) || 0,
        overtimeDays: liveOvertimeDays,
        liveEnabled: liveAttendanceEnabled,
        historicalFrom: data?.historicalFrom || joiningDate,
        historicalTo: data?.historicalTo || historicalTo,
        liveFrom: data?.liveAttendance?.from || toMonthStartDate(verpStartDate),
        liveTo: data?.liveAttendance?.to || '',
        historicalLeave: historicalCalc.totalLeaveDeduction,
        attendanceLeave: attendanceLeaveDeduction,
        reservedDays: reservedLeaveDays,
        reservedCount: leaveSalaryEntitlement.availableEntitlements,
        cycleDays: leaveSalaryEntitlement.requiredDaysPerEntitlement,
    });
    const towardNextFormula = formatTowardNextFormula(
        towardNextRows,
        leaveSalaryEntitlement.remainingDays,
    );
    const livePeriodBalance =
        (Number(data?.liveAttendance?.workingDays) || 0) +
        liveOvertimeDays -
        (Number(attendanceLeaveDeduction) || 0);
    const leaveSalaryPaid = cycleLeaveSalaryPaid(paymentCycles);
    const ticketPaid = cycleTicketPaid(paymentCycles);
    const leaveSalaryPayable = Number(leaveSalaryEntitlement.totalLeaveSalary) || 0;
    const ticketPayable = Number(leaveSalaryEntitlement.totalTicketAmount) || 0;
    const leaveSalaryBalance = payableBalance(leaveSalaryPayable, leaveSalaryPaid);
    const ticketBalance = payableBalance(ticketPayable, ticketPaid);
    const workflowStatus = data?.workflowStatus || 'draft';
    const permissions = data?.permissions || {};
    const isSalaryHr = Boolean(permissions.isSalaryHr);
    const isHrAssignee = Boolean(permissions.isHrAssignee);
    const pendingHr = workflowStatus === 'pending_hr' || Boolean(data?.approvalSent);
    const enrolled = Boolean(data?.enrolled) || workflowStatus === 'locked';
    const processingReached = Boolean(data?.liveAttendance?.processingMonthReached);
    const canSeeMolCodes = Boolean(permissions.canViewPayrollCodes ?? canSeePayrollCodes);
    const canEditEnrolled = Boolean(
        permissions.canEditEnrolled ?? (isHrAssignee && (enrolled || processingReached) && !pendingHr),
    );
    const canToggleSalarySlip = Boolean(
        !pendingHr && (enrolled || processingReached ? canEditEnrolled : hrEdit),
    );
    const canResetEnrollment = Boolean(permissions.canResetEnrollment);
    const locked =
        pendingHr ||
        (enrolled || processingReached
            ? !canEditEnrolled
            : !hrEdit || !permissions.canEdit);
    const canManagePayments = !locked;
    const openPaymentInvoice = ({ cycleIndex, cycle, kind }) => {
        setCycleModal(false);
        setCycleDraft(null);
        setCycleDraftIndex(null);
        setCycleModalViewOnly(false);
        setPaymentInvoice(
            buildPaymentInvoice({
                cycle,
                cycleIndex,
                kind,
                entitlements: leaveSalaryEntitlement,
                cycles: paymentCycles,
                employeeName: data?.employee?.name ? toTitleName(data.employee.name) : employeeId,
                employeeId: data?.employee?.employeeId || employeeId,
                companyName: data?.employee?.companyName,
                designation: data?.employee?.designation,
                department: data?.employee?.department,
            }),
        );
    };
    const openPaymentCycle = ({ cycleIndex = null, cycle = null, viewOnly = true, tab = 'leave' } = {}) => {
        setPaymentInvoice(null);
        setCycleDraftIndex(Number.isInteger(cycleIndex) ? cycleIndex : null);
        setCycleDraft(cycle || null);
        setCycleModalViewOnly(Boolean(viewOnly) || locked);
        setCycleModalDefaultTab(tab === 'ticket' ? 'ticket' : 'leave');
        setCycleModal(true);
    };
    const openPaymentMode = ({ cycleIndex, cycle, tab = 'leave' } = {}) => {
        if (isSalarySlipPayment(cycle)) {
            const monthKey = salarySlipMonthKeyFromCycle(cycle);
            if (monthKey && employeeId) {
                router.push(salarySlipMonthHref(employeeId, monthKey));
            }
            return;
        }
        openPaymentInvoice({ cycleIndex, cycle, kind: tab });
    };
    const currentSnapshot = useMemo(
        () =>
            buildFormSnapshot({
                joiningDate,
                verpStartDate,
                companyMolCode,
                employeeMolId,
                salarySlip,
                leaveRecords,
                paymentCycles,
                leaveComplete,
                benefitsComplete,
                hiddenSystemLeave,
            }),
        [
            joiningDate,
            verpStartDate,
            companyMolCode,
            employeeMolId,
            salarySlip,
            leaveRecords,
            paymentCycles,
            leaveComplete,
            benefitsComplete,
            hiddenSystemLeave,
        ],
    );
    const hasUnsavedChanges = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;
    const canUpdateCreated = (enrolled || processingReached) && canEditEnrolled && !pendingHr;
    const updateDisabled = saving || !canUpdateCreated || !hasUnsavedChanges;
    const readiness = data?.readiness;
    const emp = data?.employee;
    const portalHref = String(emp?.mongoId || '').trim()
        ? `/HRM/Leave/${encodeURIComponent(String(emp.mongoId).trim())}`
        : '';
    const openEmployeePortal = useCallback(() => {
        if (!portalHref) return;
        navigateFromList(router, portalHref);
    }, [portalHref, router]);

    function openHistoricalWorkingDaysDetail() {
        const from = data?.historicalFrom || joiningDate;
        const to = data?.historicalTo || historicalTo;
        setEligibilityDetail({
            title: 'Historical working days',
            subtitle: from && to ? `${prettyDate(from)} — ${prettyDate(to)}` : '',
            rows: eligibilityWorkingDayRows({
                from,
                to,
                workingDays: historicalCalc.workingDays,
                weeklyOffs: data?.weeklyOffs,
                calendarDays: data?.calendarDays || historicalCalc.calendarDays,
            }),
            total: historicalCalc.workingDays,
            totalLabel: 'Working days',
        });
    }

    function openLiveWorkingDaysDetail() {
        const from = data?.liveAttendance?.from || toMonthStartDate(verpStartDate);
        const to = data?.liveAttendance?.to || '';
        const count = Number(data?.liveAttendance?.workingDays) || 0;
        setEligibilityDetail({
            title: 'Present working days',
            subtitle: from && to ? `${prettyDate(from)} — ${prettyDate(to)}` : prettyDate(from),
            rows: [
                {
                    key: 'live-working',
                    date: from && to ? `${prettyDate(from)} — ${prettyDate(to)}` : prettyDate(from) || '—',
                    type: 'Present days',
                    count,
                },
            ],
            total: count,
            totalLabel: 'Working days',
        });
    }

    function openHistoricalLeaveDetail() {
        const rows = eligibilityLeaveDetailRows([
            ...(splitLeave.leaveRecords || []),
            ...(splitLeave.annualLeaveRecords || []),
        ]);
        setEligibilityDetail({
            title: 'Historical leave deduction',
            subtitle: 'Leave records between contract joining and the day before VERP start.',
            rows,
            total: Number(historicalCalc.totalLeaveDeduction) || 0,
            totalLabel: 'Deduction days',
        });
    }

    function openAttendanceLeaveDetail() {
        const rows = eligibilityLeaveDetailRows(liveLeaveRecords);
        setEligibilityDetail({
            title: 'Attendance leave (policy)',
            subtitle: data?.liveAttendance?.from
                ? `${prettyDate(data.liveAttendance.from)}${
                      data.liveAttendance.to ? ` — ${prettyDate(data.liveAttendance.to)}` : ''
                  }`
                : '',
            rows,
            total: attendanceLeaveDeduction,
            totalLabel: 'Deduction days',
            footer: portalHref ? (
                <button
                    type="button"
                    onClick={openEmployeePortal}
                    className="h-10 rounded-xl border px-4 text-sm font-semibold text-slate-600"
                >
                    Open leave portal
                </button>
            ) : null,
        });
    }

    function openReservedLeaveDetail() {
        const rows = (leaveSalaryEntitlement.entitlements || []).map((row) => ({
            key: `reserved-${row.entitlementNo}`,
            date: prettyDate(row.entitlementDate || row.salaryPeriodEnd),
            type: `Leave Salary ${row.entitlementNo}`,
            count: Number(row.eligibleDays) || Number(leaveSalaryEntitlement.requiredDaysPerEntitlement) || 0,
        }));
        setEligibilityDetail({
            title: 'Leave salary reserved',
            subtitle: `${leaveSalaryEntitlement.availableEntitlements} × ${leaveSalaryEntitlement.requiredDaysPerEntitlement} policy leave days.`,
            rows,
            total:
                Number(leaveSalaryEntitlement.availableEntitlements) *
                Number(leaveSalaryEntitlement.requiredDaysPerEntitlement || 0),
            totalLabel: 'Reserved days',
        });
    }

    function openTowardNextDetail() {
        setEligibilityDetail({
            title: 'Toward next entitlement',
            subtitle: towardNextFormula,
            rows: towardNextRows,
            total: Number(leaveSalaryEntitlement.remainingDays) || 0,
            totalLabel: `Toward next / ${leaveSalaryEntitlement.requiredDaysPerEntitlement} days`,
        });
    }

    function openLiveOvertimeDaysDetail() {
        const from = data?.liveAttendance?.from || toMonthStartDate(verpStartDate);
        const to = data?.liveAttendance?.to || '';
        const range = from && to ? `${prettyDate(from)} — ${prettyDate(to)}` : prettyDate(from);
        setEligibilityDetail({
            title: 'Overtime days',
            subtitle: `${range || 'Processing date to today'}. ${OVERTIME_HOURS_PER_DAY} hours = 1 day.`,
            rows: [
                {
                    key: 'ot-hours',
                    date: range || '—',
                    type: 'Overtime hours',
                    count: liveOvertimeHours,
                },
                {
                    key: 'ot-days',
                    date: range || '—',
                    type: 'Overtime days',
                    count: liveOvertimeDays,
                },
            ],
            total: liveOvertimeDays,
            totalLabel: 'Overtime days',
        });
    }

    function openLiveOvertimeHoursDetail() {
        const from = data?.liveAttendance?.from || toMonthStartDate(verpStartDate);
        const to = data?.liveAttendance?.to || '';
        const records = Array.isArray(data?.liveAttendance?.overtimeRecords)
            ? data.liveAttendance.overtimeRecords
            : [];
        setEligibilityDetail({
            title: 'Overtime hours',
            subtitle: `${from && to ? `${prettyDate(from)} — ${prettyDate(to)}` : prettyDate(from) || 'Processing date to today'}. ${OVERTIME_HOURS_PER_DAY} hours = 1 day. Leftover hours under ${OVERTIME_HOURS_PER_DAY} stay as hours.`,
            rows: records.map((row, index) => ({
                key: `${row.date || 'ot'}-${index}`,
                date: prettyDate(row.date),
                type: row.isOffDay ? 'Off-day overtime' : 'Overtime',
                count: Number(row.hours) || 0,
            })),
            total: liveOvertimeHours,
            totalLabel: `${formatHoursLabel(liveOvertimeHours)} · ${liveOvertimeDays} ${liveOvertimeDays === 1 ? 'day' : 'days'} + ${formatHoursLabel(liveOvertimeRemainderHours)} leftover`,
        });
    }

    function openLivePeriodBalanceDetail() {
        const from = data?.liveAttendance?.from || toMonthStartDate(verpStartDate);
        const to = data?.liveAttendance?.to || '';
        const date = from && to ? `${prettyDate(from)} — ${prettyDate(to)}` : prettyDate(from) || '—';
        setEligibilityDetail({
            title: 'Processing period balance',
            subtitle: date,
            rows: [
                {
                    key: 'live-wd',
                    date,
                    type: 'Working days',
                    count: Number(data?.liveAttendance?.workingDays) || 0,
                },
                {
                    key: 'live-ot-days',
                    date,
                    type: 'Overtime days',
                    count: liveOvertimeDays,
                },
                {
                    key: 'live-ot-hours',
                    date,
                    type: `Overtime hours (${OVERTIME_HOURS_PER_DAY} hr = 1 day)`,
                    count: liveOvertimeHours,
                },
                {
                    key: 'live-leave',
                    date,
                    type: 'Leave',
                    count: -(Number(attendanceLeaveDeduction) || 0),
                },
            ],
            total: livePeriodBalance,
            totalLabel: 'Period balance',
        });
    }
    const displayName = emp?.name ? toTitleName(emp.name) : employeeId;
    const initials = emp?.name
        ? nameInitials(emp.name)
        : String(emp?.initials || nameInitials(employeeId))
            .slice(0, 2)
            .toUpperCase();
    const migrationComplete = Boolean(joiningDate && verpStartDate && historicalTo);
    const enrollStatus = enrolled ? 'Enrolled' : 'Pending';
    const enrollTone = enrolled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
    const canClickCreate = Boolean(
        migrationComplete &&
        leaveComplete &&
        benefitsComplete &&
        (permissions.canCreate || permissions.canVerify),
    );
    const mainPolicyReady = Boolean(permissions.mainPolicyConfigured);

    function requireMainPolicy() {
        if (mainPolicyReady) return true;
        setPolicyModal(true);
        return false;
    }

    async function openSalarySlipPdf() {
        if (!employeeId || openingSalarySlip) return;
        setOpeningSalarySlip(true);
        try {
            const res = await axiosInstance.get(
                `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical/salary-slip`,
                { responseType: 'blob', skipToast: true },
            );
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            let message = 'Could not open salary slip';
            const data = err?.response?.data;
            if (typeof Blob !== 'undefined' && data instanceof Blob) {
                try {
                    const parsed = JSON.parse(await data.text());
                    if (parsed?.message) message = parsed.message;
                } catch {
                    /* keep default */
                }
            } else if (typeof data?.message === 'string' && data.message) {
                message = data.message;
            }
            toast({ title: message, variant: 'destructive' });
        } finally {
            setOpeningSalarySlip(false);
        }
    }
    const readinessByKey = Object.fromEntries((readiness?.items || []).map((item) => [item.key, item.done]));
    const readinessGroups = [
        {
            key: 'dates',
            label: 'Employment & VERP migration',
            done:
                ['employeeJoining', 'verpStart', 'period', 'workingDays'].every(
                    (key) => readinessByKey[key],
                ) && migrationComplete,
        },
        { key: 'leave', label: 'Historical leave records', done: Boolean(readinessByKey.leave) },
        {
            key: 'benefits',
            label: 'Benefit payment cycles',
            done: Boolean(readinessByKey.benefits && readinessByKey.cycles),
        },
        { key: 'hr', label: 'HR', done: Boolean(data?.verifiedBy) },
    ];
    const readinessDoneCount = readinessGroups.filter((row) => row.done).length;
    const progressionPercent = readinessGroups.length
        ? Math.round((readinessDoneCount / readinessGroups.length) * 100)
        : 0;

    const bodyPayload = useMemo(
        () => ({
            verpStartDate,
            contractJoiningDate: joiningDate,
            joiningDateReason,
            companyMolCode: String(companyMolCode || '').trim(),
            employeeMolId: String(employeeMolId || '').trim(),
            salarySlip,
            leaveRecords: splitLeave.leaveRecords,
            annualLeaveRecords: splitLeave.annualLeaveRecords,
            paymentCycles,
            cycleDays,
            leaveHistoryComplete: leaveComplete,
            annualLeaveComplete: leaveComplete,
            benefitsComplete: benefitsComplete,
            hiddenSystemLeave,
        }),
        [
            verpStartDate,
            joiningDate,
            joiningDateReason,
            companyMolCode,
            employeeMolId,
            salarySlip,
            leaveRecords,
            paymentCycles,
            cycleDays,
            leaveComplete,
            benefitsComplete,
            hiddenSystemLeave,
        ],
    );

    async function runAction(path, method, success, extra = {}) {
        setSaving(true);
        try {
            const res = await axiosInstance({
                url: `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical${path}`,
                method,
                data: { ...bodyPayload, ...extra },
            });
            applyPayload(res.data);
            if (success) toast({ title: success });
            return true;
        } catch (err) {
            toast({
                title: err?.response?.data?.message || 'Request failed',
                variant: 'destructive',
            });
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function persistRecords(nextLeave, nextCycles, success, extra = {}) {
        if (locked) return false;
        if (enrolled) return true;
        const split = splitLeavePayload(consolidateCountOnlyLeaveRecords(nextLeave, leaveMultipliers));
        return runAction('', 'put', success || '', {
            leaveRecords: split.leaveRecords,
            annualLeaveRecords: split.annualLeaveRecords,
            paymentCycles: nextCycles,
            hiddenSystemLeave,
            ...extra,
        });
    }

    async function persistLeaveDelete(nextLeave, nextHidden, success) {
        if (locked) return false;
        const split = splitLeavePayload(nextLeave);
        return runAction('', 'put', success || '', {
            leaveRecords: split.leaveRecords,
            annualLeaveRecords: split.annualLeaveRecords,
            paymentCycles,
            hiddenSystemLeave: nextHidden,
        });
    }

    async function confirmCreate() {
        if (!requireMainPolicy()) return;
        if (!migrationComplete) {
            toast({
                title: 'Complete Employment & VERP migration first',
                variant: 'destructive',
            });
            return;
        }
        if (!permissions.canCreate) {
            const verified = await runAction('/verify', 'post', '');
            if (!verified) return;
        }
        if (!isSalaryHr && !String(createReason || '').trim()) {
            toast({ title: 'Enter a reason for HR approval', variant: 'destructive' });
            return;
        }
        const ok = await runAction(
            '/create',
            'post',
            isSalaryHr ? 'Salary profile created' : 'Sent for HR approval',
            isSalaryHr ? {} : { reason: createReason.trim() },
        );
        if (ok) {
            setShowCreate(false);
            setCreateReason('');
            notifySalaryPendingInboxChanged();
        }
    }

    async function confirmApprove() {
        if (!requireMainPolicy()) return;
        const ok = await runAction('/approve', 'post', 'Salary profile approved');
        if (ok) {
            setShowApprove(false);
            notifySalaryPendingInboxChanged();
        }
    }

    async function confirmRevoke() {
        const ok = await runAction('/revoke', 'post', 'Enrolment request revoked');
        if (ok) {
            setShowRevoke(false);
            notifySalaryPendingInboxChanged();
        }
    }

    async function confirmResetEnrollment() {
        if (!resetPassword) {
            toast({ title: 'Enter your login password', variant: 'destructive' });
            return;
        }
        setResetting(true);
        try {
            const res = await axiosInstance.post(
                `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical/reset`,
                { password: resetPassword },
                { skipSessionExpiry: true, skipToast: true },
            );
            applyPayload(res.data);
            setResetPassword('');
            setResetPasswordVisible(false);
            setResetPasswordOpen(false);
            setSlipListEpoch((n) => n + 1);
            notifySalaryPendingInboxChanged();
            toast({
                title: res.data?.message || 'Enrolment details moved to Deleted Records',
                description: 'Restore within 90 days from Settings → Deleted Records. After 90 days the archive is removed.',
            });
        } catch (err) {
            toast({
                title: err?.message || err?.response?.data?.message || 'Could not reset enrolment',
                variant: 'destructive',
            });
        } finally {
            setResetting(false);
        }
    }

    const pageBody = (
        <>
                    <div className={embedded ? 'w-full max-w-full' : 'w-full max-w-full p-4 sm:p-6 lg:p-8'}>
                        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            {embedded ? (
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-[#1B2A4A]">
                                        Historical Salary Setup
                                    </h2>
                                    <p className="mt-0.5 max-w-2xl text-[11px] sm:text-xs text-slate-500">
                                        Complete and verify the employee&apos;s historical data before processing
                                        salary in VERP.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                        Employee Salary Profile
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                                            Historical Salary Setup
                                        </h1>
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${enrollTone}`}
                                        >
                                            {enrollStatus}
                                        </span>
                                    </div>
                                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                                        Complete and verify the employee&apos;s historical data before processing salary in
                                        VERP.
                                    </p>
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                {canResetEnrollment ? (
                                    <button
                                        type="button"
                                        onClick={() => setResetConfirmOpen(true)}
                                        disabled={saving || resetting}
                                        className="inline-flex h-10 items-center gap-1 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                                    >
                                        <RotateCcw size={14} /> Reset enrollment
                                    </button>
                                ) : null}
                                {permissions.canReopen && !pendingHr && !enrolled ? (
                                    <button
                                        type="button"
                                        onClick={() => setReopenModal(true)}
                                        className="inline-flex h-10 items-center gap-1 rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-700"
                                    >
                                        <RotateCcw size={14} /> Reopen
                                    </button>
                                ) : null}
                                {permissions.canReturn && !pendingHr && !enrolled ? (
                                    <button
                                        type="button"
                                        onClick={() => setReturnModal(true)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
                                    >
                                        Return for correction
                                    </button>
                                ) : null}
                                {pendingHr ? null : enrolled ? (
                                    <button
                                        type="button"
                                        onClick={() => runAction('', 'put', 'Profile updated')}
                                        disabled={updateDisabled}
                                        title={
                                            !canEditEnrolled
                                                ? 'Only HR can update an enrolled salary profile'
                                                : hasUnsavedChanges
                                                    ? 'Save changes to this salary profile'
                                                    : 'Update is available after you change something on this page'
                                        }
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60"
                                    >
                                        {saving ? 'Saving…' : 'Update'}
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => runAction('', 'put', 'Draft saved')}
                                            disabled={saving || locked || !hrEdit}
                                            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-60"
                                        >
                                            {saving ? 'Saving…' : 'Save as draft'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!requireMainPolicy()) return;
                                                setShowCreate(true);
                                            }}
                                            disabled={saving || !canClickCreate}
                                            title={
                                                !canClickCreate
                                                    ? undefined
                                                    : mainPolicyReady
                                                        ? undefined
                                                        : 'Update salary policy first'
                                            }
                                            className={`inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60${
                                                canClickCreate && !mainPolicyReady ? ' opacity-60' : ''
                                            }`}
                                        >
                                            <Check size={16} /> Create salary profile
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div
                            className="mb-5 flex items-center gap-6 border-b border-slate-200"
                            role="tablist"
                            aria-label="Salary profile sections"
                        >
                            {[
                                { key: 'slip', label: 'Salary slip' },
                                { key: 'details', label: 'Salary details' },
                            ].map((tab) => {
                                const active = setupTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => selectSetupTab(tab.key)}
                                        className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                                            active
                                                ? "text-blue-600 after:content-[''] after:absolute after:left-0 after:-bottom-px after:h-0.5 after:w-full after:bg-blue-500"
                                                : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-24">
                                <Loader2 className="animate-spin text-blue-600" size={28} />
                            </div>
                        ) : error ? (
                            <div className="rounded-2xl border border-red-100 bg-white p-6 text-sm text-red-600">
                                {error}
                                <button type="button" className="ml-3 font-semibold underline" onClick={fetchProfile}>
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {pendingHr ? (
                                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-amber-950">
                                                    {permissions.canApprove || permissions.canReject
                                                        ? 'Salary enrollment waiting for your approval'
                                                        : 'Salary enrollment sent for HR approval'}
                                                </p>
                                                <p className="mt-1 text-sm text-amber-900">
                                                    {permissions.canApprove || permissions.canReject
                                                        ? `Approve enrolls ${displayName} and starts salary slips. Reject sends this profile back for correction.`
                                                        : `Waiting for flowchart HR to approve ${displayName}. The employee is not enrolled until then.`}
                                                    {data?.submittedByName
                                                        ? ` Sent by ${data.submittedByName}${
                                                              data?.submittedAt
                                                                  ? ` on ${prettyDateTime(data.submittedAt)}`
                                                                  : ''
                                                          }.`
                                                        : ''}
                                                </p>
                                                {String(data?.submitReason || '').trim() ? (
                                                    <p className="mt-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-slate-800">
                                                        <span className="font-semibold text-slate-600">Reason: </span>
                                                        {String(data.submitReason).trim()}
                                                    </p>
                                                ) : (
                                                    <p className="mt-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-slate-600">
                                                        No submit reason was entered for this request.
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                {permissions.canReject ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRejectModal(true)}
                                                        disabled={saving}
                                                        className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 disabled:opacity-60"
                                                    >
                                                        Reject
                                                    </button>
                                                ) : null}
                                                {permissions.canApprove ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!requireMainPolicy()) return;
                                                            setShowApprove(true);
                                                        }}
                                                        disabled={saving}
                                                        title={mainPolicyReady ? undefined : 'Update salary policy first'}
                                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                                                    >
                                                        <Check size={16} /> Approve
                                                    </button>
                                                ) : null}
                                                {permissions.canRevoke ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowRevoke(true)}
                                                        disabled={saving}
                                                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 disabled:opacity-60"
                                                    >
                                                        <Undo2 size={14} /> Revoke request
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ) : data?.lastRejectReason ? (
                                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        <span className="font-semibold">Last rejection: </span>
                                        {data.lastRejectReason}
                                    </div>
                                ) : null}
                                <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-0">
                                        <div className="flex min-w-0 flex-[1.4] items-center gap-3 lg:pr-4">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#D7E8FF] text-[15px] font-bold tracking-wide text-[#2B6CB0]">
                                                {initials}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    Selected employee
                                                </p>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                                    <h2 className="text-sm font-bold text-slate-900">{displayName}</h2>
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${enrollTone}`}
                                                    >
                                                        {enrollStatus}
                                                    </span>
                                                    <span className="text-base sm:text-lg font-black tracking-wide text-red-600">
                                                        {enrolled
                                                            ? String(companyMolCode || '').trim()
                                                                ? 'WPS'
                                                                : 'Cash'
                                                            : '----'}
                                                    </span>
                                                </div>
                                                <p className="truncate text-[12px] text-slate-400">
                                                    {[emp?.employeeId, emp?.designation, emp?.workLocationLabel]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="hidden h-12 w-px shrink-0 bg-slate-200 lg:block" />
                                        <div className="min-w-[150px] flex-1 lg:px-5">
                                            <p className="text-[11px] font-medium text-slate-400">Department</p>
                                            <p className="mt-0.5 text-sm font-bold text-slate-800">
                                                {emp?.department || '—'}
                                            </p>
                                        </div>

                                        <div className="hidden h-12 w-px shrink-0 bg-slate-200 lg:block" />
                                        <div className="min-w-[150px] flex-1 lg:px-5">
                                            <p className="text-[11px] font-medium text-slate-400">Reports to</p>
                                            <p className="mt-0.5 text-sm font-bold text-slate-800">
                                                {toTitleName(emp?.reportsTo) || '—'}
                                            </p>
                                        </div>

                                        <div className="hidden h-12 w-px shrink-0 bg-slate-200 lg:block" />
                                        <div className="flex w-[220px] shrink-0 items-center gap-3 lg:pl-5">
                                            <ReadinessRing value={progressionPercent} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    Progression
                                                </p>
                                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                    <div
                                                        className="h-full rounded-full bg-[#22C55E]"
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, progressionPercent))}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {setupTab === 'details' ? (
                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_374px]">
                                    <div className="space-y-4">
                                        <section className={CARD}>
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                                    <CardIcon>
                                                        <FileText size={16} />
                                                    </CardIcon>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                                                    Employment & VERP Migration
                                                                </h3>
                                                                <p className="mt-0.5 text-[12px] text-[#64748B]">
                                                                    Defines the historical period used for salary calculations.
                                                                </p>
                                                            </div>
                                                            {toMonthStartDate(verpStartDate) ? (
                                                                <p className="max-w-[340px] text-right text-[12px] leading-5 text-[#475569]">
                                                                    Attendance starts at{' '}
                                                                    <span className="font-semibold text-[#0F172A]">
                                                                        {prettyDate(toMonthStartDate(verpStartDate))}
                                                                    </span>
                                                                    {' '}and salary starts at{' '}
                                                                    <span className="font-semibold text-[#0F172A]">
                                                                        {prettyDate(nextMonthStartDate(verpStartDate))}
                                                                    </span>
                                                                    .
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                                <CompleteBadge complete={migrationComplete} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                <div className="block">
                                                    <FieldLabel required>Contract joining date</FieldLabel>
                                                    <div className="relative">
                                                        {permissions.canChangeJoiningDate ||
                                                        ((enrolled || processingReached) &&
                                                            canEditEnrolled &&
                                                            !pendingHr) ? (
                                                            <DatePicker
                                                                value={joiningDatePrompt || joiningDate}
                                                                onChange={(value) => {
                                                                    if (!value || value === joiningDate) {
                                                                        setJoiningDatePrompt('');
                                                                        return;
                                                                    }
                                                                    if (!joiningDate) {
                                                                        setJoiningDate(value);
                                                                        return;
                                                                    }
                                                                    setJoiningDatePrompt(value);
                                                                }}
                                                                className="h-11 w-full rounded-lg"
                                                            />
                                                        ) : (
                                                            <>
                                                                <input
                                                                    readOnly
                                                                    value={prettyDate(joiningDate)}
                                                                    className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 pr-9 text-sm text-[#0F172A]"
                                                                />
                                                                <Lock
                                                                    size={14}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                    {joiningDateReason ? (
                                                        <p className="mt-1.5 text-[12px] leading-5 text-[#475569]">
                                                            Reason: {joiningDateReason}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <label className="block">
                                                    <FieldLabel required>VERP salary processing start</FieldLabel>
                                                    <MonthPicker
                                                        value={toMonthKey(verpStartDate)}
                                                        onChange={(monthKey) =>
                                                            setVerpStartDate(toMonthStartDate(monthKey))
                                                        }
                                                        disabled={locked}
                                                        placeholder="Select month"
                                                        className="h-11 w-full rounded-lg"
                                                        minMonth={earliestSelectableVerpMonth(joiningDate)}
                                                        fromYear={Number(
                                                            earliestSelectableVerpMonth(joiningDate).slice(0, 4),
                                                        )}
                                                    />
                                                </label>
                                                <label className="block">
                                                    <FieldLabel required>Historical period</FieldLabel>
                                                    <input
                                                        readOnly
                                                        value={
                                                            joiningDate && historicalTo
                                                                ? `${prettyDate(joiningDate)} — ${prettyDate(historicalTo)}`
                                                                : '—'
                                                        }
                                                        className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A]"
                                                    />
                                                </label>
                                            </div>
                                            <div className={`mt-3 grid grid-cols-1 gap-3 ${canSeeMolCodes ? 'md:grid-cols-3' : ''}`}>
                                                {canSeeMolCodes ? (
                                                    <>
                                                <label className="block">
                                                    <FieldLabel>Company MOL code</FieldLabel>
                                                    <input
                                                        value={companyMolCode}
                                                        onChange={(e) => setCompanyMolCode(e.target.value)}
                                                        disabled={locked}
                                                        placeholder="Enter company MOL code"
                                                        className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-[#F8FAFC]"
                                                    />
                                                </label>
                                                <label className="block">
                                                    <FieldLabel>Employee MOL ID</FieldLabel>
                                                    <input
                                                        value={employeeMolId}
                                                        onChange={(e) => setEmployeeMolId(e.target.value)}
                                                        disabled={locked}
                                                        placeholder="Enter employee MOL ID"
                                                        className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-[#F8FAFC]"
                                                    />
                                                </label>
                                                    </>
                                                ) : null}
                                                <div className="block">
                                                    <FieldLabel>Salary slip</FieldLabel>
                                                    <button
                                                        type="button"
                                                        role="checkbox"
                                                        aria-checked={salarySlip}
                                                        disabled={!canToggleSalarySlip}
                                                        onClick={async () => {
                                                            if (!canToggleSalarySlip) return;
                                                            const next = !salarySlip;
                                                            setSalarySlip(next);
                                                            setSaving(true);
                                                            try {
                                                                const res = await axiosInstance({
                                                                    url: `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical`,
                                                                    method: 'put',
                                                                    data: { salarySlip: next },
                                                                });
                                                                applyPayload(res.data);
                                                            } catch (err) {
                                                                setSalarySlip(!next);
                                                                toast({
                                                                    title: err?.response?.data?.message || 'Could not update salary slip',
                                                                    variant: 'destructive',
                                                                });
                                                            } finally {
                                                                setSaving(false);
                                                            }
                                                        }}
                                                        className={`h-11 w-full rounded-lg border px-3 text-sm outline-none flex items-center gap-2.5 text-left ${
                                                            !canToggleSalarySlip
                                                                ? 'border-[#E2E8F0] bg-[#F8FAFC] cursor-not-allowed'
                                                                : 'border-[#E2E8F0] bg-white hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                                salarySlip
                                                                    ? 'border-blue-600 bg-blue-600 text-white'
                                                                    : 'border-slate-300 bg-white text-transparent'
                                                            }`}
                                                            aria-hidden="true"
                                                        >
                                                            <Check size={11} strokeWidth={3} />
                                                        </span>
                                                        <span className={salarySlip ? 'font-medium text-[#0F172A]' : 'text-[#94A3B8]'}>
                                                            {salarySlip ? 'Checked' : 'Unchecked'}
                                                        </span>
                                                    </button>
                                                    <p className="mt-1.5 text-[11px] leading-4 text-[#64748B]">
                                                        If checked, this employee gets a salary slip PDF on their company
                                                        email after Management approves that month. Unchecked employees
                                                        get the approval email only.
                                                    </p>
                                                    {salarySlip ? (
                                                        <button
                                                            type="button"
                                                            onClick={openSalarySlipPdf}
                                                            disabled={openingSalarySlip || saving}
                                                            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2563EB] hover:underline disabled:opacity-60"
                                                        >
                                                            {openingSalarySlip ? (
                                                                <Loader2 size={13} className="animate-spin" />
                                                            ) : (
                                                                <ExternalLink size={13} />
                                                            )}
                                                            {openingSalarySlip ? 'Opening salary slip…' : 'Open salary slip PDF'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-col gap-2 rounded-[10px] bg-[#EFF6FF] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="flex items-start gap-2">
                                                    <Info size={14} className="mt-0.5 shrink-0 text-[#2563EB]" />
                                                    <div>
                                                        <p className="text-[12px] font-medium text-[#1E3A8A]">
                                                            {calc.workingDays} historical working days calculated
                                                        </p>
                                                        <p className="mt-0.5 text-[11px] text-[#64748B]">
                                                            Weekly offs have been excluded automatically.
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={openHistoricalWorkingDaysDetail}
                                                    className="shrink-0 text-[11px] font-medium text-[#2563EB] hover:underline"
                                                >
                                                    View breakdown
                                                </button>
                                            </div>
                                        </section>

                                        <section className={CARD}>
                                            <div className="mb-4 flex flex-col gap-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <CardIcon tone="red">
                                                            <Calendar size={16} />
                                                        </CardIcon>
                                                        <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                                            Historical Leave History
                                                        </h3>
                                                    </div>
                                                    <div className="flex flex-nowrap items-center justify-end gap-2">
                                                        <CompleteBadge complete={leaveComplete} />
                                                        <GhostButton
                                                            disabled={locked || !joiningDate || !historicalTo}
                                                            onClick={() => setHolidaysModal(true)}
                                                        >
                                                            <CalendarDays size={14} /> Add the holidays
                                                        </GhostButton>
                                                        <GhostButton
                                                            disabled={locked || leaveComplete}
                                                            onClick={() => {
                                                                setLeaveDraftIndex(null);
                                                                setLeaveModal(true);
                                                            }}
                                                        >
                                                            <Plus size={14} /> Add leave record
                                                        </GhostButton>
                                                    </div>
                                                </div>
                                                <LeaveTypeFilter
                                                    value={leaveTypeFilter}
                                                    onChange={setLeaveTypeFilter}
                                                    rows={historicalLeaveHistoryRows}
                                                />
                                            </div>
                                            <LeaveHistorySummaryTable
                                                groups={leaveHistoryGroups}
                                                emptyMessage={
                                                    leaveTypeFilter
                                                        ? `No ${leaveMeta(leaveTypeFilter).label.toLowerCase()} records.`
                                                        : 'No leave records yet.'
                                                }
                                                onOpen={(group) =>
                                                    setLeaveGroupModal({
                                                        type: group.type,
                                                        source: group.source,
                                                    })
                                                }
                                            />
                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                                <label className="inline-flex items-center gap-2 text-[13px] text-[#64748B]">
                                                    <input
                                                        type="checkbox"
                                                        checked={leaveComplete}
                                                        disabled={locked}
                                                        onChange={async (e) => {
                                                            const next = e.target.checked;
                                                            setLeaveComplete(next);
                                                            if (enrolled) return;
                                                            await runAction('', 'put', '', {
                                                                leaveHistoryComplete: next,
                                                                annualLeaveComplete: next,
                                                            });
                                                        }}
                                                    />
                                                    Mark leave history complete
                                                </label>
                                                <p className="inline-flex flex-wrap items-center gap-2 text-[12px] text-[#64748B]">
                                                    Total leave deduction
                                                    <span className="rounded-md border border-[#E6EAF0] bg-[#F1F5F9] px-2 py-0.5 text-[12px] font-medium tabular-nums text-[#334155]">
                                                        {Math.max(0, Number(historicalCalc.totalLeaveDeduction) || 0)} days
                                                    </span>
                                                    {Number(historicalCalc.holidayDays) > 0 ? (
                                                        <>
                                                            Holiday
                                                            <span className="rounded-md border border-[#E6EAF0] bg-[#F1F5F9] px-2 py-0.5 text-[12px] font-medium tabular-nums text-[#334155]">
                                                                {Math.max(0, Number(historicalCalc.holidayDays) || 0)} days
                                                            </span>
                                                        </>
                                                    ) : null}
                                                </p>
                                            </div>
                                        </section>

                                        <section className={CARD}>
                                            <div className="mb-4 flex flex-col gap-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <CardIcon tone="red">
                                                            <Calendar size={16} />
                                                        </CardIcon>
                                                        <div className="min-w-0">
                                                            <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                                                System Leave History
                                                            </h3>
                                                            <p className="mt-0.5 text-[12px] text-[#64748B]">
                                                                Each attendance leave after the processing date
                                                                {(data?.liveAttendance?.from ||
                                                                    toMonthStartDate(verpStartDate)) &&
                                                                data?.liveAttendance?.to
                                                                    ? ` · ${prettyDate(
                                                                          data.liveAttendance.from ||
                                                                              toMonthStartDate(verpStartDate),
                                                                      )} — ${prettyDate(data.liveAttendance.to)}`
                                                                    : ''}
                                                                . Dates come from attendance and cannot be edited here.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <LeaveTypeFilter
                                                    value={systemLeaveTypeFilter}
                                                    onChange={setSystemLeaveTypeFilter}
                                                    rows={systemLeaveHistoryList}
                                                />
                                            </div>
                                            <LeaveTable
                                                rows={filteredSystemLeaveHistoryRows}
                                                readOnly
                                                emptyMessage={
                                                    systemLeaveTypeFilter
                                                        ? `No ${leaveMeta(systemLeaveTypeFilter).label.toLowerCase()} attendance after the processing date.`
                                                        : 'No attendance leave after the processing date.'
                                                }
                                            />
                                            <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                                                <p className="inline-flex flex-wrap items-center gap-2 text-[12px] text-[#64748B]">
                                                    Total leave deduction
                                                    <span className="rounded-md border border-[#E6EAF0] bg-[#F1F5F9] px-2 py-0.5 text-[12px] font-medium tabular-nums text-[#334155]">
                                                        {Math.max(0, Number(attendanceLeaveDeduction) || 0)} days
                                                    </span>
                                                </p>
                                            </div>
                                        </section>

                                        <section className={CARD}>
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <CardIcon tone="violet">
                                                        <Wallet size={16} />
                                                    </CardIcon>
                                                    <div>
                                                        <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                                            Leave Salary & Ticket Payments
                                                        </h3>
                                                        <p className="mt-0.5 text-[12px] text-[#64748B]">
                                                            When counted days reach the salary-policy leave days (
                                                            {cycleDays}), a leave salary row is added and {cycleDays}{' '}
                                                            days come off the remaining balance. Holiday and leave
                                                            deductions update this on refresh. Completed still increases
                                                            only when a leave or ticket payment is added with Reduce the
                                                            historical working day checked.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <GhostButton
                                                        onClick={() => setLeaveSalaryDetailsOpen(true)}
                                                    >
                                                        <Eye size={14} /> Leave salary details
                                                    </GhostButton>
                                                    <CompleteBadge complete={benefitsComplete} />
                                                    <GhostButton
                                                        disabled={!canManagePayments}
                                                        onClick={() =>
                                                            openPaymentCycle({
                                                                viewOnly: false,
                                                                tab: 'leave',
                                                            })
                                                        }
                                                    >
                                                        <Plus size={14} /> Add payment cycle
                                                    </GhostButton>
                                                </div>
                                            </div>
                                            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                <SplitKindStat
                                                    label="Payable"
                                                    leaveValue={aedMoney(leaveSalaryPayable)}
                                                    ticketValue={aedMoney(ticketPayable)}
                                                />
                                                <SplitKindStat
                                                    label="Paid"
                                                    leaveValue={aedMoney(leaveSalaryPaid)}
                                                    ticketValue={aedMoney(ticketPaid)}
                                                />
                                                <SplitKindStat
                                                    label="Balance"
                                                    leaveValue={aedMoney(leaveSalaryBalance)}
                                                    ticketValue={aedMoney(ticketBalance)}
                                                    tone={leaveSalaryBalance > 0 || ticketBalance > 0 ? 'danger' : 'default'}
                                                />
                                            </div>
                                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <PaymentKindCard
                                                    title="Leave"
                                                    rows={leavePaymentRows}
                                                    emptyMessage="No leave payments yet."
                                                    eligibleLabel="Leave salary balance"
                                                    eligibleValue={aedMoney(leaveSalaryBalance)}
                                                    canManage={canManagePayments}
                                                    onAdd={() =>
                                                        openPaymentCycle({ viewOnly: false, tab: 'leave' })
                                                    }
                                                    onOpen={(cycleIndex, cycle) =>
                                                        openPaymentInvoice({
                                                            cycleIndex,
                                                            cycle,
                                                            kind: 'leave',
                                                        })
                                                    }
                                                    onEdit={(cycleIndex, cycle) =>
                                                        openPaymentCycle({
                                                            cycleIndex,
                                                            cycle,
                                                            viewOnly: false,
                                                            tab: 'leave',
                                                        })
                                                    }
                                                    onDelete={(cycleIndex) => setCycleDeleteIndex(cycleIndex)}
                                                    onModeClick={(cycleIndex, cycle) =>
                                                        openPaymentMode({ cycleIndex, cycle, tab: 'leave' })
                                                    }
                                                />
                                                <PaymentKindCard
                                                    title="Ticket"
                                                    rows={ticketPaymentRows}
                                                    emptyMessage="No ticket payments yet."
                                                    eligibleLabel="Ticket balance"
                                                    eligibleValue={aedMoney(ticketBalance)}
                                                    canManage={canManagePayments}
                                                    onAdd={() =>
                                                        openPaymentCycle({ viewOnly: false, tab: 'ticket' })
                                                    }
                                                    onOpen={(cycleIndex, cycle) =>
                                                        openPaymentInvoice({
                                                            cycleIndex,
                                                            cycle,
                                                            kind: 'ticket',
                                                        })
                                                    }
                                                    onEdit={(cycleIndex, cycle) =>
                                                        openPaymentCycle({
                                                            cycleIndex,
                                                            cycle,
                                                            viewOnly: false,
                                                            tab: 'ticket',
                                                        })
                                                    }
                                                    onDelete={(cycleIndex) => setCycleDeleteIndex(cycleIndex)}
                                                    onModeClick={(cycleIndex, cycle) =>
                                                        openPaymentMode({ cycleIndex, cycle, tab: 'ticket' })
                                                    }
                                                />
                                            </div>
                                            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={benefitsComplete}
                                                    disabled={locked}
                                                    onChange={async (e) => {
                                                        const next = e.target.checked;
                                                        setBenefitsComplete(next);
                                                        if (enrolled) return;
                                                        await runAction('', 'put', '', {
                                                            benefitsComplete: next,
                                                        });
                                                    }}
                                                />
                                                Mark leave salary and ticket details complete
                                            </label>
                                        </section>
                                    </div>

                                    <aside className="w-full space-y-4 xl:sticky xl:top-4 xl:w-[374px] xl:self-start">
                                        <section
                                            className="relative w-full min-w-0 overflow-hidden rounded-[13px] border border-[#E3E8EF] bg-white shadow-none xl:min-w-[350px] xl:max-w-[374px]"
                                            style={{ minHeight: 512 }}
                                        >
                                            <span className="absolute right-[22px] top-5 inline-flex h-[25px] items-center gap-[5px] rounded-full bg-[#ECFAF5] px-[9px] text-[9px] font-semibold text-[#168B67]">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#20AE82]" />
                                                Updated
                                            </span>

                                            <div className="pl-4 pr-[22px] pt-[22px]">
                                                <p className="text-[9px] font-bold uppercase leading-3 tracking-[1.4px] text-[#7B8797]">
                                                    Live calculation
                                                </p>
                                                <h3 className="mt-[7px] text-[15px] font-medium leading-5 text-[#1D2A3E]">
                                                    Eligibility Summary
                                                </h3>
                                            </div>

                                            <div className="mt-9">
                                                <p className="px-4 pb-1 text-[9px] font-bold uppercase leading-3 tracking-[0.8px] text-[#7B8797]">
                                                    Historical
                                                </p>
                                                <EligibilityCalcRow
                                                    label="Historical working days"
                                                    value={historicalCalc.workingDays}
                                                    onClick={openHistoricalWorkingDaysDetail}
                                                />
                                                <EligibilityCalcRow
                                                    label="Historical leave deduction"
                                                    value={formatDeductionDays(historicalCalc.totalLeaveDeduction)}
                                                    danger={Number(historicalCalc.totalLeaveDeduction) > 0}
                                                    onClick={openHistoricalLeaveDetail}
                                                />
                                                {Number(leaveSalaryEntitlement.availableEntitlements) > 0 ? (
                                                    <EligibilityCalcRow
                                                        label={`Leave salary reserved (${leaveSalaryEntitlement.availableEntitlements} × ${leaveSalaryEntitlement.requiredDaysPerEntitlement})`}
                                                        value={formatDeductionDays(reservedLeaveDays)}
                                                        danger
                                                        onClick={openReservedLeaveDetail}
                                                    />
                                                ) : null}
                                                <EligibilityCalcRow
                                                    label="Toward next entitlement"
                                                    value={`${formatSignedDays(leaveSalaryEntitlement.remainingDays)} / ${leaveSalaryEntitlement.requiredDaysPerEntitlement}`}
                                                    strong
                                                    onClick={openTowardNextDetail}
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={openTowardNextDetail}
                                                className="w-full rounded-none text-left"
                                                style={{
                                                    minHeight: 191,
                                                    background:
                                                        'linear-gradient(135deg, #163C77 0%, #164A8C 52%, #1758A4 100%)',
                                                    padding: '31px 22px 18px 16px',
                                                }}
                                            >
                                                <p className="text-[9px] font-bold uppercase leading-3 tracking-[0.8px] text-white/[0.82]">
                                                    Toward next entitlement
                                                </p>
                                                <div className="mt-2.5 flex items-baseline">
                                                    <span className="text-[46px] font-bold leading-[48px] tracking-[-1px] text-white">
                                                        {formatSignedDays(leaveSalaryEntitlement.remainingDays)}
                                                    </span>
                                                    <span className="ml-1.5 text-[13px] font-bold leading-4 text-white">
                                                        / {leaveSalaryEntitlement.requiredDaysPerEntitlement} days
                                                    </span>
                                                </div>
                                                <div className="mt-[14px] h-[6px] w-full overflow-hidden rounded-full bg-white/[0.17]">
                                                    <div
                                                        className="h-full rounded-full bg-[#49DDBB]"
                                                        style={{
                                                            width: `${Math.min(
                                                                100,
                                                                (Math.max(0, Number(leaveSalaryEntitlement.remainingDays) || 0) /
                                                                    Number(leaveSalaryEntitlement.requiredDaysPerEntitlement || 1)) *
                                                                100,
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                                <div className="mt-[7px] flex items-center justify-between text-[11px] font-normal leading-[15px] text-white/80">
                                                    <span>
                                                        {completedOverTotal(
                                                            leaveSalaryEntitlement.leaveSalaryCount,
                                                            leaveSalaryEntitlement.availableEntitlements,
                                                        )}{' '}
                                                        leave ·{' '}
                                                        {completedOverTotal(
                                                            leaveSalaryEntitlement.ticketCount,
                                                            leaveSalaryEntitlement.availableEntitlements,
                                                        )}{' '}
                                                        ticket
                                                    </span>
                                                    <span>{leaveSalaryEntitlement.requiredDaysPerEntitlement} days</span>
                                                </div>
                                            </button>

                                            {liveAttendanceEnabled ? (
                                                <div className="border-t border-[#E8ECF1] bg-[#F8FAFC]">
                                                    <p className="px-4 pt-3 text-[9px] font-bold uppercase leading-3 tracking-[0.8px] text-[#7B8797]">
                                                        Processing date to today
                                                    </p>
                                                    {(data?.liveAttendance?.from || toMonthStartDate(verpStartDate)) &&
                                                    data?.liveAttendance?.to ? (
                                                        <p className="px-4 pt-1 text-[10px] font-medium leading-4 text-[#94A3B8]">
                                                            {prettyDate(
                                                                data.liveAttendance.from ||
                                                                    toMonthStartDate(verpStartDate),
                                                            )}{' '}
                                                            — {prettyDate(data.liveAttendance.to)}
                                                        </p>
                                                    ) : null}
                                                    <div className="mt-2">
                                                        <EligibilityCalcRow
                                                            label="Working days"
                                                            value={Number(data?.liveAttendance?.workingDays) || 0}
                                                            onClick={openLiveWorkingDaysDetail}
                                                        />
                                                        <EligibilityCalcRow
                                                            label="Overtime days"
                                                            value={liveOvertimeDays}
                                                            onClick={openLiveOvertimeDaysDetail}
                                                        />
                                                        <EligibilityCalcRow
                                                            label="Overtime hours"
                                                            hint={`${OVERTIME_HOURS_PER_DAY} hr = 1 day`}
                                                            value={formatHoursLabel(liveOvertimeHours)}
                                                            onClick={openLiveOvertimeHoursDetail}
                                                        />
                                                        <EligibilityCalcRow
                                                            label="Leave"
                                                            value={formatDeductionDays(attendanceLeaveDeduction)}
                                                            danger={Number(attendanceLeaveDeduction) > 0}
                                                            onClick={openAttendanceLeaveDetail}
                                                        />
                                                        <EligibilityCalcRow
                                                            label="Period balance"
                                                            value={livePeriodBalance}
                                                            strong
                                                            danger={Number(livePeriodBalance) < 0}
                                                            onClick={openLivePeriodBalanceDetail}
                                                        />
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div className="flex min-h-[65px] items-start gap-2.5 bg-white px-4 py-[15px]">
                                                <Info
                                                    size={15}
                                                    strokeWidth={2}
                                                    className="mt-0.5 shrink-0 text-[#2A69D8]"
                                                />
                                                <p className="text-[9px] font-normal leading-[18px] text-[#6F7C8F]">
                                                    {data?.liveAttendance?.enabled
                                                        ? `From the processing date through today, only present attendance days count as working days. Absent and unauthorized days are deducted, not counted as present. Overtime punches count as extra days only in full ${OVERTIME_HOURS_PER_DAY}-hour blocks (${OVERTIME_HOURS_PER_DAY} hours = 1 day). Leftover hours under ${OVERTIME_HOURS_PER_DAY} stay as hours (1, 2, 3…) until they reach another ${OVERTIME_HOURS_PER_DAY}. Approved or taken leave and holidays from attendance refresh this card. Each time counted days reach ${calc.cycleDays}, a leave salary row is reserved and the remainder restarts toward the next ${calc.cycleDays}.`
                                                        : `Earned eligible balance uses historical working days minus leave deductions. Historical overtime is already in those working days. After the VERP processing date is reached, this card updates from present attendance days, overtime (${OVERTIME_HOURS_PER_DAY} hours = 1 day; leftover hours stay as hours), leave, and holidays.`}
                                                </p>
                                            </div>
                                        </section>

                                        <section className={CARD}>
                                            <div className="mb-3 flex items-center justify-between">
                                                <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                                    Progression
                                                </h3>
                                                <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-bold text-[#15803D]">
                                                    {readinessDoneCount}/{readinessGroups.length}
                                                </span>
                                            </div>
                                            <ul className="space-y-2.5">
                                                {readinessGroups.map((item) => (
                                                    <li key={item.key} className="flex items-start gap-2.5">
                                                        <span
                                                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done
                                                                    ? 'bg-[#22C55E] text-white'
                                                                    : 'border border-[#E2E8F0] bg-white text-transparent'
                                                                }`}
                                                        >
                                                            <Check size={12} strokeWidth={2.8} />
                                                        </span>
                                                        <span
                                                            className={`text-[13px] leading-5 ${item.done
                                                                    ? 'font-medium text-[#334155]'
                                                                    : 'text-[#94A3B8]'
                                                                }`}
                                                        >
                                                            {item.label}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="mt-4 border-t border-[#EEF2F6] pt-3">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                                                    Verified by
                                                </p>
                                                <p className="mt-1 text-[13px] font-medium text-[#0F172A]">
                                                    {data?.verifiedBy
                                                        ? `${data.verifiedBy}${data.verifiedByDepartment ? ` - ${data.verifiedByDepartment}` : ''}`
                                                        : '—'}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                                                    {prettyDateTime(data?.verifiedAt) || '—'}
                                                </p>
                                            </div>
                                        </section>

                                        {workflowIsLocked(workflowStatus) ? (
                                            <section className="rounded-[12px] border border-[#F3E8C8] bg-[#FFF8E8] p-3.5">
                                                <div className="flex items-start gap-2">
                                                    <Lock size={13} className="mt-0.5 shrink-0 text-[#D97706]" />
                                                    <div>
                                                        <p className="text-[12px] font-semibold text-[#92400E]">
                                                            Protected historical record
                                                        </p>
                                                        <p className="mt-1 text-[11px] leading-4 text-[#B45309]">
                                                            After profile creation, only authorized HR users can reopen
                                                            this setup. Every change is added to the audit log.
                                                        </p>
                                                    </div>
                                                </div>
                                            </section>
                                        ) : null}
                                    </aside>
                                </div>
                                ) : (
                                    <SalarySlipPreviewPanel key={`${employeeId}-${slipListEpoch}`} employeeId={employeeId} />
                                )}
                            </>
                        )}
                    </div>

            <LeaveSalaryDetailsModal
                open={leaveSalaryDetailsOpen}
                entitlement={leaveSalaryEntitlement}
                paymentCycles={paymentCycles}
                onSeeDetails={setEntitlementDetail}
                onPaymentStatusClick={(_row, action) => {
                    if (!action) return;
                    if (action.type === 'salarySlip' && action.monthKey && employeeId) {
                        setLeaveSalaryDetailsOpen(false);
                        router.push(salarySlipMonthHref(employeeId, action.monthKey));
                        return;
                    }
                    if (action.type === 'paymentCycle' && Number.isInteger(action.cycleIndex)) {
                        setLeaveSalaryDetailsOpen(false);
                        const kind =
                            cycleKindAmount(action.cycle, 'leave') > 0
                                ? 'leave'
                                : 'ticket';
                        openPaymentInvoice({
                            cycleIndex: action.cycleIndex,
                            cycle: action.cycle,
                            kind,
                        });
                    }
                }}
                onClose={() => setLeaveSalaryDetailsOpen(false)}
            />
            <EntitlementDetailsModal
                open={Boolean(entitlementDetail)}
                entitlement={entitlementDetail}
                cycleDays={cycleDays}
                policyLabel={data?.employee?.staffType || ''}
                onClose={() => setEntitlementDetail(null)}
            />
            <AddHolidaysModal
                open={holidaysModal}
                locked={locked}
                fromDate={joiningDate}
                toDate={historicalTo}
                existingHolidayDates={existingHolidayDates}
                onClose={() => setHolidaysModal(false)}
                onSave={async (chosen) => {
                    const kept = (leaveRecords || []).filter((row) => leaveTypeKey(row) !== 'holiday');
                    const existingByDate = new Map();
                    (leaveRecords || [])
                        .filter((row) => leaveTypeKey(row) === 'holiday')
                        .forEach((row) => {
                            const date = row.fromDate || row.toDate;
                            if (date) existingByDate.set(date, row);
                        });
                    const holidayRows = (chosen || []).map((holiday) =>
                        holidayLeaveRow(holiday, existingByDate.get(holiday.date)),
                    );
                    const next = consolidateCountOnlyLeaveRecords([...kept, ...holidayRows], leaveMultipliers);
                    setLeaveRecords(next);
                    const ok = await persistRecords(next, paymentCycles, 'Holiday leave saved');
                    if (!ok) setLeaveRecords(leaveRecords);
                }}
            />
            <AddLeaveModal
                key={leaveModal ? `leave-${leaveDraftIndex ?? 'new'}` : 'leave-closed'}
                open={leaveModal}
                locked={locked}
                initial={Number.isInteger(leaveDraftIndex) ? leaveRecords[leaveDraftIndex] : null}
                periodStart={joiningDate}
                periodEnd={historicalTo}
                leaveMultipliers={leaveMultipliers}
                onClose={() => {
                    setLeaveModal(false);
                    setLeaveDraftIndex(null);
                }}
                onSave={async (row) => {
                    const index = leaveDraftIndex;
                    const next = consolidateCountOnlyLeaveRecords(
                        upsertCountOnlyLeave(leaveRecords, row, index, leaveMultipliers),
                        leaveMultipliers,
                    );
                    setLeaveRecords(next);
                    setLeaveDraftIndex(null);
                    const ok = await persistRecords(
                        next,
                        paymentCycles,
                        Number.isInteger(index) ? 'Leave record updated' : 'Leave record saved',
                    );
                    if (!ok) setLeaveRecords(leaveRecords);
                }}
            />
            <PaymentInvoiceModal
                open={Boolean(paymentInvoice)}
                invoice={paymentInvoice}
                onClose={() => setPaymentInvoice(null)}
            />
            <AddCycleModal
                key={cycleModal ? `cycle-open-${cycleDraftIndex ?? 'new'}-${cycleDraft?.annualLeaveKey || ''}-${cycleModalDefaultTab}` : 'cycle-closed'}
                open={cycleModal}
                locked={locked}
                viewOnly={cycleModalViewOnly}
                editing={Number.isInteger(cycleDraftIndex)}
                defaultTab={cycleModalDefaultTab}
                cycleDays={cycleDays}
                nextNumber={paymentCycles.length + 1}
                initial={cycleDraft}
                annualLeaves={annualLeaveOptions}
                paymentCycles={paymentCycles}
                editingIndex={Number.isInteger(cycleDraftIndex) ? cycleDraftIndex : -1}
                entitlements={leaveSalaryEntitlement}
                leaveDueTotal={leaveSalaryPayable}
                ticketDueTotal={ticketPayable}
                onClose={() => {
                    setCycleModal(false);
                    setCycleDraft(null);
                    setCycleDraftIndex(null);
                    setCycleModalViewOnly(false);
                    setCycleModalDefaultTab('leave');
                }}
                onDelete={
                    Number.isInteger(cycleDraftIndex) && !cycleModalViewOnly && canManagePayments
                        ? () => {
                              const index = cycleDraftIndex;
                              setCycleModal(false);
                              setCycleDraft(null);
                              setCycleDraftIndex(null);
                              setCycleModalViewOnly(false);
                              setCycleDeleteIndex(index);
                          }
                        : undefined
                }
                onSave={async (payload) => {
                    const rows = Array.isArray(payload) ? payload : [payload];
                    const index = cycleDraftIndex;
                    let next;
                    if (Number.isInteger(index)) {
                        const [first, ...rest] = rows;
                        next = paymentCycles.map((existing, i) =>
                            i === index ? { ...existing, ...(first || {}) } : existing,
                        );
                        if (rest.length) next = [...next, ...rest];
                    } else {
                        next = [...paymentCycles, ...rows];
                    }
                    setPaymentCycles(next);
                    setCycleDraft(null);
                    setCycleDraftIndex(null);
                    const ok = await persistRecords(
                        leaveRecords,
                        next,
                        Number.isInteger(index) ? 'Payment cycle updated' : 'Payment cycle saved',
                    );
                    if (!ok) setPaymentCycles(paymentCycles);
                }}
            />
            <ModalShell
                open={Boolean(leaveDeleteRow)}
                title="Delete leave record?"
                onClose={() => setLeaveDeleteRow(null)}
                zClass="z-[100]"
            >
                <p className="mt-3 text-sm text-slate-600">
                    {leaveSourceKey(leaveDeleteRow) === 'system'
                        ? 'This will hide this system leave from the historical record. Attendance is not changed. This action cannot be undone.'
                        : 'This will remove this leave record from the historical record. This action cannot be undone.'}
                </p>
                {leaveDeleteRow ? (
                    <p className="mt-2 text-sm font-medium text-slate-800">
                        {leaveMeta(leaveDeleteRow.leaveType).label}
                        {leaveDeleteRow.fromDate || leaveDeleteRow.toDate
                            ? ` · ${prettyDate(leaveDeleteRow.fromDate)} — ${prettyDate(leaveDeleteRow.toDate)}`
                            : ''}
                    </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setLeaveDeleteRow(null)}
                        className="h-10 rounded-xl border px-4 text-sm font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                            const row = leaveDeleteRow;
                            setLeaveDeleteRow(null);
                            if (!row) return;
                            if (leaveSourceKey(row) === 'system') {
                                const nextHidden = toHiddenSystemLeave([
                                    ...hiddenSystemLeave,
                                    {
                                        leaveType: leaveTypeKey(row),
                                        fromDate: isCountOnlyLeaveType(leaveTypeKey(row))
                                            ? '*'
                                            : row.fromDate || row.startDate || '',
                                        toDate: isCountOnlyLeaveType(leaveTypeKey(row))
                                            ? '*'
                                            : row.toDate || row.endDate || row.fromDate || '',
                                    },
                                ]);
                                setHiddenSystemLeave(nextHidden);
                                const ok = await persistLeaveDelete(
                                    leaveRecords,
                                    nextHidden,
                                    'Leave record deleted',
                                );
                                if (!ok) setHiddenSystemLeave(hiddenSystemLeave);
                                return;
                            }
                            if (!Number.isInteger(row.storedIndex)) return;
                            const next = leaveRecords.filter((_, i) => i !== row.storedIndex);
                            setLeaveRecords(next);
                            const ok = await persistLeaveDelete(
                                next,
                                hiddenSystemLeave,
                                'Leave record deleted',
                            );
                            if (!ok) setLeaveRecords(leaveRecords);
                        }}
                        className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white"
                    >
                        Delete
                    </button>
                </div>
            </ModalShell>
            <ModalShell
                open={cycleDeleteIndex !== null}
                title="Delete payment cycle?"
                onClose={() => setCycleDeleteIndex(null)}
            >
                <p className="mt-3 text-sm text-slate-600">
                    This will remove this leave salary and ticket payment from the historical record. This action
                    cannot be undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setCycleDeleteIndex(null)}
                        className="h-10 rounded-xl border px-4 text-sm font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={async () => {
                            const index = cycleDeleteIndex;
                            setCycleDeleteIndex(null);
                            if (!Number.isInteger(index)) return;
                            if (isSalarySlipPayment(paymentCycles[index])) {
                                toast({
                                    title: 'Salary slip payments are edited from the salary slip',
                                    variant: 'destructive',
                                });
                                return;
                            }
                            const next = paymentCycles.filter((_, i) => i !== index);
                            setPaymentCycles(next);
                            const ok = await persistRecords(leaveRecords, next, 'Payment cycle deleted');
                            if (!ok) setPaymentCycles(paymentCycles);
                        }}
                        className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white"
                    >
                        Delete
                    </button>
                </div>
            </ModalShell>
            <ReasonModal
                key={joiningDatePrompt ? `joining-${joiningDatePrompt}` : 'joining-closed'}
                open={Boolean(joiningDatePrompt)}
                title="Change contract joining date"
                confirmLabel="Done"
                description={
                    joiningDatePrompt
                        ? `From ${prettyDate(joiningDate)} to ${prettyDate(joiningDatePrompt)}. Historical working days and eligible balance will update after you confirm.`
                        : ''
                }
                onClose={() => setJoiningDatePrompt('')}
                onConfirm={(reason) => {
                    const next = joiningDatePrompt;
                    setJoiningDatePrompt('');
                    if (!next) return;
                    setJoiningDateReason(reason);
                    setJoiningDate(next);
                }}
            />
            <ReasonModal
                key={reopenModal ? 'reopen-open' : 'reopen-closed'}
                open={reopenModal}
                title="Reopen locked historical profile"
                confirmLabel="Reopen"
                onClose={() => setReopenModal(false)}
                onConfirm={async (reason) => {
                    setReopenModal(false);
                    await runAction('/reopen', 'post', 'Profile reopened', { reason, reopenReason: reason });
                }}
            />
            <ReasonModal
                key={returnModal ? 'return-open' : 'return-closed'}
                open={returnModal}
                title="Return for correction"
                confirmLabel="Return"
                onClose={() => setReturnModal(false)}
                onConfirm={async (reason) => {
                    setReturnModal(false);
                    await runAction('/return', 'post', 'Returned for correction', { reason });
                }}
            />
            <ReasonModal
                key={rejectModal ? 'reject-open' : 'reject-closed'}
                open={rejectModal}
                title="Reject salary profile"
                confirmLabel="Reject"
                onClose={() => setRejectModal(false)}
                onConfirm={async (reason) => {
                    setRejectModal(false);
                    const ok = await runAction('/reject', 'post', 'Salary profile rejected', { reason });
                    if (ok) notifySalaryPendingInboxChanged();
                }}
            />
            <ModalShell
                open={Boolean(leaveGroupModal)}
                title={
                    leaveGroupModal
                        ? `${leaveMeta(leaveGroupModal.type).label} · ${
                              leaveGroupModal.source === 'system' ? 'System' : 'Manual'
                          }`
                        : 'Leave records'
                }
                onClose={() => setLeaveGroupModal(null)}
                width="max-w-5xl"
                zClass="z-[80]"
            >
                <p className="mt-1 text-[12px] text-[#64748B]">
                    {leaveGroupRows.length}{' '}
                    {leaveGroupRows.length === 1 ? 'record' : 'records'} for this leave type and source.
                </p>
                <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
                    <LeaveTable
                        rows={leaveGroupRows}
                        emptyMessage="No leave records in this group."
                        readOnly={leaveGroupModal?.source === 'system'}
                        locked={locked}
                        isRowLocked={(row) => leaveComplete && leaveTypeKey(row) !== 'holiday'}
                        onEdit={(row) => {
                            if (leaveGroupModal?.source === 'system' || locked) return;
                            if (leaveTypeKey(row) === 'holiday') {
                                setHolidaysModal(true);
                                return;
                            }
                            if (leaveComplete) return;
                            if (!Number.isInteger(row?.storedIndex)) return;
                            setLeaveDraftIndex(row.storedIndex);
                            setLeaveModal(true);
                        }}
                        onRemove={(row) => {
                            if (leaveGroupModal?.source === 'system' || locked) return;
                            if (leaveComplete && leaveTypeKey(row) !== 'holiday') return;
                            setLeaveDeleteRow(row);
                        }}
                    />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setLeaveGroupModal(null)}
                        className="h-10 rounded-xl border px-4 text-sm font-semibold"
                    >
                        Close
                    </button>
                </div>
            </ModalShell>
            <SalaryPolicyRequiredModal open={policyModal} onClose={() => setPolicyModal(false)} />
            <ModalShell
                open={showCreate}
                title={isSalaryHr ? 'Create salary profile?' : 'Send salary profile for HR approval?'}
                onClose={() => {
                    setShowCreate(false);
                    setCreateReason('');
                }}
            >
                <p className="mt-3 text-sm text-slate-600">
                    {isSalaryHr
                        ? 'This enrolls the employee and locks the historical record. Salary slips start on the 1st of the month after enrollment. No further HR approval is required.'
                        : 'This sends the profile to flowchart HR for approval. The employee is not enrolled until HR approves.'}
                </p>
                {!isSalaryHr ? (
                    <label className="mt-4 block">
                        <span className="text-sm font-semibold text-slate-700">Reason</span>
                        <textarea
                            value={createReason}
                            onChange={(e) => setCreateReason(e.target.value)}
                            className="mt-1.5 min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Why this salary profile should be enrolled"
                        />
                    </label>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setShowCreate(false);
                            setCreateReason('');
                        }}
                        className="h-10 rounded-xl border px-4 text-sm font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={confirmCreate}
                        disabled={saving || (!isSalaryHr && !createReason.trim())}
                        className="h-10 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {isSalaryHr ? 'Create & enroll' : 'Send for approval'}
                    </button>
                </div>
            </ModalShell>
            <ModalShell
                open={showRevoke}
                title="Revoke enrolment request?"
                onClose={() => setShowRevoke(false)}
            >
                <p className="mt-3 text-sm text-slate-600">
                    This emails flowchart HR that the enrolment approval was revoked by your user name,
                    removes the pending task from the HR bell, and lets you send the same profile again.
                    Enrolment status stays pending.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setShowRevoke(false)}
                        disabled={saving}
                        className="h-10 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={confirmRevoke}
                        disabled={saving}
                        className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        {saving ? 'Revoking…' : 'Revoke request'}
                    </button>
                </div>
            </ModalShell>
            <ModalShell open={showApprove} title="Approve salary profile?" onClose={() => setShowApprove(false)}>
                <p className="mt-3 text-sm text-slate-600">
                    This enrolls the employee, locks the historical record, and emails the user who submitted
                    the profile. Salary slips start on the 1st of the month after enrollment.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => setShowApprove(false)} className="h-10 rounded-xl border px-4 text-sm font-semibold">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={confirmApprove}
                        className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
                    >
                        Confirm approve
                    </button>
                </div>
            </ModalShell>
            <EligibilityDetailModal
                open={Boolean(eligibilityDetail)}
                title={eligibilityDetail?.title}
                subtitle={eligibilityDetail?.subtitle}
                rows={eligibilityDetail?.rows}
                total={eligibilityDetail?.total}
                totalLabel={eligibilityDetail?.totalLabel}
                footer={eligibilityDetail?.footer}
                onClose={() => setEligibilityDetail(null)}
            />
            <ConfirmAlertDialog
                open={resetConfirmOpen}
                onOpenChange={setResetConfirmOpen}
                title="Are you sure to reset the enrollment?"
                description={`Manual leave records, enrolment details, leave salary, and ticket payments will be removed from this profile and moved to Settings → Deleted Records for 90 days. Salary months for this enrolment are cleared. You can restore within 90 days; after that the archive is permanently removed. System attendance leaves stay.`}
                confirmLabel="Yes, continue"
                cancelLabel="Cancel"
                destructive
                onConfirm={() => {
                    setResetConfirmOpen(false);
                    setResetPassword('');
                    setResetPasswordVisible(false);
                    setResetPasswordOpen(true);
                }}
            />
            <ModalShell
                open={resetPasswordOpen}
                title="Enter your login password"
                onClose={() => {
                    if (resetting) return;
                    setResetPasswordOpen(false);
                    setResetPassword('');
                    setResetPasswordVisible(false);
                }}
            >
                <p className="mt-3 text-sm text-slate-600">
                    Enter your login password to confirm. If the password is wrong, the reset is cancelled and you stay signed in.
                </p>
                <form
                    autoComplete="off"
                    className="relative"
                    onSubmit={(e) => {
                        e.preventDefault();
                        confirmResetEnrollment();
                    }}
                >
                    <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        tabIndex={-1}
                        aria-hidden="true"
                        value=""
                        readOnly
                        className="pointer-events-none absolute h-0 w-0 opacity-0"
                    />
                    <div className="relative mt-4">
                        <input
                            key={resetPasswordOpen ? 'reset-password-open' : 'reset-password-closed'}
                            type={resetPasswordVisible ? 'text' : 'password'}
                            name="verp-reset-enrollment-confirm"
                            autoComplete="new-password"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            disabled={resetting}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            placeholder="Password"
                        />
                        <button
                            type="button"
                            onClick={() => setResetPasswordVisible((open) => !open)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            aria-label={resetPasswordVisible ? 'Hide password' : 'Show password'}
                        >
                            {resetPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setResetPasswordOpen(false);
                                setResetPassword('');
                                setResetPasswordVisible(false);
                            }}
                            disabled={resetting}
                            className="h-10 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={resetting || !resetPassword}
                            className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {resetting ? 'Resetting…' : 'Reset enrollment'}
                        </button>
                    </div>
                </form>
            </ModalShell>
        </>
    );

    if (embedded) return pageBody;

    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_employees_view_salary', 'hrm']}
            permissionType="view"
        >
            <SalarySetupLayout>{pageBody}</SalarySetupLayout>
        </PermissionGuard>
    );
}

function EligibilityDetailModal({
    open,
    title,
    subtitle,
    rows = [],
    total,
    totalLabel = 'Total',
    footer,
    onClose,
}) {
    if (!open) return null;
    const list = Array.isArray(rows) ? rows : [];
    const sum = list.reduce((acc, row) => acc + (Number(row.count) || 0), 0);
    const signed = list.some((row) => Number(row.count) < 0);
    return (
        <ModalShell open={open} title={title || 'Details'} onClose={onClose} width="max-w-2xl">
            {subtitle ? <p className="mt-1 text-[12px] text-[#64748B]">{subtitle}</p> : null}
            <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-[#EEF2F6]">
                {list.length ? (
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-[#EEF2F6] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                <th className="px-3 py-2.5 font-semibold">Date</th>
                                <th className="px-3 py-2.5 font-semibold">Type</th>
                                <th className="px-3 py-2.5 text-right font-semibold">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((row) => (
                                <tr key={row.key} className="border-b border-[#F1F5F9] last:border-0">
                                    <td className="px-3 py-2.5 text-[13px] text-[#334155]">{row.date || '—'}</td>
                                    <td className="px-3 py-2.5 text-[13px] font-medium text-[#0F172A]">
                                        {row.type || '—'}
                                    </td>
                                    <td
                                        className={`px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums ${
                                            signed && Number(row.count) < 0 ? 'text-[#DC5A64]' : 'text-[#0F172A]'
                                        }`}
                                    >
                                        {signed ? signedDayCount(row.count) : row.count}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="py-8 text-center text-[13px] text-[#94A3B8]">No records for this count.</p>
                )}
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-[#64748B]">
                <span>
                    {totalLabel}{' '}
                    <strong className="tabular-nums text-[#0F172A]">
                        {total == null ? sum : total}
                    </strong>
                </span>
                <div className="flex items-center gap-2">
                    {footer}
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-xl border px-4 text-sm font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

function EligibilityCalcRow({ label, hint, value, danger, strong, onClick }) {
    const className = `flex min-h-[42px] w-full items-center justify-between border-b border-[#E8ECF1] pl-4 pr-[22px] text-left ${
        onClick ? 'cursor-pointer hover:bg-slate-50' : ''
    }`;
    const inner = (
        <>
            <span
                className={`text-[11px] leading-4 ${strong ? 'font-bold text-[#1D2A3E]' : 'font-normal text-[#6F7C8F]'
                    }`}
            >
                {label}
                {hint ? (
                    <span className="mt-0.5 block text-[9px] font-normal leading-3 text-[#94A3B8]">
                        {hint}
                    </span>
                ) : null}
            </span>
            <span
                className={`text-right text-[11px] leading-4 tabular-nums ${
                    onClick
                        ? danger
                            ? 'font-medium text-[#DC5A64] underline decoration-[#DC5A64]/30 underline-offset-2'
                            : 'font-semibold text-[#2563EB] underline decoration-[#2563EB]/30 underline-offset-2'
                        : danger
                          ? 'font-medium text-[#DC5A64]'
                          : strong
                            ? 'font-bold text-[#1D2A3E]'
                            : 'font-semibold text-[#1D2A3E]'
                }`}
            >
                {value}
            </span>
        </>
    );
    if (onClick) {
        return (
            <button type="button" className={className} onClick={onClick}>
                {inner}
            </button>
        );
    }
    return <div className={className}>{inner}</div>;
}

function Row({ label, value, danger, strong }) {
    return (
        <div className="flex items-center justify-between gap-3 py-[9px]">
            <span className={`text-[13px] ${strong ? 'font-semibold text-[#172B4D]' : 'text-[#6B778C]'}`}>
                {label}
            </span>
            <span
                className={`text-[13px] tabular-nums ${danger
                        ? 'font-semibold text-[#DE350B]'
                        : 'font-semibold text-[#172B4D]'
                    }`}
            >
                {value}
            </span>
        </div>
    );
}

function LeaveHistorySummaryTable({
    groups,
    onOpen,
    emptyMessage = 'No leave records yet.',
}) {
    if (!groups.length) {
        return <p className="py-8 text-center text-[13px] text-[#94A3B8]">{emptyMessage}</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
                <thead>
                    <tr className="border-b border-[#EEF2F6] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                        <th className="px-2 py-2.5 font-semibold">Leave type</th>
                        <th className="px-2 py-2.5 font-semibold">Source</th>
                        <th className="px-2 py-2.5 font-semibold">Records</th>
                        <th className="px-2 py-2.5 font-semibold">Actual days</th>
                        <th className="px-2 py-2.5 font-semibold">Rule</th>
                        <th className="px-2 py-2.5 font-semibold">Deduction</th>
                        <th className="px-2 py-2.5 font-semibold" />
                    </tr>
                </thead>
                <tbody>
                    {groups.map((group) => (
                        <tr
                            key={`${group.type}-${group.source}`}
                            className="cursor-pointer border-b border-[#F1F5F9] hover:bg-slate-50"
                            title={`View all ${group.label.toLowerCase()} ${group.sourceLabel.toLowerCase()} records`}
                            onClick={() => onOpen?.(group)}
                        >
                            <td className="px-2 py-3">
                                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0F172A]">
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: group.color }}
                                    />
                                    {group.label}
                                </span>
                            </td>
                            <td className="px-2 py-3">
                                <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        group.source === 'system'
                                            ? 'bg-[#EEF2FF] text-[#4338CA]'
                                            : 'bg-[#F1F5F9] text-[#475569]'
                                    }`}
                                >
                                    {group.sourceLabel}
                                </span>
                            </td>
                            <td className="px-2 py-3 text-[13px] tabular-nums text-[#334155]">
                                {group.count}
                            </td>
                            <td className="px-2 py-3 text-[13px] tabular-nums text-[#334155]">
                                {group.actualDays} days
                            </td>
                            <td className="px-2 py-3 text-[13px] text-[#64748B]">
                                {group.rule === 'Mixed' ? 'Mixed' : `x ${group.rule}`}
                            </td>
                            <td className="px-2 py-3 text-[13px] font-bold tabular-nums text-[#0F172A]">
                                {group.deductionDays} days
                            </td>
                            <td className="px-2 py-3 text-right">
                                <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#2563EB]">
                                    View
                                    <ChevronRight size={14} />
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function LeaveTable({
    rows,
    locked,
    isRowLocked,
    onEdit,
    onRemove,
    onOpenSystem,
    readOnly = false,
    emptyMessage = 'No leave records yet.',
}) {
    if (!rows.length) {
        return <p className="py-8 text-center text-[13px] text-[#94A3B8]">{emptyMessage}</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
                <thead>
                    <tr className="border-b border-[#EEF2F6] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                        <th className="px-2 py-2.5 font-semibold">Leave type</th>
                        <th className="px-2 py-2.5 font-semibold">Leave period</th>
                        <th className="px-2 py-2.5 font-semibold">Actual days</th>
                        <th className="px-2 py-2.5 font-semibold">Rule</th>
                        <th className="px-2 py-2.5 font-semibold">Deduction</th>
                        <th className="px-2 py-2.5 font-semibold">Source</th>
                        {readOnly ? null : <th className="px-2 py-2.5 font-semibold" />}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const meta = leaveMeta(row.leaveType);
                        const actual = row.actualDays || row.eligibleWorkingDays || 0;
                        const deduction = row.deductionDays || row.deduction || 0;
                        const source = leaveSourceKey(row);
                        const rowLocked = Boolean(readOnly || locked || isRowLocked?.(row));
                        const canEdit = !rowLocked && source !== 'system' && Boolean(onEdit);
                        const canDelete = !readOnly && !rowLocked && Boolean(onRemove);
                        const canOpenSystem = !readOnly && source === 'system' && Boolean(onOpenSystem);
                        return (
                            <tr
                                key={row.id || `${row.fromDate}-${source}-${index}`}
                                className={`border-b border-[#F1F5F9] ${
                                    canEdit || canOpenSystem ? 'cursor-pointer hover:bg-slate-50' : ''
                                }`}
                                title={
                                    canEdit
                                        ? 'Click to edit this leave record'
                                        : canOpenSystem
                                          ? 'View system leave dates'
                                          : undefined
                                }
                                onClick={() => {
                                    if (canEdit) onEdit(row);
                                    else if (canOpenSystem) onOpenSystem(row);
                                }}
                            >
                                <td className="px-2 py-3">
                                    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0F172A]">
                                        <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: meta.color }}
                                        />
                                        {meta.label}
                                    </span>
                                </td>
                                <td className="px-2 py-3 text-[13px] text-[#334155]">
                                    {isCountOnlyLeaveType(row.leaveType) || !(row.fromDate || row.toDate)
                                        ? '—'
                                        : (
                                            <>
                                                <span>
                                                    {prettyDate(row.fromDate)} — {prettyDate(row.toDate)}
                                                </span>
                                                {row.remarks ? (
                                                    <span className="mt-0.5 block text-[11px] text-[#64748B]">
                                                        {row.remarks}
                                                    </span>
                                                ) : null}
                                            </>
                                        )}
                                </td>
                                <td className="px-2 py-3 text-[13px] tabular-nums text-[#334155]">
                                    {actual} days
                                </td>
                                <td className="px-2 py-3 text-[13px] text-[#64748B]">
                                    x {formatLeaveMultiplier(row.multiplier ?? row.rule)}
                                </td>
                                <td className="px-2 py-3 text-[13px] font-bold tabular-nums text-[#0F172A]">
                                    {deduction} days
                                </td>
                                <td className="px-2 py-3">
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            source === 'system'
                                                ? 'bg-[#EEF2FF] text-[#4338CA]'
                                                : 'bg-[#F1F5F9] text-[#475569]'
                                        }`}
                                    >
                                        {source === 'system' ? 'System' : 'Manual'}
                                    </span>
                                </td>
                                {readOnly ? null : (
                                    <td className="px-2 py-3 text-right">
                                        <button
                                            type="button"
                                            disabled={!canDelete}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemove?.(row);
                                            }}
                                            className="rounded-md p-1 text-[#94A3B8] hover:text-slate-600 disabled:opacity-30"
                                        >
                                            <X size={14} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
