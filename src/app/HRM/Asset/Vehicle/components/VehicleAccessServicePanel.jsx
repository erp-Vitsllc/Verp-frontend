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

    const emptyMessage =
        statusFilter === VEHICLE_ACCESS_SERVICE_PENDING
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
                        All fleet service records — filter by status or vehicles with no completed service
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
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
                        {filterTitle}
                        {!listLoading ? (
                            <span className="ml-2 text-teal-700 tabular-nums">({visibleRows.length})</span>
                        ) : null}
                    </h3>
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
                <div className="overflow-hidden">
                    {listLoading ? (
                        <div className="py-16 text-center text-sm text-slate-500">Loading service lists…</div>
                    ) : (
                        <VehicleAccessServiceListTable
                            rows={visibleRows}
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
