'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Car,
    ClipboardCheck,
    ClipboardList,
    Handshake,
    LayoutGrid,
    RotateCcw,
    UserCheck,
    UserPlus,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import ListTableRowLink from '@/components/ListTableRowLink';
import {
    buildHandoverHistoryRows,
    getHandoverByLabel,
    getHandoverEndDate,
    getHandoverHistoryStatus,
    getHandoverStartDate,
    getHandoverToLabel,
    getHandoverTypeLabel,
    isVehicleInspectionHandoverEntry,
    resolveHandoverDeleteHistoryId,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverHistory';
import { VEHICLE_ACCESS_HANDOVER_STATUSES } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

const ALL_HANDOVERS = 'all';

const STATUS_ICONS = {
    [ALL_HANDOVERS]: LayoutGrid,
    'pending-hr': UserCheck,
    'pending-inspection': ClipboardList,
    'completed-inspection': ClipboardCheck,
    'pending-assignee': UserPlus,
    'completed-handover': Handshake,
    'unassigned-vehicle': Car,
};

const FILTER_BOXES = [
    {
        key: ALL_HANDOVERS,
        label: 'All Handovers',
        hint: 'Every handover status',
        pending: false,
    },
    ...VEHICLE_ACCESS_HANDOVER_STATUSES,
];

function emptyItemsByStatus() {
    return Object.fromEntries(VEHICLE_ACCESS_HANDOVER_STATUSES.map((row) => [row.key, []]));
}

function formatHandoverDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function vehicleNo(vehicle) {
    return [vehicle?.plateEmirate, vehicle?.plateNumber].filter(Boolean).join(' ').trim() || '—';
}

function latestHandoverEntry(vehicle, history) {
    const historyRows = buildHandoverHistoryRows(history ? [history] : [], vehicle);
    if (historyRows.length) {
        return [...historyRows].sort((a, b) => {
            const ta = new Date(a.date || a.createdAt || 0).getTime();
            const tb = new Date(b.date || b.createdAt || 0).getTime();
            return tb - ta;
        })[0];
    }
    return history || null;
}

function unassignedStatus() {
    return {
        key: 'unassigned',
        label: 'Unassigned',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
    };
}

function dedupeHandoverRows(rows) {
    const seen = new Map();
    for (const row of rows) {
        const id = String(row?.vehicle?._id || '');
        if (!id) continue;
        if (!seen.has(id)) seen.set(id, row);
    }
    return [...seen.values()];
}

function handoverRowBelongsInStatusBucket(statusKey, vehicle, entry) {
    if (statusKey === 'unassigned-vehicle') return true;
    if (!entry) return false;
    const status = getHandoverHistoryStatus(entry, vehicle);
    if (statusKey === 'pending-hr' || statusKey === 'pending-assignee') {
        return status.key !== 'approved';
    }
    if (statusKey === 'completed-handover') {
        return status.key === 'approved' && !isVehicleInspectionHandoverEntry(entry, vehicle);
    }
    if (statusKey === 'completed-inspection') {
        return status.key === 'approved' && isVehicleInspectionHandoverEntry(entry, vehicle);
    }
    return true;
}

const VEHICLE_LIST_RETURN = '/HRM/Asset/Vehicle';

function HandoverTable({ rows, onOpenRow, router, listReturnHref = VEHICLE_LIST_RETURN }) {
    if (!rows.length) {
        return (
            <div className="py-10 text-center text-sm text-slate-500">No handover records found.</div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[980px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3 whitespace-nowrap">Sl No.</th>
                        <th className="px-4 py-3 whitespace-nowrap">Vehicle asset no</th>
                        <th className="px-4 py-3 whitespace-nowrap">Vehicle no</th>
                        <th className="px-4 py-3 whitespace-nowrap">Type</th>
                        <th className="px-4 py-3 whitespace-nowrap">Start Date</th>
                        <th className="px-4 py-3 whitespace-nowrap">End Date</th>
                        <th className="px-4 py-3 min-w-[140px]">From</th>
                        <th className="px-4 py-3 min-w-[140px]">To</th>
                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ vehicle, entry }, index) => {
                        const statusBadge = entry
                            ? getHandoverHistoryStatus(entry, vehicle)
                            : unassignedStatus();
                        const href = onOpenRow.href(vehicle, entry);
                        const isNavigable = Boolean(href && router);
                        const rowElement = (
                            <tr
                                key={String(entry?._id || `${vehicle._id}-${index}`)}
                                role={!isNavigable ? 'button' : undefined}
                                tabIndex={!isNavigable ? 0 : undefined}
                                onClick={!isNavigable ? () => onOpenRow.open(vehicle, entry) : undefined}
                                onKeyDown={
                                    !isNavigable
                                        ? (event) => {
                                              if (event.key === 'Enter' || event.key === ' ') {
                                                  event.preventDefault();
                                                  onOpenRow.open(vehicle, entry);
                                              }
                                          }
                                        : undefined
                                }
                                className="cursor-pointer hover:bg-slate-50/70 transition-colors border-b border-slate-100"
                                title="Open handover details"
                            >
                                <td className="px-4 py-3 text-slate-600 font-semibold">{index + 1}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                                    {vehicle.assetId || '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-800">{vehicleNo(vehicle)}</td>
                                <td className="px-4 py-3 text-slate-800 whitespace-nowrap font-medium">
                                    {entry ? getHandoverTypeLabel(entry, vehicle) : 'Unassigned'}
                                </td>
                                <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                                    {formatHandoverDate(entry ? getHandoverStartDate(entry) : null)}
                                </td>
                                <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                                    {formatHandoverDate(entry ? getHandoverEndDate(entry) : null)}
                                </td>
                                <td className="px-4 py-3 text-slate-800">
                                    {entry ? getHandoverByLabel(entry) || '—' : '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-800">
                                    {entry ? getHandoverToLabel(entry) || '—' : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${statusBadge.className}`}
                                    >
                                        {statusBadge.label}
                                    </span>
                                </td>
                            </tr>
                        );

                        if (isNavigable) {
                            return (
                                <ListTableRowLink
                                    key={String(entry?._id || `${vehicle._id}-${index}`)}
                                    href={href}
                                    router={router}
                                    listReturnHref={listReturnHref}
                                >
                                    {rowElement}
                                </ListTableRowLink>
                            );
                        }

                        return rowElement;
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function VehicleAccessHandoverPanel({
    selectedCategory = ALL_HANDOVERS,
    selectedStatus = selectedCategory,
    onSelectCategory,
    onSelectStatus = onSelectCategory,
    onClose,
    listReturnHref = VEHICLE_LIST_RETURN,
}) {
    const router = useRouter();
    const { toast } = useToast();

    const [counts, setCounts] = useState({});
    const [countsLoading, setCountsLoading] = useState(true);
    const [itemsByStatus, setItemsByStatus] = useState(emptyItemsByStatus);
    const [listLoading, setListLoading] = useState(false);

    const normalizedStatus = String(selectedStatus || selectedCategory || ALL_HANDOVERS).trim().toLowerCase();
    const showAllStatuses = !normalizedStatus || normalizedStatus === ALL_HANDOVERS;

    const loadCounts = useCallback(async () => {
        setCountsLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-handovers', { skipToast: true });
            const nextCounts = res.data?.counts && typeof res.data.counts === 'object' ? res.data.counts : {};
            setCounts(nextCounts);
        } catch {
            setCounts({});
        } finally {
            setCountsLoading(false);
        }
    }, []);

    const loadHandoverList = useCallback(async () => {
        setListLoading(true);
        try {
            const results = await Promise.all(
                VEHICLE_ACCESS_HANDOVER_STATUSES.map(async (status) => {
                    const res = await axiosInstance.get('/AssetItem/vehicle-access-handovers', {
                        params: { status: status.key },
                        skipToast: true,
                    });
                    return [status.key, Array.isArray(res.data?.items) ? res.data.items : []];
                }),
            );
            setItemsByStatus(Object.fromEntries(results));
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load handovers',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setItemsByStatus(emptyItemsByStatus());
        } finally {
            setListLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    useEffect(() => {
        loadHandoverList();
    }, [loadHandoverList]);

    const rowsByStatus = useMemo(() => {
        const next = {};
        for (const status of VEHICLE_ACCESS_HANDOVER_STATUSES) {
            next[status.key] = (itemsByStatus[status.key] || [])
                .map((item) => {
                    const vehicle = item.vehicle || {};
                    return { vehicle, entry: latestHandoverEntry(vehicle, item.history) };
                })
                .filter(({ vehicle, entry }) =>
                    handoverRowBelongsInStatusBucket(status.key, vehicle, entry),
                );
        }
        return next;
    }, [itemsByStatus]);

    const allRows = useMemo(
        () => dedupeHandoverRows(VEHICLE_ACCESS_HANDOVER_STATUSES.flatMap((status) => rowsByStatus[status.key] || [])),
        [rowsByStatus],
    );

    const visibleRows = showAllStatuses ? allRows : rowsByStatus[normalizedStatus] || [];
    const visibleRowCount = visibleRows.length;

    const boxCounts = useMemo(() => {
        const next = { [ALL_HANDOVERS]: allRows.length };
        for (const status of VEHICLE_ACCESS_HANDOVER_STATUSES) {
            next[status.key] = listLoading
                ? Number(counts[status.key] || 0)
                : (rowsByStatus[status.key]?.length || 0);
        }
        return next;
    }, [counts, allRows.length, rowsByStatus, listLoading]);

    const totalPending = useMemo(
        () =>
            VEHICLE_ACCESS_HANDOVER_STATUSES.filter((row) => row.pending).reduce(
                (sum, row) => sum + Number(counts[row.key] || 0),
                0,
            ),
        [counts],
    );

    const handoverHref = useCallback((vehicle, entry) => {
        const vehicleId = vehicle?._id;
        if (!vehicleId) return '';
        const assignId = entry ? resolveHandoverDeleteHistoryId(entry, vehicle, [entry]) : '';
        if (assignId) return `/HRM/Asset/Vehicle/details/${vehicleId}/assign/${assignId}`;
        return `/HRM/Asset/Vehicle/details/${vehicleId}?tab=handover`;
    }, []);

    const openRow = useCallback(
        (vehicle, entry) => {
            const href = handoverHref(vehicle, entry);
            if (!href) return;
            navigateFromList(router, href, listReturnHref);
        },
        [handoverHref, router, listReturnHref],
    );

    const handleRefresh = () => {
        loadCounts();
        loadHandoverList();
    };

    const handleStatusSelect = (statusKey) => {
        if (!onSelectStatus) return;
        if (statusKey === ALL_HANDOVERS || normalizedStatus === statusKey) {
            onSelectStatus(ALL_HANDOVERS);
            return;
        }
        onSelectStatus(statusKey);
    };

    const refreshing = countsLoading || listLoading;

    return (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm mb-4 sm:mb-6 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-teal-50/40">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-teal-800">
                            Access Handover
                        </h2>
                        {!countsLoading && totalPending > 0 ? (
                            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-600 tabular-nums">
                                {totalPending} pending
                            </span>
                        ) : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Click a status to filter. Pending Assignee is the assignment target waiting to accept.
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

            <div className="p-4 sm:p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                    Handover statuses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {FILTER_BOXES.map((status) => {
                        const Icon = STATUS_ICONS[status.key] || Handshake;
                        const count = Number(boxCounts[status.key] || 0);
                        const isActive =
                            status.key === ALL_HANDOVERS
                                ? showAllStatuses
                                : normalizedStatus === status.key;
                        return (
                            <button
                                key={status.key}
                                type="button"
                                onClick={() => handleStatusSelect(status.key)}
                                className={`group flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                                    isActive
                                        ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                                        : 'border-slate-200 bg-slate-50/70 hover:border-teal-300 hover:bg-teal-50/60'
                                }`}
                            >
                                <span
                                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm shrink-0 ${
                                        isActive
                                            ? 'bg-teal-600 border-teal-600 text-white'
                                            : 'bg-white border-slate-200 text-teal-700'
                                    }`}
                                >
                                    <Icon size={20} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span
                                            className={`block text-sm font-black uppercase tracking-wide ${
                                                isActive ? 'text-teal-900' : 'text-slate-800 group-hover:text-teal-800'
                                            }`}
                                        >
                                            {status.label}
                                        </span>
                                        {!countsLoading && !listLoading && count > 0 && status.key !== ALL_HANDOVERS ? (
                                            <span
                                                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums ${
                                                    status.pending
                                                        ? 'bg-red-100 text-red-600'
                                                        : 'bg-teal-100 text-teal-700'
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                        {countsLoading || listLoading
                                            ? 'Loading…'
                                            : status.key === ALL_HANDOVERS
                                              ? `${count} total records`
                                              : count > 0
                                                ? `${count} record${count === 1 ? '' : 's'}`
                                                : status.hint}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-slate-100">
                <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                        {showAllStatuses
                            ? 'All handover records'
                            : `${FILTER_BOXES.find((row) => row.key === normalizedStatus)?.label || 'Handover'} records`}
                        {!listLoading ? (
                            <span className="ml-2 text-teal-700 tabular-nums">({visibleRowCount})</span>
                        ) : null}
                    </h3>
                </div>
                <div className="overflow-hidden">
                    {listLoading ? (
                        <div className="py-16 text-center text-sm text-slate-500">Loading handover lists…</div>
                    ) : showAllStatuses ? (
                        <div className="divide-y divide-slate-100">
                            {VEHICLE_ACCESS_HANDOVER_STATUSES.map((status) => {
                                const rows = rowsByStatus[status.key] || [];
                                if (!rows.length) return null;
                                return (
                                    <div key={status.key}>
                                        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-100">
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                {status.label}
                                                <span className="ml-2 text-teal-700 tabular-nums">({rows.length})</span>
                                            </h4>
                                        </div>
                                        <HandoverTable
                                            rows={rows}
                                            router={router}
                                            listReturnHref={listReturnHref}
                                            onOpenRow={{
                                                href: handoverHref,
                                                open: openRow,
                                            }}
                                        />
                                    </div>
                                );
                            })}
                            {!visibleRowCount ? (
                                <div className="py-16 text-center text-sm text-slate-500">
                                    No handover records found.
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <HandoverTable
                            rows={visibleRows}
                            router={router}
                            listReturnHref={listReturnHref}
                            onOpenRow={{
                                href: handoverHref,
                                open: openRow,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
