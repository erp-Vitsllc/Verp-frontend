'use client';

import { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    buildVehicleHandoverAssignGridFields,
    HANDOVER_ASSIGN_GRID_ACCENTS,
    HANDOVER_ASSIGN_GRID_LAYOUT,
} from '../utils/vehicleHandoverAssignGrid';
import { isVehicleInspectionHandoverEntry } from '../utils/vehicleHandoverHistory';

function HandoverFieldBox({ label, value, accentClass, minHeightPx }) {
    return (
        <div
            className={`flex flex-col justify-center rounded-lg border px-3 py-2.5 ${accentClass}`}
            style={{ minHeight: `${minHeightPx}px` }}
        >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
            <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
                {value || '—'}
            </span>
        </div>
    );
}

export default function VehicleHandoverAssignGrid({ historyEntry, vehicle, assetHistory = [] }) {
    const fields = useMemo(
        () => buildVehicleHandoverAssignGridFields(historyEntry, vehicle, { assetHistory }),
        [historyEntry, vehicle, assetHistory],
    );

    const isInspection = isVehicleInspectionHandoverEntry(historyEntry, vehicle);
    const { fieldMinHeightPx, gapClass } = HANDOVER_ASSIGN_GRID_LAYOUT;

    return (
        <div className="flex h-full w-full">
            <FineFormCard
                title={isInspection ? 'Vehicle Inspection Handover' : 'Handover Assignment Details'}
                subtitle={
                    isInspection
                        ? 'Handover by, handover to, and inspection request'
                        : 'Vehicle, ownership, and basic information'
                }
                icon={ClipboardList}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                className="h-full w-full"
            >
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                    {fields.map((field, index) => (
                        <HandoverFieldBox
                            key={field.label}
                            label={field.label}
                            value={field.value}
                            minHeightPx={fieldMinHeightPx}
                            accentClass={HANDOVER_ASSIGN_GRID_ACCENTS[index % HANDOVER_ASSIGN_GRID_ACCENTS.length]}
                        />
                    ))}
                </div>
            </FineFormCard>
        </div>
    );
}
