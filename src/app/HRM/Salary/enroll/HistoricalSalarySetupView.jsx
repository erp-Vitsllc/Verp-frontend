'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Calendar,
    Check,
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
import { DatePicker, MonthPicker } from '@/components/ui/date-picker';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { hasPermission } from '@/utils/permissions';
import {
    addDays,
    calculateHistoricalEligibility,
    consolidateCountOnlyLeaveRecords,
    formatLeaveMultiplier,
    inclusiveCalendarDays,
    isCountOnlyLeaveType,
    isDatedLeaveType,
    isOptionalDateLeaveType,
    leaveMultiplier,
    leaveTicketEligibility,
    policyLeaveMultipliers,
    policyLeaveWorkingDays,
    validateLeaveDates,
    workflowIsLocked,
} from '../utils/salaryHistoricalCalculations';
import { notifySalaryPendingInboxChanged } from '../utils/salaryPendingInboxCount';
import SalaryPolicyRequiredModal from '../components/SalaryPolicyRequiredModal';
import { navigateFromList } from '@/utils/listReturnNavigation';
import SalarySlipPreviewPanel from './SalarySlipPreviewPanel';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LEAVE_TYPES = [
    { key: 'sick', label: 'Sick Leave', color: '#F59E0B' },
    { key: 'authorized', label: 'Authorized', color: '#3B82F6' },
    { key: 'unauthorized', label: 'Unauthorized', color: '#EF4444' },
    { key: 'annual', label: 'Annual Leave', color: '#8B5CF6' },
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

/** First month whose 1st is after the joining date (VERP start is always day 1). */
function firstVerpMonthAfterJoining(joiningDate) {
    if (!ISO.test(joiningDate)) return '';
    const year = Number(joiningDate.slice(0, 4));
    const month = Number(joiningDate.slice(5, 7));
    if (month === 12) return `${year + 1}-01`;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
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

function paymentKindRows(cycles, kind, annualLeaves = []) {
    const list = Array.isArray(cycles) ? cycles : [];
    return list
        .map((cycle, cycleIndex) => ({ cycle, cycleIndex }))
        .filter(({ cycle }) => (kind === 'ticket' ? recordIncludesTicket(cycle) : recordIncludesLeave(cycle)))
        .map(({ cycle, cycleIndex }, index) => ({
            slNo: index + 1,
            cycleIndex,
            cycle,
            paymentDate:
                kind === 'ticket'
                    ? cycle.ticketPaymentDate || cycle.leaveSalaryPaymentDate
                    : cycle.leaveSalaryPaymentDate || cycle.ticketPaymentDate,
            leaveDate: leaveDateLabel(cycle, annualLeaves),
            amount: kind === 'ticket' ? cycle.ticketAmount : cycle.leaveSalaryAmount,
            currency: cycle.currency,
        }));
}

function PaymentKindCard({ title, rows, emptyMessage, locked, onEdit, onRemove, eligibleLabel, eligibleValue }) {
    return (
        <div className="min-w-0 rounded-[10px] border border-[#E6EAF0] bg-white">
            <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] px-3 py-2.5">
                <h4 className="text-[13px] font-semibold text-[#0F172A]">{title}</h4>
                {eligibleValue ? (
                    <div className="min-w-0 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                            {eligibleLabel}
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#0F172A]">{eligibleValue}</p>
                    </div>
                ) : null}
            </div>
            {rows.length ? (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left">
                        <thead>
                            <tr className="border-b border-[#EEF2F6] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                <th className="px-3 py-2 font-semibold">SL No</th>
                                <th className="px-3 py-2 font-semibold">Payment date</th>
                                <th className="px-3 py-2 font-semibold">Leave date</th>
                                <th className="px-3 py-2 font-semibold">Amount</th>
                                <th className="px-2 py-2 font-semibold" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={`${title}-${row.cycleIndex}-${row.slNo}`}
                                    className={`border-b border-[#F1F5F9] last:border-0 ${
                                        locked ? '' : 'cursor-pointer hover:bg-slate-50'
                                    }`}
                                    onClick={() => {
                                        if (!locked) onEdit?.(row.cycleIndex, row.cycle);
                                    }}
                                >
                                    <td className="px-3 py-2.5 text-[13px] tabular-nums text-[#334155]">{row.slNo}</td>
                                    <td className="px-3 py-2.5 text-[13px] text-[#334155]">
                                        {prettyDate(row.paymentDate)}
                                    </td>
                                    <td className="px-3 py-2.5 text-[13px] text-[#334155]">{row.leaveDate}</td>
                                    <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums text-[#0F172A]">
                                        {aed(row.amount, row.currency)}
                                    </td>
                                    <td className="px-2 py-2.5 text-right">
                                        <button
                                            type="button"
                                            disabled={locked}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemove?.(row.cycleIndex);
                                            }}
                                            className="rounded-md p-1 text-[#94A3B8] hover:text-red-600 disabled:opacity-30"
                                            aria-label={`Delete ${title} payment`}
                                        >
                                            <X size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="px-3 py-8 text-center text-[13px] text-[#94A3B8]">{emptyMessage}</p>
            )}
        </div>
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
            className="flex flex-wrap items-center gap-1.5"
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
                        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
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

function aed(value, currency = 'AED') {
    const n = Number(value) || 0;
    return `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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

function ModalShell({ open, title, onClose, children, width = 'max-w-md' }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
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
            nextFrom === row.fromDate
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
    annualLeaves = [],
    cycleDays,
    defaultLeaveSalary,
    paymentCycles = [],
}) {
    const editing = Boolean(initial);
    const [leaveType, setLeaveType] = useState(initial?.leaveType || 'sick');
    const [fromDate, setFromDate] = useState(initial?.fromDate || initial?.startDate || '');
    const [toDate, setToDate] = useState(initial?.toDate || initial?.endDate || '');
    const [daysCount, setDaysCount] = useState(() => leaveCountFromRow(initial));
    const [remarks, setRemarks] = useState(initial?.remarks || '');
    const [file, setFile] = useState(null);
    const [includeLeave, setIncludeLeave] = useState(() => recordIncludesLeave(initial));
    const [includeTicket, setIncludeTicket] = useState(() => recordIncludesTicket(initial));
    const [leaveSalaryAmount, setLeaveSalaryAmount] = useState(
        () => amountInputValue(initial?.leaveSalaryAmount) || amountInputValue(defaultLeaveSalary),
    );
    const [ticketAmount, setTicketAmount] = useState(() => amountInputValue(initial?.ticketAmount));
    const [reduceHistoricalWorkingDays, setReduceHistoricalWorkingDays] = useState(
        () => recordReducesWorkingDays(initial, String(initial?.leaveType || 'sick').toLowerCase() === 'annual'),
    );
    const skipDateAutoCount = useRef(true);
    const options = Array.isArray(annualLeaves) ? annualLeaves : [];
    const selectedAnnualKey = annualLeaveKey({ fromDate, toDate });
    const thisLeaveReduced = recordReducesWorkingDays(initial, false);
    const othersReduced = annualLeaveAlreadyReduced(paymentCycles, selectedAnnualKey);
    const reduceLocked = thisLeaveReduced || othersReduced;
    const reduceChecked = reduceLocked ? true : reduceHistoricalWorkingDays;

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
        <ModalShell open={open} title={editing ? 'Edit leave record' : 'Add leave record'} onClose={onClose} width="max-w-lg">
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
                            if (String(nextType).toLowerCase() === 'annual') {
                                setReduceHistoricalWorkingDays(true);
                            }
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                        {LEAVE_TYPES.map((row) => (
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
                    <>
                        {isAnnual ? (
                            <label className="block">
                                <FieldLabel>Annual leave</FieldLabel>
                                <select
                                    value={options.some((row) => row.key === selectedAnnualKey) ? selectedAnnualKey : ''}
                                    onChange={(e) => {
                                        const selected = options.find((row) => row.key === e.target.value);
                                        if (!selected) return;
                                        setFromDate(selected.fromDate || '');
                                        setToDate(selected.toDate || '');
                                    }}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                >
                                    <option value="">New annual leave</option>
                                    {options.map((row) => (
                                        <option key={row.key} value={row.key}>
                                            {row.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
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
                    </>
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
                {isAnnual ? (
                    <PaymentTypeFields
                        includeLeave={includeLeave}
                        includeTicket={includeTicket}
                        onLeaveChange={setIncludeLeave}
                        onTicketChange={setIncludeTicket}
                        leaveSalaryAmount={leaveSalaryAmount}
                        ticketAmount={ticketAmount}
                        onLeaveAmountChange={setLeaveSalaryAmount}
                        onTicketAmountChange={setTicketAmount}
                        leaveSalaryPaymentDate=""
                        ticketPaymentDate=""
                        onLeaveDateChange={() => {}}
                        onTicketDateChange={() => {}}
                        reduceHistoricalWorkingDays={reduceChecked}
                        onReduceChange={setReduceHistoricalWorkingDays}
                        reduceLocked={reduceLocked}
                        cycleDays={cycleDays}
                        defaultLeaveSalary={defaultLeaveSalary}
                        showDates={false}
                    />
                ) : null}
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
                            includeLeave: isAnnual ? includeLeave : false,
                            includeTicket: isAnnual ? includeTicket : false,
                            leaveSalaryAmount: isAnnual && includeLeave ? Number(leaveSalaryAmount) || 0 : 0,
                            ticketAmount: isAnnual && includeTicket ? Number(ticketAmount) || 0 : 0,
                            reduceHistoricalWorkingDays: isAnnual
                                ? thisLeaveReduced
                                    ? true
                                    : othersReduced
                                      ? false
                                      : reduceChecked
                                : false,
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
}) {
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
                                <label className="block">
                                    <FieldLabel>Leave salary date</FieldLabel>
                                    <DatePicker
                                        value={leaveSalaryPaymentDate}
                                        onChange={onLeaveDateChange}
                                        className="h-11 w-full rounded-xl"
                                    />
                                </label>
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
                                {defaultLeaveSalary ? (
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
                                <label className="block">
                                    <FieldLabel>Ticket payment date</FieldLabel>
                                    <DatePicker
                                        value={ticketPaymentDate}
                                        onChange={onTicketDateChange}
                                        className="h-11 w-full rounded-xl"
                                    />
                                </label>
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
                            </label>
                        </>
                    ) : null}
                </div>
            ) : null}
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
        </div>
    );
}

function amountInputValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    return String(n);
}

function AddCycleModal({
    open,
    onClose,
    onSave,
    cycleDays,
    nextNumber,
    locked,
    initial,
    defaultLeaveSalary,
    editing,
    annualLeaves = [],
    paymentCycles = [],
    editingIndex = -1,
}) {
    const options = Array.isArray(annualLeaves) ? annualLeaves : [];
    const [annualLeaveKeyValue, setAnnualLeaveKeyValue] = useState(
        () => initial?.annualLeaveKey || (initial?.eligibilityStartDate
            ? annualLeaveKey({ fromDate: initial.eligibilityStartDate, toDate: initial.eligibilityEndDate })
            : ''),
    );
    const [cycleNumber, setCycleNumber] = useState(String(initial?.cycleNumber || nextNumber || 1));
    const [includeLeave, setIncludeLeave] = useState(() => (initial ? recordIncludesLeave(initial) : true));
    const [includeTicket, setIncludeTicket] = useState(() => (initial ? recordIncludesTicket(initial) : false));
    const [leaveSalaryPaymentDate, setLeaveSalaryPaymentDate] = useState(initial?.leaveSalaryPaymentDate || '');
    const [leaveSalaryAmount, setLeaveSalaryAmount] = useState(
        () => amountInputValue(initial?.leaveSalaryAmount ?? initial?.leaveSalary) || amountInputValue(defaultLeaveSalary),
    );
    const [ticketPaymentDate, setTicketPaymentDate] = useState(initial?.ticketPaymentDate || '');
    const [ticketAmount, setTicketAmount] = useState(
        () => amountInputValue(initial?.ticketAmount),
    );
    const [reduceHistoricalWorkingDays, setReduceHistoricalWorkingDays] = useState(
        () => recordReducesWorkingDays(initial, true),
    );
    const [currency, setCurrency] = useState(initial?.currency || 'AED');
    const [paymentReference, setPaymentReference] = useState(initial?.paymentReference || '');
    const [paymentStatus, setPaymentStatus] = useState(initial?.paymentStatus || 'paid');
    const [remarks, setRemarks] = useState(initial?.remarks || '');
    const [file, setFile] = useState(null);
    const existingAttachmentName = initial?.attachment?.name || '';

    function applyAnnualLeave(key) {
        setAnnualLeaveKeyValue(key);
        const selected = options.find((row) => row.key === key);
        if (!selected) return;
        if (!leaveSalaryPaymentDate) setLeaveSalaryPaymentDate(selected.fromDate || '');
        if (!ticketPaymentDate) setTicketPaymentDate(selected.fromDate || '');
        if (!includeLeave && recordIncludesLeave(selected)) setIncludeLeave(true);
        if (!includeTicket && recordIncludesTicket(selected)) setIncludeTicket(true);
        if (!leaveSalaryAmount && recordIncludesLeave(selected)) {
            setLeaveSalaryAmount(
                amountInputValue(selected.leaveSalaryAmount) || amountInputValue(defaultLeaveSalary),
            );
        }
        if (!ticketAmount && recordIncludesTicket(selected)) {
            setTicketAmount(amountInputValue(selected.ticketAmount));
        }
    }

    const selectedLeave = options.find((row) => row.key === annualLeaveKeyValue);
    const leaveKey = annualLeaveKeyValue || cycleAnnualLeaveKey(initial);
    const thisCycleReduced = recordReducesWorkingDays(initial, false);
    const othersReduced = annualLeaveAlreadyReduced(paymentCycles, leaveKey, editingIndex);
    const reduceLocked = thisCycleReduced || othersReduced;
    const reduceChecked = reduceLocked ? true : reduceHistoricalWorkingDays;

    return (
        <ModalShell open={open} title={editing ? 'Edit payment cycle' : 'Add payment cycle'} onClose={onClose} width="max-w-lg">
            <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="col-span-2 block">
                    <FieldLabel>Annual leave</FieldLabel>
                    <select
                        value={annualLeaveKeyValue}
                        onChange={(e) => applyAnnualLeave(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                        <option value="">Select annual leave</option>
                        {options.map((row) => (
                            <option key={row.key} value={row.key}>
                                {row.label}
                            </option>
                        ))}
                    </select>
                    {options.length === 0 ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                            Add an annual leave record first to choose a date range here.
                        </p>
                    ) : null}
                </label>
                <PaymentTypeFields
                    includeLeave={includeLeave}
                    includeTicket={includeTicket}
                    onLeaveChange={setIncludeLeave}
                    onTicketChange={setIncludeTicket}
                    leaveSalaryAmount={leaveSalaryAmount}
                    ticketAmount={ticketAmount}
                    onLeaveAmountChange={setLeaveSalaryAmount}
                    onTicketAmountChange={setTicketAmount}
                    leaveSalaryPaymentDate={leaveSalaryPaymentDate}
                    ticketPaymentDate={ticketPaymentDate}
                    onLeaveDateChange={setLeaveSalaryPaymentDate}
                    onTicketDateChange={setTicketPaymentDate}
                    reduceHistoricalWorkingDays={reduceChecked}
                    onReduceChange={setReduceHistoricalWorkingDays}
                    reduceLocked={reduceLocked}
                    cycleDays={cycleDays}
                    defaultLeaveSalary={defaultLeaveSalary}
                    showDates
                />
                <label className="block">
                    <FieldLabel>Cycle number</FieldLabel>
                    <input
                        type="number"
                        min="1"
                        value={cycleNumber}
                        onChange={(e) => setCycleNumber(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                </label>
                <label className="block">
                    <FieldLabel>Currency</FieldLabel>
                    <input
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                </label>
                <label className="block">
                    <FieldLabel>Payment status</FieldLabel>
                    <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="h-11 w-full rounded-xl border px-3 text-sm"
                    >
                        <option value="draft">Draft</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </label>
                <label className="block">
                    <FieldLabel>Payment reference</FieldLabel>
                    <input
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="h-11 w-full rounded-xl border px-3 text-sm"
                    />
                </label>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks"
                    className="col-span-2 min-h-[64px] rounded-xl border px-3 py-2 text-sm"
                />
                <label className="col-span-2 block text-sm text-slate-600">
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
            </div>
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-sm font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={locked}
                    onClick={async () => {
                        onSave({
                            ...(initial || {}),
                            cycleNumber: Number(cycleNumber) || nextNumber || 1,
                            eligibilityStartDate: selectedLeave?.fromDate || initial?.eligibilityStartDate || '',
                            eligibilityEndDate: selectedLeave?.toDate || initial?.eligibilityEndDate || '',
                            entitlementDays: thisCycleReduced || (!othersReduced && reduceChecked) ? cycleDays : 0,
                            includeLeave,
                            includeTicket,
                            leaveSalaryPaymentDate: includeLeave ? leaveSalaryPaymentDate : '',
                            leaveSalaryAmount: includeLeave ? Number(leaveSalaryAmount) || 0 : 0,
                            ticketPaymentDate: includeTicket ? ticketPaymentDate : '',
                            ticketAmount: includeTicket ? Number(ticketAmount) || 0 : 0,
                            reduceHistoricalWorkingDays: thisCycleReduced ? true : othersReduced ? false : reduceChecked,
                            currency,
                            paymentReference,
                            paymentStatus,
                            verificationStatus: initial?.verificationStatus || 'verified',
                            remarks,
                            annualLeaveKey: annualLeaveKeyValue,
                            attachment: (await fileToAttachment(file)) || initial?.attachment || null,
                        });
                        onClose();
                    }}
                    className="h-10 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {editing ? 'Save' : 'Add cycle'}
                </button>
            </div>
        </ModalShell>
    );
}

function ReasonModal({ open, title, confirmLabel, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    return (
        <ModalShell open={open} title={title} onClose={onClose}>
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
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
    const [systemLeaveModal, setSystemLeaveModal] = useState(false);
    const [systemLeaveTypeFilter, setSystemLeaveTypeFilter] = useState('');
    const [leaveDraftIndex, setLeaveDraftIndex] = useState(null);
    const [cycleModal, setCycleModal] = useState(false);
    const [cycleDraft, setCycleDraft] = useState(null);
    const [cycleDraftIndex, setCycleDraftIndex] = useState(null);
    const [cycleDeleteIndex, setCycleDeleteIndex] = useState(null);
    const [leaveDeleteRow, setLeaveDeleteRow] = useState(null);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showApprove, setShowApprove] = useState(false);
    const [showRevoke, setShowRevoke] = useState(false);
    const [joiningModal, setJoiningModal] = useState(false);
    const [pendingJoining, setPendingJoining] = useState('');
    const [reopenModal, setReopenModal] = useState(false);
    const [returnModal, setReturnModal] = useState(false);
    const [rejectModal, setRejectModal] = useState(false);
    const [policyModal, setPolicyModal] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
    const [resetting, setResetting] = useState(false);
    const lastFetchedVerpRef = useRef('');
    const pendingJoiningRef = useRef('');
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
        lastFetchedVerpRef.current = nextVerp;
        setJoiningDateReason('');
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
        if (!employeeId || loading || !verpStartDate || lastFetchedVerpRef.current === verpStartDate) return undefined;
        const handle = setTimeout(async () => {
            try {
                const res = await axiosInstance.get(
                    `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical`,
                    { skipToast: true, params: { verpStartDate } },
                );
                lastFetchedVerpRef.current = verpStartDate;
                setData((prev) => ({
                    ...(prev || {}),
                    workingDays: res.data?.workingDays || 0,
                    weeklyOffs: res.data?.weeklyOffs || 0,
                    holidays: res.data?.holidays || 0,
                    calendarDays: res.data?.calendarDays || 0,
                    historicalTo: res.data?.historicalTo || '',
                    cycleDays: res.data?.cycleDays || prev?.cycleDays,
                    policy: res.data?.policy || prev?.policy,
                    calculation: res.data?.calculation || prev?.calculation,
                    leaveMultipliers: res.data?.leaveMultipliers || prev?.leaveMultipliers,
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
                            contractJoiningDate: res.data?.contractJoiningDate || joiningDate,
                        },
                        { skipToast: true },
                    );
                }
            } catch {
                /* keep last totals */
            }
        }, 280);
        return () => clearTimeout(handle);
    }, [employeeId, verpStartDate, loading]);

    const historicalTo = verpStartDate ? addDays(verpStartDate, -1) : '';
    const cycleDays = policyLeaveWorkingDays(data?.policy, data?.cycleDays);
    const leaveMultipliers = data?.leaveMultipliers || policyLeaveMultipliers(data?.policy);
    const splitLeave = splitLeavePayload(leaveRecords);
    const liveLeaveRecords = useMemo(
        () =>
            filterHiddenSystemLeave(
                Array.isArray(data?.liveAttendance?.leaveRecords) ? data.liveAttendance.leaveRecords : [],
                hiddenSystemLeave,
            ),
        [data?.liveAttendance?.leaveRecords, hiddenSystemLeave],
    );
    const systemLeaveDays = useMemo(() => {
        return (liveLeaveRecords || [])
            .map((row) => {
                const fromDate = row.fromDate || row.startDate || '';
                const toDate = row.toDate || row.endDate || fromDate;
                return {
                    ...row,
                    source: 'system',
                    leaveType: leaveTypeKey(row),
                    fromDate,
                    toDate,
                };
            })
            .sort((a, b) => String(a.fromDate || '').localeCompare(String(b.fromDate || '')));
    }, [liveLeaveRecords]);
    const filteredSystemLeaveDays = useMemo(() => {
        if (!systemLeaveTypeFilter) return systemLeaveDays;
        return systemLeaveDays.filter((row) => leaveTypeKey(row) === systemLeaveTypeFilter);
    }, [systemLeaveDays, systemLeaveTypeFilter]);
    const existingLeaveHistoryRows = useMemo(() => {
        const manual = (leaveRecords || []).map((row, storedIndex) => ({
            ...row,
            source: 'manual',
            storedIndex,
        }));
        const system = systemLeaveHistoryRows(liveLeaveRecords, leaveMultipliers);
        return [...manual, ...system];
    }, [leaveMultipliers, leaveRecords, liveLeaveRecords]);
    const filteredLeaveHistoryRows = useMemo(() => {
        if (!leaveTypeFilter) return existingLeaveHistoryRows;
        return existingLeaveHistoryRows.filter((row) => leaveTypeKey(row) === leaveTypeFilter);
    }, [existingLeaveHistoryRows, leaveTypeFilter]);
    const annualLeaveOptions = useMemo(
        () => listAnnualLeaveOptions(existingLeaveHistoryRows),
        [existingLeaveHistoryRows],
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
    const calc = calculateHistoricalEligibility({
        workingDays: (Number(data?.workingDays) || 0) + (Number(data?.liveAttendance?.workingDays) || 0),
        calendarDays: Number(data?.calendarDays) || 0,
        leaveRecords: [...splitLeave.leaveRecords, ...liveLeaveRecords],
        annualLeaveRecords: splitLeave.annualLeaveRecords,
        paymentCycles,
        cycleDays,
        leaveMultipliers,
    });
    const attendanceLeaveDeduction = Math.max(
        0,
        (Number(calc.totalLeaveDeduction) || 0) - (Number(historicalCalc.totalLeaveDeduction) || 0),
    );
    const benefitEligibility = leaveTicketEligibility({
        days: calc.eligibleBalance,
        leaveWorkingDays: cycleDays,
        airTicketWorkingDays: data?.policy?.workingDaysRequiredForAirTicket,
        basicSalary: data?.employeeLeaveSalary,
    });
    const workflowStatus = data?.workflowStatus || 'draft';
    const permissions = data?.permissions || {};
    const isSalaryHr = Boolean(permissions.isSalaryHr);
    const pendingHr = workflowStatus === 'pending_hr' || Boolean(data?.approvalSent);
    const enrolled = Boolean(data?.enrolled) || workflowStatus === 'locked';
    const canSeeMolCodes = Boolean(permissions.canViewPayrollCodes ?? canSeePayrollCodes);
    const canToggleSalarySlip = Boolean(!pendingHr && (enrolled ? isSalaryHr : hrEdit));
    const canResetEnrollment = Boolean(permissions.canResetEnrollment);
    const locked = pendingHr || (enrolled ? !isSalaryHr : !hrEdit || !permissions.canEdit);
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
    const canUpdateCreated = enrolled && isSalaryHr && !pendingHr;
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
    const displayName = emp?.name ? toTitleName(emp.name) : employeeId;
    const initials = emp?.name
        ? nameInitials(emp.name)
        : String(emp?.initials || nameInitials(employeeId))
            .slice(0, 2)
            .toUpperCase();
    const migrationComplete = Boolean(joiningDate && verpStartDate && historicalTo);
    const enrollStatus = pendingHr
        ? 'Approval sent'
        : enrolled
            ? 'Enrolled'
            : workflowStatus === 'verified'
                ? 'Verified'
                : workflowStatus === 'correction'
                    ? 'Correction'
                    : workflowStatus === 'reopened'
                        ? 'Reopened'
                        : 'Pending';
    const enrollTone = pendingHr
        ? 'bg-amber-50 text-amber-700'
        : enrolled
            ? 'bg-emerald-50 text-emerald-700'
            : workflowStatus === 'verified'
                ? 'bg-emerald-50 text-emerald-700'
                : workflowStatus === 'correction' || workflowStatus === 'reopened'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-amber-50 text-amber-700';
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
        const ok = await runAction(
            '/create',
            'post',
            isSalaryHr ? 'Salary profile created' : 'Sent for HR approval',
        );
        if (ok) {
            setShowCreate(false);
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
            );
            applyPayload(res.data);
            setResetPassword('');
            setResetPasswordVisible(false);
            setResetPasswordOpen(false);
            toast({
                title: res.data?.message || 'Enrolment details moved to Deleted Records',
            });
        } catch (err) {
            toast({
                title: err?.response?.data?.message || 'Could not reset enrolment',
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
                                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                                        Historical Salary Setup
                                    </h1>
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
                                {pendingHr ? (
                                    permissions.canApprove || permissions.canReject ? (
                                        <>
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
                                        </>
                                    ) : (
                                        <>
                                            <span className="inline-flex h-10 items-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
                                                Approval sent
                                            </span>
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
                                        </>
                                    )
                                ) : enrolled ? (
                                    <button
                                        type="button"
                                        onClick={() => runAction('', 'put', 'Profile updated')}
                                        disabled={updateDisabled}
                                        title={
                                            !isSalaryHr
                                                ? 'Only flowchart HR can update a created salary profile'
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
                                {data?.lastRejectReason && !pendingHr ? (
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
                                                <div className="flex items-start gap-3">
                                                    <CardIcon>
                                                        <FileText size={16} />
                                                    </CardIcon>
                                                    <div>
                                                        <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                                            Employment & VERP Migration
                                                        </h3>
                                                        <p className="mt-0.5 text-[12px] text-[#64748B]">
                                                            Defines the historical period used for salary calculations.
                                                        </p>
                                                    </div>
                                                </div>
                                                <CompleteBadge complete={migrationComplete} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                <div className="block">
                                                    <FieldLabel required>Contract joining date</FieldLabel>
                                                    <div className="relative">
                                                        {permissions.canChangeJoiningDate || (enrolled && isSalaryHr && !pendingHr) ? (
                                                            <DatePicker
                                                                value={pendingJoining || joiningDate}
                                                                onChange={(value) => {
                                                                    if (!value || value === joiningDate) {
                                                                        pendingJoiningRef.current = '';
                                                                        setPendingJoining('');
                                                                        return;
                                                                    }
                                                                    pendingJoiningRef.current = value;
                                                                    setPendingJoining(value);
                                                                }}
                                                                onOpenChange={(open) => {
                                                                    if (open) return;
                                                                    const next = pendingJoiningRef.current;
                                                                    if (next && next !== joiningDate) {
                                                                        window.setTimeout(() => setJoiningModal(true), 150);
                                                                    }
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
                                                        minMonth={firstVerpMonthAfterJoining(joiningDate) || undefined}
                                                        fromYear={
                                                            joiningDate && ISO.test(joiningDate)
                                                                ? Number(joiningDate.slice(0, 4))
                                                                : undefined
                                                        }
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
                                                            Weekly offs and company/public holidays have been excluded
                                                            automatically.
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBreakdown(true)}
                                                    className="shrink-0 text-[11px] font-medium text-[#2563EB] hover:underline"
                                                >
                                                    View breakdown
                                                </button>
                                            </div>
                                        </section>

                                        <section className={CARD}>
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <CardIcon tone="red">
                                                        <Calendar size={16} />
                                                    </CardIcon>
                                                    <div>
                                                        <h3 className="text-[15px] font-semibold text-[#0F172A]">
                                                            Existing Leave History
                                                        </h3>
                                                        <p className="mt-0.5 text-[12px] text-[#64748B]">
                                                            Manual records are added here. After salary enrollment,
                                                            this employee&apos;s own leave from attendance is listed
                                                            as System records.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <LeaveTypeFilter
                                                        value={leaveTypeFilter}
                                                        onChange={setLeaveTypeFilter}
                                                        rows={existingLeaveHistoryRows}
                                                    />
                                                    <CompleteBadge complete={leaveComplete} />
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
                                            <LeaveTable
                                                rows={filteredLeaveHistoryRows}
                                                emptyMessage={
                                                    leaveTypeFilter
                                                        ? `No ${leaveMeta(leaveTypeFilter).label.toLowerCase()} records.`
                                                        : 'No leave records yet.'
                                                }
                                                locked={locked || leaveComplete}
                                                onOpenSystem={(row) => {
                                                    setSystemLeaveTypeFilter(leaveTypeKey(row));
                                                    setSystemLeaveModal(true);
                                                }}
                                                onEdit={(row) => {
                                                    if (locked || leaveComplete) return;
                                                    if (!Number.isInteger(row?.storedIndex)) return;
                                                    setLeaveDraftIndex(row.storedIndex);
                                                    setLeaveModal(true);
                                                }}
                                                onRemove={(row) => setLeaveDeleteRow(row)}
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
                                                <p className="inline-flex items-center gap-2 text-[12px] text-[#64748B]">
                                                    Total leave deduction
                                                    <span className="rounded-md border border-[#E6EAF0] bg-[#F1F5F9] px-2 py-0.5 text-[12px] font-medium tabular-nums text-[#334155]">
                                                        {Math.max(0, Number(historicalCalc.totalLeaveDeduction) || 0)} days
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
                                                            Previous paid leave salary and ticket benefits, grouped by{' '}
                                                            {cycleDays}-day entitlement cycle.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <CompleteBadge complete={benefitsComplete} />
                                                    <GhostButton
                                                        disabled={locked || benefitsComplete}
                                                        onClick={() => {
                                                            setCycleDraftIndex(null);
                                                            setCycleDraft(null);
                                                            setCycleModal(true);
                                                        }}
                                                    >
                                                        <Plus size={14} /> Add payment cycle
                                                    </GhostButton>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <PaymentKindCard
                                                    title="Leave"
                                                    rows={leavePaymentRows}
                                                    emptyMessage="No leave payments yet."
                                                    locked={locked || benefitsComplete}
                                                    eligibleLabel="Eligible leave salary"
                                                    eligibleValue={
                                                        benefitEligibility.count > 0
                                                            ? aed(benefitEligibility.eligibleLeaveSalary)
                                                            : ''
                                                    }
                                                    onEdit={(cycleIndex, cycle) => {
                                                        setCycleDraftIndex(cycleIndex);
                                                        setCycleDraft(cycle);
                                                        setCycleModal(true);
                                                    }}
                                                    onRemove={(cycleIndex) => setCycleDeleteIndex(cycleIndex)}
                                                />
                                                <PaymentKindCard
                                                    title="Ticket"
                                                    rows={ticketPaymentRows}
                                                    emptyMessage="No ticket payments yet."
                                                    locked={locked || benefitsComplete}
                                                    eligibleLabel="Eligible ticket"
                                                    eligibleValue={
                                                        benefitEligibility.count > 0
                                                            ? `${Number(benefitEligibility.eligibleTicketDays).toLocaleString('en-US')} days`
                                                            : ''
                                                    }
                                                    onEdit={(cycleIndex, cycle) => {
                                                        setCycleDraftIndex(cycleIndex);
                                                        setCycleDraft(cycle);
                                                        setCycleModal(true);
                                                    }}
                                                    onRemove={(cycleIndex) => setCycleDeleteIndex(cycleIndex)}
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
                                                <EligibilityCalcRow
                                                    label="Historical working days"
                                                    value={historicalCalc.workingDays}
                                                />
                                                {data?.liveAttendance?.enabled ? (
                                                    <EligibilityCalcRow
                                                        label="Working days since VERP start"
                                                        value={Number(data.liveAttendance.workingDays) || 0}
                                                    />
                                                ) : null}
                                                <EligibilityCalcRow
                                                    label="Historical leave deduction"
                                                    value={formatDeductionDays(historicalCalc.totalLeaveDeduction)}
                                                    danger={Number(historicalCalc.totalLeaveDeduction) > 0}
                                                />
                                                {data?.liveAttendance?.enabled ? (
                                                    <EligibilityCalcRow
                                                        label="Attendance leave (policy)"
                                                        value={formatDeductionDays(attendanceLeaveDeduction)}
                                                        danger={Number(attendanceLeaveDeduction) > 0}
                                                        onClick={portalHref ? openEmployeePortal : undefined}
                                                    />
                                                ) : null}
                                                {Number(calc.consumedAnnualLeaveCycles) > 0 ? (
                                                    <EligibilityCalcRow
                                                        label={`Annual leave entitlement (${calc.consumedAnnualLeaveCycles} × ${calc.cycleDays})`}
                                                        value={formatDeductionDays(
                                                            Number(calc.consumedAnnualLeaveCycles) *
                                                                Number(calc.cycleDays || 0),
                                                        )}
                                                        danger
                                                    />
                                                ) : null}
                                                {Number(calc.paidVerifiedCycles) > 0 ? (
                                                    <EligibilityCalcRow
                                                        label={`Paid benefit cycles (${calc.paidVerifiedCycles} × ${calc.cycleDays})`}
                                                        value={formatDeductionDays(
                                                            Number(calc.paidVerifiedCycles) *
                                                                Number(calc.cycleDays || 0),
                                                        )}
                                                        danger
                                                    />
                                                ) : null}
                                            </div>

                                            <div
                                                className="w-full rounded-none"
                                                style={{
                                                    minHeight: 191,
                                                    background:
                                                        'linear-gradient(135deg, #163C77 0%, #164A8C 52%, #1758A4 100%)',
                                                    padding: '31px 22px 18px 16px',
                                                }}
                                            >
                                                <p className="text-[9px] font-bold uppercase leading-3 tracking-[0.8px] text-white/[0.82]">
                                                    Current eligible balance
                                                </p>
                                                <div className="mt-2.5 flex items-baseline">
                                                    <span className="text-[46px] font-bold leading-[48px] tracking-[-1px] text-white">
                                                        {formatSignedDays(calc.eligibleBalance)}
                                                    </span>
                                                    <span className="ml-1.5 text-[13px] font-bold leading-4 text-white">
                                                        days
                                                    </span>
                                                </div>
                                                <p className="mt-3 text-[11px] font-medium leading-[15px] text-[#49DDBB]">
                                                    {calc.eligibleForBenefit
                                                        ? `${calc.availableCycles} cycle${calc.availableCycles === 1 ? '' : 's'} available for the next ${calc.cycleDays}-day entitlement.`
                                                        : `${calc.daysRequired} days remaining to reach the next ${calc.cycleDays}-day entitlement.`}
                                                </p>
                                                <div className="mt-[14px] h-[6px] w-full overflow-hidden rounded-full bg-white/[0.17]">
                                                    <div
                                                        className="h-full rounded-full bg-[#49DDBB]"
                                                        style={{
                                                            width: `${Math.min(
                                                                100,
                                                                (Math.max(0, Number(calc.progressFill) || 0) /
                                                                    Number(calc.cycleDays || 1)) *
                                                                100,
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                                <div className="mt-[7px] flex items-center justify-between text-[11px] font-normal leading-[15px] text-white/80">
                                                    <span>
                                                        {calc.eligibleForBenefit
                                                            ? `${calc.availableCycles} available`
                                                            : `${Math.max(0, Number(calc.progressFill) || 0)} completed`}
                                                    </span>
                                                    <span>{calc.cycleDays} days</span>
                                                </div>
                                            </div>

                                            <div className="flex min-h-[65px] items-start gap-2.5 bg-white px-4 py-[15px]">
                                                <Info
                                                    size={15}
                                                    strokeWidth={2}
                                                    className="mt-0.5 shrink-0 text-[#2A69D8]"
                                                />
                                                <p className="text-[9px] font-normal leading-[18px] text-[#6F7C8F]">
                                                    {data?.liveAttendance?.enabled
                                                        ? `Eligible balance starts from historical working days minus historical leave, then adds each working day after enrollment, subtracts leave using salary policy, and subtracts ${calc.cycleDays} days for each annual leave and paid benefit cycle.`
                                                        : `Current eligible balance = historical working days − leave deductions − ${calc.cycleDays} days per annual leave and paid benefit cycle.`}
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
                                    <SalarySlipPreviewPanel employeeId={employeeId} />
                                )}
                            </>
                        )}
                    </div>

            <AddLeaveModal
                key={leaveModal ? `leave-${leaveDraftIndex ?? 'new'}` : 'leave-closed'}
                open={leaveModal}
                locked={locked}
                initial={Number.isInteger(leaveDraftIndex) ? leaveRecords[leaveDraftIndex] : null}
                periodStart={joiningDate}
                periodEnd={historicalTo}
                leaveMultipliers={leaveMultipliers}
                annualLeaves={annualLeaveOptions}
                paymentCycles={paymentCycles}
                cycleDays={cycleDays}
                defaultLeaveSalary={data?.employeeLeaveSalary}
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
            <AddCycleModal
                key={cycleModal ? `cycle-open-${cycleDraftIndex ?? 'new'}-${cycleDraft?.annualLeaveKey || ''}` : 'cycle-closed'}
                open={cycleModal}
                locked={locked}
                editing={Number.isInteger(cycleDraftIndex)}
                cycleDays={cycleDays}
                nextNumber={paymentCycles.length + 1}
                initial={cycleDraft}
                annualLeaves={annualLeaveOptions}
                paymentCycles={paymentCycles}
                editingIndex={Number.isInteger(cycleDraftIndex) ? cycleDraftIndex : -1}
                defaultLeaveSalary={data?.employeeLeaveSalary}
                onClose={() => {
                    setCycleModal(false);
                    setCycleDraft(null);
                    setCycleDraftIndex(null);
                }}
                onSave={async (row) => {
                    const index = cycleDraftIndex;
                    const next = Number.isInteger(index)
                        ? paymentCycles.map((existing, i) => (i === index ? { ...existing, ...row } : existing))
                        : [...paymentCycles, row];
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
                key={joiningModal ? 'joining-open' : 'joining-closed'}
                open={joiningModal}
                title="Reason for joining date change"
                confirmLabel="Update date"
                onClose={() => {
                    setJoiningModal(false);
                    pendingJoiningRef.current = '';
                    setPendingJoining('');
                }}
                onConfirm={(reason) => {
                    setJoiningDate(pendingJoining);
                    setJoiningDateReason(reason);
                    setJoiningModal(false);
                    pendingJoiningRef.current = '';
                    setPendingJoining('');
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
                open={systemLeaveModal}
                title="System leave"
                onClose={() => setSystemLeaveModal(false)}
                width="max-w-lg"
            >
                <p className="mt-1 text-sm text-slate-500">
                    Leave created automatically after salary enrollment. Filter by type to review each date.
                </p>
                <div className="mt-3">
                    <LeaveTypeFilter
                        value={systemLeaveTypeFilter}
                        onChange={setSystemLeaveTypeFilter}
                        rows={systemLeaveDays}
                    />
                </div>
                <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-[#EEF2F6]">
                    {filteredSystemLeaveDays.length ? (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white">
                                <tr className="border-b border-[#EEF2F6] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                    <th className="px-3 py-2.5 font-semibold">Date</th>
                                    <th className="px-3 py-2.5 font-semibold">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSystemLeaveDays.map((row, index) => {
                                    const meta = leaveMeta(row.leaveType);
                                    const sameDay = row.fromDate && row.fromDate === row.toDate;
                                    return (
                                        <tr
                                            key={`${row.fromDate}-${row.leaveType}-${index}`}
                                            className="border-b border-[#F1F5F9] last:border-0"
                                        >
                                            <td className="px-3 py-2.5 text-[13px] text-[#334155]">
                                                {sameDay
                                                    ? prettyDate(row.fromDate)
                                                    : `${prettyDate(row.fromDate)} — ${prettyDate(row.toDate)}`}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0F172A]">
                                                    <span
                                                        className="h-2 w-2 rounded-full"
                                                        style={{ backgroundColor: meta.color }}
                                                    />
                                                    {meta.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="py-8 text-center text-[13px] text-[#94A3B8]">
                            {systemLeaveTypeFilter
                                ? `No ${leaveMeta(systemLeaveTypeFilter).label.toLowerCase()} records.`
                                : 'No system leave records.'}
                        </p>
                    )}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                    {portalHref ? (
                        <button
                            type="button"
                            onClick={openEmployeePortal}
                            className="h-10 rounded-xl border px-4 text-sm font-semibold text-slate-600"
                        >
                            Open leave portal
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setSystemLeaveModal(false)}
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
                onClose={() => setShowCreate(false)}
            >
                <p className="mt-3 text-sm text-slate-600">
                    {isSalaryHr
                        ? 'This enrolls the employee from the VERP salary start date and locks the historical record. No further HR approval is required.'
                        : 'This sends the profile to flowchart HR for approval. The employee is not enrolled until HR approves.'}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => setShowCreate(false)} className="h-10 rounded-xl border px-4 text-sm font-semibold">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={confirmCreate}
                        className="h-10 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white"
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
                    This enrolls the employee from the VERP salary start date, locks the historical record, and
                    emails the user who submitted the profile.
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
            <ModalShell open={showBreakdown} title="Working days breakdown" onClose={() => setShowBreakdown(false)}>
                <div className="mt-3 space-y-2 text-sm">
                    <Row label="Calendar days" value={calc.calendarDays} />
                    <Row label="Weekly offs excluded" value={data?.weeklyOffs || 0} />
                    <Row label="Holidays excluded" value={data?.holidays || 0} />
                    <Row label="Historical working days" value={calc.workingDays} strong />
                </div>
            </ModalShell>
            <ConfirmAlertDialog
                open={resetConfirmOpen}
                onOpenChange={setResetConfirmOpen}
                title="Are you sure to reset the enrollment?"
                description={`Enrolment details between ${prettyDate(joiningDate) || 'the contract joining date'} and ${prettyDate(verpStartDate) || 'the VERP salary processing date'} will move to Deleted Records. Data outside this period stays. You can restore the archived details from Settings → Deleted Records.`}
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
                    Type your login password. It must match the flowchart HR user password.
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

function EligibilityCalcRow({ label, value, danger, strong, onClick }) {
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
            </span>
            <span
                className={`text-right text-[11px] leading-4 tabular-nums ${danger
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

function LeaveTable({ rows, locked, onEdit, onRemove, onOpenSystem, emptyMessage = 'No leave records yet.' }) {
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
                        <th className="px-2 py-2.5 font-semibold" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const meta = leaveMeta(row.leaveType);
                        const actual = row.actualDays || row.eligibleWorkingDays || 0;
                        const deduction = row.deductionDays || row.deduction || 0;
                        const source = leaveSourceKey(row);
                        const canEdit = !locked && source !== 'system';
                        const canDelete = !locked;
                        const canOpenSystem = source === 'system' && Boolean(onOpenSystem);
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
                                        : `${prettyDate(row.fromDate)} — ${prettyDate(row.toDate)}`}
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
                                <td className="px-2 py-3 text-right">
                                    <button
                                        type="button"
                                        disabled={!canDelete}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onRemove(row);
                                        }}
                                        className="rounded-md p-1 text-[#94A3B8] hover:text-slate-600 disabled:opacity-30"
                                    >
                                        <X size={14} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
