'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import RechartsBox from '@/components/charts/RechartsBox';
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    LabelList,
    Line,
    Pie,
    PieChart,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertCircle,
    CalendarDays,
    ClipboardList,
    Clock,
    HelpCircle,
    RefreshCw,
    Truck,
    Wrench,
    XCircle,
} from 'lucide-react';
import { buildVehicleDetailPath } from '@/utils/assetNotificationRouting';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { navHrefProps } from '@/utils/linkContextMenu';
import { isVehicleAccessFineVisible } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

const FLEET_DASHBOARD_LIST_RETURN = '/HRM/Asset/Vehicle/dashboard';

const PALETTE = {
    blue: '#1769E8',
    teal: '#10B3A3',
    yellow: '#FF9900',
    purple: '#8054E8',
    red: '#F04444',
    orange: '#FF9900',
};

const YEAR_BUCKET_COLORS = ['#1769E8', '#0FAF9C', '#FF9900', '#8054E8'];
const COST_COLORS = {
    Fuel: '#1769E8',
    Service: '#0FAF9C',
    Insurance: '#FF9900',
    Registration: '#8054E8',
    Fines: '#F04444',
};

const EXPIRY_COLORS = ['#F83F3F', '#FF6256', '#FFA20A', '#0EAA9C'];

const AXIS_TICK = { fontSize: 8.5, fill: '#6F7C90' };
const GRID_STROKE = '#E7EBF0';
const CARD_SHADOW = '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.025)';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const tooltipStyle = {
    borderRadius: '7px',
    border: '1px solid #DFE5EA',
    background: '#ffffff',
    boxShadow: '0 4px 12px rgba(16, 24, 40, 0.08)',
    fontSize: '11px',
    color: '#36465D',
};

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

function formatAed(value) {
    const n = Number(value) || 0;
    return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatAxisNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(n);
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

function shortPlate(plate, max = 10) {
    const full = String(plate || '').trim();
    if (!full) return '—';
    const digits = full.match(/\d{3,}/g);
    if (digits?.length) {
        const num = digits[digits.length - 1];
        return num.length <= max ? num : `${num.slice(0, max - 1)}…`;
    }
    if (full.length <= max) return full;
    return `${full.slice(0, max - 1)}…`;
}

function uniqueChartNames(rows, max = 10) {
    const used = new Map();
    return (rows || []).map((row) => {
        const base = shortPlate(row.name, max);
        const count = used.get(base) || 0;
        used.set(base, count + 1);
        if (count === 0) return { ...row, chartName: base };
        const extra = String(row.deviceId || row.plate || count + 1).replace(/\D/g, '').slice(-4) || String(count + 1);
        return { ...row, chartName: `${base}·${extra}` };
    });
}

function locatorRowLabel(row) {
    return String(row?.chartLabel || row?.name || row?.plate || '').trim() || '—';
}

function idleMinutesToHours(minutes) {
    return Math.round(((Number(minutes) || 0) / 60) * 10) / 10;
}

function eventYear(dateVal) {
    if (!dateVal) return null;
    const y = new Date(dateVal).getFullYear();
    return Number.isFinite(y) ? y : null;
}

function inYear(dateVal, year) {
    if (!year) return true;
    const y = eventYear(dateVal);
    return y == null ? false : y === Number(year);
}

function toDateInputValue(dateVal) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultCustomRange(year) {
    const y = Number(year) || new Date().getFullYear();
    const now = new Date();
    const to = now.getFullYear() === y ? now : new Date(y, 11, 31);
    return {
        from: `${y}-01-01`,
        to: toDateInputValue(to),
    };
}

function inDateKeyRange(key, from, to) {
    const k = String(key || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
    if (from && k < from) return false;
    if (to && k > to) return false;
    return true;
}

function idlePeriodCaption(tab, range, year) {
    if (tab === 'custom' && range?.from && range?.to) {
        return `${range.from} → ${range.to}`;
    }
    const now = new Date();
    const y = Number(year) || now.getFullYear();
    if (tab === 'month') {
        const monthDate = y === now.getFullYear() ? now : new Date(y, 11, 1);
        return monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    if (tab === 'year') return String(y);
    return 'Today';
}

function inDateRange(dateVal, from, to) {
    if (!from && !to) return true;
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return false;
    const t = d.getTime();
    if (from) {
        const start = new Date(`${from}T00:00:00`);
        if (!Number.isNaN(start.getTime()) && t < start.getTime()) return false;
    }
    if (to) {
        const end = new Date(`${to}T23:59:59.999`);
        if (!Number.isNaN(end.getTime()) && t > end.getTime()) return false;
    }
    return true;
}

function formatChartDay(dateVal) {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function dayKey(dateVal) {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '';
    return toDateInputValue(d);
}

function parseLocatorDayKey(option) {
    const key = String(option?.key || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
    const sub = String(option?.sublabel || '').trim();
    const parsed = new Date(sub);
    if (!Number.isNaN(parsed.getTime())) return toDateInputValue(parsed);
    return '';
}

function modelYearBucket(year, currentYear) {
    const y = parseInt(year, 10);
    if (!Number.isFinite(y)) return 'Unknown';
    if (y <= currentYear - 6) return `${currentYear - 6} & Earlier`;
    if (y <= currentYear - 4) return `${currentYear - 5}-${currentYear - 4}`;
    if (y <= currentYear - 2) return `${currentYear - 3}-${currentYear - 2}`;
    return `${currentYear - 1}-${currentYear}`;
}

function topRows(rows, limit = 8) {
    return [...(rows || [])]
        .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
        .slice(0, limit);
}

function groupSum(rows, keyFn) {
    const map = new Map();
    for (const row of rows || []) {
        const key = keyFn(row);
        if (!key) continue;
        if (!map.has(key)) map.set(key, { ...row, name: key, value: 0 });
        map.get(key).value += Number(row.value) || 0;
    }
    return [...map.values()];
}

function locatorMatchesVehicle(row, vehicle) {
    const hay = `${row?.name || ''} ${row?.plate || ''} ${row?.chartLabel || ''}`.toLowerCase();
    const plate = fleetVehiclePlate(vehicle).toLowerCase();
    const number = String(vehicle?.plateNumber || '').toLowerCase();
    const device = String(vehicle?.locatorDeviceId ?? '');
    if (device && String(row?.deviceId ?? '') === device) return true;
    if (number && hay.includes(number)) return true;
    if (plate && plate !== '—' && hay.includes(plate)) return true;
    return false;
}

function filterLocatorRows(rows, vehicles) {
    if (!vehicles?.length) return [];
    return (rows || []).filter((row) => vehicles.some((v) => locatorMatchesVehicle(row, v)));
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
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
                                    {modalKind !== 'assigned' &&
                                    modalKind !== 'unassigned' &&
                                    modalKind !== 'pendingService' &&
                                    modalKind !== 'vehicleFines' ? (
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
                                    const fineHref =
                                        row?.fineRecordId || row?._id ? `/HRM/Fine/${row.fineRecordId || row._id}` : '';
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
                                                    <td className="px-4 py-4 text-sm font-semibold text-gray-700">{row.assetId || '—'}</td>
                                                    <td className="px-4 py-4 font-bold text-gray-800">{row.plate || '—'}</td>
                                                    <td className="px-4 py-4 text-sm text-gray-700">{row.vehicleName || '—'}</td>
                                                    <td className="px-4 py-4 text-sm font-medium text-gray-700">{row.assignedUser || 'Unassigned'}</td>
                                                    <td className="px-4 py-4 text-right text-sm font-black text-gray-700 tabular-nums">
                                                        {formatFleetModalDaysCount(row.daysAssigned ?? row.daysRemaining)}
                                                    </td>
                                                </>
                                            ) : null}
                                            {modalKind === 'unassigned' ? (
                                                <>
                                                    <td className="px-4 py-4 text-sm font-semibold text-gray-700">{row.assetId || '—'}</td>
                                                    <td className="px-4 py-4 font-bold text-gray-800">{row.plate || '—'}</td>
                                                    <td className="px-4 py-4 text-sm text-gray-700">{row.vehicleName || '—'}</td>
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
                                                    <td className="px-4 py-4 font-bold text-gray-800">{row.plate || row.assetId || '—'}</td>
                                                    <td className="px-4 py-4 text-sm font-medium text-gray-700">{row.assignedUser || 'Unassigned'}</td>
                                                    <td className="px-4 py-4 text-sm font-semibold text-teal-700">{row.pendingForWhom || '—'}</td>
                                                    <td className="px-4 py-4 text-right text-sm font-black text-gray-700 tabular-nums">
                                                        {formatFleetModalDaysCount(row.daysPending ?? row.daysRemaining)}
                                                    </td>
                                                </>
                                            ) : null}
                                            {modalKind === 'vehicleFines' ? (
                                                <>
                                                    <td className="px-4 py-4 text-sm font-bold text-blue-600">{row.fineId || '—'}</td>
                                                    <td className="px-4 py-4 text-sm font-semibold text-gray-700">{row.fineType || '—'}</td>
                                                    <td className="px-4 py-4 font-bold text-gray-800">{row.plate || '—'}</td>
                                                    <td className="px-4 py-4 text-sm text-gray-700">{row.offender || '—'}</td>
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
                                            {modalKind !== 'assigned' &&
                                            modalKind !== 'unassigned' &&
                                            modalKind !== 'pendingService' &&
                                            modalKind !== 'vehicleFines' ? (
                                                <>
                                                    <td className="px-4 py-4">
                                                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                                                            {row.cardName || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 font-bold text-gray-800">{row.plate || row.assetId || '—'}</td>
                                                    {showExpiryCols ? (
                                                        <>
                                                            <td className="px-4 py-4 text-sm font-medium text-gray-600 text-center">
                                                                {formatFleetModalExpiryDate(row.expiryDate)}
                                                            </td>
                                                            <td className="px-4 py-4 text-right">
                                                                <span
                                                                    className={`text-[11px] font-black px-2 py-1 rounded-full ${
                                                                        Number(row.daysRemaining) < 0
                                                                            ? 'bg-red-600 text-white'
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

function AnimatedCount({ value, style }) {
    const target = Number(value) || 0;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        let frame;
        const start = performance.now();
        const duration = 800;
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - (1 - t) ** 3;
            setDisplay(Math.round(eased * target));
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target]);

    return <span className="tabular-nums" style={style}>{display}</span>;
}

function ChartTabs({ options, value, onChange }) {
    return (
        <div className="flex flex-wrap items-center shrink-0" style={{ gap: 5 }}>
            {options.map((opt) => {
                const active = value === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange(opt.id)}
                        className="inline-flex items-center justify-center"
                        style={{
                            height: 24,
                            padding: '0 8px',
                            fontSize: 9.5,
                            fontWeight: active ? 500 : 400,
                            background: active ? '#1677FF' : '#FFFFFF',
                            color: active ? '#FFFFFF' : '#424B57',
                            border: `1px solid ${active ? '#1677FF' : '#CDD4DC'}`,
                            borderRadius: 4,
                            boxShadow: 'none',
                            lineHeight: 1,
                        }}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

function DateRangeInputs({ from, to, onFrom, onTo }) {
    const inputStyle = {
        height: 30,
        width: '100%',
        minWidth: 0,
        padding: '0 8px',
        fontSize: 12,
        fontWeight: 500,
        color: '#344054',
        background: '#FFFFFF',
        border: '1px solid #CDD4DC',
        borderRadius: 5,
        lineHeight: '30px',
        boxSizing: 'border-box',
    };
    return (
        <div
            className="grid grid-cols-2 w-full shrink-0"
            style={{ gap: 8, marginBottom: 6 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <label className="flex flex-col min-w-0" style={{ gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: '#5B6778' }}>From date</span>
                <input
                    type="date"
                    value={from || ''}
                    max={to || undefined}
                    onChange={(e) => onFrom(e.target.value)}
                    style={inputStyle}
                />
            </label>
            <label className="flex flex-col min-w-0" style={{ gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: '#5B6778' }}>To date</span>
                <input
                    type="date"
                    value={to || ''}
                    min={from || undefined}
                    onChange={(e) => onTo(e.target.value)}
                    style={inputStyle}
                />
            </label>
        </div>
    );
}

function ChartCard({ index, title, tabs, tab, onTab, children, height = 242, extra, rangePicker }) {
    return (
        <div
            className="flex flex-col"
            style={{
                height: rangePicker ? height + 42 : height,
                background: '#FFFFFF',
                border: '1px solid #DFE4E9',
                borderRadius: 7,
                boxShadow: CARD_SHADOW,
                padding: '10px 11px',
                overflow: 'visible',
            }}
        >
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap" style={{ marginLeft: 1, marginBottom: 7 }}>
                <div className="flex items-center min-w-0 gap-2">
                    <h3
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            lineHeight: '17px',
                            color: '#181D27',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {index}. {title}
                    </h3>
                    {extra || null}
                </div>
                {tabs ? <ChartTabs options={tabs} value={tab} onChange={onTab} /> : null}
            </div>
            {rangePicker || null}
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        </div>
    );
}

function ServiceLegend() {
    return (
        <div className="flex items-center shrink-0" style={{ gap: 8 }}>
            <span className="inline-flex items-center" style={{ gap: 4, fontSize: 8, fontWeight: 500, color: '#38465A' }}>
                <span
                    style={{
                        width: 9,
                        height: 9,
                        borderRadius: 9,
                        border: '1.5px solid #1769E8',
                        background: '#FFFFFF',
                        display: 'inline-block',
                    }}
                />
                Completed
            </span>
            <span className="inline-flex items-center" style={{ gap: 4, fontSize: 8, fontWeight: 500, color: '#38465A' }}>
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 1,
                        background: '#10B3A3',
                        display: 'inline-block',
                    }}
                />
                Pending
            </span>
        </div>
    );
}

function EmptyChart({ message = 'No data for this view.' }) {
    return (
        <div
            className="h-full flex items-center justify-center text-center px-4"
            style={{ fontSize: 12, fontWeight: 400, color: '#8795AA' }}
        >
            {message}
        </div>
    );
}

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center text-left w-full"
            style={{
                height: 78,
                minHeight: 78,
                padding: '10px 15px',
                background: '#FFFFFF',
                border: '1px solid #DFE5EA',
                borderRadius: 9,
                boxShadow: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.03)',
                gap: 12,
            }}
        >
            <span
                className="flex items-center justify-center shrink-0 rounded-full"
                style={{ width: 48, height: 48, minWidth: 48, background: iconBg }}
            >
                <Icon size={25} strokeWidth={2} style={{ color: iconColor }} />
            </span>
            <span className="min-w-0">
                <span className="block" style={{ fontSize: 11, fontWeight: 500, color: '#36465D', lineHeight: '14px' }}>
                    {label}
                </span>
                <span className="block" style={{ fontSize: 22, fontWeight: 700, lineHeight: '25px', color: '#161B22', marginTop: 3 }}>
                    <AnimatedCount value={value} />
                </span>
            </span>
        </button>
    );
}

function DonutWithLegend({ data, centerLabel, centerValue, centerUnit, colors, onSliceClick, legendVariant = 'year' }) {
    if (!data?.length) return <EmptyChart />;
    const isCost = legendVariant === 'cost';
    return (
        <div className="h-full flex items-center" style={{ gap: 6 }}>
            <div className="relative h-full" style={{ flex: '1 1 62%', minWidth: 0 }}>
                <RechartsBox height={210} minHeight={180} className="h-full" fillParent>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="52%"
                            outerRadius="92%"
                            paddingAngle={1.5}
                            stroke="#fff"
                            strokeWidth={2}
                            onClick={(entry) => onSliceClick?.(entry)}
                            className={onSliceClick ? 'cursor-pointer' : undefined}
                        >
                            {data.map((row, i) => (
                                <Cell key={row.name} fill={colors[i % colors.length]} />
                            ))}
                        </Pie>
                        <RechartsTooltip
                            formatter={(v, name) => [Number(v).toLocaleString(), name]}
                            contentStyle={tooltipStyle}
                        />
                    </PieChart>
                </RechartsBox>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center px-1 max-w-[88px]">
                        <div style={{ fontSize: isCost ? 9 : 10, fontWeight: 400, color: isCost ? '#68758A' : '#606B7C' }}>
                            {centerLabel}
                        </div>
                        <div style={{ fontSize: isCost ? 14 : 15, fontWeight: 700, color: '#111827', lineHeight: 1.15 }}>
                            {centerValue}
                        </div>
                        {centerUnit ? (
                            <div style={{ fontSize: 10, color: '#485568', lineHeight: 1.2 }}>{centerUnit}</div>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className="shrink-0 pr-0.5" style={{ width: isCost ? '36%' : '34%', display: 'flex', flexDirection: 'column', gap: isCost ? 6 : 8 }}>
                {data.map((row, i) => (
                    <button
                        key={row.name}
                        type="button"
                        onClick={() => onSliceClick?.(row)}
                        className="w-full flex items-start text-left"
                        style={{ gap: 7 }}
                    >
                        <span
                            className="rounded-full shrink-0"
                            style={{
                                width: 9,
                                height: 9,
                                marginTop: 3,
                                background: colors[i % colors.length],
                            }}
                        />
                        <span className="min-w-0">
                            <span
                                className="block leading-tight"
                                style={{
                                    fontSize: 10,
                                    fontWeight: 500,
                                    color: isCost ? '#25334A' : '#26354A',
                                }}
                            >
                                {row.name}
                                {row.amountLabel ? '' : (
                                    <span style={{ fontWeight: 600, color: '#202936' }}>{` (${row.value})`}</span>
                                )}
                            </span>
                            {row.amountLabel ? (
                                <span className="block leading-tight" style={{ fontSize: 9, fontWeight: 400, color: '#8190A6' }}>
                                    {row.amountLabel} ({row.percent}%)
                                </span>
                            ) : null}
                        </span>
                    </button>
                ))}
            </div>
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
    periodYear,
}) {
    const router = useRouter();
    const [chartsReady, setChartsReady] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalBucket, setDetailModalBucket] = useState(null);
    const [finesTab, setFinesTab] = useState('month');
    const [serviceTab, setServiceTab] = useState('month');
    const [runningTab, setRunningTab] = useState('month');
    const [idleTab, setIdleTab] = useState('month');
    const [finesRange, setFinesRange] = useState(() => defaultCustomRange(periodYear));
    const [serviceRange, setServiceRange] = useState(() => defaultCustomRange(periodYear));
    const [runningRange, setRunningRange] = useState(() => defaultCustomRange(periodYear));
    const [idleRange, setIdleRange] = useState(() => defaultCustomRange(periodYear));

    useEffect(() => {
        const next = defaultCustomRange(Number(periodYear) || new Date().getFullYear());
        setFinesRange(next);
        setServiceRange(next);
        setRunningRange(next);
        setIdleRange(next);
    }, [periodYear]);

    useEffect(() => {
        if (!loading && data) {
            const t = setTimeout(() => setChartsReady(true), 60);
            return () => clearTimeout(t);
        }
        setChartsReady(false);
        return undefined;
    }, [loading, data]);

    const selectedYear = Number(periodYear) || new Date().getFullYear();
    const currentYear = new Date().getFullYear();

    const vehicles = useMemo(() => data?.vehicles || [], [data?.vehicles]);

    const vehicleIdSet = useMemo(() => new Set(vehicles.map((v) => String(v._id))), [vehicles]);

    const vs = data?.vehicleStatus || {};

    const kpi = useMemo(() => {
        return {
            assigned: vs.assigned ?? 0,
            unassigned: vs.unassigned ?? 0,
            pendingInspection: vs.pendingInspection ?? 0,
            inService: vs.inService ?? 0,
            servicePending: vs.totalServices ?? 0,
            assignedRows: vs.assignedRows || [],
            unassignedRows: vs.unassignedRows || [],
            pendingInspectionRows: vs.pendingInspectionRows || [],
            inServiceRows: vs.inServiceRows || [],
            totalServiceRows: vs.totalServiceRows || [],
        };
    }, [vs]);

    const expiryStatus = useMemo(() => {
        const source = Array.isArray(data?.documentExpiryStatus) ? data.documentExpiryStatus : [];
        if (source.length) {
            return source.map((row) => ({
                ...row,
                docs: row.docs || [],
                value: Number(row.value) || (row.docs || []).length,
            }));
        }
        const buckets = [
            { key: 'alreadyExpired', name: 'Already Expired', docs: [] },
            { key: 'within10Days', name: 'Within 10 Days', docs: [] },
            { key: 'within30Days', name: 'Within 30 Days', docs: [] },
            { key: 'above30Days', name: 'Above 30 Days', docs: [] },
        ];
        for (const row of data?.documentExpiryChartData || []) {
            for (const doc of row.docs || []) {
                const diff = Number(doc.daysRemaining);
                let idx = 3;
                if (diff < 0) idx = 0;
                else if (diff <= 10) idx = 1;
                else if (diff <= 30) idx = 2;
                buckets[idx].docs.push(doc);
            }
        }
        return buckets.map((b) => ({ ...b, value: b.docs.length }));
    }, [data?.documentExpiryStatus, data?.documentExpiryChartData]);

    const modelYearPie = useMemo(() => {
        const order = [
            `${currentYear - 6} & Earlier`,
            `${currentYear - 5}-${currentYear - 4}`,
            `${currentYear - 3}-${currentYear - 2}`,
            `${currentYear - 1}-${currentYear}`,
        ];
        const map = new Map(order.map((name) => [name, { name, value: 0, docs: [] }]));
        for (const v of vehicles) {
            const name = modelYearBucket(v.modelYear, currentYear);
            if (!map.has(name)) continue;
            const row = map.get(name);
            row.value += 1;
            row.docs.push({
                vehicleId: v._id,
                assetId: v.assetId,
                vehicleName: fleetVehicleName(v),
                plate: fleetVehiclePlate(v),
                cardName: String(v.modelYear || 'Unknown'),
                tab: 'basic',
            });
        }
        return [...map.values()];
    }, [vehicles, currentYear]);

    const finesAll = useMemo(() => {
        const rows = [];
        for (const group of data?.finesByVehicle || []) {
            for (const fine of group.fines || []) {
                if (!isVehicleAccessFineVisible(fine)) continue;
                rows.push({
                    ...fine,
                    amount: Number(fine.amount || fine.totalFineAmount || fine.fineAmount || 0) || 0,
                    plate: fine.plate || group.plate || group.label || '—',
                    vehicleId: fine.vehicleId || group.vehicleId || '',
                    customerName: fine.customerName || group.customerName || 'Unassigned',
                    offender: fine.offender || '—',
                });
            }
        }
        return rows;
    }, [data?.finesByVehicle]);

    const finesFlat = useMemo(
        () => finesAll.filter((fine) => inYear(fine.awardedDate, selectedYear)),
        [finesAll, selectedYear],
    );

    const finesChartRows = useMemo(() => {
        if (finesTab === 'custom') {
            if (!finesRange.from || !finesRange.to) return [];
            return finesAll.filter((fine) => inDateRange(fine.awardedDate, finesRange.from, finesRange.to));
        }
        if (finesTab === 'year') return finesFlat;
        return finesFlat;
    }, [finesAll, finesFlat, finesTab, finesRange]);

    const finesChart = useMemo(() => {
        if (finesTab === 'day' || finesTab === 'custom') {
            const grouped = new Map();
            for (const fine of finesChartRows) {
                const key = dayKey(fine.awardedDate);
                if (!key) continue;
                if (!grouped.has(key)) grouped.set(key, { name: formatChartDay(fine.awardedDate), key, value: 0 });
                grouped.get(key).value += Number(fine.amount) || 0;
            }
            const rows = [...grouped.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
            const sliced = finesTab === 'day' ? rows.slice(-16) : rows;
            return sliced.map((row) => ({ ...row, chartName: row.name }));
        }
        if (finesTab === 'month') {
            return MONTH_LABELS.map((label, idx) => {
                const value = finesChartRows.reduce((sum, f) => {
                    const d = f.awardedDate ? new Date(f.awardedDate) : null;
                    if (!d || Number.isNaN(d.getTime()) || d.getMonth() !== idx) return sum;
                    return sum + (Number(f.amount) || 0);
                }, 0);
                return { name: label, chartName: label, value };
            });
        }
        if (finesTab === 'year') {
            return topRows(
                groupSum(finesChartRows, (f) => String(eventYear(f.awardedDate) || selectedYear)),
            ).sort((a, b) => String(a.name).localeCompare(String(b.name)))
                .map((row) => ({ ...row, chartName: row.name }));
        }
        return MONTH_LABELS.map((label, idx) => {
            const value = finesChartRows.reduce((sum, f) => {
                const d = f.awardedDate ? new Date(f.awardedDate) : null;
                if (!d || Number.isNaN(d.getTime()) || d.getMonth() !== idx) return sum;
                return sum + (Number(f.amount) || 0);
            }, 0);
            return { name: label, chartName: label, value };
        });
    }, [finesChartRows, finesTab, selectedYear]);

    const serviceEventsAll = useMemo(() => {
        const rows = [];
        for (const v of vehicles) {
            const plate = fleetVehiclePlate(v);
            const customerName = v.customerName || 'Unassigned';
            const events = Array.isArray(v.serviceEvents) && v.serviceEvents.length
                ? v.serviceEvents
                : (v.serviceCosts || []).map((s) => ({ ...s, pending: false }));
            for (const s of events) {
                rows.push({
                    ...s,
                    plate,
                    vehicleId: String(v._id),
                    customerName,
                    pending: s.pending === true,
                });
            }
        }
        return rows;
    }, [vehicles]);

    const serviceEvents = useMemo(() => {
        if (serviceTab === 'custom') {
            if (!serviceRange.from || !serviceRange.to) return [];
            return serviceEventsAll.filter((s) => inDateRange(s.date, serviceRange.from, serviceRange.to));
        }
        if (serviceTab === 'year') return serviceEventsAll.filter((s) => inYear(s.date, selectedYear));
        return serviceEventsAll.filter((s) => inYear(s.date, selectedYear));
    }, [serviceEventsAll, serviceTab, serviceRange, selectedYear]);

    const serviceChart = useMemo(() => {
        const addPair = (map, key, pending) => {
            if (!map.has(key)) map.set(key, { name: key, completed: 0, pending: 0 });
            if (pending) map.get(key).pending += 1;
            else map.get(key).completed += 1;
        };
        if (serviceTab === 'month') {
            const rows = MONTH_LABELS.map((label) => ({ name: label, chartName: label, completed: 0, pending: 0 }));
            for (const s of serviceEvents) {
                const d = s.date ? new Date(s.date) : null;
                if (!d || Number.isNaN(d.getTime())) continue;
                const row = rows[d.getMonth()];
                if (s.pending) row.pending += 1;
                else row.completed += 1;
            }
            return rows;
        }
        if (serviceTab === 'year') {
            const map = new Map();
            for (const s of serviceEvents) addPair(map, String(eventYear(s.date) || selectedYear), s.pending);
            return [...map.values()]
                .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                .map((row) => ({ ...row, chartName: row.name }));
        }
        if (serviceTab === 'day' || serviceTab === 'custom') {
            const map = new Map();
            for (const s of serviceEvents) {
                const key = dayKey(s.date);
                if (!key) continue;
                addPair(map, key, s.pending);
            }
            const rows = [...map.entries()]
                .sort(([a], [b]) => String(a).localeCompare(String(b)))
                .map(([, row]) => ({
                    ...row,
                    chartName: formatChartDay(row.name),
                }));
            return serviceTab === 'day' ? rows.slice(-16) : rows;
        }
        const map = new Map();
        for (const s of serviceEvents) addPair(map, s.plate || '—', s.pending);
        return [...map.values()]
            .sort((a, b) => b.completed + b.pending - (a.completed + a.pending))
            .slice(0, 8)
            .map((row) => ({ ...row, chartName: shortPlate(row.name, 10) }));
    }, [serviceEvents, serviceTab, selectedYear]);

    const costPie = useMemo(() => {
        const fuel = (data?.costBreakdown?.fuel || [])
            .filter((row) => vehicleIdSet.has(String(row.vehicleId || '')))
            .filter((row) => !selectedYear || String(row.monthKey || '').startsWith(String(selectedYear)))
            .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        const service = vehicles.reduce((sum, v) => {
            const events = Array.isArray(v.serviceCosts) ? v.serviceCosts : [];
            return (
                sum +
                events.reduce((inner, s) => {
                    if (!inYear(s.date, selectedYear)) return inner;
                    return inner + (Number(s.value) || 0);
                }, 0)
            );
        }, 0);
        const insurance = (data?.costBreakdown?.insurance || [])
            .filter((row) => vehicleIdSet.has(String(row.vehicleId || '')))
            .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        const registration = (data?.costBreakdown?.registration || [])
            .filter((row) => vehicleIdSet.has(String(row.vehicleId || '')))
            .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        const fines = finesFlat.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
        const total = fuel + service + insurance + registration + fines;
        const rows = [
            { name: 'Fuel', value: Math.round(fuel) },
            { name: 'Service', value: Math.round(service) },
            { name: 'Insurance', value: Math.round(insurance) },
            { name: 'Registration', value: Math.round(registration) },
            { name: 'Fines', value: Math.round(fines) },
        ].filter((row) => row.value > 0);
        return {
            total,
            rows: rows.map((row) => ({
                ...row,
                amountLabel: formatAed(row.value),
                percent: total ? ((row.value / total) * 100).toFixed(1) : '0.0',
            })),
        };
    }, [data?.costBreakdown, vehicles, vehicleIdSet, selectedYear, finesFlat]);

    const odometerChart = useMemo(() => {
        const locatorRows = filterLocatorRows(locatorData?.odometerByVehicle || [], vehicles);
        if (locatorRows.length) {
            return uniqueChartNames(
                topRows(
                    locatorRows.map((row) => ({
                        name: locatorRowLabel(row),
                        value: Number(row.value) || 0,
                        deviceId: row.deviceId,
                    })),
                ),
            );
        }
        return uniqueChartNames(
            topRows(
                vehicles
                    .map((v) => ({
                        name: fleetVehiclePlate(v),
                        value: Number(v.currentKilometer) || 0,
                        deviceId: v.locatorDeviceId,
                    }))
                    .filter((row) => row.value > 0),
            ),
        );
    }, [locatorData?.odometerByVehicle, vehicles]);

    const runningChart = useMemo(() => {
        if (runningTab === 'custom') {
            if (!runningRange.from || !runningRange.to) return [];
            const bucket = locatorData?.runningKmByVehicle?.day;
            const options = (bucket?.options || []).filter((opt) => {
                const key = parseLocatorDayKey(opt) || String(opt?.key || '');
                return inDateKeyRange(key, runningRange.from, runningRange.to);
            });
            if (options.length) {
                return options.map((opt) => {
                    const rows = filterLocatorRows(bucket?.byKey?.[opt.key] || [], vehicles);
                    const value = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
                    return {
                        name: opt.sublabel || opt.label || opt.key,
                        chartName: opt.sublabel || opt.label || opt.key,
                        value: Number(value.toFixed(2)),
                    };
                });
            }
            return (locatorData?.runningKm?.day || [])
                .filter((row) => {
                    const parsed = new Date(`${row.label} ${selectedYear}`);
                    return !Number.isNaN(parsed.getTime()) && inDateRange(parsed, runningRange.from, runningRange.to);
                })
                .map((row) => ({
                    name: row.label || row.name,
                    chartName: row.label || row.name,
                    value: Number(row.value) || 0,
                }));
        }
        const series =
            runningTab === 'day'
                ? locatorData?.runningKm?.day
                : runningTab === 'year'
                  ? locatorData?.runningKm?.year
                  : locatorData?.runningKm?.month;
        return (series || [])
            .filter((row) =>
                runningTab !== 'year' || String(row.label || row.name) === String(selectedYear),
            )
            .map((row) => ({
                name: row.label || row.name,
                chartName: row.label || row.name,
                value: Number(row.value) || 0,
            }));
    }, [locatorData, runningTab, runningRange, vehicles, selectedYear]);

    const idleChart = useMemo(() => {
        const toHoursRows = (rows) =>
            uniqueChartNames(
                topRows(
                    filterLocatorRows(rows, vehicles).map((row) => ({
                        name: locatorRowLabel(row),
                        value: idleMinutesToHours(row.value),
                        deviceId: row.deviceId,
                    })),
                ),
            );

        if (idleTab === 'custom') {
            if (!idleRange.from || !idleRange.to) return [];
            const bucket = locatorData?.idleTimeByVehicle?.day;
            const options = (bucket?.options || []).filter((opt) => {
                const key = parseLocatorDayKey(opt) || String(opt?.key || '');
                return inDateKeyRange(key, idleRange.from, idleRange.to);
            });
            const merged = [];
            for (const opt of options) {
                const rows = filterLocatorRows(bucket?.byKey?.[opt.key] || [], vehicles);
                for (const row of rows) {
                    merged.push({
                        name: locatorRowLabel(row),
                        value: idleMinutesToHours(row.value),
                        deviceId: row.deviceId,
                    });
                }
            }
            return uniqueChartNames(topRows(groupSum(merged, (r) => String(r.deviceId || r.name))));
        }

        if (idleTab === 'year') {
            const yearBucket = locatorData?.idleTimeByVehicle?.year;
            const yearKey = String(selectedYear || new Date().getFullYear());
            if (yearBucket?.byKey?.[yearKey] || yearBucket?.defaultKey) {
                const key = yearBucket?.byKey?.[yearKey] ? yearKey : yearBucket.defaultKey;
                return toHoursRows(yearBucket.byKey?.[key] || []);
            }
            const monthBucket = locatorData?.idleTimeByVehicle?.month;
            const merged = [];
            for (const opt of monthBucket?.options || []) {
                if (String(opt.key || '').startsWith(yearKey)) {
                    merged.push(...(monthBucket.byKey?.[opt.key] || []));
                }
            }
            return uniqueChartNames(
                topRows(
                    groupSum(
                        filterLocatorRows(merged, vehicles).map((row) => ({
                            name: locatorRowLabel(row),
                            value: idleMinutesToHours(row.value),
                            deviceId: row.deviceId,
                        })),
                        (r) => String(r.deviceId || r.name),
                    ),
                ),
            );
        }

        if (idleTab === 'month') {
            const bucket = locatorData?.idleTimeByVehicle?.month;
            const now = new Date();
            const year = selectedYear || now.getFullYear();
            const monthIndex = year === now.getFullYear() ? now.getMonth() : 11;
            const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            const key = bucket?.byKey?.[monthKey] ? monthKey : bucket?.defaultKey;
            return toHoursRows(bucket?.byKey?.[key] || []);
        }

        const bucket = locatorData?.idleTimeByVehicle?.day;
        const todayKey = toDateInputValue(new Date());
        const key = bucket?.byKey?.[todayKey] ? todayKey : bucket?.defaultKey;
        return toHoursRows(bucket?.byKey?.[key] || []);
    }, [locatorData?.idleTimeByVehicle, idleTab, idleRange, vehicles, selectedYear]);

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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
                    >
                        <RefreshCw size={16} />
                        Retry
                    </button>
                ) : null}
            </div>
        );
    }

    if (!data) return null;

    const expiryColors = EXPIRY_COLORS;
    const chartAnim = chartsReady ? 700 : 0;
    const axisLabelStyle = { fill: '#6F7C90', fontSize: 8.5 };

    return (
        <div className="flex flex-col" style={{ gap: 10 }}>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5" style={{ gap: 12 }}>
                <KpiCard
                    icon={Truck}
                    iconBg="#EAF2FF"
                    iconColor="#126BFF"
                    label="Assigned Vehicles"
                    value={kpi.assigned}
                    onClick={() =>
                        openDetailModal({
                            name: 'Assigned vehicles',
                            title: 'Assigned vehicles',
                            modalKind: 'assigned',
                            docs: kpi.assignedRows,
                        })
                    }
                />
                <KpiCard
                    icon={HelpCircle}
                    iconBg="#F1EAFE"
                    iconColor="#7B3FF2"
                    label="Unassigned Vehicles"
                    value={kpi.unassigned}
                    onClick={() =>
                        openDetailModal({
                            name: 'Unassigned vehicles',
                            title: 'Unassigned vehicles',
                            modalKind: 'unassigned',
                            docs: kpi.unassignedRows,
                        })
                    }
                />
                <KpiCard
                    icon={ClipboardList}
                    iconBg="#FFF0DD"
                    iconColor="#FF7A00"
                    label="Pending Inspection"
                    value={kpi.pendingInspection}
                    onClick={() =>
                        openDetailModal({
                            name: 'Pending inspection',
                            title: 'Pending inspection',
                            modalKind: 'unassigned',
                            subtitle: 'Vehicles with no completed first inspection',
                            docs: kpi.pendingInspectionRows,
                        })
                    }
                />
                <KpiCard
                    icon={Wrench}
                    iconBg="#E2F8F5"
                    iconColor="#08A89B"
                    label="In Service"
                    value={kpi.inService}
                    onClick={() =>
                        openDetailModal({
                            name: 'In service',
                            title: 'Vehicles in service',
                            docs: kpi.inServiceRows,
                        })
                    }
                />
                <KpiCard
                    icon={AlertCircle}
                    iconBg="#FFE8E7"
                    iconColor="#FF3F43"
                    label="Service Pending"
                    value={kpi.servicePending}
                    onClick={() =>
                        openDetailModal({
                            name: 'Service pending',
                            title: 'Pending service requests',
                            modalKind: 'pendingService',
                            docs: kpi.totalServiceRows,
                        })
                    }
                />
            </div>

            <div
                style={{
                    background: '#FFFFFF',
                    border: '1px solid #E1E6EB',
                    borderRadius: 8,
                    padding: '7px 9px 9px',
                    boxShadow: '0 1px 2px rgba(16,24,40,.04)',
                }}
            >
                <h3
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#242B35',
                        lineHeight: '18px',
                        margin: '0 0 5px 2px',
                    }}
                >
                    Document Expiry Status
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden" style={{ height: 58 }}>
                    {expiryStatus.map((seg, idx) => (
                        <button
                            key={seg.key || seg.name}
                            type="button"
                            onClick={() =>
                                openDetailModal({
                                    name: seg.name,
                                    title: `Document expiry · ${seg.name}`,
                                    subtitle: 'Registration, insurance, and other live vehicle documents',
                                    docs: seg.docs || [],
                                })
                            }
                            className="flex items-center text-left hover:brightness-95 transition"
                            style={{
                                background: expiryColors[idx],
                                gap: 10,
                                padding: '0 14px',
                                borderRadius:
                                    idx === 0 ? '5px 0 0 5px' : idx === expiryStatus.length - 1 ? '0 5px 5px 0' : 0,
                            }}
                        >
                            <CalendarDays size={31} color="#FFFFFF" strokeWidth={1.8} className="shrink-0" />
                            <span className="min-w-0">
                                <span
                                    className="block"
                                    style={{ color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: 500, lineHeight: '14px' }}
                                >
                                    {seg.name}
                                </span>
                                <span
                                    className="block tabular-nums text-white"
                                    style={{ color: '#FFFFFF', WebkitTextFillColor: '#FFFFFF', fontSize: 19, fontWeight: 700, lineHeight: '21px', marginTop: 1 }}
                                >
                                    <AnimatedCount value={seg.value} style={{ color: '#FFFFFF', WebkitTextFillColor: '#FFFFFF' }} />
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div
                className="grid grid-cols-1 xl:grid-cols-[1.02fr_0.92fr_1.28fr_1.12fr]"
                style={{ gap: 10 }}
            >
                <ChartCard index={1} title="Vehicle Model Year" height={252}>
                    <DonutWithLegend
                        data={modelYearPie}
                        centerLabel="Total"
                        centerValue={String(vehicles.length)}
                        centerUnit="Vehicles"
                        colors={YEAR_BUCKET_COLORS}
                        onSliceClick={(entry) => {
                            const row = modelYearPie.find((r) => r.name === entry?.name) || entry;
                            if (!row?.name) return;
                            openDetailModal({
                                name: row.name,
                                title: `Vehicle model year · ${row.name}`,
                                docs: row.docs || [],
                            });
                        }}
                    />
                </ChartCard>

                <ChartCard
                    index={2}
                    title="Vehicle Fines"
                    height={252}
                    tabs={[
                        { id: 'day', label: 'Day' },
                        { id: 'month', label: 'Month' },
                        { id: 'year', label: 'Year' },
                        { id: 'custom', label: 'Custom' },
                    ]}
                    tab={finesTab}
                    onTab={setFinesTab}
                    rangePicker={
                        finesTab === 'custom' ? (
                            <DateRangeInputs
                                from={finesRange.from}
                                to={finesRange.to}
                                onFrom={(from) => setFinesRange((prev) => ({ ...prev, from }))}
                                onTo={(to) => setFinesRange((prev) => ({ ...prev, to }))}
                            />
                        ) : null
                    }
                >
                    {finesTab === 'custom' && (!finesRange.from || !finesRange.to) ? (
                        <EmptyChart message="Select from and to dates." />
                    ) : finesChart.every((r) => !r.value) ? (
                        <EmptyChart message="No fines in this period." />
                    ) : (
                        <RechartsBox height={175} minHeight={160} className="h-full" fillParent>
                            <BarChart data={finesChart} margin={{ top: 16, right: 6, left: 0, bottom: 2 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="chartName" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                <YAxis
                                    tick={AXIS_TICK}
                                    axisLine={false}
                                    tickLine={false}
                                    width={34}
                                    tickFormatter={formatAxisNumber}
                                    label={{ value: 'AED', angle: -90, position: 'insideLeft', style: axisLabelStyle }}
                                />
                                <RechartsTooltip
                                    formatter={(v) => [formatAed(v), 'Fines']}
                                    labelFormatter={(_l, payload) => payload?.[0]?.payload?.name || _l}
                                    contentStyle={tooltipStyle}
                                />
                                <Bar
                                    dataKey="value"
                                    fill={PALETTE.blue}
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={28}
                                    animationDuration={chartAnim}
                                >
                                    <LabelList
                                        dataKey="value"
                                        position="top"
                                        formatter={(v) => (Number(v) ? Number(v).toLocaleString() : '')}
                                        style={{ fontSize: 8.5, fill: '#374151', fontWeight: 500 }}
                                    />
                                </Bar>
                            </BarChart>
                        </RechartsBox>
                    )}
                </ChartCard>

                <ChartCard
                    index={3}
                    title="Vehicle Service"
                    height={252}
                    extra={<ServiceLegend />}
                    tabs={[
                        { id: 'day', label: 'Day' },
                        { id: 'month', label: 'Month' },
                        { id: 'year', label: 'Year' },
                        { id: 'custom', label: 'Custom' },
                    ]}
                    tab={serviceTab}
                    onTab={setServiceTab}
                    rangePicker={
                        serviceTab === 'custom' ? (
                            <DateRangeInputs
                                from={serviceRange.from}
                                to={serviceRange.to}
                                onFrom={(from) => setServiceRange((prev) => ({ ...prev, from }))}
                                onTo={(to) => setServiceRange((prev) => ({ ...prev, to }))}
                            />
                        ) : null
                    }
                >
                    {serviceTab === 'custom' && (!serviceRange.from || !serviceRange.to) ? (
                        <EmptyChart message="Select from and to dates." />
                    ) : serviceChart.every((r) => !r.completed && !r.pending) ? (
                        <EmptyChart message="No service records in this period." />
                    ) : (
                        <RechartsBox height={190} minHeight={170} className="h-full" fillParent>
                            <ComposedChart data={serviceChart} margin={{ top: 8, right: 8, left: 0, bottom: 2 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="chartName" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                <YAxis
                                    tick={AXIS_TICK}
                                    axisLine={false}
                                    tickLine={false}
                                    width={32}
                                    label={{ value: 'Count', angle: -90, position: 'insideLeft', style: axisLabelStyle }}
                                />
                                <RechartsTooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="pending" name="Pending" fill="#10B3A3" radius={[2, 2, 0, 0]} maxBarSize={16} animationDuration={chartAnim} />
                                <Line
                                    type="monotone"
                                    dataKey="completed"
                                    name="Completed"
                                    stroke="#1769E8"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#FFFFFF', stroke: '#1769E8', strokeWidth: 2 }}
                                    activeDot={{ r: 3.5, fill: '#FFFFFF', stroke: '#1769E8', strokeWidth: 2 }}
                                />
                            </ComposedChart>
                        </RechartsBox>
                    )}
                </ChartCard>

                <ChartCard index={4} title="Vehicle Cost Analysis" height={252}>
                    <DonutWithLegend
                        data={costPie.rows}
                        centerLabel="Total"
                        centerValue={formatAed(costPie.total)}
                        colors={costPie.rows.map((row) => COST_COLORS[row.name] || PALETTE.blue)}
                        legendVariant="cost"
                    />
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.42fr_1fr]" style={{ gap: 10 }}>
                <ChartCard index={5} title="Current Odometer" height={245}>
                    {!odometerChart.length ? (
                        <EmptyChart
                            message={
                                locatorLoading
                                    ? 'Loading odometer…'
                                    : locatorError || locatorData?.connected === false
                                      ? locatorError || locatorData?.message || 'Locator GPS is not connected.'
                                      : 'No odometer readings.'
                            }
                        />
                    ) : (
                        <RechartsBox height={175} minHeight={160} className="h-full" fillParent>
                            <BarChart data={odometerChart} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                <XAxis
                                    type="number"
                                    tick={AXIS_TICK}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={formatAxisNumber}
                                    label={{ value: 'KM', position: 'insideBottom', offset: -4, style: axisLabelStyle }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="chartName"
                                    tick={{ fontSize: 9, fill: '#536176' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={72}
                                />
                                <RechartsTooltip
                                    formatter={(v) => [`${Number(v).toLocaleString()} km`, 'Odometer']}
                                    labelFormatter={(_l, payload) => payload?.[0]?.payload?.name || _l}
                                    contentStyle={tooltipStyle}
                                />
                                <Bar dataKey="value" fill="#1769E8" radius={[0, 3, 3, 0]} maxBarSize={14} animationDuration={chartAnim}>
                                    <LabelList
                                        dataKey="value"
                                        position="right"
                                        formatter={(v) => Number(v).toLocaleString()}
                                        style={{ fontSize: 9, fill: '#374151', fontWeight: 500 }}
                                    />
                                </Bar>
                            </BarChart>
                        </RechartsBox>
                    )}
                </ChartCard>

                <ChartCard
                    index={6}
                    title="Running Kilometers"
                    height={245}
                    tabs={[
                        { id: 'day', label: 'Day' },
                        { id: 'month', label: 'Month' },
                        { id: 'year', label: 'Year' },
                        { id: 'custom', label: 'Custom' },
                    ]}
                    tab={runningTab}
                    onTab={setRunningTab}
                    rangePicker={
                        runningTab === 'custom' ? (
                            <DateRangeInputs
                                from={runningRange.from}
                                to={runningRange.to}
                                onFrom={(from) => setRunningRange((prev) => ({ ...prev, from }))}
                                onTo={(to) => setRunningRange((prev) => ({ ...prev, to }))}
                            />
                        ) : null
                    }
                >
                    {runningTab === 'custom' && (!runningRange.from || !runningRange.to) ? (
                        <EmptyChart message="Select from and to dates." />
                    ) : !runningChart.length || runningChart.every((r) => !r.value) ? (
                        <EmptyChart
                            message={
                                locatorLoading
                                    ? 'Loading running km…'
                                    : locatorError || locatorData?.connected === false
                                      ? locatorError || locatorData?.message || 'Locator GPS is not connected.'
                                      : 'No running kilometre data for this period.'
                            }
                        />
                    ) : (
                        <RechartsBox height={175} minHeight={160} className="h-full" fillParent>
                            <ComposedChart data={runningChart} margin={{ top: 16, right: 10, left: 0, bottom: 2 }}>
                                <defs>
                                    <linearGradient id="runningKmFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#1769E8" stopOpacity={0.1} />
                                        <stop offset="100%" stopColor="#1769E8" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="chartName" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                                <YAxis
                                    tick={AXIS_TICK}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                    tickFormatter={formatAxisNumber}
                                    label={{ value: 'KM', angle: -90, position: 'insideLeft', style: axisLabelStyle }}
                                />
                                <RechartsTooltip
                                    formatter={(v) => [`${Number(v).toLocaleString()} km`, 'Running km']}
                                    labelFormatter={(_l, payload) => payload?.[0]?.payload?.name || _l}
                                    contentStyle={tooltipStyle}
                                />
                                <Area type="monotone" dataKey="value" fill="url(#runningKmFill)" stroke="none" tooltipType="none" legendType="none" />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    name="Running km"
                                    stroke="#1769E8"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#FFFFFF', stroke: '#1769E8', strokeWidth: 2 }}
                                    activeDot={{ r: 3.5, fill: '#FFFFFF', stroke: '#1769E8', strokeWidth: 2 }}
                                >
                                    <LabelList
                                        dataKey="value"
                                        position="top"
                                        formatter={(v) => (Number(v) ? Number(v).toLocaleString() : '')}
                                        style={{ fontSize: 8.5, fill: '#374151', fontWeight: 500 }}
                                    />
                                </Line>
                            </ComposedChart>
                        </RechartsBox>
                    )}
                </ChartCard>

                <ChartCard
                    index={7}
                    title="Idle Time by Vehicle"
                    height={245}
                    extra={
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#68758A' }}>
                            {idlePeriodCaption(idleTab, idleRange, selectedYear)}
                        </span>
                    }
                    tabs={[
                        { id: 'day', label: 'Day' },
                        { id: 'month', label: 'Month' },
                        { id: 'year', label: 'Year' },
                        { id: 'custom', label: 'Custom' },
                    ]}
                    tab={idleTab}
                    onTab={setIdleTab}
                    rangePicker={
                        idleTab === 'custom' ? (
                            <DateRangeInputs
                                from={idleRange.from}
                                to={idleRange.to}
                                onFrom={(from) => setIdleRange((prev) => ({ ...prev, from }))}
                                onTo={(to) => setIdleRange((prev) => ({ ...prev, to }))}
                            />
                        ) : null
                    }
                >
                    {idleTab === 'custom' && (!idleRange.from || !idleRange.to) ? (
                        <EmptyChart message="Select from and to dates." />
                    ) : !idleChart.length || idleChart.every((r) => !r.value) ? (
                        <EmptyChart
                            message={
                                locatorLoading
                                    ? 'Loading idle time…'
                                    : locatorError || locatorData?.connected === false
                                      ? locatorError || locatorData?.message || 'Locator GPS is not connected.'
                                      : 'No idle time data for this period.'
                            }
                        />
                    ) : (
                        <RechartsBox height={175} minHeight={160} className="h-full" fillParent>
                            <BarChart data={idleChart} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                <XAxis
                                    type="number"
                                    tick={AXIS_TICK}
                                    axisLine={false}
                                    tickLine={false}
                                    label={{ value: 'hours', position: 'insideBottom', offset: -4, style: axisLabelStyle }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="chartName"
                                    tick={{ fontSize: 9, fill: '#536176' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={72}
                                />
                                <RechartsTooltip
                                    formatter={(v) => [`${Number(v).toLocaleString()} hours`, 'Idle time']}
                                    labelFormatter={(_l, payload) => payload?.[0]?.payload?.name || _l}
                                    contentStyle={tooltipStyle}
                                />
                                <Bar dataKey="value" fill="#FF9900" radius={[0, 3, 3, 0]} maxBarSize={14} animationDuration={chartAnim}>
                                    <LabelList
                                        dataKey="value"
                                        position="right"
                                        formatter={(v) => Number(v).toLocaleString()}
                                        style={{ fontSize: 9, fill: '#374151', fontWeight: 500 }}
                                    />
                                </Bar>
                            </BarChart>
                        </RechartsBox>
                    )}
                </ChartCard>
            </div>

            <FleetDashboardDetailModal
                open={detailModalOpen}
                bucket={detailModalBucket}
                onClose={closeDetailModal}
                onRowClick={handleDetailRowClick}
            />
        </div>
    );
}
