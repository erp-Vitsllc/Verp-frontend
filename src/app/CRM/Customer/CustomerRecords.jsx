'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Printer } from 'lucide-react';
import { downloadDeliveryOrderPdf } from '../../inventory/delivery/deliveryOrderPdf';
import { workOrderDetailsHref } from '@/app/production/work-order/workOrderPaths';
import {
    customerApiMessage,
    listCustomerDeliveries,
    listCustomerInvoices,
    listCustomerProjects,
} from './customerApi';

function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('overdue') || value.includes('reject')) return 'bg-red-50 text-red-700';
    if (value.includes('partial') || value.includes('unpaid') || value.includes('pending') || value.includes('await')) return 'bg-amber-50 text-amber-700';
    if (value.includes('paid') || value.includes('complete') || value.includes('confirm')) return 'bg-emerald-50 text-emerald-700';
    if (value.includes('progress') || value.includes('open') || value.includes('sent') || value.includes('submit')) return 'bg-blue-50 text-blue-700';
    return 'bg-slate-100 text-slate-600';
}

function money(amount, currency) {
    const code = String(currency || 'AED').trim() || 'AED';
    const value = Number(amount);
    if (!Number.isFinite(value)) return 'N/A';
    try {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${code} ${value.toFixed(2)}`;
    }
}

function deliveryStatusLabel(status) {
    if (status === 'Confirmed') return 'Delivered';
    if (status === 'Rejected') return 'Rejected';
    return 'Pending for delivery';
}

function formatDate(value) {
    const text = String(value || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (!match) return text || 'N/A';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const LOADERS = {
    invoices: {
        read: (id) => listCustomerInvoices(id).then((data) => data?.invoices),
        fallback: 'Could not load invoices.',
    },
    deliveries: {
        read: (id) => listCustomerDeliveries(id).then((data) => data?.deliveries),
        fallback: 'Could not load deliveries.',
    },
    projects: {
        read: (id) => listCustomerProjects(id).then((data) => data?.projects),
        fallback: 'Could not load projects.',
    },
};

function useRows(customerId, kind) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!customerId) return undefined;
        const loader = LOADERS[kind];
        let cancelled = false;
        loader.read(customerId)
            .then((data) => {
                if (!cancelled) setRows(Array.isArray(data) ? data : []);
            })
            .catch((loadError) => {
                if (cancelled) return;
                setRows([]);
                setError(customerApiMessage(loadError, loader.fallback));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [customerId, kind]);

    return { rows, loading, error };
}

function Shell({ title, error, children }) {
    return (
        <div className="p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <div className="overflow-x-auto">{children}</div>
        </div>
    );
}

function EmptyRow({ colSpan, loading, empty, loadingLabel }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">
                {loading ? loadingLabel : empty}
            </td>
        </tr>
    );
}

export function CustomerInvoices({ customerId }) {
    const { rows, loading, error } = useRows(customerId, 'invoices');

    return (
        <Shell title="Invoices" error={error}>
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                        {['Date', 'Invoice #', 'Reference #', 'Status', 'Due Date', 'Amount', 'Balance', 'Zoho'].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading || rows.length === 0 ? (
                        <EmptyRow colSpan={8} loading={loading} loadingLabel="Loading invoices..." empty="No invoices for this customer." />
                    ) : rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                            <td className="whitespace-nowrap px-4 py-3.5">{formatDate(row.date)}</td>
                            <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{row.number || 'N/A'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">{row.reference || 'N/A'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(row.status)}`}>
                                    {String(row.status || 'N/A').replace(/_/g, ' ')}
                                </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">{formatDate(row.dueDate)}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">{money(row.total, row.currencyCode)}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">{money(row.balance, row.currencyCode)}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                                {row.zohoUrl ? (
                                    <a href={row.zohoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                                        Open
                                        <ExternalLink size={13} />
                                    </a>
                                ) : 'N/A'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Shell>
    );
}

function customerDeliveryPdfSource(row) {
    return {
        form: {
            deliveryType: row.deliveryType || 'Manual',
            doDate: row.doDate || '',
            projectName: row.projectName || '',
            contactPersonName: row.contactPersonName || '',
            deliveryAddress: row.deliveryAddress || '',
            contactNumber: row.contactNumber || '',
            note: row.note || '',
            lines: Array.isArray(row.lines) ? row.lines : [],
        },
        customerName: row.customerName || '',
        workOrderNo: row.workOrderNo || '',
        deliveryNo: row.deliveryNo || '',
        createdAt: row.createdAt || '',
        inventoryItems: [],
    };
}

async function printCustomerDelivery(row) {
    await downloadDeliveryOrderPdf(customerDeliveryPdfSource(row));
}

async function viewCustomerDelivery(row) {
    const preview = window.open('about:blank', '_blank');
    if (!preview) throw new Error('Allow popups to view this delivery order.');
    try {
        preview.document.title = row.deliveryNo || 'Delivery Order';
    } catch {
        /* the blank tab can ignore a title until the PDF loads */
    }
    try {
        const blob = await downloadDeliveryOrderPdf(customerDeliveryPdfSource(row), { output: 'blob' });
        const url = URL.createObjectURL(blob);
        preview.location.href = url;
        try { preview.opener = null; } catch { /* ignore */ }
        window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (error) {
        if (!preview.closed) preview.close();
        throw error;
    }
}

export function CustomerDeliveries({ customerId }) {
    const { rows, loading, error } = useRows(customerId, 'deliveries');
    const [printError, setPrintError] = useState('');

    return (
        <Shell title="Delivery" error={error || printError}>
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                        {['Delivery No', 'Date', 'Type', 'Project', 'Amount', 'Status', ''].map((heading) => (
                            <th key={heading || 'print'} className={`whitespace-nowrap px-4 py-3 font-medium ${heading === 'Amount' ? 'text-right' : ''}`}>{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading || rows.length === 0 ? (
                        <EmptyRow colSpan={7} loading={loading} loadingLabel="Loading deliveries..." empty="No deliveries for this customer." />
                    ) : rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                            <td className="whitespace-nowrap px-4 py-3.5 font-medium">
                                {row.deliveryNo ? (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                await viewCustomerDelivery(row);
                                                setPrintError('');
                                            } catch (viewFailure) {
                                                setPrintError(viewFailure?.message || 'Could not open the delivery order.');
                                            }
                                        }}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {row.deliveryNo}
                                    </button>
                                ) : 'N/A'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">{formatDate(row.doDate)}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">{row.deliveryType || 'N/A'}</td>
                            <td className="max-w-[220px] truncate px-4 py-3.5">{row.projectName || 'N/A'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{money(row.amount, 'AED')}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deliveryStatusLabel(row.status) === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : statusClass(deliveryStatusLabel(row.status))}`}>
                                    {deliveryStatusLabel(row.status)}
                                </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await printCustomerDelivery(row);
                                            setPrintError('');
                                        } catch (printFailure) {
                                            setPrintError(printFailure?.message || 'Could not download the delivery order.');
                                        }
                                    }}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                    Print DO
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Shell>
    );
}

export function CustomerProjects({ customerId }) {
    const { rows, loading, error } = useRows(customerId, 'projects');

    return (
        <Shell title="Projects" error={error}>
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                        {['Project', 'Work Order', 'Type', 'Status', 'Value', 'Invoiced', 'Created'].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading || rows.length === 0 ? (
                        <EmptyRow colSpan={7} loading={loading} loadingLabel="Loading projects..." empty="No projects for this customer." />
                    ) : rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                            <td className="max-w-[220px] truncate px-4 py-3.5 font-medium text-slate-800">{row.projectName || 'N/A'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                                <Link href={workOrderDetailsHref(row.id)} className="font-medium text-blue-600 hover:underline">
                                    {row.workOrderNo || 'N/A'}
                                </Link>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">{row.type || 'N/A'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(row.status)}`}>
                                    {row.status || 'N/A'}
                                </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">{money(row.value, 'AED')}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">{money(row.invoicedAmount, 'AED')}</td>
                            <td className="whitespace-nowrap px-4 py-3.5">{formatDate(row.createdOn)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Shell>
    );
}
