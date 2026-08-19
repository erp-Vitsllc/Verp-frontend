'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Car,
    ChevronDown,
    LayoutGrid,
    RotateCcw,
    ShieldAlert,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { navHrefProps } from '@/utils/linkContextMenu';
import ListTableRowLink from '@/components/ListTableRowLink';
import EmployeeNameLink from '@/components/EmployeeNameLink';
import {
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

const ALL_FINES = 'all';

const TYPE_ICONS = {
    [ALL_FINES]: LayoutGrid,
    'vehicle-fine': Car,
    'vehicle-damage': ShieldAlert,
    'loss-damage': AlertTriangle,
};

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
        return next.filter((fine) => idSet.has(String(fine?._id || '')));
    }
    next = next.filter(isVehicleAccessFineVisible);
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

const CELL_LINK_CLASS = 'relative z-[3] font-bold text-blue-600 hover:text-blue-800 hover:underline underline-offset-2';

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
    if (!rows.length) {
        return (
            <div className="py-10 text-center text-sm text-slate-500">
                No approved, Zoho-entered, or completed records in this type.
            </div>
        );
    }

    const unpaidTotal = sumUnpaidFines(rows);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1120px]">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <tr>
                        <th className="px-6 py-4">Fine ID</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Vehicle</th>
                        <th className="px-6 py-4">Plate No.</th>
                        <th className="px-6 py-4">Offender</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Paid to Vendor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {rows.map((fine) => {
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
    selectedType = ALL_FINES,
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

    const normalizedType = String(selectedType || ALL_FINES).trim().toLowerCase();
    const showAllTypes = !normalizedType || normalizedType === ALL_FINES;

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
                    : list.filter(isVehicleAccessFineVisible),
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

    const selectedVehicleLabel = useMemo(
        () => vehicleNumberOptions.find((row) => row.key === vehicleNumberFilter)?.label || '',
        [vehicleNumberOptions, vehicleNumberFilter],
    );

    const finesByType = useMemo(() => {
        const next = { all: vehicleFilteredFines };
        for (const type of VEHICLE_ACCESS_FINE_TYPES) {
            if (type.key === ALL_FINES) continue;
            next[type.key] = vehicleFilteredFines.filter((fine) => matchesVehicleAccessFineType(fine, type.key));
        }
        return next;
    }, [vehicleFilteredFines]);

    const typeCounts = useMemo(() => {
        const next = {};
        for (const type of VEHICLE_ACCESS_FINE_TYPES) {
            next[type.key] = finesByType[type.key]?.length || 0;
        }
        return next;
    }, [finesByType]);

    const visibleRowCount = useMemo(() => {
        if (showAllTypes) return typeCounts.all || 0;
        return finesByType[normalizedType]?.length || 0;
    }, [showAllTypes, typeCounts.all, finesByType, normalizedType]);

    const unpaidByType = useMemo(() => {
        const next = {};
        for (const type of VEHICLE_ACCESS_FINE_TYPES) {
            next[type.key] = sumUnpaidFines(finesByType[type.key] || []);
        }
        return next;
    }, [finesByType]);

    const visibleUnpaidTotal = showAllTypes
        ? unpaidByType.all || 0
        : unpaidByType[normalizedType] || 0;

    const openFine = useCallback(
        (fine) => {
            const href = resolveVehicleAccessFineHref(fine);
            if (!href) return;
            navigateFromList(router, href, listReturnHref);
        },
        [router, listReturnHref],
    );

    const handleTypeSelect = (typeKey) => {
        if (typeKey === ALL_FINES) {
            onSelectType(ALL_FINES);
            return;
        }
        if (normalizedType === typeKey) {
            onSelectType(ALL_FINES);
            return;
        }
        onSelectType(typeKey);
    };

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
                                        ? ` — ${vehicleFilteredFines.length} record${vehicleFilteredFines.length === 1 ? '' : 's'}`
                                        : ''
                                }`
                              : 'Approved, Zoho-entered, and completed fines — click a type to filter'}
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

            <div className="px-4 sm:px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center gap-2 sm:gap-3">
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

            <div className="p-4 sm:p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                    Fine &amp; damage types
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {VEHICLE_ACCESS_FINE_TYPES.map((type) => {
                        const Icon = TYPE_ICONS[type.key] || LayoutGrid;
                        const count = Number(typeCounts[type.key] || 0);
                        const unpaidTotal = Number(unpaidByType[type.key] || 0);
                        const isActive = type.key === ALL_FINES ? showAllTypes : normalizedType === type.key;
                        return (
                            <button
                                key={type.key}
                                type="button"
                                onClick={() => handleTypeSelect(type.key)}
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
                                            {type.label}
                                        </span>
                                        {!loading && count > 0 && type.key !== ALL_FINES ? (
                                            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-black text-teal-700 tabular-nums">
                                                {count}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                        {loading
                                            ? 'Loading…'
                                            : type.key === ALL_FINES
                                              ? `${count} total records`
                                              : count > 0
                                                ? `${count} record${count === 1 ? '' : 's'}`
                                                : type.hint}
                                    </span>
                                    {!loading && unpaidTotal > 0 ? (
                                        <span className="mt-1 block text-[11px] font-black text-rose-700 tabular-nums">
                                            {formatAed(unpaidTotal)} employee unpaid
                                        </span>
                                    ) : null}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-slate-100">
                <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                        {showAllTypes
                            ? 'All fines & damage records'
                            : `${VEHICLE_ACCESS_FINE_TYPES.find((row) => row.key === normalizedType)?.label || 'Fine'} records`}
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
                    ) : showAllTypes ? (
                        <div className="divide-y divide-slate-100">
                            {VEHICLE_ACCESS_FINE_TYPES.filter((type) => type.key !== ALL_FINES).map((type) => {
                                const rows = finesByType[type.key] || [];
                                if (!rows.length) return null;
                                return (
                                    <div key={type.key}>
                                        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2">
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                {type.label}
                                                <span className="ml-2 text-teal-700 tabular-nums">({rows.length})</span>
                                            </h4>
                                            <span
                                                className="text-[11px] font-black uppercase tracking-widest text-rose-700 tabular-nums whitespace-nowrap"
                                                title="Employee share still to pay, including partial balances"
                                            >
                                                Employee unpaid {formatAed(unpaidByType[type.key] || 0)}
                                            </span>
                                        </div>
                                        <FineTable
                                            rows={rows}
                                            onOpenFine={openFine}
                                            router={router}
                                            listReturnHref={listReturnHref}
                                        />
                                    </div>
                                );
                            })}
                            {!visibleRowCount ? (
                                <div className="py-16 text-center text-sm text-slate-500">
                                    {selectedVehicleLabel
                                        ? `No approved, Zoho-entered, or completed fines for ${selectedVehicleLabel}.`
                                        : 'No approved, Zoho-entered, or completed vehicle fines found.'}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <FineTable
                            rows={finesByType[normalizedType] || []}
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
