'use client';

import Link from 'next/link';
import { ClipboardList, Download, ExternalLink, Trash2 } from 'lucide-react';
import { normalizeMongoId, resolveVehicleServiceListRowTone, vehicleServiceListRowClassName } from './vehicleServiceUtils';

export function vehicleServiceRowKey(row) {
    return `${normalizeMongoId(row.vehicleId)}::${normalizeMongoId(row.serviceId)}`;
}

export default function VehicleServiceRecordsTable({
    rows = [],
    loading = false,
    onRowClick,
    hideVehicleColumn = false,
    hideTypeColumn = false,
    canDelete = false,
    canDeleteRow,
    onDelete,
    onSubmitDraft,
    deletingKey = '',
    submittingKey = '',
    emptyMessage = 'No service records yet',
    emptyHint = 'Add a service request to see entries here.',
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <p className="text-sm font-medium text-slate-500">Loading…</p>
            </div>
        );
    }

    if (!rows.length) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <ClipboardList className="text-slate-300 mb-3" size={44} />
                <p className="text-sm font-semibold text-slate-600">{emptyMessage}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">{emptyHint}</p>
            </div>
        );
    }

    const showActions = Boolean(onSubmitDraft || (canDelete && onDelete) || (canDeleteRow && onDelete));

    return (
        <div className="overflow-x-auto">
            <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                    Click a row to open the service request details page with service details and progress tracker.
                </span>
                <span className="inline-flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-5 rounded-sm bg-amber-50 border border-amber-200" />
                        On working
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-5 rounded-sm bg-white border border-slate-200" />
                        Service done
                    </span>
                </span>
            </p>
            <table className="w-full text-sm border-collapse min-w-[720px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="px-2 py-3 w-10" aria-label="Expand" />
                        <th className="px-4 py-3 whitespace-nowrap">Sl.</th>
                        {!hideTypeColumn ? <th className="px-4 py-3 whitespace-nowrap">Type</th> : null}
                        {!hideVehicleColumn ? (
                            <th className="px-4 py-3 min-w-[140px]">Vehicle</th>
                        ) : null}
                        <th className="px-4 py-3 whitespace-nowrap">SL No.</th>
                        <th className="px-4 py-3 whitespace-nowrap">ID</th>
                        <th className="px-4 py-3 whitespace-nowrap">Date</th>
                        <th className="px-4 py-3 whitespace-nowrap">Value</th>
                        <th className="px-4 py-3 whitespace-nowrap">Request status</th>
                        <th className="px-4 py-3 min-w-[200px]">Attachments</th>
                        {showActions ? (
                            <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                        ) : null}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const rk = vehicleServiceRowKey(row);
                        const rowTone = row.rowTone || resolveVehicleServiceListRowTone(row);
                        return (
                            <tr
                                key={rk}
                                role="button"
                                tabIndex={0}
                                onClick={() => onRowClick?.(row)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onRowClick?.(row);
                                    }
                                }}
                                className={`transition-colors cursor-pointer ${vehicleServiceListRowClassName(rowTone)}`}
                            >
                                <td className="px-2 py-2.5 align-middle" />
                                <td className="px-4 py-2.5 text-slate-600 tabular-nums">{idx + 1}</td>
                                {!hideTypeColumn ? (
                                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                                        {row.serviceType || '—'}
                                    </td>
                                ) : null}
                                {!hideVehicleColumn ? (
                                    <td className="px-4 py-2.5">
                                        <Link
                                            href={`/HRM/Asset/Vehicle/details/${row.vehicleId}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-medium hover:underline"
                                        >
                                            <span className="truncate max-w-[220px]">{row.vehicleLabel || '—'}</span>
                                            <ExternalLink size={12} className="shrink-0 opacity-70" />
                                        </Link>
                                    </td>
                                ) : null}
                                <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">
                                    {row.vehicleAssetId || '—'}
                                </td>
                                <td
                                    className="px-4 py-2.5 text-slate-500 font-mono text-[11px] max-w-[140px] truncate"
                                    title={row.serviceId ? String(row.serviceId) : ''}
                                >
                                    {row.serviceId ? String(row.serviceId) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                                    {row.date
                                        ? new Date(row.date).toLocaleDateString(undefined, {
                                              year: 'numeric',
                                              month: 'short',
                                              day: 'numeric',
                                          })
                                        : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-800 font-semibold tabular-nums">
                                    {row.value != null && Number(row.value) !== 0
                                        ? `AED ${Number(row.value).toLocaleString()}`
                                        : row.value === 0
                                          ? 'AED 0'
                                          : '—'}
                                </td>
                                <td className="px-4 py-2.5">
                                    <span
                                        className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                            String(row.requestStatus || '').toLowerCase() === 'draft'
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                    >
                                        {String(row.requestStatus || '').toLowerCase() === 'draft'
                                            ? 'Draft'
                                            : 'Submitted'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                                        {row.attachment ? (
                                            <a
                                                href={row.attachment}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                                            >
                                                <Download size={10} /> Q1
                                            </a>
                                        ) : null}
                                        {row.quotation2 ? (
                                            <a
                                                href={row.quotation2}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                                            >
                                                <Download size={10} /> Q2
                                            </a>
                                        ) : null}
                                        {row.quotation3 ? (
                                            <a
                                                href={row.quotation3}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                                            >
                                                <Download size={10} /> Q3
                                            </a>
                                        ) : null}
                                        {row.invoice ? (
                                            <a
                                                href={row.invoice}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-900 text-[10px] font-bold text-white hover:bg-slate-800"
                                            >
                                                <Download size={10} /> Inv
                                            </a>
                                        ) : null}
                                        {!row.attachment && !row.quotation2 && !row.quotation3 && !row.invoice ? (
                                            <span className="text-slate-300 text-xs">—</span>
                                        ) : null}
                                    </div>
                                </td>
                                {showActions ? (
                                    <td className="px-4 py-2.5 text-right">
                                        {String(row.requestStatus || '').toLowerCase() === 'draft' && onSubmitDraft ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSubmitDraft(row);
                                                }}
                                                disabled={submittingKey === rk}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 mr-2 rounded-md border border-teal-200 bg-teal-50 text-teal-700 text-[11px] font-bold hover:bg-teal-100 disabled:opacity-50"
                                            >
                                                {submittingKey === rk ? 'Submitting...' : 'Submit'}
                                            </button>
                                        ) : null}
                                        {(() => {
                                            const rowCanDelete =
                                                typeof canDeleteRow === 'function'
                                                    ? canDeleteRow(row)
                                                    : canDelete;
                                            return rowCanDelete && onDelete ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(row);
                                                }}
                                                disabled={deletingKey === rk}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 text-[11px] font-bold hover:bg-red-100 disabled:opacity-50"
                                                title="Delete service request"
                                            >
                                                <Trash2 size={12} />
                                                {deletingKey === rk ? 'Deleting...' : 'Delete'}
                                            </button>
                                            ) : null;
                                        })()}
                                    </td>
                                ) : null}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
