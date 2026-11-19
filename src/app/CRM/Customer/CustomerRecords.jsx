'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
    customerApiMessage,
    listCustomerDeliveries,
    listCustomerInvoices,
    listCustomerProjects,
} from './customerApi';

function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('overdue')) return 'bg-red-50 text-red-700';
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

export function CustomerDeliveries({ customerId }) {
    const { rows, loading, error } = useRows(customerId, 'deliveries');

    return (
        <Shell title="Delivery" error={error}>
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                        {['DO No', 'Date', 'Type', 'Project', 'Item', 'Qty', 'Status'].map((heading) => (
                            <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${heading === 'Qty' ? 'text-right' : ''}`}>{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading || rows.length === 0 ? (
                        <EmptyRow colSpan={7} loading={loading} loadingLabel="Loading deliveries..." empty="No deliveries for this customer." />
                    ) : rows.flatMap((row) => {
                        const lines = Array.isArray(row.lines) && row.lines.length
                            ? row.lines
                            : [{ itemName: '', description: '', quantity: row.itemCount || 0, unit: '' }];
                        return lines.map((line, index) => (
                            <tr key={`${row.id}-${index}`} className="border-b border-slate-100 text-slate-700">
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{index === 0 ? row.deliveryNo : ''}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{index === 0 ? formatDate(row.doDate) : ''}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{index === 0 ? (row.deliveryType || 'N/A') : ''}</td>
                                <td className="max-w-[220px] truncate px-4 py-3.5">{index === 0 ? (row.projectName || 'N/A') : ''}</td>
                                <td className="max-w-[280px] px-4 py-3.5">{line.itemName || line.description || 'Item'}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">
                                    {line.quantity ?? 0}{line.unit ? ` ${line.unit}` : ''}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    {index === 0 ? (
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(row.status)}`}>
                                            {row.status || 'N/A'}
                                        </span>
                                    ) : null}
                                </td>
                            </tr>
                        ));
                    })}
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
                                <Link href={`/production/work-order?workOrder=${encodeURIComponent(row.id)}`} className="font-medium text-blue-600 hover:underline">
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
