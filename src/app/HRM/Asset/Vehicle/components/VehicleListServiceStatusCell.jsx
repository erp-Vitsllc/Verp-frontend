'use client';

import {
    resolveVehicleListPendingServiceCount,
    resolveVehicleListServiceStatusLabel,
} from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';

/**
 * Fleet list Service Status — Pending while a service is running, Completed after.
 */
export default function VehicleListServiceStatusCell({ vehicle }) {
    const label = resolveVehicleListServiceStatusLabel(vehicle);
    if (!label) {
        return <span className="text-gray-300">—</span>;
    }

    const isPending = label === 'Pending';
    const pendingCount = isPending ? resolveVehicleListPendingServiceCount(vehicle) : 0;
    const title =
        isPending && pendingCount > 0
            ? `${label} — ${pendingCount} pending service${pendingCount === 1 ? '' : 's'}`
            : label;

    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${isPending
                    ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
                    : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                }`}
            title={title}
        >
            {label}
            {pendingCount > 0 ? (
                <span
                    className="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-black leading-none text-white tabular-nums border-2 border-white shadow-sm"
                    aria-label={`${pendingCount} pending services`}
                >
                    {pendingCount}
                </span>
            ) : null}
        </span>
    );
}
