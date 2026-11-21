'use client';

import { Wallet } from 'lucide-react';
import { formatAed, formatWorkOrderDate } from './workOrderNumber';

const ACTION_LABEL = {
    convert: 'Converted',
    rebudget: 'Re budget',
    resync: 'Resynced',
};

function money(value) {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function savedWhen(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function WorkOrderBudgetPanel({ order }) {
    const rows = Array.isArray(order?.budgets) ? order.budgets : [];

    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                <Wallet size={16} className="text-[#2f6fed]" /> Budget
            </h2>
            {!order?.budgeted || rows.length === 0 ? (
                <p className="text-sm text-slate-500">
                    This work order is not a budget yet. Convert to budget keeps the quotation here, and each Re budget adds the next version.
                </p>
            ) : (
                <ol className="space-y-4">
                    {rows.map((row, index) => {
                        const quote = row.quote && typeof row.quote === 'object' ? row.quote : {};
                        const lines = Array.isArray(quote.lines) ? quote.lines : [];
                        const latest = index === rows.length - 1;
                        return (
                            <li key={`${row.revision || index}-${row.savedAt || index}`} className="rounded-xl border border-[#e6eef6] bg-[#f8fbff] p-3 sm:p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-800">
                                        Version {row.revision || index + 1}
                                        <span className="ml-2 font-medium text-slate-500">{ACTION_LABEL[row.action] || 'Saved'}</span>
                                    </p>
                                    {latest ? (
                                        <span className="rounded-full bg-[#e8f1ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#2f6fed]">Latest</span>
                                    ) : (
                                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">Previous</span>
                                    )}
                                </div>
                                <p className="mt-1 text-[12px] text-slate-500">
                                    {savedWhen(row.savedAt)}{row.savedByName ? ` · ${row.savedByName}` : ''}
                                </p>
                                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">Quotation</dt>
                                        <dd className="mt-1 font-semibold text-slate-800">{quote.number || order.quotationRef || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">Date</dt>
                                        <dd className="mt-1 font-medium text-slate-800">{formatWorkOrderDate(quote.date)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">Customer</dt>
                                        <dd className="mt-1 font-medium text-slate-800">{quote.customerName || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">Total</dt>
                                        <dd className="mt-1 font-semibold text-slate-900">{formatAed(quote.total)}</dd>
                                    </div>
                                </dl>
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                {['#', 'Description', 'Qty', 'Rate', 'Amount'].map((column) => (
                                                    <th key={column} className={`px-2 py-2 font-semibold ${column === '#' || column === 'Description' ? '' : 'text-right'}`}>
                                                        {column}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lines.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-2 py-4 text-center text-slate-400">No lines were stored on this version.</td>
                                                </tr>
                                            ) : lines.map((line, lineIndex) => (
                                                <tr key={line.id || lineIndex} className="border-b border-slate-100 last:border-0">
                                                    <td className="px-2 py-2 align-top text-slate-500 tabular-nums">{lineIndex + 1}</td>
                                                    <td className="px-2 py-2 whitespace-pre-line text-slate-700">{line.description}</td>
                                                    <td className="px-2 py-2 text-right align-top tabular-nums text-slate-700">{money(line.quantity)}</td>
                                                    <td className="px-2 py-2 text-right align-top tabular-nums text-slate-700">{money(line.rate)}</td>
                                                    <td className="px-2 py-2 text-right align-top font-medium tabular-nums text-slate-800">{money(line.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
