'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Car,
    ClipboardList,
    Handshake,
    LayoutGrid,
    List,
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
    resolveHandoverDeleteHistoryId,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleHandoverHistory';
import { VEHICLE_ACCESS_HANDOVER_STATUSES } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';
import VehicleServiceRequestSortHeader from '@/app/HRM/Asset/Vehicle/components/VehicleServiceRequestSortHeader';
import {
    codeSortValue,
    dateSortValue,
    numberSortValue,
    sortServiceTableRows,
    textSortValue,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceRequestTableSort';

const ALL_HANDOVERS = 'all-handover';

const STATUS_ICONS = {
    'pending-inspection': ClipboardList,
    'all-handover': Handshake,
    'pending-handover': UserPlus,
    'assigned-vehicle': UserCheck,
    'unassigned-vehicle': Car,
    'list-vehicle': LayoutGrid,
};

const FILTER_BOXES = VEHICLE_ACCESS_HANDOVER_STATUSES;

const TYPE_CARD =
    'group flex items-center gap-2 rounded-xl border p-2 text-left transition-colors min-h-[3.25rem]';
const TYPE_CARD_ACTIVE = 'border-teal-500 bg-teal-50 ring-1 ring-teal-200';
const TYPE_CARD_IDLE = 'border-slate-200 bg-slate-50/70 hover:border-teal-300 hover:bg-teal-50/60';
const TYPE_ICON_WRAP =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm shrink-0';

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

function formatNameFirstLastInitial(person) {
    if (!person || typeof person !== 'object') return '';
    const first = String(person.firstName || '').trim();
    const last = String(person.lastName || '').trim();
    if (first && last) return `${first} ${last.charAt(0).toUpperCase()}`;
    return first || last || String(person.employeeId || '').trim();
}

function formatPendingWithLabel(vehicle) {
    const personName = formatNameFirstLastInitial(vehicle?.actionRequiredBy) || formatNameFirstLastInitial(vehicle?.assignedTo);
    if (personName) return `Pending with ${personName}`;
    const company =
        vehicle?.assignedCompany && typeof vehicle.assignedCompany === 'object'
            ? vehicle.assignedCompany.nickName || vehicle.assignedCompany.name || ''
            : '';
    if (company) return `Pending with ${company}`;
    return '';
}

function fallbackRowStatus(vehicle) {
    const status = String(vehicle?.status || '').trim().toLowerCase();
    if (
        status === 'unassigned' ||
        status === 'available' ||
        status === 'returned' ||
        (!vehicle?.assignedTo && !vehicle?.assignedCompany)
    ) {
        return {
            key: 'unassigned',
            label: 'Unassigned',
            className: 'bg-slate-100 text-slate-700 border border-slate-200',
        };
    }
    return {
        key: 'assigned',
        label: 'Assigned',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
}

function accessHandoverStatusBadge(vehicle, entry) {
    if (!entry) return fallbackRowStatus(vehicle);
    const status = getHandoverHistoryStatus(entry, vehicle);
    if (status.key !== 'pending') return status;
    const pendingLabel = formatPendingWithLabel(vehicle);
    if (!pendingLabel) return status;
    return {
        ...status,
        label: pendingLabel,
        className: 'bg-red-50 text-red-700 border border-red-200',
    };
}

const VEHICLE_LIST_RETURN = '/HRM/Asset/Vehicle';

const HANDOVER_COLUMNS = [
    { key: 'slNo', label: 'Sl No.', type: 'number' },
    { key: 'assetId', label: 'Vehicle asset no', type: 'text' },
    { key: 'vehicleNo', label: 'Vehicle no', type: 'text' },
    { key: 'type', label: 'Type', type: 'text' },
    { key: 'startDate', label: 'Start Date', type: 'date' },
    { key: 'endDate', label: 'End Date', type: 'date' },
    { key: 'from', label: 'From', type: 'text' },
    { key: 'to', label: 'To', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
];

function handoverSortValue(row, key) {
    const vehicle = row?.vehicle;
    const entry = row?.entry;
    switch (key) {
        case 'slNo':
            return numberSortValue(row?.slNo);
        case 'assetId':
            return codeSortValue(vehicle?.assetId);
        case 'vehicleNo': {
            const plate = [vehicle?.plateEmirate, vehicle?.plateNumber].filter(Boolean).join(' ').trim();
            return codeSortValue(plate);
        }
        case 'type':
            return textSortValue(entry ? getHandoverTypeLabel(entry, vehicle) : '');
        case 'startDate':
            return dateSortValue(entry ? getHandoverStartDate(entry) : null);
        case 'endDate':
            return dateSortValue(entry ? getHandoverEndDate(entry) : null);
        case 'from':
            return textSortValue(entry ? getHandoverByLabel(entry) : '');
        case 'to':
            return textSortValue(entry ? getHandoverToLabel(entry) : '');
        case 'status':
            return textSortValue(accessHandoverStatusBadge(vehicle, entry)?.label);
        default:
            return null;
    }
}

function HandoverTable({ rows, onOpenRow, router, listReturnHref = VEHICLE_LIST_RETURN }) {
    const [sortKey, setSortKey] = useState('startDate');
    const [sortDirection, setSortDirection] = useState('desc');

    const handleSort = useCallback(
        (key) => {
            const column = HANDOVER_COLUMNS.find((c) => c.key === key);
            if (!column) return;
            if (sortKey === key) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setSortKey(key);
            setSortDirection(column.type === 'date' || column.type === 'number' ? 'desc' : 'asc');
        },
        [sortKey],
    );

    const sortedRows = useMemo(() => {
        const column = HANDOVER_COLUMNS.find((c) => c.key === sortKey) || HANDOVER_COLUMNS[0];
        const withSl = (rows || []).map((row, index) => ({ ...row, slNo: index + 1 }));
        return sortServiceTableRows(withSl, handoverSortValue, sortKey, sortDirection, column.type);
    }, [rows, sortKey, sortDirection]);

    if (!rows.length) {
        return (
            <div className="py-10 text-center text-sm text-slate-500">No vehicles found.</div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[980px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        {HANDOVER_COLUMNS.map((column) => (
                            <VehicleServiceRequestSortHeader
                                key={column.key}
                                label={column.label}
                                columnKey={column.key}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                                className={column.key === 'from' || column.key === 'to' ? 'min-w-[140px]' : ''}
                            />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map(({ vehicle, entry, slNo }, index) => {
                        const statusBadge = accessHandoverStatusBadge(vehicle, entry);
                        const href = onOpenRow.href(vehicle, entry);
                        const isNavigable = Boolean(href && router);
                        const rowKey = String(entry?._id || `${vehicle._id}-${index}`);
                        const rowElement = (
                            <tr
                                key={rowKey}
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
                                title="Open vehicle details"
                            >
                                <td className="px-4 py-3 text-slate-600 font-semibold tabular-nums">{slNo}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                                    {vehicle.assetId || '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-800">{vehicleNo(vehicle)}</td>
                                <td className="px-4 py-3 text-slate-800 whitespace-nowrap font-medium">
                                    {entry ? getHandoverTypeLabel(entry, vehicle) : '—'}
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
                                    key={rowKey}
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
    const [items, setItems] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    const normalizedStatus = String(selectedStatus || selectedCategory || ALL_HANDOVERS).trim().toLowerCase();
    const activeStatus =
        FILTER_BOXES.find((row) => row.key === normalizedStatus)?.key || ALL_HANDOVERS;

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

    const loadHandoverList = useCallback(async (statusKey) => {
        setListLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-handovers', {
                params: { status: statusKey },
                skipToast: true,
            });
            setItems(Array.isArray(res.data?.items) ? res.data.items : []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load handovers',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setItems([]);
        } finally {
            setListLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    useEffect(() => {
        loadHandoverList(activeStatus);
    }, [loadHandoverList, activeStatus]);

    const visibleRows = useMemo(
        () =>
            items.map((item) => {
                const vehicle = item.vehicle || {};
                return { vehicle, entry: latestHandoverEntry(vehicle, item.history) };
            }),
        [items],
    );
    const visibleRowCount = visibleRows.length;

    const boxCounts = useMemo(() => {
        const next = {};
        for (const status of FILTER_BOXES) {
            next[status.key] = Number(counts[status.key] || 0);
        }
        next[activeStatus] = listLoading ? Number(counts[activeStatus] || 0) : visibleRowCount;
        return next;
    }, [counts, activeStatus, listLoading, visibleRowCount]);

    const totalPending = useMemo(
        () =>
            FILTER_BOXES.filter((row) => row.pending).reduce(
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
        loadHandoverList(activeStatus);
    };

    const handleStatusSelect = (statusKey) => {
        if (!onSelectStatus) return;
        onSelectStatus(statusKey);
    };

    const refreshing = countsLoading || listLoading;
    const activeBox = FILTER_BOXES.find((row) => row.key === activeStatus);

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
                        Click a status to filter. Lists are not grouped by category.
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

            <div className="p-3 sm:p-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Handover statuses
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {FILTER_BOXES.map((status) => {
                        const Icon = STATUS_ICONS[status.key] || List;
                        const count = Number(boxCounts[status.key] || 0);
                        const isActive = activeStatus === status.key;
                        return (
                            <button
                                key={status.key}
                                type="button"
                                onClick={() => handleStatusSelect(status.key)}
                                className={`${TYPE_CARD} ${isActive ? TYPE_CARD_ACTIVE : TYPE_CARD_IDLE}`}
                            >
                                <span
                                    className={`${TYPE_ICON_WRAP} ${
                                        isActive
                                            ? 'bg-teal-600 border-teal-600 text-white'
                                            : 'bg-white border-slate-200 text-teal-700'
                                    }`}
                                >
                                    <Icon size={16} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-1">
                                        <span
                                            className={`block text-[10px] font-black uppercase tracking-wide leading-tight ${
                                                isActive ? 'text-teal-900' : 'text-slate-800 group-hover:text-teal-800'
                                            }`}
                                        >
                                            {status.label}
                                        </span>
                                        {!countsLoading && count > 0 ? (
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
                                    <span className="block text-[10px] text-slate-500 mt-0.5 tabular-nums leading-tight">
                                        {countsLoading
                                            ? 'Loading…'
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
                        {activeBox?.label || 'Handover'} records
                        {!listLoading ? (
                            <span className="ml-2 text-teal-700 tabular-nums">({visibleRowCount})</span>
                        ) : null}
                    </h3>
                </div>
                <div className="overflow-hidden">
                    {listLoading ? (
                        <div className="py-16 text-center text-sm text-slate-500">Loading handover lists…</div>
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
