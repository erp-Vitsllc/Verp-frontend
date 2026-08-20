'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, ClipboardList, Trash2 } from 'lucide-react';
import ListTableRowLink from '@/components/ListTableRowLink';
import { buildVehicleServiceListRowHref, formatNextChangeMonthDisplay, serviceAmountStatusBadgeClass } from './vehicleServiceUtils';import VehicleServiceRequestSortHeader from './VehicleServiceRequestSortHeader';
import {
    codeSortValue,
    dateSortValue,
    numberSortValue,
    sortServiceTableRows,
    textSortValue,
} from './vehicleServiceRequestTableSort';

const CAR_WASH_COLUMNS = [
    { key: 'slNo', label: 'SL', type: 'number' },
    { key: 'serviceReqNo', label: 'VSR-No', type: 'text' },
    { key: 'vehicleAssetNo', label: 'Vehicle asset no', type: 'text' },
    { key: 'vehicleNo', label: 'Vehicle no', type: 'text' },
    { key: 'carWashMonth', label: 'Car Wash Month', type: 'date' },
    { key: 'carWashType', label: 'Car Wash Type', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'amountType', label: 'Amount type', type: 'text' },
    { key: 'amountStatus', label: 'Amount status', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
];

function carWashSortValue(row, key) {
    switch (key) {
        case 'slNo':
        case 'amount':
            return numberSortValue(row?.[key]);
        case 'carWashMonth':
            return dateSortValue(row?.carWashMonth ? `${row.carWashMonth}-01` : null);
        case 'serviceReqNo':
        case 'vehicleAssetNo':
        case 'vehicleNo':
            return codeSortValue(row?.[key]);
        default:
            return textSortValue(row?.[key]);
    }
}

function formatAmount(value) {
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return '—';
    return `AED ${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function statusBadgeClass(tone) {
    if (tone === 'draft') return 'bg-blue-100 text-blue-800';
    if (tone === 'complete') return 'bg-emerald-100 text-emerald-800';
    if (tone === 'rejected') return 'bg-slate-100 text-slate-600';
    return 'bg-amber-100 text-amber-800';
}

export default function VehicleCarWashRequestTable({
    rows = [],
    emptyMessage = 'No car wash requests yet',
    emptyHint = 'Use Request Car Wash to add the first entry.',
    onRowClick,
    getRowHref,
    router,
    listReturnHref,
    canDelete = false,
    onDelete,
    deletingServiceId = '',
}) {
    const [sortKey, setSortKey] = useState('carWashMonth');
    const [sortDirection, setSortDirection] = useState('desc');
    const showActions = Boolean(onRowClick || router || (canDelete && onDelete));

    const handleSort = useCallback(
        (key) => {
            const column = CAR_WASH_COLUMNS.find((c) => c.key === key);
            if (!column) return;
            if (sortKey === key) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setSortKey(key);
            setSortDirection(column.type === 'date' || column.type === 'number' ? 'desc' : 'asc');
        },
        [sortKey],
    );

    const sortedRows = useMemo(() => {
        const column = CAR_WASH_COLUMNS.find((c) => c.key === sortKey) || CAR_WASH_COLUMNS[0];
        return sortServiceTableRows(rows, carWashSortValue, sortKey, sortDirection, column.type);
    }, [rows, sortKey, sortDirection]);

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
            <table className="w-full text-sm border-collapse min-w-[1040px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        {CAR_WASH_COLUMNS.map((column) => (
                            <VehicleServiceRequestSortHeader
                                key={column.key}
                                label={column.label}
                                columnKey={column.key}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                            />
                        ))}
                        {showActions ? (
                            <th className="px-4 py-3 whitespace-nowrap text-right w-24">Actions</th>
                        ) : null}
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((entry) => {
                        const serviceId = String(entry.serviceId || entry.id || '');
                        const isDeleting = deletingServiceId && deletingServiceId === serviceId;
                        const rowHref =
                            (typeof getRowHref === 'function' ? getRowHref(entry) : '') ||
                            (onRowClick || router
                                ? buildVehicleServiceListRowHref({ ...entry, serviceType: 'Car Wash' })
                                : '');
                        const isNavigable = Boolean(rowHref && router);
                        const rowElement = (
                        <tr
                            key={entry.id}
                            role={!isNavigable && onRowClick ? 'button' : undefined}
                            tabIndex={!isNavigable && onRowClick ? 0 : undefined}
                            onClick={!isNavigable && onRowClick ? () => onRowClick(entry) : undefined}
                            onKeyDown={
                                !isNavigable && onRowClick
                                    ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              onRowClick(entry);
                                          }
                                      }
                                    : undefined
                            }
                            className={`bg-white hover:bg-blue-50/60 border-b border-slate-100 transition-colors ${
                                isNavigable || onRowClick
                                    ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 group'
                                    : ''
                            }`}
                            title={isNavigable || onRowClick ? 'Click to open car wash request' : undefined}
                        >
                            <td className="px-4 py-2.5 text-slate-600 tabular-nums font-semibold">
                                {entry.slNo ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                {entry.serviceReqNo || '—'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                {entry.vehicleAssetNo || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">{entry.vehicleNo || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                                {formatNextChangeMonthDisplay(entry.carWashMonth) || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">{entry.carWashType || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-700 tabular-nums">
                                {formatAmount(entry.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap text-xs">
                                {entry.amountType || '—'}
                            </td>
                            <td className="px-4 py-2.5">
                                <span
                                    className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${serviceAmountStatusBadgeClass(entry.amountStatusTone)}`}
                                >
                                    {entry.amountStatus || '—'}
                                </span>
                            </td>
                            <td className="px-4 py-2.5">
                                <span
                                    className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(entry.statusTone)}`}
                                >
                                    {entry.status || 'Pending'}
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
                                                    onDelete(entry);
                                                }}
                                                disabled={isDeleting}
                                                className="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 disabled:opacity-50"
                                                title="Delete car wash request"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        ) : null}
                                        {isNavigable || onRowClick ? (
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

                        if (isNavigable) {
                            return (
                                <ListTableRowLink
                                    key={entry.id}
                                    href={rowHref}
                                    router={router}
                                    listReturnHref={listReturnHref}
                                >
                                    {rowElement}
                                </ListTableRowLink>
                            );
                        }

                        return rowElement;
                    })}
                </tbody>
            </table>
        </div>
    );
}
