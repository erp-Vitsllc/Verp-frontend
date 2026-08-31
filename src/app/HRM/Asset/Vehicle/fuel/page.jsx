'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fuel, RotateCcw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import ListTableRowLink from '@/components/ListTableRowLink';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import axiosInstance from '@/utils/axios';
import VehicleServiceRequestSortHeader from '@/app/HRM/Asset/Vehicle/components/VehicleServiceRequestSortHeader';
import {
    codeSortValue,
    numberSortValue,
    sortServiceTableRows,
    textSortValue,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceRequestTableSort';

function localDayKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultRange() {
    const now = new Date();
    return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        to: localDayKey(now),
    };
}

function shiftDayKey(key, days) {
    const [year, month, day] = String(key || '').split('-').map(Number);
    const next = new Date(year, (month || 1) - 1, day || 1);
    next.setDate(next.getDate() + days);
    return localDayKey(next);
}

function formatKm(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

function formatRangeLabel(from, to) {
    const pretty = (key) => {
        if (!key) return '';
        const date = new Date(`${key}T00:00:00`);
        if (Number.isNaN(date.getTime())) return key;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    if (!from || !to) return '';
    return `${pretty(from)} → ${pretty(to)}`;
}

const COLUMNS = [
    { key: 'slNo', label: 'Sl', type: 'number' },
    { key: 'vehicleNumber', label: 'GPS vehicle no', type: 'text' },
    { key: 'idleTimeMinutes', label: 'Idle time', type: 'number' },
    { key: 'currentKm', label: 'Current KM', type: 'number' },
    { key: 'runningKm', label: 'Running KM', type: 'number' },
];

function gpsSortValue(row, key) {
    switch (key) {
        case 'slNo':
        case 'currentKm':
        case 'runningKm':
        case 'idleTimeMinutes':
            return numberSortValue(row?.[key]);
        case 'vehicleNumber':
            return codeSortValue(row?.gpsVehicleNumber || row?.vehicleNumber);
        default:
            return textSortValue(row?.[key]);
    }
}

const PRESETS = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 days' },
    { id: 'month', label: 'This month' },
];

export default function VehicleFuelGpsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const defaults = useMemo(() => defaultRange(), []);
    const [from, setFrom] = useState(defaults.from);
    const [to, setTo] = useState(defaults.to);
    const [applied, setApplied] = useState(defaults);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [configured, setConfigured] = useState(true);
    const [sortKey, setSortKey] = useState('vehicleNumber');
    const [sortDirection, setSortDirection] = useState('asc');
    const today = localDayKey();

    const load = useCallback(async () => {
        const fromKey = from && to && from > to ? to : from;
        const toKey = from && to && from > to ? from : to;
        if (!fromKey || !toKey) return;
        setLoading(true);
        try {
            const res = await axiosInstance.get('/VehicleFuel/gps-stats', {
                params: { from: fromKey, to: toKey },
                skipToast: true,
            });
            setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
            setConfigured(res.data?.configured !== false);
            setApplied({
                from: fromKey,
                to: toKey,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load fuel GPS',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [from, to, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const applyPreset = (id) => {
        const now = localDayKey();
        if (id === 'today') {
            setFrom(now);
            setTo(now);
            return;
        }
        if (id === '7d') {
            setFrom(shiftDayKey(now, -6));
            setTo(now);
            return;
        }
        const monthStart = `${now.slice(0, 7)}-01`;
        setFrom(monthStart);
        setTo(now);
    };

    const activePreset = useMemo(() => {
        const now = localDayKey();
        if (from === now && to === now) return 'today';
        if (from === shiftDayKey(now, -6) && to === now) return '7d';
        if (from === `${now.slice(0, 7)}-01` && to === now) return 'month';
        return '';
    }, [from, to]);

    const handleSort = useCallback(
        (key) => {
            const column = COLUMNS.find((c) => c.key === key);
            if (!column) return;
            if (sortKey === key) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setSortKey(key);
            setSortDirection(column.type === 'number' ? 'desc' : 'asc');
        },
        [sortKey],
    );

    const sortedRows = useMemo(() => {
        const column = COLUMNS.find((c) => c.key === sortKey) || COLUMNS[0];
        const withSl = (rows || []).map((row, index) => ({ ...row, slNo: index + 1 }));
        return sortServiceTableRows(withSl, gpsSortValue, sortKey, sortDirection, column.type);
    }, [rows, sortKey, sortDirection]);

    const totals = useMemo(() => {
        return (rows || []).reduce(
            (acc, row) => {
                acc.runningKm += Number(row.runningKm) || 0;
                acc.idleTimeMinutes += Number(row.idleTimeMinutes) || 0;
                return acc;
            },
            { runningKm: 0, idleTimeMinutes: 0 },
        );
    }, [rows]);

    const rowHref = (row) => {
        const id = String(row?.vehicleId || '').trim();
        return id ? `/HRM/Asset/Vehicle/details/${id}?tab=fuel` : '';
    };

    const rowKey = (row) => String(row?.deviceId || row?.vehicleId || row?.vehicleNumber || '');

    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <ListReturnBackButton onNavigate={() => router.push('/HRM/Asset/Vehicle')} />
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-5">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Fuel className="h-6 w-6 text-teal-700 shrink-0" />
                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 truncate">
                                        Fuel
                                    </h1>
                                    <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold tabular-nums">
                                        {loading ? '…' : rows.length}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-xs sm:text-sm">
                                    GPS vehicle number, idle time, current KM, and running KM from Locator GPS
                                    snapshots — not ERP odometer. Idle is engine-on idling of 10 minutes or more
                                    {applied.from && applied.to ? ` · ${formatRangeLabel(applied.from, applied.to)}` : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={load}
                                disabled={loading}
                                className="p-2 text-gray-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm disabled:opacity-50"
                                title="Refresh"
                            >
                                <RotateCcw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm overflow-hidden">
                            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-teal-50/40">
                                <div className="min-w-0">
                                    <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-teal-800">
                                        GPS fuel readings
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Idle time and running KM cover the From date at 12:00 AM through the end of the
                                        To date. Current KM is the latest GPS odometer.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-end gap-3 shrink-0">
                                    <div className="flex flex-wrap gap-1.5">
                                        {PRESETS.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => applyPreset(preset.id)}
                                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                                    activePreset === preset.id
                                                        ? 'bg-teal-600 text-white border-teal-600'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-800'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 min-w-[260px]">
                                        <label className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                From
                                            </span>
                                            <DatePicker
                                                value={from}
                                                onChange={(value) => {
                                                    setFrom(value);
                                                    if (value && to && value > to) setTo(value);
                                                }}
                                                placeholder="From date"
                                                disabledDays={{ after: new Date(`${today}T23:59:59`) }}
                                            />
                                        </label>
                                        <label className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                To
                                            </span>
                                            <DatePicker
                                                value={to}
                                                onChange={(value) => {
                                                    setTo(value);
                                                    if (value && from && value < from) setFrom(value);
                                                }}
                                                placeholder="To date"
                                                disabledDays={{
                                                    before: from ? new Date(`${from}T00:00:00`) : undefined,
                                                    after: new Date(`${today}T23:59:59`),
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {!configured ? (
                                <div className="px-4 sm:px-6 py-3 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
                                    Locator GPS is not configured. Showing last saved odometer where available.
                                </div>
                            ) : null}

                            <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                                    Vehicles
                                    {!loading ? (
                                        <span className="ml-2 text-teal-700 tabular-nums">({sortedRows.length})</span>
                                    ) : null}
                                </h3>
                                {!loading ? (
                                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                        Running {formatKm(totals.runningKm)} · Idle{' '}
                                        {Math.floor(totals.idleTimeMinutes / 60)}h {totals.idleTimeMinutes % 60}m
                                    </span>
                                ) : null}
                            </div>

                            {loading ? (
                                <div className="py-16 text-center text-sm text-slate-500">Calculating GPS fuel stats…</div>
                            ) : !sortedRows.length ? (
                                <div className="py-16 text-center text-sm text-slate-500">
                                    No GPS vehicles found for this range.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse min-w-[720px]">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                {COLUMNS.map((column) => (
                                                    <VehicleServiceRequestSortHeader
                                                        key={column.key}
                                                        label={column.label}
                                                        columnKey={column.key}
                                                        sortKey={sortKey}
                                                        sortDirection={sortDirection}
                                                        onSort={handleSort}
                                                    />
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((row) => {
                                                const href = rowHref(row);
                                                const key = rowKey(row);
                                                const rowElement = (
                                                    <tr
                                                        key={key}
                                                        className={`border-b border-slate-100 ${
                                                            href ? 'hover:bg-slate-50/70 cursor-pointer' : ''
                                                        }`}
                                                        title={href ? 'Open vehicle fuel tab' : 'GPS vehicle'}
                                                    >
                                                        <td className="px-4 py-3 text-slate-600 font-semibold tabular-nums">
                                                            {row.slNo}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">
                                                            {row.gpsVehicleNumber || row.vehicleNumber || '—'}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                                            {row.idleTimeLabel || '00:00:00 Hrs'}
                                                        </td>
                                                        <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                                                            {formatKm(row.currentKm)}
                                                        </td>
                                                        <td className="px-4 py-3 tabular-nums whitespace-nowrap font-semibold">
                                                            {formatKm(row.runningKm)}
                                                        </td>
                                                    </tr>
                                                );
                                                return href ? (
                                                    <ListTableRowLink
                                                        key={key}
                                                        href={href}
                                                        router={router}
                                                        listReturnHref="/HRM/Asset/Vehicle/fuel"
                                                    >
                                                        {rowElement}
                                                    </ListTableRowLink>
                                                ) : (
                                                    rowElement
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
