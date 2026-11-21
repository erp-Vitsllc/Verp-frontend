'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import { formatAed } from './workOrderNumber';
import WorkOrderDetails from './WorkOrderDetails';
import WorkOrderQuotationModal from './WorkOrderQuotationModal';
import { ClipboardList, MoreHorizontal } from 'lucide-react';

const COLUMNS = ['Work Order No', 'Customer', 'Quotation Ref', 'LPO No', 'Status', 'Type', 'Value (AED)', 'Action'];
const PAGE_SIZES = ['10', '20', '40', '50', 'all'];

const STATUS_CLASS = {
    Draft: 'bg-slate-100 text-slate-600',
    'Not Started': 'bg-slate-100 text-slate-600',
    'In Progress': 'bg-blue-50 text-blue-600',
    'Awaiting LPO': 'bg-amber-50 text-amber-600',
    'Fully Invoiced': 'bg-violet-50 text-violet-600',
    Completed: 'bg-emerald-50 text-emerald-600',
};

const TYPE_CLASS = {
    'Main WO': 'bg-sky-50 text-sky-700',
    Standalone: 'bg-stone-100 text-stone-600',
    Variation: 'bg-violet-50 text-violet-600',
};

const FOCUS = 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

function mapOrder(order) {
    return {
        id: String(order._id || order.workOrderNo),
        no: order.workOrderNo,
        customer: order.customer || '',
        quote: order.quotationRef || '—',
        quotationId: String(order.quotationId || ''),
        lpo: order.lpoNo || '—',
        status: order.status || 'Draft',
        type: order.type || 'Standalone',
        value: formatAed(order.value),
    };
}

function pageWindow(total, page, size) {
    const count = Math.max(0, Number(total) || 0);
    const numericSize = size === 'all' ? Math.max(count, 1) : Number(size);
    const pageCount = size === 'all' ? 1 : Math.max(1, Math.ceil(count / numericSize));
    const currentPage = Math.min(Math.max(1, page), pageCount);
    const from = count === 0 ? 0 : (currentPage - 1) * (size === 'all' ? count : numericSize) + 1;
    const to = count === 0 ? 0 : size === 'all' ? count : Math.min(currentPage * numericSize, count);
    return { pageCount, currentPage, from, to };
}

function slicePage(rows, page, size) {
    if (size === 'all') return rows;
    const numericSize = Number(size);
    const start = (Math.max(1, page) - 1) * numericSize;
    return rows.slice(start, start + numericSize);
}

function pageNumbers(page, pages) {
    const values = new Set([1, page - 1, page, page + 1, pages].filter((value) => value >= 1 && value <= pages));
    return [...values].sort((left, right) => left - right);
}

function Pill({ children, className }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>
            {children}
        </span>
    );
}

export default function WorkOrderList() {
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState('10');
    const [detailId, setDetailId] = useState(null);
    const [leaving, setLeaving] = useState(false);
    const [quotePreview, setQuotePreview] = useState(null);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get('/WorkOrder');
            const rows = Array.isArray(response.data?.workOrders) ? response.data.workOrders.map(mapOrder) : [];
            setOrders(rows);
            setError('');
        } catch {
            setOrders([]);
            setError('Could not load work orders.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const goToDashboard = (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        if (leaving) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            router.push('/production/work-order');
            return;
        }
        setLeaving(true);
        window.setTimeout(() => router.push('/production/work-order'), 280);
    };

    if (detailId) {
        return (
            <WorkOrderDetails
                id={detailId}
                onBack={() => {
                    setDetailId(null);
                    loadOrders();
                }}
            />
        );
    }

    const range = pageWindow(orders.length, page, pageSize);
    const visibleOrders = slicePage(orders, range.currentPage, pageSize);
    const numbers = pageNumbers(range.currentPage, range.pageCount);

    return (
        <section
            className={`rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)] sm:p-5 ${leaving ? 'wo-list-squeeze-out' : 'wo-list-pop-in'}`}
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h1 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-slate-800">
                    <ClipboardList size={16} className="shrink-0 text-[#2f6fed]" />
                    <span className="truncate">Work Orders</span>
                </h1>
                <span className="shrink-0 text-[12px] text-slate-400">
                    Total: {loading ? '—' : orders.length}
                </span>
            </div>

            <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                <Link
                    href="/production/work-order"
                    onClick={goToDashboard}
                    className={`text-[13px] font-medium text-[#2f6fed] hover:underline ${FOCUS}`}
                >
                    View Dashboard
                </Link>
                <span className="text-[12px] text-slate-400">All work orders</span>
            </div>

            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

            <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[860px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                            {COLUMNS.map((column) => (
                                <th key={column} className="px-2 py-2 font-medium whitespace-nowrap">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-2 py-8 text-center text-sm text-slate-400">
                                    Loading work orders...
                                </td>
                            </tr>
                        ) : null}
                        {!loading && !error && visibleOrders.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-2 py-8 text-center text-sm text-slate-400">
                                    No work orders yet.
                                </td>
                            </tr>
                        ) : null}
                        {!loading ? visibleOrders.map((order) => (
                            <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                                <td className="px-2 py-3 whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => setDetailId(order.id)}
                                        className={`text-[13px] font-semibold text-[#2f6fed] hover:underline ${FOCUS}`}
                                    >
                                        {order.no}
                                    </button>
                                </td>
                                <td className="px-2 py-3 text-[13px] text-slate-700 whitespace-nowrap">{order.customer}</td>
                                <td className="px-2 py-3 whitespace-nowrap">
                                    {order.quote && order.quote !== '—' ? (
                                        <button
                                            type="button"
                                            onClick={() => setQuotePreview(order)}
                                            className={`text-[13px] font-semibold text-[#2f6fed] hover:underline ${FOCUS}`}
                                        >
                                            {order.quote}
                                        </button>
                                    ) : (
                                        <span className="text-[13px] text-slate-600">—</span>
                                    )}
                                </td>
                                <td className="px-2 py-3 text-[13px] text-slate-600 whitespace-nowrap">{order.lpo}</td>
                                <td className="px-2 py-3 whitespace-nowrap">
                                    <Pill className={STATUS_CLASS[order.status] || 'bg-slate-100 text-slate-600'}>{order.status}</Pill>
                                </td>
                                <td className="px-2 py-3 whitespace-nowrap">
                                    <Pill className={TYPE_CLASS[order.type] || 'bg-stone-100 text-stone-600'}>{order.type}</Pill>
                                </td>
                                <td className="px-2 py-3 text-[13px] font-medium text-slate-700 whitespace-nowrap tabular-nums">
                                    {order.value}
                                </td>
                                <td className="px-2 py-3">
                                    <button
                                        type="button"
                                        aria-label={`Open ${order.no}`}
                                        onClick={() => setDetailId(order.id)}
                                        className={`rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${FOCUS}`}
                                    >
                                        <MoreHorizontal size={16} />
                                    </button>
                                </td>
                            </tr>
                        )) : null}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <p>
                    Showing {range.from} to {range.to} of {orders.length} work orders
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1" role="group" aria-label="Rows per page">
                        {PAGE_SIZES.map((size) => {
                            const selected = pageSize === size;
                            return (
                                <button
                                    key={size}
                                    type="button"
                                    aria-pressed={selected}
                                    disabled={loading}
                                    onClick={() => {
                                        setPageSize(size);
                                        setPage(1);
                                    }}
                                    className={`h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium disabled:opacity-40 ${FOCUS} ${selected ? 'bg-[#2f6fed] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {size === 'all' ? 'All' : size}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label="Previous page"
                            disabled={loading || range.currentPage <= 1}
                            onClick={() => setPage(range.currentPage - 1)}
                            className={`h-8 w-8 rounded-lg text-slate-500 disabled:opacity-40 ${FOCUS}`}
                        >
                            &lt;
                        </button>
                        {numbers.map((value, index, list) => (
                            <span key={value} className="flex items-center">
                                {index > 0 && value - list[index - 1] > 1 ? <span className="px-1">...</span> : null}
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setPage(value)}
                                    className={`h-8 min-w-8 rounded-lg px-2 text-[13px] disabled:opacity-40 ${value === range.currentPage ? 'bg-[#2f6fed] text-white' : `text-slate-600 hover:bg-slate-100 ${FOCUS}`}`}
                                >
                                    {value}
                                </button>
                            </span>
                        ))}
                        <button
                            type="button"
                            aria-label="Next page"
                            disabled={loading || range.currentPage >= range.pageCount}
                            onClick={() => setPage(range.currentPage + 1)}
                            className={`h-8 w-8 rounded-lg text-slate-500 disabled:opacity-40 ${FOCUS}`}
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>
            {quotePreview ? (
                <WorkOrderQuotationModal
                    quotationRef={quotePreview.quote}
                    quotationId={quotePreview.quotationId}
                    onClose={() => setQuotePreview(null)}
                />
            ) : null}
        </section>
    );
}
