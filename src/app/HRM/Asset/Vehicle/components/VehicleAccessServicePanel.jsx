'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    CircleDot,
    Clock,
    Droplets,
    LayoutGrid,
    PaintBucket,
    RotateCcw,
    Sparkles,
    Wrench,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import VehicleOilServiceRequestTable from '@/app/HRM/Asset/Vehicle/components/VehicleOilServiceRequestTable';
import VehicleCarWashRequestTable from '@/app/HRM/Asset/Vehicle/components/VehicleCarWashRequestTable';
import VehicleServiceTabRequestTable from '@/app/HRM/Asset/Vehicle/components/VehicleServiceTabRequestTable';
import {
    buildVehicleAccessServiceRowsFromAsset,
    buildVehicleServiceListRowHref,
    isVehicleServiceListCompletedStatus,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';
import {
    VEHICLE_ACCESS_SERVICE_COMPLETED,
    VEHICLE_ACCESS_SERVICE_PENDING,
    VEHICLE_ACCESS_SERVICE_TYPES,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

const ALL_SERVICES = 'All';

function isAccessServiceRowCompleted(row) {
    return isVehicleServiceListCompletedStatus({
        label: row?.status,
        tone: row?.statusTone,
    });
}

function filterAccessServiceRows(rows, selectedType) {
    if (selectedType === VEHICLE_ACCESS_SERVICE_PENDING) {
        return (rows || []).filter((row) => !isAccessServiceRowCompleted(row));
    }
    if (selectedType === VEHICLE_ACCESS_SERVICE_COMPLETED) {
        return (rows || []).filter((row) => isAccessServiceRowCompleted(row));
    }
    return rows || [];
}

function CountBellBadge({ count, tone = 'pending', title }) {
    const n = Number(count || 0);
    if (n <= 0) return null;
    const cls =
        tone === 'complete'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-red-100 text-red-600';
    return (
        <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${cls}`}
            title={title || (tone === 'complete' ? `${n} completed` : `${n} pending`)}
        >
            <Bell size={10} strokeWidth={2.5} />
            <span className="text-[9px] font-black tabular-nums">{n}</span>
        </span>
    );
}

const TYPE_ICONS = {
    [ALL_SERVICES]: LayoutGrid,
    'Oil Service': Droplets,
    'Tire Change': CircleDot,
    'Mechanical Work': Wrench,
    'Body Work': PaintBucket,
    'Accident Repair': AlertTriangle,
    'Car Wash': Sparkles,
};

function emptyVehiclesByType() {
    return Object.fromEntries(VEHICLE_ACCESS_SERVICE_TYPES.map((type) => [type, []]));
}

const VEHICLE_LIST_RETURN = '/HRM/Asset/Vehicle';

function ServiceTypeTable({ type, rows, onRowClick, router, listReturnHref = VEHICLE_LIST_RETURN }) {
    const tableProps = {
        rows,
        router,
        listReturnHref,
        onRowClick,
        getRowHref: (row) => buildVehicleServiceListRowHref({ ...row, serviceType: type }),
    };
    if (type === 'Oil Service') {
        return (
            <VehicleOilServiceRequestTable
                key={type}
                {...tableProps}
                emptyHint="No oil service records on the fleet yet."
            />
        );
    }
    if (type === 'Car Wash') {
        return (
            <VehicleCarWashRequestTable
                key={type}
                {...tableProps}
                emptyHint="No car wash records on the fleet yet."
            />
        );
    }
    return (
        <VehicleServiceTabRequestTable
            key={type}
            {...tableProps}
            emptyHint={`No ${type.toLowerCase()} records on the fleet yet.`}
        />
    );
}

export default function VehicleAccessServicePanel({
    selectedType = ALL_SERVICES,
    onSelectType,
    onClose,
    listReturnHref = VEHICLE_LIST_RETURN,
}) {
    const router = useRouter();
    const { toast } = useToast();

    const [counts, setCounts] = useState({});
    const [countsLoading, setCountsLoading] = useState(true);
    const [apiPendingTotal, setApiPendingTotal] = useState(0);
    const [apiCompletedTotal, setApiCompletedTotal] = useState(0);
    const [vehiclesByType, setVehiclesByType] = useState(emptyVehiclesByType);
    const [listLoading, setListLoading] = useState(false);

    const isStatusFilter =
        selectedType === VEHICLE_ACCESS_SERVICE_PENDING ||
        selectedType === VEHICLE_ACCESS_SERVICE_COMPLETED;
    const showAllTypes = !selectedType || selectedType === ALL_SERVICES;
    const loadAllTypes = showAllTypes || isStatusFilter;
    const visibleTypes = loadAllTypes ? VEHICLE_ACCESS_SERVICE_TYPES : [selectedType];

    const loadCounts = useCallback(async () => {
        setCountsLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-services', { skipToast: true });
            const nextCounts = res.data?.counts && typeof res.data.counts === 'object' ? res.data.counts : {};
            setCounts(nextCounts);
            setApiPendingTotal(
                Number.isFinite(Number(res.data?.pendingTotal))
                    ? Number(res.data.pendingTotal)
                    : Object.values(nextCounts).reduce((sum, n) => sum + Number(n || 0), 0),
            );
            setApiCompletedTotal(Number(res.data?.completedTotal) || 0);
        } catch {
            setCounts({});
            setApiPendingTotal(0);
            setApiCompletedTotal(0);
        } finally {
            setCountsLoading(false);
        }
    }, []);

    const loadServiceList = useCallback(async () => {
        const typesToLoad = loadAllTypes ? VEHICLE_ACCESS_SERVICE_TYPES : [selectedType];
        setListLoading(true);
        try {
            const results = await Promise.all(
                typesToLoad.map(async (type) => {
                    const res = await axiosInstance.get('/AssetItem/vehicle-access-services', {
                        params: { type },
                        skipToast: true,
                    });
                    return [type, Array.isArray(res.data?.items) ? res.data.items : []];
                }),
            );
            setVehiclesByType((prev) => ({
                ...prev,
                ...Object.fromEntries(results),
            }));
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not load services',
                description: error?.response?.data?.message || 'Try again in a moment.',
            });
            setVehiclesByType(emptyVehiclesByType());
        } finally {
            setListLoading(false);
        }
    }, [loadAllTypes, selectedType, toast]);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    useEffect(() => {
        loadServiceList();
    }, [loadServiceList]);

    const rowsByType = useMemo(() => {
        const next = {};
        for (const type of VEHICLE_ACCESS_SERVICE_TYPES) {
            next[type] = (vehiclesByType[type] || []).flatMap((asset) =>
                buildVehicleAccessServiceRowsFromAsset(asset, type),
            );
        }
        return next;
    }, [vehiclesByType]);

    const filteredRowsByType = useMemo(() => {
        const next = {};
        for (const type of VEHICLE_ACCESS_SERVICE_TYPES) {
            next[type] = filterAccessServiceRows(rowsByType[type] || [], selectedType);
        }
        return next;
    }, [rowsByType, selectedType]);

    const visibleRowCount = useMemo(
        () => visibleTypes.reduce((sum, type) => sum + (filteredRowsByType[type]?.length || 0), 0),
        [visibleTypes, filteredRowsByType],
    );

    const pendingCount = useMemo(
        () =>
            VEHICLE_ACCESS_SERVICE_TYPES.reduce(
                (sum, type) =>
                    sum + (rowsByType[type] || []).filter((row) => !isAccessServiceRowCompleted(row)).length,
                0,
            ),
        [rowsByType],
    );

    const completedCount = useMemo(
        () =>
            VEHICLE_ACCESS_SERVICE_TYPES.reduce(
                (sum, type) =>
                    sum + (rowsByType[type] || []).filter((row) => isAccessServiceRowCompleted(row)).length,
                0,
            ),
        [rowsByType],
    );

    const displayPendingCount = listLoading ? apiPendingTotal : pendingCount;
    const displayCompletedCount = listLoading ? apiCompletedTotal : completedCount;

    const openRow = (row) => {
        const href = buildVehicleServiceListRowHref(row);
        if (!href) return;
        navigateFromList(router, href, listReturnHref);
    };

    const handleRefresh = () => {
        loadCounts();
        loadServiceList();
    };

    const handleTypeSelect = (type) => {
        if (type === ALL_SERVICES) {
            onSelectType(ALL_SERVICES);
            return;
        }
        if (selectedType === type) {
            onSelectType(ALL_SERVICES);
            return;
        }
        onSelectType(type);
    };

    const refreshing = countsLoading || listLoading;

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
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Click a type or pending / completed to filter fleet service records
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
                    Vehicle service types
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <button
                        type="button"
                        onClick={() => handleTypeSelect(ALL_SERVICES)}
                        className={`group flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                            showAllTypes
                                ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                                : 'border-slate-200 bg-slate-50/70 hover:border-teal-300 hover:bg-teal-50/60'
                        }`}
                    >
                        <span
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm shrink-0 ${
                                showAllTypes
                                    ? 'bg-teal-600 border-teal-600 text-white'
                                    : 'bg-white border-slate-200 text-teal-700'
                            }`}
                        >
                            <LayoutGrid size={20} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-black uppercase tracking-wide text-slate-800 group-hover:text-teal-800">
                                All Services
                            </span>
                            <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                {countsLoading ? 'Loading…' : 'Show every service type'}
                            </span>
                        </span>
                    </button>

                    {VEHICLE_ACCESS_SERVICE_TYPES.map((type) => {
                        const Icon = TYPE_ICONS[type] || Wrench;
                        const count = Number(counts[type] || 0);
                        const isActive = selectedType === type;
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleTypeSelect(type)}
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
                                            {type}
                                        </span>
                                        {!countsLoading && count > 0 ? (
                                            <CountBellBadge count={count} tone="pending" />
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                        {countsLoading
                                            ? 'Loading…'
                                            : count > 0
                                              ? `${count} pending`
                                              : 'No pending records'}
                                    </span>
                                </span>
                            </button>
                        );
                    })}

                    {[
                        {
                            key: VEHICLE_ACCESS_SERVICE_PENDING,
                            label: 'Pending Services',
                            hint: displayPendingCount > 0
                                ? `${displayPendingCount} pending`
                                : 'No pending records',
                            count: displayPendingCount,
                            tone: 'pending',
                            Icon: Clock,
                        },
                        {
                            key: VEHICLE_ACCESS_SERVICE_COMPLETED,
                            label: 'Completed Services',
                            hint: displayCompletedCount > 0
                                ? `${displayCompletedCount} completed`
                                : 'No completed records',
                            count: displayCompletedCount,
                            tone: 'complete',
                            Icon: CheckCircle2,
                        },
                    ].map((box) => {
                        const Icon = box.Icon;
                        const isActive = selectedType === box.key;
                        return (
                            <button
                                key={box.key}
                                type="button"
                                onClick={() => handleTypeSelect(box.key)}
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
                                            {box.label}
                                        </span>
                                        {!countsLoading ? (
                                            <CountBellBadge count={box.count} tone={box.tone} />
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                        {countsLoading ? 'Loading…' : box.hint}
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
                        {showAllTypes
                            ? 'All service records'
                            : isStatusFilter
                              ? `${selectedType}`
                              : `${selectedType} records`}
                        {!listLoading ? (
                            <span className="ml-2 text-teal-700 tabular-nums">({visibleRowCount})</span>
                        ) : null}
                    </h3>
                </div>
                <div className="overflow-hidden">
                    {listLoading ? (
                        <div className="py-16 text-center text-sm text-slate-500">Loading service lists…</div>
                    ) : loadAllTypes ? (
                        <div className="divide-y divide-slate-100">
                            {VEHICLE_ACCESS_SERVICE_TYPES.map((type) => {
                                const rows = filteredRowsByType[type] || [];
                                if (isStatusFilter && !rows.length) return null;
                                return (
                                    <div key={type}>
                                        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-100">
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                {type}
                                                <span className="ml-2 text-teal-700 tabular-nums">({rows.length})</span>
                                            </h4>
                                        </div>
                                        <ServiceTypeTable
                                            type={type}
                                            rows={rows}
                                            onRowClick={openRow}
                                            router={router}
                                            listReturnHref={listReturnHref}
                                        />
                                    </div>
                                );
                            })}
                            {isStatusFilter && visibleRowCount === 0 ? (
                                <div className="py-16 text-center text-sm text-slate-500">
                                    {selectedType === VEHICLE_ACCESS_SERVICE_PENDING
                                        ? 'No pending services found.'
                                        : 'No completed services found.'}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <ServiceTypeTable
                            type={selectedType}
                            rows={filteredRowsByType[selectedType] || []}
                            onRowClick={openRow}
                            router={router}
                            listReturnHref={listReturnHref}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
