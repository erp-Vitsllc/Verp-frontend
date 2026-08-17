'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
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
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AssetItem/vehicle-access-services', { skipToast: true });
            setCounts(res.data?.counts && typeof res.data.counts === 'object' ? res.data.counts : {});
        } catch {
            setCounts({});
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
                                    <span className="block text-sm font-black uppercase tracking-wide text-slate-800 group-hover:text-teal-800">
                                        {type}
                                    </span>
                                    <span className="block text-xs text-slate-500 mt-1 tabular-nums">
                                        {loading ? 'Loading…' : `${count} record${count === 1 ? '' : 's'}`}
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
