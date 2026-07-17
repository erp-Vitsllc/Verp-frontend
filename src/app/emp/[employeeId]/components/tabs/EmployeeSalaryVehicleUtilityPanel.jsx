'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Car, ChevronDown, ExternalLink, Receipt, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { navHrefProps } from '@/utils/linkContextMenu';
import { getAssetStatusBadgeClass } from '@/utils/assetStatusHelpers';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
    formatCellValue,
    getMonthlyRentalAmount,
} from '@/app/HRM/Asset/UtilityBills/utils/utilityBillsStorage';
import { fetchUtilityEntries } from '@/app/HRM/Asset/UtilityBills/utils/utilityBillsApi';
import { billDisplayStatus, formatBillMoney } from '@/app/HRM/Asset/UtilityBills/utils/utilityBillStats';
import ViewBillModal from '@/app/HRM/Asset/UtilityBills/components/ViewBillModal';

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Normalize a bill to its `YYYY-MM` month key, falling back to createdAt. */
function billMonthKey(bill) {
    const raw = String(bill?.billMonth || '').trim();
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    if (bill?.createdAt) {
        const d = new Date(bill.createdAt);
        if (!Number.isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    }
    return '';
}

/** e.g. 2026-07 → "Jul 2026" */
function monthLabelFromKey(ym) {
    if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return String(ym || 'Unknown');
    const [y, m] = String(ym).split('-').map(Number);
    return `${MONTH_SHORT[m - 1] || m} ${y}`;
}

/** Day-level date for a bill (used by the day-to-day filter): prefer createdAt. */
function getBillDate(bill) {
    if (bill?.createdAt) {
        const d = new Date(bill.createdAt);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const ym = billMonthKey(bill);
    if (/^\d{4}-\d{2}$/.test(ym)) {
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m - 1, 1);
    }
    return null;
}

function billSortTime(bill) {
    const d = getBillDate(bill);
    return d ? d.getTime() : 0;
}

function billStatusBadgeClass(status) {
    const s = String(status || '');
    if (s === 'Pending Accounts') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (s === 'Pending HR') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s === 'Approved') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (s === 'Paid') return 'bg-teal-50 text-teal-800 border-teal-200';
    if (s === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
}

function employeeIdCandidates(employee) {
    return new Set(
        [employee?._id, employee?.id, employee?.employeeObjectId, employee?.employeeId]
            .filter(Boolean)
            .map((x) => String(x)),
    );
}

function assigneeMatchesEmployee(assignedTo, employee) {
    if (!assignedTo || !employee) return false;
    const ids = employeeIdCandidates(employee);
    if (typeof assignedTo === 'object') {
        return [assignedTo._id, assignedTo.id, assignedTo.employeeObjectId, assignedTo.employeeId]
            .filter(Boolean)
            .some((x) => ids.has(String(x)));
    }
    return ids.has(String(assignedTo));
}

function isVehicleAsset(asset) {
    if (!asset) return false;
    if (asset.assignedCompany) return false;
    const typeLower = String(asset?.typeId?.name || asset?.type || '').toLowerCase();
    const catLower = String(asset?.categoryId?.name || asset?.category || '').toLowerCase();
    return (
        typeLower.includes('vehicle') ||
        typeLower.includes('car') ||
        typeLower.includes('fleet') ||
        catLower.includes('vehicle') ||
        catLower.includes('car') ||
        !!(asset.plateNumber && String(asset.plateNumber).trim())
    );
}

function plateLabel(vehicle) {
    const plate = `${vehicle?.plateEmirate || ''} ${vehicle?.plateNumber || ''}`.trim();
    return plate || vehicle?.name || vehicle?.assetId || 'Vehicle';
}

/**
 * Salary tab panels: vehicles assigned to this employee, or utility entries grouped by type.
 * @param {'Vehicle'|'Utility Bills'} mode
 */
export default function EmployeeSalaryVehicleUtilityPanel({
    mode = 'Vehicle',
    employee,
    assets = [],
    formatDate,
}) {
    const router = useRouter();
    const [fleetVehicles, setFleetVehicles] = useState([]);
    const [loadingFleet, setLoadingFleet] = useState(false);
    const [utilityEntries, setUtilityEntries] = useState([]);
    const [loadingUtilities, setLoadingUtilities] = useState(false);
    const [billsByEntry, setBillsByEntry] = useState({});
    const [loadingBills, setLoadingBills] = useState(false);
    const [expandedEntries, setExpandedEntries] = useState(() => new Set());
    const [viewBill, setViewBill] = useState(null);
    /** 'day' | 'month' | 'year' */
    const [filterMode, setFilterMode] = useState('month');
    const [dayStart, setDayStart] = useState('');
    const [dayEnd, setDayEnd] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');

    const loadFleet = useCallback(async () => {
        if (!employee?._id) return;
        setLoadingFleet(true);
        try {
            const fleetRes = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard', {
                params: { scope: 'list' },
                timeout: 30000,
                skipToast: true,
            });
            const list = Array.isArray(fleetRes.data?.vehicles) ? fleetRes.data.vehicles : [];
            setFleetVehicles(
                list.filter(
                    (v) =>
                        !v?.assignedCompany &&
                        assigneeMatchesEmployee(v?.assignedTo, employee),
                ),
            );
        } catch {
            setFleetVehicles([]);
        } finally {
            setLoadingFleet(false);
        }
    }, [employee]);

    const loadBillsForEntries = useCallback(async (entries) => {
        const list = Array.isArray(entries) ? entries : [];
        if (!list.length) {
            setBillsByEntry({});
            return;
        }
        setLoadingBills(true);
        try {
            const results = await Promise.all(
                list.map(async (entry) => {
                    try {
                        const res = await axiosInstance.get('/UtilityBill', {
                            params: { entryId: entry.id },
                            skipToast: true,
                        });
                        return [entry.id, Array.isArray(res.data?.bills) ? res.data.bills : []];
                    } catch {
                        return [entry.id, []];
                    }
                }),
            );
            const map = {};
            results.forEach(([id, bills]) => {
                map[id] = bills;
            });
            setBillsByEntry(map);
        } finally {
            setLoadingBills(false);
        }
    }, []);

    const loadUtilities = useCallback(async () => {
        const empId = String(employee?._id || '');
        if (!empId) {
            setUtilityEntries([]);
            setBillsByEntry({});
            return;
        }
        setLoadingUtilities(true);
        try {
            const entries = await fetchUtilityEntries({
                assignedToId: empId,
                assignedToType: 'Employee',
            });
            const list = Array.isArray(entries) ? entries : [];
            setUtilityEntries(list);
            loadBillsForEntries(list);
        } catch {
            setUtilityEntries([]);
            setBillsByEntry({});
        } finally {
            setLoadingUtilities(false);
        }
    }, [employee?._id, loadBillsForEntries]);

    useEffect(() => {
        if (mode === 'Vehicle') loadFleet();
    }, [mode, loadFleet]);

    useEffect(() => {
        if (mode === 'Utility Bills') loadUtilities();
    }, [mode, loadUtilities]);

    // Profile `employee.assets` is already scoped to this employee.
    const vehiclesFromAssets = useMemo(
        () => (Array.isArray(assets) ? assets : []).filter((a) => isVehicleAsset(a)),
        [assets],
    );

    const vehicles = useMemo(() => {
        const map = new Map();
        [...fleetVehicles, ...vehiclesFromAssets].forEach((v) => {
            const key = String(v?._id || v?.id || `${v?.assetId || ''}-${v?.plateNumber || ''}`);
            if (!key || key === '-') return;
            if (!map.has(key)) map.set(key, v);
        });
        return Array.from(map.values());
    }, [fleetVehicles, vehiclesFromAssets]);

    const utilitiesByType = useMemo(() => {
        const groups = new Map();
        (utilityEntries || []).forEach((entry) => {
            const typeName = String(entry.type || 'Other').trim() || 'Other';
            if (!groups.has(typeName)) groups.set(typeName, []);
            groups.get(typeName).push(entry);
        });
        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, rows]) => ({
                type,
                rows: rows.sort(
                    (x, y) => new Date(y.createdAt || 0).getTime() - new Date(x.createdAt || 0).getTime(),
                ),
            }));
    }, [utilityEntries]);

    const availableYears = useMemo(() => {
        const set = new Set();
        Object.values(billsByEntry).forEach((list) =>
            (list || []).forEach((b) => {
                const y = billMonthKey(b).slice(0, 4);
                if (y) set.add(y);
            }),
        );
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [billsByEntry]);

    const hasActiveFilter =
        (filterMode === 'day' && (dayStart || dayEnd)) ||
        (filterMode === 'month' && filterMonth) ||
        (filterMode === 'year' && filterYear);

    const billMatchesFilter = useCallback(
        (bill) => {
            if (filterMode === 'year') {
                if (!filterYear) return true;
                return billMonthKey(bill).slice(0, 4) === String(filterYear);
            }
            if (filterMode === 'month') {
                if (!filterMonth) return true;
                return billMonthKey(bill) === filterMonth;
            }
            if (!dayStart && !dayEnd) return true;
            const d = getBillDate(bill);
            if (!d) return false;
            const t = d.getTime();
            if (dayStart && t < new Date(`${dayStart}T00:00:00`).getTime()) return false;
            if (dayEnd && t > new Date(`${dayEnd}T23:59:59`).getTime()) return false;
            return true;
        },
        [filterMode, filterYear, filterMonth, dayStart, dayEnd],
    );

    const billsForEntry = useCallback(
        (entryId) =>
            (billsByEntry[entryId] || [])
                .filter(billMatchesFilter)
                .sort((a, b) => billSortTime(b) - billSortTime(a)),
        [billsByEntry, billMatchesFilter],
    );

    const toggleEntry = useCallback((entryId) => {
        setExpandedEntries((prev) => {
            const next = new Set(prev);
            if (next.has(entryId)) next.delete(entryId);
            else next.add(entryId);
            return next;
        });
    }, []);

    const clearFilter = useCallback(() => {
        setDayStart('');
        setDayEnd('');
        setFilterMonth('');
        setFilterYear('');
    }, []);

    if (mode === 'Vehicle') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-600">
                    <Car size={18} className="text-teal-600" />
                    <p className="text-sm font-medium">
                        Vehicles currently assigned to this employee
                    </p>
                </div>

                {loadingFleet && vehicles.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-400">Loading vehicles…</p>
                ) : vehicles.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-400">No vehicles assigned</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] table-auto">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Vehicle
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Asset ID
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Type
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Assigned Date
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Status
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map((vehicle) => {
                                    const href = `/HRM/Asset/Vehicle/details/${vehicle._id || vehicle.id}`;
                                    const assignedDate =
                                        vehicle.assignedDate || vehicle.updatedAt || vehicle.createdAt;
                                    return (
                                        <tr
                                            key={vehicle._id || vehicle.id || plateLabel(vehicle)}
                                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                            {...navHrefProps(href)}
                                            onClick={() => router.push(href)}
                                        >
                                            <td className="py-3 px-4 text-sm font-semibold text-slate-800">
                                                {plateLabel(vehicle)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {vehicle.assetId || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {vehicle.typeId?.name || vehicle.type || 'Vehicle'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {assignedDate && formatDate
                                                    ? formatDate(assignedDate)
                                                    : assignedDate
                                                      ? new Date(assignedDate).toLocaleDateString('en-GB')
                                                      : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getAssetStatusBadgeClass(vehicle.status)}`}
                                                >
                                                    {vehicle.status || 'Assigned'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(href)}
                                                    className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-semibold"
                                                >
                                                    View <ExternalLink size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    // Utility Bills — each utility (entry) grouped by type, expandable to show its bills
    const filterModes = [
        { id: 'day', label: 'Day to Day' },
        { id: 'month', label: 'Month' },
        { id: 'year', label: 'Year' },
    ];

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                    <Receipt size={18} className="text-teal-600" />
                    <p className="text-sm font-medium">
                        Utility bills assigned to this employee — expand a utility to see its bills
                    </p>
                </div>
            </div>

            {/* Bill filter: day-to-day / month / year */}
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Filter bills
                </span>
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                    {filterModes.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => setFilterMode(m.id)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                                filterMode === m.id
                                    ? 'bg-teal-500 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {filterMode === 'day' ? (
                    <DateRangePicker
                        startValue={dayStart}
                        endValue={dayEnd}
                        onStartChange={setDayStart}
                        onEndChange={setDayEnd}
                        placeholder="Select day range"
                        className="h-9 text-sm"
                    />
                ) : null}

                {filterMode === 'month' ? (
                    <MonthYearPicker
                        value={filterMonth || undefined}
                        onChange={(v) => setFilterMonth(v ? String(v).slice(0, 7) : '')}
                        valueFormat="yyyy-MM"
                        placeholder="Pick a month"
                        className="w-48 h-9 text-sm"
                    />
                ) : null}

                {filterMode === 'year' ? (
                    <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                        <option value="">All years</option>
                        {availableYears.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                ) : null}

                {hasActiveFilter ? (
                    <button
                        type="button"
                        onClick={clearFilter}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-700"
                    >
                        <X size={12} />
                        Clear
                    </button>
                ) : null}
            </div>

            {loadingUtilities ? (
                <p className="py-12 text-center text-sm text-gray-400">Loading utilities…</p>
            ) : utilitiesByType.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">No utility bills assigned</p>
            ) : (
                utilitiesByType.map(({ type, rows }) => (
                    <div
                        key={type}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                            <h4 className="text-sm font-bold text-slate-800">{type}</h4>
                            <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                                {rows.length} utilit{rows.length === 1 ? 'y' : 'ies'}
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {rows.map((entry) => {
                                const href = `/HRM/Asset/UtilityBills/details/${encodeURIComponent(entry.id)}`;
                                const expanded = expandedEntries.has(entry.id);
                                const entryBills = billsForEntry(entry.id);
                                const totalActual = entryBills.reduce(
                                    (s, b) => s + (Number(b.amount) || 0),
                                    0,
                                );
                                const provider =
                                    formatCellValue('provider', entry.values) || 'Utility';
                                return (
                                    <div key={entry.id} className="bg-white">
                                        <div className="flex items-center gap-3 px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleEntry(entry.id)}
                                                className="flex flex-1 items-center gap-3 text-left min-w-0"
                                            >
                                                <span
                                                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                                                        expanded
                                                            ? 'bg-teal-100 text-teal-700'
                                                            : 'bg-slate-100 text-slate-400'
                                                    }`}
                                                >
                                                    <ChevronDown
                                                        size={15}
                                                        className={`transition-transform duration-200 ${
                                                            expanded ? 'rotate-0' : '-rotate-90'
                                                        }`}
                                                    />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-semibold text-slate-800 truncate">
                                                        {provider}
                                                    </span>
                                                    <span className="block text-[11px] text-slate-400 truncate">
                                                        {entry.values?.accountNumber
                                                            ? `Acc ${entry.values.accountNumber}`
                                                            : 'No account number'}
                                                        {getMonthlyRentalAmount(entry)
                                                            ? ` · Rental ${formatCellValue('monthlyRental', entry.values)}`
                                                            : ''}
                                                    </span>
                                                </span>
                                            </button>
                                            <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
                                                {entryBills.length} bill{entryBills.length === 1 ? '' : 's'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => router.push(href)}
                                                {...navHrefProps(href)}
                                                className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-semibold shrink-0"
                                            >
                                                Open <ExternalLink size={12} />
                                            </button>
                                        </div>

                                        {expanded ? (
                                            <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3">
                                                {loadingBills ? (
                                                    <p className="py-4 text-center text-xs text-slate-400">
                                                        Loading bills…
                                                    </p>
                                                ) : entryBills.length === 0 ? (
                                                    <p className="py-4 text-center text-xs text-slate-400">
                                                        {hasActiveFilter
                                                            ? 'No bills match this filter.'
                                                            : 'No bills recorded for this utility.'}
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between px-1 pb-1">
                                                            <span className="text-[11px] font-semibold text-slate-400">
                                                                {entryBills.length} bill
                                                                {entryBills.length === 1 ? '' : 's'}
                                                            </span>
                                                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                                                Total {formatBillMoney(totalActual)}
                                                            </span>
                                                        </div>
                                                        {entryBills.map((bill) => {
                                                            const contract =
                                                                Number(bill.monthlyRental) || 0;
                                                            const actual = Number(bill.amount) || 0;
                                                            const difference = contract - actual;
                                                            return (
                                                                <div
                                                                    key={bill._id}
                                                                    className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-100 bg-white px-3 py-2.5"
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-[8rem]">
                                                                        <Calendar
                                                                            size={13}
                                                                            className="text-slate-400 shrink-0"
                                                                        />
                                                                        <span className="text-xs font-bold text-slate-700">
                                                                            {monthLabelFromKey(
                                                                                billMonthKey(bill),
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <span
                                                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${billStatusBadgeClass(bill.status)}`}
                                                                    >
                                                                        {billDisplayStatus(bill)}
                                                                    </span>
                                                                    <div className="flex items-center gap-4 text-xs tabular-nums ml-auto">
                                                                        <span className="text-slate-500">
                                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                                                                                Contract
                                                                            </span>
                                                                            {formatBillMoney(contract)}
                                                                        </span>
                                                                        <span
                                                                            className={
                                                                                actual > contract
                                                                                    ? 'text-red-600'
                                                                                    : 'text-slate-700'
                                                                            }
                                                                        >
                                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                                                                                Actual
                                                                            </span>
                                                                            {formatBillMoney(actual)}
                                                                        </span>
                                                                        <span
                                                                            className={
                                                                                difference < 0
                                                                                    ? 'text-red-600'
                                                                                    : difference > 0
                                                                                      ? 'text-emerald-600'
                                                                                      : 'text-slate-400'
                                                                            }
                                                                        >
                                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                                                                                Diff
                                                                            </span>
                                                                            {formatBillMoney(difference)}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setViewBill(bill)}
                                                                        className="inline-flex items-center rounded-md bg-teal-500 hover:bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white"
                                                                    >
                                                                        View
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}

            <ViewBillModal
                isOpen={Boolean(viewBill)}
                onClose={() => setViewBill(null)}
                bill={viewBill}
            />
        </div>
    );
}
