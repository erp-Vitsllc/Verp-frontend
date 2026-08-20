'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Car,
    ChevronDown,
    LayoutGrid,
    RotateCcw,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { navHrefProps } from '@/utils/linkContextMenu';
import ListTableRowLink from '@/components/ListTableRowLink';
import EmployeeNameLink from '@/components/EmployeeNameLink';
import {
    isVehicleAccessFineTypeIncluded,
    isVehicleAccessFineVisible,
    matchesVehicleAccessFineType,
    resolveVehicleAccessFineHref,
    resolveVehicleAccessOffender,
    resolveVehicleAccessVehicleHref,
    VEHICLE_ACCESS_FINE_TYPES,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';
import { formatFineVendorBillPaymentLabel } from '@/app/HRM/Fine/utils/fineVendorPaymentPrefill';
import { resolveFineNetTotal } from '@/utils/finePayableAmount';
import { sumEmployeeOutstandingOnFines } from '@/app/HRM/Fine/utils/employeeFineFinancials';
import VehicleServiceRequestSortHeader from '@/app/HRM/Asset/Vehicle/components/VehicleServiceRequestSortHeader';
import {
    codeSortValue,
    dateSortValue,
    numberSortValue,
    sortServiceTableRows,
    textSortValue,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceRequestTableSort';

function isAccessFineRow(fine) {
    return isVehicleAccessFineVisible(fine) && isVehicleAccessFineTypeIncluded(fine);
}

function vehicleLabel(fine) {
    return fine?.assetName || fine?.assetId || fine?.vehicleId || '—';
}

function vehiclePlateNo(fine) {
    const combined = String(fine?.vehiclePlateNo || '').trim();
    if (combined) return combined;
    const plate = [fine?.plateEmirate, fine?.plateNumber].filter(Boolean).join(' ').trim();
    return plate || '—';
}

function vehicleNumberFilterKey(fine) {
    const plate = vehiclePlateNo(fine);
    if (!plate || plate === '—') return '';
    return plate.replace(/\s+/g, ' ').trim().toLowerCase();
}

function collectVehicleNumberOptions(fines) {
    const byKey = new Map();
    for (const fine of fines || []) {
        const key = vehicleNumberFilterKey(fine);
        if (!key) continue;
        const current = byKey.get(key);
        if (current) {
            current.count += 1;
            continue;
        }
        byKey.set(key, { key, label: vehiclePlateNo(fine), count: 1 });
    }
    return [...byKey.values()].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
    );
}

function fineMatchesVehicleNumber(fine, selectedKey) {
    if (!selectedKey) return true;
    return vehicleNumberFilterKey(fine) === selectedKey;
}

function formatAed(value) {
    return `AED ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
}

function fineRowAmount(fine) {
    return Number(resolveFineNetTotal(fine) || 0);
}

function sumUnpaidFines(rows) {
    return sumEmployeeOutstandingOnFines(rows);
}

function parseFocusFineIds(raw) {
    return String(raw || '')
        .split(',')
        .map((id) => String(id || '').trim())
        .filter(Boolean);
}

function mongoId(value) {
    if (!value) return '';
    if (typeof value === 'object') return String(value._id || value.id || '').trim();
    return String(value).trim();
}

function fineMatchesFocusVehicle(fine, vehicleId) {
    const target = String(vehicleId || '').trim();
    if (!target) return true;
    const ids = [fine?.assetObjectId, fine?.vehicleObjectId, fine?.vehicleId].map(mongoId);
    if (ids.includes(target)) return true;
    return String(fine?.assetId || '').trim() === target;
}

function awardedDateInRange(value, from, to) {
    if (!from && !to) return true;
    if (!value) return false;
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return false;
    if (from) {
        const start = new Date(`${from}T00:00:00`).getTime();
        if (Number.isFinite(start) && t < start) return false;
    }
    if (to) {
        const end = new Date(`${to}T23:59:59.999`).getTime();
        if (Number.isFinite(end) && t > end) return false;
    }
    return true;
}

function applyVehicleFineFocus(list, { vehicleId, fineIds, from, to } = {}) {
    let next = Array.isArray(list) ? list : [];
    const ids = parseFocusFineIds(fineIds);
    if (ids.length) {
        const idSet = new Set(ids);
        return next.filter((fine) => idSet.has(String(fine?._id || ''))).filter(isVehicleAccessFineTypeIncluded);
    }
    next = next.filter(isAccessFineRow);
    if (vehicleId) next = next.filter((fine) => fineMatchesFocusVehicle(fine, vehicleId));
    if (from || to) next = next.filter((fine) => awardedDateInRange(fine?.awardedDate, from, to));
    return next;
}

function vendorBillBadgeClass(label) {
    if (label === 'Paid') return 'bg-emerald-100 text-emerald-800';
    if (label === 'Not Paid') return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-500';
}

function fineStatusBadgeClass(status) {
    const lower = String(status || '').trim().toLowerCase();
    if (lower === 'paid' || lower === 'completed' || lower === 'paid to vendor') {
        return 'bg-emerald-100 text-emerald-800';
    }
    if (lower === 'approved' || lower === 'active') {
        return 'bg-blue-100 text-blue-800';
    }
    if (lower.includes('pending') || lower === 'draft') {
        return 'bg-amber-100 text-amber-800';
    }
    if (lower.includes('rejected') || lower.includes('cancelled')) {
        return 'bg-slate-100 text-slate-600';
    }
    return 'bg-slate-100 text-slate-700';
}

const VEHICLE_LIST_RETURN = '/HRM/Asset/Vehicle';

const TYPE_CARD =
    'group flex items-center gap-2 rounded-xl border p-2 text-left transition-colors min-h-[3.25rem]';
const TYPE_CARD_ACTIVE = 'border-teal-500 bg-teal-50 ring-1 ring-teal-200';
const TYPE_CARD_IDLE = 'border-slate-200 bg-slate-50/70 hover:border-teal-300 hover:bg-teal-50/60';
const TYPE_ICON_WRAP =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm shrink-0';

const FINE_TYPE_ICONS = {
    all: LayoutGrid,
    'vehicle-fine': Car,
    'vehicle-damage': AlertTriangle,
};

const CELL_LINK_CLASS = 'relative z-[3] font-bold text-blue-600 hover:text-blue-800 hover:underline underline-offset-2';

const FINE_COLUMNS = [
    { key: 'fineId', label: 'Fine ID', type: 'text' },
    { key: 'fineType', label: 'Type', type: 'text' },
    { key: 'vehicle', label: 'Vehicle', type: 'text' },
    { key: 'plateNo', label: 'Plate No.', type: 'text' },
    { key: 'offender', label: 'Offender', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'awardedDate', label: 'Date', type: 'date' },
    { key: 'fineStatus', label: 'Status', type: 'text' },
    { key: 'vendorPaid', label: 'Paid to Vendor', type: 'text' },
];

function fineSortValue(fine, key) {
    switch (key) {
        case 'fineId':
            return codeSortValue(fine?.fineId);
        case 'fineType':
            return textSortValue(fine?.fineType);
        case 'vehicle':
            return codeSortValue(vehicleLabel(fine) === '—' ? '' : vehicleLabel(fine));
        case 'plateNo':
            return codeSortValue(vehiclePlateNo(fine) === '—' ? '' : vehiclePlateNo(fine));
        case 'offender':
            return textSortValue(resolveVehicleAccessOffender(fine)?.employeeName);
        case 'amount':
            return numberSortValue(fineRowAmount(fine));
        case 'awardedDate':
            return dateSortValue(fine?.awardedDate);
        case 'fineStatus':
            return textSortValue(fine?.fineStatus);
        case 'vendorPaid':
            return textSortValue(formatFineVendorBillPaymentLabel(fine));
        default:
            return null;
    }
}

function CellNavLink({ href, router, listReturnHref, title, children }) {
    if (!href) {
        return <span>{children}</span>;
    }
    return (
        <a
            href={href}
            className={CELL_LINK_CLASS}
            title={title}
            onClick={(event) => {
                event.stopPropagation();
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                navigateFromList(router, href, listReturnHref);
            }}
            {...navHrefProps(href)}
        >
            {children}
        </a>
    );
}

function FineTable({ rows, onOpenFine, router, listReturnHref = VEHICLE_LIST_RETURN }) {
    const [sortKey, setSortKey] = useState('awardedDate');
    const [sortDirection, setSortDirection] = useState('desc');

    const handleSort = useCallback(
        (key) => {
            const column = FINE_COLUMNS.find((c) => c.key === key);
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
        const column = FINE_COLUMNS.find((c) => c.key === sortKey) || FINE_COLUMNS[0];
        return sortServiceTableRows(rows, fineSortValue, sortKey, sortDirection, column.type);
    }, [rows, sortKey, sortDirection]);

    const unpaidTotal = useMemo(() => sumUnpaidFines(rows), [rows]);

    if (!rows.length) {
        return (
            <div className="py-10 text-center text-sm text-slate-500">
                No approved, Zoho-entered, or completed vehicle fines or vehicle damage.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1120px]">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <tr>
                        {FINE_COLUMNS.map((column) => (
                            <VehicleServiceRequestSortHeader
                                key={column.key}
                                label={column.label}
                                columnKey={column.key}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                                className="px-6 py-4"
                            />
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {sortedRows.map((fine) => {
                        const fineHref = resolveVehicleAccessFineHref(fine);
                        const vehicleHref = resolveVehicleAccessVehicleHref(fine);
                        const offender = resolveVehicleAccessOffender(fine);
                        const vehicleText = vehicleLabel(fine);
                        const plateText = vehiclePlateNo(fine);
                        const isNavigable = Boolean(fineHref && router);
                        const rowElement = (
                            <tr
                                key={fine._id}
                                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                role={!isNavigable ? 'button' : undefined}
                                tabIndex={!isNavigable ? 0 : undefined}
                                onClick={!isNavigable ? () => onOpenFine(fine) : undefined}
                                onKeyDown={
                                    !isNavigable
                                        ? (event) => {
                                              if (event.key === 'Enter' || event.key === ' ') {
                                                  event.preventDefault();
                                                  onOpenFine(fine);
                                              }
                                          }
                                        : undefined
                                }
                                title="Open fine details"
                            >
                                <td className="px-6 py-4 text-sm">
                                    <CellNavLink
                                        href={fineHref}
                                        router={router}
                                        listReturnHref={listReturnHref}
                                        title="Open fine details"
                                    >
                                        {fine.fineId || '—'}
                                    </CellNavLink>
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-700">{fine.fineType || '—'}</td>
                                <td className="px-6 py-4 text-sm">
                                    <CellNavLink
                                        href={vehicleHref}
                                        router={router}
                                        listReturnHref={listReturnHref}
                                        title="Open vehicle details"
                                    >
                                        {vehicleText}
                                    </CellNavLink>
                                </td>
                                <td className="px-6 py-4 text-sm whitespace-nowrap font-medium">
                                    <CellNavLink
                                        href={vehicleHref}
                                        router={router}
                                        listReturnHref={listReturnHref}
                                        title="Open vehicle details"
                                    >
                                        {plateText}
                                    </CellNavLink>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {offender.employeeId ? (
                                        <EmployeeNameLink
                                            employeeId={offender.employeeId}
                                            name={offender.employeeName}
                                            className={CELL_LINK_CLASS}
                                            variant="inherit"
                                        />
                                    ) : (
                                        <span className="text-slate-600">{offender.employeeName}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm font-black text-rose-600 tabular-nums">
                                    {formatAed(fineRowAmount(fine))}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    {fine.awardedDate ? new Date(fine.awardedDate).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${fineStatusBadgeClass(fine.fineStatus)}`}
                                    >
                                        {fine.fineStatus || '—'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {(() => {
                                        const vendorLabel = formatFineVendorBillPaymentLabel(fine);
                                        return (
                                            <span
                                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${vendorBillBadgeClass(vendorLabel)}`}
                                            >
                                                {vendorLabel}
                                            </span>
                                        );
                                    })()}
                                </td>
                            </tr>
                        );

                        if (isNavigable) {
                            return (
                                <ListTableRowLink
                                    key={fine._id}
                                    href={fineHref}
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
                <tfoot className="bg-rose-50/70 border-t border-rose-100">
                    <tr>
                        <td
                            colSpan={5}
                            className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-rose-700"
                        >
                            Total unpaid fines
                        </td>
                        <td className="px-6 py-3 text-sm font-black text-rose-700 tabular-nums whitespace-nowrap">
                            {formatAed(unpaidTotal)}
                        </td>
                        <td colSpan={3} className="px-6 py-3 text-xs text-rose-600/80">
                            {unpaidTotal > 0
                                ? 'Employee still to pay (unpaid and partial)'
                                : 'All employee shares paid'}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

export default function VehicleAccessFinePanel({
    selectedType = 'all',
    onSelectType,
    onClose,
    focusVehicleId = '',
    focusFineIds = '',
    focusFrom = '',
    focusTo = '',
    focusPlate = '',
    listReturnHref = VEHICLE_LIST_RETURN,
}) {
    const router = useRouter();
    const { toast } = useToast();

    const panelRef = useRef(null);
    const [fines, setFines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vehicleNumberFilter, setVehicleNumberFilter] = useState('');

    const hasDashboardFocus = Boolean(
        String(focusFineIds || '').trim() || String(focusVehicleId || '').trim(),
    );
    const focusLabel = String(focusPlate || '').trim();

    const loadFines = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/Fine', {
                params: { vehicleLinked: '1', limit: 1000 },
                skipToast: true,
            });
            const list = Array.isArray(res.data?.fines) ? res.data.fines : Array.isArray(res.data) ? res.data : [];
            const hasDashboardFocus = Boolean(
                String(focusFineIds || '').trim() || String(focusVehicleId || '').trim(),
            );
            setFines(
                hasDashboardFocus
                    ? applyVehicleFineFocus(list, {
                          vehicleId: focusVehicleId,
                          fineIds: focusFineIds,
                          from: focusFrom,
                          to: focusTo,
                      })
                    : list.filter(isAccessFineRow),
            );
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load vehicle fines',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setFines([]);
        } finally {
            setLoading(false);
        }
    }, [toast, focusVehicleId, focusFineIds, focusFrom, focusTo]);

    useEffect(() => {
        loadFines();
    }, [loadFines]);

    useEffect(() => {
        if (!hasDashboardFocus) return;
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [hasDashboardFocus]);

    const vehicleNumberOptions = useMemo(() => collectVehicleNumberOptions(fines), [fines]);

    useEffect(() => {
        const plate = String(focusPlate || '').trim();
        if (!plate) return;
        const key = plate.replace(/\s+/g, ' ').trim().toLowerCase();
        if (vehicleNumberOptions.some((row) => row.key === key)) {
            setVehicleNumberFilter(key);
        }
    }, [focusPlate, vehicleNumberOptions]);

    useEffect(() => {
        if (!vehicleNumberFilter) return;
        if (!vehicleNumberOptions.some((row) => row.key === vehicleNumberFilter)) {
            setVehicleNumberFilter('');
        }
    }, [vehicleNumberFilter, vehicleNumberOptions]);

    const vehicleFilteredFines = useMemo(
        () => fines.filter((fine) => fineMatchesVehicleNumber(fine, vehicleNumberFilter)),
        [fines, vehicleNumberFilter],
    );

    const activeFineType =
        VEHICLE_ACCESS_FINE_TYPES.find((row) => row.key === String(selectedType || 'all').trim().toLowerCase())
            ?.key || 'all';

    const typeCounts = useMemo(() => {
        const next = { all: vehicleFilteredFines.length };
        for (const row of VEHICLE_ACCESS_FINE_TYPES) {
            if (row.key === 'all') continue;
            next[row.key] = vehicleFilteredFines.filter((fine) => matchesVehicleAccessFineType(fine, row.key)).length;
        }
        return next;
    }, [vehicleFilteredFines]);

    const visibleFines = useMemo(
        () => vehicleFilteredFines.filter((fine) => matchesVehicleAccessFineType(fine, activeFineType)),
        [vehicleFilteredFines, activeFineType],
    );

    const handleTypeSelect = (typeKey) => {
        if (!onSelectType) return;
        if (typeKey === activeFineType && typeKey !== 'all') {
            onSelectType('all');
            return;
        }
        onSelectType(typeKey);
    };

    const selectedVehicleLabel = useMemo(
        () => vehicleNumberOptions.find((row) => row.key === vehicleNumberFilter)?.label || '',
        [vehicleNumberOptions, vehicleNumberFilter],
    );

    const visibleRowCount = visibleFines.length;
    const visibleUnpaidTotal = useMemo(
        () => sumUnpaidFines(visibleFines),
        [visibleFines],
    );

    const openFine = useCallback(
        (fine) => {
            const href = resolveVehicleAccessFineHref(fine);
            if (!href) return;
            navigateFromList(router, href, listReturnHref);
        },
        [router, listReturnHref],
    );

    return (
        <div
            ref={panelRef}
            id="access-vehicle-fine-panel"
            className="bg-white rounded-2xl border border-teal-200 shadow-sm mb-4 sm:mb-6 overflow-hidden"
        >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-teal-50/40">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-teal-800">
                            Access Vehicle Fine
                        </h2>
                        {!loading && visibleUnpaidTotal > 0 ? (
                            <span
                                className="inline-flex items-center justify-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-700 tabular-nums"
                                title="Employee share still to pay, including partial balances"
                            >
                                {formatAed(visibleUnpaidTotal)} employee unpaid
                            </span>
                        ) : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {hasDashboardFocus
                            ? `Dashboard fines${focusLabel ? ` for ${focusLabel}` : ''}${
                                  !loading ? ` — ${fines.length} record${fines.length === 1 ? '' : 's'}` : ''
                              }`
                            : selectedVehicleLabel
                              ? `Fines for ${selectedVehicleLabel}${
                                    !loading
                                        ? ` — ${visibleFines.length} record${visibleFines.length === 1 ? '' : 's'}`
                                        : ''
                                }`
                              : 'Approved, Zoho-entered, and completed vehicle fines and vehicle damage'}
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={loadFines}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
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

            <div className="p-3 sm:p-4 space-y-3">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                        Fine types
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {VEHICLE_ACCESS_FINE_TYPES.map((row) => {
                            const Icon = FINE_TYPE_ICONS[row.key] || LayoutGrid;
                            const count = Number(typeCounts[row.key] || 0);
                            const isActive = activeFineType === row.key;
                            return (
                                <button
                                    key={row.key}
                                    type="button"
                                    onClick={() => handleTypeSelect(row.key)}
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
                                                    isActive
                                                        ? 'text-teal-900'
                                                        : 'text-slate-800 group-hover:text-teal-800'
                                                }`}
                                            >
                                                {row.label}
                                            </span>
                                            {!loading && count > 0 ? (
                                                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-black text-teal-700 tabular-nums">
                                                    {count}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="block text-[10px] text-slate-500 mt-0.5 tabular-nums leading-tight">
                                            {loading
                                                ? 'Loading…'
                                                : count > 0
                                                  ? `${count} record${count === 1 ? '' : 's'}`
                                                  : row.hint}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-white flex flex-wrap items-center gap-2 sm:gap-3">
                <label
                    htmlFor="access-fine-vehicle-number"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                >
                    Vehicle number
                </label>
                <div className="relative min-w-0">
                    <select
                        id="access-fine-vehicle-number"
                        value={vehicleNumberFilter}
                        onChange={(event) => setVehicleNumberFilter(event.target.value)}
                        disabled={loading || vehicleNumberOptions.length === 0}
                        className="w-full min-w-[12rem] max-w-full sm:min-w-[16rem] appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="">All vehicles</option>
                        {vehicleNumberOptions.map((row) => (
                            <option key={row.key} value={row.key}>
                                {row.label} ({row.count})
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                </div>
                {!loading && vehicleNumberOptions.length > 0 ? (
                    <span className="text-[11px] text-slate-400 tabular-nums">
                        {vehicleNumberOptions.length} vehicle{vehicleNumberOptions.length === 1 ? '' : 's'} with fines
                    </span>
                ) : null}
            </div>

            <div className="border-t border-slate-100">
                <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                        Fine records
                        {!loading ? (
                            <span className="ml-2 text-teal-700 tabular-nums">({visibleRowCount})</span>
                        ) : null}
                    </h3>
                    {!loading ? (
                        <span
                            className="text-[11px] font-black uppercase tracking-widest text-rose-700 tabular-nums whitespace-nowrap"
                            title="Employee share still to pay, including partial balances"
                        >
                            Employee unpaid {formatAed(visibleUnpaidTotal)}
                        </span>
                    ) : null}
                </div>
                <div className="overflow-hidden">
                    {loading ? (
                        <div className="py-16 text-center text-sm text-slate-500">Loading vehicle fines…</div>
                    ) : (
                        <FineTable
                            rows={visibleFines}
                            onOpenFine={openFine}
                            router={router}
                            listReturnHref={listReturnHref}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
