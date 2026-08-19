'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Car,
    ClipboardCheck,
    ClipboardList,
    Handshake,
    UserCheck,
    UserPlus,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import VehicleAccessPageShell from '@/app/HRM/Asset/Vehicle/components/VehicleAccessPageShell';
import {
    VEHICLE_ACCESS_HANDOVER_STATUSES,
    vehicleAccessHandoverListPath,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

const STATUS_ICONS = {
    'pending-hr': UserCheck,
    'pending-inspection': ClipboardList,
    'completed-inspection': ClipboardCheck,
    'pending-assignee': UserPlus,
    'completed-handover': Handshake,
    'unassigned-vehicle': Car,
};

function countHint(status, count, loading) {
    if (loading) return 'Loading…';
    if (count <= 0) {
        return status.pending ? 'No pending records' : 'No records';
    }
    if (status.key === 'unassigned-vehicle') {
        return `${count} vehicle${count === 1 ? '' : 's'}`;
    }
    if (status.pending) {
        return `${count} pending`;
    }
    return `${count} record${count === 1 ? '' : 's'}`;
}

export default function VehicleAccessHandoverTypesPage() {
    const [counts, setCounts] = useState({});
    const [totalPending, setTotalPending] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-handovers', { skipToast: true });
            const nextCounts = res.data?.counts && typeof res.data.counts === 'object' ? res.data.counts : {};
            setCounts(nextCounts);
            const fromApi = Number(res.data?.total);
            setTotalPending(
                Number.isFinite(fromApi)
                    ? fromApi
                    : VEHICLE_ACCESS_HANDOVER_STATUSES.filter((row) => row.pending).reduce(
                          (sum, row) => sum + Number(nextCounts[row.key] || 0),
                          0,
                      ),
            );
        } catch {
            setCounts({});
            setTotalPending(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <VehicleAccessPageShell
            title="Access Handover"
            subtitle="Choose a handover status to list matching vehicles"
            count={loading ? null : totalPending}
            onRefresh={load}
            refreshing={loading}
        >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
                    Vehicle handover statuses
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {VEHICLE_ACCESS_HANDOVER_STATUSES.map((status) => {
                        const Icon = STATUS_ICONS[status.key] || Handshake;
                        const count = Number(counts[status.key] || 0);
                        return (
                            <Link
                                key={status.key}
                                href={vehicleAccessHandoverListPath(status.key)}
                                className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 hover:border-teal-300 hover:bg-teal-50/60 transition-colors"
                            >
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200 text-teal-700 shadow-sm shrink-0">
                                    <Icon size={20} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span className="block text-sm font-black uppercase tracking-wide text-slate-800 group-hover:text-teal-800">
                                            {status.label}
                                        </span>
                                        {!loading && count > 0 ? (
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
                                        {countHint(status, count, loading)}
                                    </span>
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </VehicleAccessPageShell>
    );
}
