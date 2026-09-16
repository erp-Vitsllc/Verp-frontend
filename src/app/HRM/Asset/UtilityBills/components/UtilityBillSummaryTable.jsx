'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ViewBillModal from './ViewBillModal';
import { fetchUtilityBillById } from '../utils/utilityBillsApi';
import {
    filterSummaryRows,
    formatSummaryMoney,
    SUMMARY_STATUS,
    summaryStatusBadgeClass,
} from '../utils/utilityBillSummary';

const MONTH_COLUMNS = [
    { key: 'monthKey', label: 'Month', type: 'string' },
    { key: 'billCount', label: 'Bill', type: 'number' },
    { key: 'contractAmount', label: 'Contract Amount', type: 'number' },
    { key: 'billAmount', label: 'Bill Amount', type: 'number' },
    { key: 'difference', label: 'Difference', type: 'number' },
];

const BILL_COLUMNS = [
    { key: 'accountNo', label: 'Account No', type: 'string' },
    { key: 'assigneeName', label: 'Assigned', type: 'string' },
    { key: 'contractAmount', label: 'Contract Amount', type: 'number' },
    { key: 'billAmount', label: 'Bill Amount', type: 'number' },
    { key: 'difference', label: 'Difference', type: 'number' },
    { key: 'status', label: 'Status', type: 'string' },
];

function differenceClass(difference) {
    if (difference == null || !Number.isFinite(Number(difference))) return 'text-gray-400';
    if (difference < 0) return 'text-red-600';
    if (difference > 0) return 'text-emerald-600';
    return 'text-gray-700';
}

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${summaryStatusBadgeClass(status)}`}
        >
            {status}
        </span>
    );
}

function getSortValue(row, key, type) {
    const raw = row?.[key];
    if (type === 'number') {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }
    return String(raw ?? '')
        .trim()
        .toLowerCase();
}

const SUMMARY_STATUS_SORT_ORDER = {
    [SUMMARY_STATUS.NOT_PAID]: 0,
    [SUMMARY_STATUS.PAID]: 1,
    [SUMMARY_STATUS.NOT_UPDATED]: 2,
};

function compareSortValues(a, b, key, type, direction) {
    const aVal = getSortValue(a, key, type);
    const bVal = getSortValue(b, key, type);
    const dir = direction === 'desc' ? -1 : 1;

    if (key === 'status') {
        const aRank = SUMMARY_STATUS_SORT_ORDER[String(aVal || '').toLowerCase()] ?? 99;
        const bRank = SUMMARY_STATUS_SORT_ORDER[String(bVal || '').toLowerCase()] ?? 99;
        if (aRank !== bRank) return aRank < bRank ? -dir : dir;
        return 0;
    }

    if (type === 'number') {
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal === bVal) return 0;
        return aVal < bVal ? -dir : dir;
    }

    const aEmpty = !aVal;
    const bEmpty = !bVal;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    return String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: 'base',
    }) * dir;
}

function SortableTh({
    columnKey,
    label,
    activeKey,
    direction,
    onSort,
    align = 'left',
    className = '',
}) {
    const isActive = activeKey === columnKey;
    const alignClass = align === 'right' ? 'text-right' : 'text-left';

    return (
        <th
            className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 ${alignClass} text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onSort(columnKey);
                }}
                className={`inline-flex items-center gap-1 hover:text-gray-700 ${
                    align === 'right' ? 'ml-auto' : ''
                } ${isActive ? 'text-teal-700' : ''}`}
                title={`Sort by ${label}`}
                aria-label={`Sort by ${label}${
                    isActive
                        ? direction === 'asc'
                            ? ', ascending'
                            : ', descending'
                        : ''
                }`}
            >
                {label}
                {isActive ? (
                    direction === 'asc' ? (
                        <ArrowUp size={12} className="opacity-100" />
                    ) : (
                        <ArrowDown size={12} className="opacity-100" />
                    )
                ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                )}
            </button>
        </th>
    );
}

export default function UtilityBillSummaryTable({
    rows = [],
    searchQuery = '',
    utilityType = '',
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [viewBill, setViewBill] = useState(null);
    const [loadingBillId, setLoadingBillId] = useState('');
    const [expandedMonths, setExpandedMonths] = useState(() => new Set());
    const [monthSortKey, setMonthSortKey] = useState('monthKey');
    const [monthSortDirection, setMonthSortDirection] = useState('desc');
    const [billSortKey, setBillSortKey] = useState('status');
    const [billSortDirection, setBillSortDirection] = useState('asc');

    const filtered = useMemo(
        () => filterSummaryRows(rows, searchQuery),
        [rows, searchQuery],
    );

    const displayed = useMemo(() => {
        const monthCol = MONTH_COLUMNS.find((c) => c.key === monthSortKey) || MONTH_COLUMNS[0];
        return [...filtered].sort((a, b) =>
            compareSortValues(a, b, monthSortKey, monthCol.type, monthSortDirection),
        );
    }, [filtered, monthSortKey, monthSortDirection]);

    const handleMonthSort = useCallback(
        (key) => {
            if (monthSortKey === key) {
                setMonthSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setMonthSortKey(key);
            setMonthSortDirection(key === 'monthKey' ? 'desc' : 'asc');
        },
        [monthSortKey],
    );

    const handleBillSort = useCallback(
        (key) => {
            if (billSortKey === key) {
                setBillSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setBillSortKey(key);
            setBillSortDirection('asc');
        },
        [billSortKey],
    );

    const toggleMonth = (monthKey) => {
        setExpandedMonths((prev) => {
            const next = new Set(prev);
            if (next.has(monthKey)) next.delete(monthKey);
            else next.add(monthKey);
            return next;
        });
    };

    const openViewBill = async (billId, event) => {
        event?.stopPropagation?.();
        const id = String(billId || '').trim();
        if (!id || loadingBillId) return;
        setLoadingBillId(id);
        try {
            const bill = await fetchUtilityBillById(id);
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

    const openAccountDetails = useCallback(
        (row) => {
            const href = String(row?.href || '').trim();
            if (href) {
                router.push(href);
                return;
            }
            const entryId = String(row?.entryId || '').trim();
            if (!entryId) return;
            const billId = String(row?.billId || '').trim();
            const query = billId ? `?billId=${encodeURIComponent(billId)}` : '';
            router.push(`/HRM/Asset/UtilityBills/details/${encodeURIComponent(entryId)}${query}`);
        },
        [router],
    );

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
                <table className="w-full min-w-[640px] table-auto text-xs sm:text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {MONTH_COLUMNS.map((col) => (
                                <SortableTh
                                    key={col.key}
                                    columnKey={col.key}
                                    label={col.label}
                                    activeKey={monthSortKey}
                                    direction={monthSortDirection}
                                    onSort={handleMonthSort}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {displayed.map((monthRow) => {
                            const expanded = expandedMonths.has(monthRow.monthKey);
                            const billRows = Array.isArray(monthRow.bills) ? monthRow.bills : [];
                            return (
                                <FragmentMonth
                                    key={monthRow.key}
                                    monthRow={monthRow}
                                    expanded={expanded}
                                    billRows={billRows}
                                    billSortKey={billSortKey}
                                    billSortDirection={billSortDirection}
                                    onBillSort={handleBillSort}
                                    loadingBillId={loadingBillId}
                                    onToggle={() => toggleMonth(monthRow.monthKey)}
                                    onViewBill={openViewBill}
                                    onOpenAccount={openAccountDetails}
                                />
                            );
                        })}
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

function FragmentMonth({
    monthRow,
    expanded,
    billRows,
    billSortKey,
    billSortDirection,
    onBillSort,
    loadingBillId,
    onToggle,
    onViewBill,
    onOpenAccount,
}) {
    const sortedBillRows = useMemo(() => {
        const col = BILL_COLUMNS.find((c) => c.key === billSortKey) || BILL_COLUMNS[0];
        return [...billRows].sort((a, b) =>
            compareSortValues(a, b, billSortKey, col.type, billSortDirection),
        );
    }, [billRows, billSortKey, billSortDirection]);

    return (
        <>
            <tr
                className="cursor-pointer bg-white transition-colors hover:bg-blue-50/50"
                onClick={onToggle}
            >
                <td className="px-2 sm:px-4 lg:px-6 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                    <span className="inline-flex items-center gap-1.5">
                        {expanded ? (
                            <ChevronDown size={14} className="text-gray-500" />
                        ) : (
                            <ChevronRight size={14} className="text-gray-500" />
                        )}
                        {monthRow.monthLabel}
                    </span>
                </td>
                <td className="px-2 sm:px-4 lg:px-6 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm tabular-nums text-gray-700">
                    {monthRow.billCount}
                </td>
                <td className="px-2 sm:px-4 lg:px-6 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm tabular-nums text-gray-700">
                    {formatSummaryMoney(monthRow.contractAmount)}
                </td>
                <td className="px-2 sm:px-4 lg:px-6 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm tabular-nums text-gray-700">
                    {formatSummaryMoney(monthRow.billAmount)}
                </td>
                <td
                    className={`px-2 sm:px-4 lg:px-6 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm tabular-nums ${differenceClass(monthRow.difference)}`}
                >
                    {formatSummaryMoney(monthRow.difference)}
                </td>
            </tr>
            {expanded ? (
                <tr className="bg-slate-50/80">
                    <td colSpan={5} className="px-2 sm:px-4 lg:px-6 py-3">
                        {!sortedBillRows.length ? (
                            <p className="text-xs text-gray-500">No bill rows for this month.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                                <table className="w-full min-w-[960px] text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50">
                                            {BILL_COLUMNS.map((col) => (
                                                <SortableTh
                                                    key={col.key}
                                                    columnKey={col.key}
                                                    label={col.label}
                                                    activeKey={billSortKey}
                                                    direction={billSortDirection}
                                                    onSort={onBillSort}
                                                    className="!px-2 sm:!px-3 !py-2 !text-[10px]"
                                                />
                                            ))}
                                            <th className="px-2 sm:px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                                View Bill
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {sortedBillRows.map((row) => (
                                            <tr
                                                key={row.key}
                                                role="link"
                                                tabIndex={row.entryId ? 0 : undefined}
                                                onClick={() => onOpenAccount?.(row)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        onOpenAccount?.(row);
                                                    }
                                                }}
                                                className="cursor-pointer bg-white transition-colors hover:bg-slate-50"
                                            >
                                                <td className="px-2 sm:px-3 py-2 whitespace-nowrap tabular-nums text-gray-700">
                                                    {row.accountNo || '—'}
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                                                    {row.assigneeName ? (
                                                        <span
                                                            className="max-w-[160px] truncate text-xs text-gray-700"
                                                            title={row.assigneeName}
                                                        >
                                                            {row.assigneeName}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 whitespace-nowrap tabular-nums text-gray-700">
                                                    {formatSummaryMoney(row.contractAmount)}
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 whitespace-nowrap tabular-nums text-gray-700">
                                                    {row.billId
                                                        ? formatSummaryMoney(row.billAmount)
                                                        : '—'}
                                                </td>
                                                <td
                                                    className={`px-2 sm:px-3 py-2 whitespace-nowrap tabular-nums ${differenceClass(row.difference)}`}
                                                >
                                                    {row.billId
                                                        ? formatSummaryMoney(row.difference)
                                                        : '—'}
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                                                    <StatusBadge status={row.status} />
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right">
                                                    {row.billId ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => onViewBill(row.billId, e)}
                                                            disabled={loadingBillId === row.billId}
                                                            className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                                                        >
                                                            <Eye size={13} />
                                                            {loadingBillId === row.billId
                                                                ? 'Opening…'
                                                                : 'View'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </td>
                </tr>
            ) : null}
        </>
    );
}
