'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, UserCircle } from 'lucide-react';
import VehicleShopServiceHistoryViewLink from './VehicleShopServiceHistoryViewLink';
import axiosInstance from '@/utils/axios';
import {
    buildTireChangeDriverHistoryEntries,
    resolveTireChangeCarDrivenBy,
} from '../utils/vehicleTireChangeDriverHistory';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

const { card, header } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

export default function VehicleTireChangeDriverHistoryPanel({ asset, service, className = '' }) {
    const [fleetRows, setFleetRows] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    const driver = useMemo(
        () => resolveTireChangeCarDrivenBy(service, asset, employees),
        [service, asset, employees],
    );

    useEffect(() => {
        let active = true;
        setLoading(true);
        Promise.all([
            axiosInstance.get('/AssetItem/vehicle-fleet-service-requests'),
            axiosInstance.get('/employee'),
        ])
            .then(([fleetRes, empRes]) => {
                if (!active) return;
                const items = Array.isArray(fleetRes.data?.items) ? fleetRes.data.items : [];
                const list = Array.isArray(empRes.data) ? empRes.data : empRes.data?.employees || [];
                setFleetRows(items);
                setEmployees(list);
            })
            .catch(() => {
                if (active) {
                    setFleetRows([]);
                    setEmployees([]);
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const entries = useMemo(
        () =>
            buildTireChangeDriverHistoryEntries(fleetRows, driver.employeeId, {
                limit: 8,
                excludeServiceId: service?._id,
            }),
        [fleetRows, driver.employeeId, service?._id],
    );

    const title = driver.name
        ? `${driver.name} Latest Tire Change Histories`
        : 'Driver Latest Tire Change Histories';

    return (
        <div
            className={`flex w-full min-h-[300px] flex-col ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
        >
            <div
                className={`flex items-center gap-3 border-b border-gray-100 shrink-0 ${header.paddingBottomClass} ${header.marginBottomClass}`}
            >
                <div className="rounded-xl bg-violet-50 p-3.5 text-violet-600">
                    <UserCircle size={30} />
                </div>
                <div className="min-w-0">
                    <h4 className="text-lg font-bold text-gray-800 leading-snug">{title}</h4>
                    <p className="mt-1 text-sm text-gray-500">
                        Tire change services driven by this employee across all vehicles
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-500">
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Loading driver history…
                </div>
            ) : !driver.employeeId ? (
                <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-gray-500 px-4">
                    Select Car Driven By on the assignment form to see cross-vehicle tire change history.
                </p>
            ) : !entries.length ? (
                <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-gray-500 px-4">
                    No other tire change records found for this driver across the fleet.
                </p>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                    <ul className="divide-y divide-slate-100">
                        {entries.map((entry) => (
                            <li
                                key={entry.id}
                                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80 px-1 rounded-lg transition-colors"
                            >
                                <div className="min-w-0 space-y-0.5">
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                        {entry.vehicleLabel}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {entry.dateLabel}
                                        <span className="mx-1.5 text-slate-300">·</span>
                                        {entry.kmLabel}
                                    </p>
                                </div>
                                <VehicleShopServiceHistoryViewLink href={entry.detailHref} className="sm:self-center self-start" />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
