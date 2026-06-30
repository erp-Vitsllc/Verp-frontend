'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    buildHandoverHistoryRows,
    getHandoverByLabel,
    getHandoverHistoryStatus,
    getHandoverReason,
    getHandoverToLabel,
} from '../utils/vehicleHandoverHistory';

function formatHandoverDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export default function VehicleHandoverHistoryTable({
    assetHistory = [],
    asset = null,
    loading = false,
}) {
    const router = useRouter();
    const rows = useMemo(
        () => buildHandoverHistoryRows(assetHistory, asset),
        [assetHistory, asset],
    );

    const openAssignDetail = (entry) => {
        const vehicleId = asset?._id;
        const assignId = entry?._id;
        if (!vehicleId || !assignId) return;
        router.push(`/HRM/Asset/Vehicle/details/${vehicleId}/assign/${assignId}`);
    };

    if (loading) {
        return (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
                <table className="w-full text-sm border-collapse min-w-[960px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-3 whitespace-nowrap w-16">Sl No.</th>
                            <th className="px-4 py-3 whitespace-nowrap">Handover Date</th>
                            <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Handover By</th>
                            <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Handover To</th>
                            <th className="px-4 py-3 min-w-[180px]">Reason</th>
                            <th className="px-4 py-3 whitespace-nowrap">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colSpan={6} className="px-4 py-16 text-center text-sm font-medium text-slate-500">
                                Loading handover history…
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-sm border-collapse min-w-[960px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3 whitespace-nowrap w-16">Sl No.</th>
                        <th className="px-4 py-3 whitespace-nowrap">Handover Date</th>
                        <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Handover By</th>
                        <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Handover To</th>
                        <th className="px-4 py-3 min-w-[180px]">Reason</th>
                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {!rows.length ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                                No handover records yet
                            </td>
                        </tr>
                    ) : (
                        rows.map((entry, index) => {
                            const status = getHandoverHistoryStatus(entry, asset);
                            const reason = getHandoverReason(entry, asset);

                            return (
                                <tr
                                    key={String(entry._id || index)}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openAssignDetail(entry)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            openAssignDetail(entry);
                                        }
                                    }}
                                    className="cursor-pointer hover:bg-slate-50/70 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
                                    title="Open handover details"
                                >
                                    <td className="px-4 py-3 text-slate-600 font-semibold">{index + 1}</td>
                                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                                        {formatHandoverDate(entry?.date || entry?.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-800">{getHandoverByLabel(entry, asset)}</td>
                                    <td className="px-4 py-3 text-slate-800">{getHandoverToLabel(entry, asset)}</td>
                                    <td className="px-4 py-3 text-slate-600 max-w-[280px]">
                                        <span className="line-clamp-2" title={reason !== '-' ? reason : undefined}>
                                            {reason}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${status.className}`}
                                        >
                                            {status.label}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
