'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { navigateFromList } from '@/utils/listReturnNavigation';
import { navHrefProps } from '@/utils/linkContextMenu';
import VehicleAccessPageShell from '@/app/HRM/Asset/Vehicle/components/VehicleAccessPageShell';
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
import { vehicleAccessHandoverStatusFromSlug } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

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

export default function VehicleAccessHandoverStatusListPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const status = vehicleAccessHandoverStatusFromSlug(params?.status);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!status) {
            setItems([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-handovers', {
                params: { status: status.key },
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
            setLoading(false);
        }
    }, [status, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const rows = useMemo(
        () =>
            items.map((item) => {
                const vehicle = item.vehicle || {};
                return { vehicle, entry: latestHandoverEntry(vehicle, item.history) };
            }),
        [items],
    );

    const handoverHref = (vehicle, entry) => {
        const vehicleId = vehicle?._id;
        if (!vehicleId) return '';
        const assignId = entry ? resolveHandoverDeleteHistoryId(entry, vehicle, [entry]) : '';
        if (assignId) return `/HRM/Asset/Vehicle/details/${vehicleId}/assign/${assignId}`;
        return `/HRM/Asset/Vehicle/details/${vehicleId}?tab=handover`;
    };

    const openRow = (vehicle, entry) => {
        const href = handoverHref(vehicle, entry);
        if (!href) return;
        navigateFromList(router, href);
    };

    if (!status) {
        return (
            <VehicleAccessPageShell title="Handover lists" subtitle="Unknown handover status">
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                    That handover status was not found.
                </div>
            </VehicleAccessPageShell>
        );
    }

    return (
        <VehicleAccessPageShell
            title={`${status.label} Lists`}
            subtitle={status.hint}
            count={loading ? null : rows.length}
            onRefresh={load}
            refreshing={loading}
        >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-sm text-slate-500">Loading {status.label.toLowerCase()}…</div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-500">
                        No {status.label.toLowerCase()} records found.
                    </div>
                ) : (
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
                                    const href = handoverHref(vehicle, entry);
                                    return (
                                        <tr
                                            key={String(entry?._id || `${vehicle._id}-${index}`)}
                                            role="button"
                                            tabIndex={0}
                                            {...navHrefProps(href)}
                                            onClick={() => openRow(vehicle, entry)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    openRow(vehicle, entry);
                                                }
                                            }}
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
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </VehicleAccessPageShell>
    );
}
