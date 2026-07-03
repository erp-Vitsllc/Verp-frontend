'use client';

import { ChevronRight, ClipboardList, Trash2 } from 'lucide-react';

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return '—';
    }
}

function formatKm(value) {
    if (value == null || value === '' || value === '—') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `${n.toLocaleString()} km`;
}

function statusBadgeClass(tone) {
    if (tone === 'draft') return 'bg-blue-100 text-blue-800';
    if (tone === 'complete') return 'bg-emerald-100 text-emerald-800';
    if (tone === 'scheduled') return 'bg-violet-100 text-violet-800';
    if (tone === 'rejected') return 'bg-slate-100 text-slate-600';
    return 'bg-amber-100 text-amber-800';
}

export default function VehicleServiceTabRequestTable({
    rows = [],
    emptyMessage = 'No service requests yet',
    emptyHint = 'Use Request to add a pending line.',
    onRowClick,
    canDelete = false,
    onDelete,
    deletingServiceId = '',
}) {
    const showActions = Boolean(onRowClick || (canDelete && onDelete));
    if (!rows.length) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <ClipboardList className="text-slate-300 mb-3" size={44} />
                <p className="text-sm font-semibold text-slate-600">{emptyMessage}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">{emptyHint}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[720px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3 whitespace-nowrap">Vehicle asset no</th>
                        <th className="px-4 py-3 whitespace-nowrap">Vehicle no</th>
                        <th className="px-4 py-3 whitespace-nowrap">Request date</th>
                        <th className="px-4 py-3 whitespace-nowrap">Current km</th>
                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                        {showActions ? (
                            <th className="px-4 py-3 whitespace-nowrap text-right w-24">Actions</th>
                        ) : null}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const serviceId = String(row.serviceId || row.id || '');
                        const isDeleting = deletingServiceId && deletingServiceId === serviceId;
                        return (
                            <tr
                                key={row.id}
                                role={onRowClick ? 'button' : undefined}
                                tabIndex={onRowClick ? 0 : undefined}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                onKeyDown={
                                    onRowClick
                                        ? (e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault();
                                                  onRowClick(row);
                                              }
                                          }
                                        : undefined
                                }
                                className={`bg-white hover:bg-blue-50/60 border-b border-slate-100 transition-colors ${
                                    onRowClick
                                        ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 group'
                                        : ''
                                }`}
                                title={onRowClick ? 'Click to open service request' : undefined}
                            >
                                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                    {row.vehicleAssetNo || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-700">{row.vehicleNo || '—'}</td>
                                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                                    {formatDate(row.requestDate)}
                                </td>
                                <td className="px-4 py-2.5 text-slate-700 tabular-nums">
                                    {formatKm(row.currentKm)}
                                </td>
                                <td className="px-4 py-2.5">
                                    <span
                                        className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(row.statusTone)}`}
                                    >
                                        {row.status || 'Pending'}
                                    </span>
                                </td>
                                {showActions ? (
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="inline-flex items-center justify-end gap-1">
                                            {canDelete && onDelete ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(row);
                                                    }}
                                                    disabled={isDeleting}
                                                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 disabled:opacity-50"
                                                    title="Delete service request"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            ) : null}
                                            {onRowClick ? (
                                                <ChevronRight
                                                    size={16}
                                                    className="inline-block text-slate-300 transition-colors group-hover:text-blue-500"
                                                    aria-hidden
                                                />
                                            ) : null}
                                        </div>
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
