'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, ExternalLink, Receipt } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { navHrefProps } from '@/utils/linkContextMenu';
import { getAssetStatusBadgeClass } from '@/utils/assetStatusHelpers';
import {
    loadJsonArray,
    UTILITY_ENTRIES_STORAGE_KEY,
    formatCellValue,
    getMonthlyRentalAmount,
} from '@/app/HRM/Asset/UtilityBills/utils/utilityBillsStorage';

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
    const [utilityTick, setUtilityTick] = useState(0);

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

    useEffect(() => {
        if (mode === 'Vehicle') loadFleet();
    }, [mode, loadFleet]);

    useEffect(() => {
        if (mode !== 'Utility Bills') return;
        const onStorage = (e) => {
            if (!e?.key || e.key === UTILITY_ENTRIES_STORAGE_KEY) {
                setUtilityTick((t) => t + 1);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [mode]);

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
        void utilityTick;
        const empId = String(employee?._id || '');
        if (!empId) return [];
        const entries = loadJsonArray(UTILITY_ENTRIES_STORAGE_KEY).filter(
            (e) =>
                String(e.assignedToType || 'Employee') === 'Employee' &&
                String(e.assignedToId || '') === empId,
        );
        const groups = new Map();
        entries.forEach((entry) => {
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
    }, [employee?._id, utilityTick]);

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

    // Utility Bills — categorized by type
    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 text-slate-600">
                <Receipt size={18} className="text-teal-600" />
                <p className="text-sm font-medium">
                    Utility bills assigned to this employee, grouped by type
                </p>
            </div>

            {utilitiesByType.length === 0 ? (
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
                                {rows.length} record{rows.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px] table-auto">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white/60">
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600">
                                            Provider
                                        </th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600">
                                            Monthly Rental
                                        </th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600">
                                            Contract
                                        </th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600">
                                            Account
                                        </th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((entry) => {
                                        const href = `/HRM/Asset/UtilityBills/details/${encodeURIComponent(entry.id)}`;
                                        return (
                                            <tr
                                                key={entry.id}
                                                className="border-b border-slate-100 last:border-0 bg-white hover:bg-teal-50/40 cursor-pointer"
                                                {...navHrefProps(href)}
                                                onClick={() => router.push(href)}
                                            >
                                                <td className="py-2.5 px-4 text-sm text-slate-700 font-medium">
                                                    {formatCellValue('provider', entry.values) || '—'}
                                                </td>
                                                <td className="py-2.5 px-4 text-sm text-slate-600 tabular-nums">
                                                    {getMonthlyRentalAmount(entry)
                                                        ? formatCellValue('monthlyRental', entry.values)
                                                        : '—'}
                                                </td>
                                                <td className="py-2.5 px-4 text-sm text-slate-500">
                                                    {formatCellValue('contractPeriod', entry.values)}
                                                </td>
                                                <td className="py-2.5 px-4 text-sm text-slate-500">
                                                    {entry.values?.accountNumber || '—'}
                                                </td>
                                                <td
                                                    className="py-2.5 px-4 text-sm"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
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
                    </div>
                ))
            )}
        </div>
    );
}
