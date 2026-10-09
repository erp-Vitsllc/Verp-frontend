'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Building2,
    Calendar,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    Clock,
    Fingerprint,
    HardHat,
    Users,
    UserX,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';

const PERIODS = [
    { id: 'today', label: 'Today' },
    { id: 'previous', label: 'Previous Day' },
    { id: 'week', label: 'This Week' },
    { id: 'lastWeek', label: 'Last Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom Date' },
];

function dubaiTodayKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function shiftDateKey(key, days) {
    const [year, month, day] = String(key || '').split('-').map(Number);
    if (!year || !month || !day) return '';
    const next = new Date(Date.UTC(year, month - 1, day + days));
    return next.toISOString().slice(0, 10);
}

function mondayOf(key) {
    const [year, month, day] = String(key || '').split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const sinceMonday = weekday === 0 ? 6 : weekday - 1;
    return shiftDateKey(key, -sinceMonday);
}

function monthBounds(key) {
    const [year, month] = String(key || '').split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthKey = String(key || '').slice(0, 7);
    return { from: `${monthKey}-01`, to: `${monthKey}-${String(last).padStart(2, '0')}` };
}

function rangeForPeriod(period, today, customFrom, customTo) {
    if (period === 'previous') {
        const day = shiftDateKey(today, -1);
        return { from: day, to: day };
    }
    if (period === 'week') {
        const from = mondayOf(today);
        return { from, to: today };
    }
    if (period === 'lastWeek') {
        const thisMonday = mondayOf(today);
        return { from: shiftDateKey(thisMonday, -7), to: shiftDateKey(thisMonday, -1) };
    }
    if (period === 'month') {
        const bounds = monthBounds(today);
        return { from: bounds.from, to: today < bounds.to ? today : bounds.to };
    }
    if (period === 'custom') {
        const from = customFrom && customFrom <= customTo ? customFrom : customFrom || today;
        const to = customTo && customTo >= from ? customTo : from;
        return { from, to };
    }
    return { from: today, to: today };
}

function countLabel(phrase, noun) {
    if (phrase === 'Selected') return `Selected ${noun}`;
    return `${phrase}'s ${noun}`;
}

function periodPhrase(period) {
    if (period === 'previous') return 'Previous day';
    if (period === 'week') return 'This week';
    if (period === 'lastWeek') return 'Last week';
    if (period === 'month') return 'This month';
    if (period === 'custom') return 'Selected';
    return 'Today';
}

function dayHasActivity(raw) {
    return Boolean(
        Number(raw?.present) ||
            Number(raw?.onLeave) ||
            Number(raw?.lateArrived) ||
            Number(raw?.sickLeave) ||
            Number(raw?.compOffLeave) ||
            Number(raw?.workFromHome) ||
            Number(raw?.notMarked) ||
            Number(raw?.missedPunch) ||
            Number(raw?.earlyGo) ||
            Number(raw?.halfDay) ||
            Number(raw?.weeklyOff) ||
            Number(raw?.holiday) ||
            raw?.isWeeklyOff,
    );
}

const EMPTY_PEOPLE = { present: [], absent: [], late: [], leave: [], missed: [], total: [] };

function summarizeDays(payload, from, to, today) {
    const days = payload?.days && typeof payload.days === 'object' ? payload.days : {};
    const totals = { present: 0, absent: 0, late: 0, leave: 0, missed: 0, total: 0 };
    const people = {
        present: [],
        absent: [],
        late: [],
        leave: [],
        missed: [],
        total: [],
    };
    let roster = Number(payload?.totalStaff) || 0;
    let rosterDate = '';
    for (const [date, raw] of Object.entries(days)) {
        if (date < from || date > to) continue;
        const active = Number(raw?.activeEmployees) || 0;
        const dayPeople = raw?.people || {};
        if (active && date <= today && date >= rosterDate) {
            roster = active;
            rosterDate = date;
            people.total = Array.isArray(dayPeople.total) ? dayPeople.total : [];
        }
        // Present is on-time only. Late stays in its own row so the header matches the calendar.
        totals.present += Number(raw?.present) || 0;
        totals.late += Number(raw?.lateArrived) || 0;
        totals.leave +=
            (Number(raw?.onLeave) || 0) +
            (Number(raw?.sickLeave) || 0) +
            (Number(raw?.compOffLeave) || 0);
        totals.missed += Number(raw?.missedPunch) || 0;
        const unmarked = Number(raw?.notMarked) || 0;
        if (!dayHasActivity(raw) && !raw?.isWeeklyOff && active > 0 && date <= today) {
            totals.absent += active;
        } else {
            totals.absent += unmarked;
        }
        if (date > today) continue;
        for (const key of ['present', 'absent', 'late', 'leave', 'missed']) {
            if (key === 'absent' && raw?.isWeeklyOff) continue;
            const list = dayPeople[key];
            if (Array.isArray(list) && list.length) people[key].push(...list);
        }
    }
    for (const key of ['present', 'absent', 'late', 'leave', 'missed']) {
        people[key].sort(
            (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.name).localeCompare(String(b.name)),
        );
    }
    totals.total = roster;
    totals.people = people;
    return totals;
}

const EMPTY_TOTALS = {
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    missed: 0,
    total: 0,
    people: EMPTY_PEOPLE,
};

function formatListDate(key) {
    const [year, month, day] = String(key || '').split('-').map(Number);
    if (!year || !month || !day) return key || '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[month - 1]} ${year}`;
}

function HeaderPeopleModal({ open, title, hint, rows, onClose }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    const list = Array.isArray(rows) ? rows : [];
    const dates = new Set(list.map((row) => row.date).filter(Boolean));
    const showDate = dates.size > 1;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="attendance-header-people-title"
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                        <h3 id="attendance-header-people-title" className="text-base font-bold text-slate-900">
                            {title}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {hint}
                            {list.length ? ` · ${list.length}` : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {list.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-slate-400">No employees in this list.</p>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-5 py-2 font-semibold">#</th>
                                    <th className="px-2 py-2 font-semibold">Employee</th>
                                    <th className="px-2 py-2 font-semibold">Emp No</th>
                                    {showDate ? <th className="px-5 py-2 font-semibold">Date</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((row, index) => (
                                    <tr key={`${row.employeeMongoId}-${row.date}-${index}`} className="border-t border-slate-100 text-sm text-slate-800">
                                        <td className="px-5 py-2.5 text-slate-400 tabular-nums">{index + 1}</td>
                                        <td className="px-2 py-2.5 font-medium">{row.name || 'Employee'}</td>
                                        <td className="px-2 py-2.5 tabular-nums text-slate-500">{row.employeeId || '—'}</td>
                                        {showDate ? (
                                            <td className="px-5 py-2.5 text-slate-500">{formatListDate(row.date)}</td>
                                        ) : null}
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

function SummaryRow({ icon: Icon, iconClass, rowClass, label, hint, value, valueClass, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors ${rowClass}`}
        >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                <Icon size={14} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-800 leading-tight">{label}</span>
                <span className="block text-[10px] text-slate-500 leading-tight">{hint}</span>
            </span>
            <span className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</span>
            <ChevronRight size={14} className="shrink-0 text-slate-300" />
        </button>
    );
}

function PeopleCard({ title, hint, icon: Icon, totals, phrase, onOpen }) {
    const rows = [
        {
            key: 'present',
            icon: Users,
            iconClass: 'bg-emerald-100 text-emerald-600',
            rowClass: 'bg-emerald-50/80 hover:bg-emerald-50',
            label: countLabel(phrase, 'Present'),
            value: totals.present,
            valueClass: 'text-emerald-600',
        },
        {
            key: 'absent',
            icon: UserX,
            iconClass: 'bg-rose-100 text-rose-600',
            rowClass: 'bg-rose-50/80 hover:bg-rose-50',
            label: countLabel(phrase, 'Absent'),
            value: totals.absent,
            valueClass: 'text-rose-600',
        },
        {
            key: 'late',
            icon: Clock,
            iconClass: 'bg-amber-100 text-amber-600',
            rowClass: 'bg-amber-50/80 hover:bg-amber-50',
            label: countLabel(phrase, 'Late-Arrival'),
            value: totals.late,
            valueClass: 'text-amber-500',
        },
        {
            key: 'leave',
            icon: CalendarDays,
            iconClass: 'bg-blue-100 text-blue-600',
            rowClass: 'bg-blue-50/80 hover:bg-blue-50',
            label: countLabel(phrase, 'Leave'),
            value: totals.leave,
            valueClass: 'text-blue-600',
        },
        {
            key: 'missed',
            icon: Fingerprint,
            iconClass: 'bg-orange-100 text-orange-600',
            rowClass: 'bg-orange-50/80 hover:bg-orange-50',
            label: countLabel(phrase, 'Missed Punch'),
            value: totals.missed,
            valueClass: 'text-orange-600',
        },
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5 min-w-0">
            <div className="flex items-center gap-2 mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                    <Icon size={15} />
                </span>
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            </div>
            <div className="flex flex-col gap-1.5">
                {rows.map((row) => (
                    <SummaryRow
                        key={row.key}
                        icon={row.icon}
                        iconClass={row.iconClass}
                        rowClass={row.rowClass}
                        label={row.label}
                        hint={hint}
                        value={row.value}
                        valueClass={row.valueClass}
                        onClick={() => onOpen?.(row.key)}
                    />
                ))}
                <button
                    type="button"
                    onClick={() => onOpen?.('total')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-50"
                >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <Users size={14} />
                    </span>
                    <span className="min-w-0 flex-1 text-xs font-semibold text-slate-800">
                        Total {title.replace('People', 'Employees')}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-slate-900">{totals.total}</span>
                    <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
            </div>
        </div>
    );
}

export default function AttendanceHeaderSummary({ staffTabs = [], onSelectGroup, actions = null }) {
    const today = dubaiTodayKey();
    const [period, setPeriod] = useState('today');
    const [customFrom, setCustomFrom] = useState(today);
    const [customTo, setCustomTo] = useState(today);
    const [rangeOpen, setRangeOpen] = useState(false);
    const rangeRef = useRef(null);
    const [office, setOffice] = useState(EMPTY_TOTALS);
    const [site, setSite] = useState(EMPTY_TOTALS);
    const [listModal, setListModal] = useState(null);

    const range = useMemo(
        () => rangeForPeriod(period, today, customFrom, customTo),
        [period, today, customFrom, customTo],
    );
    const phrase = periodPhrase(period);
    const officeLabel = staffTabs.find((tab) => tab.key === 'office')?.label || 'Office Staff';
    const siteLabel = staffTabs.find((tab) => tab.key === 'site')?.label || 'Site Staff';

    useEffect(() => {
        if (!rangeOpen) return undefined;
        const onPointerDown = (event) => {
            if (rangeRef.current && !rangeRef.current.contains(event.target)) setRangeOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [rangeOpen]);

    useEffect(() => {
        let cancelled = false;
        const loadGroup = async (staffType) => {
            const res = await axiosInstance.get('/Attendance/calendar', {
                params: { from: range.from, to: range.to, staffType, includePeople: '1' },
                skipToast: true,
            });
            return summarizeDays(res.data, range.from, range.to, today);
        };
        Promise.all([loadGroup('office'), loadGroup('site')])
            .then(([officeTotals, siteTotals]) => {
                if (cancelled) return;
                setOffice(officeTotals);
                setSite(siteTotals);
            })
            .catch(() => {
                if (cancelled) return;
                setOffice(EMPTY_TOTALS);
                setSite(EMPTY_TOTALS);
            });
        return () => {
            cancelled = true;
        };
    }, [range.from, range.to, today]);

    const openPeopleList = (staffType, key) => {
        onSelectGroup?.(staffType);
        const totals = staffType === 'site' ? site : office;
        const label = staffType === 'site' ? siteLabel : officeLabel;
        const noun = {
            present: 'Present',
            absent: 'Absent',
            late: 'Late-Arrival',
            leave: 'Leave',
            missed: 'Missed Punch',
        }[key];
        setListModal({
            title: key === 'total'
                ? `Total ${staffType === 'site' ? 'Site' : 'Office'} Employees`
                : countLabel(phrase, noun || 'Employees'),
            hint: label,
            rows: totals.people?.[key] || [],
        });
    };

    const filterButtonClass = (selected) =>
        `h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
            selected
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`;

    return (
        <section className="mb-3">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-3">
                <div className="min-w-0 shrink-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Attendance</h1>
                    <p className="text-sm text-gray-600">Review staff attendance and pending approvals</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
                {PERIODS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                            setPeriod(item.id);
                            if (item.id === 'custom') setRangeOpen(true);
                        }}
                        className={filterButtonClass(period === item.id)}
                    >
                        {item.label}
                    </button>
                ))}
                <div className="relative" ref={rangeRef}>
                    <button
                        type="button"
                        onClick={() => setRangeOpen((open) => !open)}
                        className={`h-8 pl-2.5 pr-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap ${
                            period === 'custom'
                                ? 'border-blue-600 text-blue-700 bg-blue-50'
                                : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                        }`}
                    >
                        <Calendar size={14} className="text-slate-500" />
                        <span>Select Date Range</span>
                        <ChevronDown size={14} className={`text-slate-400 ${rangeOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {rangeOpen ? (
                        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
                            <input
                                type="date"
                                value={customFrom}
                                max={customTo || undefined}
                                onChange={(event) => {
                                    setCustomFrom(event.target.value);
                                    setPeriod('custom');
                                }}
                                className="mb-3 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-700"
                            />
                            <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
                            <input
                                type="date"
                                value={customTo}
                                min={customFrom || undefined}
                                onChange={(event) => {
                                    setCustomTo(event.target.value);
                                    setPeriod('custom');
                                }}
                                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-700"
                            />
                        </div>
                    ) : null}
                </div>
                {actions}
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <PeopleCard
                    title="Office People"
                    hint={officeLabel}
                    icon={Building2}
                    totals={office}
                    phrase={phrase}
                    onOpen={(key) => openPeopleList('office', key)}
                />
                <PeopleCard
                    title="Site People"
                    hint={siteLabel}
                    icon={HardHat}
                    totals={site}
                    phrase={phrase}
                    onOpen={(key) => openPeopleList('site', key)}
                />
            </div>
            <HeaderPeopleModal
                open={Boolean(listModal)}
                title={listModal?.title || ''}
                hint={listModal?.hint || ''}
                rows={listModal?.rows || []}
                onClose={() => setListModal(null)}
            />
        </section>
    );
}
