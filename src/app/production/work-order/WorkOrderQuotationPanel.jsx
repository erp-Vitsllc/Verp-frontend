'use client';

import { FileText } from 'lucide-react';
import { formatAed, formatWorkOrderDate } from './workOrderNumber';

const FOCUS = 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';
const COLUMNS = ['#', 'Description', 'Qty', 'Rate', 'Amount'];

function money(value) {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status) {
    const value = String(status || '').trim();
    if (!value) return '';
    if (/^draft$/i.test(value)) return 'Yet to be Approved';
    return value.replace(/_/g, ' ');
}

function savedQuote(order) {
    const snap = order?.quotationSnapshot;
    if (snap && typeof snap === 'object') return snap;
    return {
        number: order?.quotationRef || '',
        date: order?.quotationDate || '',
        customerName: order?.customer || '',
        projectName: '',
        salespersonName: order?.salespersonName || '',
        billTo: order?.customer ? [order.customer] : [],
        lines: [],
        taxLabel: 'TAX',
        status: '',
        notes: '',
        terms: '',
        valueExclVat: order?.valueExclVat,
        vatAmount: order?.vatAmount,
        total: order?.value,
    };
}

export default function WorkOrderQuotationPanel({ order, onOpen }) {
    if (!order?.quotationRef) {
        return (
            <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                    <FileText size={16} className="text-[#2f6fed]" /> Quotation
                </h2>
                <p className="mt-3 text-sm text-slate-500">No quotation is saved on this work order.</p>
            </section>
        );
    }

    const quote = savedQuote(order);
    const lines = Array.isArray(quote.lines) ? quote.lines : [];
    const subTotal = Number(quote.valueExclVat) || 0;
    const vatAmount = Number(quote.vatAmount) || 0;
    const total = Number(quote.total) || 0;
    const taxLabel = quote.taxLabel || 'TAX';
    const billTo = Array.isArray(quote.billTo) && quote.billTo.length
        ? quote.billTo
        : [order.customer].filter(Boolean);
    const status = statusLabel(quote.status);

    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                    <FileText size={16} className="text-[#2f6fed]" /> Quotation
                </h2>
                {status ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{status}</span>
                ) : null}
            </div>
            <dl className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">Estimate #</dt>
                    <dd className="mt-1">
                        <button type="button" onClick={onOpen} className={`text-sm font-semibold text-[#2f6fed] hover:underline ${FOCUS}`}>
                            {order.quotationRef}
                        </button>
                    </dd>
                </div>
                <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">Estimate Date</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{formatWorkOrderDate(quote.date || order.quotationDate)}</dd>
                </div>
                <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">Project Name</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{quote.projectName || '—'}</dd>
                </div>
                <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">Sales person</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{quote.salespersonName || order.salespersonName || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">Bill To</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">
                        {billTo.map((line, index) => (
                            <span key={`${line}-${index}`} className="block">{line}</span>
                        ))}
                    </dd>
                </div>
            </dl>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                    <thead>
                        <tr className="border-b border-slate-200 bg-[#f4f7fb] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {COLUMNS.map((column) => (
                                <th
                                    key={column}
                                    className={`px-3 py-2 font-semibold whitespace-nowrap ${column === 'Description' ? '' : column === '#' ? 'w-12' : 'text-right'}`}
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {lines.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-sm text-slate-400">
                                    Open the quotation to see the saved document.
                                </td>
                            </tr>
                        ) : null}
                        {lines.map((line, index) => (
                            <tr
                                key={line.id || index}
                                onClick={onOpen}
                                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                            >
                                <td className="px-3 py-3 align-top text-slate-500 tabular-nums">{index + 1}</td>
                                <td className="px-3 py-3 whitespace-pre-line text-slate-700">{line.description}</td>
                                <td className="px-3 py-3 text-right align-top tabular-nums text-slate-700">{money(line.quantity)}</td>
                                <td className="px-3 py-3 text-right align-top tabular-nums text-slate-700">{money(line.rate)}</td>
                                <td className="px-3 py-3 text-right align-top font-medium tabular-nums text-slate-800">{money(line.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <dl className="ml-auto mt-4 w-full max-w-xs space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Sub Total</dt>
                    <dd className="font-medium tabular-nums text-slate-800">{money(subTotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">{taxLabel}</dt>
                    <dd className="font-medium tabular-nums text-slate-800">{money(vatAmount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2">
                    <dt className="font-semibold text-slate-800">Total</dt>
                    <dd className="font-bold tabular-nums text-slate-900">{formatAed(total)}</dd>
                </div>
            </dl>
            {quote.notes ? (
                <p className="mt-4 whitespace-pre-line text-[13px] leading-5 text-slate-600">{quote.notes}</p>
            ) : null}
            {quote.terms ? (
                <p className="mt-3 whitespace-pre-line text-[13px] leading-5 text-slate-600">{quote.terms}</p>
            ) : null}
        </section>
    );
}
