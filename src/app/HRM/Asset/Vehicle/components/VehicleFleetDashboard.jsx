'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScrollReveal from '@/components/ScrollReveal';
import RechartsBox from '@/components/charts/RechartsBox';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Pie,
    PieChart,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertCircle,
    ChevronLeft,
    Clock,
    Gauge,
    MapPin,
    Maximize2,
    Minimize2,
    RefreshCw,
    Route,
    TrendingUp,
    XCircle,
} from 'lucide-react';
import { DatePicker, MonthPicker } from '@/components/ui/date-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
    endOfDay,
    endOfMonth,
    endOfYear,
    format,
    parse,
    startOfDay,
    startOfMonth,
    startOfYear,
    subMonths,
    subYears,
} from 'date-fns';
import {
    FLORAL_CLASS_COLORS,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetAnalyticsTheme';
import { buildVehicleDetailPath } from '@/utils/assetNotificationRouting';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { navHrefProps } from '@/utils/linkContextMenu';
import { VEHICLE_SERVICE_TYPES } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';
import { vehicleDashboardFineListHref, vehicleDashboardModelYearListHref } from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetDashboardNavigation';
import { isVehicleAccessFineVisible } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';
import { sumEmployeeOutstandingOnFines } from '@/app/HRM/Fine/utils/employeeFineFinancials';

const YEAR_COLORS = FLORAL_CLASS_COLORS;

const FLEET_DASHBOARD_LIST_RETURN = '/HRM/Asset/Vehicle/dashboard';

function sortFleetModalRows(rows, modalKind) {
    if (modalKind === 'vehicleFines') {
        return [...(rows || [])].sort((a, b) => {
            const at = a?.awardedDate ? new Date(a.awardedDate).getTime() : 0;
            const bt = b?.awardedDate ? new Date(b.awardedDate).getTime() : 0;
            const aOk = Number.isFinite(at) ? at : 0;
            const bOk = Number.isFinite(bt) ? bt : 0;
            if (aOk !== bOk) return bOk - aOk;
            return String(a?.fineId || '').localeCompare(String(b?.fineId || ''));
        });
    }
    const n = (v) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : NaN;
    };
    return [...(rows || [])].sort((a, b) => {
        const an = n(a?.daysRemaining);
        const bn = n(b?.daysRemaining);
        if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
        if (Number.isFinite(an) !== Number.isFinite(bn)) return Number.isFinite(an) ? -1 : 1;
        return String(a?.plate || '').localeCompare(String(b?.plate || ''));
    });
}

function formatFleetModalExpiryDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFleetModalRemaining(daysRemaining) {
    if (daysRemaining == null || !Number.isFinite(Number(daysRemaining))) return '—';
    const n = Number(daysRemaining);
    if (n < 0) return `Expired (${Math.abs(n)} Days)`;
    if (n === 0) return 'Expires today';
    return `${n} Days`;
}

function formatFleetModalDaysCount(days) {
    if (days == null || !Number.isFinite(Number(days))) return '—';
    const n = Number(days);
    if (n === 0) return '0 Days';
    if (n === 1) return '1 Day';
    return `${n} Days`;
}

function formatFleetModalAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function FleetDashboardDetailModal({ open, bucket, onClose, onRowClick }) {
    if (!open || !bucket) return null;
    const modalKind =
        bucket.modalKind ||
        (bucket.docs || []).find((r) => r?.modalKind)?.modalKind ||
        'default';
    const rows = sortFleetModalRows(bucket.docs || [], modalKind);
    const showExpiryCols =
        modalKind === 'default' &&
        rows.some(
            (r) => r?.expiryDate != null || (r?.daysRemaining != null && Number.isFinite(Number(r.daysRemaining))),
        );
    const thClass =
        'px-4 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <Clock className="text-orange-500" size={24} />
                            {bucket.title || bucket.name}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium">
                            Found {rows.length} {rows.length === 1 ? 'item' : 'items'}
                            {bucket.subtitle ? ` · ${bucket.subtitle}` : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm border border-transparent hover:border-gray-200"
                    >
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {rows.length === 0 ? (
                        <div className="p-10 text-center text-sm font-semibold text-gray-400">No records in this list.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                <tr>
                                    <th className={thClass}>Sl No</th>
                                    {modalKind === 'assigned' ? (
                                        <>
                                            <th className={thClass}>Asset ID</th>
                                            <th className={thClass}>Vehicle Number (Plate)</th>
                                            <th className={thClass}>Name</th>
                                            <th className={thClass}>Assigned User</th>
                                            <th className={`${thClass} text-right`}>No of Days Assigned</th>
                                        </>
                                    ) : null}
                                    {modalKind === 'unassigned' ? (
                                        <>
                                            <th className={thClass}>Asset ID</th>
                                            <th className={thClass}>Vehicle Number</th>
                                            <th className={thClass}>Name</th>
                                            <th className={`${thClass} text-right`}>No of Days Unassigned</th>
                                        </>
                                    ) : null}
                                    {modalKind === 'pendingService' ? (
                                        <>
                                            <th className={thClass}>Service Type</th>
                                            <th className={thClass}>Vehicle No</th>
                                            <th className={thClass}>Vehicle Assigned User</th>
                                            <th className={thClass}>Pending For Whom</th>
                                            <th className={`${thClass} text-right`}>No of Days Service Pending</th>
                                        </>
                                    ) : null}
                                    {modalKind === 'vehicleFines' ? (
                                        <>
                                            <th className={thClass}>Fine ID</th>
                                            <th className={thClass}>Type</th>
                                            <th className={thClass}>Vehicle No</th>
                                            <th className={thClass}>Offender</th>
                                            <th className={`${thClass} text-right`}>Amount</th>
                                            <th className={`${thClass} text-center`}>Date</th>
                                            <th className={thClass}>Status</th>
                                        </>
                                    ) : null}
                                    {modalKind === 'modelYear' ? (
                                        <>
                                            <th className={thClass}>Asset ID</th>
                                            <th className={thClass}>Name</th>
                                            <th className={thClass}>Vehicle No / Plate</th>
                                        </>
                                    ) : null}
                                    {modalKind !== 'assigned' &&
                                    modalKind !== 'unassigned' &&
                                    modalKind !== 'pendingService' &&
                                    modalKind !== 'vehicleFines' &&
                                    modalKind !== 'modelYear' ? (
                                        <>
                                            <th className={thClass}>Card Name</th>
                                            <th className={thClass}>Vehicle No / Plate</th>
                                            {showExpiryCols ? (
                                                <>
                                                    <th className={`${thClass} text-center`}>Expiry Date</th>
                                                    <th className={`${thClass} text-right`}>Expires In</th>
                                                </>
                                            ) : null}
                                        </>
                                    ) : null}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {rows.map((row, idx) => {
                                    const fineHref = row?.fineRecordId || row?._id
                                        ? `/HRM/Fine/${row.fineRecordId || row._id}`
                                        : '';
                                    const rowHref =
                                        modalKind === 'vehicleFines'
                                            ? fineHref
                                            : row?.vehicleId
                                              ? buildVehicleDetailPath(row.vehicleId, {
                                                    tab: row.tab || 'basic',
                                                    focusCard: row.focusCard || undefined,
                                                })
                                              : '';
                                    return (
                                    <tr
                                        key={`${row.vehicleId || row.assetId || idx}-${row.serviceId || row.cardName || ''}-${idx}`}
                                        className="hover:bg-orange-50/50 transition-all border-l-4 border-l-transparent hover:border-l-orange-500 group cursor-pointer"
                                        {...navHrefProps(rowHref || '')}
                                        onClick={() => onRowClick(row)}
                                    >
                                        <td className="px-4 py-4 text-xs font-bold text-gray-400">
                                            {String(idx + 1).padStart(2, '0')}
                                        </td>
                                        {modalKind === 'assigned' ? (
                                            <>
                                                <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                                                    {row.assetId || '—'}
                                                </td>
                                                <td className="px-4 py-4 font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                                                    {row.plate || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-700">
                                                    {row.vehicleName || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-medium text-gray-700">
                                                    {row.assignedUser || 'Unassigned'}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-black text-gray-700 tabular-nums">
                                                    {formatFleetModalDaysCount(row.daysAssigned ?? row.daysRemaining)}
                                                </td>
                                            </>
                                        ) : null}
                                        {modalKind === 'unassigned' ? (
                                            <>
                                                <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                                                    {row.assetId || '—'}
                                                </td>
                                                <td className="px-4 py-4 font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                                                    {row.plate || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-700">
                                                    {row.vehicleName || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-black text-gray-700 tabular-nums">
                                                    {formatFleetModalDaysCount(row.daysUnassigned ?? row.daysRemaining)}
                                                </td>
                                            </>
                                        ) : null}
                                        {modalKind === 'pendingService' ? (
                                            <>
                                                <td className="px-4 py-4">
                                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold uppercase">
                                                        {row.serviceType || row.cardName || 'Service'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                                                    {row.plate || row.assetId || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-medium text-gray-700">
                                                    {row.assignedUser || 'Unassigned'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-semibold text-teal-700">
                                                    {row.pendingForWhom || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-black text-gray-700 tabular-nums">
                                                    {formatFleetModalDaysCount(row.daysPending ?? row.daysRemaining)}
                                                </td>
                                            </>
                                        ) : null}
                                        {modalKind === 'vehicleFines' ? (
                                            <>
                                                <td className="px-4 py-4 text-sm font-bold text-blue-600">
                                                    {row.fineId || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                                                    {row.fineType || '—'}
                                                </td>
                                                <td className="px-4 py-4 font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                                                    {row.plate || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-700">
                                                    {row.offender || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-black text-rose-600 tabular-nums">
                                                    {formatFleetModalAmount(row.amount)}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-medium text-gray-600 text-center">
                                                    {formatFleetModalExpiryDate(row.awardedDate)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                                        {row.fineStatus || '—'}
                                                    </span>
                                                </td>
                                            </>
                                        ) : null}
                                        {modalKind === 'modelYear' ? (
                                            <>
                                                <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                                                    {row.assetId || '—'}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-700">
                                                    {row.vehicleName || '—'}
                                                </td>
                                                <td className="px-4 py-4 font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                                                    {row.plate || '—'}
                                                </td>
                                            </>
                                        ) : null}
                                        {modalKind !== 'assigned' &&
                                        modalKind !== 'unassigned' &&
                                        modalKind !== 'pendingService' &&
                                        modalKind !== 'vehicleFines' &&
                                        modalKind !== 'modelYear' ? (
                                            <>
                                                <td className="px-4 py-4">
                                                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                                                        {row.cardName || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                                                    {row.plate || row.assetId || '—'}
                                                </td>
                                                {showExpiryCols ? (
                                                    <>
                                                        <td className="px-4 py-4 text-sm font-medium text-gray-600 text-center">
                                                            {formatFleetModalExpiryDate(row.expiryDate)}
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            <span
                                                                className={`text-[11px] font-black px-2 py-1 rounded-full ${
                                                                    Number(row.daysRemaining) < 0
                                                                        ? 'bg-red-600 text-white shadow-sm'
                                                                        : Number(row.daysRemaining) <= 7
                                                                          ? 'bg-red-100 text-red-600'
                                                                          : 'bg-orange-100 text-orange-600'
                                                                }`}
                                                            >
                                                                {formatFleetModalRemaining(row.daysRemaining)}
                                                            </span>
                                                        </td>
                                                    </>
                                                ) : null}
                                            </>
                                        ) : null}
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

function formatCostAxisTick(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(n);
}

function AnimatedCount({ value, className = '' }) {
    const target = Number(value) || 0;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        let frame;
        const start = performance.now();
        const from = 0;
        const duration = 900;

        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - (1 - t) ** 3;
            setDisplay(Math.round(from + (target - from) * eased));
            if (t < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target]);

    return <span className={`fleet-kpi-value tabular-nums ${className}`}>{display}</span>;
}

function LocatorPeriodTabBar({ options, value, onChange }) {
    return (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            {options.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    onClick={() => onChange(o.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                        value === o.id
                            ? 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-200/50 scale-[1.02]'
                            : 'text-slate-500 hover:text-teal-700 hover:bg-white/80'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function CompactPeriodTabBar({ options, value, onChange }) {
    return (
        <div className="flex flex-wrap gap-0.5 p-0.5 bg-slate-100 rounded-lg">
            {options.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    onClick={() => onChange(o.id)}
                    className={`px-1.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wide transition-all ${
                        value === o.id
                            ? 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-200/50'
                            : 'text-slate-500 hover:text-teal-700 hover:bg-white/80'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

const RUNNING_PERIOD_TABS = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
];

const IDLE_PERIOD_TABS = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
];

const SALIK_PERIOD_TABS = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
];

const SERVICE_COST_PERIOD_TABS = [
    { id: 'thisMonth', label: 'This Month' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'prevMonth', label: 'Prev Month' },
    { id: 'prevYr', label: 'Prev Yr' },
    { id: 'custom', label: 'Custom' },
];

function resolveServiceCostRange(period, customFrom, customTo) {
    const now = new Date();
    if (period === 'thisMonth') {
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    if (period === 'thisYear') {
        return { start: startOfYear(now), end: endOfYear(now) };
    }
    if (period === 'prevMonth') {
        const prev = subMonths(now, 1);
        return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    if (period === 'prevYr') {
        const prev = subYears(now, 1);
        return { start: startOfYear(prev), end: endOfYear(prev) };
    }
    if (period === 'custom') {
        const start = customFrom
            ? startOfDay(parse(customFrom, 'yyyy-MM-dd', new Date()))
            : null;
        const end = customTo
            ? endOfDay(parse(customTo, 'yyyy-MM-dd', new Date()))
            : null;
        return {
            start: start && !Number.isNaN(start.getTime()) ? start : null,
            end: end && !Number.isNaN(end.getTime()) ? end : null,
        };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function startOfWeekSunday(date) {
    const start = startOfDay(date);
    start.setDate(start.getDate() - start.getDay());
    return start;
}

function collectVehicleServiceTimes(vehicle) {
    const fromEvents = Array.isArray(vehicle?.serviceEventDates) ? vehicle.serviceEventDates : [];
    const fromCosts = Array.isArray(vehicle?.serviceCosts)
        ? vehicle.serviceCosts.map((s) => s?.date)
        : [];
    const raw = fromEvents.length ? fromEvents : fromCosts;
    return raw
        .map((d) => new Date(d).getTime())
        .filter((t) => Number.isFinite(t));
}

function resolveUsageRange(period, customFrom, customTo) {
    if (period === 'custom' && !customFrom && !customTo) {
        return resolveServiceCostRange('thisMonth');
    }
    return resolveServiceCostRange(period, customFrom, customTo);
}

function countTimesInRange(times, startMs, endMs) {
    return times.filter((t) => t >= startMs && t <= endMs).length;
}

function buildSevenDayBars(times, endDate) {
    const end = endOfDay(endDate);
    const rows = [];
    for (let i = 6; i >= 0; i -= 1) {
        const start = startOfDay(addDays(end, -i));
        const dayEnd = endOfDay(start);
        rows.push({
            name: format(start, 'd MMM'),
            count: countTimesInRange(times, start.getTime(), dayEnd.getTime()),
        });
    }
    return rows;
}

function buildUsagePeriodBars(vehicles, period, customFrom, customTo, { vehicleWeek } = {}) {
    const range = resolveUsageRange(period, customFrom, customTo);
    const start = range.start;
    const end = range.end;
    if (!start || !end) return [];
    const times = (vehicles || []).flatMap(collectVehicleServiceTimes);

    if (vehicleWeek && (period === 'thisMonth' || period === 'prevMonth')) {
        return buildSevenDayBars(times, end);
    }

    const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const useMonths =
        period === 'thisYear' || period === 'prevYr' || (period === 'custom' && spanDays > 45);
    const useDays = period === 'custom' && spanDays <= 14;

    if (useMonths) {
        const rows = [];
        let cur = startOfMonth(start);
        const last = startOfMonth(end);
        while (cur.getTime() <= last.getTime()) {
            const s = startOfMonth(cur);
            const e = endOfMonth(cur);
            rows.push({
                name: format(s, 'MMM yyyy'),
                count: countTimesInRange(times, s.getTime(), e.getTime()),
            });
            cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        }
        return rows;
    }

    if (useDays) {
        const rows = [];
        let cur = startOfDay(start);
        const last = startOfDay(end);
        while (cur.getTime() <= last.getTime()) {
            const dayEnd = endOfDay(cur);
            rows.push({
                name: format(cur, 'd MMM'),
                count: countTimesInRange(times, cur.getTime(), dayEnd.getTime()),
            });
            cur = addDays(cur, 1);
        }
        return rows;
    }

    const rows = [];
    let weekStart = startOfWeekSunday(start);
    let n = 1;
    while (weekStart.getTime() <= end.getTime()) {
        const weekEnd = endOfDay(addDays(weekStart, 6));
        const clipStart = Math.max(weekStart.getTime(), start.getTime());
        const clipEnd = Math.min(weekEnd.getTime(), end.getTime());
        rows.push({
            name: `W${n}`,
            count: countTimesInRange(times, clipStart, clipEnd),
        });
        n += 1;
        weekStart = addDays(weekStart, 7);
    }
    return rows;
}

function fleetVehiclePlate(v) {
    const number = String(v?.plateNumber || '').trim();
    const emirate = String(v?.plateEmirate || '').trim();
    if (number && emirate) return `${emirate} ${number}`;
    if (number) return number;
    return String(v?.label || v?.assetId || '').trim() || '—';
}

function fleetVehicleName(v) {
    return String(v?.name || v?.vehicleBrand || '').trim() || '—';
}

function serviceEventInRange(dateVal, start, end) {
    if (!dateVal) return false;
    const t = new Date(dateVal).getTime();
    if (!Number.isFinite(t)) return false;
    if (start && t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
}

function normalizeServiceCostType(raw) {
    const type = String(raw || '').trim();
    if (VEHICLE_SERVICE_TYPES.includes(type)) return type;
    return 'Other';
}

function vehicleServiceCostEventsInRange(vehicle, start, end, customIncomplete) {
    const events = Array.isArray(vehicle?.serviceCosts) ? vehicle.serviceCosts : [];
    if (customIncomplete) return events;
    return events.filter((s) => serviceEventInRange(s.date, start, end));
}

function formatLocatorOptionLabel(opt) {
    const base = opt.sublabel ? `${opt.label} · ${opt.sublabel}` : opt.label;
    if (opt.hasSnapshots === false) return `${base} · no GPS saved`;
    return base;
}

function getWeekStartMonday(date) {
    const d = startOfDay(new Date(date));
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    return d;
}

function toLocalDateKey(date) {
    return format(date, 'yyyy-MM-dd');
}

function resolveWeekKeyFromDate(dateStr) {
    return toLocalDateKey(getWeekStartMonday(parse(dateStr, 'yyyy-MM-dd', new Date())));
}

function buildLocatorDisabledDays(trackingFrom) {
    const min = trackingFrom ? startOfDay(new Date(trackingFrom)) : undefined;
    const max = endOfDay(new Date());
    if (min) return { before: min, after: max };
    return { after: max };
}

function LocatorBucketControls({
    tabs,
    period,
    onPeriodChange,
    bucket,
    selectedKey,
    onSelectKey,
    selectAriaLabel,
    trackingFrom,
}) {
    const options = bucket?.options || [];
    const value = selectedKey || bucket?.defaultKey || '';
    const disabledDays = buildLocatorDisabledDays(trackingFrom);
    const pickerClassName =
        'h-9 text-xs font-semibold w-full sm:min-w-[11.5rem] sm:w-auto justify-start';

    const handleDayPick = (dateStr) => {
        if (!dateStr) return;
        if (period === 'week') {
            onSelectKey(resolveWeekKeyFromDate(dateStr));
            return;
        }
        onSelectKey(dateStr);
    };

    const dayPickerValue =
        period === 'week'
            ? value || toLocalDateKey(new Date())
            : value || bucket?.defaultKey || '';

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <LocatorPeriodTabBar options={tabs} value={period} onChange={onPeriodChange} />
            {period === 'month' ? (
                <MonthPicker
                    value={value || bucket?.defaultKey || ''}
                    onChange={(monthKey) => monthKey && onSelectKey(monthKey)}
                    placeholder="Select month"
                    className={pickerClassName}
                    fromYear={
                        trackingFrom
                            ? new Date(trackingFrom).getFullYear()
                            : new Date().getFullYear() - 1
                    }
                    toYear={new Date().getFullYear()}
                />
            ) : period === 'day' || period === 'week' ? (
                <DatePicker
                    value={dayPickerValue}
                    onChange={handleDayPick}
                    placeholder={period === 'week' ? 'Pick a week' : 'Pick a date'}
                    className={pickerClassName}
                    disabledDays={disabledDays}
                />
            ) : options.length > 0 ? (
                <select
                    value={value}
                    onChange={(e) => onSelectKey(e.target.value)}
                    className="w-full sm:min-w-[13rem] sm:w-auto px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                    aria-label={selectAriaLabel}
                >
                    {options.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                            {formatLocatorOptionLabel(opt)}
                        </option>
                    ))}
                </select>
            ) : null}
        </div>
    );
}

function readLocatorBucketSeries(bucket, selectedKey) {
    if (!bucket?.byKey) return [];
    const key = selectedKey || bucket.defaultKey;
    return bucket.byKey[key] || [];
}

function formatLocatorBucketSubtitle(bucket, selectedKey, fallback) {
    const key = selectedKey || bucket?.defaultKey;
    const option = bucket?.options?.find((row) => row.key === key);
    if (!option) return fallback;
    return option.sublabel ? `${option.label} · ${option.sublabel}` : option.label;
}

function PeriodTabs({ value, onChange }) {
    return (
        <LocatorPeriodTabBar options={RUNNING_PERIOD_TABS} value={value} onChange={onChange} />
    );
}

function RunningKmControls({ period, onPeriodChange, bucket, selectedKey, onSelectKey, trackingFrom }) {
    return (
        <LocatorBucketControls
            tabs={RUNNING_PERIOD_TABS}
            period={period}
            onPeriodChange={onPeriodChange}
            bucket={bucket}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
            selectAriaLabel="Select running km period"
            trackingFrom={trackingFrom}
        />
    );
}

function IdleTimeControls({ period, onPeriodChange, bucket, selectedKey, onSelectKey, trackingFrom }) {
    return (
        <LocatorBucketControls
            tabs={IDLE_PERIOD_TABS}
            period={period}
            onPeriodChange={onPeriodChange}
            bucket={bucket}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
            selectAriaLabel="Select idle time period"
            trackingFrom={trackingFrom}
        />
    );
}

function SalikControls({ period, onPeriodChange, bucket, selectedKey, onSelectKey, trackingFrom }) {
    return (
        <LocatorBucketControls
            tabs={SALIK_PERIOD_TABS}
            period={period}
            onPeriodChange={onPeriodChange}
            bucket={bucket}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
            selectAriaLabel="Select salik cost period"
            trackingFrom={trackingFrom}
        />
    );
}

function mapLocatorSeries(rows, valueKey = 'value') {
    return (rows || []).map((row) => ({
        name: row.name || row.label,
        value: Number(row[valueKey]) || 0,
    }));
}

function formatKmAxisTick(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(Math.round(n));
}

function shortVehicleChartName(name, max = 14) {
    const text = String(name || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

/** Prefer plate number on axis; full plate (emirate + number) in tooltip / hover. */
function shortPlateAxisLabel(plate, max = 10) {
    const full = String(plate || '').trim();
    if (!full) return '—';
    const parts = full.split(/\s+/);
    const numberPart = parts.length > 1 ? parts[parts.length - 1] : full;
    return shortVehicleChartName(numberPart, max);
}

function withPlateChartNames(rows) {
    return (rows || []).map((row) => {
        const plate = String(row.plate || row.name || row.label || '—').trim() || '—';
        return {
            ...row,
            name: plate,
            plate,
            chartName: shortPlateAxisLabel(plate, 10),
        };
    });
}

function PlateChartAxisTick({ x, y, payload, fill = '#64748b', fontSize = 9, angle = -28, textAnchor = 'end' }) {
    const label = String(payload?.value ?? '').trim();
    const fullPlate = String(payload?.payload?.name || payload?.payload?.plate || label).trim();
    return (
        <g transform={`translate(${x},${y})`}>
            <text
                x={0}
                y={0}
                dy={angle ? 12 : 16}
                fill={fill}
                fontSize={fontSize}
                textAnchor={textAnchor}
                transform={angle ? `rotate(${angle})` : undefined}
            >
                <title>{fullPlate}</title>
                {label}
            </text>
        </g>
    );
}

function expandSlotWidthClass(slotKey, expandedKey, totalSlots) {
    if (!expandedKey) return 'flex-1 min-w-0';
    if (expandedKey === slotKey) return 'w-3/4 shrink-0 min-w-0';
    if (totalSlots <= 2) return 'w-1/4 shrink-0 min-w-0 overflow-hidden';
    return 'w-[12.5%] shrink-0 min-w-0 overflow-hidden';
}

function DashboardExpandSlot({ slotKey, expandedKey, totalSlots, onToggle, className = '', children }) {
    const isExpanded = expandedKey === slotKey;
    return (
        <div
            className={`${expandSlotWidthClass(slotKey, expandedKey, totalSlots)} transition-all duration-300 ease-out ${className}`}
        >
            <div className="h-full min-h-0 flex flex-col relative">
                <button
                    type="button"
                    onClick={() => onToggle(isExpanded ? null : slotKey)}
                    className="absolute top-1 right-1 z-10 p-1 rounded-md text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors shrink-0"
                    title={isExpanded ? 'Collapse panel' : 'Expand panel'}
                    aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
                >
                    {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <div className="flex-1 min-h-0 min-w-0">
                    {children}
                </div>
            </div>
        </div>
    );
}

function formatLocatorBarValue(value, unit) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (String(unit).toUpperCase() === 'AED') {
        return `AED ${Math.round(n).toLocaleString()}`;
    }
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${unit}`;
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k ${unit}`;
    return `${Math.round(n).toLocaleString()} ${unit}`;
}

function formatLocatorTooltipValue(value, unit) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (String(unit).toUpperCase() === 'AED') {
        return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return `${Math.round(n).toLocaleString()} ${unit}`;
}

function withShortNames(rows) {
    return (rows || []).map((row) => {
        const fullName =
            String(row.chartLabel || row.name || row.label || '—').trim() || '—';
        // Keep assignee first names / plate labels intact (do not re-parse GPS device names).
        const axisName =
            fullName === 'no plate not added'
                ? fullName
                : shortVehicleChartName(fullName, 16);
        return {
            ...row,
            name: fullName,
            shortName: axisName,
            chartName: axisName,
        };
    });
}

const LOCATOR_CHART_HEIGHT = 300;
const LOCATOR_STATIC_CHART_HEIGHT = 300;

const LOCATOR_GRID_ORDER = ['running', 'odometer', 'idle', 'salik'];

const LOCATOR_CHARTS = [
    {
        id: 'odometer',
        title: 'Current km / Odometer',
        subtitle: 'Live totalDistanceKm from Locator (latest positions)',
        accent: 'border-t-teal-500',
        icon: Gauge,
        iconClass: 'text-teal-600',
        linkClass: 'text-teal-700',
        valueLabel: 'km',
        barFill: '#0d9488',
    },
    {
        id: 'running',
        title: 'Running km',
        subtitle: 'Day distance from saved Locator totalDistance samples',
        subtitleDay: 'Distance travelled on the selected day',
        accent: 'border-t-violet-500',
        icon: TrendingUp,
        iconClass: 'text-violet-600',
        linkClass: 'text-violet-700',
        valueLabel: 'km',
        barFill: '#7c3aed',
    },
    {
        id: 'idle',
        title: 'Idle time',
        subtitle: 'Engine-on idle time per vehicle (from stored GPS samples)',
        subtitleDay: 'Engine-on idle minutes for the selected day',
        accent: 'border-t-orange-500',
        icon: Clock,
        iconClass: 'text-orange-500',
        linkClass: 'text-orange-600',
        valueLabel: 'min',
        barFill: '#f97316',
    },
    {
        id: 'salik',
        title: 'Salik-wise cost',
        subtitle: 'Toll price taken per vehicle (AED)',
        accent: 'border-t-fuchsia-500',
        icon: Route,
        iconClass: 'text-fuchsia-600',
        linkClass: 'text-fuchsia-700',
        valueLabel: 'AED',
        barFill: '#0284c7',
    },
].sort((a, b) => LOCATOR_GRID_ORDER.indexOf(a.id) - LOCATOR_GRID_ORDER.indexOf(b.id));

function LocatorVerticalBarChart({
    data,
    valueLabel,
    barFill = '#0d9488',
    chartAnim = 0,
    animateBars = false,
    chartHeight = LOCATOR_CHART_HEIGHT,
    emptyMessage = 'No GPS data recorded for this period',
}) {
    if (!data?.length) {
        return (
            <p className="text-slate-400 text-center text-xs py-16">
                {emptyMessage}
            </p>
        );
    }

    const barAnimationDuration = animateBars ? chartAnim : 0;
    const barCount = data.length;
    const barSize = Math.min(48, Math.max(20, Math.floor(520 / Math.max(barCount, 1))));
    const xLabelAngle = barCount > 6 ? -38 : barCount > 3 ? -28 : 0;
    const xLabelAnchor = xLabelAngle ? 'end' : 'middle';
    const bottomMargin = barCount > 6 ? 56 : barCount > 3 ? 48 : 36;

    return (
        <div className="w-full" style={{ minHeight: chartHeight }}>
            <RechartsBox height={chartHeight} minHeight={chartHeight}>
                <BarChart
                    data={data}
                    margin={{ top: 24, right: 8, left: 2, bottom: bottomMargin }}
                    barCategoryGap="18%"
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                        dataKey="chartName"
                        tick={{ fontSize: 9, fill: '#64748b' }}
                        interval={0}
                        angle={xLabelAngle}
                        textAnchor={xLabelAnchor}
                        height={bottomMargin - 4}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                        tickFormatter={formatKmAxisTick}
                    />
                    <RechartsTooltip
                        formatter={(v) => [formatLocatorTooltipValue(v, valueLabel), valueLabel]}
                        labelFormatter={(_label, payload) => payload?.[0]?.payload?.name || _label}
                        contentStyle={tooltipStyle}
                    />
                    <Bar
                        dataKey="value"
                        fill={barFill}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={barSize}
                        isAnimationActive={animateBars}
                        animationDuration={barAnimationDuration}
                        animationEasing="ease-out"
                    >
                        <LabelList
                            dataKey="value"
                            position="top"
                            formatter={(v) => formatLocatorBarValue(v, valueLabel)}
                            style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }}
                        />
                    </Bar>
                </BarChart>
            </RechartsBox>
        </div>
    );
}

function resolveLocatorSubtitle(chart, runningPeriod, idlePeriod) {
    let subtitle = chart.subtitle;
    if (chart.id === 'running' && runningPeriod === 'day' && chart.subtitleDay) {
        subtitle = chart.subtitleDay;
    }
    if (chart.id === 'idle' && idlePeriod === 'day' && chart.subtitleDay) {
        subtitle = chart.subtitleDay;
    }
    return subtitle;
}

const chartPanelClass =
    'group/chart bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/80 hover:border-gray-300';

const compactChartPanelClass =
    'group/chart bg-white rounded-2xl border border-gray-200 shadow-sm p-3 md:p-4 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/80 hover:border-gray-300';

const COMPACT_ROW_CHART_HEIGHT = 200;
const COMPACT_ROW_CHART_MIN = 200;
const COMPACT_ROW_CARD_HEIGHT = 320;
const LOWER_ROW_CHART_HEIGHT = 260;
const LOWER_ROW_CARD_MIN = 360;

function CompactChartCard({ title, titleExtra, subtitle, headerExtra, children }) {
    return (
        <div
            className={`${compactChartPanelClass} h-full flex flex-col`}
            style={{ minHeight: COMPACT_ROW_CARD_HEIGHT }}
        >
            <div className="shrink-0">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover/chart:text-teal-800 transition-colors">
                        {title}
                    </h3>
                    {titleExtra || null}
                </div>
                {headerExtra ? <div className="mb-2">{headerExtra}</div> : null}
                {subtitle || !headerExtra ? (
                    <p
                        className={`text-[11px] mb-2 min-h-[16px] ${
                            subtitle ? 'text-slate-400' : 'text-transparent select-none'
                        }`}
                        aria-hidden={!subtitle}
                    >
                        {subtitle || '\u00A0'}
                    </p>
                ) : null}
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
}

function LowerChartCard({ title, subtitle, headerExtra, children }) {
    return (
        <div
            className={`${chartPanelClass} h-full flex flex-col`}
            style={{ minHeight: LOWER_ROW_CARD_MIN }}
        >
            <div className="shrink-0 min-h-[72px]">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 group-hover/chart:text-teal-800 transition-colors">
                    {title}
                </h3>
                {headerExtra ? <div className="mb-2">{headerExtra}</div> : null}
                <p
                    className={`text-xs mb-3 min-h-[16px] ${
                        subtitle ? 'text-slate-400' : 'text-transparent select-none'
                    }`}
                    aria-hidden={!subtitle}
                >
                    {subtitle || '\u00A0'}
                </p>
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
}

function LocatorStaticChartCard({
    chart,
    data,
    chartAnim,
    chartsReady,
    runningPeriod,
    idlePeriod,
    periodControls = null,
    subtitleOverride = null,
}) {
    const Icon = chart.icon;
    const subtitle =
        subtitleOverride || resolveLocatorSubtitle(chart, runningPeriod, idlePeriod);

    return (
        <div className={chartPanelClass}>
            <div className="flex items-center gap-2 mb-1">
                {Icon ? (
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${chart.iconClass}`} strokeWidth={2.25} />
                ) : null}
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover/chart:text-teal-800 transition-colors">
                    {chart.title}
                </h3>
            </div>
            {periodControls ? periodControls : null}
            <p className="text-xs text-slate-400 mb-3">{subtitle}</p>
            <LocatorVerticalBarChart
                data={withShortNames(data)}
                valueLabel={chart.valueLabel}
                barFill={chart.barFill}
                chartAnim={chartAnim}
                animateBars={chartsReady}
                chartHeight={LOCATOR_STATIC_CHART_HEIGHT}
            />
        </div>
    );
}

const tooltipStyle = {
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    fontSize: '12px',
    color: '#5c4f55',
};

function ModelYearDonutPanel({ pieData, chartAnim, onSliceClick }) {
    if (!pieData.length) {
        return (
            <p className="text-sm text-slate-400 h-full flex items-center justify-center text-center px-4">
                No model years on record.
            </p>
        );
    }

    return (
        <div className="flex-1 min-h-0 min-w-0">
            <RechartsBox
                height={LOWER_ROW_CHART_HEIGHT}
                minHeight={LOWER_ROW_CHART_HEIGHT}
                className="h-full"
                fillParent
            >
                <PieChart>
                    <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={2}
                        animationDuration={chartAnim}
                        animationEasing="ease-out"
                        onClick={(entry) => {
                            const payload = entry?.payload || entry;
                            if (payload?.name) onSliceClick?.(payload);
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        {pieData.map((_, i) => (
                            <Cell
                                key={`year-${i}`}
                                fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                                stroke="#fff"
                                strokeWidth={2}
                            />
                        ))}
                    </Pie>
                    <RechartsTooltip
                        formatter={(value, _name, ctx) => [
                            `${Number(value)} vehicle(s)`,
                            `Year ${ctx?.payload?.name || ''}`,
                        ]}
                        contentStyle={tooltipStyle}
                    />
                </PieChart>
            </RechartsBox>
        </div>
    );
}

export default function VehicleFleetDashboard({
    data,
    loading,
    error,
    onRefresh,
    locatorData,
    locatorLoading,
    locatorError,
    onLocatorRefresh,
}) {
    const router = useRouter();
    const [locatorRunningPeriod, setLocatorRunningPeriod] = useState('day');
    const [locatorRunningDayKey, setLocatorRunningDayKey] = useState('');
    const [locatorRunningWeekKey, setLocatorRunningWeekKey] = useState('');
    const [locatorRunningMonthKey, setLocatorRunningMonthKey] = useState('');
    const [locatorIdlePeriod, setLocatorIdlePeriod] = useState('day');
    const [locatorIdleDayKey, setLocatorIdleDayKey] = useState('');
    const [locatorIdleWeekKey, setLocatorIdleWeekKey] = useState('');
    const [locatorIdleMonthKey, setLocatorIdleMonthKey] = useState('');
    const [salikPeriod, setSalikPeriod] = useState('month');
    const [salikDayKey, setSalikDayKey] = useState('');
    const [salikWeekKey, setSalikWeekKey] = useState('');
    const [salikMonthKey, setSalikMonthKey] = useState('');
    const [chartsReady, setChartsReady] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalBucket, setDetailModalBucket] = useState(null);
    const [serviceCostPeriod, setServiceCostPeriod] = useState('thisMonth');
    const [serviceCostCustomFrom, setServiceCostCustomFrom] = useState('');
    const [serviceCostCustomTo, setServiceCostCustomTo] = useState('');
    const [serviceCostDrillVehicleId, setServiceCostDrillVehicleId] = useState(null);
    const [vehicleFinePeriod, setVehicleFinePeriod] = useState('thisMonth');
    const [vehicleFineCustomFrom, setVehicleFineCustomFrom] = useState('');
    const [vehicleFineCustomTo, setVehicleFineCustomTo] = useState('');
    const [usagePeriod, setUsagePeriod] = useState('thisMonth');
    const [usageCustomFrom, setUsageCustomFrom] = useState('');
    const [usageCustomTo, setUsageCustomTo] = useState('');
    const [usageDrillVehicleId, setUsageDrillVehicleId] = useState(null);
    const [topRowExpanded, setTopRowExpanded] = useState(null);
    const [midRowExpanded, setMidRowExpanded] = useState(null);
    const [bottomRowExpanded, setBottomRowExpanded] = useState(null);

    useEffect(() => {
        if (!loading && data) {
            const t = setTimeout(() => setChartsReady(true), 80);
            return () => clearTimeout(t);
        }
        setChartsReady(false);
        return undefined;
    }, [loading, data]);

    useEffect(() => {
        const running = locatorData?.runningKmByVehicle;
        if (!running) return;
        if (running.day?.defaultKey) setLocatorRunningDayKey(running.day.defaultKey);
        if (running.week?.defaultKey) setLocatorRunningWeekKey(running.week.defaultKey);
        if (running.month?.defaultKey) setLocatorRunningMonthKey(running.month.defaultKey);
    }, [locatorData?.runningKmByVehicle]);

    useEffect(() => {
        const idle = locatorData?.idleTimeByVehicle;
        if (!idle) return;
        if (idle.day?.defaultKey) setLocatorIdleDayKey(idle.day.defaultKey);
        if (idle.week?.defaultKey) setLocatorIdleWeekKey(idle.week.defaultKey);
        if (idle.month?.defaultKey) setLocatorIdleMonthKey(idle.month.defaultKey);
    }, [locatorData?.idleTimeByVehicle]);

    useEffect(() => {
        const salik = locatorData?.salikWise;
        if (!salik) return;
        if (salik.day?.defaultKey) setSalikDayKey(salik.day.defaultKey);
        if (salik.week?.defaultKey) setSalikWeekKey(salik.week.defaultKey);
        if (salik.month?.defaultKey) setSalikMonthKey(salik.month.defaultKey);
    }, [locatorData?.salikWise]);

    const serviceCostRange = useMemo(
        () => resolveServiceCostRange(serviceCostPeriod, serviceCostCustomFrom, serviceCostCustomTo),
        [serviceCostPeriod, serviceCostCustomFrom, serviceCostCustomTo],
    );

    const serviceCostByVehicle = useMemo(() => {
        if (!data?.vehicles?.length) return [];
        const { start, end } = serviceCostRange;
        const customIncomplete =
            serviceCostPeriod === 'custom' && !serviceCostCustomFrom && !serviceCostCustomTo;
        const rows = [...data.vehicles]
            .map((v) => {
                const events = Array.isArray(v.serviceCosts) ? v.serviceCosts : null;
                let total;
                if (events && !customIncomplete) {
                    total = events.reduce((sum, s) => {
                        if (!serviceEventInRange(s.date, start, end)) return sum;
                        return sum + (Number(s.value) || 0);
                    }, 0);
                } else if (events && customIncomplete) {
                    total = events.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
                } else {
                    total = Number(v.totalServiceCost) || 0;
                }
                return {
                    vehicleId: v._id,
                    plate: fleetVehiclePlate(v),
                    name: fleetVehiclePlate(v),
                    total: Math.round(total),
                };
            })
            .filter((v) => v.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 8);
        return withPlateChartNames(rows);
    }, [data, serviceCostRange, serviceCostPeriod, serviceCostCustomFrom, serviceCostCustomTo]);

    const serviceCostDrillVehicle = useMemo(() => {
        if (!serviceCostDrillVehicleId || !data?.vehicles?.length) return null;
        return data.vehicles.find((v) => String(v._id) === String(serviceCostDrillVehicleId)) || null;
    }, [data?.vehicles, serviceCostDrillVehicleId]);

    const serviceCostByType = useMemo(() => {
        if (!serviceCostDrillVehicle) return [];
        const { start, end } = serviceCostRange;
        const customIncomplete =
            serviceCostPeriod === 'custom' && !serviceCostCustomFrom && !serviceCostCustomTo;
        const events = vehicleServiceCostEventsInRange(
            serviceCostDrillVehicle,
            start,
            end,
            customIncomplete,
        );
        const totals = Object.fromEntries(VEHICLE_SERVICE_TYPES.map((type) => [type, 0]));
        let other = 0;
        for (const s of events) {
            const amount = Number(s.value) || 0;
            if (!amount) continue;
            const type = normalizeServiceCostType(s.serviceType);
            if (type in totals) totals[type] += amount;
            else other += amount;
        }
        const rows = VEHICLE_SERVICE_TYPES.map((type) => ({
            name: type,
            total: Math.round(totals[type]),
        }));
        if (other > 0) rows.push({ name: 'Other', total: Math.round(other) });
        return withShortNames(rows);
    }, [serviceCostDrillVehicle, serviceCostRange, serviceCostPeriod, serviceCostCustomFrom, serviceCostCustomTo]);

    const serviceCostChartData = serviceCostDrillVehicle ? serviceCostByType : serviceCostByVehicle;
    const serviceCostChartEmpty = !serviceCostDrillVehicle && serviceCostByVehicle.length === 0;

    const vehicleFineRange = useMemo(
        () => resolveServiceCostRange(vehicleFinePeriod, vehicleFineCustomFrom, vehicleFineCustomTo),
        [vehicleFinePeriod, vehicleFineCustomFrom, vehicleFineCustomTo],
    );

    const vehicleFinesByVehicle = useMemo(() => {
        const { start, end } = vehicleFineRange;
        const customIncomplete =
            vehicleFinePeriod === 'custom' && !vehicleFineCustomFrom && !vehicleFineCustomTo;
        return (data?.finesByVehicle || [])
            .map((row) => {
                const allFines = Array.isArray(row.fines) ? row.fines : [];
                const inPeriod = customIncomplete
                    ? allFines
                    : allFines.filter((fine) => serviceEventInRange(fine.awardedDate, start, end));
                const fines = inPeriod.filter(isVehicleAccessFineVisible);
                const total = sumEmployeeOutstandingOnFines(fines);
                return {
                    ...row,
                    fines,
                    plate: row.plate || row.label || '—',
                    name: row.plate || row.label || '—',
                    total: Number(total.toFixed(2)),
                };
            })
            .filter((row) => row.fines.length > 0);
    }, [data?.finesByVehicle, vehicleFineRange, vehicleFinePeriod, vehicleFineCustomFrom, vehicleFineCustomTo]);

    const vehicleFinesChartData = useMemo(
        () => withPlateChartNames(vehicleFinesByVehicle.filter((row) => row.total > 0)),
        [vehicleFinesByVehicle],
    );

    const vehicleFinesSummary = useMemo(() => {
        const fines = vehicleFinesByVehicle.flatMap((row) => row.fines || []);
        return {
            count: fines.length,
            unpaid: sumEmployeeOutstandingOnFines(fines),
        };
    }, [vehicleFinesByVehicle]);

    const vehicleValueBars = useMemo(() => {
        if (!data?.vehicles?.length) return [];
        const rows = [...data.vehicles]
            .map((v) => ({
                vehicleId: v._id,
                plate: fleetVehiclePlate(v),
                name: fleetVehiclePlate(v),
                value: Math.round(Number(v.assetValue) || 0),
            }))
            .sort((a, b) => b.value - a.value);
        return withPlateChartNames(rows);
    }, [data]);

    const pieData = useMemo(() => {
        const vehicles = data?.vehicles || [];
        return (data?.modelYearDistribution || []).map((row) => {
            const year = String(row.year || 'Unknown').trim() || 'Unknown';
            const docs = vehicles
                .filter((v) => {
                    const y = (v.modelYear || 'Unknown').toString().trim() || 'Unknown';
                    return y === year;
                })
                .map((v) => ({
                    vehicleId: v._id,
                    assetId: v.assetId,
                    vehicleName: fleetVehicleName(v),
                    plate: fleetVehiclePlate(v),
                    tab: 'basic',
                }));
            return {
                name: year,
                value: Number(row.count) || docs.length,
                docs,
            };
        });
    }, [data?.modelYearDistribution, data?.vehicles]);

    const usageDrillVehicle = useMemo(() => {
        if (!usageDrillVehicleId || !data?.vehicles?.length) return null;
        return data.vehicles.find((v) => String(v._id) === String(usageDrillVehicleId)) || null;
    }, [data?.vehicles, usageDrillVehicleId]);

    const usageChartData = useMemo(() => {
        const vehicles = usageDrillVehicle ? [usageDrillVehicle] : data?.vehicles || [];
        return buildUsagePeriodBars(
            vehicles,
            usagePeriod,
            usageCustomFrom,
            usageCustomTo,
            { vehicleWeek: Boolean(usageDrillVehicle) },
        );
    }, [data?.vehicles, usageDrillVehicle, usagePeriod, usageCustomFrom, usageCustomTo]);

    const odometerChartData = useMemo(
        () => withShortNames(mapLocatorSeries(locatorData?.odometerByVehicle)),
        [locatorData?.odometerByVehicle],
    );

    const runningKmSelectionKey =
        locatorRunningPeriod === 'week'
            ? locatorRunningWeekKey
            : locatorRunningPeriod === 'month'
              ? locatorRunningMonthKey
              : locatorRunningDayKey;

    const runningKmChartData = useMemo(() => {
        const bucket = locatorData?.runningKmByVehicle?.[locatorRunningPeriod];
        let rows = [];
        if (bucket) {
            const key = runningKmSelectionKey || bucket.defaultKey;
            rows = bucket.byKey?.[key] || [];
        } else {
            const legacy = locatorData?.runningKm?.[locatorRunningPeriod];
            if (legacy?.length) {
                rows = legacy.map((row) => ({
                    name: row.label,
                    value: Number(row.value) || 0,
                }));
            }
        }
        return withShortNames(rows);
    }, [locatorData?.runningKmByVehicle, locatorData?.runningKm, locatorRunningPeriod, runningKmSelectionKey]);

    const runningKmSubtitle = useMemo(() => {
        const bucket = locatorData?.runningKmByVehicle?.[locatorRunningPeriod];
        if (!bucket) return 'Running km per vehicle';
        const key = runningKmSelectionKey || bucket.defaultKey;
        const option = bucket.options?.find((row) => row.key === key);
        if (!option) return 'Running km per vehicle';
        if (locatorRunningPeriod === 'day') {
            return `Running km on ${option.label} · ${option.sublabel}`;
        }
        if (locatorRunningPeriod === 'week') {
            return `Running km for ${option.sublabel || option.label}`;
        }
        return `Running km in ${option.label} ${option.sublabel}`;
    }, [locatorData?.runningKmByVehicle, locatorRunningPeriod, runningKmSelectionKey]);

    const handleRunningPeriodChange = (period) => {
        setLocatorRunningPeriod(period);
        const bucket = locatorData?.runningKmByVehicle?.[period];
        if (!bucket?.defaultKey) return;
        if (period === 'day') setLocatorRunningDayKey(bucket.defaultKey);
        else if (period === 'week') setLocatorRunningWeekKey(bucket.defaultKey);
        else setLocatorRunningMonthKey(bucket.defaultKey);
    };

    const handleRunningSelectionChange = (key) => {
        if (locatorRunningPeriod === 'week') setLocatorRunningWeekKey(key);
        else if (locatorRunningPeriod === 'month') setLocatorRunningMonthKey(key);
        else setLocatorRunningDayKey(key);
    };

    const idleSelectionKey =
        locatorIdlePeriod === 'week'
            ? locatorIdleWeekKey
            : locatorIdlePeriod === 'month'
              ? locatorIdleMonthKey
              : locatorIdleDayKey;

    const salikSelectionKey =
        salikPeriod === 'week'
            ? salikWeekKey
            : salikPeriod === 'month'
              ? salikMonthKey
              : salikDayKey;

    const locatorIdleChartData = useMemo(() => {
        const bucket = locatorData?.idleTimeByVehicle?.[locatorIdlePeriod];
        return withShortNames(readLocatorBucketSeries(bucket, idleSelectionKey));
    }, [locatorData?.idleTimeByVehicle, locatorIdlePeriod, idleSelectionKey]);

    const salikChartData = useMemo(() => {
        const bucket = locatorData?.salikWise?.[salikPeriod];
        return withShortNames(readLocatorBucketSeries(bucket, salikSelectionKey));
    }, [locatorData?.salikWise, salikPeriod, salikSelectionKey]);

    const idleSubtitle = useMemo(() => {
        const bucket = locatorData?.idleTimeByVehicle?.[locatorIdlePeriod];
        const selected = formatLocatorBucketSubtitle(
            bucket,
            idleSelectionKey,
            'Idle / parked time per vehicle',
        );
        if (locatorIdlePeriod === 'day') {
            return `Idle time on ${selected}`;
        }
        if (locatorIdlePeriod === 'week') {
            return `Idle time for ${selected}`;
        }
        if (locatorIdlePeriod === 'month') {
            return `Idle time in ${selected}`;
        }
        return `Idle time for ${selected}`;
    }, [locatorData?.idleTimeByVehicle, locatorIdlePeriod, idleSelectionKey]);

    const salikSubtitle = useMemo(() => {
        const bucket = locatorData?.salikWise?.[salikPeriod];
        const selected = formatLocatorBucketSubtitle(
            bucket,
            salikSelectionKey,
            'Toll price taken per vehicle (AED)',
        );
        if (salikPeriod === 'day') {
            return `Salik toll price on ${selected}`;
        }
        if (salikPeriod === 'week') {
            return `Salik toll price for ${selected}`;
        }
        return `Salik toll price in ${selected}`;
    }, [locatorData?.salikWise, salikPeriod, salikSelectionKey]);

    const handleIdlePeriodChange = (period) => {
        setLocatorIdlePeriod(period);
        const bucket = locatorData?.idleTimeByVehicle?.[period];
        if (!bucket?.defaultKey) return;
        if (period === 'week') setLocatorIdleWeekKey(bucket.defaultKey);
        else if (period === 'month') setLocatorIdleMonthKey(bucket.defaultKey);
        else setLocatorIdleDayKey(bucket.defaultKey);
    };

    const handleIdleSelectionChange = (key) => {
        if (locatorIdlePeriod === 'week') setLocatorIdleWeekKey(key);
        else if (locatorIdlePeriod === 'month') setLocatorIdleMonthKey(key);
        else setLocatorIdleDayKey(key);
    };

    const handleSalikPeriodChange = (period) => {
        setSalikPeriod(period);
        const bucket = locatorData?.salikWise?.[period];
        if (!bucket?.defaultKey) return;
        if (period === 'week') setSalikWeekKey(bucket.defaultKey);
        else if (period === 'month') setSalikMonthKey(bucket.defaultKey);
        else setSalikDayKey(bucket.defaultKey);
    };

    const handleSalikSelectionChange = (key) => {
        if (salikPeriod === 'week') setSalikWeekKey(key);
        else if (salikPeriod === 'month') setSalikMonthKey(key);
        else setSalikDayKey(key);
    };

    const locatorChartDataById = useMemo(
        () => ({
            odometer: odometerChartData,
            running: runningKmChartData,
            idle: locatorIdleChartData,
            salik: salikChartData,
        }),
        [odometerChartData, runningKmChartData, locatorIdleChartData, salikChartData],
    );

    const locatorChartsById = useMemo(
        () => Object.fromEntries(LOCATOR_CHARTS.map((chart) => [chart.id, chart])),
        [],
    );

    const locatorPeriodControls = (chartId) => {
        if (chartId === 'running') {
            return (
                <RunningKmControls
                    period={locatorRunningPeriod}
                    onPeriodChange={handleRunningPeriodChange}
                    bucket={locatorData?.runningKmByVehicle?.[locatorRunningPeriod]}
                    selectedKey={runningKmSelectionKey}
                    onSelectKey={handleRunningSelectionChange}
                    trackingFrom={locatorData?.trackingFrom}
                />
            );
        }
        if (chartId === 'idle') {
            return (
                <IdleTimeControls
                    period={locatorIdlePeriod}
                    onPeriodChange={handleIdlePeriodChange}
                    bucket={locatorData?.idleTimeByVehicle?.[locatorIdlePeriod]}
                    selectedKey={idleSelectionKey}
                    onSelectKey={handleIdleSelectionChange}
                    trackingFrom={locatorData?.trackingFrom}
                />
            );
        }
        if (chartId === 'salik') {
            return (
                <SalikControls
                    period={salikPeriod}
                    onPeriodChange={handleSalikPeriodChange}
                    bucket={locatorData?.salikWise?.[salikPeriod]}
                    selectedKey={salikSelectionKey}
                    onSelectKey={handleSalikSelectionChange}
                    trackingFrom={locatorData?.trackingFrom}
                />
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-teal-200 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-semibold animate-pulse">Loading fleet dashboard…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-100 bg-red-50/80 p-8 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm font-bold text-red-800">{error}</p>
                {onRefresh ? (
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="group/retry inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold transition-all duration-300 hover:bg-red-50 hover:scale-105"
                    >
                        <RefreshCw size={16} className="transition-transform duration-500 group-hover/retry:rotate-180" />
                        Retry
                    </button>
                ) : null}
            </div>
        );
    }

    if (!data) return null;

    const r = data.reminders || {};
    const vs = data.vehicleStatus || {};
    const documentExpiryChartData = Array.isArray(data.documentExpiryChartData)
        ? data.documentExpiryChartData
        : [
              { name: 'Expired', value: 0, docs: [] },
              { name: '10-30 Days', value: 0, docs: [] },
              { name: 'More', value: 0, docs: [] },
          ];
    const oilServiceDue = r.oilServiceDue ?? r.service?.due ?? 0;
    const registrationExpiresWithin30 =
        r.registrationExpiresWithin30 ??
        (Number(r.registration?.due || 0) + Number(r.registration?.dueSoon || 0));
    const upcomingOilServiceRows = Array.isArray(r.upcomingOilServiceRows)
        ? r.upcomingOilServiceRows
        : [];

    const openDetailModal = (bucket) => {
        setDetailModalBucket(bucket);
        setDetailModalOpen(true);
    };

    const closeDetailModal = () => {
        setDetailModalOpen(false);
        setDetailModalBucket(null);
    };

    const handleDetailRowClick = (row) => {
        if (row?.fineRecordId || (row?.modalKind === 'vehicleFine' && row?._id)) {
            const fineId = row.fineRecordId || row._id;
            closeDetailModal();
            navigateFromList(router, `/HRM/Fine/${fineId}`, FLEET_DASHBOARD_LIST_RETURN);
            return;
        }
        const vehicleId = row?.vehicleId;
        if (!vehicleId) return;
        const path = buildVehicleDetailPath(vehicleId, {
            tab: row.tab || 'basic',
            focusCard: row.focusCard || undefined,
        });
        if (!path) return;
        closeDetailModal();
        navigateFromList(router, path, FLEET_DASHBOARD_LIST_RETURN);
    };

    const chartAnim = chartsReady ? 1400 : 0;

    return (
        <div className="space-y-6">
            <div className="flex gap-4 mb-2 min-h-[320px] transition-all duration-300 ease-out">
                <DashboardExpandSlot
                    slotKey="summary"
                    expandedKey={topRowExpanded}
                    totalSlots={3}
                    onToggle={setTopRowExpanded}
                    className="min-w-0"
                >
                <ScrollReveal delayMs={0} durationMs={600} className="h-full min-w-0">
                    <div className="h-full min-h-[320px] bg-white rounded-xl shadow-sm border border-gray-100 flex p-6 gap-6 overflow-hidden">
                        <div className="w-[150px] shrink-0 flex flex-col gap-4">
                            {[
                                {
                                    label: 'Oil service due',
                                    value: oilServiceDue,
                                    onClick: () =>
                                        openDetailModal({
                                            name: 'Oil service due',
                                            title: 'Oil service due',
                                            subtitle: 'Vehicles with oil / next service overdue',
                                            docs: r.oilServiceDueRows || [],
                                        }),
                                },
                                {
                                    label: 'Registration expires in',
                                    value: registrationExpiresWithin30,
                                    onClick: () =>
                                        openDetailModal({
                                            name: 'Registration expires in',
                                            title: 'Registration expires in ≤ 30 days',
                                            subtitle: 'Mulkia registration within 30 days (incl. expired)',
                                            docs: r.registrationExpiresWithin30Rows || [],
                                        }),
                                },
                            ].map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={item.onClick}
                                    className="flex-1 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center p-2 hover:bg-white hover:shadow-md transition-all duration-300 cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                >
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 leading-tight px-1">
                                        {item.label}
                                    </span>
                                    <span className="text-4xl font-black" style={{ color: '#dc2626' }}>
                                        <AnimatedCount value={item.value || 0} />
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                            <h3 className="text-[11px] font-bold text-gray-400 text-center uppercase tracking-[0.2em] mb-4">
                                Document Expiry
                            </h3>
                            <RechartsBox height={200} minHeight={160} className="flex-1">
                                <BarChart
                                    data={documentExpiryChartData}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <XAxis
                                        dataKey="name"
                                        fontSize={10}
                                        fontWeight="700"
                                        axisLine={false}
                                        tickLine={false}
                                        dy={5}
                                    />
                                    <YAxis hide={true} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: 'none',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        }}
                                    />
                                    <Bar
                                        dataKey="value"
                                        radius={[6, 6, 0, 0]}
                                        isAnimationActive={chartsReady}
                                        animationDuration={chartAnim || 1500}
                                        barSize={30}
                                        className="cursor-pointer"
                                        onClick={(entry, index) => {
                                            const rows = documentExpiryChartData || [];
                                            const row =
                                                (entry && entry.payload && entry.payload.name !== undefined
                                                    ? entry.payload
                                                    : null) ??
                                                (typeof index === 'number' && rows[index] ? rows[index] : null) ??
                                                entry;
                                            if (!row?.name) return;
                                            openDetailModal({
                                                name: row.name,
                                                title: `Documents Expiring: ${row.name}`,
                                                subtitle: 'Vehicle documents (mulkia, insurance, and other cards)',
                                                docs: sortFleetModalRows(row.docs || []),
                                            });
                                        }}
                                    >
                                        <LabelList
                                            dataKey="value"
                                            position="top"
                                            style={{
                                                fill: '#dc2626',
                                                fontSize: '12px',
                                                fontWeight: '900',
                                            }}
                                            offset={8}
                                        />
                                        {documentExpiryChartData.map((_, index) => (
                                            <Cell key={`doc-expiry-${index}`} fill="url(#fleetDocExpiryBarGrad)" />
                                        ))}
                                    </Bar>
                                    <defs>
                                        <linearGradient id="fleetDocExpiryBarGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#1E40AF" stopOpacity={1} />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </RechartsBox>
                        </div>
                    </div>
                </ScrollReveal>
                </DashboardExpandSlot>

                <DashboardExpandSlot
                    slotKey="status"
                    expandedKey={topRowExpanded}
                    totalSlots={3}
                    onToggle={setTopRowExpanded}
                    className="min-w-0"
                >
                <ScrollReveal delayMs={80} durationMs={600} className="h-full min-w-0">
                    <div className="h-full min-h-[320px] bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <div className="h-full grid grid-cols-2 gap-3 content-stretch">
                            {[
                                {
                                    label: 'Assigned',
                                    value: vs.assigned ?? 0,
                                    onClick: () =>
                                        openDetailModal({
                                            name: 'Assigned',
                                            title: 'Assigned vehicles',
                                            modalKind: 'assigned',
                                            docs: vs.assignedRows || [],
                                        }),
                                },
                                {
                                    label: 'In service',
                                    value: vs.inService ?? 0,
                                    onClick: () =>
                                        openDetailModal({
                                            name: 'In service',
                                            title: 'Vehicles in service',
                                            docs: vs.inServiceRows || [],
                                        }),
                                },
                                {
                                    label: 'Unassigned',
                                    value: vs.unassigned ?? 0,
                                    onClick: () =>
                                        openDetailModal({
                                            name: 'Unassigned',
                                            title: 'Unassigned vehicles',
                                            modalKind: 'unassigned',
                                            docs: vs.unassignedRows || [],
                                        }),
                                },
                                {
                                    label: 'Total service pending',
                                    value: vs.totalServices ?? 0,
                                    onClick: () =>
                                        openDetailModal({
                                            name: 'Total service pending',
                                            title: 'Pending service requests',
                                            modalKind: 'pendingService',
                                            docs: vs.totalServiceRows || [],
                                        }),
                                },
                            ].map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={item.onClick}
                                    className="bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center p-2 hover:bg-white hover:shadow-md transition-all duration-300 cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                >
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 leading-tight px-1">
                                        {item.label}
                                    </span>
                                    <span className="text-3xl font-black" style={{ color: '#dc2626' }}>
                                        <AnimatedCount value={item.value || 0} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </ScrollReveal>
                </DashboardExpandSlot>

                <DashboardExpandSlot
                    slotKey="modelYear"
                    expandedKey={topRowExpanded}
                    totalSlots={3}
                    onToggle={setTopRowExpanded}
                    className="min-w-0"
                >
                <ScrollReveal delayMs={140} durationMs={600} className="h-full min-w-0">
                    <div className="h-full min-h-[320px] max-h-[360px] bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                            Vehicle model year
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-1 mb-3">
                            Hover a slice for the year. Click to open that year in the vehicle list.
                        </p>
                        <ModelYearDonutPanel
                            pieData={pieData}
                            chartAnim={chartAnim}
                            onSliceClick={(entry) => {
                                const year = String(entry?.name || '').trim();
                                if (!year) return;
                                navigateFromList(
                                    router,
                                    vehicleDashboardModelYearListHref(year),
                                    FLEET_DASHBOARD_LIST_RETURN,
                                );
                            }}
                        />
                    </div>
                </ScrollReveal>
                </DashboardExpandSlot>
            </div>

            <FleetDashboardDetailModal
                open={detailModalOpen}
                bucket={detailModalBucket}
                onClose={closeDetailModal}
                onRowClick={handleDetailRowClick}
            />

            <div className="flex gap-4 items-stretch transition-all duration-300 ease-out">
                <DashboardExpandSlot
                    slotKey="fines"
                    expandedKey={midRowExpanded}
                    totalSlots={2}
                    onToggle={setMidRowExpanded}
                    className="min-w-0 h-full"
                >
                <ScrollReveal delayMs={0} durationMs={700} className="h-full min-w-0">
                    <CompactChartCard
                        title="Vehicle fines"
                        titleExtra={
                            <span
                                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-700 tabular-nums"
                                title="Finished-workflow fines in this period. Amount is employee share still to pay (unpaid and partial), excluding company-only."
                            >
                                {vehicleFinesSummary.count}{' '}
                                {vehicleFinesSummary.count === 1 ? 'fine' : 'fines'}
                                <span className="font-black text-rose-300">·</span>
                                {formatFleetModalAmount(vehicleFinesSummary.unpaid)} unpaid
                            </span>
                        }
                        subtitle="Employee unpaid by plate. Click a bar to open Access Vehicle Fine for that vehicle."
                        headerExtra={
                            <div className="space-y-1.5">
                                <CompactPeriodTabBar
                                    options={SERVICE_COST_PERIOD_TABS}
                                    value={vehicleFinePeriod}
                                    onChange={setVehicleFinePeriod}
                                />
                                {vehicleFinePeriod === 'custom' ? (
                                    <DateRangePicker
                                        startValue={vehicleFineCustomFrom}
                                        endValue={vehicleFineCustomTo}
                                        onStartChange={setVehicleFineCustomFrom}
                                        onEndChange={setVehicleFineCustomTo}
                                        placeholder="Select date range"
                                        className="h-8 min-w-0 w-full max-w-full text-[10px] px-2"
                                    />
                                ) : null}
                            </div>
                        }
                    >
                        {vehicleFinesChartData.length === 0 ? (
                            <p className="text-sm text-slate-400 h-full flex items-center justify-center text-center">
                                {vehicleFinesSummary.count > 0
                                    ? 'All finished fines in this period are fully paid.'
                                    : 'No vehicle fines in this period.'}
                            </p>
                        ) : (
                            <RechartsBox
                                height={COMPACT_ROW_CHART_HEIGHT}
                                minHeight={COMPACT_ROW_CHART_MIN}
                                className="h-full"
                                fillParent
                            >
                                <BarChart
                                    data={vehicleFinesChartData}
                                    margin={{ top: 18, right: 8, left: 0, bottom: vehicleFinesChartData.length > 4 ? 36 : 8 }}
                                    barCategoryGap="18%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="chartName"
                                        tick={
                                            <PlateChartAxisTick
                                                angle={vehicleFinesChartData.length > 4 ? -28 : 0}
                                                textAnchor={
                                                    vehicleFinesChartData.length > 4 ? 'end' : 'middle'
                                                }
                                            />
                                        }
                                        interval={0}
                                        height={vehicleFinesChartData.length > 4 ? 42 : 24}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={40}
                                        tickFormatter={formatCostAxisTick}
                                    />
                                    <RechartsTooltip
                                        formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Employee unpaid']}
                                        labelFormatter={(_label, payload) => payload?.[0]?.payload?.name || _label}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar
                                        dataKey="total"
                                        fill="#e11d48"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={36}
                                        className="cursor-pointer"
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                        onClick={(entry, index) => {
                                            const rows = vehicleFinesChartData || [];
                                            const row =
                                                (entry && entry.payload) ||
                                                (typeof index === 'number' && rows[index] ? rows[index] : null) ||
                                                entry;
                                            if (!row || (!row.fines && !row.name && !row.vehicleId)) return;
                                            const fines = Array.isArray(row.fines) ? row.fines : [];
                                            const fineIds = fines
                                                .map((fine) => fine?._id || fine?.fineRecordId)
                                                .filter(Boolean);
                                            const customIncomplete =
                                                vehicleFinePeriod === 'custom' &&
                                                !vehicleFineCustomFrom &&
                                                !vehicleFineCustomTo;
                                            const from =
                                                !customIncomplete && vehicleFineRange?.start
                                                    ? format(vehicleFineRange.start, 'yyyy-MM-dd')
                                                    : '';
                                            const to =
                                                !customIncomplete && vehicleFineRange?.end
                                                    ? format(vehicleFineRange.end, 'yyyy-MM-dd')
                                                    : '';
                                            navigateFromList(
                                                router,
                                                vehicleDashboardFineListHref({
                                                    vehicleId: row.vehicleId || '',
                                                    plate: row.plate || row.name || row.label || '',
                                                    fineIds,
                                                    from,
                                                    to,
                                                }),
                                                FLEET_DASHBOARD_LIST_RETURN,
                                            );
                                        }}
                                    >
                                        <LabelList
                                            dataKey="total"
                                            position="top"
                                            formatter={(v) => `AED ${Number(v).toLocaleString()}`}
                                            style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }}
                                        />
                                    </Bar>
                                </BarChart>
                            </RechartsBox>
                        )}
                    </CompactChartCard>
                </ScrollReveal>
                </DashboardExpandSlot>

                <DashboardExpandSlot
                    slotKey="upcoming"
                    expandedKey={midRowExpanded}
                    totalSlots={2}
                    onToggle={setMidRowExpanded}
                    className="min-w-0 h-full"
                >
                <ScrollReveal delayMs={80} durationMs={700} className="h-full min-w-0">
                    <div
                        className={`${compactChartPanelClass} h-full flex flex-col`}
                        style={{ minHeight: COMPACT_ROW_CARD_HEIGHT }}
                    >
                        <div className="shrink-0">
                            <div className="flex items-baseline justify-between gap-2">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Upcoming Events
                                </h3>
                                <span className="text-xs font-black text-gray-500 tabular-nums">
                                    {upcomingOilServiceRows.length}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 mb-2">
                                Next oil service by vehicle · soonest first
                            </p>
                        </div>
                        {upcomingOilServiceRows.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-center text-xs font-semibold text-gray-400 px-2">
                                No upcoming oil service dates.
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                                {upcomingOilServiceRows.map((row, idx) => {
                                    const days = Number(row?.daysRemaining);
                                    const pillClass = !Number.isFinite(days)
                                        ? 'bg-gray-100 text-gray-500'
                                        : days <= 7
                                          ? 'bg-red-100 text-red-600'
                                          : days <= 30
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-emerald-50 text-emerald-700';
                                    return (
                                        <button
                                            key={`${row.vehicleId || row.assetId || idx}-${idx}`}
                                            type="button"
                                            onClick={() => handleDetailRowClick(row)}
                                            className="w-full flex items-center justify-between gap-3 bg-gray-50 rounded-lg border border-gray-100 p-2.5 text-left hover:bg-white hover:shadow-md transition-all duration-300 cursor-pointer active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                        >
                                            <span className="min-w-0">
                                                <span
                                                    className="block text-sm font-bold text-gray-800 truncate"
                                                    title={row.plate || row.assetId || '—'}
                                                >
                                                    {row.plate || row.assetId || '—'}
                                                </span>
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">
                                                    {row.cardName || 'Oil / Next Service'}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-right">
                                                <span className="block text-[11px] font-semibold text-gray-600 tabular-nums">
                                                    {formatFleetModalExpiryDate(row.expiryDate)}
                                                </span>
                                                <span
                                                    className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums ${pillClass}`}
                                                >
                                                    {formatFleetModalRemaining(row.daysRemaining)}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </ScrollReveal>
                </DashboardExpandSlot>
            </div>

            <div className="flex gap-4 items-stretch transition-all duration-300 ease-out">
                <DashboardExpandSlot
                    slotKey="value"
                    expandedKey={bottomRowExpanded}
                    totalSlots={3}
                    onToggle={setBottomRowExpanded}
                    className="min-w-0 h-full"
                >
                <ScrollReveal delayMs={100} durationMs={750} className="h-full min-w-0">
                    <LowerChartCard
                        title="Vehicle value by asset"
                        subtitle="All vehicles. No recorded value shows as 0."
                    >
                        {vehicleValueBars.length === 0 ? (
                            <p className="text-sm text-slate-400 h-full flex items-center justify-center text-center">
                                No vehicles on record.
                            </p>
                        ) : (
                            <RechartsBox
                                height={LOWER_ROW_CHART_HEIGHT}
                                minHeight={LOWER_ROW_CHART_HEIGHT}
                                className="h-full"
                                fillParent
                            >
                                <BarChart
                                    data={vehicleValueBars}
                                    margin={{
                                        top: 8,
                                        right: 8,
                                        left: 0,
                                        bottom: vehicleValueBars.length > 4 ? 36 : 8,
                                    }}
                                    barCategoryGap="18%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="chartName"
                                        tick={
                                            <PlateChartAxisTick
                                                angle={vehicleValueBars.length > 4 ? -28 : 0}
                                                textAnchor={vehicleValueBars.length > 4 ? 'end' : 'middle'}
                                                fill="#94a3b8"
                                            />
                                        }
                                        interval={0}
                                        height={vehicleValueBars.length > 4 ? 52 : 24}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                                    <RechartsTooltip
                                        formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Value']}
                                        labelFormatter={(_label, payload) => payload?.[0]?.payload?.name || _label}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar
                                        dataKey="value"
                                        fill="#7c3aed"
                                        radius={[8, 8, 0, 0]}
                                        maxBarSize={48}
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                    />
                                </BarChart>
                            </RechartsBox>
                        )}
                    </LowerChartCard>
                </ScrollReveal>
                </DashboardExpandSlot>

                <DashboardExpandSlot
                    slotKey="usage"
                    expandedKey={bottomRowExpanded}
                    totalSlots={3}
                    onToggle={setBottomRowExpanded}
                    className="min-w-0 h-full"
                >
                <ScrollReveal delayMs={180} durationMs={750} className="h-full min-w-0">
                    <LowerChartCard subtitle="">
                        <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/80">
                            <p className="text-sm font-semibold text-gray-400">Coming soon</p>
                            <p className="text-xs text-gray-400 mt-1">Will add soon</p>
                        </div>
                    </LowerChartCard>
                </ScrollReveal>
                </DashboardExpandSlot>

                <DashboardExpandSlot
                    slotKey="serviceCost"
                    expandedKey={bottomRowExpanded}
                    totalSlots={3}
                    onToggle={setBottomRowExpanded}
                    className="min-w-0 h-full"
                >
                <ScrollReveal delayMs={240} durationMs={750} className="h-full min-w-0">
                    <LowerChartCard
                        title={
                            serviceCostDrillVehicle
                                ? `Service cost · ${fleetVehiclePlate(serviceCostDrillVehicle) || 'Vehicle'}`
                                : 'Service cost by vehicle'
                        }
                        subtitle={
                            serviceCostDrillVehicle
                                ? 'Each bar is a service type for this vehicle. Click Back for all vehicles.'
                                : 'Plate numbers on axis · hover for full plate. Click a bar for service types.'
                        }
                        headerExtra={
                            <div className="space-y-1.5">
                                {serviceCostDrillVehicle ? (
                                    <button
                                        type="button"
                                        onClick={() => setServiceCostDrillVehicleId(null)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100"
                                    >
                                        <ChevronLeft size={12} />
                                        All vehicles
                                    </button>
                                ) : null}
                                <CompactPeriodTabBar
                                    options={SERVICE_COST_PERIOD_TABS}
                                    value={serviceCostPeriod}
                                    onChange={setServiceCostPeriod}
                                />
                                {serviceCostPeriod === 'custom' ? (
                                    <DateRangePicker
                                        startValue={serviceCostCustomFrom}
                                        endValue={serviceCostCustomTo}
                                        onStartChange={setServiceCostCustomFrom}
                                        onEndChange={setServiceCostCustomTo}
                                        placeholder="Select date range"
                                        className="h-8 min-w-0 w-full max-w-full text-[10px] px-2"
                                    />
                                ) : null}
                            </div>
                        }
                    >
                        {serviceCostChartEmpty ? (
                            <p className="text-sm text-slate-400 h-full flex items-center justify-center text-center">
                                {serviceCostDrillVehicle
                                    ? 'No service costs for this vehicle in this period.'
                                    : 'No service costs in this period.'}
                            </p>
                        ) : (
                            <RechartsBox
                                height={LOWER_ROW_CHART_HEIGHT}
                                minHeight={LOWER_ROW_CHART_HEIGHT}
                                className="h-full"
                                fillParent
                            >
                                <BarChart
                                    data={serviceCostChartData}
                                    margin={{
                                        top: 18,
                                        right: 8,
                                        left: 0,
                                        bottom: serviceCostChartData.length > 4 ? 36 : 8,
                                    }}
                                    barCategoryGap="18%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="chartName"
                                        tick={
                                            <PlateChartAxisTick
                                                angle={serviceCostChartData.length > 4 ? -28 : 0}
                                                textAnchor={
                                                    serviceCostChartData.length > 4 ? 'end' : 'middle'
                                                }
                                            />
                                        }
                                        interval={0}
                                        height={serviceCostChartData.length > 4 ? 42 : 24}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={40}
                                        tickFormatter={formatCostAxisTick}
                                    />
                                    <RechartsTooltip
                                        formatter={(v) => [`AED ${Number(v).toLocaleString()}`, 'Total']}
                                        labelFormatter={(_label, payload) => payload?.[0]?.payload?.name || _label}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar
                                        dataKey="total"
                                        fill="#0284c7"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={36}
                                        className={serviceCostDrillVehicle ? undefined : 'cursor-pointer'}
                                        animationDuration={chartAnim}
                                        animationEasing="ease-out"
                                        onClick={(entry, index) => {
                                            if (serviceCostDrillVehicle) return;
                                            const rows = serviceCostByVehicle || [];
                                            const row =
                                                (entry && entry.payload) ||
                                                (typeof index === 'number' && rows[index] ? rows[index] : null) ||
                                                entry;
                                            const vehicleId = row?.vehicleId;
                                            if (!vehicleId) return;
                                            setServiceCostDrillVehicleId(String(vehicleId));
                                        }}
                                    >
                                        {serviceCostDrillVehicle
                                            ? serviceCostChartData.map((row, i) => (
                                                  <Cell
                                                      key={`svc-type-${row.name}`}
                                                      fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                                                  />
                                              ))
                                            : null}
                                        <LabelList
                                            dataKey="total"
                                            position="top"
                                            formatter={(v) => {
                                                const n = Number(v);
                                                if (!n) return '';
                                                return `AED ${n.toLocaleString()}`;
                                            }}
                                            style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }}
                                        />
                                    </Bar>
                                </BarChart>
                            </RechartsBox>
                        )}
                    </LowerChartCard>
                </ScrollReveal>
                </DashboardExpandSlot>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-600" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">
                            Locator GPS
                        </h2>
                    </div>
                    {onLocatorRefresh ? (
                        <button
                            type="button"
                            onClick={onLocatorRefresh}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-teal-700 hover:border-teal-200 transition-colors"
                        >
                            <RefreshCw size={14} />
                            Refresh GPS
                        </button>
                    ) : null}
                </div>

                {locatorLoading ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500">
                        Loading Locator GPS data…
                    </div>
                ) : locatorError ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-6 text-center">
                        <p className="text-sm font-semibold text-amber-800">{locatorError}</p>
                    </div>
                ) : !locatorData?.configured ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
                        Locator GPS is not configured on the server.
                    </div>
                ) : locatorData?.connected === false ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-6 text-center">
                        <p className="text-sm font-semibold text-amber-800">
                            {locatorData?.message || 'Could not load Locator GPS positions.'}
                        </p>
                        {onLocatorRefresh ? (
                            <button
                                type="button"
                                onClick={onLocatorRefresh}
                                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-semibold text-amber-800 hover:bg-amber-50"
                            >
                                <RefreshCw size={14} />
                                Try again
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="space-y-5">
                        {locatorData?.snapshotWarning ? (
                            <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
                                GPS live data loaded, but history snapshots could not be saved. Charts may show limited running km until snapshots are captured.
                            </div>
                        ) : null}
                        {locatorData?.trackingFrom ? (
                            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                                <span className="font-semibold text-slate-700">Current km / odometer</span> comes
                                live from Locator <code className="text-[11px]">/v1/position/latest</code> (
                                <code className="text-[11px]">totalDistanceKm</code>).{' '}
                                <span className="font-semibold text-slate-700">Running km</span> for each day is
                                the change in that total between saved samples. Locator&apos;s published API has
                                no history endpoint, so past days only appear when this server was online and
                                capturing GPS (every ~2 min). History from{' '}
                                {new Date(locatorData.trackingFrom).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                })}
                                {locatorData.snapshotCount
                                    ? ` · ${locatorData.snapshotCount.toLocaleString()} sample(s) on ${locatorData.trackingDaysWithData || 0} day(s)`
                                    : ''}
                                .
                            </div>
                        ) : (
                            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                                Current km is live from Locator. Day-by-day running km will fill in as GPS samples
                                are saved (every ~2 minutes while the backend is running).
                            </div>
                        )}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
                            <ScrollReveal delayMs={0} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.odometer}
                                    data={locatorChartDataById.odometer}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                />
                            </ScrollReveal>
                            <ScrollReveal delayMs={80} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.running}
                                    data={runningKmChartData}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                    periodControls={locatorPeriodControls('running')}
                                    subtitleOverride={runningKmSubtitle}
                                />
                            </ScrollReveal>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
                            <ScrollReveal delayMs={160} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.idle}
                                    data={locatorChartDataById.idle}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                    periodControls={locatorPeriodControls('idle')}
                                    subtitleOverride={idleSubtitle}
                                />
                            </ScrollReveal>
                            <ScrollReveal delayMs={240} durationMs={750} className="h-full">
                                <LocatorStaticChartCard
                                    chart={locatorChartsById.salik}
                                    data={locatorChartDataById.salik}
                                    chartAnim={chartAnim}
                                    chartsReady={chartsReady}
                                    runningPeriod={locatorRunningPeriod}
                                    idlePeriod={locatorIdlePeriod}
                                    periodControls={locatorPeriodControls('salik')}
                                    subtitleOverride={salikSubtitle}
                                />
                            </ScrollReveal>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
