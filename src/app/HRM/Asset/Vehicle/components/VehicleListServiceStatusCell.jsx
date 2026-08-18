'use client';

import { resolveVehicleListServiceStatusLabel } from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';

/**
 * Fleet list Service Status — Pending while a service is running, Completed after.
 */
export default function VehicleListServiceStatusCell({ vehicle }) {
    const label = resolveVehicleListServiceStatusLabel(vehicle);
    if (!label) {
        return <span className="text-gray-300">—</span>;
    }

    const isPending = label === 'Pending';
    return (
        <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${
                isPending
                    ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
                    : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
            }`}
            title={label}
        >
            {label}
        </span>
    );
}
