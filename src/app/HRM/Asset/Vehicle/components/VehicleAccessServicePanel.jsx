'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, RotateCcw, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import VehicleAccessServiceListTable from '@/app/HRM/Asset/Vehicle/components/VehicleAccessServiceListTable';
import {
    buildVehicleAccessNotYetRowsFromAssets,
    buildVehicleAccessServiceRowsFromAsset,
    buildVehicleServiceListRowHref,
    isVehicleServiceListCompletedStatus,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';
import {
    VEHICLE_ACCESS_SERVICE_COMPLETED,
    VEHICLE_ACCESS_SERVICE_NOT_YET,
    VEHICLE_ACCESS_SERVICE_PENDING,
    VEHICLE_ACCESS_SERVICE_STATUS_FILTERS,
    VEHICLE_ACCESS_SERVICE_TYPES,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

function isAccessServiceRowCompleted(row) {
    if (row?.isNotYet) return false;
    return isVehicleServiceListCompletedStatus({
        label: row?.status,
        tone: row?.statusTone,
    });
}

function isAccessServiceRowPending(row) {
    if (row?.isNotYet) return false;
    return !isAccessServiceRowCompleted(row);
}

function CountBellBadge({ count, tone = 'pending', title }) {
    const n = Number(count || 0);
    if (n <= 0) return null;
    const cls =
        tone === 'complete'
            ? 'bg-emerald-100 text-emerald-700'
            : tone === 'not_yet'
              ? 'bg-violet-100 text-violet-700'
              : 'bg-red-100 text-red-600';
    return (
        <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${cls}`}
            title={title || `${n}`}
        >
            <Bell size={10} strokeWidth={2.5} />
            <span className="text-[9px] font-black tabular-nums">{n}</span>
        </span>
    );
}

function emptyVehiclesByType() {
    return Object.fromEntries(VEHICLE_ACCESS_SERVICE_TYPES.map((type) => [type, []]));
}

const VEHICLE_LIST_RETURN = '/HRM/Asset/Vehicle';
const ALL_FILTER = 'all';

const DATE_RANGE_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'this_year', label: 'This year' },
    { key: 'this_month', label: 'This month' },
    { key: 'prev_year', label: 'Previous year' },
    { key: 'prev_month', label: 'Previous month' },
    { key: 'custom', label: 'Custom' },
];

function pad2(value) {
    return String(value).padStart(2, '0');
}

function dateKeyFromDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function lastDayOfMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function currentMonthStartKey(now = new Date()) {
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
}

function resolveAccessDateRange(rangeKey, customFrom, customTo, now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth();

    if (rangeKey === 'this_year') {
        return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    if (rangeKey === 'this_month') {
        return {
            from: `${year}-${pad2(month + 1)}-01`,
            to: `${year}-${pad2(month + 1)}-${pad2(lastDayOfMonth(year, month))}`,
        };
    }
    if (rangeKey === 'prev_year') {
        const prevYear = year - 1;
        return { from: `${prevYear}-01-01`, to: `${prevYear}-12-31` };
    }
    if (rangeKey === 'prev_month') {
        const prev = new Date(year, month - 1, 1);
        const prevYear = prev.getFullYear();
        const prevMonth = prev.getMonth();
        return {
            from: `${prevYear}-${pad2(prevMonth + 1)}-01`,
            to: `${prevYear}-${pad2(prevMonth + 1)}-${pad2(lastDayOfMonth(prevYear, prevMonth))}`,
        };
    }
    if (rangeKey === 'custom') {
        const from = String(customFrom || '').slice(0, 10);
        const to = String(customTo || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
        return from > to ? { from: to, to: from } : { from, to };
    }
    return null;
}

function rowServiceDateKey(row) {
    const raw = row?.requestDate || row?.createdAt || row?.lastOilServiceDate || row?.sortDate || '';
    const text = String(raw || '').trim();
    if (!text) return '';
    const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateOnly) return dateOnly[1];
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';
    return dateKeyFromDate(parsed);
}

function rowMatchesDateRange(row, range) {
    if (!range) return true;
    const key = rowServiceDateKey(row);
    if (!key) return false;
    return key >= range.from && key <= range.to;
}

function rowVehicleId(row) {
    return String(row?.vehicleId || '').trim();
}

function rowVehicleLabel(row) {
    const plate = String(row?.vehicleNo || '').trim();
    const assetNo = String(row?.vehicleAssetNo || '').trim();
    if (plate && plate !== '—') return plate;
    if (assetNo && assetNo !== '—') return assetNo;
    return 'Vehicle';
}

function rowServiceType(row) {
    const type = String(row?.serviceType || '').trim();
    if (!type || type === '—') return '';
    return type;
}

function uniqueVehicleOptions(rows) {
    const map = new Map();
    for (const row of rows) {
        const id = rowVehicleId(row);
        if (!id || map.has(id)) continue;
        map.set(id, rowVehicleLabel(row));
    }
    return [...map.entries()]
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

function uniqueServiceOptions(rows) {
    const present = new Set();
    for (const row of rows) {
        const type = rowServiceType(row);
        if (type) present.add(type);
    }
    const ordered = VEHICLE_ACCESS_SERVICE_TYPES.filter((type) => present.has(type));
    for (const type of present) {
        if (!ordered.includes(type)) ordered.push(type);
    }
    return ordered;
}

function formatAccessMoney(value) {
    const n = Number(value);
    const amount = Number.isFinite(n) ? n : 0;
    return `AED ${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function sumAccessAmounts(rows) {
    return rows.reduce((sum, row) => {
        const n = Number(row?.amount);
        return Number.isFinite(n) && n > 0 ? sum + n : sum;
    }, 0);
}

export default function VehicleAccessServicePanel({
    selectedType = 'All',
    onSelectType,
    onClose,
    listReturnHref = VEHICLE_LIST_RETURN,
}) {
    const router = useRouter();
    const { toast } = useToast();

    const [countsLoading, setCountsLoading] = useState(true);
    const [apiPendingTotal, setApiPendingTotal] = useState(0);
    const [apiCompletedTotal, setApiCompletedTotal] = useState(0);
    const [apiNotYetTotal, setApiNotYetTotal] = useState(0);
    const [vehiclesByType, setVehiclesByType] = useState(emptyVehiclesByType);
    const [notYetAssets, setNotYetAssets] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [vehicleFilter, setVehicleFilter] = useState(ALL_FILTER);
    const [serviceFilter, setServiceFilter] = useState(ALL_FILTER);
    const [dateRange, setDateRange] = useState('all');
    const [customFrom, setCustomFrom] = useState(() => currentMonthStartKey());
    const [customTo, setCustomTo] = useState(() => dateKeyFromDate(new Date()));

    const statusFilter = VEHICLE_ACCESS_SERVICE_STATUS_FILTERS.some((tab) => tab.key === selectedType)
        ? selectedType
        : 'All';

    const loadCounts = useCallback(async () => {
        setCountsLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-services', { skipToast: true });
            setApiPendingTotal(Number(res.data?.pendingTotal) || 0);
            setApiCompletedTotal(Number(res.data?.completedTotal) || 0);
            setApiNotYetTotal(Number(res.data?.notYetTotal) || 0);
        } catch {
            setApiPendingTotal(0);
            setApiCompletedTotal(0);
            setApiNotYetTotal(0);
        } finally {
            setCountsLoading(false);
        }
    }, []);

    const loadServiceList = useCallback(async () => {
        setListLoading(true);
        try {
            if (statusFilter === VEHICLE_ACCESS_SERVICE_NOT_YET) {
                const res = await axiosInstance.get('/AssetItem/vehicle-access-services', {
                    params: { status: 'not-yet' },
                    skipToast: true,
                });
                setNotYetAssets(Array.isArray(res.data?.items) ? res.data.items : []);
                setVehiclesByType(emptyVehiclesByType());
            } else {
                const results = await Promise.all(
                    VEHICLE_ACCESS_SERVICE_TYPES.map(async (type) => {
                        const res = await axiosInstance.get('/AssetItem/vehicle-access-services', {
                            params: { type },
                            skipToast: true,
                        });
                        return [type, Array.isArray(res.data?.items) ? res.data.items : []];
                    }),
                );
                setVehiclesByType(Object.fromEntries(results));
                setNotYetAssets([]);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load services',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setVehiclesByType(emptyVehiclesByType());
            setNotYetAssets([]);
        } finally {
            setListLoading(false);
        }
    }, [statusFilter, toast]);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    useEffect(() => {
        loadServiceList();
    }, [loadServiceList]);

    const allRows = useMemo(() => {
        if (statusFilter === VEHICLE_ACCESS_SERVICE_NOT_YET) {
            return buildVehicleAccessNotYetRowsFromAssets(notYetAssets);
        }
        return VEHICLE_ACCESS_SERVICE_TYPES.flatMap((type) =>
            (vehiclesByType[type] || []).flatMap((asset) =>
                buildVehicleAccessServiceRowsFromAsset(asset, type),
            ),
        );
    }, [notYetAssets, statusFilter, vehiclesByType]);

    const visibleRows = useMemo(() => {
        if (statusFilter === VEHICLE_ACCESS_SERVICE_PENDING) {
            return allRows.filter((row) => isAccessServiceRowPending(row));
        }
        if (statusFilter === VEHICLE_ACCESS_SERVICE_COMPLETED) {
            return allRows.filter((row) => isAccessServiceRowCompleted(row));
        }
        if (statusFilter === VEHICLE_ACCESS_SERVICE_NOT_YET) {
            return allRows;
        }
        return allRows;
    }, [allRows, statusFilter]);

    const dateRangeBounds = useMemo(
        () => resolveAccessDateRange(dateRange, customFrom, customTo),
        [customFrom, customTo, dateRange],
    );

    const dateScopedRows = useMemo(
        () => visibleRows.filter((row) => rowMatchesDateRange(row, dateRangeBounds)),
        [dateRangeBounds, visibleRows],
    );

    const serviceScopedRows = useMemo(() => {
        if (serviceFilter === ALL_FILTER) return dateScopedRows;
        return dateScopedRows.filter((row) => rowServiceType(row) === serviceFilter);
    }, [dateScopedRows, serviceFilter]);

    const vehicleScopedRows = useMemo(() => {
        if (vehicleFilter === ALL_FILTER) return dateScopedRows;
        return dateScopedRows.filter((row) => rowVehicleId(row) === vehicleFilter);
    }, [dateScopedRows, vehicleFilter]);

    const vehicleOptions = useMemo(() => {
        const options = uniqueVehicleOptions(serviceScopedRows);
        if (vehicleFilter === ALL_FILTER || options.some((option) => option.id === vehicleFilter)) {
            return options;
        }
        const current = visibleRows.find((row) => rowVehicleId(row) === vehicleFilter);
        return [
            { id: vehicleFilter, label: current ? rowVehicleLabel(current) : 'Selected vehicle' },
            ...options,
        ];
    }, [serviceScopedRows, vehicleFilter, visibleRows]);

    const serviceOptions = useMemo(() => {
        const options = uniqueServiceOptions(vehicleScopedRows);
        if (serviceFilter === ALL_FILTER || options.includes(serviceFilter)) return options;
        return [serviceFilter, ...options];
    }, [serviceFilter, vehicleScopedRows]);

    const displayedRows = useMemo(
        () =>
            dateScopedRows.filter((row) => {
                if (vehicleFilter !== ALL_FILTER && rowVehicleId(row) !== vehicleFilter) return false;
                if (serviceFilter !== ALL_FILTER && rowServiceType(row) !== serviceFilter) return false;
                return true;
            }),
        [dateScopedRows, serviceFilter, vehicleFilter],
    );

    const filteredTotalAmount = useMemo(() => sumAccessAmounts(displayedRows), [displayedRows]);

    const serviceRecordRows = useMemo(() => allRows.filter((row) => !row?.isNotYet), [allRows]);

    const pendingCount = useMemo(
        () => serviceRecordRows.filter((row) => isAccessServiceRowPending(row)).length,
        [serviceRecordRows],
    );
    const completedCount = useMemo(
        () => serviceRecordRows.filter((row) => isAccessServiceRowCompleted(row)).length,
        [serviceRecordRows],
    );
    const notYetCount = useMemo(() => {
        if (statusFilter === VEHICLE_ACCESS_SERVICE_NOT_YET) return allRows.length;
        return apiNotYetTotal;
    }, [allRows.length, apiNotYetTotal, statusFilter]);

    const displayPendingCount =
        listLoading && statusFilter !== VEHICLE_ACCESS_SERVICE_NOT_YET ? apiPendingTotal : pendingCount;
    const displayCompletedCount =
        listLoading && statusFilter !== VEHICLE_ACCESS_SERVICE_NOT_YET ? apiCompletedTotal : completedCount;
    const displayNotYetCount = countsLoading ? apiNotYetTotal : notYetCount;

    const openRow = (row) => {
        const href = buildVehicleServiceListRowHref(row);
        if (!href) return;
        navigateFromList(router, href, listReturnHref);
    };

    const handleRefresh = () => {
        loadCounts();
        loadServiceList();
    };

    const handleStatusSelect = (next) => {
        onSelectType?.(next);
    };

    const refreshing = countsLoading || listLoading;

    const filterTitle =
        VEHICLE_ACCESS_SERVICE_STATUS_FILTERS.find((tab) => tab.key === statusFilter)?.label ||
        'All service records';

    const filtersNarrowed =
        vehicleFilter !== ALL_FILTER || serviceFilter !== ALL_FILTER || Boolean(dateRangeBounds);
    const emptyMessage = filtersNarrowed
        ? 'No services match the selected filters.'
        : statusFilter === VEHICLE_ACCESS_SERVICE_PENDING
          ? 'No pending services found.'
          : statusFilter === VEHICLE_ACCESS_SERVICE_COMPLETED
            ? 'No completed services found.'
            : statusFilter === VEHICLE_ACCESS_SERVICE_NOT_YET
              ? 'All vehicles have at least one completed service.'
              : 'No service records found.';

    return (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm mb-4 sm:mb-6 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-teal-50/40">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-teal-800">
                            Access Service
                        </h2>
                        {!countsLoading && displayPendingCount > 0 ? (
                            <CountBellBadge
                                count={displayPendingCount}
                                tone="pending"
                                title={`${displayPendingCount} pending services`}
                            />
                        ) : null}
                        {!countsLoading && displayCompletedCount > 0 ? (
                            <CountBellBadge
                                count={displayCompletedCount}
                                tone="complete"
                                title={`${displayCompletedCount} completed services`}
                            />
                        ) : null}
                        {!countsLoading && displayNotYetCount > 0 ? (
                            <CountBellBadge
                                count={displayNotYetCount}
                                tone="not_yet"
                                title={`${displayNotYetCount} vehicles not yet serviced`}
                            />
                        ) : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        All fleet service records — filter by status, vehicle, service, or date
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RotateCcw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-100">
                <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                            {filterTitle}
                            {!listLoading ? (
                                <span className="ml-2 text-teal-700 tabular-nums">({displayedRows.length})</span>
                            ) : null}
                        </h3>
                        {!listLoading ? (
                            <p className="mt-1 text-xs font-semibold text-slate-700 tabular-nums">
                                Total {formatAccessMoney(filteredTotalAmount)}
                            </p>
                        ) : null}
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 flex-wrap">
                        {VEHICLE_ACCESS_SERVICE_STATUS_FILTERS.map((tab) => {
                            const isActive = statusFilter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => handleStatusSelect(tab.key)}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                                        isActive
                                            ? 'bg-teal-600 text-white'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="px-4 sm:px-6 py-3 border-b border-slate-100 flex flex-wrap items-end gap-3">
                    <label className="block min-w-[11rem] flex-1 sm:flex-none sm:w-56">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Vehicle
                        </span>
                        <select
                            value={vehicleFilter}
                            onChange={(event) => setVehicleFilter(event.target.value)}
                            aria-label="Filter by vehicle"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                        >
                            <option value={ALL_FILTER}>All</option>
                            {vehicleOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block min-w-[11rem] flex-1 sm:flex-none sm:w-56">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Service
                        </span>
                        <select
                            value={serviceFilter}
                            onChange={(event) => setServiceFilter(event.target.value)}
                            aria-label="Filter by service"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                        >
                            <option value={ALL_FILTER}>All</option>
                            {serviceOptions.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block min-w-[11rem] flex-1 sm:flex-none sm:w-48">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Date
                        </span>
                        <select
                            value={dateRange}
                            onChange={(event) => setDateRange(event.target.value)}
                            aria-label="Filter by date range"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                        >
                            {DATE_RANGE_OPTIONS.map((option) => (
                                <option key={option.key} value={option.key}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {dateRange === 'custom' ? (
                        <>
                            <label className="block min-w-[10rem] flex-1 sm:flex-none sm:w-40">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    From
                                </span>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setCustomFrom(value);
                                        setCustomTo((prev) => (prev && value && value > prev ? value : prev));
                                    }}
                                    aria-label="Custom range start date"
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                                />
                            </label>
                            <label className="block min-w-[10rem] flex-1 sm:flex-none sm:w-40">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    To
                                </span>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setCustomTo(value);
                                        setCustomFrom((prev) => (prev && value && value < prev ? value : prev));
                                    }}
                                    aria-label="Custom range end date"
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                                />
                            </label>
                        </>
                    ) : null}
                </div>
                <div className="overflow-hidden">
                    {listLoading ? (
                        <div className="py-16 text-center text-sm text-slate-500">Loading service lists…</div>
                    ) : (
                        <VehicleAccessServiceListTable
                            rows={displayedRows}
                            onRowClick={openRow}
                            getRowHref={(row) => buildVehicleServiceListRowHref(row)}
                            router={router}
                            listReturnHref={listReturnHref}
                            emptyMessage={emptyMessage}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
