'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import ListTableRowLink from '@/components/ListTableRowLink';
import EmployeeNameLink from '@/components/EmployeeNameLink';
import { useToast } from '@/hooks/use-toast';
import ViewBillModal from './ViewBillModal';
import { fetchUtilityBillById } from '../utils/utilityBillsApi';
import {
    filterSummaryRows,
    formatSummaryMoney,
    summaryStatusBadgeClass,
} from '../utils/utilityBillSummary';

function differenceClass(difference) {
    if (difference == null || !Number.isFinite(Number(difference))) return 'text-gray-400';
    if (difference < 0) return 'text-red-600';
    if (difference > 0) return 'text-emerald-600';
    return 'text-gray-700';
}

export default function UtilityBillSummaryTable({
    rows = [],
    searchQuery = '',
    utilityType = '',
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [viewBill, setViewBill] = useState(null);
    const [loadingBillId, setLoadingBillId] = useState('');

    const displayed = useMemo(
        () => filterSummaryRows(rows, searchQuery),
        [rows, searchQuery],
    );

    const openViewBill = async (row, event) => {
        event?.stopPropagation?.();
        const billId = String(row?.billId || '').trim();
        if (!billId) return;
        if (loadingBillId) return;
        setLoadingBillId(billId);
        try {
            const bill = await fetchUtilityBillById(billId);
            if (!bill) {
                toast({
                    variant: 'destructive',
                    title: 'Bill not found',
                    description: 'This bill could not be loaded.',
                });
                return;
            }
            setViewBill(bill);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not open bill',
                description: err?.response?.data?.message || 'Please try again.',
            });
        } finally {
            setLoadingBillId('');
        }
    };

    if (!rows.length) {
        return (
            <div className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                No {utilityType || 'utility'} summary rows for this period.
            </div>
        );
    }

    if (!displayed.length) {
        return (
            <div className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                No {utilityType || 'utility'} rows match “{String(searchQuery || '').trim()}”.
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[860px] table-auto text-xs sm:text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {[
                                'Month',
                                'Number',
                                'Assignee',
                                'Contract Amount',
                                'Bill Amount',
                                'Difference',
                                'Status',
                                'View Bill',
                            ].map((label) => (
                                <th
                                    key={label}
                                    className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                                        label === 'View Bill' ? 'text-right' : 'text-left'
                                    }`}
                                >
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {displayed.map((row) => (
                            <ListTableRowLink
                                key={row.key}
                                href={row.href}
                                router={router}
                                listReturnHref="/HRM/Asset/UtilityBills"
                            >
                                <tr className="cursor-pointer bg-white transition-colors hover:bg-blue-50/50">
                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                        {row.monthLabel}
                                    </td>
                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 tabular-nums">
                                        {row.accountNo || '—'}
                                    </td>
                                    <td
                                        className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {row.assigneeName ? (
                                            row.assignedToType === 'Employee' && row.assignedToId ? (
                                                <EmployeeNameLink
                                                    employeeId={row.assignedToId}
                                                    name={row.assigneeName}
                                                    className="max-w-[160px] truncate text-xs sm:text-sm font-medium"
                                                    title={row.assigneeName}
                                                />
                                            ) : (
                                                <span
                                                    className="max-w-[160px] truncate text-xs sm:text-sm text-gray-700"
                                                    title={row.assigneeName}
                                                >
                                                    {row.assigneeName}
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-xs sm:text-sm text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-700 tabular-nums">
                                        {formatSummaryMoney(row.contractAmount)}
                                    </td>
                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-semibold text-gray-700 tabular-nums">
                                        {row.billId ? formatSummaryMoney(row.billAmount) : '—'}
                                    </td>
                                    <td
                                        className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-semibold tabular-nums ${differenceClass(row.difference)}`}
                                    >
                                        {row.billId ? formatSummaryMoney(row.difference) : '—'}
                                    </td>
                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${summaryStatusBadgeClass(row.status)}`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-right">
                                        {row.billId ? (
                                            <button
                                                type="button"
                                                onClick={(e) => openViewBill(row, e)}
                                                disabled={loadingBillId === row.billId}
                                                className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                                            >
                                                <Eye size={13} />
                                                {loadingBillId === row.billId ? 'Opening…' : 'View'}
                                            </button>
                                        ) : (
                                            <span className="text-xs sm:text-sm text-gray-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            </ListTableRowLink>
                        ))}
                    </tbody>
                </table>
            </div>

            <ViewBillModal
                isOpen={Boolean(viewBill)}
                bill={viewBill}
                onClose={() => setViewBill(null)}
            />
        </>
    );
}
