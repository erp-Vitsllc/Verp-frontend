'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowDown,
    ArrowUp,
    Ban,
    Box,
    Calendar,
    Clock,
    Package,
    PackagePlus,
    ShoppingCart,
    Truck,
    Users,
    Warehouse,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import RechartsBox from '@/components/charts/RechartsBox';
import axiosInstance from '@/utils/axios';
import { apiMessage, getInventoryDashboard } from './item-master/itemMasterApi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MODES = [
    { id: 'year', label: 'Year' },
    { id: 'months', label: 'Months' },
    { id: 'custom', label: 'Custom' },
];
const CATEGORY_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#22C55E', '#EAB308', '#EC4899', '#14B8A6', '#6366F1'];
const STOCK_COLORS = {
    'Stock In': '#22C55E',
    'Low Stock': '#F59E0B',
    'Out of Stock': '#EF4444',
};
const BILL_COLORS = {
    Draft: '#94A3B8',
    Pending: '#F59E0B',
    Approved: '#22C55E',
};
const STATUS_CLASS = {
    'Low Stock': 'bg-orange-50 text-orange-600',
    'Out of Stock': 'bg-red-50 text-red-600',
    Approved: 'bg-emerald-50 text-emerald-600',
    Pending: 'bg-amber-50 text-amber-600',
    Draft: 'bg-slate-100 text-slate-600',
};

const STATS = [
    {
        key: 'totalItems',
        icon: Package,
        tint: 'bg-blue-50 text-blue-600',
        label: 'Total Items',
        sub: 'Catalog at period end',
        href: '/inventory/item-master?status=All',
        hint: 'Items that existed by the end of the selected period.',
    },
    {
        key: 'inventoryValue',
        icon: Warehouse,
        tint: 'bg-emerald-50 text-emerald-600',
        label: 'Inventory Value',
        money: true,
        sub: 'On hand at period end',
        href: '/inventory/item-master?status=All',
        hint: 'On-hand quantity at the period end, priced from the last purchase on or before that date.',
    },
    {
        key: 'purchasedValue',
        icon: ShoppingCart,
        tint: 'bg-sky-50 text-sky-600',
        label: 'Total Purchased Value',
        money: true,
        sub: 'Posted bills in this period',
        href: '/inventory/bills',
        hint: 'Total of approved purchase bills in the selected period.',
    },
    {
        key: 'deliveredValue',
        icon: Truck,
        tint: 'bg-rose-50 text-rose-500',
        label: 'Total Delivered Value',
        money: true,
        sub: 'Confirmed deliveries',
        href: '/inventory/delivery',
        hint: 'Value of items on confirmed deliveries in the selected period.',
    },
    {
        key: 'lowStock',
        icon: Box,
        tint: 'bg-orange-50 text-orange-500',
        label: 'Low Stock Items',
        sub: 'Below reservation quantity',
        href: '/inventory/item-master?status=Low%20Stock',
        hint: 'Items below the subcategory reservation quantity at the period end.',
        worseWhenUp: true,
    },
    {
        key: 'deadStock',
        icon: Ban,
        tint: 'bg-red-50 text-red-500',
        label: 'Dead Stock',
        sub: 'No add, bill, or delivery',
        href: '/inventory/item-master?status=All',
        hint: 'Items that already existed and were not created, billed, or delivered in the selected period.',
        worseWhenUp: true,
    },
    {
        key: 'activeVendors',
        icon: Users,
        tint: 'bg-violet-50 text-violet-600',
        label: 'Active Vendors',
        sub: 'With a purchase in this period',
        href: '/inventory/vendor-management',
        hint: 'Vendors with an approved purchase bill in the selected period.',
    },
    {
        key: 'itemsAdded',
        icon: PackagePlus,
        tint: 'bg-teal-50 text-teal-600',
        label: 'Items Added',
        sub: 'Created in this period',
        href: '/inventory/item-master?status=All',
        hint: 'Item records created in the selected period.',
    },
];

function dubaiToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function firstName(value) {
    const text = String(value || '').trim();
    return text ? text.split(/\s+/)[0] : '';
}

function formatCount(value) {
    return Math.round(Number(value) || 0).toLocaleString('en-US');
}

function formatPrice(value) {
    const amount = Number(value) || 0;
    const hasFils = Math.round(amount * 100) % 100 !== 0;
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: hasFils ? 2 : 0,
        maximumFractionDigits: 2,
    });
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    const hasFils = Math.round(amount * 100) % 100 !== 0;
    return `AED ${amount.toLocaleString('en-US', {
        minimumFractionDigits: hasFils ? 2 : 0,
        maximumFractionDigits: hasFils ? 2 : 0,
    })}`;
}

function compactNumber(value) {
    const amount = Number(value) || 0;
    const absolute = Math.abs(amount);
    const scaled = absolute >= 1_000_000 ? amount / 1_000_000 : amount / 1_000;
    const text = String(Math.round(scaled * 10) / 10).replace(/\.0$/, '');
    if (absolute >= 1_000_000) return `${text}M`;
    if (absolute >= 1_000) return `${text}K`;
    return Math.round(amount).toLocaleString('en-US');
}

function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '—';
    return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function percentChange(current, previous) {
    const next = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (!prev) return '';
    const pct = Math.round(((next - prev) / prev) * 100);
    if (!pct) return '';
    return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function changeClass(stat, change) {
    if (!change) return 'text-slate-300';
    const up = change.startsWith('+');
    const good = stat.worseWhenUp ? !up : up;
    return good ? 'text-emerald-500' : 'text-red-500';
}

function shortName(value) {
    const text = String(value || '');
    return text.length > 14 ? `${text.slice(0, 13)}…` : text;
}

function packCategorySlices(rows) {
    return (rows || []).map((row, index) => ({
        name: row.name,
        value: row.value,
        label: formatMoney(row.value),
        color: row.name === 'Others' ? '#94A3B8' : CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
}

function countSlices(rows, colors) {
    return (rows || []).map((row) => ({
        name: row.name,
        value: row.value,
        label: formatCount(row.value),
        color: colors[row.name] || '#94A3B8',
    }));
}

function Card({ title, action, children, className = '' }) {
    return (
        <section className={`min-w-0 rounded-xl border border-[#E6EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
            {title ? (
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
                    {action || null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

function ViewAll({ href }) {
    return <Link href={href} className="text-[12px] font-medium text-blue-600 hover:underline">View All</Link>;
}

function StatusPill({ status }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[status] || 'bg-slate-100 text-slate-600'}`}>
            {status}
        </span>
    );
}

function EmptyNote({ children }) {
    return <p className="flex h-[168px] items-center justify-center text-center text-[12px] text-slate-400">{children}</p>;
}

function Donut({ data, center, caption, empty }) {
    if (!data.length) return <EmptyNote>{empty}</EmptyNote>;
    return (
        <div className="flex min-w-0 items-center gap-2">
            <div className="relative h-[168px] w-[168px] shrink-0">
                <RechartsBox height={168} minHeight={168}>
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={1.4} stroke="#fff" strokeWidth={2}>
                            {data.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </RechartsBox>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-center text-[13px] font-bold leading-tight text-slate-800">{center}</span>
                    {caption ? <span className="text-[10px] text-slate-400">{caption}</span> : null}
                </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
                {data.map((item) => (
                    <li key={item.name} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        <span className="shrink-0 font-medium text-slate-700">{item.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ChartTooltip({ active, payload, label, money = false }) {
    if (!active || !payload?.length) return null;
    const value = payload[0]?.value;
    return (
        <div className="rounded-lg border border-[#E6EDF5] bg-white px-2.5 py-1.5 text-[12px] shadow-sm">
            <p className="text-slate-500">{label}</p>
            <p className="font-semibold text-slate-800">{money ? formatMoney(value) : formatCount(value)}</p>
        </div>
    );
}

function useViewerName() {
    const [name, setName] = useState('');
    useEffect(() => {
        try {
            const raw = localStorage.getItem('employeeUser') || localStorage.getItem('user');
            const user = raw ? JSON.parse(raw) : null;
            const saved = firstName(user?.name || user?.username);
            if (saved) setName(saved);
        } catch {
            /* The stored profile is optional. */
        }
        let active = true;
        axiosInstance.get('/Employee/me', { skipToast: true })
            .then((response) => {
                if (!active) return;
                const employee = response.data || {};
                const next = firstName([employee.firstName, employee.lastName].filter(Boolean).join(' '));
                if (next) setName(next);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);
    return name;
}

function useDubaiClock() {
    const [now, setNow] = useState(null);
    useEffect(() => {
        const tick = () => setNow(new Date());
        tick();
        const timer = setInterval(tick, 30000);
        return () => clearInterval(timer);
    }, []);
    if (!now) return { day: '', time: '' };
    return {
        day: new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Dubai',
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(now),
        time: new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Dubai',
            hour: 'numeric',
            minute: '2-digit',
        }).format(now),
    };
}

export default function InventoryDashboard() {
    const today = dubaiToday();
    const name = useViewerName();
    const clock = useDubaiClock();
    const [mode, setMode] = useState('year');
    const [year, setYear] = useState(Number(today.slice(0, 4)));
    const [months, setMonths] = useState([Number(today.slice(5, 7))]);
    const [start, setStart] = useState(`${today.slice(0, 4)}-01-01`);
    const [end, setEnd] = useState(today);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const monthsKey = months.join(',');
    const rangeIncomplete = mode === 'custom' && (!start || !end);
    const rangeError = mode === 'custom' && start && end && start > end ? 'The start date must be on or before the end date.' : '';

    useEffect(() => {
        if (rangeError || rangeIncomplete) return undefined;
        let active = true;
        const params = { mode };
        if (mode === 'custom') {
            params.start = start;
            params.end = end;
        } else {
            params.year = year;
            if (mode === 'months') params.months = monthsKey;
        }
        setLoading(true);
        getInventoryDashboard(params)
            .then((payload) => {
                if (active) {
                    setData(payload);
                    setError('');
                }
            })
            .catch((err) => {
                if (active) setError(apiMessage(err, 'Could not load the inventory dashboard.'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [mode, year, monthsKey, start, end, rangeError, rangeIncomplete]);

    const yearOptions = useMemo(() => {
        const years = new Set(data?.years || []);
        years.add(year);
        return [...years].sort((left, right) => left - right);
    }, [data, year]);

    function toggleMonth(month) {
        setMonths((current) => {
            if (current.includes(month)) {
                if (current.length === 1) return current;
                return current.filter((value) => value !== month);
            }
            return [...current, month].sort((left, right) => left - right);
        });
    }

    const stats = data?.stats || {};
    const previous = data?.previous || {};
    const categories = packCategorySlices(data?.categories);
    const categoryTotal = categories.reduce((sum, row) => sum + row.value, 0);
    const vendors = (data?.vendors || []).map((row) => ({ ...row, label: compactNumber(row.value) }));
    const stockStatus = countSlices(data?.stockStatus, STOCK_COLORS);
    const billStatus = countSlices(data?.billStatus, BILL_COLORS);
    const stockTotal = stockStatus.reduce((sum, row) => sum + row.value, 0);
    const billTotal = billStatus.reduce((sum, row) => sum + row.value, 0);

    return (
        <>
            <main className="flex-1 space-y-4 bg-[#F4F7FB] p-4 text-slate-800 lg:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-[22px] font-bold tracking-tight text-slate-900">
                            Welcome back{name ? `, ${name}` : ''}!
                        </h2>
                        <p className="text-[13px] text-slate-500">Here&apos;s what&apos;s happening with your inventory.</p>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        <div className="flex items-center gap-4 self-start rounded-xl border border-[#E6EDF5] bg-white px-4 py-2.5 text-[12px] text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:self-end">
                            <span className="inline-flex items-center gap-2">
                                <Calendar size={14} className="text-blue-500" />
                                {clock.day || '—'}
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <Clock size={14} className="text-blue-500" />
                                {clock.time || '—'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                                {MODES.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setMode(option.id)}
                                        className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${mode === option.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            {mode === 'custom' ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <input aria-label="Start date" type="date" value={start} onChange={(event) => setStart(event.target.value)} className="h-8 rounded-md border border-[#E6EDF5] bg-white px-2 text-[12px] text-slate-700" />
                                    <span className="text-[12px] text-slate-400">to</span>
                                    <input aria-label="End date" type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="h-8 rounded-md border border-[#E6EDF5] bg-white px-2 text-[12px] text-slate-700" />
                                </div>
                            ) : (
                                <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-8 rounded-md border border-[#E6EDF5] bg-white px-2 text-[12px] text-slate-700">
                                    {yearOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            )}
                            {loading && data ? <span className="text-[11px] text-slate-400">Updating…</span> : null}
                        </div>
                        {mode === 'months' ? (
                            <div className="flex max-w-full flex-wrap justify-end gap-1">
                                {MONTHS.map((label, index) => {
                                    const month = index + 1;
                                    const selected = months.includes(month);
                                    return (
                                        <button
                                            key={label}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => toggleMonth(month)}
                                            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${selected ? 'bg-blue-600 text-white' : 'border border-[#E6EDF5] bg-white text-slate-500'}`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                </div>

                {rangeError ? <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">{rangeError}</p> : null}
                {error ? <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p> : null}
                {!data && loading ? <p className="text-[13px] text-slate-500">Loading inventory…</p> : null}

                {data ? (
                <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                    {STATS.map((stat) => {
                        const Icon = stat.icon;
                        const change = data ? percentChange(stats[stat.key], previous[stat.key]) : '';
                        const value = !data ? '—' : (stat.money ? formatMoney(stats[stat.key]) : formatCount(stats[stat.key]));
                        return (
                            <Link
                                key={stat.key}
                                href={stat.href}
                                title={stat.hint}
                                className="block h-full rounded-xl border border-[#E6EDF5] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-blue-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                            >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.tint}`}>
                                        <Icon size={16} />
                                    </span>
                                    {change ? <span className={`text-[11px] font-semibold ${changeClass(stat, change)}`}>{change}</span> : <span />}
                                </div>
                                <p className="break-words text-[15px] font-bold leading-tight tracking-tight text-slate-900">{value}</p>
                                <p className="mt-0.5 text-[11px] font-medium leading-tight text-slate-600">{stat.label}</p>
                                <p className="mt-0.5 min-h-[28px] text-[10px] leading-snug text-slate-400">{stat.sub}</p>
                            </Link>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <Card title="Inventory Value by Category">
                        <Donut data={categories} center="AED" caption={compactNumber(categoryTotal)} empty="No inventory value in this period." />
                    </Card>
                    <Card
                        title="Monthly Purchase Value"
                        action={(
                            <span className="rounded-md border border-[#E6EDF5] bg-white px-2 py-1 text-[11px] text-slate-500">
                                {data?.range?.label || '—'}
                            </span>
                        )}
                    >
                        <RechartsBox height={188} minHeight={188}>
                            <BarChart data={data?.monthly || []} barSize={16} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="#EEF2F7" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis tickFormatter={compactNumber} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={36} />
                                <Tooltip content={(props) => <ChartTooltip {...props} money />} />
                                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </RechartsBox>
                    </Card>
                    <Card title="Top Vendors by Purchase Value" action={<ViewAll href="/inventory/vendor-management" />}>
                        {vendors.length ? (
                            <RechartsBox height={210} minHeight={210}>
                                <BarChart data={vendors} barSize={28} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
                                    <CartesianGrid vertical={false} stroke="#EEF2F7" />
                                    <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={72} tickFormatter={shortName} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={compactNumber} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={36} />
                                    <Tooltip content={(props) => <ChartTooltip {...props} money />} />
                                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="label" position="top" style={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} />
                                    </Bar>
                                </BarChart>
                            </RechartsBox>
                        ) : (
                            <EmptyNote>No vendor purchases in this period.</EmptyNote>
                        )}
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <Card title="Low Stock Items" action={<ViewAll href="/inventory/item-master?status=Low%20Stock" />}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                                    <th className="pb-2 font-medium">#</th>
                                    <th className="pb-2 font-medium">Item</th>
                                    <th className="pb-2 font-medium">Available</th>
                                    <th className="pb-2 font-medium">Reorder</th>
                                    <th className="pb-2 font-medium">UOM</th>
                                    <th className="pb-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.lowStock || []).map((row, index) => (
                                    <tr key={row.id} className="border-t border-slate-100 text-[11px] text-slate-700">
                                        <td className="py-2 text-slate-400">{index + 1}</td>
                                        <td className="py-2 pr-2 font-medium">
                                            <Link href={`/inventory/item-master/${row.id}`} className="hover:text-blue-600 hover:underline">{row.item}</Link>
                                        </td>
                                        <td className={`py-2 font-semibold ${row.available === 0 ? 'text-red-500' : 'text-orange-500'}`}>{row.available}</td>
                                        <td className="py-2 text-slate-500">{row.reorder == null ? '—' : row.reorder}</td>
                                        <td className="py-2 text-slate-500">{row.uom || '—'}</td>
                                        <td className="py-2"><StatusPill status={row.status} /></td>
                                    </tr>
                                ))}
                                {data && !data.lowStock?.length ? (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-[12px] text-slate-400">No low or out-of-stock items.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </Card>
                    <Card title="Recent Purchases" action={<ViewAll href="/inventory/bills" />}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                                    <th className="pb-2 font-medium">Bill No</th>
                                    <th className="pb-2 font-medium">Vendor</th>
                                    <th className="pb-2 font-medium">Amount</th>
                                    <th className="pb-2 font-medium">Date</th>
                                    <th className="pb-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.purchases || []).map((row) => (
                                    <tr key={row.id} className="border-t border-slate-100 text-[11px] text-slate-700">
                                        <td className="py-2 font-medium text-slate-800">
                                            <Link href="/inventory/bills" className="hover:text-blue-600 hover:underline">{row.billNo}</Link>
                                        </td>
                                        <td className="py-2 pr-2">
                                            {row.vendorId ? (
                                                <Link href={`/inventory/vendor-management/${row.vendorId}`} className="hover:text-blue-600 hover:underline">{row.vendor}</Link>
                                            ) : row.vendor}
                                        </td>
                                        <td className="py-2">{formatMoney(row.amount)}</td>
                                        <td className="py-2 text-slate-500">{formatDate(row.date)}</td>
                                        <td className="py-2"><StatusPill status={row.status} /></td>
                                    </tr>
                                ))}
                                {data && !data.purchases?.length ? (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-[12px] text-slate-400">No purchases in this period.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </Card>
                    <Card title="Recent Price Changes" action={<ViewAll href="/inventory/bills" />}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                                    <th className="pb-2 font-medium">Product</th>
                                    <th className="pb-2 font-medium">Vendor</th>
                                    <th className="pb-2 font-medium">Old Price</th>
                                    <th className="pb-2 font-medium">New Price</th>
                                    <th className="pb-2 font-medium">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.priceChanges || []).map((row) => (
                                    <tr key={`${row.itemId}-${row.date}`} className="border-t border-slate-100 text-[11px] text-slate-700">
                                        <td className="py-2 pr-2 font-medium">
                                            <Link href={`/inventory/item-master/${row.itemId}`} className="hover:text-blue-600 hover:underline">{row.product}</Link>
                                        </td>
                                        <td className="py-2 pr-2">{row.vendor}</td>
                                        <td className="py-2 text-slate-500">{formatPrice(row.oldPrice)}</td>
                                        <td className={`py-2 font-semibold ${row.up ? 'text-emerald-600' : 'text-red-500'}`}>
                                            <span className="inline-flex items-center gap-0.5">
                                                {formatPrice(row.newPrice)}
                                                {row.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                                            </span>
                                        </td>
                                        <td className="py-2 text-slate-500">{formatDate(row.date)}</td>
                                    </tr>
                                ))}
                                {data && !data.priceChanges?.length ? (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-[12px] text-slate-400">No price changes in this period.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <Card title="Stock by Category">
                        {(data?.stockByCategory || []).length ? (
                            <RechartsBox height={220} minHeight={220}>
                                <BarChart data={data.stockByCategory} barSize={28} margin={{ top: 16, right: 8, left: -8, bottom: 4 }}>
                                    <CartesianGrid vertical={false} stroke="#EEF2F7" />
                                    <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={64} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={shortName} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={32} />
                                    <Tooltip content={(props) => <ChartTooltip {...props} />} />
                                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                                    </Bar>
                                </BarChart>
                            </RechartsBox>
                        ) : (
                            <EmptyNote>No stock on hand at the period end.</EmptyNote>
                        )}
                    </Card>
                    <Card title="Stock Status Overview">
                        <Donut data={stockStatus} center={formatCount(stockTotal)} caption="Items" empty="No items at the period end." />
                    </Card>
                    <Card title="Bill Status">
                        <Donut data={billStatus} center={formatCount(billTotal)} caption="Bills" empty="No bills in this period." />
                    </Card>
                </div>
                </>
                ) : null}
            </main>

            <footer className="flex flex-col gap-1 border-t border-[#E6EDF5] bg-white px-5 py-3 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <p>
                    <span className="font-semibold text-blue-700">VEGA</span>
                    {' '}DIGITAL IT SOLUTIONS LLC
                    <span className="mx-2 text-slate-300">|</span>
                    Inventory & Vendor Management System v1.0
                </p>
                <p>Small Business, Big Vision <span className="mx-1 text-slate-300">|</span> Tech Mind, Creative Soul</p>
            </footer>
        </>
    );
}
