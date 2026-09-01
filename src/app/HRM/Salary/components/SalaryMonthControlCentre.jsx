'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
import NavButton from '@/components/NavButton';
import { FALLBACK_WORK_LOCATIONS, normalizeWorkLocationKey, workLocationLabel } from '@/utils/workLocations';
import { toCalendarMonthDay, toPayrollMonthDay } from '../utils/payrollMonthDay';
import { policyFormFromApi } from '../utils/salaryPolicyForm';
import SalaryDmfApprovalPanel from './SalaryDmfApprovalPanel';
import { payrollApprovalStatusLabel } from '../utils/payrollApprovalStatus';
import './SalaryMonthControlCentre.css';

const ALL_TAB_KEY = 'all';
const SIDEBAR_EMPLOYEE_LIMIT = 5;
const TAB_MODE_GROUP = 'group';
const TAB_MODE_COMPANY = 'company';
const COMPANY_TAB_PREFIX = 'co:';
const SALARY_FILTER_LIMIT = 3000;
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
        detail: 'Fine, loan, advance & utility',
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
            ? `${reminderDays} day${reminderDays === 1 ? '' : 's'} before processing`
            : 'On processing date',
        reminderDay: reminderDays,
        leaveEligibility: policy?.workingDaysRequiredToEligible
            ? `${policy.workingDaysRequiredToEligible} working days`
            : '365 working days',
        leaveSalaryEligibility: policy?.leaveSalaryWorkingDays
            ? `${policy.leaveSalaryWorkingDays} working days`
            : '365 working days',
        ticketEligibility: policy?.workingDaysRequiredForAirTicket
            ? `${policy.workingDaysRequiredForAirTicket} working days`
            : '730 working days',
    };
}

function formatMoney(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

function RatioStat({ label, part, total, money, hint }) {
    return (
        <div className="spcc-metric-tile">
            <div className="spcc-metric-stat__head">
                <span className="spcc-metric-stat__label">{label}</span>
                {hint ? <span className="spcc-metric-stat__hint">{hint}</span> : null}
            </div>
            <span className={`spcc-metric-stat__value${money ? ' is-money' : ''}`}>
                {money ? formatMoney(part) : part}
                <span className="spcc-metric-den"> / {money ? formatMoney(total) : total}</span>
            </span>
            <MetricBar percent={ratioPercent(part, total)} />
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

function employeeIdKey(value) {
    return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function companyKeyOf(emp) {
    const name = String(emp?.companyName || '').trim();
    if (!name || name === '—') return 'Unassigned';
    return name;
}

function sameCompany(left, right) {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function batchCompanyFilters(batch) {
    if (Array.isArray(batch?.companies) && batch.companies.length) {
        return batch.companies.map((name) => String(name || '').trim()).filter(Boolean);
    }
    const single = String(batch?.company || '').trim();
    return single ? [single] : [];
}

function employeeMatchesCompanies(emp, companies) {
    if (!companies?.length) return true;
    const key = companyKeyOf(emp);
    return companies.some((name) => sameCompany(key, name));
}

function sortEmployeesByName(rows) {
    return [...(rows || [])].sort((a, b) =>
        String(a?.name || a?.employeeId || '').localeCompare(String(b?.name || b?.employeeId || ''), undefined, {
            sensitivity: 'base',
        }),
    );
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
    if (key === 'id') return mul * compareText(a?.employeeId, b?.employeeId);
    if (key === 'monthly') return mul * compareNumber(a?.monthlySalary, b?.monthlySalary);
    if (key === 'basic') return mul * compareNumber(a?.basicSalary, b?.basicSalary);
    if (key === 'deduction') return mul * compareNumber(a?.deduction, b?.deduction);
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

function SortHeader({ label, column, sort, onSort }) {
    const active = sort?.key === column;
    return (
        <button
            type="button"
            className={`spcc-sort${active ? ' is-on' : ''}`}
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
    return {
        id,
        paymentNo: Number(row.paymentNo) || 0,
        company: '',
        salaryFilter: '',
        selectedIds: (row.selectedIds || row.employeeIds || []).map(String).filter(Boolean),
        processed: true,
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

function SlotTabs({ slots, activeSlot, onSelect }) {
    return (
        <div className="spcc-metric-slots" role="tablist" aria-label="Salary slots">
            {slots.map((item) => (
                <button
                    key={item.slot}
                    type="button"
                    role="tab"
                    aria-selected={activeSlot === item.slot}
                    className={`spcc-metric-slot${activeSlot === item.slot ? ' is-on' : ''}${item.processed ? ' is-done' : ''}`}
                    onClick={() => onSelect(item.slot)}
                >
                    Slot {item.slot}
                </button>
            ))}
        </div>
    );
}

function SlotAmountDate({ total, dateLabel, processed, employeeCount }) {
    return (
        <div className="spcc-slot-summary">
            <div className="spcc-slot-summary__row">
                <span className="spcc-slot-summary__label">Total amount</span>
                <span className="spcc-slot-summary__value tabular-nums">
                    {processed ? formatMoney(total) : '—'}
                </span>
            </div>
            <div className="spcc-slot-summary__row">
                <span className="spcc-slot-summary__label">Date</span>
                <span className="spcc-slot-summary__value">{dateLabel}</span>
            </div>
            <span className="spcc-metric__caption">
                {processed
                    ? `${employeeCount} employee${employeeCount === 1 ? '' : 's'} processed`
                    : 'No payment in this slot yet.'}
            </span>
        </div>
    );
}

function PaymentResultCard({ slot, active, onSelect }) {
    if (!slot) return null;
    const grouped = groupEmployeesByCompany(slot.rows);

    return (
        <section
            className={`spcc-pay-result${active ? ' is-active' : ''}`}
            onClick={() => onSelect?.(slot.slot)}
        >
            <div className="spcc-pay-result__head">
                <h3 className="spcc-pay-result__title">Slot {slot.slot}</h3>
                <StatusPill tone={slot.processed ? 'ok' : 'warn'}>
                    {slot.processed ? 'Paid' : 'Open'}
                </StatusPill>
            </div>
            <SlotAmountDate
                total={slot.total}
                dateLabel={slot.dateLabel}
                processed={slot.processed}
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

function PaymentProcessCard({
    index,
    batch,
    employees,
    companyNames,
    claimedElsewhere,
    onPatch,
    onRemove,
    saving,
    onComplete,
}) {
    const allRef = useRef(null);
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

    const companies = useMemo(() => {
        const names = [];
        const seen = new Set();
        const addName = (name) => {
            const label = String(name || '').trim();
            if (!label || label === '—') return;
            const key = label.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            names.push(label);
        };
        for (const emp of employees || []) addName(companyKeyOf(emp));
        for (const name of companyNames || []) addName(name);
        names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return names;
    }, [companyNames, employees]);

    const companyCounts = useMemo(() => {
        const counts = new Map();
        for (const emp of employees || []) {
            const key = companyKeyOf(emp);
            counts.set(key.toLowerCase(), (counts.get(key.toLowerCase()) || 0) + 1);
        }
        return counts;
    }, [employees]);

    const companyFilters = useMemo(() => batchCompanyFilters(batch), [batch.companies, batch.company]);
    const allCompaniesOn = !companyFilters.length;

    const visible = useMemo(() => {
        const selectedIds = new Set((batch.selectedIds || []).map(String));
        if (batch.processed) {
            return sortEmployeesByName(
                (employees || []).filter((emp) => selectedIds.has(String(emp.employeeId || ''))),
            );
        }
        return sortEmployeesByName(
            (employees || []).filter((emp) => {
                if (!employeeMatchesCompanies(emp, companyFilters)) return false;
                const value = employeeAmount(emp);
                if (batch.salaryFilter === 'lte3000') return value <= SALARY_FILTER_LIMIT;
                if (batch.salaryFilter === 'gt3000') return value > SALARY_FILTER_LIMIT;
                return true;
            }),
        );
    }, [employees, companyFilters, batch.salaryFilter, batch.processed, batch.selectedIds]);

    const grouped = useMemo(() => {
        const byCompany = new Map();
        for (const emp of visible) {
            const key = companyKeyOf(emp);
            if (!byCompany.has(key)) byCompany.set(key, []);
            byCompany.get(key).push(emp);
        }
        const entries = [...byCompany.entries()].sort((a, b) =>
            a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }),
        );
        if (sort.key !== 'company') {
            const sorted = [...visible].sort((a, b) =>
                comparePaymentEmployee(a, b, sort.key, sort.dir),
            );
            return [['__flat__', sorted]];
        }
        for (const [, rows] of entries) {
            rows.sort((a, b) => comparePaymentEmployee(a, b, 'name', sort.dir));
        }
        if (sort.dir === 'desc') entries.reverse();
        if (companyFilters.length === 1) {
            const match = entries.find(([name]) => sameCompany(name, companyFilters[0]));
            return [match || [companyFilters[0], []]];
        }
        return entries;
    }, [visible, companyFilters, sort]);

    const selected = new Set(batch.selectedIds || []);
    const selectableIds = visible
        .map((emp) => String(emp.employeeId || ''))
        .filter((id) => id && !claimedElsewhere.has(id));
    const selectedVisible = selectableIds.filter((id) => selected.has(id));
    const allVisibleChecked =
        selectableIds.length > 0 && selectedVisible.length === selectableIds.length;
    const checkedTotal = (employees || []).reduce((sum, emp) => {
        const id = String(emp.employeeId || '');
        if (!id || !selected.has(id)) return sum;
        return sum + employeeAmount(emp);
    }, 0);

    useEffect(() => {
        if (!allRef.current) return;
        allRef.current.indeterminate =
            !batch.processed &&
            selectedVisible.length > 0 &&
            selectedVisible.length < selectableIds.length;
    }, [batch.processed, selectedVisible.length, selectableIds.length]);

    function applyCompanyFilters(nextCompanies) {
        const filters =
            !nextCompanies.length || nextCompanies.length === companies.length ? [] : nextCompanies;
        const allowed = new Set(
            (employees || [])
                .filter((emp) => employeeMatchesCompanies(emp, filters))
                .map((emp) => String(emp.employeeId || ''))
                .filter(Boolean),
        );
        const nextIds = (batch.selectedIds || []).filter((id) => allowed.has(String(id)));
        onPatch({
            companies: filters,
            company: filters.length === 1 ? filters[0] : '',
            selectedIds: nextIds,
        });
    }

    function toggleCompany(name, checked) {
        let next = batchCompanyFilters(batch);
        if (checked) {
            if (!next.some((row) => sameCompany(row, name))) next = [...next, name];
        } else {
            next = next.filter((row) => !sameCompany(row, name));
        }
        applyCompanyFilters(next);
    }

    function toggleOne(id, checked) {
        if (!id || claimedElsewhere.has(id) || batch.processed) return;
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        onPatch({ selectedIds: [...next] });
    }

    function toggleAll(checked) {
        if (batch.processed) return;
        const next = new Set(selected);
        selectableIds.forEach((id) => {
            if (checked) next.add(id);
            else next.delete(id);
        });
        onPatch({ selectedIds: [...next] });
    }

    return (
        <section className={`spcc-batch spcc-batch--modal${batch.processed ? ' is-done' : ''}`}>
            <div className="spcc-batch__head">
                <div>
                    <h3 id="spcc-pay-modal-title" className="spcc-batch__title">
                        Payment {paymentLabel(batch, index)}
                        {batch.paymentMethod ? ` · ${batch.paymentMethod}` : ''}
                    </h3>
                    <p className="spcc-batch__sub">
                        {batch.processed
                            ? `${selected.size} employee${selected.size === 1 ? '' : 's'} processed`
                            : companyFilters.length
                              ? `Checked ${companyFilters.join(', ')} · ${visible.length} employee${
                                    visible.length === 1 ? '' : 's'
                                }`
                              : `All employees${batch.paymentMethod ? ` · ${batch.paymentMethod}` : ''}`}
                    </p>
                </div>
                <button type="button" className="spcc-batch__close" onClick={onRemove} aria-label="Close">
                    ×
                </button>
            </div>

            {batch.processed ? null : (
                <div className="spcc-batch__toolbar">
                    <div className="spcc-batch__tabs" role="group" aria-label="Companies">
                        <label className={`spcc-batch__tab${allCompaniesOn ? ' is-on' : ''}`}>
                            <input
                                type="checkbox"
                                checked={allCompaniesOn}
                                onChange={() => applyCompanyFilters([])}
                            />
                            All employees
                            <em>{(employees || []).length}</em>
                        </label>
                        {companies.map((name) => {
                            const count = companyCounts.get(name.toLowerCase()) || 0;
                            const checked = companyFilters.some((row) => sameCompany(row, name));
                            return (
                                <label
                                    key={name}
                                    className={`spcc-batch__tab${checked ? ' is-on' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => toggleCompany(name, event.target.checked)}
                                    />
                                    {name}
                                    <em>{count}</em>
                                </label>
                            );
                        })}
                    </div>
                    <div className="spcc-batch__salary">
                        <span className="spcc-batch__checked-total">
                            Total {formatMoney(checkedTotal)}
                        </span>
                        <label>
                            <span>Salary</span>
                            <select
                                value={batch.salaryFilter || ''}
                                onChange={(e) => onPatch({ salaryFilter: e.target.value })}
                            >
                                <option value="">All salaries</option>
                                <option value="lte3000">Less than or equal 3000</option>
                                <option value="gt3000">Greater than 3000</option>
                            </select>
                        </label>
                    </div>
                </div>
            )}

            <div className="spcc-batch__list">
                <div className="spcc-batch__row spcc-batch__row--head">
                    {batch.processed ? (
                        <span />
                    ) : (
                        <input
                            ref={allRef}
                            type="checkbox"
                            checked={allVisibleChecked}
                            disabled={!selectableIds.length}
                            onChange={(e) => toggleAll(e.target.checked)}
                        />
                    )}
                    <SortHeader
                        label="Employee"
                        column="name"
                        sort={sort}
                        onSort={(column) => setSort((prev) => toggleSort(prev, column))}
                    />
                    <SortHeader
                        label="Company"
                        column="company"
                        sort={sort}
                        onSort={(column) => setSort((prev) => toggleSort(prev, column))}
                    />
                    <SortHeader
                        label="Actual amount"
                        column="amount"
                        sort={sort}
                        onSort={(column) => setSort((prev) => toggleSort(prev, column))}
                    />
                </div>
                {grouped.length ? (
                    grouped.map(([company, rows]) => (
                        <div key={company} className="spcc-batch__group">
                            {company === '__flat__' || companyFilters.length === 1 ? null : (
                                <p className="spcc-batch__group-title">
                                    {company}
                                    <span>{rows.length}</span>
                                </p>
                            )}
                            {rows.length ? (
                                rows.map((emp) => {
                                    const id = String(emp.employeeId || '');
                                    const taken = claimedElsewhere.has(id);
                                    const checked = selected.has(id);
                                    return (
                                        <label
                                            key={id}
                                            className={`spcc-batch__row${taken ? ' is-locked' : ''}${checked ? ' is-checked' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={batch.processed || taken}
                                                onChange={(e) => toggleOne(id, e.target.checked)}
                                            />
                                            <span>
                                                <strong>{emp.name || id}</strong>
                                                <em>{taken ? 'Already in another payment' : id}</em>
                                            </span>
                                            <span>{company}</span>
                                            <span className="tabular-nums">{formatMoney(employeeAmount(emp))}</span>
                                        </label>
                                    );
                                })
                            ) : (
                                <p className="spcc-batch__empty">No employees assigned to this company.</p>
                            )}
                        </div>
                    ))
                ) : (
                    <p className="spcc-pay-empty">No employees match this filter.</p>
                )}
            </div>
            {batch.processed ? null : (
                <div className="spcc-batch__foot">
                    <button
                        type="button"
                        className="spcc-btn spcc-btn--primary spcc-batch__done"
                        disabled={saving || !selected.size}
                        onClick={onComplete}
                    >
                        {saving
                            ? 'Saving…'
                            : `Done · process payment${selected.size ? ` (${selected.size})` : ''}`}
                    </button>
                </div>
            )}
        </section>
    );
}

function blockerTaskPath(item) {
    const id = String(item?.employeeId || '').trim();
    const key = String(item?.id || '');
    const category = String(item?.category || '');
    if (key.startsWith('hub-')) {
        const hubId = key.slice(4);
        return hubId ? `/dashboard?hubRequestId=${encodeURIComponent(hubId)}` : '/dashboard';
    }
    if (key.startsWith('fine-')) return '/HRM/Fine';
    if (key.startsWith('loan-') || category === 'finance') return '/HRM/LoanAndAdvance';
    if (category === 'attendance' || category === 'leave' || category === 'overtime' || category === 'compoff') {
        return id ? `/HRM/Leave?employee=${encodeURIComponent(id)}` : '/HRM/Leave';
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

function blockerReviewHref(item) {
    return item?.path || blockerTaskPath(item);
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
    onClose,
    onSendReminders,
}) {
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
                                    <Link href={blockerReviewHref(item)} className="spcc-blockers__review">
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
    const { toast } = useToast();
    const { locations } = useWorkLocations();
    const parsed = useMemo(() => parseMonthKey(monthKey), [monthKey]);
    const [tab, setTab] = useState(ALL_TAB_KEY);
    const [tabMode, setTabMode] = useState(TAB_MODE_COMPANY);
    const [blockersOpen, setBlockersOpen] = useState(false);
    const [blockerFilter, setBlockerFilter] = useState('');
    const [blockerEmployeeId, setBlockerEmployeeId] = useState('');
    const [readinessEmployeeId, setReadinessEmployeeId] = useState('');
    const [payrollSort, setPayrollSort] = useState({ key: 'name', dir: 'asc' });
    const [sendingReminders, setSendingReminders] = useState(false);
    const [groupPolicies, setGroupPolicies] = useState({});
    const [loading, setLoading] = useState(true);
    const [policy, setPolicy] = useState(null);
    const [register, setRegister] = useState(null);
    const [monthDmf, setMonthDmf] = useState(null);
    const [approvalPrompt, setApprovalPrompt] = useState(false);
    const [paymentBatches, setPaymentBatches] = useState([]);
    const [paymentModalId, setPaymentModalId] = useState(null);
    const [paymentMethodPicker, setPaymentMethodPicker] = useState(false);
    const [savingPayment, setSavingPayment] = useState(false);
    const [activeSlot, setActiveSlot] = useState(1);
    const paymentSeq = useRef(1);

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
            setMonthDmf(dmfRes?.data?.dmf || null);
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
        setPaymentModalId(null);
        setSavingPayment(false);
        setBlockersOpen(false);
        setBlockerFilter('');
        setBlockerEmployeeId('');
        setReadinessEmployeeId('');
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
        const employees = (Array.isArray(overview.employees) ? overview.employees : []).filter(
            (emp) => emp.enrolled,
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

    const tabItems = useMemo(() => {
        const employeeCount = (derived.employees || []).length;
        if (tabMode === TAB_MODE_COMPANY) {
            const companies = uniqueCompanyNames(
                (derived.employees || []).map((emp) => emp.companyName),
                (register?.employees || []).map((emp) => emp.companyName),
                (register?.enrollmentOverview?.companies || [])
                    .filter((row) => Number(row.totalActive) > 0)
                    .map((row) => row.name),
            );
            const counts = new Map();
            for (const emp of derived.employees || []) {
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
            return [
                { key: ALL_TAB_KEY, label: 'All employees', count: employeeCount },
                ...derived.locationCards.map((loc) => ({
                    key: loc.key,
                    label: loc.label,
                    count: loc.enrolled,
                })),
            ];
    }, [tabMode, derived.locationCards, derived.employees, register]);

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
        if (!tabItems.some((item) => item.key === tab)) setTab(ALL_TAB_KEY);
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
                ? derived.employees
                : tabMode === TAB_MODE_COMPANY
                  ? derived.employees.filter((emp) => sameCompany(companyKeyOf(emp), companyName))
                  : derived.employees.filter((emp) => normalizeWorkLocationKey(emp.staffType) === tab);
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
            employeeCount: companyName ? employees.length : focus ? focus.totalActive : derived.totalEmployees,
        };
    }, [tab, tabMode, derived, policy, parsed, groupPolicies]);

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
            statusLabel: payrollApprovalStatusLabel(monthDmf),
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
        const fromEmp = (derived.employees || []).find((emp) => String(emp.employeeId || '').trim() === id);
        if (fromEmp?.name) return fromEmp.name;
        const fromPending = (view.pendingByEmployee?.[id] || [])[0];
        return fromPending?.name || id;
    }, [readinessEmployeeId, derived.employees, view.pendingByEmployee]);

    const readinessEmployeeItems = useMemo(() => {
        const id = String(readinessEmployeeId || '').trim();
        if (!id) return [];
        return Array.isArray(view.pendingByEmployee?.[id]) ? view.pendingByEmployee[id] : [];
    }, [readinessEmployeeId, view.pendingByEmployee]);

    useEffect(() => {
        setReadinessEmployeeId('');
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
        const fromEmp = (derived.employees || []).find(
            (emp) => String(emp.employeeId || '') === String(blockerEmployeeId),
        );
        return fromEmp?.name || blockerEmployeeId;
    }, [blockerEmployeeId, blockerRequests, derived.employees]);

    const monthEmployees = useMemo(
        () => (Array.isArray(register?.employees) ? register.employees : []),
        [register?.employees],
    );

    const payrollRows = useMemo(() => {
        const monthById = new Map();
        for (const emp of monthEmployees) {
            const key = employeeIdKey(emp.employeeId);
            if (key) monthById.set(key, emp);
        }
        return (derived.employees || [])
            .filter((emp) => emp.enrolled !== false)
            .filter((emp) => {
                if (tab === ALL_TAB_KEY) return true;
                if (tabMode === TAB_MODE_COMPANY) {
                    return sameCompany(companyKeyOf(emp), fromCompanyTabKey(tab));
                }
                return normalizeWorkLocationKey(emp.staffType) === tab;
            })
            .map((emp) => {
                const month = monthById.get(employeeIdKey(emp.employeeId));
                if (!month) {
                    return {
                        ...emp,
                        monthlySalary: Number(emp.monthlySalary) || 0,
                        basicSalary: Number(emp.basicSalary) || 0,
                        deduction: Number(emp.deduction) || 0,
                        actualSalary: Number(emp.actualSalary ?? emp.monthlySalary) || 0,
                    };
                }
                return {
                    ...emp,
                    ...month,
                    employeeId: emp.employeeId || month.employeeId,
                    name: emp.name || month.name,
                    companyName:
                        month.companyName && month.companyName !== '—'
                            ? month.companyName
                            : emp.companyName,
                    paymentType: emp.paymentType || month.paymentType,
                    staffType: emp.staffType || month.staffType,
                };
            });
    }, [monthEmployees, tab, tabMode, derived.employees]);

    const paymentEmployees = useMemo(() => {
        const byId = new Map();
        for (const emp of monthEmployees) {
            const id = employeeIdKey(emp.employeeId);
            if (id) byId.set(id, emp);
        }
        for (const emp of derived.employees || []) {
            if (emp.enrolled === false) continue;
            const id = employeeIdKey(emp.employeeId);
            if (!id) continue;
            const existing = byId.get(id);
            if (!existing) {
                byId.set(id, {
                    ...emp,
                    monthlySalary: Number(emp.monthlySalary) || 0,
                    basicSalary: Number(emp.basicSalary) || 0,
                    deduction: Number(emp.deduction) || 0,
                    actualSalary: Number(emp.actualSalary ?? emp.monthlySalary) || 0,
                });
                continue;
            }
            const next = { ...existing };
            if ((!next.companyName || next.companyName === '—') && emp.companyName) {
                next.companyName = emp.companyName;
            }
            if (emp.paymentType) next.paymentType = emp.paymentType;
            if (emp.isWps != null) next.isWps = emp.isWps;
            if (emp.companyMolCode) next.companyMolCode = emp.companyMolCode;
            if (emp.name && !next.name) next.name = emp.name;
            if (emp.employeeId) next.employeeId = emp.employeeId;
            byId.set(id, next);
        }
        return [...byId.values()];
    }, [monthEmployees, derived.employees]);

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

    function claimedElsewhere(batchId) {
        const ids = new Set();
        for (const batch of paymentBatches) {
            if (batch.id === batchId) continue;
            for (const id of batch.selectedIds || []) ids.add(String(id));
        }
        return ids;
    }

    function openPaymentMethodPicker() {
        if (String(monthDmf?.status || '') !== 'approved') {
            toast({
                title: 'Complete approval first',
                description: 'A payment slot can be added only after Management approves.',
            });
            return;
        }
        setPaymentMethodPicker(true);
    }

    function openPaymentModal(method) {
        const id = `pay-${paymentSeq.current++}`;
        setPaymentBatches((prev) => [
            ...prev,
            {
                id,
                company: '',
                companies: [],
                salaryFilter: '',
                selectedIds: [],
                processed: false,
                paymentMethod: method === 'Cash' ? 'Cash' : 'WPS',
            },
        ]);
        setPaymentMethodPicker(false);
        setPaymentModalId(id);
    }

    function closePaymentModal() {
        const id = paymentModalId;
        setPaymentModalId(null);
        if (!id) return;
        setPaymentBatches((prev) => prev.filter((batch) => batch.processed || batch.id !== id));
    }

    function patchPaymentBatch(id, patch) {
        setPaymentBatches((prev) => prev.map((batch) => (batch.id === id ? { ...batch, ...patch } : batch)));
    }

    async function completePaymentBatch(id) {
        const batch = paymentBatches.find((item) => item.id === id);
        const validIds = new Set(paymentEmployees.map((emp) => String(emp.employeeId || '')).filter(Boolean));
        const selectedIds = (batch?.selectedIds || []).filter((empId) => validIds.has(String(empId)));
        if (!selectedIds.length || savingPayment || !parsed?.monthKey) return;
        if (String(monthDmf?.status || '') !== 'approved') {
            toast({
                title: 'Complete approval first',
                description: 'A payment slot can be added only after Management approves.',
            });
            return;
        }
        setSavingPayment(true);
        try {
            const res = await axiosInstance.post(`/Employee/salary-register/${parsed.monthKey}/payments`, {
                employeeIds: selectedIds,
            });
            const saved = paymentBatchFromApi(res.data?.payment);
            if (!saved) throw new Error('Payment was not returned.');
            setPaymentBatches((prev) => [...prev.filter((item) => item.id !== id && item.processed), saved]);
            setPaymentModalId(null);
            if (saved.paymentNo) setActiveSlot(saved.paymentNo);
            toast({
                title: 'Payment saved',
                description: `${saved.selectedIds.length} employee${
                    saved.selectedIds.length === 1 ? '' : 's'
                } assigned to Slot ${saved.paymentNo}.`,
            });
        } catch (error) {
            toast({
                title: 'Could not save payment',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setSavingPayment(false);
        }
    }

    async function handleValidate() {
        if (!parsed?.monthKey) return;
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
            const payrollLabel = payrollApprovalStatusLabel(monthDmf);

            if (isClear) {
                if (dmfStatus === 'idle' || dmfStatus === 'rejected' || !dmfStatus) {
                    setApprovalPrompt(true);
                    toast({
                        title: 'Payroll is 100% ready',
                        description:
                            'Send for approval. Status will be Pending Accounts, then Pending HR, then Pending Management. Slots open after Approved.',
                    });
                    return;
                }
                if (dmfStatus === 'pending') {
                    toast({
                        title: payrollLabel,
                        description: 'Email and notification are with the current approver. Slots open after Approved.',
                    });
                    return;
                }
                toast({
                    title: 'Approved',
                    description: 'Salary slots are open.',
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
        if (!paymentModalId && !blockersOpen && !paymentMethodPicker) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            if (paymentModalId) closePaymentModal();
            else if (paymentMethodPicker) setPaymentMethodPicker(false);
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
    }, [paymentModalId, blockersOpen, paymentMethodPicker]);

    const salarySlots = useMemo(() => {
        const processed = paymentBatches.filter((batch) => batch.processed);
        const empById = new Map(
            (paymentEmployees || []).map((emp) => [String(emp.employeeId || ''), emp]),
        );
        return processed
            .map((batch, index) => {
                const slot = paymentLabel(batch, index);
                const rows = (batch?.selectedIds || [])
                    .map((id) => empById.get(String(id)))
                    .filter(Boolean);
                const total = rows.reduce((sum, emp) => sum + employeeAmount(emp), 0);
                return {
                    slot,
                    batch,
                    rows,
                    total,
                    dateLabel: formatSlotDate(batch?.createdAt),
                    processed: true,
                };
            })
            .sort((a, b) => a.slot - b.slot);
    }, [paymentBatches, paymentEmployees]);
    const dmfApproved = String(monthDmf?.status || '') === 'approved';
    const dmfStatus = String(monthDmf?.status || 'idle');
    const canStartMonthApproval =
        readinessChecks.percent === 100 &&
        (dmfStatus === 'idle' || dmfStatus === 'rejected' || !dmfStatus);
    const canProcessPayment =
        dmfApproved &&
        payrollRows.some((emp) => !processedPaymentIds.has(String(emp.employeeId || '')));
    const nextSlotNo = (salarySlots[salarySlots.length - 1]?.slot || 0) + 1;
    const headerSlots = salarySlots;
    const activeSlotData = headerSlots.find((item) => item.slot === activeSlot) || headerSlots[0];
    const activePayment = paymentBatches.find((batch) => batch.id === paymentModalId) || null;
    const activePaymentIndex = paymentBatches.findIndex((batch) => batch.id === paymentModalId);
    const activePaymentEmployees = useMemo(() => {
        const method = String(activePayment?.paymentMethod || '').trim();
        if (!method) return paymentEmployees;
        return paymentEmployees.filter((emp) => employeePayMethod(emp) === method);
    }, [paymentEmployees, activePayment?.paymentMethod]);
    const activePaymentCompanyNames = useMemo(() => {
        const names = [];
        const seen = new Set();
        for (const emp of activePaymentEmployees) {
            const label = companyKeyOf(emp);
            const key = label.toLowerCase();
            if (!label || label === '—' || seen.has(key)) continue;
            seen.add(key);
            names.push(label);
        }
        return names;
    }, [activePaymentEmployees]);
    const paymentMethodCounts = useMemo(() => {
        let wps = 0;
        let cash = 0;
        for (const emp of paymentEmployees) {
            const id = String(emp.employeeId || '').trim();
            if (!id || processedPaymentIds.has(id)) continue;
            if (employeePayMethod(emp) === 'WPS') wps += 1;
            else cash += 1;
        }
        return { wps, cash };
    }, [paymentEmployees, processedPaymentIds]);

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
                        ready={readinessChecks.percent === 100}
                        hideStart
                        openStartConfirm={approvalPrompt}
                        onOpenStartConfirmChange={setApprovalPrompt}
                        startButtonClass="spcc-btn spcc-btn--primary"
                        onUpdated={(payload) => setMonthDmf(payload?.dmf || payload)}
                    />
                    <button type="button" className="spcc-btn spcc-btn--ghost" onClick={handleReminder}>
                        Send reminder
                    </button>
                    <button
                        type="button"
                        className={canStartMonthApproval ? 'spcc-btn spcc-btn--primary' : 'spcc-btn spcc-btn--ghost'}
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
                    <div className="spcc-status__value">
                        <span className={`spcc-dot${dmfApproved ? ' spcc-dot--ok' : ''}`} />
                        {payrollApprovalStatusLabel(monthDmf)}
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
                    <section className="spcc-metrics">
                        <MetricCard
                            code="TO"
                            codeTone="blue"
                            title="Headcount & salary"
                            pill="Active"
                            pillTone="ok"
                            onClick={() => {
                                setTabMode(TAB_MODE_GROUP);
                                setTab(ALL_TAB_KEY);
                            }}
                            active={tabMode === TAB_MODE_GROUP && tab === ALL_TAB_KEY}
                        >
                            <RatioStat
                                label="Employees"
                                part={derived.enrolledCount}
                                total={derived.totalEmployees}
                                hint="enrolled / active"
                            />
                            <RatioStat
                                label="Salary"
                                part={derived.enrolledSalary}
                                total={derived.totalSalary}
                                money
                                hint="enrolled / all"
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
                                        const companyTab = toCompanyTabKey(name);
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
                            onClick={() => {
                                setTabMode(TAB_MODE_GROUP);
                                setTab(ALL_TAB_KEY);
                            }}
                        >
                            <div className="spcc-metric-split">
                                <div className="spcc-metric-tile spcc-metric-split__tile">
                                    <span className="spcc-metric-stat__label">WPS</span>
                                    <span className="spcc-metric-split__count">{derived.wpsEnrolled}</span>
                                </div>
                                <div className="spcc-metric-tile spcc-metric-split__tile">
                                    <span className="spcc-metric-stat__label">Cash</span>
                                    <span className="spcc-metric-split__count">{derived.cashEnrolled}</span>
                                </div>
                            </div>
                            <span
                                className="spcc-metric-bar spcc-metric-bar--mix"
                                aria-hidden="true"
                            >
                                <span
                                    className="spcc-metric-bar__fill spcc-metric-bar__fill--wps"
                                    style={{
                                        width: `${ratioPercent(
                                            derived.wpsEnrolled,
                                            derived.wpsEnrolled + derived.cashEnrolled,
                                        )}%`,
                                    }}
                                />
                            </span>
                            <span className="spcc-metric__caption">MOL code on enroll details = WPS</span>
                        </MetricCard>
                        <MetricCard
                            code="SL"
                            codeTone="amber"
                            title="Salary slots"
                            pill={
                                headerSlots.length
                                    ? activeSlotData?.processed
                                        ? 'Paid'
                                        : 'None'
                                    : 'None'
                            }
                            pillTone={activeSlotData?.processed ? 'ok' : 'warn'}
                        >
                            {headerSlots.length ? (
                                <>
                                    <SlotTabs
                                        slots={headerSlots}
                                        activeSlot={activeSlotData?.slot || headerSlots[0].slot}
                                        onSelect={setActiveSlot}
                                    />
                                    <SlotAmountDate
                                        total={activeSlotData?.total || 0}
                                        dateLabel={activeSlotData?.dateLabel || '—'}
                                        processed={Boolean(activeSlotData?.processed)}
                                        employeeCount={activeSlotData?.rows.length || 0}
                                    />
                                </>
                            ) : (
                                <span className="spcc-metric__sub">
                                    {dmfApproved
                                        ? 'Slots appear here after you process a payment.'
                                        : 'Slots open after approval.'}
                                </span>
                            )}
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

                                <div className="spcc-pay-wrap">
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
                                                    label="ID"
                                                    column="id"
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
                                            <span className="spcc-pay-open">Open</span>
                                        </div>
                                        {sortedPayrollRows.length ? (
                                            sortedPayrollRows.map((emp, index) => {
                                                const id = String(emp.employeeId || '');
                                                const processed = processedPaymentIds.has(id);
                                                const blockerCount = Number(view.requestCountByEmployee?.[id]) || 0;
                                                const pending = !processed && blockerCount > 0;
                                                const status = processed
                                                    ? 'Processed'
                                                    : pending
                                                      ? 'Pending'
                                                      : 'Ready';
                                                const netSalary = emp.actualSalary ?? emp.monthlySalary;
                                                return (
                                                    <div
                                                        key={emp.employeeId || emp.slNo || index}
                                                        className={`spcc-pay-row${readinessEmployeeId === id ? ' is-selected' : ''}`}
                                                        role="row"
                                                        onClick={() => {
                                                            if (!id) return;
                                                            setReadinessEmployeeId((current) => (current === id ? '' : id));
                                                        }}
                                                    >
                                                        <span className="tabular-nums">{index + 1}</span>
                                                        <span className="spcc-pay-emp">{emp.name || id || '—'}</span>
                                                        <span className="spcc-pay-code">{id || '—'}</span>
                                                        <span className="tabular-nums">{formatMoney(emp.monthlySalary)}</span>
                                                        <span className="tabular-nums">{formatMoney(emp.basicSalary)}</span>
                                                        <span className="tabular-nums">{formatMoney(emp.deduction)}</span>
                                                        <span className="tabular-nums">{formatMoney(netSalary)}</span>
                                                        <span onClick={(event) => event.stopPropagation()}>
                                                            {blockerCount > 0 ? (
                                                                <button
                                                                    type="button"
                                                                    className="spcc-status-open"
                                                                    onClick={() => setReadinessEmployeeId(id)}
                                                                    title={`${blockerCount} pending payroll item${blockerCount === 1 ? '' : 's'}`}
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
                                                        <span className="spcc-pay-open" onClick={(event) => event.stopPropagation()}>
                                                            {id ? (
                                                                <NavButton
                                                                    href={`/HRM/Salary/enroll/${encodeURIComponent(id)}`}
                                                                    listReturnHref={
                                                                        parsed?.monthKey
                                                                            ? `/HRM/Salary/${parsed.monthKey}`
                                                                            : '/HRM/Salary'
                                                                    }
                                                                    className="spcc-row-link"
                                                                >
                                                                    Open
                                                                </NavButton>
                                                            ) : (
                                                                '—'
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

                        <aside className="spcc-col-side">
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
                                            <span>Due</span>
                                        </div>
                                        {readinessPeople.preview.map((row) => (
                                            <button
                                                key={row.id}
                                                type="button"
                                                className={`spcc-ready-person${readinessEmployeeId === row.id ? ' is-selected' : ''}`}
                                                onClick={() => setReadinessEmployeeId(row.id)}
                                                title={`${row.name} · ${row.pending} pending · ${row.due} due`}
                                            >
                                                <span className="spcc-ready-person__name">{row.name}</span>
                                                <span className="spcc-ready-person__count">{row.pending}</span>
                                                <span className={`spcc-ready-person__count${row.due ? ' is-due' : ''}`}>
                                                    {row.due}
                                                </span>
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

                    <div className="spcc-pay-cards">
                        {salarySlots.map((slot) => (
                            <PaymentResultCard
                                key={slot.batch?.id || slot.slot}
                                slot={slot}
                                active={activeSlotData?.slot === slot.slot}
                                onSelect={setActiveSlot}
                            />
                        ))}
                        {canProcessPayment ? (
                            <button
                                type="button"
                                className="spcc-pay-add"
                                onClick={() => {
                                    setActiveSlot(nextSlotNo);
                                    openPaymentMethodPicker();
                                }}
                            >
                                <span className="spcc-pay-add__kicker">Next</span>
                                <span className="spcc-pay-add__title">Slot {nextSlotNo}</span>
                                <span className="spcc-btn spcc-btn--primary spcc-pay-add__btn">
                                    Process payment
                                </span>
                            </button>
                        ) : !dmfApproved ? (
                            <div className="spcc-pay-add is-locked">
                                <span className="spcc-pay-add__kicker">Locked</span>
                                <span className="spcc-pay-add__title">Slot {nextSlotNo}</span>
                                <span className="spcc-btn spcc-btn--ghost spcc-pay-add__btn">
                                    After management approval
                                </span>
                            </div>
                        ) : null}
                    </div>

                    {typeof document !== 'undefined' && activePayment
                        ? createPortal(
                              <div className="spcc-modal">
                                  <button
                                      type="button"
                                      className="spcc-modal__backdrop"
                                      onClick={closePaymentModal}
                                      aria-label="Close"
                                  />
                                  <div
                                      className="spcc-modal__panel spcc-modal__panel--pay"
                                      role="dialog"
                                      aria-modal="true"
                                      aria-labelledby="spcc-pay-modal-title"
                                      onClick={(event) => event.stopPropagation()}
                                  >
                                      <PaymentProcessCard
                                          index={Math.max(0, activePaymentIndex)}
                                          batch={activePayment}
                                          employees={activePaymentEmployees}
                                          companyNames={activePaymentCompanyNames}
                                          claimedElsewhere={claimedElsewhere(activePayment.id)}
                                          onPatch={(patch) => patchPaymentBatch(activePayment.id, patch)}
                                          onRemove={closePaymentModal}
                                          saving={savingPayment}
                                          onComplete={() => completePaymentBatch(activePayment.id)}
                                      />
                                  </div>
                              </div>,
                              document.body,
                          )
                        : null}

                    {typeof document !== 'undefined' && paymentMethodPicker
                        ? createPortal(
                              <div className="spcc-modal">
                                  <button
                                      type="button"
                                      className="spcc-modal__backdrop"
                                      onClick={() => setPaymentMethodPicker(false)}
                                      aria-label="Close"
                                  />
                                  <div
                                      className="spcc-modal__panel spcc-modal__panel--method"
                                      role="dialog"
                                      aria-modal="true"
                                      aria-labelledby="spcc-pay-method-title"
                                      onClick={(event) => event.stopPropagation()}
                                  >
                                      <h3 id="spcc-pay-method-title" className="spcc-method-title">
                                          Process payment
                                      </h3>
                                      <p className="spcc-method-sub">Choose which enrolled employees to include.</p>
                                      <div className="spcc-method-grid">
                                          <button
                                              type="button"
                                              className="spcc-method-btn"
                                              onClick={() => openPaymentModal('WPS')}
                                          >
                                              <strong>WPS</strong>
                                              <em>
                                                  {paymentMethodCounts.wps} employee
                                                  {paymentMethodCounts.wps === 1 ? '' : 's'}
                                              </em>
                                          </button>
                                          <button
                                              type="button"
                                              className="spcc-method-btn"
                                              onClick={() => openPaymentModal('Cash')}
                                          >
                                              <strong>Cash</strong>
                                              <em>
                                                  {paymentMethodCounts.cash} employee
                                                  {paymentMethodCounts.cash === 1 ? '' : 's'}
                                              </em>
                                          </button>
                                      </div>
                                  </div>
                              </div>,
                              document.body,
                          )
                        : null}

                    <PayrollBlockersModal
                        open={blockersOpen}
                        monthLabel={`${monthLabel}${tab !== ALL_TAB_KEY ? ` · ${view.groupLabel}` : ''}`}
                        requests={blockerRequests}
                        employeeName={blockerEmployeeName}
                        sending={sendingReminders}
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
