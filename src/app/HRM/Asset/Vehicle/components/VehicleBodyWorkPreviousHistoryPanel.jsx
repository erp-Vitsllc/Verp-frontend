'use client';

import { useMemo } from 'react';
import { CircleDot } from 'lucide-react';
import { buildBodyWorkPreviousHistoryEntries } from '../utils/vehicleBodyWorkPreviousHistory';
import VehicleShopServiceHistoryViewLink from './VehicleShopServiceHistoryViewLink';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

const { card, header } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

export default function VehicleBodyWorkPreviousHistoryPanel({ asset, service, className = '' }) {
    const entries = useMemo(
        () => buildBodyWorkPreviousHistoryEntries(asset, service?._id, { limit: 5 }),
        [asset, service?._id],
    );

    return (
        <div
            className={`flex w-full min-h-[320px] flex-col ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
        >
            <div
                className={`flex items-center gap-3 border-b border-gray-100 shrink-0 ${header.paddingBottomClass} ${header.marginBottomClass}`}
            >
                <div className="rounded-xl bg-blue-50 p-3.5 text-blue-600">
                    <CircleDot size={30} />
                </div>
                <div>
                    <h4 className="text-xl font-bold text-gray-800">Previous Body Work History</h4>
                    <p className="mt-1 text-sm text-gray-500">Last 5 body work services for this vehicle</p>
                </div>
            </div>

            {!entries.length ? (
                <div className="flex flex-1 items-center justify-center py-10">
                    <p className="text-center text-base text-gray-500 px-4">
                        No previous body work records on file yet.
                    </p>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto pr-1">
                    <table className="w-full min-w-[320px] border-collapse text-sm">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                            <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                                <th className="whitespace-nowrap px-3 py-2.5">Last change date</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Last km</th>
                                <th className="whitespace-nowrap px-3 py-2.5 text-right">View</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="bg-white hover:bg-slate-50/80 transition-colors">
                                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{entry.dateLabel}</td>
                                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">
                                        {entry.kmLabel}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-right min-w-[88px]">
                                        <VehicleShopServiceHistoryViewLink href={entry.detailHref} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
