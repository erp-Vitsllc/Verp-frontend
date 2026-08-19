'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    Clock,
    Droplets,
    PaintBucket,
    Sparkles,
    CircleDot,
    Wrench,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import VehicleAccessPageShell from '@/app/HRM/Asset/Vehicle/components/VehicleAccessPageShell';
import {
    VEHICLE_ACCESS_SERVICE_TYPES,
    vehicleAccessServiceListPath,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

const TYPE_ICONS = {
    'Oil Service': Droplets,
    'Tire Change': CircleDot,
    'Mechanical Work': Wrench,
    'Body Work': PaintBucket,
    'Accident Repair': AlertTriangle,
    'Car Wash': Sparkles,
};

export default function VehicleAccessServiceTypesPage() {
    const [counts, setCounts] = useState({});
    const [totalPending, setTotalPending] = useState(0);
    const [totalCompleted, setTotalCompleted] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-services', { skipToast: true });
            const nextCounts = res.data?.counts && typeof res.data.counts === 'object' ? res.data.counts : {};
            setCounts(nextCounts);
            const fromApi = Number(res.data?.total);
            setTotalPending(
                Number.isFinite(fromApi)
                    ? fromApi
                    : Object.values(nextCounts).reduce((sum, n) => sum + Number(n || 0), 0),
            );
            setTotalCompleted(Number(res.data?.completedTotal) || 0);
        } catch {
            setCounts({});
            setTotalPending(0);
            setTotalCompleted(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <VehicleAccessPageShell
            title="Access Service"
            subtitle="Choose a service type to list every record across the fleet"
            count={loading ? null : totalPending}
            onRefresh={load}
            refreshing={loading}
        >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
                    Vehicle service types
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {VEHICLE_ACCESS_SERVICE_TYPES.map((type) => {
                        const Icon = TYPE_ICONS[type] || Wrench;
                        const count = Number(counts[type] || 0);
                        return (
                            <Link
                                key={type}
                                href={vehicleAccessServiceListPath(type)}
                                className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 hover:border-teal-300 hover:bg-teal-50/60 transition-colors"
                            >
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200 text-teal-700 shadow-sm shrink-0">
                                    <Icon size={20} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span className="block text-sm font-black uppercase tracking-wide text-slate-800 group-hover:text-teal-800">
                                            {type}
                                        </span>
                                        {!loading && count > 0 ? (
                                            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-red-600">
                                                <Bell size={10} strokeWidth={2.5} />
                                                <span className="text-[9px] font-black tabular-nums">{count}</span>
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                        {loading
                                            ? 'Loading…'
                                            : count > 0
                                              ? `${count} pending`
                                              : 'No pending records'}
                                    </span>
                                </span>
                            </Link>
                        );
                    })}

                    <div className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200 text-teal-700 shadow-sm shrink-0">
                            <Clock size={20} />
                        </span>
                        <span className="min-w-0">
                            <span className="flex items-center gap-2">
                                <span className="block text-sm font-black uppercase tracking-wide text-slate-800">
                                    Pending Services
                                </span>
                                {!loading && totalPending > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-red-600">
                                        <Bell size={10} strokeWidth={2.5} />
                                        <span className="text-[9px] font-black tabular-nums">{totalPending}</span>
                                    </span>
                                ) : null}
                            </span>
                            <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                {loading
                                    ? 'Loading…'
                                    : totalPending > 0
                                      ? `${totalPending} pending`
                                      : 'No pending records'}
                            </span>
                        </span>
                    </div>

                    <div className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200 text-teal-700 shadow-sm shrink-0">
                            <CheckCircle2 size={20} />
                        </span>
                        <span className="min-w-0">
                            <span className="flex items-center gap-2">
                                <span className="block text-sm font-black uppercase tracking-wide text-slate-800">
                                    Completed Services
                                </span>
                                {!loading && totalCompleted > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                                        <Bell size={10} strokeWidth={2.5} />
                                        <span className="text-[9px] font-black tabular-nums">{totalCompleted}</span>
                                    </span>
                                ) : null}
                            </span>
                            <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                {loading
                                    ? 'Loading…'
                                    : totalCompleted > 0
                                      ? `${totalCompleted} completed`
                                      : 'No completed records'}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        </VehicleAccessPageShell>
    );
}
