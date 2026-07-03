'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    OIL_SERVICE_DETAIL_GRID_ACCENTS,
    OIL_SERVICE_DETAIL_GRID_LAYOUT,
    buildOilServiceDetailGridFields,
} from '../utils/vehicleOilServiceDetailGrid';

function DetailFieldBox({ label, value, accentClass, minHeightPx }) {
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

export default function VehicleOilServiceDetailGrid({ asset, service, scheduleRow }) {
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        let active = true;
        axiosInstance
            .get('/employee')
            .then(({ data }) => {
                if (!active) return;
                const list = Array.isArray(data) ? data : data?.employees || [];
                setEmployees(list);
            })
            .catch(() => {
                if (active) setEmployees([]);
            });
        return () => {
            active = false;
        };
    }, []);

    const { fields, workDescription } = useMemo(
        () => buildOilServiceDetailGridFields(asset, service, scheduleRow, employees),
        [asset, employees, scheduleRow, service],
    );

    const { fieldMinHeightPx, gapClass } = OIL_SERVICE_DETAIL_GRID_LAYOUT;

    return (
        <div className="flex h-full w-full">
            <FineFormCard
                title="Oil Service Assignment Details"
                subtitle="Vehicle, schedule, and service request information"
                icon={ClipboardList}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                className="w-full h-full"
            >
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                    {fields.map((field, index) => (
                        <DetailFieldBox
                            key={field.label}
                            label={field.label}
                            value={field.value}
                            minHeightPx={fieldMinHeightPx}
                            accentClass={OIL_SERVICE_DETAIL_GRID_ACCENTS[index % OIL_SERVICE_DETAIL_GRID_ACCENTS.length]}
                        />
                    ))}
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Work Description
                    </span>
                    <p className="mt-1 text-sm font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {workDescription || '—'}
                    </p>
                </div>
            </FineFormCard>
        </div>
    );
}
