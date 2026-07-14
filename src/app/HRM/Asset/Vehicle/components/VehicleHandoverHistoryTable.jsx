'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    buildHandoverHistoryRows,
    getHandoverByLabel,
    getHandoverEndDate,
    getHandoverHistoryStatus,
    getHandoverStartDate,
    getHandoverToLabel,
    getHandoverTypeLabel,
    resolveHandoverDeleteHistoryId,
} from '../utils/vehicleHandoverHistory';
import { navHrefProps } from '@/utils/linkContextMenu';

function formatHandoverDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

const TABLE_HEADERS = [
    { key: 'sl', label: 'Sl No.', className: 'w-16' },
    { key: 'type', label: 'Type', className: 'whitespace-nowrap' },
    { key: 'start', label: 'Start Date', className: 'whitespace-nowrap' },
    { key: 'end', label: 'End Date', className: 'whitespace-nowrap' },
    { key: 'from', label: 'From', className: 'min-w-[140px]' },
    { key: 'to', label: 'To', className: 'min-w-[140px]' },
    { key: 'status', label: 'Status', className: 'whitespace-nowrap' },
];

export default function VehicleHandoverHistoryTable({
    assetHistory = [],
    asset = null,
    loading = false,
    canDelete = false,
    onDeleted,
    onDeleteFailed,
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [deletingId, setDeletingId] = useState('');
    const rows = useMemo(
        () => buildHandoverHistoryRows(assetHistory, asset),
        [assetHistory, asset],
    );
    const showActionsColumn = canDelete;
    const columnCount = showActionsColumn ? TABLE_HEADERS.length + 1 : TABLE_HEADERS.length;

    const openAssignDetail = (entry) => {
        const vehicleId = asset?._id;
        if (!vehicleId || !entry?._id) return;
        const assignId =
            resolveHandoverDeleteHistoryId(entry, asset, assetHistory) || entry._id;
        router.push(`/HRM/Asset/Vehicle/details/${vehicleId}/assign/${assignId}`);
    };

    const handleDelete = async (entry, event) => {
        event.stopPropagation();
        event.preventDefault();

        const historyId = resolveHandoverDeleteHistoryId(entry, asset, assetHistory);
        if (!historyId || deletingId) {
            if (!historyId) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot delete',
                    description: 'This handover row is not linked to a saved history record.',
                });
            }
            return;
        }

        const typeLabel = getHandoverTypeLabel(entry, asset);
        const startDate = formatHandoverDate(getHandoverStartDate(entry));
        const handoverTo = getHandoverToLabel(entry, asset);
        const confirmed = window.confirm(
            `Delete this handover record?\n\nType: ${typeLabel}\nStart: ${startDate}\nTo: ${handoverTo}\n\nThis cannot be undone.`,
        );
        if (!confirmed) return;

        setDeletingId(String(entry._id || historyId));
        try {
            await axiosInstance.delete(`/AssetItem/history-record/${historyId}`, {
                timeout: 10000,
                skipToast: true,
            });
            onDeleted?.(historyId, entry);
            toast({
                title: 'Deleted',
                description: 'Handover record removed successfully.',
            });
        } catch (error) {
            onDeleteFailed?.(entry, historyId);
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: error.response?.data?.message || 'Could not delete this handover record.',
            });
        } finally {
            setDeletingId('');
        }
    };

    const renderHeader = () => (
        <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
            {TABLE_HEADERS.map((col) => (
                <th key={col.key} className={`px-4 py-3 ${col.className}`}>
                    {col.label}
                </th>
            ))}
            {showActionsColumn ? (
                <th className="px-4 py-3 whitespace-nowrap w-20 text-center">Delete</th>
            ) : null}
        </tr>
    );

    if (loading) {
        return (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
                <table className="w-full text-sm border-collapse min-w-[1040px]">
                    <thead className="bg-slate-50 border-b border-slate-200">{renderHeader()}</thead>
                    <tbody>
                        <tr>
                            <td colSpan={columnCount} className="px-4 py-16 text-center text-sm font-medium text-slate-500">
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
            <table className="w-full text-sm border-collapse min-w-[1040px]">
                <thead className="bg-slate-50 border-b border-slate-200">{renderHeader()}</thead>
                <tbody className="divide-y divide-slate-100">
                    {!rows.length ? (
                        <tr>
                            <td colSpan={columnCount} className="px-4 py-16 text-center text-sm text-slate-400">
                                No handover records yet
                            </td>
                        </tr>
                    ) : (
                        rows.map((entry, index) => {
                            const status = getHandoverHistoryStatus(entry, asset, { assetHistory });
                            const typeLabel = getHandoverTypeLabel(entry, asset);
                            const startDate = formatHandoverDate(getHandoverStartDate(entry));
                            const endDate = formatHandoverDate(getHandoverEndDate(entry, asset));
                            const fromLabel = getHandoverByLabel(entry, asset);
                            const toLabel = getHandoverToLabel(entry, asset);
                            const deleteHistoryId = resolveHandoverDeleteHistoryId(
                                entry,
                                asset,
                                assetHistory,
                            );
                            const canDeleteRow = Boolean(deleteHistoryId);
                            const isDeleting =
                                deletingId === String(entry._id) ||
                                (deleteHistoryId && deletingId === String(deleteHistoryId));

                            return (
                                <tr
                                    key={String(entry._id || index)}
                                    role="button"
                                    tabIndex={0}
                                    {...navHrefProps(
                                        asset?._id && entry?._id
                                            ? `/HRM/Asset/Vehicle/details/${asset._id}/assign/${
                                                resolveHandoverDeleteHistoryId(entry, asset, assetHistory) || entry._id
                                            }`
                                            : '',
                                    )}
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
                                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap font-medium">
                                        {typeLabel}
                                    </td>
                                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap">{startDate}</td>
                                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap">{endDate}</td>
                                    <td className="px-4 py-3 text-slate-800">{fromLabel}</td>
                                    <td className="px-4 py-3 text-slate-800">{toLabel}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${status.className}`}
                                        >
                                            {status.label}
                                        </span>
                                    </td>
                                    {showActionsColumn ? (
                                        <td className="px-4 py-3 text-center">
                                            {canDeleteRow ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => handleDelete(entry, event)}
                                                    disabled={isDeleting}
                                                    className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    title="Delete handover record"
                                                    aria-label="Delete handover record"
                                                >
                                                    {isDeleting ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <Trash2 size={16} />
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="text-slate-300" title="No saved handover record">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
