'use client';

import { useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';

const FOCUS = 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';
const COLUMNS = ['#', 'Description', 'Qty', 'Rate', 'Amount'];
const BOQ_TABS = [
    { id: 'proposed', label: 'Proposed BOQ' },
    { id: 'actual', label: 'Actual BOQ' },
    { id: 'mr', label: 'MR' },
];

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
        status: '',
        notes: '',
        terms: '',
        valueExclVat: order?.valueExclVat,
    };
}

function BoqTabs({ active, onChange }) {
    return (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="BOQ">
            {BOQ_TABS.map((item) => {
                const selected = active === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(item.id)}
                        className={selected
                            ? `inline-flex h-10 items-center gap-2 rounded-xl border border-[#2f6fed] bg-[#e8f1ff] px-4 text-[15px] font-semibold text-[#2f6fed] ${FOCUS}`
                            : `inline-flex h-10 items-center gap-2 rounded-xl border border-[#e5edf6] bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-[#f4f7fb] ${FOCUS}`}
                    >
                        {item.id === 'proposed' ? <FileText size={16} /> : null}
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function WorkOrderQuotationPanel({ order, onOpen }) {
    const [boqTab, setBoqTab] = useState('proposed');
    const quote = savedQuote(order);
    const lines = Array.isArray(quote.lines) ? quote.lines : [];
    const subTotal = Number(quote.valueExclVat) || 0;
    const status = statusLabel(quote.status);
    const hasQuote = Boolean(order?.quotationRef);

    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <BoqTabs active={boqTab} onChange={setBoqTab} />
                {boqTab === 'proposed' && hasQuote ? (
                    <div className="flex items-center gap-2">
                        {status ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{status}</span>
                        ) : null}
                        <button
                            type="button"
                            onClick={onOpen}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5edf6] bg-white px-3 text-[13px] font-semibold text-[#2f6fed] hover:bg-[#f4f7fb] ${FOCUS}`}
                        >
                            <Paperclip size={14} />
                            PDF
                        </button>
                    </div>
                ) : null}
            </div>
            {boqTab === 'actual' ? (
                <p className="text-sm text-slate-500">No actual BOQ lines yet.</p>
            ) : null}
            {boqTab === 'mr' ? (
                <p className="text-sm text-slate-500">No material requests yet.</p>
            ) : null}
            {boqTab === 'proposed' && !hasQuote ? (
                <p className="text-sm text-slate-500">No quotation is saved on this work order.</p>
            ) : null}
            {boqTab === 'proposed' && hasQuote ? (
            <>
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
                                className="border-b border-slate-100 last:border-0"
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
            <dl className="ml-auto mt-4 w-full max-w-xs text-sm">
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Sub Total</dt>
                    <dd className="font-medium tabular-nums text-slate-800">{money(subTotal)}</dd>
                </div>
            </dl>
            </>
            ) : null}
        </section>
    );
}
