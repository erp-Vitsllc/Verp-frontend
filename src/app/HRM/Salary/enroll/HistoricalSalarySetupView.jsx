'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Calendar,
    Check,
    ExternalLink,
    FileText,
    Info,
    Loader2,
    Lock,
    Pencil,
    Plus,
    RotateCcw,
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
    formatLeaveMultiplier,
    inclusiveCalendarDays,
    leaveMultiplier,
    policyLeaveMultipliers,
    validateLeaveDates,
    workflowIsLocked,
} from '../utils/salaryHistoricalCalculations';
import { notifySalaryPendingInboxChanged } from '../utils/salaryPendingInboxCount';
import SalaryPolicyRequiredModal from '../components/SalaryPolicyRequiredModal';
import { navigateFromList } from '@/utils/listReturnNavigation';
import SalarySlipPreviewPanel from './SalarySlipPreviewPanel';

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

function annualLeaveKey(row) {
    return [
        row?.fromDate || row?.startDate || '',
        row?.toDate || row?.endDate || '',
    ].join('|');
}

function cycleMatchesAnnual(cycle, leave) {
    const key = annualLeaveKey(leave);
    if (cycle?.annualLeaveKey && cycle.annualLeaveKey === key) return true;
    const from = leave?.fromDate || leave?.startDate || '';
    const to = leave?.toDate || leave?.endDate || '';
    return (
        (cycle?.eligibilityStartDate || '') === from &&
        (cycle?.eligibilityEndDate || '') === to
    );
}

function prefillCycleFromAnnual(leave, cycleDays, cycleNumber) {
    const from = leave?.fromDate || leave?.startDate || '';
    const to = leave?.toDate || leave?.endDate || '';
    const eligible = leave?.eligibleWorkingDays || leave?.actualDays || 0;
    return {
        cycleNumber,
        eligibilityStartDate: from,
        eligibilityEndDate: to,
        entitlementDays: cycleDays,
        leaveSalaryPaymentDate: from,
        ticketPaymentDate: from,
        annualLeaveKey: annualLeaveKey(leave),
        remarks: eligible
            ? `Annual leave ${prettyDate(from)} — ${prettyDate(to)} (${eligible} eligible days).`
            : `Annual leave ${prettyDate(from)} — ${prettyDate(to)}.`,
    };
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

function AddLeaveModal({ open, onClose, onSave, periodStart, periodEnd, locked, leaveMultipliers, initial }) {
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
    const multiplier = leaveMultiplier(leaveType, null, leaveMultipliers);
    const existingAttachmentName = initial?.attachment?.name || '';
    const dateError = isAnnual
        ? !fromDate || !toDate
            ? 'Annual leave requires a start date and an end date.'
            : periodStart && (fromDate < periodStart || toDate < periodStart)
                ? 'Leave dates cannot be before the contract joining date.'
                : validateLeaveDates(
                      { leaveType, fromDate, toDate, eligibleWorkingDays: countNum },
                      periodStart,
                      periodEnd,
                  )
        : '';
    const startDisabledDays = leaveDateDisabledDays(periodStart);
    const endDisabledDays = leaveDateDisabledDays(fromDate || periodStart);
    const canSave = countNum > 0 && !locked && !dateError && (!isAnnual || (fromDate && toDate));

    return (
        <ModalShell open={open} title={editing ? 'Edit leave record' : 'Add leave record'} onClose={onClose}>
            <div className="mt-4 space-y-3">
                <label className="block">
                    <FieldLabel>Leave type</FieldLabel>
                    <select
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value)}
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
                {isAnnual ? (
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <FieldLabel required>Start date</FieldLabel>
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
                            <FieldLabel required>End date</FieldLabel>
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
                        {isAnnual
                            ? `Start and end dates are required. The count fills in from those dates and you can still change it. End date can be after the historical period (${prettyDate(periodStart)} — ${prettyDate(periodEnd)}).`
                            : 'Dates are not needed for this leave type. Enter the day count and save.'}
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
                            fromDate: isAnnual ? fromDate : '',
                            toDate: isAnnual ? toDate : '',
                            calendarDays: autoDays || countNum,
                            actualDays: countNum,
                            eligibleWorkingDays: countNum,
                            multiplier,
                            rule: multiplier,
                            deductionDays: countNum * multiplier,
                            deduction: countNum * multiplier,
                            source: 'manual',
                            status: 'approved',
                            remarks,
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

function amountInputValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    return String(n);
}

function AddCycleModal({ open, onClose, onSave, cycleDays, nextNumber, locked, initial, defaultLeaveSalary, editing }) {
    const [cycleNumber, setCycleNumber] = useState(String(initial?.cycleNumber || nextNumber || 1));
    const [leaveSalaryPaymentDate, setLeaveSalaryPaymentDate] = useState(initial?.leaveSalaryPaymentDate || '');
    const [leaveSalaryAmount, setLeaveSalaryAmount] = useState(
        () => amountInputValue(initial?.leaveSalaryAmount ?? initial?.leaveSalary) || amountInputValue(defaultLeaveSalary),
    );
    const [ticketPaymentDate, setTicketPaymentDate] = useState(initial?.ticketPaymentDate || '');
    const [ticketAmount, setTicketAmount] = useState(initial?.ticketAmount || '');
    const [currency, setCurrency] = useState(initial?.currency || 'AED');
    const [paymentReference, setPaymentReference] = useState(initial?.paymentReference || '');
    const [paymentStatus, setPaymentStatus] = useState(initial?.paymentStatus || 'paid');
    const [remarks, setRemarks] = useState(initial?.remarks || '');
    const [file, setFile] = useState(null);
    const existingAttachmentName = initial?.attachment?.name || '';

    return (
        <ModalShell open={open} title={editing ? 'Edit payment cycle' : 'Add payment cycle'} onClose={onClose} width="max-w-lg">
            <div className="mt-4 grid grid-cols-2 gap-3">
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
                    <FieldLabel>Leave salary date</FieldLabel>
                    <DatePicker value={leaveSalaryPaymentDate} onChange={setLeaveSalaryPaymentDate} className="h-11 w-full rounded-xl" />
                </label>
                <label className="block">
                    <FieldLabel>Leave salary amount</FieldLabel>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={leaveSalaryAmount}
                        onChange={(e) => setLeaveSalaryAmount(e.target.value)}
                        className="h-11 w-full rounded-xl border px-3 text-sm"
                    />
                    {defaultLeaveSalary ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                            Auto-filled from this employee&apos;s leave salary. You can change it.
                        </p>
                    ) : null}
                </label>
                <label className="block">
                    <FieldLabel>Ticket payment date</FieldLabel>
                    <DatePicker value={ticketPaymentDate} onChange={setTicketPaymentDate} className="h-11 w-full rounded-xl" />
                </label>
                <label className="block">
                    <FieldLabel>Ticket amount</FieldLabel>
                    <input
                        type="number"
                        min="0"
                        value={ticketAmount}
                        onChange={(e) => setTicketAmount(e.target.value)}
                        className="h-11 w-full rounded-xl border px-3 text-sm"
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
                <label className="col-span-2 block">
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
                            eligibilityStartDate: initial?.eligibilityStartDate || '',
                            eligibilityEndDate: initial?.eligibilityEndDate || '',
                            entitlementDays: cycleDays,
                            leaveSalaryPaymentDate,
                            leaveSalaryAmount: Number(leaveSalaryAmount) || 0,
                            ticketPaymentDate,
                            ticketAmount: Number(ticketAmount) || 0,
                            currency,
                            paymentReference,
                            paymentStatus,
                            verificationStatus: initial?.verificationStatus || 'verified',
                            remarks,
                            annualLeaveKey: initial?.annualLeaveKey || '',
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
    const [setupTab, setSetupTab] = useState('details');
    const [openingSalarySlip, setOpeningSalarySlip] = useState(false);
    const [leaveRecords, setLeaveRecords] = useState([]);
    const [paymentCycles, setPaymentCycles] = useState([]);
    const [leaveComplete, setLeaveComplete] = useState(false);
    const [benefitsComplete, setBenefitsComplete] = useState(false);
    const [leaveModal, setLeaveModal] = useState(false);
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
    const [leaveDraftIndex, setLeaveDraftIndex] = useState(null);
    const [cycleModal, setCycleModal] = useState(false);
    const [cycleDraft, setCycleDraft] = useState(null);
    const [cycleDraftIndex, setCycleDraftIndex] = useState(null);
    const [cycleDeleteIndex, setCycleDeleteIndex] = useState(null);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showApprove, setShowApprove] = useState(false);
    const [joiningModal, setJoiningModal] = useState(false);
    const [pendingJoining, setPendingJoining] = useState('');
    const [reopenModal, setReopenModal] = useState(false);
    const [returnModal, setReturnModal] = useState(false);
    const [rejectModal, setRejectModal] = useState(false);
    const [policyModal, setPolicyModal] = useState(false);
    const lastFetchedVerpRef = useRef('');
    const pendingJoiningRef = useRef('');
    const [savedSnapshot, setSavedSnapshot] = useState('');

    const applyPayload = useCallback((payload) => {
        const nextJoining = payload?.contractJoiningDate || payload?.joiningDate || '';
        const nextVerp = payload?.verpStartDate || '';
        const nextCompanyMol = payload?.companyMolCode || '';
        const nextEmployeeMol = payload?.employeeMolId || '';
        const nextSalarySlip = Boolean(payload?.salarySlip);
        const nextLeave = historicalLeaveOnly(
            combineLeaveRows(payload?.leaveRecords, payload?.annualLeaveRecords),
        );
        const nextCycles = Array.isArray(payload?.paymentCycles) ? payload.paymentCycles : [];
        const nextLeaveComplete = Boolean(payload?.leaveHistoryComplete);
        const nextBenefitsComplete = Boolean(payload?.benefitsComplete);
        setData(payload);
        setJoiningDate(nextJoining);
        setVerpStartDate(nextVerp);
        setCompanyMolCode(nextCompanyMol);
        setEmployeeMolId(nextEmployeeMol);
        setSalarySlip(nextSalarySlip);
        setLeaveRecords(nextLeave);
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
            }),
        );
    }, []);

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
                    cycleDays: prev?.cycleDays || res.data?.cycleDays,
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
    const cycleDays = Number(data?.cycleDays) || 300;
    const leaveMultipliers = data?.leaveMultipliers || policyLeaveMultipliers(data?.policy);
    const splitLeave = splitLeavePayload(leaveRecords);
    const annualLeaves = useMemo(
        () => (leaveRecords || []).filter((row) => String(row?.leaveType || '').toLowerCase() === 'annual'),
        [leaveRecords],
    );
    const pendingAnnualPayments = useMemo(
        () =>
            annualLeaves.filter(
                (leave) => !(paymentCycles || []).some((cycle) => cycleMatchesAnnual(cycle, leave)),
            ),
        [annualLeaves, paymentCycles],
    );
    const liveLeaveRecords = Array.isArray(data?.liveAttendance?.leaveRecords)
        ? data.liveAttendance.leaveRecords
        : [];
    const existingLeaveHistoryRows = useMemo(() => {
        const manual = (leaveRecords || []).map((row, storedIndex) => ({
            ...row,
            source: 'manual',
            storedIndex,
        }));
        const system = mergeAdjacentSystemLeave(liveLeaveRecords, leaveMultipliers);
        return [...manual, ...system];
    }, [leaveMultipliers, leaveRecords, liveLeaveRecords]);
    const filteredLeaveHistoryRows = useMemo(() => {
        if (!leaveTypeFilter) return existingLeaveHistoryRows;
        return existingLeaveHistoryRows.filter((row) => leaveTypeKey(row) === leaveTypeFilter);
    }, [existingLeaveHistoryRows, leaveTypeFilter]);
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
    const workflowStatus = data?.workflowStatus || 'draft';
    const permissions = data?.permissions || {};
    const isSalaryHr = Boolean(permissions.isSalaryHr);
    const pendingHr = workflowStatus === 'pending_hr' || Boolean(data?.approvalSent);
    const enrolled = Boolean(data?.enrolled) || workflowStatus === 'locked';
    const canSeeMolCodes = Boolean(permissions.canViewPayrollCodes ?? canSeePayrollCodes);
    const canToggleSalarySlip = Boolean(!pendingHr && (enrolled ? isSalaryHr : hrEdit));
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

    async function persistRecords(nextLeave, nextCycles, success) {
        if (locked) return false;
        if (enrolled) return true;
        const split = splitLeavePayload(nextLeave);
        return runAction('', 'put', success || '', {
            leaveRecords: split.leaveRecords,
            annualLeaveRecords: split.annualLeaveRecords,
            paymentCycles: nextCycles,
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
                                        <span className="inline-flex h-10 items-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">
                                            Approval sent
                                        </span>
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
                                { key: 'details', label: 'Salary details' },
                                { key: 'slip', label: 'Salary slip' },
                            ].map((tab) => {
                                const active = setupTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setSetupTab(tab.key)}
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
                                                            Manual records are added here. System records are leave
                                                            created automatically after salary enrollment.
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
                                                onOpenPortal={portalHref ? openEmployeePortal : undefined}
                                                onEdit={(row) => {
                                                    if (locked || leaveComplete) return;
                                                    if (!Number.isInteger(row?.storedIndex)) return;
                                                    setLeaveDraftIndex(row.storedIndex);
                                                    setLeaveModal(true);
                                                }}
                                                onRemove={async (row) => {
                                                    if (!Number.isInteger(row?.storedIndex)) return;
                                                    const next = leaveRecords.filter((_, i) => i !== row.storedIndex);
                                                    setLeaveRecords(next);
                                                    const ok = await persistRecords(next, paymentCycles);
                                                    if (!ok) setLeaveRecords(leaveRecords);
                                                }}
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
                                                            Previous paid benefits grouped by {cycleDays}-day entitlement
                                                            cycle.
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
                                            {paymentCycles.length === 0 && pendingAnnualPayments.length === 0 ? (
                                                <p className="py-8 text-center text-[13px] text-[#94A3B8]">
                                                    No payment cycles yet. Annual leave records appear here so you can
                                                    add leave salary and ticket details.
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                    {pendingAnnualPayments.map((leave, index) => (
                                                        <button
                                                            key={leave.id || annualLeaveKey(leave) || index}
                                                            type="button"
                                                            disabled={locked || benefitsComplete}
                                                            onClick={() => {
                                                                setCycleDraftIndex(null);
                                                                setCycleDraft(
                                                                    prefillCycleFromAnnual(
                                                                        leave,
                                                                        cycleDays,
                                                                        paymentCycles.length + 1,
                                                                    ),
                                                                );
                                                                setCycleModal(true);
                                                            }}
                                                            className="rounded-[10px] border border-dashed border-[#93C5FD] bg-[#F8FBFF] p-4 text-left hover:border-[#2563EB] disabled:opacity-50"
                                                        >
                                                            <p className="text-[14px] font-bold text-[#0F172A]">
                                                                Annual leave
                                                            </p>
                                                            <p className="mt-1 text-[13px] font-semibold text-[#1D2A3E]">
                                                                {leave.fromDate || leave.startDate || leave.toDate || leave.endDate
                                                                    ? `${prettyDate(leave.fromDate || leave.startDate)} — ${prettyDate(leave.toDate || leave.endDate)}`
                                                                    : 'No dates'}
                                                            </p>
                                                            <p className="mt-1 text-[12px] text-[#64748B]">
                                                                {leave.eligibleWorkingDays || leave.actualDays || 0}{' '}
                                                                eligible days · add leave salary & ticket
                                                            </p>
                                                        </button>
                                                    ))}
                                                    {paymentCycles.map((cycle, index) => {
                                                        const paid =
                                                            String(cycle.paymentStatus || '').toLowerCase() ===
                                                            'paid';
                                                        return (
                                                            <div
                                                                key={cycle.id || index}
                                                                className="relative rounded-[10px] border border-[#E6EAF0] bg-white p-4"
                                                            >
                                                                <div className="absolute right-2 top-2 flex items-center gap-0.5">
                                                                    <button
                                                                        type="button"
                                                                        disabled={locked || benefitsComplete}
                                                                        onClick={() => {
                                                                            setCycleDraftIndex(index);
                                                                            setCycleDraft(cycle);
                                                                            setCycleModal(true);
                                                                        }}
                                                                        className="rounded-md p-1 text-[#64748B] hover:bg-slate-100 hover:text-[#2563EB] disabled:opacity-30"
                                                                        aria-label="Edit payment cycle"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={locked || benefitsComplete}
                                                                        onClick={() => setCycleDeleteIndex(index)}
                                                                        className="rounded-md p-1 text-[#94A3B8] hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                                                        aria-label="Delete payment cycle"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center gap-2 pr-14">
                                                                    <p className="text-[14px] font-bold text-[#0F172A]">
                                                                        Cycle {cycle.cycleNumber || index + 1}
                                                                    </p>
                                                                    <span
                                                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paid
                                                                                ? 'bg-[#F0FDF4] text-[#15803D]'
                                                                                : 'bg-slate-100 text-slate-500'
                                                                            }`}
                                                                    >
                                                                        {paid ? 'Paid' : cycle.paymentStatus || 'Draft'}
                                                                    </span>
                                                                </div>
                                                                {cycle.eligibilityStartDate || cycle.annualLeaveKey ? (
                                                                    <p className="mt-1 pr-6 text-[11px] text-[#64748B]">
                                                                        Annual leave{' '}
                                                                        {prettyDate(cycle.eligibilityStartDate)} —{' '}
                                                                        {prettyDate(cycle.eligibilityEndDate)}
                                                                    </p>
                                                                ) : null}
                                                                <div className="mt-3 grid grid-cols-3 gap-3">
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                                                            Payment date
                                                                        </p>
                                                                        <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">
                                                                            {prettyDate(
                                                                                cycle.leaveSalaryPaymentDate ||
                                                                                cycle.ticketPaymentDate,
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                                                            Leave salary
                                                                        </p>
                                                                        <p className="mt-1 text-[13px] font-bold text-[#0F172A]">
                                                                            {aed(
                                                                                cycle.leaveSalaryAmount,
                                                                                cycle.currency,
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                                                                            Ticket amount
                                                                        </p>
                                                                        <p className="mt-1 text-[13px] font-bold text-[#0F172A]">
                                                                            {aed(cycle.ticketAmount, cycle.currency)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
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
                                                {Number(calc.consumedEntitlementDays) > 0 ? (
                                                    <EligibilityCalcRow
                                                        label={`Paid benefit cycles (${calc.paidVerifiedCycles} × ${calc.cycleDays})`}
                                                        value={formatDeductionDays(calc.consumedEntitlementDays)}
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
                                                        ? `Eligible balance starts from historical working days minus historical leave, then adds each working day after enrollment, subtracts leave using salary policy, and subtracts ${calc.cycleDays} days for each paid benefit cycle.`
                                                        : `Current eligible balance = historical working days − leave deductions − ${calc.cycleDays} days per paid benefit cycle.`}
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
                onClose={() => {
                    setLeaveModal(false);
                    setLeaveDraftIndex(null);
                }}
                onSave={async (row) => {
                    const index = leaveDraftIndex;
                    const next = Number.isInteger(index)
                        ? leaveRecords.map((existing, i) => (i === index ? { ...existing, ...row } : existing))
                        : [...leaveRecords, row];
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

function LeaveTable({ rows, locked, onEdit, onRemove, onOpenPortal, emptyMessage = 'No leave records yet.' }) {
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
                        const canOpenPortal = Boolean(onOpenPortal);
                        return (
                            <tr
                                key={row.id || `${row.fromDate}-${source}-${index}`}
                                className={`border-b border-[#F1F5F9] ${
                                    canEdit || canOpenPortal ? 'cursor-pointer hover:bg-slate-50' : ''
                                }`}
                                title={
                                    canEdit
                                        ? 'Click to edit this leave record'
                                        : canOpenPortal
                                          ? 'Open this employee leave portal'
                                          : undefined
                                }
                                onClick={() => {
                                    if (canEdit) onEdit(row);
                                    else onOpenPortal?.(row);
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
                                    {row.fromDate || row.toDate
                                        ? `${prettyDate(row.fromDate)} — ${prettyDate(row.toDate)}`
                                        : '—'}
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
                                        disabled={!canEdit}
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
