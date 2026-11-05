'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ChevronDown,
    ChevronUp,
    Info,
    Loader2,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import useWorkLocations from '@/hooks/useWorkLocations';
import { FALLBACK_WORK_LOCATIONS, normalizeWorkLocationKey, workLocationLabel } from '@/utils/workLocations';
import { toCalendarMonthDay, toPayrollMonthDay } from '../utils/payrollMonthDay';
import { policyFormFromApi } from '../utils/salaryPolicyForm';
import SalaryDmfApprovalPanel from './SalaryDmfApprovalPanel';
import PayrollExcelMenu from './PayrollExcelMenu';
import SalaryZohoJournalModal from './SalaryZohoJournalModal';
import SalarySlotExpenseModal from './SalarySlotExpenseModal';
import { monthPayrollProcessStatusLabel, payrollPendingForLabel } from '../utils/payrollApprovalStatus';
import { handleNavigateFromListClick, navigateFromList } from '@/utils/listReturnNavigation';
import { buildFineListPath } from '@/utils/fineNotificationRouting';
import './SalaryMonthControlCentre.css';

const ALL_TAB_KEY = 'all';
const SIDEBAR_EMPLOYEE_LIMIT = 5;
const TAB_MODE_GROUP = 'group';
const TAB_MODE_COMPANY = 'company';
const COMPANY_TAB_PREFIX = 'co:';
const LOCATION_CODE_TONES = ['green', 'violet', 'teal', 'pink', 'blue', 'amber'];
const REQUEST_CATEGORIES = [
    {
        key: 'attendance',
        title: 'Attendance',
        detail: 'Unmarked days and corrections',
        alert: false,
    },
    {
        key: 'leave',
        title: 'Leave',
        detail: 'Annual, sick and authorized',
        alert: false,
    },
    {
        key: 'finance',
        title: 'Finance',
        detail: 'Fine, loan, advance, utility and early salary',
        alert: true,
    },
    {
        key: 'overtime',
        title: 'Overtime',
        detail: 'HOD and HR approval',
        alert: false,
    },
    {
        key: 'compoff',
        title: 'Comp-off',
        detail: 'Comp-off leave requests',
        alert: false,
    },
    {
        key: 'asset',
        title: 'Assets',
        detail: 'Pending assignment and return',
        alert: false,
    },
];

function displayGroupLabel(label) {
    return String(label || '').replace(/managemnet/gi, 'Management');
}

function locationCode(label) {
    const letters = String(label || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
    return letters || 'WL';
}

const MONTH_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n) {
    return String(n).padStart(2, '0');
}

function parseMonthKey(monthKey) {
    const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;
    return { year, monthIndex, monthKey: `${year}-${pad2(monthIndex + 1)}` };
}

function lastDayOfMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function dateInMonth(year, monthIndex, day) {
    const max = lastDayOfMonth(year, monthIndex);
    const safeDay = Math.min(Math.max(1, Number(day) || 1), max);
    return new Date(year, monthIndex, safeDay);
}

function formatShortDayMonth(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
    const short = MONTH_FULL[date.getMonth()].slice(0, 3);
    return `${pad2(date.getDate())} ${short}`;
}

function formatRequestDetail(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const [year, month, day] = text.split('-').map(Number);
        const short = MONTH_FULL[month - 1]?.slice(0, 3) || '';
        return `${day} ${short} ${year}`.trim();
    }
    return text;
}

function cycleFromPolicy(policy, parsed) {
    const processDay = Number(toPayrollMonthDay(policy?.salaryProcessingDate)) || 1;
    const cutoffDay = Number(toCalendarMonthDay(policy?.salaryCutoffDate)) || Math.max(1, processDay - 3);
    const cutoffDate = parsed ? dateInMonth(parsed.year, parsed.monthIndex, cutoffDay) : null;

    const startRaw = String(policy?.salaryProcessStartMonth || '').trim();
    let startMonthLabel = startRaw;
    if (/^\d{4}-\d{2}$/.test(startRaw)) {
        const y = Number(startRaw.slice(0, 4));
        const m = Number(startRaw.slice(5, 7)) - 1;
        startMonthLabel = MONTH_FULL[m] ? `${MONTH_FULL[m]} ${y}` : startRaw;
    } else if (!startRaw) {
        startMonthLabel = parsed ? `January ${parsed.year}` : '—';
    }

    const reminderDays = Number(policy?.salaryProcessReminders?.[0]?.daysBefore) || 0;
    return {
        processDay,
        cutoffDate,
        startMonthLabel,
        reminderLabel: reminderDays
            ? `${reminderDays} day${reminderDays === 1 ? '' : 's'} after processing`
            : 'On processing date',
        reminderDay: reminderDays,
        leaveEligibility: policy?.workingDaysRequiredToEligible
            ? `${policy.workingDaysRequiredToEligible} working days`
            : '365 working days',
        leaveSalaryEligibility: policy?.leaveSalaryWorkingDays
            ? `${policy.leaveSalaryWorkingDays} working days`
            : '365 working days',
        ticketEligibility: policy?.leaveSalaryWorkingDays
            ? `${policy.leaveSalaryWorkingDays} working days`
            : policy?.workingDaysRequiredToEligible
                ? `${policy.workingDaysRequiredToEligible} working days`
                : '—',
    };
}

function formatMoney(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSlotDate(value) {
    const date = value instanceof Date ? value : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '—';
    return `${pad2(date.getDate())} ${MONTH_FULL[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

function StatusPill({ tone, children }) {
    return <span className={`spcc-pill spcc-pill--${tone}`}>{children}</span>;
}

function ratioPercent(part, total) {
    const value = Number(part) || 0;
    const max = Number(total) || 0;
    if (max <= 0) return 0;
    return Math.min(100, Math.round((value / max) * 100));
}

function companyInitials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return 'CO';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function MetricBar({ percent, tone = 'teal' }) {
    const width = Math.min(100, Math.max(0, Number(percent) || 0));
    return (
        <span className={`spcc-metric-bar spcc-metric-bar--${tone}`} aria-hidden="true">
            <span className="spcc-metric-bar__fill" style={{ width: `${width}%` }} />
        </span>
    );
}

function MetricCard({ code, codeTone, title, pill, pillTone, onClick, active, children }) {
    const Tag = onClick ? 'button' : 'article';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            className={`spcc-metric${onClick ? ' spcc-metric--btn' : ''}${active ? ' is-active' : ''}`}
            onClick={onClick}
        >
            <div className="spcc-metric__top">
                <span className="spcc-metric__ident">
                    <span className={`spcc-metric__code spcc-metric__code--${codeTone}`}>{code}</span>
                    <span className="spcc-metric__title">{title}</span>
                </span>
                <StatusPill tone={pillTone}>{pill}</StatusPill>
            </div>
            <div className="spcc-metric__body">{children}</div>
        </Tag>
    );
}

function RatioStat({ label, part, total, money, hint, percent, title }) {
    const hasTotal = total != null && total !== '';
    const bar = !hasTotal
        ? (Number(part) > 0 ? 100 : 0)
        : (percent == null ? ratioPercent(part, total) : percent);
    return (
        <div className="spcc-metric-tile" title={title || undefined}>
            <div className="spcc-metric-stat__head">
                <span className="spcc-metric-stat__label">{label}</span>
                {hint ? <span className="spcc-metric-stat__hint">{hint}</span> : null}
            </div>
            <span className={`spcc-metric-stat__value${money ? ' is-money' : ''}`}>
                {money ? formatMoney(part) : part}
                {hasTotal ? (
                    <span className="spcc-metric-den"> / {money ? formatMoney(total) : total}</span>
                ) : null}
            </span>
            <MetricBar percent={bar} />
        </div>
    );
}

function waitingDayCount(item) {
    const label = String(item?.waitingLabel || '').trim();
    const fromLabel = label.match(/^(\d+)\s+days?$/i);
    if (fromLabel) return Number(fromLabel[1]);
    if (/^today$/i.test(label)) return 0;
    const raw = item?.notifiedAt || item?.dateKey || item?.date;
    const date = raw instanceof Date ? raw : raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) return -1;
    const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today - start) / 86400000);
    return Number.isFinite(days) ? days : -1;
}

function itemIsDue(item) {
    return waitingDayCount(item) >= 1;
}

function employeeAmount(emp) {
    return Number(emp?.actualSalary ?? emp?.monthlySalary) || 0;
}

function employeeExtra(emp) {
    return Number(emp?.extra ?? emp?.ot) || 0;
}

function employeeIdKey(value) {
    return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function salaryYearMonth(value) {
    const match = String(value || '').trim().match(/^(\d{4}-\d{2})/);
    return match ? match[1] : '';
}

/** Enrolled, active employees whose processing month is this payroll month or earlier. */
function enrolledForSalaryMonth(emp, monthKey) {
    if (!emp || emp.enrolled === false) return false;
    if (emp.enrolledForMonth === false) return false;
    if (String(emp.status || '') === 'Left User') return false;
    const profile = String(emp.profileStatus || '').trim().toLowerCase();
    if (profile && profile !== 'active') return false;
    const month = salaryYearMonth(monthKey);
    const start = salaryYearMonth(emp.processingStart) || salaryYearMonth(emp.fromMonth);
    if (month && start && start > month) return false;
    if (emp.enrolledForMonth === true) return true;
    if (!month || !start) return false;
    return start <= month;
}

function companyKeyOf(emp) {
    const name = String(emp?.companyName || '').trim();
    if (!name || name === '—') return 'Unassigned';
    return name;
}

function sameCompany(left, right) {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function toggleSort(prev, key) {
    if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    }
    return { key, dir: 'asc' };
}

function compareText(left, right) {
    return String(left || '').localeCompare(String(right || ''), undefined, {
        sensitivity: 'base',
        numeric: true,
    });
}

function compareNumber(left, right) {
    return (Number(left) || 0) - (Number(right) || 0);
}

function comparePaymentEmployee(a, b, key, dir) {
    const mul = dir === 'desc' ? -1 : 1;
    if (key === 'company') {
        return mul * compareText(companyKeyOf(a), companyKeyOf(b))
            || compareText(a?.name || a?.employeeId, b?.name || b?.employeeId);
    }
    if (key === 'amount') return mul * compareNumber(employeeAmount(a), employeeAmount(b));
    if (key === 'id') return mul * compareText(a?.employeeId, b?.employeeId);
    return mul * compareText(a?.name || a?.employeeId, b?.name || b?.employeeId);
}

function comparePayrollRow(a, b, key, dir, processedIds) {
    const mul = dir === 'desc' ? -1 : 1;
    if (key === 'monthly') return mul * compareNumber(a?.monthlySalary, b?.monthlySalary);
    if (key === 'basic') return mul * compareNumber(a?.basicSalary, b?.basicSalary);
    if (key === 'deduction') return mul * compareNumber(a?.deduction, b?.deduction);
    if (key === 'extra') return mul * compareNumber(employeeExtra(a), employeeExtra(b));
    if (key === 'net') {
        return mul * compareNumber(a?.actualSalary ?? a?.monthlySalary, b?.actualSalary ?? b?.monthlySalary);
    }
    if (key === 'status') {
        const statusOf = (emp) =>
            processedIds.has(String(emp?.employeeId || ''))
                ? 'Processed'
                : String(emp?.status || 'Ready');
        return mul * compareText(statusOf(a), statusOf(b));
    }
    return mul * compareText(a?.name || a?.employeeId, b?.name || b?.employeeId);
}

function SortHeader({ label, column, sort, onSort, align = 'start' }) {
    const active = sort?.key === column;
    return (
        <button
            type="button"
            className={`spcc-sort${active ? ' is-on' : ''}${align === 'end' ? ' is-end' : ''}`}
            onClick={() => onSort(column)}
        >
            {label}
            <span className="spcc-sort__stack" aria-hidden="true">
                <ChevronUp
                    size={9}
                    strokeWidth={2.8}
                    className={active && sort.dir === 'asc' ? 'is-on' : ''}
                />
                <ChevronDown
                    size={9}
                    strokeWidth={2.8}
                    className={active && sort.dir === 'desc' ? 'is-on' : ''}
                />
            </span>
        </button>
    );
}

function toCompanyTabKey(name) {
    return `${COMPANY_TAB_PREFIX}${name}`;
}

function fromCompanyTabKey(key) {
    const value = String(key || '');
    return value.startsWith(COMPANY_TAB_PREFIX) ? value.slice(COMPANY_TAB_PREFIX.length) : '';
}

function uniqueCompanyNames(...lists) {
    const names = [];
    const seen = new Set();
    const add = (name) => {
        const label = String(name || '').trim();
        if (!label || label === '—') return;
        const key = label.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(label);
    };
    for (const list of lists) {
        for (const item of list || []) add(item);
    }
    return names;
}

function employeePayMethod(emp) {
    const typed = String(emp?.paymentType || '').trim().toUpperCase();
    if (typed === 'WPS') return 'WPS';
    if (typed === 'CASH') return 'Cash';
    if (emp?.isWps === true) return 'WPS';
    return String(emp?.companyMolCode || '').trim() ? 'WPS' : 'Cash';
}

function paymentBatchFromApi(row) {
    if (!row) return null;
    const id = String(row.id || row._id || '').trim();
    if (!id) return null;
    const status = String(row.status || (row.processed ? 'approved' : 'draft')).trim() || 'approved';
    if (status === 'cancelled') return null;
    return {
        id,
        paymentNo: Number(row.paymentNo) || 0,
        companyName: String(row.companyName || '').trim(),
        paymentMethod: String(row.paymentMethod || '').trim(),
        status,
        rejectReason: String(row.rejectReason || '').trim(),
        selectedIds: (row.selectedIds || row.employeeIds || []).map(String).filter(Boolean),
        processed: status === 'approved',
        createdAt: row.createdAt || null,
    };
}

function paymentLabel(batch, index) {
    return Number(batch?.paymentNo) || index + 1;
}

function groupEmployeesByCompany(rows) {
    const grouped = [];
    const map = new Map();
    for (const emp of rows || []) {
        const key = companyKeyOf(emp);
        if (!map.has(key)) {
            const list = [];
            map.set(key, list);
            grouped.push([key, list]);
        }
        map.get(key).push(emp);
    }
    return grouped;
}

function SlotAmountDate({ total, dateLabel, status, employeeCount }) {
    const approved = status === 'approved';
    const caption =
        status === 'draft'
            ? `${employeeCount} employee${employeeCount === 1 ? '' : 's'}`
            : status === 'pending_hr'
                ? 'Pending with HR'
                : status === 'pending_wps'
                    ? 'Check the WPS send'
                    : status === 'pending_update'
                        ? 'Update payment'
                        : status === 'rejected'
                            ? 'Rejected — back with Accounts'
                            : approved
                                ? `${employeeCount} employee${employeeCount === 1 ? '' : 's'}`
                                : 'No payment in this slot yet.';
    return (
        <div className="spcc-slot-summary">
            <div className="spcc-slot-summary__row">
                <span className="spcc-slot-summary__label">Total amount</span>
                <span className="spcc-slot-summary__value tabular-nums">
                    {approved ? formatMoney(total) : '—'}
                </span>
            </div>
            <div className="spcc-slot-summary__row">
                <span className="spcc-slot-summary__label">Date</span>
                <span className="spcc-slot-summary__value">{dateLabel}</span>
            </div>
            <span className="spcc-metric__caption">{caption}</span>
            {status === 'draft' ? <span className="spcc-slot-watermark">Draft</span> : null}
        </div>
    );
}

function PaymentResultCard({ slot, active, onSelect }) {
    if (!slot) return null;
    const grouped = groupEmployeesByCompany(slot.rows);

    return (
        <section
            className={`spcc-pay-result spcc-pay-result--row${active ? ' is-active' : ''}${slot.status === 'pending_hr' || slot.status === 'approved' ? ' is-updated' : ''
                }`}
            onClick={() => onSelect?.(slot)}
        >
            <div className="spcc-pay-result__identity">
                <h3 className="spcc-pay-result__title">Slot {slot.slot}</h3>
                <StatusPill tone={slot.status === 'approved' ? 'ok' : 'warn'}>
                    {slotStatusLabel(slot.status) || 'Open'}
                </StatusPill>
            </div>
            <SlotAmountDate
                total={slot.total}
                dateLabel={slot.dateLabel}
                status={slot.status}
                employeeCount={slot.rows.length}
            />
            <div className="spcc-pay-result__body">
                {slot.rows.length ? (
                    grouped.map(([company, list]) => (
                        <div key={company} className="spcc-pay-result__group">
                            <p className="spcc-pay-result__company">{company}</p>
                            <ul className="spcc-pay-result__list">
                                {list.map((emp) => {
                                    const id = String(emp.employeeId || '');
                                    return (
                                        <li key={id} className="spcc-pay-result__row">
                                            <span className="spcc-pay-name">
                                                <span>{emp.name || id}</span>
                                                <span className="spcc-pay-id">{id}</span>
                                            </span>
                                            <span className="tabular-nums">{formatMoney(employeeAmount(emp))}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))
                ) : (
                    <p className="spcc-pay-empty">No employees in this slot.</p>
                )}
            </div>
        </section>
    );
}

function slotStatusLabel(status) {
    if (status === 'draft') return 'Draft';
    if (status === 'pending_hr') return 'Pending with HR';
    if (status === 'pending_wps') return 'WPS send';
    if (status === 'pending_update') return 'Update payment';
    if (status === 'rejected') return 'Rejected';
    if (status === 'approved') return 'Updated';
    return '';
}

function slotWorkflowSteps(status, payType, accountsName, hrName) {
    const progress =
        {
            new: 0,
            draft: 1,
            rejected: 1,
            pending_hr: 2,
            pending_wps: 3,
            pending_update: 4,
            approved: 5,
        }[status] ?? 0;
    const steps = [
        { key: 'draft', title: 'Draft', who: '', mark: progress >= 2 ? 'done' : 'current' },
        {
            key: 'applied',
            title: 'Slot applied',
            who: accountsName,
            mark: progress >= 2 ? 'done' : 'wait',
        },
        {
            key: 'hr',
            title: 'HR approval',
            who: hrName,
            mark: progress >= 3 ? 'done' : progress === 2 ? 'current' : 'wait',
        },
    ];
    if (payType === 'WPS') {
        steps.push({
            key: 'wps',
            title: 'Send for WPS',
            who: accountsName,
            note: 'Check the WPS send',
            mark: progress >= 4 ? 'done' : progress === 3 ? 'current' : 'wait',
        });
    }
    steps.push({
        key: 'salary',
        title: 'Update payment',
        who: accountsName,
        mark: progress >= 5 ? 'done' : progress === 4 ? 'current' : 'wait',
    });
    return steps;
}

function idIsClaimed(claimedKeys, id) {
    const key = employeeIdKey(id);
    return Boolean(key && claimedKeys?.has(key));
}

function SlotEditorModal({
    editor,
    employees,
    claimedKeys,
    saving,
    canEdit,
    canDecide,
    canMarkWps,
    canSetUpdated,
    canOpenExcel,
    excelBusy,
    accountsName,
    hrName,
    onChange,
    onClose,
    onCancelSlot,
    onDraft,
    onApply,
    onApprove,
    onReject,
    onWpsUpdated,
    onUpdatePayment,
    onOpenExcel,
}) {
    const allRef = useRef(null);
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
    const [typeFilter, setTypeFilter] = useState('both');
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [panel, setPanel] = useState('details');
    useEffect(() => {
        setPanel('details');
        setRejectOpen(false);
    }, [editor?.id, editor?.status]);
    const companyName = String(editor?.companyName || '').trim();
    const slotStatus = String(editor?.status || 'new');
    // Draft and new slots are still being picked. Rejected slots go back to Accounts to change the pick.
    const showAllEmployees = slotStatus === 'new' || slotStatus === 'draft' || slotStatus === 'rejected';
    const selected = useMemo(
        () => new Set((editor?.selectedIds || []).map((id) => String(id))),
        [editor?.selectedIds],
    );

    const companies = useMemo(() => {
        const names = [];
        const seen = new Set();
        for (const emp of employees || []) {
            const label = companyKeyOf(emp);
            const key = label.toLowerCase();
            if (!label || seen.has(key)) continue;
            seen.add(key);
            names.push(label);
        }
        if (companyName && !seen.has(companyName.toLowerCase())) names.push(companyName);
        names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return names;
    }, [employees, companyName]);

    const lockedType = useMemo(() => {
        const types = new Set();
        for (const emp of employees || []) {
            const id = String(emp.employeeId || '');
            if (!selected.has(id)) continue;
            types.add(employeePayMethod(emp));
        }
        return types.size === 1 ? [...types][0] : '';
    }, [employees, selected]);

    const storedType = String(editor?.paymentMethod || '').trim();
    const payType = storedType === 'Cash' || storedType === 'WPS' ? storedType : lockedType;
    const workflow = slotWorkflowSteps(editor?.status || 'new', payType, accountsName, hrName);

    const rows = useMemo(() => {
        if (!companyName) return [];
        const list = (employees || []).filter((emp) => {
            if (!sameCompany(companyKeyOf(emp), companyName)) return false;
            const id = String(emp.employeeId || '');
            if (!id) return false;
            if (!showAllEmployees) return selected.has(id);
            if (selected.has(id)) return true;
            return !idIsClaimed(claimedKeys, id);
        });
        const typed =
            typeFilter === 'both'
                ? list
                : list.filter((emp) => {
                    if (employeePayMethod(emp) === typeFilter) return true;
                    return showAllEmployees && selected.has(String(emp.employeeId || ''));
                });
        return [...typed].sort((a, b) =>
            comparePaymentEmployee(a, b, sort.key === 'amount' ? 'amount' : 'name', sort.dir),
        );
    }, [employees, companyName, claimedKeys, selected, showAllEmployees, typeFilter, sort]);

    const selectableIds = rows
        .filter((emp) => {
            const method = employeePayMethod(emp);
            return !lockedType || method === lockedType;
        })
        .map((emp) => String(emp.employeeId || ''))
        .filter(Boolean);
    const selectedVisible = selectableIds.filter((id) => selected.has(id));
    const allVisibleChecked = selectableIds.length > 0 && selectedVisible.length === selectableIds.length;
    const checkedTotal = (employees || []).reduce((sum, emp) => {
        const id = String(emp.employeeId || '');
        if (!selected.has(id)) return sum;
        return sum + employeeAmount(emp);
    }, 0);

    useEffect(() => {
        if (!allRef.current) return;
        allRef.current.indeterminate = selectedVisible.length > 0 && selectedVisible.length < selectableIds.length;
    }, [selectedVisible.length, selectableIds.length]);

    function changeCompany(name) {
        const allowed = new Set(
            (employees || [])
                .filter((emp) => sameCompany(companyKeyOf(emp), name))
                .map((emp) => String(emp.employeeId || '')),
        );
        onChange({
            companyName: name,
            selectedIds: (editor.selectedIds || []).filter((id) => allowed.has(String(id))),
        });
    }

    function toggleOne(emp, checked) {
        if (!canEdit) return;
        const id = String(emp.employeeId || '');
        if (!id || idIsClaimed(claimedKeys, id)) return;
        const method = employeePayMethod(emp);
        if (checked && lockedType && method !== lockedType) return;
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        onChange({ selectedIds: [...next], paymentMethod: next.size ? method : '' });
    }

    function toggleAll(checked) {
        if (!canEdit) return;
        const next = new Set(selected);
        selectableIds.forEach((id) => {
            if (checked) next.add(id);
            else next.delete(id);
        });
        const method = lockedType || (typeFilter !== 'both' ? typeFilter : '');
        onChange({ selectedIds: [...next], paymentMethod: method });
    }

    const selectAllEnabled = canEdit && selectableIds.length > 0 && (Boolean(lockedType) || typeFilter !== 'both');

    const slotTitle = editor.status === 'new' ? 'New slot' : `Slot ${editor.slot || ''}`;

    return (
        <section className="spcc-batch spcc-batch--modal">
            <div className="spcc-slot-head">
                <div className="spcc-slot-head__copy">
                    <p className="spcc-batch__kicker">{slotTitle}</p>
                    <h3 id="spcc-pay-modal-title" className="spcc-batch__title">
                        {companyName || 'Create salary slot'}
                    </h3>
                    {editor.status && editor.status !== 'new' ? (
                        <p className="spcc-batch__sub">{slotStatusLabel(editor.status)}</p>
                    ) : (
                        <p className="spcc-batch__sub">Pick a company, then choose who is paid in this slot.</p>
                    )}
                    {editor.rejectReason ? (
                        <p className="spcc-batch__sub spcc-slot-reject">Rejected: {editor.rejectReason}</p>
                    ) : null}
                </div>
                <button type="button" className="spcc-batch__close" onClick={onClose} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            <div className="spcc-slot-switch" role="tablist" aria-label="Slot view">
                <button
                    type="button"
                    role="tab"
                    aria-selected={panel === 'details'}
                    className={panel === 'details' ? 'is-on' : ''}
                    onClick={() => setPanel('details')}
                >
                    Details
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={panel === 'workflow'}
                    className={panel === 'workflow' ? 'is-on' : ''}
                    onClick={() => setPanel('workflow')}
                >
                    Workflow
                </button>
            </div>

            {panel === 'workflow' ? (
                <ol className="spcc-flow spcc-flow--panel">
                    {workflow.map((step, index) => (
                        <li key={step.key} className={`spcc-flow__step is-${step.mark}`}>
                            <span className="spcc-flow__rail" aria-hidden="true">
                                <span className="spcc-flow__dot" />
                                {index < workflow.length - 1 ? <span className="spcc-flow__line" /> : null}
                            </span>
                            <span>
                                <span className="spcc-flow__title">{step.title}</span>
                                {step.who ? <span className="spcc-flow__who">{step.who}</span> : null}
                                {step.note && step.mark !== 'wait' ? (
                                    <span className="spcc-flow__who">{step.note}</span>
                                ) : null}
                                {canOpenExcel && step.mark !== 'wait' && (step.key === 'wps' || (step.key === 'salary' && payType === 'Cash')) ? (
                                    <button
                                        type="button"
                                        className="spcc-flow__excel"
                                        disabled={excelBusy || saving}
                                        onClick={onOpenExcel}
                                    >
                                        {excelBusy ? 'Opening Excel…' : 'Open Excel'}
                                    </button>
                                ) : null}
                            </span>
                        </li>
                    ))}
                </ol>
            ) : (
                <>
                    <div className="spcc-slot-fields">
                        <label className="spcc-slot-company">
                            <span>Company</span>
                            <select
                                value={companyName}
                                disabled={!canEdit}
                                onChange={(event) => changeCompany(event.target.value)}
                            >
                                <option value="">Select company</option>
                                {companies.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="spcc-slot-type">
                            <span>Salary type</span>
                            <select
                                value={typeFilter}
                                disabled={!companyName}
                                onChange={(event) => setTypeFilter(event.target.value)}
                            >
                                <option value="both">Both</option>
                                <option value="WPS">WPS</option>
                                <option value="Cash">Cash</option>
                            </select>
                        </label>
                    </div>
                    {showAllEmployees && companyName && !lockedType && typeFilter === 'both' ? (
                        <p className="spcc-slot-note">A slot uses one salary type. Filter to WPS or Cash to select every employee.</p>
                    ) : null}
                    {lockedType ? <p className="spcc-slot-note">This slot is {lockedType} only.</p> : null}

                    <div className="spcc-batch__list">
                        {companyName ? (
                            <>
                                <div className="spcc-batch__row spcc-batch__row--head">
                                    <input
                                        ref={allRef}
                                        type="checkbox"
                                        checked={allVisibleChecked}
                                        disabled={!selectAllEnabled}
                                        onChange={(event) => toggleAll(event.target.checked)}
                                        aria-label="Select employees"
                                    />
                                    <SortHeader
                                        label="Employee"
                                        column="name"
                                        sort={sort}
                                        onSort={(column) => setSort((prev) => toggleSort(prev, column))}
                                    />
                                    <SortHeader
                                        label="Net salary"
                                        column="amount"
                                        sort={sort}
                                        align="end"
                                        onSort={(column) => setSort((prev) => toggleSort(prev, column))}
                                    />
                                    <span>Type</span>
                                </div>
                                {rows.length ? (
                                    rows.map((emp) => {
                                        const id = String(emp.employeeId || '');
                                        const method = employeePayMethod(emp);
                                        const checked = selected.has(id);
                                        const typeLocked = Boolean(lockedType) && method !== lockedType;
                                        const disabled = !canEdit || typeLocked || idIsClaimed(claimedKeys, id);
                                        return (
                                            <label
                                                key={id}
                                                className={`spcc-batch__row${disabled && !checked ? ' is-locked' : ''}${checked ? ' is-checked' : ''}`}
                                                title={typeLocked ? `This slot is ${lockedType} only` : undefined}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={disabled}
                                                    onChange={(event) => toggleOne(emp, event.target.checked)}
                                                />
                                                <span className="spcc-slot-person">
                                                    <strong>{emp.name || id}</strong>
                                                    <em>{id}</em>
                                                </span>
                                                <span className="spcc-slot-amount tabular-nums">{formatMoney(employeeAmount(emp))}</span>
                                                <span className={`spcc-type-pill${method === 'WPS' ? ' is-wps' : ' is-cash'}`}>{method}</span>
                                            </label>
                                        );
                                    })
                                ) : (
                                    <p className="spcc-slot-empty">
                                        {showAllEmployees
                                            ? 'No employees left for this company in this month.'
                                            : 'No employees in this slot.'}
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="spcc-slot-empty">
                                <strong>No company selected</strong>
                                <span>Select a company to list its employees.</span>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="spcc-batch__foot">
                {canDecide && rejectOpen ? (
                    <input
                        className="spcc-slot-reason"
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="Rejection reason"
                    />
                ) : (
                    <div className="spcc-slot-total">
                        <span>Total net salary</span>
                        <strong className="tabular-nums">{formatMoney(checkedTotal)}</strong>
                        {selected.size ? (
                            <em>
                                {selected.size} employee{selected.size === 1 ? '' : 's'}
                            </em>
                        ) : null}
                    </div>
                )}
                <div className="spcc-slot-actions">
                    {canOpenExcel && !canDecide && !canEdit ? (
                        <button
                            type="button"
                            className="spcc-btn spcc-btn--ghost"
                            disabled={excelBusy || saving}
                            onClick={onOpenExcel}
                        >
                            {excelBusy ? 'Opening Excel…' : 'Open Excel'}
                        </button>
                    ) : null}
                    {canDecide ? (
                        rejectOpen ? (
                            <>
                                <button type="button" className="spcc-btn spcc-btn--ghost" onClick={() => setRejectOpen(false)}>
                                    Back
                                </button>
                                <button
                                    type="button"
                                    className="spcc-btn spcc-btn--reject"
                                    disabled={saving || !rejectReason.trim()}
                                    onClick={() => onReject(rejectReason.trim())}
                                >
                                    Reject
                                </button>
                            </>
                        ) : (
                            <>
                                <button type="button" className="spcc-btn spcc-btn--ghost" onClick={onClose}>
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="spcc-btn spcc-btn--reject"
                                    disabled={saving}
                                    onClick={() => setRejectOpen(true)}
                                >
                                    Reject
                                </button>
                                <button type="button" className="spcc-btn spcc-btn--approve" disabled={saving} onClick={onApprove}>
                                    Approve
                                </button>
                            </>
                        )
                    ) : canEdit ? (
                        <>
                            <button type="button" className="spcc-btn spcc-btn--ghost" disabled={saving} onClick={onCancelSlot}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="spcc-btn spcc-btn--ghost"
                                disabled={saving || !companyName || !selected.size}
                                onClick={onDraft}
                            >
                                Draft
                            </button>
                            <button
                                type="button"
                                className="spcc-btn spcc-btn--primary"
                                disabled={saving || !companyName || !selected.size}
                                onClick={onApply}
                            >
                                Apply
                            </button>
                        </>
                    ) : canMarkWps ? (
                        <>
                            <button type="button" className="spcc-btn spcc-btn--ghost" onClick={onClose}>
                                Close
                            </button>
                            <button
                                type="button"
                                className="spcc-btn spcc-btn--primary"
                                disabled={saving}
                                onClick={onWpsUpdated}
                            >
                                WPS updated
                            </button>
                        </>
                    ) : canSetUpdated ? (
                        <>
                            <button type="button" className="spcc-btn spcc-btn--ghost" onClick={onClose}>
                                Close
                            </button>
                            <button
                                type="button"
                                className="spcc-btn spcc-btn--primary"
                                disabled={saving}
                                onClick={onUpdatePayment}
                            >
                                Update payment
                            </button>
                        </>
                    ) : (
                        <button type="button" className="spcc-btn spcc-btn--ghost" onClick={onClose}>
                            Close
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}


function isPayrollFineItem(item) {
    const key = String(item?.id || '');
    const title = String(item?.title || '');
    const path = String(item?.path || '');
    if (key.startsWith('fine-')) return true;
    if (/fine/i.test(title) && !key.startsWith('hub-') && !key.startsWith('loan-')) return true;
    return /^\/HRM\/Fine(\/|\?|$)/i.test(path);
}

function payrollFineListHref(item) {
    const focusFine = String(item?.fineId || item?.requestId || '').trim();
    return buildFineListPath({
        status: 'Pending',
        tab: item?.isGroup ? 'group' : 'individual',
        ...(focusFine ? { focusFine } : {}),
    });
}

function blockerTaskPath(item) {
    const explicit = String(item?.path || '').trim();
    if (explicit.startsWith('/')) return explicit;
    const id = String(item?.employeeId || '').trim();
    const mongoId = String(item?.mongoId || '').trim();
    const key = String(item?.id || '');
    const category = String(item?.category || '');
    if (key.startsWith('fine-') || isPayrollFineItem(item)) {
        const fineId = String(item?.requestId || '').trim();
        if (fineId) return `/HRM/Fine/${encodeURIComponent(fineId)}`;
        return payrollFineListHref(item);
    }
    if (key.startsWith('hub-')) {
        const hubId = key.slice(4);
        return hubId ? `/dashboard?hubRequestId=${encodeURIComponent(hubId)}` : '/dashboard';
    }
    if (key.startsWith('loan-')) {
        const loanId = key.slice(5);
        return loanId ? `/HRM/LoanAndAdvance/${encodeURIComponent(loanId)}` : '/HRM/LoanAndAdvance';
    }
    if (key.startsWith('asset-') || category === 'asset') return '/HRM/Asset';
    if (key.startsWith('util-')) return '/HRM/Asset/UtilityBills';
    if (category === 'finance') return '/HRM/LoanAndAdvance';
    if (category === 'attendance' || category === 'leave' || category === 'overtime' || category === 'compoff') {
        if (mongoId) {
            const month = String(item?.monthKey || '').trim();
            return `/HRM/Leave/${encodeURIComponent(mongoId)}${month ? `?month=${encodeURIComponent(month)}` : ''}`;
        }
        return '/HRM/Leave';
    }
    return id ? `/HRM/Salary/enroll/${encodeURIComponent(id)}` : '/HRM/Salary';
}

function inferResponsibleRole(item) {
    const detail = `${item?.detail || ''} ${item?.title || ''}`;
    if (/not marked/i.test(detail)) return 'Employee';
    if (/account|finance/i.test(detail)) return 'Accounts';
    if (/authoriz|management/i.test(detail)) return 'Management';
    if (/pending hr|review|\bhr\b/i.test(detail)) return 'HR';
    if (item?.category === 'leave' || item?.category === 'compoff') return 'Manager';
    if (item?.category === 'finance') return 'HR';
    return '';
}

function formatWaiting(value) {
    const date = value instanceof Date ? value : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '—';
    const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today - start) / 86400000);
    if (!Number.isFinite(days) || days < 0) return '—';
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
}

function blockerResponsibleName(item) {
    const name = String(item?.responsibleName || '').trim();
    if (name && name !== '—') return name;
    return inferResponsibleRole(item) || '—';
}

function blockerResponsibleRole(item) {
    const role = String(item?.responsibleRole || '').trim();
    if (role && role !== '—') return role;
    return inferResponsibleRole(item) || '—';
}

function blockerResponsibleDisplay(item) {
    const role = blockerResponsibleRole(item);
    const raw = String(item?.responsibleName || '').trim();
    const roleKey = String(role || '').trim().toLowerCase();
    const nameIsRole =
        !raw ||
        raw === '—' ||
        raw.toLowerCase() === roleKey ||
        /^(hr|hod|management|accounts|approver|employee|manager)$/i.test(raw);
    const firstName = nameIsRole ? '' : raw.split(/\s+/)[0];
    if (firstName && role && role !== '—') return `${firstName} (${role})`;
    if (firstName) return firstName;
    if (role && role !== '—') return role;
    return '—';
}

function employeePendingStatusLabel(items) {
    const owners = [];
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
        const label = blockerResponsibleDisplay(item);
        if (!label || label === '—') continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        owners.push(label);
    }
    if (!owners.length) return 'Pending';
    if (owners.length === 1) return `Pending for ${owners[0]}`;
    return `Pending for ${owners[0]} +${owners.length - 1}`;
}

function blockerReviewHref(item) {
    const path = String(item?.path || '').trim();
    if (path.startsWith('/')) return path;
    return blockerTaskPath(item);
}

function blockerDue(item) {
    const label = String(item?.waitingLabel || '').trim();
    if (label && label !== '—') return label;
    return formatWaiting(item?.notifiedAt || item?.dateKey || item?.date);
}

function blockerDueDate(item) {
    const raw = item?.notifiedAt || item?.dateKey || item?.date;
    const date = raw instanceof Date ? raw : raw ? new Date(raw) : null;
    if (date && !Number.isNaN(date.getTime())) return formatShortDayMonth(date);
    return blockerDue(item);
}

function blockerPendingCondition(item) {
    const title = String(item?.title || '').trim();
    if (title) return title;
    return formatRequestDetail(item?.detail) || 'Pending task';
}

function PayrollBlockersModal({
    open,
    monthLabel,
    requests,
    employeeName,
    sending,
    listReturnHref,
    onClose,
    onSendReminders,
}) {
    const router = useRouter();
    if (!open || typeof document === 'undefined') return null;

    const visible = Array.isArray(requests) ? requests : [];
    const scopeBits = employeeName
        ? [monthLabel, employeeName]
        : [monthLabel, 'Grouped by responsible approver'];

    return createPortal(
        <div className="spcc-modal">
            <button type="button" className="spcc-modal__backdrop" onClick={onClose} aria-label="Close" />
            <div
                className="spcc-modal__panel spcc-blockers"
                role="dialog"
                aria-modal="true"
                aria-labelledby="spcc-blockers-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="spcc-blockers__head">
                    <div>
                        <p className="spcc-blockers__kicker">Payroll blockers</p>
                        <h3 id="spcc-blockers-title" className="spcc-blockers__title">
                            {visible.length} pending item{visible.length === 1 ? '' : 's'}
                        </h3>
                        <p className="spcc-blockers__sub">{scopeBits.filter(Boolean).join(' · ')}</p>
                    </div>
                    <button type="button" className="spcc-blockers__close" onClick={onClose} aria-label="Close">
                        <X size={14} />
                    </button>
                </div>

                <div className="spcc-blockers__table" role="table" aria-label="Pending payroll tasks">
                    <div className="spcc-blockers__row spcc-blockers__row--head" role="row">
                        <span>Employee</span>
                        <span>Pending condition</span>
                        <span>Responsible</span>
                        <span>Due</span>
                        <span />
                    </div>
                    {visible.length ? (
                        visible.map((item) => (
                            <div key={item.id} className="spcc-blockers__row" role="row">
                                <span className="spcc-pay-name">
                                    <span>{item.name || item.employeeId}</span>
                                    <span className="spcc-pay-id">{item.employeeId}</span>
                                </span>
                                <span className="spcc-blockers__task">{blockerPendingCondition(item)}</span>
                                <span className="spcc-blockers__owner">{blockerResponsibleDisplay(item)}</span>
                                <span className="spcc-blockers__due">{blockerDueDate(item)}</span>
                                <span>
                                    <Link
                                        href={blockerReviewHref(item)}
                                        className="spcc-blockers__review"
                                        onClick={(event) =>
                                            handleNavigateFromListClick(
                                                event,
                                                router,
                                                blockerReviewHref(item),
                                                listReturnHref,
                                            )
                                        }
                                    >
                                        Review
                                    </Link>
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="spcc-pay-empty">
                            {employeeName
                                ? `No pending items for ${employeeName} in this view.`
                                : 'No pending items in this group.'}
                        </p>
                    )}
                </div>

                <div className="spcc-blockers__foot">
                    <p className="spcc-blockers__note">
                        <Info size={13} strokeWidth={2.2} />
                        Payroll remains blocked until every mandatory item is completed.
                    </p>
                    <div className="spcc-blockers__actions">
                        <button type="button" className="spcc-btn spcc-btn--ghost" onClick={onClose}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="spcc-btn spcc-btn--primary spcc-blockers__remind"
                            disabled={!visible.length || sending}
                            onClick={() => onSendReminders(visible)}
                        >
                            {sending ? 'Sending…' : 'Send reminders'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

export default function SalaryMonthControlCentre({ monthKey }) {
    const router = useRouter();
    const { toast } = useToast();
    const { locations } = useWorkLocations();
    const parsed = useMemo(() => parseMonthKey(monthKey), [monthKey]);
    const [tab, setTab] = useState(ALL_TAB_KEY);
    const [tabMode, setTabMode] = useState(TAB_MODE_COMPANY);
    const [blockersOpen, setBlockersOpen] = useState(false);
    const [blockerFilter, setBlockerFilter] = useState('');
    const [blockerEmployeeId, setBlockerEmployeeId] = useState('');
    const [readinessEmployeeId, setReadinessEmployeeId] = useState('');
    const [readinessAnchorId, setReadinessAnchorId] = useState('');
    const [readinessShift, setReadinessShift] = useState(0);
    const payTableRef = useRef(null);
    const sideColRef = useRef(null);
    const [payrollSort, setPayrollSort] = useState({ key: 'name', dir: 'asc' });
    const [sendingReminders, setSendingReminders] = useState(false);
    const [groupPolicies, setGroupPolicies] = useState({});
    const [loading, setLoading] = useState(true);
    const [policy, setPolicy] = useState(null);
    const [register, setRegister] = useState(null);
    const [monthDmf, setMonthDmf] = useState(null);
    const [approvalPrompt, setApprovalPrompt] = useState(false);
    const [paymentBatches, setPaymentBatches] = useState([]);
    const [slotEditor, setSlotEditor] = useState(null);
    const [savingPayment, setSavingPayment] = useState(false);
    const [excelBusy, setExcelBusy] = useState(false);
    const [zohoOpen, setZohoOpen] = useState(false);
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [activeSlot, setActiveSlot] = useState(1);
    const openedSlotRef = useRef('');

    const load = useCallback(async () => {
        if (!parsed) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [policyRes, registerRes, dmfRes] = await Promise.all([
                axiosInstance.get('/Employee/payroll-settings', { skipToast: true }).catch(() => null),
                axiosInstance
                    .get(`/Employee/salary-register/${parsed.monthKey}`, { skipToast: true })
                    .catch(() => null),
                axiosInstance
                    .get(`/Employee/salary-register/${parsed.monthKey}/dmf`, { skipToast: true })
                    .catch(() => null),
            ]);

            setPolicy(policyRes?.data ? policyFormFromApi(policyRes.data) : null);
            const data = registerRes?.data || null;
            setRegister(data);
            setMonthDmf(dmfRes?.data?.dmf || data?.dmf || null);
            setPaymentBatches((data?.payments || []).map(paymentBatchFromApi).filter(Boolean));
        } finally {
            setLoading(false);
        }
    }, [parsed]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setPaymentBatches([]);
        setMonthDmf(null);
        setApprovalPrompt(false);
        setSlotEditor(null);
        setSavingPayment(false);
        setExcelBusy(false);
        setZohoOpen(false);
        setExpenseOpen(false);
        openedSlotRef.current = '';
        setBlockersOpen(false);
        setBlockerFilter('');
        setBlockerEmployeeId('');
        setReadinessEmployeeId('');
        setReadinessAnchorId('');
        setTab(ALL_TAB_KEY);
        setTabMode(TAB_MODE_COMPANY);
    }, [parsed?.monthKey]);

    const monthLabel = parsed ? `${MONTH_FULL[parsed.monthIndex]} ${parsed.year}` : '—';

    const derived = useMemo(() => {
        if (!parsed) {
            return {
                totalEmployees: 0,
                enrolledCount: 0,
                enrolledSalary: 0,
                totalSalary: 0,
                wpsEnrolled: 0,
                cashEnrolled: 0,
                companyCards: [],
                locationCards: [],
                employees: [],
                pendingRequests: [],
            };
        }

        const overview = register?.enrollmentOverview || {};
        const overviewLocations = Array.isArray(overview.workLocations) ? overview.workLocations : [];
        const catalog = (locations || []).length ? locations : FALLBACK_WORK_LOCATIONS;
        const seen = new Set();
        const locationStats = [];

        const pushLocation = (row) => {
            const key = normalizeWorkLocationKey(row?.key);
            if (!key || seen.has(key)) return;
            seen.add(key);
            const fromApi = overviewLocations.find((item) => normalizeWorkLocationKey(item.key) === key);
            locationStats.push({
                key,
                label: displayGroupLabel(row.label || fromApi?.label || workLocationLabel(key, catalog)),
                totalActive: Number(fromApi?.totalActive) || 0,
                enrolled: Number(fromApi?.enrolled) || 0,
                salaryProcessingDate: fromApi?.salaryProcessingDate || policy?.salaryProcessingDate,
                policyForm: fromApi?.policy ? policyFormFromApi(fromApi.policy) : null,
                policySource: fromApi?.policySource || 'main',
            });
        };

        (overviewLocations.length ? overviewLocations : catalog).forEach(pushLocation);
        catalog.forEach(pushLocation);

        const locationCards = locationStats.map((loc, index) => {
            const locDay =
                Number(toPayrollMonthDay(loc.salaryProcessingDate)) ||
                Number(toPayrollMonthDay(policy?.salaryProcessingDate)) ||
                1;
            return {
                ...loc,
                code: locationCode(loc.label),
                codeTone: LOCATION_CODE_TONES[index % LOCATION_CODE_TONES.length],
                salaryDate: dateInMonth(parsed.year, parsed.monthIndex, locDay),
            };
        });

        const totalEmployees =
            Number(overview.totalActive) ||
            locationCards.reduce((sum, loc) => sum + loc.totalActive, 0);
        const enrolledCount = Number(overview.enrolled) || Number(register?.enrolledCount) || 0;
        const employees = (Array.isArray(overview.employees) ? overview.employees : []).filter((emp) =>
            enrolledForSalaryMonth(emp, parsed.monthKey),
        );
        const pendingRequests = Array.isArray(overview.pendingRequests) ? overview.pendingRequests : [];
        const enrolledEmployees = employees.filter((emp) => emp.enrolled);
        const enrolledSalary = Number(overview.enrolledSalary);
        const totalSalary = Number(overview.totalSalary);
        const wpsEnrolled = Number.isFinite(Number(overview.wpsEnrolled))
            ? Number(overview.wpsEnrolled)
            : enrolledEmployees.filter((emp) => emp.isWps).length;
        const cashEnrolled = Number.isFinite(Number(overview.cashEnrolled))
            ? Number(overview.cashEnrolled)
            : enrolledEmployees.filter((emp) => emp.enrolled && !emp.isWps).length;

        return {
            totalEmployees,
            enrolledCount,
            enrolledSalary: Number.isFinite(enrolledSalary)
                ? enrolledSalary
                : enrolledEmployees.reduce((sum, emp) => sum + (Number(emp.monthlySalary) || 0), 0),
            totalSalary: Number.isFinite(totalSalary)
                ? totalSalary
                : employees.reduce((sum, emp) => sum + (Number(emp.monthlySalary) || 0), 0),
            wpsEnrolled,
            cashEnrolled,
            companyCards: (Array.isArray(overview.companies) ? overview.companies : []).filter(
                (row) => Number(row.totalActive) > 0 || Number(row.enrolled) > 0,
            ),
            locationCards,
            employees,
            pendingRequests,
        };
    }, [parsed, policy, register, locations]);

    const monthRoster = useMemo(() => {
        const overviewById = new Map();
        for (const emp of derived.employees || []) {
            const key = employeeIdKey(emp.employeeId);
            if (key) overviewById.set(key, emp);
        }
        return (Array.isArray(register?.employees) ? register.employees : [])
            .filter((emp) => enrolledForSalaryMonth(emp, parsed?.monthKey))
            .map((month) => {
                const overview = overviewById.get(employeeIdKey(month.employeeId)) || {};
                const companyName =
                    month.companyName && month.companyName !== '—'
                        ? month.companyName
                        : overview.companyName;
                return {
                    ...overview,
                    ...month,
                    name: month.name || overview.name,
                    companyName,
                    staffType: month.staffType || overview.staffType,
                    isWps:
                        month.isWps === true ||
                        overview.isWps === true ||
                        String(month.paymentType || overview.paymentType || '').toUpperCase() === 'WPS',
                    paymentType: month.paymentType || overview.paymentType,
                    companyMolCode: month.companyMolCode || overview.companyMolCode,
                    enrolled: true,
                    enrolledForMonth: true,
                    extra: Number(month.extra ?? month.ot) || 0,
                };
            });
    }, [derived.employees, register?.employees, parsed?.monthKey]);

    const tabItems = useMemo(() => {
        const employeeCount = monthRoster.length;
        if (tabMode === TAB_MODE_COMPANY) {
            const companies = uniqueCompanyNames(monthRoster.map((emp) => emp.companyName));
            const counts = new Map();
            for (const emp of monthRoster) {
                const key = companyKeyOf(emp).toLowerCase();
                counts.set(key, (counts.get(key) || 0) + 1);
            }
            return [
                { key: ALL_TAB_KEY, label: 'All employees', count: employeeCount },
                ...companies.map((name) => ({
                    key: toCompanyTabKey(name),
                    label: name,
                    count: counts.get(name.toLowerCase()) || 0,
                })),
            ];
        }
        const groupCounts = new Map();
        for (const emp of monthRoster) {
            const key = normalizeWorkLocationKey(emp.staffType);
            groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
        }
        return [
            { key: ALL_TAB_KEY, label: 'All employees', count: employeeCount },
            ...derived.locationCards.map((loc) => ({
                key: loc.key,
                label: loc.label,
                count: groupCounts.get(loc.key) || 0,
            })),
        ];
    }, [tabMode, derived.locationCards, monthRoster]);

    const excelGroups = useMemo(() => {
        const counts = new Map();
        for (const emp of monthRoster) {
            const key = normalizeWorkLocationKey(emp.staffType);
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        const labels = new Map(
            derived.locationCards.map((loc) => [loc.key, displayGroupLabel(loc.label)]),
        );
        return [...counts.entries()]
            .map(([key, count]) => ({
                id: key,
                label: labels.get(key) || displayGroupLabel(String(key || 'Group').replace(/-/g, ' ')),
                count,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }, [monthRoster, derived.locationCards]);

    const excelCompanies = useMemo(() => {
        const counts = new Map();
        for (const emp of monthRoster) {
            const name = companyKeyOf(emp);
            const key = name.toLowerCase();
            const current = counts.get(key) || { id: name, label: name, count: 0 };
            current.count += 1;
            counts.set(key, current);
        }
        return [...counts.values()].sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
        );
    }, [monthRoster]);

    const locationKeysSig = useMemo(
        () => derived.locationCards.map((loc) => loc.key).join('|'),
        [derived.locationCards],
    );

    useEffect(() => {
        const keys = locationKeysSig ? locationKeysSig.split('|').filter(Boolean) : [];
        if (!keys.length) return undefined;
        let cancelled = false;
        (async () => {
            const pairs = await Promise.all(
                keys.map(async (key) => {
                    try {
                        const res = await axiosInstance.get(
                            `/Employee/payroll-settings/group/${encodeURIComponent(key)}`,
                            { skipToast: true },
                        );
                        return [key, policyFormFromApi(res.data)];
                    } catch {
                        return [key, null];
                    }
                }),
            );
            if (!cancelled) setGroupPolicies(Object.fromEntries(pairs));
        })();
        return () => {
            cancelled = true;
        };
    }, [locationKeysSig]);

    useEffect(() => {
        if (tab === ALL_TAB_KEY) return;
        if (tabItems.some((item) => item.key === tab)) return;
        const companyName = fromCompanyTabKey(tab);
        const match = companyName
            ? tabItems.find((item) => sameCompany(fromCompanyTabKey(item.key) || item.label, companyName))
            : null;
        if (match) {
            setTab(match.key);
            return;
        }
        setTab(ALL_TAB_KEY);
    }, [tab, tabItems]);

    const view = useMemo(() => {
        const companyName = tabMode === TAB_MODE_COMPANY ? fromCompanyTabKey(tab) : '';
        const focus =
            tabMode === TAB_MODE_GROUP && tab !== ALL_TAB_KEY
                ? derived.locationCards.find((loc) => loc.key === tab) || null
                : null;
        const groupPolicy = focus
            ? groupPolicies[focus.key] || focus.policyForm || null
            : null;
        const activePolicy = focus ? groupPolicy || policy : policy;
        const cycle = cycleFromPolicy(activePolicy, parsed);
        const salaryDateRows = (focus ? [focus] : derived.locationCards).map((loc) => {
            const locDay =
                Number(toPayrollMonthDay(loc.salaryProcessingDate || loc.policyForm?.salaryProcessingDate)) ||
                cycle.processDay;
            return {
                key: loc.key,
                label: loc.label,
                salaryDate: parsed ? dateInMonth(parsed.year, parsed.monthIndex, locDay) : loc.salaryDate,
            };
        });
        const employees =
            tab === ALL_TAB_KEY
                ? monthRoster
                : tabMode === TAB_MODE_COMPANY
                    ? monthRoster.filter((emp) => sameCompany(companyKeyOf(emp), companyName))
                    : monthRoster.filter((emp) => normalizeWorkLocationKey(emp.staffType) === tab);
        const enrolledCount = employees.filter((emp) => emp.enrolled !== false).length;
        const employeeIds = new Set(employees.map((emp) => employeeIdKey(emp.employeeId)).filter(Boolean));
        const pendingRequests = derived.pendingRequests.filter((row) =>
            employeeIds.has(employeeIdKey(row.employeeId)),
        );
        const pendingByEmployee = {};
        const requestCountByEmployee = {};
        for (const row of pendingRequests) {
            const key = employeeIdKey(row.employeeId);
            if (!key) continue;
            const enrolled = employees.find((emp) => employeeIdKey(emp.employeeId) === key);
            const subject = String(enrolled?.employeeId || row.employeeId || '').trim();
            if (!subject) continue;
            if (!pendingByEmployee[subject]) pendingByEmployee[subject] = [];
            pendingByEmployee[subject].push({
                ...row,
                employeeId: subject,
                name: enrolled?.name || row.name,
            });
            requestCountByEmployee[subject] = (requestCountByEmployee[subject] || 0) + 1;
        }

        const groupLabel = companyName || (focus ? focus.label : 'All employees');

        return {
            focus,
            cycle,
            salaryDateRows,
            employees,
            enrolledCount,
            pendingRequests,
            pendingByEmployee,
            requestCountByEmployee,
            groupLabel,
            settingsHref: focus ? '/HRM/Salary/enroll' : '/HRM/Salary/salary-policy',
            settingsLabel: focus ? 'Edit group settings' : 'Edit settings',
            employeeCount: employees.length,
        };
    }, [tab, tabMode, derived, policy, parsed, groupPolicies, monthRoster]);

    const readinessChecks = useMemo(() => {
        const enrolled = (view.employees || []).filter((emp) => emp.enrolled !== false);
        const enrolledIds = new Set(enrolled.map((emp) => employeeIdKey(emp.employeeId)).filter(Boolean));
        const requests = (Array.isArray(view.pendingRequests) ? view.pendingRequests : []).filter((item) =>
            enrolledIds.has(employeeIdKey(item.employeeId)),
        );
        const counts = REQUEST_CATEGORIES.reduce((acc, row) => {
            acc[row.key] = requests.filter((item) => item.category === row.key).length;
            return acc;
        }, {});
        const pendingEmployeeIds = new Set(
            requests.map((item) => employeeIdKey(item.employeeId)).filter(Boolean),
        );
        const totalEmployees = enrolled.length || Math.max(Number(view.enrolledCount) || 0, 0);
        const pendingPeople = enrolled.length
            ? enrolled.filter((emp) => pendingEmployeeIds.has(employeeIdKey(emp.employeeId))).length
            : pendingEmployeeIds.size;
        const attendanceDone = Math.max(totalEmployees - pendingPeople, 0);
        const rows = REQUEST_CATEGORIES.map((meta) => {
            const pending = counts[meta.key] || 0;
            const done = pending === 0;
            return {
                id: meta.key,
                tone: done ? 'ok' : meta.alert ? 'alert' : 'warn',
                title: meta.title,
                detail:
                    meta.key === 'attendance'
                        ? `${attendanceDone}/${totalEmployees || attendanceDone + pendingPeople} clear`
                        : meta.detail,
                badge: done ? 'Done' : `${pending} pending`,
                badgeTone: done ? 'ok' : meta.alert ? 'alert' : 'warn',
            };
        });
        const pendingApprovals = requests.length;
        const doneCount = Math.max(totalEmployees - pendingPeople, 0);
        const percent =
            totalEmployees > 0 && pendingApprovals === 0
                ? 100
                : totalEmployees
                    ? Math.round((doneCount / totalEmployees) * 100)
                    : 0;

        return {
            percent,
            rows,
            pendingApprovals,
            categories: REQUEST_CATEGORIES.length,
            statusLabel: monthPayrollProcessStatusLabel(monthDmf),
            doneCount,
            requests,
        };
    }, [view.employees, view.enrolledCount, view.pendingRequests, monthDmf]);

    const readinessPeople = useMemo(() => {
        const byEmp = view.pendingByEmployee || {};
        const employees = Array.isArray(view.employees) ? view.employees : [];
        const rows = Object.entries(byEmp)
            .map(([employeeId, items]) => {
                const list = Array.isArray(items) ? items : [];
                if (!list.length) return null;
                const first = list[0] || {};
                const emp = employees.find((row) => String(row.employeeId || '').trim() === employeeId);
                return {
                    id: employeeId,
                    name: first.name || emp?.name || employeeId,
                    pending: list.length,
                    due: list.filter(itemIsDue).length,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.due - a.due || b.pending - a.pending || a.name.localeCompare(b.name));
        return {
            total: rows.length,
            preview: rows.slice(0, SIDEBAR_EMPLOYEE_LIMIT),
            extra: Math.max(0, rows.length - SIDEBAR_EMPLOYEE_LIMIT),
        };
    }, [view.pendingByEmployee, view.employees]);

    const readinessEmployeeName = useMemo(() => {
        const id = String(readinessEmployeeId || '').trim();
        if (!id) return '';
        const fromEmp = monthRoster.find((emp) => String(emp.employeeId || '').trim() === id);
        if (fromEmp?.name) return fromEmp.name;
        const fromPending = (view.pendingByEmployee?.[id] || [])[0];
        return fromPending?.name || id;
    }, [readinessEmployeeId, monthRoster, view.pendingByEmployee]);

    const readinessEmployeeItems = useMemo(() => {
        const id = String(readinessEmployeeId || '').trim();
        if (!id) return [];
        return Array.isArray(view.pendingByEmployee?.[id]) ? view.pendingByEmployee[id] : [];
    }, [readinessEmployeeId, view.pendingByEmployee]);

    useEffect(() => {
        setReadinessEmployeeId('');
        setReadinessAnchorId('');
    }, [tab, tabMode]);

    const blockerRequests = useMemo(() => {
        const rows = Array.isArray(readinessChecks.requests) ? readinessChecks.requests : [];
        if (!blockerEmployeeId) return rows;
        const selected = String(blockerEmployeeId);
        return rows.filter((item) => String(item.employeeId || '').trim() === selected);
    }, [blockerEmployeeId, readinessChecks.requests]);

    const blockerEmployeeName = useMemo(() => {
        if (!blockerEmployeeId) return '';
        const fromRequest = blockerRequests.find(
            (item) => String(item.employeeId || '').trim() === String(blockerEmployeeId),
        );
        if (fromRequest?.name) return fromRequest.name;
        const fromEmp = monthRoster.find(
            (emp) => String(emp.employeeId || '') === String(blockerEmployeeId),
        );
        return fromEmp?.name || blockerEmployeeId;
    }, [blockerEmployeeId, blockerRequests, monthRoster]);

    const payrollRows = useMemo(() => {
        const companyName = tabMode === TAB_MODE_COMPANY ? fromCompanyTabKey(tab) : '';
        return monthRoster.filter((emp) => {
            if (tab === ALL_TAB_KEY) return true;
            if (tabMode === TAB_MODE_COMPANY) return sameCompany(companyKeyOf(emp), companyName);
            return normalizeWorkLocationKey(emp.staffType) === tab;
        });
    }, [monthRoster, tab, tabMode]);

    const cardStats = useMemo(() => {
        let salaryGross = 0;
        let salaryNet = 0;
        let deduction = 0;
        let extra = 0;
        let wpsCount = 0;
        let wpsAmount = 0;
        let cashCount = 0;
        let cashAmount = 0;
        for (const emp of payrollRows) {
            const monthly = Number(emp.monthlySalary) || 0;
            const net = Number(emp.actualSalary ?? emp.monthlySalary) || 0;
            const hasSlipSplit = emp.lossOfPay != null || emp.otherDeduction != null;
            const lossOfPay = Number(emp.lossOfPay) || 0;
            const otherDeduction = Number(emp.otherDeduction) || 0;
            const employeeGross = hasSlipSplit ? monthly - lossOfPay : monthly;
            const employeeNet = hasSlipSplit ? employeeGross - otherDeduction : net;
            salaryGross += employeeGross;
            salaryNet += employeeNet;
            deduction += Number(emp.deduction) || 0;
            extra += employeeExtra(emp);
            if (employeePayMethod(emp) === 'WPS') {
                wpsCount += 1;
                wpsAmount += net;
            } else {
                cashCount += 1;
                cashAmount += net;
            }
        }
        return {
            enrolled: payrollRows.length,
            salaryGross,
            salaryNet,
            wpsCount,
            wpsAmount,
            cashCount,
            cashAmount,
            deduction,
            extra,
        };
    }, [payrollRows]);

    const paymentEmployees = monthRoster;

    const processedPaymentIds = useMemo(() => {
        const ids = new Set();
        for (const batch of paymentBatches) {
            if (!batch.processed) continue;
            for (const id of batch.selectedIds || []) ids.add(String(id));
        }
        return ids;
    }, [paymentBatches]);

    const sortedPayrollRows = useMemo(
        () =>
            [...payrollRows].sort((a, b) =>
                comparePayrollRow(a, b, payrollSort.key, payrollSort.dir, processedPaymentIds),
            ),
        [payrollRows, payrollSort, processedPaymentIds],
    );

    const placeReadinessCard = useCallback((employeeId) => {
        const side = sideColRef.current;
        const id = String(employeeId || '').trim();
        if (!side || !id) {
            setReadinessShift(0);
            return;
        }
        const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
        const row = payTableRef.current?.querySelector(`[data-pay-employee="${safeId}"]`);
        const slot = side.querySelector('.spcc-slot-rows');
        if (!row || !slot) {
            setReadinessShift(0);
            return;
        }
        const sideTop = side.getBoundingClientRect().top;
        const slotBottom = slot.getBoundingClientRect().bottom - sideTop;
        const rowTop = row.getBoundingClientRect().top - sideTop;
        const next = Math.max(0, Math.round(rowTop - slotBottom - 12));
        setReadinessShift((current) => (current === next ? current : next));
    }, []);

    useLayoutEffect(() => {
        placeReadinessCard(readinessAnchorId);
    }, [placeReadinessCard, readinessAnchorId, sortedPayrollRows]);

    useEffect(() => {
        if (!readinessAnchorId) return undefined;
        const onResize = () => placeReadinessCard(readinessAnchorId);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [placeReadinessCard, readinessAnchorId]);

    function claimedElsewhere(batchId) {
        const ids = new Set();
        for (const batch of paymentBatches) {
            if (batch.id === batchId || batch.status === 'cancelled') continue;
            for (const id of batch.selectedIds || []) {
                const key = employeeIdKey(id);
                if (key) ids.add(key);
            }
        }
        return ids;
    }

    function openNewSlot() {
        if (!monthDmf?.canCreateSlot) {
            toast({
                title: 'Create slot is locked',
                description: 'Create slot opens after Management approves, and only for the flowchart Accounts assignee.',
            });
            return;
        }
        const enrolled = monthRoster.filter((emp) => employeeIdKey(emp.employeeId));
        if (!enrolled.length) return;
        const held = new Set();
        for (const batch of paymentBatches) {
            if (batch.status === 'cancelled') continue;
            for (const id of batch.selectedIds || []) {
                const key = employeeIdKey(id);
                if (key) held.add(key);
            }
        }
        const everyoneSlotted =
            enrolled.length > 0 && enrolled.every((emp) => held.has(employeeIdKey(emp.employeeId)));
        if (everyoneSlotted) {
            toast({
                title: 'Create slot is disabled',
                description: 'Every enrolled employee is already in a slot for this month.',
            });
            return;
        }
        const last = paymentBatches.reduce((max, batch) => Math.max(max, Number(batch.paymentNo) || 0), 0);
        setSlotEditor({
            id: '',
            slot: last + 1,
            companyName: '',
            selectedIds: [],
            status: 'new',
            paymentMethod: '',
            rejectReason: '',
        });
    }

    useEffect(() => {
        if (loading || typeof window === 'undefined') return;
        const id = String(new URLSearchParams(window.location.search).get('slot') || '').trim();
        if (!id || openedSlotRef.current === id) return;
        const batch = paymentBatches.find((item) => item.id === id);
        if (!batch) return;
        openedSlotRef.current = id;
        setActiveSlot(Number(batch.paymentNo) || 1);
        setSlotEditor({
            id: batch.id,
            slot: Number(batch.paymentNo) || 1,
            companyName: batch.companyName || '',
            selectedIds: [...(batch.selectedIds || [])],
            status: batch.status || 'approved',
            paymentMethod: batch.paymentMethod || '',
            rejectReason: batch.rejectReason || '',
        });
    }, [loading, paymentBatches]);

    function openSavedSlot(item) {
        if (!item?.batch) return;
        setActiveSlot(item.slot);
        setSlotEditor({
            id: item.batch.id,
            slot: item.slot,
            companyName: item.companyName || item.batch.companyName || '',
            selectedIds: [...(item.batch.selectedIds || [])],
            status: item.status || 'approved',
            paymentMethod: item.paymentMethod || item.batch.paymentMethod || '',
            rejectReason: item.rejectReason || item.batch.rejectReason || '',
        });
    }

    async function saveSlot(action, extra = {}) {
        if (!parsed?.monthKey || !slotEditor || savingPayment) return;
        const allowedIds = new Set(
            (paymentEmployees || []).map((emp) => String(emp.employeeId || '')).filter(Boolean),
        );
        const selectedIds = (slotEditor.selectedIds || [])
            .map((id) => String(id || ''))
            .filter((id) => allowedIds.has(id));
        if ((action === 'draft' || action === 'apply') && (!slotEditor.companyName || !selectedIds.length)) return;
        setSavingPayment(true);
        try {
            const path = slotEditor.id
                ? `/Employee/salary-register/${parsed.monthKey}/payments/${slotEditor.id}`
                : `/Employee/salary-register/${parsed.monthKey}/payments`;
            const res = await axiosInstance.post(path, {
                action,
                employeeIds: selectedIds,
                companyName: slotEditor.companyName,
                reason: extra.reason || '',
            });
            const saved = paymentBatchFromApi(res.data?.payment);
            setPaymentBatches((prev) => {
                const dropId = slotEditor.id;
                const rest = prev.filter((item) => item.id !== dropId && item.id !== saved?.id);
                return saved ? [...rest, saved] : rest;
            });
            if (saved?.paymentNo) setActiveSlot(saved.paymentNo);
            setSlotEditor(null);
            toast({ title: res.data?.message || 'Slot saved' });
        } catch (error) {
            toast({
                title: 'Could not save slot',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setSavingPayment(false);
        }
    }

    async function downloadSlotExcel() {
        if (!parsed?.monthKey || !slotEditor?.id || excelBusy) return;
        setExcelBusy(true);
        try {
            const res = await axiosInstance.get(
                `/Employee/salary-register/${parsed.monthKey}/payments/${slotEditor.id}/excel`,
                { responseType: 'blob', skipToast: true },
            );
            const blob = res.data;
            const header = String(res.headers?.['content-disposition'] || res.headers?.get?.('content-disposition') || '');
            const match = /filename="?([^"]+)"?/i.exec(header);
            const filename = decodeURIComponent(match?.[1] || 'payroll.xlsx');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            let description = 'Could not open the Excel.';
            const data = error?.response?.data;
            if (data && typeof data.text === 'function') {
                try {
                    const parsedError = JSON.parse(await data.text());
                    if (parsedError?.message) description = parsedError.message;
                } catch {
                    description = 'Could not open the Excel.';
                }
            }
            toast({ title: 'Excel', description });
        } finally {
            setExcelBusy(false);
        }
    }

    async function handleValidate() {
        if (!parsed?.monthKey) return;
        if (!monthDmf?.canAct && !monthDmf?.canStart) return;
        const beforeIds = new Set(
            (Array.isArray(register?.enrollmentOverview?.pendingRequests)
                ? register.enrollmentOverview.pendingRequests
                : []
            )
                .map((row) => String(row.employeeId || '').trim())
                .filter(Boolean),
        );
        try {
            const registerRes = await axiosInstance.get(`/Employee/salary-register/${parsed.monthKey}`, {
                skipToast: true,
            });
            const data = registerRes?.data || null;
            if (!data) {
                toast({
                    title: 'Could not validate payroll',
                    description: 'Try again in a moment.',
                });
                return;
            }
            setRegister(data);
            setPaymentBatches((data.payments || []).map(paymentBatchFromApi).filter(Boolean));
            const pending = Array.isArray(data.enrollmentOverview?.pendingRequests)
                ? data.enrollmentOverview.pendingRequests
                : [];
            const afterIds = new Set(
                pending.map((row) => String(row.employeeId || '').trim()).filter(Boolean),
            );
            const completed = [...beforeIds].filter((id) => !afterIds.has(id)).length;
            const stillPending = afterIds.size;
            const enrolled = Number(data.enrollmentOverview?.enrolled) || 0;
            const isClear = enrolled > 0 && pending.length === 0;
            const payrollLabel = monthPayrollProcessStatusLabel(monthDmf);

            if (isClear) {
                if (dmfStatus === 'idle' || dmfStatus === 'rejected' || !dmfStatus) {
                    toast({
                        title: 'Payroll is 100% ready',
                        description: monthDmf?.canStart
                            ? 'Click Submit. HR gets an email with a link to this payroll, then Management. Create slot opens after Management approves.'
                            : 'Submit is with the flowchart Accounts assignee.',
                    });
                    return;
                }
                if (dmfStatus === 'pending') {
                    toast({
                        title: payrollLabel,
                        description: 'Email and notification are with the current approver. Slots open after Processed.',
                    });
                    return;
                }
                toast({
                    title: 'Processed',
                    description: monthDmf?.canCreateSlot
                        ? 'Create slot is available for Accounts.'
                        : 'Salary slots are open for the flowchart Accounts assignee.',
                });
                return;
            }

            toast({
                title: stillPending ? 'Payroll validated' : 'All pending items completed',
                description: completed
                    ? `${completed} employee${completed === 1 ? '' : 's'} completed and removed from pending. ${stillPending} still pending.`
                    : stillPending
                        ? `${stillPending} employee${stillPending === 1 ? '' : 's'} still pending.`
                        : 'No pending employees.',
            });
        } catch (error) {
            toast({
                title: 'Could not validate payroll',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
        }
    }

    function handleReminder() {
        if (!monthDmf?.canAct && !monthDmf?.canStart) return;
        openBlockers();
    }

    async function sendBlockerReminders(visibleItems) {
        if (!parsed?.monthKey || sendingReminders) return;
        const pendingOnly = (Array.isArray(visibleItems) ? visibleItems : []).filter((item) => {
            const blob = `${item.status || ''} ${item.detail || ''} ${item.title || ''}`.toLowerCase();
            return !/\bcompleted\b|\bprocessed\b/.test(blob);
        });
        if (!pendingOnly.length) return;
        setSendingReminders(true);
        try {
            const employeeIds = [
                ...new Set(
                    pendingOnly
                        .map((item) => String(item.responsibleId || '').trim())
                        .filter(Boolean),
                ),
            ];
            const res = await axiosInstance.post(
                `/Employee/salary-register/${parsed.monthKey}/blockers/remind`,
                {
                    category: blockerFilter || '',
                    employeeIds,
                    taskIds: pendingOnly.map((item) => String(item.id || '')).filter(Boolean),
                    tasks: pendingOnly.map((item) => ({
                        id: item.id,
                        employeeId: item.employeeId,
                        name: item.name,
                        title: item.title,
                        detail: item.detail,
                        category: item.category,
                        path: blockerTaskPath(item),
                        responsibleId: item.responsibleId,
                        responsibleName: item.responsibleName,
                        responsibleRole: item.responsibleRole,
                        waitingLabel: blockerDue(item),
                    })),
                },
                { skipToast: true },
            );
            const sent = Number(res.data?.sent) || 0;
            const skipped = Number(res.data?.skipped) || 0;
            toast({
                title: sent ? 'Reminders sent' : 'No emails sent',
                description: sent
                    ? skipped
                        ? `${sent} responsible person${sent === 1 ? '' : 's'} emailed (one mail each). ${skipped} skipped (no email).`
                        : `${sent} responsible person${sent === 1 ? '' : 's'} emailed — one mail each, with every visible task as a numbered link.`
                    : skipped
                        ? 'No email addresses were found for the responsible people on the visible rows.'
                        : 'No matching people to remind.',
            });
        } catch {
            toast({
                title: 'Could not send reminders',
                description: 'Try again in a moment.',
            });
        } finally {
            setSendingReminders(false);
        }
    }

    function openBlockers({ category = '', employeeId = '' } = {}) {
        setBlockerFilter(category);
        setBlockerEmployeeId(employeeId);
        setBlockersOpen(true);
    }

    useEffect(() => {
        if (!slotEditor && !blockersOpen) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            if (slotEditor) setSlotEditor(null);
            else {
                setBlockersOpen(false);
                setBlockerEmployeeId('');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [slotEditor, blockersOpen]);

    const salarySlots = useMemo(() => {
        const empById = new Map();
        for (const emp of paymentEmployees || []) {
            const id = String(emp.employeeId || '');
            if (!id) continue;
            empById.set(id, emp);
            empById.set(employeeIdKey(id), emp);
        }
        return paymentBatches
            .filter((batch) => batch.status !== 'cancelled')
            .map((batch, index) => {
                const slot = paymentLabel(batch, index);
                const rows = (batch?.selectedIds || [])
                    .map((id) => empById.get(String(id)) || empById.get(employeeIdKey(id)))
                    .filter(Boolean);
                const total = rows.reduce((sum, emp) => sum + employeeAmount(emp), 0);
                return {
                    slot,
                    batch,
                    rows,
                    total,
                    dateLabel: formatSlotDate(batch?.createdAt),
                    processed: batch.status === 'approved',
                    status: batch.status || 'approved',
                    companyName: batch.companyName || '',
                    paymentMethod: batch.paymentMethod || '',
                    rejectReason: batch.rejectReason || '',
                };
            })
            .sort((a, b) => a.slot - b.slot);
    }, [paymentBatches, paymentEmployees]);
    const dmfApproved = String(monthDmf?.status || '') === 'approved';
    const dmfStatus = String(monthDmf?.status || 'idle');
    const processStatusLabel = monthPayrollProcessStatusLabel(monthDmf);
    const pendingForLabel = payrollPendingForLabel(monthDmf);
    const canStartMonthApproval = Boolean(monthDmf?.canStart);
    const canActOnMonthApproval = Boolean(monthDmf?.canAct);
    const canCreateSlot = Boolean(monthDmf?.canCreateSlot);
    const canUseApproverActions = canStartMonthApproval || canActOnMonthApproval;
    const everyEmployeeReady = useMemo(() => {
        const enrolled = monthRoster.filter((emp) => employeeIdKey(emp.employeeId));
        if (!enrolled.length) return false;
        const pendingIds = new Set(
            (Array.isArray(derived.pendingRequests) ? derived.pendingRequests : [])
                .map((item) => employeeIdKey(item.employeeId))
                .filter(Boolean),
        );
        const processedIds = new Set([...processedPaymentIds].map((id) => employeeIdKey(id)));
        return enrolled.every((emp) => {
            const id = employeeIdKey(emp.employeeId);
            return Boolean(id) && !pendingIds.has(id) && !processedIds.has(id);
        });
    }, [monthRoster, derived.pendingRequests, processedPaymentIds]);
    const monthPayrollReady = everyEmployeeReady;
    // Accounts assignee, every employee Ready, and 100% readiness are commented so Submit stays available.
    const showAccountsSubmit = true;
    // const showAccountsSubmit =
    //     canStartMonthApproval && everyEmployeeReady && readinessChecks.percent === 100;
    const approverOnlyTitle = pendingForLabel
        ? `Pending for ${pendingForLabel}. Only that approver can use this.`
        : 'Only the current payroll approver can use this.';
    const viewerIsSlotHr = Boolean(register?.viewerIsSlotHr);
    const heldEmployeeKeys = useMemo(() => {
        const ids = new Set();
        for (const batch of paymentBatches) {
            if (batch.status === 'cancelled') continue;
            for (const id of batch.selectedIds || []) {
                const key = employeeIdKey(id);
                if (key) ids.add(key);
            }
        }
        return ids;
    }, [paymentBatches]);
    const enrolledForSlots = monthRoster.filter((emp) => employeeIdKey(emp.employeeId));
    const canOpenNewSlot =
        canCreateSlot &&
        enrolledForSlots.some((emp) => !heldEmployeeKeys.has(employeeIdKey(emp.employeeId)));
    const nextSlotNo = (salarySlots[salarySlots.length - 1]?.slot || 0) + 1;
    const activeSlotData = salarySlots.find((item) => item.slot === activeSlot) || salarySlots[0];
    const slotCanEdit =
        Boolean(slotEditor) &&
        canCreateSlot &&
        ['new', 'draft', 'rejected'].includes(String(slotEditor.status || ''));
    const slotCanDecide = Boolean(slotEditor) && viewerIsSlotHr && slotEditor.status === 'pending_hr';
    const slotCanMarkWps = Boolean(slotEditor) && canCreateSlot && slotEditor.status === 'pending_wps';
    const slotCanSetUpdated = Boolean(slotEditor) && canCreateSlot && slotEditor.status === 'pending_update';
    const slotCanOpenExcel = Boolean(slotEditor?.id) && ['pending_wps', 'pending_update', 'approved'].includes(slotEditor.status);
    const accountsStep = (monthDmf?.steps || []).find((step) => step.key === 'accounts');
    const hrStep = (monthDmf?.steps || []).find((step) => step.key === 'hr');
    const accountsName =
        String(accountsStep?.assignedToName || accountsStep?.actionedByName || 'Accounts').trim() || 'Accounts';
    const hrName = String(hrStep?.assignedToName || hrStep?.actionedByName || 'HR').trim() || 'HR';

    if (!parsed) {
        return (
            <div className="spcc-shell">
                <p className="spcc-error">Invalid salary month.</p>
            </div>
        );
    }

    return (
        <div className="spcc-shell">
            <header className="spcc-hero">
                <div className="spcc-hero__copy">
                    <p className="spcc-kicker">PAYROLL CONTROL CENTRE</p>
                    <h1 className="spcc-title">Salary Processing Conditions</h1>
                    <p className="spcc-subtitle">
                        Validate attendance and clear approvals before payroll starts.
                    </p>
                </div>
                <div className="spcc-hero__actions">
                    <SalaryDmfApprovalPanel
                        variant="actions"
                        kind="month"
                        monthKey={parsed.monthKey}
                        dmf={monthDmf}
                        ready
                        hideStart
                        openStartConfirm={Boolean(approvalPrompt)}
                        onOpenStartConfirmChange={setApprovalPrompt}
                        startButtonClass="spcc-btn spcc-btn--primary"
                        approveButtonClass="spcc-btn spcc-btn--approve"
                        rejectButtonClass="spcc-btn spcc-btn--reject"
                        onUpdated={(payload) => setMonthDmf(payload?.dmf || payload)}
                    />
                    {showAccountsSubmit ? (
                        <button
                            type="button"
                            className="spcc-btn spcc-btn--primary"
                            disabled={loading}
                            title={`Submit ${monthLabel} payroll to HR`}
                            onClick={() => {
                                // if (!monthPayrollReady || loading) return;
                                if (loading) return;
                                setApprovalPrompt(true);
                            }}
                        >
                            Submit
                        </button>
                    ) : null}
                    {canOpenNewSlot ? (
                        <button
                            type="button"
                            className="spcc-btn spcc-btn--primary"
                            disabled={loading || savingPayment}
                            title="Create a salary slot"
                            onClick={openNewSlot}
                        >
                            Create slot
                        </button>
                    ) : null}
                    {canCreateSlot ? (
                        <button
                            type="button"
                            className="spcc-btn spcc-btn--primary"
                            disabled={loading}
                            title="Update this payroll in Zoho"
                            onClick={() => setZohoOpen(true)}
                        >
                            Update Zoho
                        </button>
                    ) : null}
                    {dmfStatus === 'rejected' && monthDmf?.rejectReason ? (
                        <p className="spcc-reject-note">Rejected: {monthDmf.rejectReason}</p>
                    ) : null}
                    <button
                        type="button"
                        className="spcc-btn spcc-btn--ghost"
                        disabled={!canUseApproverActions}
                        title={canUseApproverActions ? 'Send reminder' : approverOnlyTitle}
                        onClick={handleReminder}
                    >
                        Send reminder
                    </button>
                    <button
                        type="button"
                        className="spcc-btn spcc-btn--ghost"
                        disabled={!canUseApproverActions}
                        title={canUseApproverActions ? 'Validate payroll' : approverOnlyTitle}
                        onClick={handleValidate}
                    >
                        Validate payroll
                    </button>
                </div>
            </header>

            <section className="spcc-status">
                <div className="spcc-status__item">
                    <span className="spcc-status__label">Payroll month</span>
                    <div className="spcc-select">{monthLabel}</div>
                </div>
                <div className="spcc-status__item">
                    <span className="spcc-status__label">Current status</span>
                    <div className="spcc-status__value" title={processStatusLabel}>
                        <span className={`spcc-dot${dmfApproved ? ' spcc-dot--ok' : ''}`} />
                        {processStatusLabel}
                    </div>
                </div>
                <div className="spcc-status__item">
                    <span className="spcc-status__label">Process status</span>
                    <div className="spcc-status__value" title={processStatusLabel}>
                        <span className={`spcc-dot${dmfApproved ? ' spcc-dot--ok' : ''}`} />
                        {processStatusLabel}
                    </div>
                </div>
                <div className="spcc-status__item spcc-status__item--grow">
                    <span className="spcc-status__label">Readiness</span>
                    <div className="spcc-progress-wrap">
                        <div className="spcc-progress">
                            <div
                                className="spcc-progress__fill"
                                style={{ width: `${readinessChecks.percent}%` }}
                            />
                        </div>
                        <span className="spcc-progress__pct">{readinessChecks.percent}%</span>
                    </div>
                </div>
                <Link href="/HRM/Salary" className="spcc-history-link">
                    View payroll history →
                </Link>
            </section>

            {loading ? (
                <div className="spcc-loading">
                    <Loader2 className="animate-spin" size={22} />
                    Loading {monthLabel} payroll conditions…
                </div>
            ) : (
                <>
                    <div className="spcc-board">
                        <div className="spcc-board__main">
                            <section className="spcc-metrics">
                                <MetricCard
                                    code="TO"
                                    codeTone="blue"
                                    title="Headcount & salary"
                                    pill="Active"
                                    pillTone="ok"
                                >
                                    <RatioStat
                                        label="Employees"
                                        part={cardStats.enrolled}
                                        hint={tab === ALL_TAB_KEY ? 'this month' : view.groupLabel}
                                        title={
                                            tab === ALL_TAB_KEY
                                                ? 'Employees enrolled for this payroll month'
                                                : `Employees shown for ${view.groupLabel}`
                                        }
                                    />
                                    <RatioStat
                                        label="Salary"
                                        part={cardStats.salaryGross}
                                        total={cardStats.salaryNet}
                                        money
                                        hint="gross / net salary"
                                        percent={ratioPercent(cardStats.salaryNet, cardStats.salaryGross)}
                                        title={
                                            tab === ALL_TAB_KEY
                                                ? 'Gross is monthly salary minus leave, late in, early out, and missed punch. Net salary is that gross minus loan, fine, utility, and salary advance.'
                                                : `Gross and net salary for ${view.groupLabel}. Gross is monthly salary minus leave, late in, early out, and missed punch. Net salary subtracts loan, fine, utility, and salary advance.`
                                        }
                                    />
                                </MetricCard>
                                <MetricCard
                                    code="CO"
                                    codeTone="teal"
                                    title="Companies"
                                    pill="Active"
                                    pillTone="ok"
                                >
                                    {derived.companyCards.length ? (
                                        <div className="spcc-metric-list">
                                            {derived.companyCards.map((company) => {
                                                const name = company.name || 'Company';
                                                const enrolled = Number(company.enrolled) || 0;
                                                const total = Number(company.totalActive) || 0;
                                                const rosterMatch = monthRoster.find((emp) =>
                                                    sameCompany(companyKeyOf(emp), name),
                                                );
                                                const companyTab = toCompanyTabKey(
                                                    rosterMatch ? companyKeyOf(rosterMatch) : name,
                                                );
                                                const active =
                                                    tabMode === TAB_MODE_COMPANY && sameCompany(fromCompanyTabKey(tab), name);
                                                return (
                                                    <button
                                                        key={company.companyId || name}
                                                        type="button"
                                                        className={`spcc-metric-co${active ? ' is-on' : ''}`}
                                                        onClick={() => {
                                                            setTabMode(TAB_MODE_COMPANY);
                                                            setTab(companyTab);
                                                        }}
                                                    >
                                                        <span className="spcc-metric-co__avatar">{companyInitials(name)}</span>
                                                        <span className="spcc-metric-co__main">
                                                            <span className="spcc-metric-co__top">
                                                                <span className="spcc-metric-co__name">{name}</span>
                                                                <span className="spcc-metric-co__ratio">
                                                                    {enrolled}
                                                                    <span className="spcc-metric-den"> / {total}</span>
                                                                </span>
                                                            </span>
                                                            <MetricBar percent={ratioPercent(enrolled, total)} />
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className="spcc-metric__sub">No companies added yet.</span>
                                    )}
                                </MetricCard>
                                <MetricCard
                                    code="WP"
                                    codeTone="violet"
                                    title="Payment type"
                                    pill="Enrolled"
                                    pillTone="ok"
                                >
                                    <div className="spcc-paytype">
                                        <div className="spcc-paytype__method">
                                            <span className="spcc-metric-stat__label">WPS</span>
                                            <div className="spcc-paytype__pair">
                                                <div className="spcc-paytype__mini">
                                                    <span className="spcc-metric-stat__label">Count</span>
                                                    <strong className="tabular-nums">{cardStats.wpsCount}</strong>
                                                </div>
                                                <div className="spcc-paytype__mini">
                                                    <span className="spcc-metric-stat__label">Amount</span>
                                                    <strong className="tabular-nums">{formatMoney(cardStats.wpsAmount)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="spcc-paytype__method">
                                            <span className="spcc-metric-stat__label">Cash</span>
                                            <div className="spcc-paytype__pair">
                                                <div className="spcc-paytype__mini">
                                                    <span className="spcc-metric-stat__label">Count</span>
                                                    <strong className="tabular-nums">{cardStats.cashCount}</strong>
                                                </div>
                                                <div className="spcc-paytype__mini">
                                                    <span className="spcc-metric-stat__label">Amount</span>
                                                    <strong className="tabular-nums">{formatMoney(cardStats.cashAmount)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="spcc-paytype__total" title="Total deduction of employees in this list">
                                            <span className="spcc-metric-stat__label">Deduction</span>
                                            <strong className="tabular-nums">{formatMoney(cardStats.deduction)}</strong>
                                        </div>
                                        <div className="spcc-paytype__total" title="Total extra of employees in this list">
                                            <span className="spcc-metric-stat__label">Extra</span>
                                            <strong className="tabular-nums">{formatMoney(cardStats.extra)}</strong>
                                        </div>
                                    </div>
                                </MetricCard>
                            </section>

                            <div className="spcc-grid">
                                <div className="spcc-col-main">
                                    <section className="spcc-card spcc-card--panel">
                                        <div className="spcc-tabs-row">
                                            <nav
                                                className="spcc-tabs"
                                                aria-label={tabMode === TAB_MODE_COMPANY ? 'Companies' : 'Work location groups'}
                                            >
                                                {tabItems.map((item) => (
                                                    <button
                                                        key={item.key}
                                                        type="button"
                                                        className={`spcc-tab${tab === item.key ? ' is-active' : ''}`}
                                                        onClick={() => setTab(item.key)}
                                                    >
                                                        {item.label}
                                                        {item.count != null ? <em>{item.count}</em> : null}
                                                    </button>
                                                ))}
                                            </nav>
                                            <div className="spcc-tab-tools">
                                            <PayrollExcelMenu
                                                monthLabel={monthLabel}
                                                groups={excelGroups}
                                                companies={excelCompanies}
                                                employeesOf={(kind, item) =>
                                                    kind === 'group'
                                                        ? monthRoster.filter(
                                                            (emp) => normalizeWorkLocationKey(emp.staffType) === item.id,
                                                        )
                                                        : monthRoster.filter((emp) =>
                                                            sameCompany(companyKeyOf(emp), item.id),
                                                        )
                                                }
                                                onEmpty={(label) =>
                                                    toast({
                                                        title: 'No employees to download',
                                                        description: label ? `Nothing enrolled in ${label}.` : undefined,
                                                    })
                                                }
                                            />
                                            <div className="spcc-tab-mode" role="group" aria-label="Tab grouping">
                                                <button
                                                    type="button"
                                                    className={`spcc-tab-mode__btn${tabMode === TAB_MODE_GROUP ? ' is-on' : ''}`}
                                                    onClick={() => {
                                                        setTabMode(TAB_MODE_GROUP);
                                                        setTab(ALL_TAB_KEY);
                                                    }}
                                                >
                                                    Group
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`spcc-tab-mode__btn${tabMode === TAB_MODE_COMPANY ? ' is-on' : ''}`}
                                                    onClick={() => {
                                                        setTabMode(TAB_MODE_COMPANY);
                                                        setTab(ALL_TAB_KEY);
                                                    }}
                                                >
                                                    Company
                                                </button>
                                            </div>
                                            </div>
                                        </div>

                                        <div className="spcc-pay-wrap" ref={payTableRef}>
                                            <div className="spcc-pay-table" role="table" aria-label="Salary employees">
                                                <div className="spcc-pay-row spcc-pay-row--head" role="row">
                                                    <span>Sl no</span>
                                                    <span>
                                                        <SortHeader
                                                            label="Employee name"
                                                            column="name"
                                                            sort={payrollSort}
                                                            onSort={(column) => setPayrollSort((prev) => toggleSort(prev, column))}
                                                        />
                                                    </span>
                                                    <span>
                                                        <SortHeader
                                                            label="Monthly salary"
                                                            column="monthly"
                                                            sort={payrollSort}
                                                            onSort={(column) => setPayrollSort((prev) => toggleSort(prev, column))}
                                                        />
                                                    </span>
                                                    <span>
                                                        <SortHeader
                                                            label="Basic salary"
                                                            column="basic"
                                                            sort={payrollSort}
                                                            onSort={(column) => setPayrollSort((prev) => toggleSort(prev, column))}
                                                        />
                                                    </span>
                                                    <span>
                                                        <SortHeader
                                                            label="Deduction"
                                                            column="deduction"
                                                            sort={payrollSort}
                                                            onSort={(column) => setPayrollSort((prev) => toggleSort(prev, column))}
                                                        />
                                                    </span>
                                                    <span>
                                                        <SortHeader
                                                            label="Extra"
                                                            column="extra"
                                                            sort={payrollSort}
                                                            onSort={(column) => setPayrollSort((prev) => toggleSort(prev, column))}
                                                        />
                                                    </span>
                                                    <span>
                                                        <SortHeader
                                                            label="Net salary"
                                                            column="net"
                                                            sort={payrollSort}
                                                            onSort={(column) => setPayrollSort((prev) => toggleSort(prev, column))}
                                                        />
                                                    </span>
                                                    <span>
                                                        <SortHeader
                                                            label="Status"
                                                            column="status"
                                                            sort={payrollSort}
                                                            onSort={(column) => setPayrollSort((prev) => toggleSort(prev, column))}
                                                        />
                                                    </span>
                                                </div>
                                                {sortedPayrollRows.length ? (
                                                    sortedPayrollRows.map((emp, index) => {
                                                        const id = String(emp.employeeId || '');
                                                        const processed = processedPaymentIds.has(id);
                                                        const blockerCount = Number(view.requestCountByEmployee?.[id]) || 0;
                                                        const pending = !processed && blockerCount > 0;
                                                        const pendingItems = view.pendingByEmployee?.[id] || [];
                                                        const status = processed
                                                            ? 'Processed'
                                                            : pending
                                                                ? employeePendingStatusLabel(pendingItems)
                                                                : 'Ready';
                                                        const netSalary = emp.actualSalary ?? emp.monthlySalary;
                                                        return (
                                                            <div
                                                                key={emp.employeeId || emp.slNo || index}
                                                                data-pay-employee={id}
                                                                className={`spcc-pay-row${readinessEmployeeId === id ? ' is-selected' : ''}`}
                                                                role="row"
                                                                title={id ? 'Double-click to open salary slips' : undefined}
                                                                onClick={(event) => {
                                                                    if (!id || event.detail > 1) return;
                                                                    setReadinessEmployeeId((current) => {
                                                                        const next = current === id ? '' : id;
                                                                        setReadinessAnchorId(next);
                                                                        return next;
                                                                    });
                                                                }}
                                                                onDoubleClick={() => {
                                                                    if (!id) return;
                                                                    navigateFromList(
                                                                        router,
                                                                        `/HRM/Salary/enroll/${encodeURIComponent(id)}`,
                                                                        parsed?.monthKey
                                                                            ? `/HRM/Salary/${parsed.monthKey}`
                                                                            : '/HRM/Salary',
                                                                    );
                                                                }}
                                                            >
                                                                <span className="tabular-nums">{index + 1}</span>
                                                                <span className="spcc-pay-emp">{emp.name || id || '—'}</span>
                                                                <span className="tabular-nums">{formatMoney(emp.monthlySalary)}</span>
                                                                <span className="tabular-nums">{formatMoney(emp.basicSalary)}</span>
                                                                <span className="tabular-nums">{formatMoney(emp.deduction)}</span>
                                                                <span className="tabular-nums">{formatMoney(employeeExtra(emp))}</span>
                                                                <span className="tabular-nums">{formatMoney(netSalary)}</span>
                                                                <span onClick={(event) => event.stopPropagation()}>
                                                                    {blockerCount > 0 ? (
                                                                        <button
                                                                            type="button"
                                                                            className="spcc-status-open"
                                                                            onClick={() => {
                                                                                setReadinessEmployeeId(id);
                                                                                setReadinessAnchorId(id);
                                                                            }}
                                                                            title={status}
                                                                        >
                                                                            <StatusPill tone="warn">
                                                                                {pending ? status : `${blockerCount} pending`}
                                                                            </StatusPill>
                                                                        </button>
                                                                    ) : (
                                                                        <StatusPill tone={pending ? 'warn' : 'ok'}>
                                                                            {status}
                                                                        </StatusPill>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="spcc-pay-empty">No enrolled employees for this month.</p>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                        <div className="spcc-board__side" ref={sideColRef}>
                            <section className="spcc-slot-rows" aria-label="Salary slots">
                                <div className="spcc-pay-cards">
                                    {salarySlots.map((slot) => (
                                        <PaymentResultCard
                                            key={slot.batch?.id || slot.slot}
                                            slot={slot}
                                            active={activeSlotData?.slot === slot.slot}
                                            onSelect={openSavedSlot}
                                        />
                                    ))}
                                    {canOpenNewSlot ? (
                                        <button
                                            type="button"
                                            className="spcc-pay-add spcc-pay-add--row"
                                            disabled={savingPayment}
                                            onClick={openNewSlot}
                                        >
                                            <span className="spcc-pay-add__kicker">Next</span>
                                            <span className="spcc-pay-add__title">Slot {nextSlotNo}</span>
                                            <span className="spcc-btn spcc-btn--primary spcc-pay-add__btn">
                                                Create slot
                                            </span>
                                        </button>
                                    ) : !dmfApproved ? (
                                        <div className="spcc-pay-add spcc-pay-add--row is-locked">
                                            <span className="spcc-pay-add__kicker">Locked</span>
                                            <span className="spcc-pay-add__title">Slot {nextSlotNo}</span>
                                            <span className="spcc-btn spcc-btn--ghost spcc-pay-add__btn">
                                                After Processed
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </section>
                            <aside
                                className="spcc-col-side spcc-ready-shift"
                                style={{ '--spcc-ready-shift': `${readinessShift}px` }}
                            >
                                <section className="spcc-card spcc-card--panel spcc-card--ready">
                                    <div className="spcc-card__head spcc-card__head--ready">
                                        <div className="spcc-ready-head">
                                            <h2 className="spcc-card__title">Payroll readiness</h2>
                                            <p className="spcc-card__sub">
                                                {readinessEmployeeId
                                                    ? readinessEmployeeItems.length
                                                        ? `${readinessEmployeeName} · ${readinessEmployeeItems.length} pending`
                                                        : `${readinessEmployeeName} · no pending items`
                                                    : readinessPeople.total
                                                        ? `${readinessPeople.total} employee${readinessPeople.total === 1 ? '' : 's'} pending · ${monthLabel}`
                                                        : `Checks for ${monthLabel}`}
                                            </p>
                                        </div>
                                    </div>

                                    {readinessEmployeeId ? (
                                        readinessEmployeeItems.length ? (
                                            <div className="spcc-ready-list" role="list">
                                                {readinessEmployeeItems.map((item) => (
                                                    <Link
                                                        key={item.id}
                                                        href={blockerReviewHref(item)}
                                                        className="spcc-ready-row"
                                                        title={blockerPendingCondition(item)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <span className="spcc-ready-copy">
                                                            <span className="spcc-ready-title">
                                                                {blockerPendingCondition(item)}
                                                            </span>
                                                            <span className="spcc-ready-detail">
                                                                {[
                                                                    blockerResponsibleDisplay(item),
                                                                    blockerDueDate(item),
                                                                ]
                                                                    .filter((part) => part && part !== '—')
                                                                    .join(' · ')}
                                                            </span>
                                                        </span>
                                                        <span className="spcc-ready-badge spcc-ready-badge--warn">
                                                            Review
                                                        </span>
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="spcc-ready-empty">
                                                No pending items for {readinessEmployeeName}.
                                            </p>
                                        )
                                    ) : readinessPeople.total ? (
                                        <div className="spcc-ready-people">
                                            <div className="spcc-ready-people__head">
                                                <span>Employee</span>
                                                <span>Pending</span>
                                            </div>
                                            {readinessPeople.preview.map((row) => (
                                                <button
                                                    key={row.id}
                                                    type="button"
                                                    className={`spcc-ready-person${readinessEmployeeId === row.id ? ' is-selected' : ''}`}
                                                    onClick={() => setReadinessEmployeeId(row.id)}
                                                    title={`${row.name} · ${row.pending} pending`}
                                                >
                                                    <span className="spcc-ready-person__name">{row.name}</span>
                                                    <span className="spcc-ready-person__count">{row.pending}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="spcc-ready-empty">No pending employees in this tab.</p>
                                    )}

                                    <div className="spcc-req-block">
                                        <button
                                            type="button"
                                            className="spcc-btn spcc-btn--soft"
                                            onClick={() => {
                                                if (readinessEmployeeId) {
                                                    setReadinessEmployeeId('');
                                                    setReadinessAnchorId('');
                                                    return;
                                                }
                                                openBlockers();
                                            }}
                                        >
                                            <span>
                                                {readinessEmployeeId
                                                    ? 'Back to employees'
                                                    : readinessPeople.extra > 0
                                                        ? `View others (${readinessPeople.extra})`
                                                        : tab !== ALL_TAB_KEY
                                                            ? `View ${view.groupLabel} employees`
                                                            : 'View all employees'}
                                            </span>
                                        </button>
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </div>

                    {typeof document !== 'undefined' && slotEditor
                        ? createPortal(
                            <div className="spcc-modal">
                                <button
                                    type="button"
                                    className="spcc-modal__backdrop"
                                    onClick={() => setSlotEditor(null)}
                                    aria-label="Close"
                                />
                                <div
                                    className="spcc-modal__panel spcc-modal__panel--pay"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="spcc-pay-modal-title"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <SlotEditorModal
                                        editor={slotEditor}
                                        employees={paymentEmployees}
                                        claimedKeys={claimedElsewhere(slotEditor.id)}
                                        saving={savingPayment}
                                        canEdit={slotCanEdit}
                                        canDecide={slotCanDecide}
                                        canMarkWps={slotCanMarkWps}
                                        canSetUpdated={slotCanSetUpdated}
                                        canOpenExcel={slotCanOpenExcel}
                                        excelBusy={excelBusy}
                                        accountsName={accountsName}
                                        hrName={hrName}
                                        onChange={(patch) =>
                                            setSlotEditor((current) => (current ? { ...current, ...patch } : current))
                                        }
                                        onClose={() => setSlotEditor(null)}
                                        onCancelSlot={() => {
                                            if (!slotEditor.id) {
                                                setSlotEditor(null);
                                                return;
                                            }
                                            saveSlot('cancel');
                                        }}
                                        onDraft={() => saveSlot('draft')}
                                        onApply={() => saveSlot('apply')}
                                        onApprove={() => saveSlot('approve')}
                                        onReject={(reason) => saveSlot('reject', { reason })}
                                        onWpsUpdated={() => saveSlot('wps_updated')}
                                        onUpdatePayment={() => setExpenseOpen(true)}
                                        onOpenExcel={downloadSlotExcel}
                                    />
                                </div>
                            </div>,
                            document.body,
                        )
                        : null}

                    <SalarySlotExpenseModal
                        open={expenseOpen}
                        monthKey={parsed?.monthKey || ''}
                        paymentId={slotEditor?.id || ''}
                        onClose={() => setExpenseOpen(false)}
                        onSaved={(payment) => {
                            const saved = paymentBatchFromApi(payment);
                            if (!saved) return;
                            setPaymentBatches((prev) => {
                                const rest = prev.filter((item) => item.id !== saved.id);
                                return [...rest, saved];
                            });
                            setSlotEditor((current) => (
                                current && current.id === saved.id
                                    ? { ...current, status: saved.status || 'approved' }
                                    : current
                            ));
                        }}
                    />

                    <SalaryZohoJournalModal
                        open={zohoOpen}
                        monthKey={parsed?.monthKey || ''}
                        onClose={() => setZohoOpen(false)}
                    />

                    <PayrollBlockersModal
                        open={blockersOpen}
                        monthLabel={`${monthLabel}${tab !== ALL_TAB_KEY ? ` · ${view.groupLabel}` : ''}`}
                        requests={blockerRequests}
                        employeeName={blockerEmployeeName}
                        sending={sendingReminders}
                        listReturnHref={
                            parsed?.monthKey ? `/HRM/Salary/${parsed.monthKey}` : '/HRM/Salary'
                        }
                        onClose={() => {
                            setBlockersOpen(false);
                            setBlockerEmployeeId('');
                            setBlockerFilter('');
                        }}
                        onSendReminders={sendBlockerReminders}
                    />
                </>
            )}
        </div>
    );
}
