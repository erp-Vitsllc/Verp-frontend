'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import useWorkLocations from '@/hooks/useWorkLocations';
import NavButton from '@/components/NavButton';
import { FALLBACK_WORK_LOCATIONS, normalizeWorkLocationKey, workLocationLabel } from '@/utils/workLocations';
import { toPayrollMonthDay } from '../utils/payrollMonthDay';
import { policyFormFromApi } from '../utils/salaryPolicyForm';
import './SalaryMonthControlCentre.css';

const ALL_TAB_KEY = 'all';
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

function ordinal(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '';
    const v = num % 100;
    if (v >= 11 && v <= 13) return `${num}th`;
    switch (num % 10) {
        case 1:
            return `${num}st`;
        case 2:
            return `${num}nd`;
        case 3:
            return `${num}rd`;
        default:
            return `${num}th`;
    }
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
    const processDay = Number(toPayrollMonthDay(policy?.salaryProcessingDate)) || 28;
    const cutoffDay = Number(toPayrollMonthDay(policy?.salaryCutoffDate)) || Math.max(1, processDay - 3);
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

    const reminderDays = Number(policy?.salaryProcessReminders?.[0]?.daysBefore) || 5;
    return {
        processDay,
        cutoffDate,
        startMonthLabel,
        reminderLabel: `${ordinal(reminderDays)} of every month`,
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

function ReadinessRow({ tone, title, detail, badge, badgeTone }) {
    return (
        <button type="button" className="spcc-ready-row">
            <span className={`spcc-ready-icon spcc-ready-icon--${tone}`}>
                {tone === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            </span>
            <span className="spcc-ready-copy">
                <span className="spcc-ready-title">{title}</span>
                <span className="spcc-ready-detail">{detail}</span>
            </span>
            <span className={`spcc-ready-badge spcc-ready-badge--${badgeTone}`}>{badge}</span>
        </button>
    );
}

function employeeAmount(emp) {
    return Number(emp?.actualSalary ?? emp?.monthlySalary) || 0;
}

function companyKeyOf(emp) {
    const name = String(emp?.companyName || '').trim();
    if (!name || name === '—') return 'Unassigned';
    return name;
}

function sameCompany(left, right) {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
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
    };
}

function paymentLabel(batch, index) {
    return Number(batch?.paymentNo) || index + 1;
}

function PaymentResultCard({ index, batch, employees }) {
    const selected = new Set((batch.selectedIds || []).map(String));
    const rows = (employees || []).filter((emp) => selected.has(String(emp.employeeId || '')));
    const grouped = [];
    const map = new Map();
    for (const emp of rows) {
        const key = companyKeyOf(emp);
        if (!map.has(key)) {
            const list = [];
            map.set(key, list);
            grouped.push([key, list]);
        }
        map.get(key).push(emp);
    }

    return (
        <section className="spcc-pay-result">
            <div className="spcc-pay-result__head">
                <div>
                    <h3 className="spcc-pay-result__title">Payment {paymentLabel(batch, index)}</h3>
                    <p className="spcc-pay-result__sub">
                        {rows.length} employee{rows.length === 1 ? '' : 's'}
                    </p>
                </div>
                <StatusPill tone="ok">Processed</StatusPill>
            </div>
            <div className="spcc-pay-result__body">
            {grouped.map(([company, list]) => (
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
            ))}
            </div>
        </section>
    );
}

function PaymentProcessCard({ index, batch, employees, companyNames, claimedElsewhere, onPatch, onRemove }) {
    const allRef = useRef(null);

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

    const visible = useMemo(() => {
        const selectedIds = new Set((batch.selectedIds || []).map(String));
        if (batch.processed) {
            return (employees || []).filter((emp) => selectedIds.has(String(emp.employeeId || '')));
        }
        return (employees || []).filter((emp) => {
            if (batch.company && !sameCompany(companyKeyOf(emp), batch.company)) return false;
            const value = employeeAmount(emp);
            if (batch.salaryFilter === 'lte3000') return value <= SALARY_FILTER_LIMIT;
            if (batch.salaryFilter === 'gt3000') return value > SALARY_FILTER_LIMIT;
            return true;
        });
    }, [employees, batch.company, batch.salaryFilter, batch.processed, batch.selectedIds]);

    const grouped = useMemo(() => {
        const byCompany = new Map();
        for (const emp of visible) {
            const key = companyKeyOf(emp);
            if (!byCompany.has(key)) byCompany.set(key, []);
            byCompany.get(key).push(emp);
        }
        if (batch.company) {
            const match = [...byCompany.entries()].find(([name]) => sameCompany(name, batch.company));
            return [match || [batch.company, []]];
        }
        return [...byCompany.entries()].sort((a, b) =>
            a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }),
        );
    }, [visible, batch.company]);

    const selected = new Set(batch.selectedIds || []);
    const selectableIds = visible
        .map((emp) => String(emp.employeeId || ''))
        .filter((id) => id && !claimedElsewhere.has(id));
    const selectedVisible = selectableIds.filter((id) => selected.has(id));
    const allVisibleChecked =
        selectableIds.length > 0 && selectedVisible.length === selectableIds.length;

    useEffect(() => {
        if (!allRef.current) return;
        allRef.current.indeterminate =
            !batch.processed &&
            selectedVisible.length > 0 &&
            selectedVisible.length < selectableIds.length;
    }, [batch.processed, selectedVisible.length, selectableIds.length]);

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
                    </h3>
                    <p className="spcc-batch__sub">
                        {batch.processed
                            ? `${selected.size} employee${selected.size === 1 ? '' : 's'} processed`
                            : 'All employees, grouped by company.'}
                    </p>
                </div>
                <button type="button" className="spcc-batch__close" onClick={onRemove} aria-label="Close">
                    ×
                </button>
            </div>

            {batch.processed ? null : (
                <div className="spcc-batch__toolbar">
                    <div className="spcc-batch__companies" role="tablist" aria-label="Companies">
                        <button
                            type="button"
                            className={`spcc-batch__chip${!batch.company ? ' is-on' : ''}`}
                            onClick={() => onPatch({ company: '' })}
                        >
                            All employees
                        </button>
                        {companies.map((name) => (
                            <button
                                key={name}
                                type="button"
                                className={`spcc-batch__chip${sameCompany(batch.company, name) ? ' is-on' : ''}`}
                                onClick={() => onPatch({ company: sameCompany(batch.company, name) ? '' : name })}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                    <label className="spcc-batch__salary">
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
            )}

            <div className="spcc-batch__list">
                {batch.processed ? (
                    <div className="spcc-batch__row spcc-batch__row--head">
                        <span />
                        <span>Employee</span>
                        <span>Company</span>
                        <span>Actual amount</span>
                    </div>
                ) : (
                    <label className="spcc-batch__row spcc-batch__row--head">
                        <input
                            ref={allRef}
                            type="checkbox"
                            checked={allVisibleChecked}
                            disabled={!selectableIds.length}
                            onChange={(e) => toggleAll(e.target.checked)}
                        />
                        <span>Employee</span>
                        <span>Company</span>
                        <span>Actual amount</span>
                    </label>
                )}
                {grouped.length ? (
                    grouped.map(([company, rows]) => (
                        <div key={company} className="spcc-batch__group">
                            <p className="spcc-batch__group-title">{company}</p>
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
        </section>
    );
}

function blockerResponsible(category) {
    if (category === 'attendance') return 'Employee / HOD';
    if (category === 'leave') return 'Department HOD';
    if (category === 'finance') return 'Accounts';
    if (category === 'overtime') return 'HOD and HR';
    if (category === 'compoff') return 'HR';
    return 'HR';
}

function blockerReviewHref(item) {
    const id = String(item?.employeeId || '').trim();
    if (item?.category === 'finance') return '/HRM/LoanAndAdvance';
    if (id) return `/HRM/Salary/enroll/${encodeURIComponent(id)}`;
    return '/HRM/Salary';
}

function blockerDue(item) {
    const key = String(item?.dateKey || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(key)) return formatRequestDetail(key);
    return '—';
}

function PayrollBlockersModal({
    open,
    monthLabel,
    requests,
    filter,
    onFilter,
    sending,
    onClose,
    onSendReminders,
}) {
    if (!open || typeof document === 'undefined') return null;

    const counts = REQUEST_CATEGORIES.reduce((acc, row) => {
        acc[row.key] = requests.filter((item) => item.category === row.key).length;
        return acc;
    }, {});
    const visible = filter
        ? requests.filter((item) => item.category === filter)
        : requests;

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
                            {requests.length} pending item{requests.length === 1 ? '' : 's'}
                        </h3>
                        <p className="spcc-blockers__sub">{monthLabel} · Grouped by pending condition</p>
                    </div>
                    <button type="button" className="spcc-batch__close" onClick={onClose} aria-label="Close">
                        <X size={16} />
                    </button>
                </div>

                <div className="spcc-batch__companies" role="tablist" aria-label="Pending categories">
                    <button
                        type="button"
                        className={`spcc-batch__chip${!filter ? ' is-on' : ''}`}
                        onClick={() => onFilter('')}
                    >
                        All items ({requests.length})
                    </button>
                    {REQUEST_CATEGORIES.map((row) => (
                        <button
                            key={row.key}
                            type="button"
                            className={`spcc-batch__chip${filter === row.key ? ' is-on' : ''}`}
                            onClick={() => onFilter(row.key)}
                        >
                            {row.title} ({counts[row.key] || 0})
                        </button>
                    ))}
                </div>

                <div className="spcc-blockers__table" role="table" aria-label="Pending payroll items">
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
                                <span>
                                    {item.title}
                                    {item.detail ? ` · ${formatRequestDetail(item.detail)}` : ''}
                                </span>
                                <span>{blockerResponsible(item.category)}</span>
                                <span>{blockerDue(item)}</span>
                                <span>
                                    <Link href={blockerReviewHref(item)} className="spcc-blockers__review">
                                        Review
                                    </Link>
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="spcc-pay-empty">No pending items in this group.</p>
                    )}
                </div>

                <div className="spcc-blockers__foot">
                    <p className="spcc-blockers__note">
                        Payroll remains blocked until every mandatory item is completed. One reminder email is sent per employee, with all of their pending tasks.
                    </p>
                    <div className="spcc-blockers__actions">
                        <button type="button" className="spcc-btn spcc-btn--ghost" onClick={onClose}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="spcc-btn spcc-btn--primary"
                            disabled={!requests.length || sending}
                            onClick={onSendReminders}
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
    const [tabMode, setTabMode] = useState(TAB_MODE_GROUP);
    const [blockersOpen, setBlockersOpen] = useState(false);
    const [blockerFilter, setBlockerFilter] = useState('');
    const [sendingReminders, setSendingReminders] = useState(false);
    const [groupPolicies, setGroupPolicies] = useState({});
    const [loading, setLoading] = useState(true);
    const [policy, setPolicy] = useState(null);
    const [register, setRegister] = useState(null);
    const [paymentBatches, setPaymentBatches] = useState([]);
    const [paymentModalId, setPaymentModalId] = useState(null);
    const [savingPayment, setSavingPayment] = useState(false);
    const paymentSeq = useRef(1);

    const load = useCallback(async () => {
        if (!parsed) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [policyRes, registerRes] = await Promise.all([
                axiosInstance.get('/Employee/payroll-settings', { skipToast: true }).catch(() => null),
                axiosInstance
                    .get(`/Employee/salary-register/${parsed.monthKey}`, { skipToast: true })
                    .catch(() => null),
            ]);

            setPolicy(policyRes?.data ? policyFormFromApi(policyRes.data) : null);
            const data = registerRes?.data || null;
            setRegister(data);
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
        setPaymentModalId(null);
        setSavingPayment(false);
        setBlockersOpen(false);
        setBlockerFilter('');
        setTab(ALL_TAB_KEY);
        setTabMode(TAB_MODE_GROUP);
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
                28;
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
        const employees = Array.isArray(overview.employees) ? overview.employees : [];
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
        if (tabMode === TAB_MODE_COMPANY) {
            const companies = uniqueCompanyNames(
                (derived.employees || []).map((emp) => emp.companyName),
                (register?.employees || []).map((emp) => emp.companyName),
                (register?.enrollmentOverview?.companies || [])
                    .filter((row) => Number(row.totalActive) > 0)
                    .map((row) => row.name),
            );
            return [
                { key: ALL_TAB_KEY, label: 'All employees' },
                ...companies.map((name) => ({ key: toCompanyTabKey(name), label: name })),
            ];
        }
        return [
            { key: ALL_TAB_KEY, label: 'All employees' },
            ...derived.locationCards.map((loc) => ({ key: loc.key, label: loc.label })),
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
        const enrolledCount = employees.filter((emp) => emp.enrolled).length;
        const employeeIds = new Set(employees.map((emp) => String(emp.employeeId || '').trim()));
        const pendingRequests =
            tab === ALL_TAB_KEY
                ? derived.pendingRequests
                : derived.pendingRequests.filter((row) => {
                      if (employeeIds.has(String(row.employeeId || '').trim())) return true;
                      if (tabMode === TAB_MODE_COMPANY) {
                          return sameCompany(row.companyName, companyName);
                      }
                      return normalizeWorkLocationKey(row.staffType) === tab;
                  });
        const requestCountByEmployee = {};
        for (const row of pendingRequests) {
            const id = String(row.employeeId || '').trim();
            if (!id) continue;
            requestCountByEmployee[id] = (requestCountByEmployee[id] || 0) + 1;
        }

        const groupLabel = companyName || (focus ? focus.label : 'All employees');

        return {
            focus,
            cycle,
            salaryDateRows,
            employees,
            enrolledCount,
            pendingRequests,
            requestCountByEmployee,
            groupLabel,
            settingsHref: focus ? '/HRM/Salary/enroll' : '/HRM/Salary/salary-policy',
            settingsLabel: focus ? 'Edit group settings' : 'Edit settings',
            employeeCount: companyName ? employees.length : focus ? focus.totalActive : derived.totalEmployees,
        };
    }, [tab, tabMode, derived, policy, parsed, groupPolicies]);

    const readinessChecks = useMemo(() => {
        const requests = Array.isArray(view.pendingRequests) ? view.pendingRequests : [];
        const counts = REQUEST_CATEGORIES.reduce((acc, row) => {
            acc[row.key] = requests.filter((item) => item.category === row.key).length;
            return acc;
        }, {});
        const totalEmployees = Math.max(view.employeeCount, 0);
        const attendancePending = counts.attendance || 0;
        const attendanceDone = Math.max(totalEmployees - attendancePending, 0);
        const rows = REQUEST_CATEGORIES.map((meta) => {
            const pending = counts[meta.key] || 0;
            const done = pending === 0;
            return {
                tone: done ? 'ok' : meta.alert ? 'alert' : 'warn',
                title: meta.title,
                detail:
                    meta.key === 'attendance'
                        ? `${attendanceDone} of ${totalEmployees || attendanceDone + attendancePending} employees clear`
                        : meta.detail,
                badge: done ? 'Completed' : `${pending} pending`,
                badgeTone: done ? 'ok' : meta.alert ? 'alert' : 'warn',
            };
        });
        const pendingApprovals = REQUEST_CATEGORIES.reduce((sum, meta) => sum + (counts[meta.key] || 0), 0);
        const doneCount = rows.filter((row) => row.badge === 'Completed').length;
        const percent = Math.round((doneCount / REQUEST_CATEGORIES.length) * 100);

        return {
            percent,
            rows,
            pendingApprovals,
            categories: REQUEST_CATEGORIES.length,
            statusLabel: pendingApprovals === 0 ? 'Ready for payroll' : 'Validation in progress',
            doneCount,
            requests,
        };
    }, [view.employeeCount, view.pendingRequests]);

    const reminderDateLabel = useMemo(() => {
        if (!parsed) return '—';
        const nextMonth = parsed.monthIndex === 11 ? 0 : parsed.monthIndex + 1;
        const nextYear = parsed.monthIndex === 11 ? parsed.year + 1 : parsed.year;
        const day = Math.min(view.cycle.reminderDay || 5, lastDayOfMonth(nextYear, nextMonth));
        return `${day} ${MONTH_FULL[nextMonth]}`;
    }, [view.cycle.reminderDay, parsed]);

    const donutStyle = {
        background: `conic-gradient(#14B8A6 0 ${readinessChecks.percent}%, #E5E7EB ${readinessChecks.percent}% 100%)`,
    };

    const monthEmployees = useMemo(
        () => (Array.isArray(register?.employees) ? register.employees : []),
        [register?.employees],
    );

    const payrollRows = useMemo(() => {
        const overviewById = new Map(
            (derived.employees || []).map((emp) => [String(emp.employeeId || '').trim(), emp]),
        );
        return monthEmployees
            .filter((emp) => {
                if (tab === ALL_TAB_KEY) return true;
                if (tabMode === TAB_MODE_COMPANY) {
                    return sameCompany(companyKeyOf(emp), fromCompanyTabKey(tab));
                }
                return normalizeWorkLocationKey(emp.staffType) === tab;
            })
            .map((emp) => {
                const overview = overviewById.get(String(emp.employeeId || '').trim());
                if (!overview?.paymentType) return emp;
                return { ...emp, paymentType: overview.paymentType };
            });
    }, [monthEmployees, tab, tabMode, derived.employees]);

    const paymentEmployees = useMemo(() => {
        const byId = new Map();
        for (const emp of monthEmployees) {
            const id = String(emp.employeeId || '').trim();
            if (id) byId.set(id, emp);
        }
        for (const emp of derived.employees || []) {
            if (!emp.enrolled) continue;
            const id = String(emp.employeeId || '').trim();
            if (!id) continue;
            const existing = byId.get(id);
            if (!existing) continue;
            if ((!existing.companyName || existing.companyName === '—') && emp.companyName) {
                byId.set(id, { ...existing, companyName: emp.companyName });
            }
        }
        return [...byId.values()];
    }, [monthEmployees, derived.employees]);

    const paymentCompanyNames = useMemo(() => {
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
        for (const emp of paymentEmployees) add(companyKeyOf(emp));
        return names;
    }, [paymentEmployees]);

    const processedPaymentIds = useMemo(() => {
        const ids = new Set();
        for (const batch of paymentBatches) {
            if (!batch.processed) continue;
            for (const id of batch.selectedIds || []) ids.add(String(id));
        }
        return ids;
    }, [paymentBatches]);

    function claimedElsewhere(batchId) {
        const ids = new Set();
        for (const batch of paymentBatches) {
            if (batch.id === batchId) continue;
            for (const id of batch.selectedIds || []) ids.add(String(id));
        }
        return ids;
    }

    function openPaymentModal() {
        const id = `pay-${paymentSeq.current++}`;
        setPaymentBatches((prev) => [
            ...prev,
            {
                id,
                company: '',
                salaryFilter: '',
                selectedIds: [],
                processed: false,
            },
        ]);
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
        setSavingPayment(true);
        try {
            const res = await axiosInstance.post(`/Employee/salary-register/${parsed.monthKey}/payments`, {
                employeeIds: selectedIds,
            });
            const saved = paymentBatchFromApi(res.data?.payment);
            if (!saved) throw new Error('Payment was not returned.');
            setPaymentBatches((prev) => [...prev.filter((item) => item.id !== id && item.processed), saved]);
            setPaymentModalId(null);
            toast({
                title: 'Payment saved',
                description: `${saved.selectedIds.length} employee${
                    saved.selectedIds.length === 1 ? '' : 's'
                } assigned to Payment ${saved.paymentNo}.`,
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

    function handleValidate() {
        toast({
            title: 'Payroll validation',
            description: `Validation started for ${monthLabel}.`,
        });
    }

    function handleReminder() {
        toast({
            title: 'Reminder queued',
            description: `Accounts reminder for ${monthLabel} will be sent on ${reminderDateLabel}.`,
        });
    }

    async function sendBlockerReminders() {
        if (!parsed?.monthKey || sendingReminders) return;
        setSendingReminders(true);
        try {
            const res = await axiosInstance.post(
                `/Employee/salary-register/${parsed.monthKey}/blockers/remind`,
            );
            const sent = Number(res.data?.sent) || 0;
            const skipped = Number(res.data?.skipped) || 0;
            toast({
                title: 'Reminders sent',
                description: skipped
                    ? `${sent} employee${sent === 1 ? '' : 's'} emailed. ${skipped} skipped (no company email).`
                    : `${sent} employee${sent === 1 ? '' : 's'} emailed — one email each, with all pending tasks.`,
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

    useEffect(() => {
        if (!paymentModalId && !blockersOpen) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            if (paymentModalId) closePaymentModal();
            else setBlockersOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [paymentModalId, blockersOpen]);

    const processedPayments = paymentBatches.filter((batch) => batch.processed);
    const activePayment = paymentBatches.find((batch) => batch.id === paymentModalId) || null;
    const activePaymentIndex = paymentBatches.findIndex((batch) => batch.id === paymentModalId);

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
                        Configure the salary cycle, validate attendance and clear every approval before payroll
                        starts.
                    </p>
                </div>
                <div className="spcc-hero__actions">
                    <button type="button" className="spcc-btn spcc-btn--ghost" onClick={handleReminder}>
                        Send reminder
                    </button>
                    <button type="button" className="spcc-btn spcc-btn--primary" onClick={handleValidate}>
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
                        <span className={`spcc-dot${readinessChecks.pendingApprovals ? '' : ' spcc-dot--ok'}`} />
                        {readinessChecks.statusLabel}
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
                            pill="Soon"
                            pillTone="warn"
                        >
                            <div className="spcc-metric-slots">
                                <span className="spcc-metric-slot">Slot 1</span>
                                <span className="spcc-metric-slot">Slot 2</span>
                                <span className="spcc-metric-slot">Slot 3</span>
                            </div>
                            <p className="spcc-metric__soon">Coming soon</p>
                            <span className="spcc-metric__caption">
                                Split a month into more than one settlement.
                            </span>
                        </MetricCard>
                    </section>

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

                    <div className="spcc-grid">
                        <div className="spcc-col-main">
                            <section className="spcc-card">
                                <div className="spcc-card__head">
                                    <div>
                                        <h2 className="spcc-card__title">Employees</h2>
                                        <p className="spcc-card__sub">
                                            {payrollRows.length} employee{payrollRows.length === 1 ? '' : 's'}
                                            {tab !== ALL_TAB_KEY ? ` · ${view.groupLabel}` : ''}
                                            {' · '}
                                            {monthLabel}
                                        </p>
                                    </div>
                                </div>

                                <div className="spcc-pay-wrap">
                                    <div className="spcc-pay-table" role="table" aria-label="Salary employees">
                                        <div className="spcc-pay-row spcc-pay-row--head" role="row">
                                            <span>Sl no</span>
                                            <span>Employee name</span>
                                            <span>ID</span>
                                            <span>Monthly salary</span>
                                            <span>Basic salary</span>
                                            <span>Deduction</span>
                                            <span>Net salary</span>
                                            <span>Status</span>
                                            <span>Open</span>
                                        </div>
                                        {payrollRows.length ? (
                                            payrollRows.map((emp, index) => {
                                                const id = String(emp.employeeId || '');
                                                const processed = processedPaymentIds.has(id);
                                                const status = processed ? 'Processed' : String(emp.status || 'Ready');
                                                const pending = !processed && status.toLowerCase() === 'pending';
                                                const netSalary = emp.actualSalary ?? emp.monthlySalary;
                                                return (
                                                    <div key={emp.employeeId || emp.slNo || index} className="spcc-pay-row" role="row">
                                                        <span className="tabular-nums">{emp.slNo || index + 1}</span>
                                                        <span className="spcc-pay-emp">{emp.name || id || '—'}</span>
                                                        <span className="spcc-pay-code">{id || '—'}</span>
                                                        <span className="tabular-nums">{formatMoney(emp.monthlySalary)}</span>
                                                        <span className="tabular-nums">{formatMoney(emp.basicSalary)}</span>
                                                        <span className="tabular-nums">{formatMoney(emp.deduction)}</span>
                                                        <span className="tabular-nums">{formatMoney(netSalary)}</span>
                                                        <span>
                                                            <StatusPill tone={pending ? 'warn' : 'ok'}>
                                                                {status}
                                                            </StatusPill>
                                                        </span>
                                                        <span>
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
                                <div className="spcc-pay-cards">
                                    {processedPayments.map((batch, index) => (
                                        <PaymentResultCard
                                            key={batch.id}
                                            index={index}
                                            batch={batch}
                                            employees={paymentEmployees}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        className="spcc-btn spcc-btn--primary spcc-pay-cards__btn"
                                        onClick={openPaymentModal}
                                        disabled={!payrollRows.some((emp) => !processedPaymentIds.has(String(emp.employeeId || '')))}
                                    >
                                        Process payment
                                    </button>
                                </div>
                            </section>
                        </div>

                        <aside className="spcc-col-side">
                            <section className="spcc-card">
                                <div className="spcc-card__head spcc-card__head--ready">
                                    <div>
                                        <h2 className="spcc-card__title">Payroll readiness</h2>
                                        <p className="spcc-card__sub">
                                            Checks for {monthLabel}
                                        </p>
                                    </div>
                                    <div className="spcc-donut" style={donutStyle} aria-label={`${readinessChecks.percent}% ready`}>
                                        <span className="spcc-donut__inner">{readinessChecks.percent}%</span>
                                    </div>
                                </div>

                                <div className="spcc-ready-list">
                                    {readinessChecks.rows.map((row) => (
                                        <ReadinessRow key={row.title} {...row} />
                                    ))}
                                </div>

                                <div className="spcc-req-block">
                                    <button
                                        type="button"
                                        className="spcc-btn spcc-btn--soft"
                                        onClick={() => {
                                            setBlockerFilter('');
                                            setBlockersOpen(true);
                                        }}
                                    >
                                        <span>
                                            {tab !== ALL_TAB_KEY
                                                ? `View ${view.groupLabel} employees`
                                                : 'View all employees'}
                                        </span>
                                    </button>
                                </div>
                            </section>
                        </aside>
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
                                          employees={paymentEmployees}
                                          companyNames={paymentCompanyNames}
                                          claimedElsewhere={claimedElsewhere(activePayment.id)}
                                          onPatch={(patch) => patchPaymentBatch(activePayment.id, patch)}
                                          onRemove={closePaymentModal}
                                      />
                                      {activePayment.processed ? null : (
                                          <div className="spcc-modal__pay-footer">
                                              <button
                                                  type="button"
                                                  className="spcc-btn spcc-btn--primary spcc-batch__done"
                                                  disabled={
                                                      savingPayment ||
                                                      !(activePayment.selectedIds || []).length
                                                  }
                                                  onClick={() => completePaymentBatch(activePayment.id)}
                                              >
                                                  {savingPayment ? 'Saving…' : 'Done · process payment'}
                                              </button>
                                          </div>
                                      )}
                                  </div>
                              </div>,
                              document.body,
                          )
                        : null}

                    <PayrollBlockersModal
                        open={blockersOpen}
                        monthLabel={monthLabel}
                        requests={readinessChecks.requests}
                        filter={blockerFilter}
                        onFilter={setBlockerFilter}
                        sending={sendingReminders}
                        onClose={() => setBlockersOpen(false)}
                        onSendReminders={sendBlockerReminders}
                    />
                </>
            )}
        </div>
    );
}
