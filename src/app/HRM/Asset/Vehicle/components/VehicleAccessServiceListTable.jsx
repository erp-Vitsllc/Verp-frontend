'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, ClipboardList } from 'lucide-react';
import ListTableRowLink from '@/components/ListTableRowLink';
import { buildVehicleServiceListRowHref, serviceBillStatusBadgeClass, vehicleServiceStatusBadgeClass } from './vehicleServiceUtils';
import VehicleServiceRequestSortHeader from './VehicleServiceRequestSortHeader';
import {
    codeSortValue,
    numberSortValue,
    sortServiceTableRows,
    textSortValue,
} from './vehicleServiceRequestTableSort';

const ACCESS_SERVICE_COLUMNS = [
    { key: 'slNo', label: 'SL', type: 'number' },
    { key: 'serviceReqNo', label: 'VSRNO', type: 'text' },
    { key: 'vehicleNo', label: 'Vehicle Number', type: 'text' },
    { key: 'currentKm', label: 'Current KM', type: 'number' },
    { key: 'amountType', label: 'Amount Type', type: 'text' },
    { key: 'serviceType', label: 'Service Type', type: 'text' },
    { key: 'serviceStatus', label: 'Service Status', type: 'text' },
    { key: 'billStatus', label: 'Bill Status', type: 'text' },
];

function accessServiceSortValue(row, key) {
    switch (key) {
        case 'slNo':
        case 'currentKm':
            return numberSortValue(row?.[key]);
        case 'serviceReqNo':
        case 'vehicleNo':
            return codeSortValue(row?.[key]);
        default:
            return textSortValue(row?.[key]);
    }
}

function formatKm(value) {
    if (value == null || value === '' || value === '—') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `${n.toLocaleString()} km`;
}

export default function VehicleAccessServiceListTable({
    rows = [],
    emptyMessage = 'No service records found.',
    emptyHint = 'Fleet service requests will appear here.',
    onRowClick,
    getRowHref,
    router,
    listReturnHref,
}) {
    const [sortKey, setSortKey] = useState('serviceReqNo');
    const [sortDirection, setSortDirection] = useState('desc');
    const showActions = Boolean(onRowClick || router);

    const handleSort = useCallback(
        (key) => {
            const column = ACCESS_SERVICE_COLUMNS.find((c) => c.key === key);
            if (!column) return;
            if (sortKey === key) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setSortKey(key);
            setSortDirection(column.type === 'number' ? 'desc' : 'asc');
        },
        [sortKey],
    );

    const sortedRows = useMemo(() => {
        const column = ACCESS_SERVICE_COLUMNS.find((c) => c.key === sortKey) || ACCESS_SERVICE_COLUMNS[0];
        return sortServiceTableRows(rows, accessServiceSortValue, sortKey, sortDirection, column.type);
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
            <table className="w-full text-sm border-collapse min-w-[880px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                        {ACCESS_SERVICE_COLUMNS.map((column) => (
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
                            <th className="px-4 py-3 whitespace-nowrap text-right w-16">Actions</th>
                        ) : null}
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((entry) => {
                        const rowHref =
                            (typeof getRowHref === 'function' ? getRowHref(entry) : '') ||
                            (onRowClick || router ? buildVehicleServiceListRowHref(entry) : '');
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
                                title={
                                    isNavigable || onRowClick
                                        ? entry.isNotYet
                                            ? 'Click to open vehicle Service tab'
                                            : 'Click to open service request'
                                        : undefined
                                }
                            >
                                <td className="px-4 py-2.5 text-slate-600 tabular-nums font-semibold">
                                    {entry.slNo ?? '—'}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                                    {entry.serviceReqNo || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-700">{entry.vehicleNo || '—'}</td>
                                <td className="px-4 py-2.5 text-slate-700 tabular-nums">
                                    {formatKm(entry.currentKm)}
                                </td>
                                <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap text-xs">
                                    {entry.amountType || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-800 font-semibold whitespace-nowrap">
                                    {entry.serviceType || '—'}
                                </td>
                                <td className="px-4 py-2.5">
                                    <span
                                        className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${vehicleServiceStatusBadgeClass(entry.serviceStatusTone || entry.statusTone)}`}
                                    >
                                        {entry.serviceStatus || entry.status || '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span
                                        className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold normal-case tracking-normal max-w-[220px] text-left leading-snug ${serviceBillStatusBadgeClass(entry.billStatusTone || entry.amountStatusTone)}`}
                                    >
                                        {entry.billStatus || entry.amountStatus || '—'}
                                    </span>
                                </td>
                                {showActions ? (
                                    <td className="px-4 py-2.5 text-right">
                                        {isNavigable || onRowClick ? (
                                            <ChevronRight
                                                size={16}
                                                className="inline-block text-slate-300 transition-colors group-hover:text-blue-500"
                                                aria-hidden
                                            />
                                        ) : null}
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
