'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Droplet, ExternalLink } from 'lucide-react';
import { buildOilServicePreviousHistoryEntries } from '../utils/vehicleOilServicePreviousHistory';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

const { card, header } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

export default function VehicleOilServicePreviousHistoryPanel({
    asset,
    service,
    className = '',
    fillHeight = false,
}) {
    const entries = useMemo(
        () => buildOilServicePreviousHistoryEntries(asset, service?._id, { limit: 5 }),
        [asset, service?._id],
    );

    const cardHeightClass = fillHeight && card.stretchFullHeight ? 'h-full min-h-0' : '';

    return (
        <div
            className={`flex w-full flex-col ${cardHeightClass} ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
        >
            <div
                className={`flex items-center gap-3 border-b border-gray-100 shrink-0 ${header.paddingBottomClass} ${header.marginBottomClass}`}
            >
                <div className="rounded-xl bg-blue-50 p-3.5 text-blue-600">
                    <Droplet size={30} />
                </div>
                <div>
                    <h4 className="text-xl font-bold text-gray-800">Previous Oil Change History</h4>
                    <p className="mt-1 text-sm text-gray-500">Last 5 oil change services for this vehicle</p>
                </div>
            </div>

            {!entries.length ? (
                <p className="py-8 text-center text-base text-gray-500">
                    No previous oil change records on file yet.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                                <th className="whitespace-nowrap px-3 py-2.5">Oil type</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Last change date</th>
                                <th className="whitespace-nowrap px-3 py-2.5">Last km</th>
                                <th className="whitespace-nowrap px-3 py-2.5 text-right">View</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="bg-white hover:bg-slate-50/80 transition-colors">
                                    <td className="px-3 py-2.5 font-medium text-slate-800">
                                        <span>{entry.oilType}</span>
                                        {entry.isCurrent ? (
                                            <span className="ml-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                                                Current
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{entry.dateLabel}</td>
                                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700">
                                        {entry.kmLabel}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        {entry.detailHref ? (
                                            <Link
                                                href={entry.detailHref}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900"
                                            >
                                                View
                                                <ExternalLink size={12} className="opacity-70" />
                                            </Link>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
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
