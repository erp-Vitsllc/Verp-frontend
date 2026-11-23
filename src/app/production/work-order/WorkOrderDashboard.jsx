'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import WorkOrderDetails from './WorkOrderDetails';
import WorkOrderQuotationModal from './WorkOrderQuotationModal';
import { formatAed, formatWorkOrderDate, nextWorkOrderNo } from './workOrderNumber';
import {
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    FileText,
    Gavel,
    Receipt,
    Home,
    Layers,
    Link2,
    MoreHorizontal,
    PieChart,
    Plus,
    Zap,
} from 'lucide-react';

const STAT_META = [
    { key: 'total', label: 'Total Work Orders', icon: Layers, tint: 'bg-blue-50 text-blue-600' },
    { key: 'draft', label: 'Draft Work Orders', icon: FileText, tint: 'bg-slate-100 text-slate-500' },
    { key: 'standalone', label: 'Standalone Work Orders', icon: Layers, tint: 'bg-violet-50 text-violet-600' },
    { key: 'linked', label: 'Linked to Projects', icon: Link2, tint: 'bg-sky-50 text-sky-600' },
    { key: 'completed', label: 'Completed Work Orders', icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600' },
    { key: 'pendingInvoices', label: 'Pending Invoices', icon: Receipt, tint: 'bg-orange-50 text-orange-500' },
];

const TYPE_META = [
    { type: 'Standalone', name: 'Standalone', color: '#1d4ed8' },
    { type: 'Main WO', name: 'Main Work Order', color: '#3b82f6' },
    { type: 'Variation', name: 'Variation Orders', color: '#dbeafe' },
];

function mapOrder(order) {
    return {
        id: String(order._id || order.workOrderNo),
        no: order.workOrderNo,
        customer: order.customer || '',
        quote: order.quotationRef || '—',
        quotationId: String(order.quotationId || ''),
        lpo: order.lpoNo || '—',
        createdOn: formatWorkOrderDate(order.createdOn || order.createdAt),
        status: order.status || 'Draft',
        type: order.type || 'Standalone',
        valueAmount: Number(order.value) || 0,
        invoicedAmount: Number(order.invoicedAmount) || 0,
        linkedToProject: Boolean(order.projectName),
        projectName: order.projectName || '',
        salespersonId: String(order.salespersonId || ''),
        salespersonEmployeeId: String(order.salespersonEmployeeId || ''),
        salespersonName: order.salespersonName || '',
        createdBy: String(order.createdBy || ''),
        draftForEmployeeIds: Array.isArray(order.draftForEmployeeIds) ? order.draftForEmployeeIds.map(String) : [],
        lpoAlert: order.lpoAlert?.active
            ? {
                active: true,
                message: order.lpoAlert.message || '',
                kind: order.lpoAlert.kind || '',
                sentByName: order.lpoAlert.sentByName || '',
                forEmployeeIds: Array.isArray(order.lpoAlert.forEmployeeIds) ? order.lpoAlert.forEmployeeIds.map(String) : [],
            }
            : null,
        value: formatAed(order.value),
    };
}

function summarize(orders) {
    const total = orders.length;
    const countStatus = (status) => orders.filter((order) => order.status === status).length;
    const invoiced = orders.reduce((sum, order) => sum + order.invoicedAmount, 0);
    const orderValue = orders.reduce((sum, order) => sum + order.valueAmount, 0);
    const counts = {
        total,
        draft: countStatus('Draft'),
        standalone: orders.filter((order) => order.type === 'Standalone').length,
        linked: orders.filter((order) => order.linkedToProject).length,
        completed: countStatus('Completed'),
        pendingInvoices: orders.filter((order) => (
            order.status !== 'Draft'
            && order.status !== 'Not Started'
            && order.status !== 'LPO Pending'
            && order.status !== 'Completed'
            && order.status !== 'Fully Invoiced'
            && order.valueAmount > order.invoicedAmount
        )).length,
    };
    return {
        counts,
        types: TYPE_META.map((item) => {
            const value = orders.filter((order) => order.type === item.type).length;
            const pct = total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
            return { ...item, value, pct };
        }),
        invoiced,
        orderValue,
    };
}

const RULES = [
    'Quotation from Zoho is mandatory',
    'One quotation + one LPO per Work Order',
    'Multiple invoices allowed',
    'Project cannot be created independently',
];

const ACTIONS = [
    {
        id: 'create',
        label: 'Create Work Order',
        icon: Plus,
        primary: true,
    },
];

const STATUS_CLASS = {
    Draft: 'bg-slate-100 text-slate-600',
    'Not Started': 'bg-slate-100 text-slate-600',
    'In Progress': 'bg-blue-50 text-blue-600',
    'Awaiting LPO': 'bg-amber-50 text-amber-600',
    'LPO Pending': 'bg-amber-50 text-amber-600',
    Created: 'bg-sky-50 text-sky-700',
    'Fully Invoiced': 'bg-violet-50 text-violet-600',
    Completed: 'bg-emerald-50 text-emerald-600',
};

const TYPE_CLASS = {
    'Main WO': 'bg-sky-50 text-sky-700',
    Standalone: 'bg-stone-100 text-stone-600',
    Variation: 'bg-violet-50 text-violet-600',
};

const FOCUS =
    'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

function Skyline() {
    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0 h-[88px] w-[min(820px,66%)]"
            viewBox="0 0 820 120"
            preserveAspectRatio="xMaxYMax meet"
            fill="none"
        >
            <defs>
                <linearGradient id="woSkyFade" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="0.34" stopColor="#ffffff" stopOpacity="1" />
                </linearGradient>
                <mask id="woSkyMask" maskUnits="userSpaceOnUse" x="0" y="0" width="820" height="120">
                    <rect width="820" height="120" fill="url(#woSkyFade)" />
                </mask>
            </defs>
            <g mask="url(#woSkyMask)">
                <path d="M40 120c80-46 150-22 230-36 70-12 110 16 190-2 86-20 140 10 210-8 48-12 80 6 150-10v56H40Z" fill="#e8f3fb" />
                <path d="M180 120c70-40 130-18 200-30 64-12 100 14 170-2 78-18 120 8 180-6 36-8 60 4 90-4v42H180Z" fill="#d7e8f7" />
                <path
                    fill="#c5d8ee"
                    d="M300 120v-20h14v-16h10v18h18v-24h9v-16h7v28h16v-18h8v24h20v-26h10v-22h6v26h12v-16h8v22h14v-44h5l2.5-20 2.5 20v34h10v22h16v-28h9v24h18v-12h8v24h22v-14h12v22h28v-18h14v18h40V120H300Z"
                />
            </g>
        </svg>
    );
}

function Panel({ icon: Icon, title, extra, children, className = '' }) {
    return (
        <section
            className={`rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)] sm:p-5 ${className}`}
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-slate-800">
                    <Icon size={16} className="shrink-0 text-[#2f6fed]" />
                    <span className="truncate">{title}</span>
                </h2>
                {extra || null}
            </div>
            {children}
        </section>
    );
}

function Pill({ children, className }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>
            {children}
        </span>
    );
}

function TypeDonut({ total, segments }) {
    const size = 176;
    const stroke = 28;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;
    const drawn = (segments || []).filter((segment) => segment.value > 0);
    const gap = drawn.length > 1 ? 6 : 0;
    let cursor = 0;

    return (
        <div className="relative h-[176px] w-[176px] shrink-0">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} work orders by type`}>
                <g transform={`rotate(-90 ${center} ${center})`}>
                    <circle cx={center} cy={center} r={radius} fill="none" stroke="#e8eef6" strokeWidth={stroke} />
                    {drawn.map((segment) => {
                        const sweep = (segment.value / total) * circumference;
                        const length = Math.max(0, sweep - gap);
                        const offset = -cursor;
                        cursor += sweep;
                        return (
                            <circle
                                key={segment.name}
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth={stroke}
                                strokeDasharray={`${length} ${circumference - length}`}
                                strokeDashoffset={offset}
                            />
                        );
                    })}
                </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[30px] font-bold leading-none tracking-tight text-slate-900">{total}</span>
                <span className="mt-1 text-[11px] text-slate-400">Work Orders</span>
            </div>
        </div>
    );
}

export default function WorkOrderDashboard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const linkedId = searchParams.get('workOrder') || '';
    const focusSection = searchParams.get('section') || '';
    const [detailId, setDetailId] = useState(linkedId || null);
    const [viewerKeys, setViewerKeys] = useState([]);
    const [orders, setOrders] = useState([]);
    const [pulseTable, setPulseTable] = useState(false);
    const [quotePreview, setQuotePreview] = useState(null);

    const loadOrders = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/WorkOrder');
            const rows = Array.isArray(response.data?.workOrders) ? response.data.workOrders.map(mapOrder) : [];
            setOrders(rows);
        } catch {
            setOrders([]);
        }
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        if (linkedId) setDetailId(linkedId);
    }, [linkedId]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('employeeUser') || localStorage.getItem('user');
            const user = raw ? JSON.parse(raw) : null;
            setViewerKeys([
                user?.employeeObjectId,
                user?.empObjectId,
                user?._id,
                user?.id,
                user?.employeeId,
            ].filter(Boolean).map(String));
        } catch {
            setViewerKeys([]);
        }
    }, []);

    const summary = useMemo(() => summarize(orders), [orders]);
    const seesOrder = (ids) => ids.filter(Boolean).some((id) => viewerKeys.includes(String(id)));
    const draftNotices = orders.filter((order) => (
        order.status === 'Draft' && seesOrder([
            order.salespersonId,
            order.salespersonEmployeeId,
            order.createdBy,
            ...order.draftForEmployeeIds,
        ])
    ));
    const lpoNotices = orders.filter((order) => (
        order.lpoAlert?.active && seesOrder(order.lpoAlert.forEmployeeIds || [])
    ));
    const recentOrders = orders.slice(0, 4);
    const nextNo = nextWorkOrderNo(orders.map((order) => order.no));
    const invoiceMatch = summary.orderValue > 0 ? (summary.invoiced / summary.orderValue) * 100 : 0;
    const remaining = Math.max(0, summary.orderValue - summary.invoiced);
    const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const showAll = () => {
        setPulseTable(true);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.setTimeout(() => {
            router.push('/production/work-order/list');
        }, reduceMotion ? 0 : 180);
    };

    const dismissLpoNotice = async (orderId) => {
        try {
            await axiosInstance.patch(`/WorkOrder/${orderId}`, { dismissLpoAlert: true });
            loadOrders();
        } catch {
            loadOrders();
        }
    };

    if (detailId) {
        return (
            <WorkOrderDetails
                id={detailId}
                focusSection={focusSection}
                onBack={() => {
                    setDetailId(null);
                    if (linkedId) router.replace('/production/work-order');
                    loadOrders();
                }}
            />
        );
    }

    return (
        <div className="relative text-slate-800">
            {draftNotices.length > 0 ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">Draft pending</p>
                    <ul className="mt-1 space-y-1">
                        {draftNotices.map((order) => (
                            <li key={order.id}>
                                <button type="button" onClick={() => setDetailId(order.id)} className={`font-semibold text-amber-950 hover:underline ${FOCUS}`}>
                                    {order.no}
                                </button>
                                {' '}for {order.customer}
                                {order.salespersonName ? ` is pending with ${order.salespersonName}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {lpoNotices.length > 0 ? (
                <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
                    <p className="font-semibold">
                        {lpoNotices.every((order) => order.lpoAlert.kind === 'attachment') ? 'Attachment needed' : 'LPO not filled'}
                    </p>
                    <ul className="mt-1 space-y-2">
                        {lpoNotices.map((order) => (
                            <li key={order.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <button type="button" onClick={() => setDetailId(order.id)} className={`font-semibold hover:underline ${FOCUS}`}>
                                    {order.no}
                                </button>
                                <span>{order.lpoAlert.message}</span>
                                <button type="button" onClick={() => dismissLpoNotice(order.id)} className={`text-[12px] font-semibold text-orange-800 hover:underline ${FOCUS}`}>
                                    Dismiss
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <header className="relative mb-3 min-h-[92px] overflow-hidden">
                <Skyline />
                <div className="relative">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-[#3b82f6]">
                        <Home size={14} aria-hidden="true" />
                        <ChevronRight size={14} className="text-[#93c5fd]" aria-hidden="true" />
                        <span>Sales & Operations</span>
                        <span className="text-[#93c5fd]" aria-hidden="true">/</span>
                        <span>Work Orders</span>
                        <span className="text-[#93c5fd]" aria-hidden="true">/</span>
                        <span>Dashboard</span>
                    </nav>
                    <div className="mt-3 flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2f6fed] text-white shadow-[0_10px_18px_-10px_rgba(47,111,237,0.9)]">
                            <ClipboardList size={22} />
                        </span>
                        <div>
                            <h1 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[28px]">
                                Work Order Dashboard
                            </h1>
                            <p className="text-[13px] text-slate-500">Project & Work Order Management</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {STAT_META.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <article
                            key={stat.label}
                            className="flex items-center gap-3 rounded-2xl border border-[#e6eef6] bg-white px-3.5 py-3.5 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)]"
                        >
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.tint}`}>
                                <Icon size={20} />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[12px] font-medium leading-4 text-slate-500">{stat.label}</span>
                                <span className="mt-0.5 block text-[22px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
                                    {summary.counts[stat.key]}
                                </span>
                            </span>
                        </article>
                    );
                })}
            </div>

            <div className="mt-3 flex justify-end">
                <Panel icon={Zap} title="Quick Actions" className="h-full w-full xl:w-[280px]">
                    <div className="flex flex-col gap-2.5">
                        {ACTIONS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        router.push('/production/work-order/create-work-order');
                                    }}
                                    className={
                                        item.primary
                                            ? `flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2f6fed] text-[13.5px] font-semibold text-white shadow-[0_8px_16px_-10px_rgba(47,111,237,0.95)] hover:bg-[#245fe0] ${FOCUS}`
                                            : `flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e5edf5] bg-white text-[13.5px] font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`
                                    }
                                >
                                    <Icon size={16} className={item.primary ? '' : 'text-slate-500'} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </Panel>
            </div>

            <div className="mt-3 grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                <Panel
                    icon={ClipboardList}
                    title="Recent Work Orders"
                    extra={(
                        <button type="button" onClick={showAll} className={`shrink-0 text-[13px] font-medium text-[#2f6fed] hover:underline ${FOCUS}`}>
                            View All →
                        </button>
                    )}
                >
                    <div
                        id="recent-work-orders"
                        className={`-mx-1 overflow-x-auto px-1 ${pulseTable ? 'rounded-xl ring-2 ring-[#2f6fed]/30' : ''}`}
                    >
                        <table className="w-full min-w-[860px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                                    {['Work Order No', 'Customer', 'Quotation Ref', 'LPO No', 'Status', 'Type', 'Value (AED)', 'Action'].map((column) => (
                                        <th key={column} className="px-2 py-2 font-medium whitespace-nowrap">
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-2 py-8 text-center text-sm text-slate-400">
                                            No work orders yet. The first number will be {nextNo}.
                                        </td>
                                    </tr>
                                ) : null}
                                {recentOrders.map((order) => (
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
                                            <Pill className={STATUS_CLASS[order.status]}>{order.status}</Pill>
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap">
                                            <Pill className={TYPE_CLASS[order.type]}>{order.type}</Pill>
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel icon={Gavel} title="Business Rules">
                    <ul className="space-y-3">
                        {RULES.map((rule) => (
                            <li key={rule} className="flex items-start gap-2 text-[13px] leading-5 text-slate-600">
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                                <span>{rule}</span>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <div className="mt-3 grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.2fr)]">
                <Panel
                    icon={PieChart}
                    title="Work Order by Type"
                    extra={<span className="text-[12px] text-slate-400">Total: {summary.counts.total}</span>}
                >
                    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                        <TypeDonut total={summary.counts.total} segments={summary.types} />
                        <ul className="w-full min-w-0 flex-1 space-y-3">
                            {summary.types.map((item) => (
                                <li key={item.name} className="flex items-center gap-2.5 text-[13px]">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-600">{item.name}</span>
                                    <span className="ml-auto font-semibold tabular-nums text-slate-700">
                                        {item.value} ({item.pct})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </Panel>

                <Panel
                    icon={FileText}
                    title="Invoice Progress"
                    extra={<span className="text-[12px] text-slate-400">As of {asOf}</span>}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <p className="text-[12px] text-slate-400">Invoiced Amount</p>
                            <p className="mt-1 text-[22px] font-bold tracking-tight text-slate-900 tabular-nums">{formatAed(summary.invoiced)}</p>
                        </div>
                        <div className="sm:text-right">
                            <p className="text-[12px] text-slate-400">Work Order Value</p>
                            <p className="mt-1 text-[22px] font-bold tracking-tight text-slate-900 tabular-nums">{formatAed(summary.orderValue)}</p>
                        </div>
                    </div>
                    <div className="mt-5 h-3.5 overflow-hidden rounded-full bg-[#e8eef6]" aria-hidden="true">
                        <div className="h-full rounded-full bg-[#2f6fed]" style={{ width: `${Math.min(100, invoiceMatch)}%` }} />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                        <span className="font-semibold text-[#2f6fed]">Invoice Match: {invoiceMatch.toFixed(1)}%</span>
                        <span className="text-slate-400">Remaining: {formatAed(remaining)}</span>
                    </div>
                </Panel>
            </div>
            {quotePreview ? (
                <WorkOrderQuotationModal
                    quotationRef={quotePreview.quote}
                    quotationId={quotePreview.quotationId}
                    onClose={() => setQuotePreview(null)}
                />
            ) : null}
        </div>
    );
}
