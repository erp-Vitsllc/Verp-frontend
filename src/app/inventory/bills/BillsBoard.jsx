'use client';

import { useCallback, useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { billsApiMessage, listInventoryBills } from './billsApi';

function formatPurchaseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shown(value) {
    const text = String(value || '').trim();
    return text || 'N/A';
}

function formatValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0.00';
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BillsBoard() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        return listInventoryBills()
            .then((data) => {
                setRows(Array.isArray(data?.bills) ? data.bills : []);
                setError('');
            })
            .catch((loadError) => {
                setRows([]);
                setError(billsApiMessage(loadError, 'Could not load bills.'));
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const itemRows = rows.flatMap((bill) => {
        const lines = Array.isArray(bill.lines) && bill.lines.length
            ? bill.lines
            : [{ itemName: '', description: '', quantity: 0, unitPrice: 0, total: bill.value }];
        return lines.map((line, index) => ({
            key: `${bill.id}-${index}`,
            bill,
            line,
            showBill: index === 0,
        }));
    });

    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-6">
            <h1 className="text-2xl font-bold text-slate-900">Bills</h1>
            <p className="mt-1 text-sm text-slate-500">Each bill item is listed on its own row.</p>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {['Sl.No', 'Bill No', 'Vendor', 'Item', 'Qty', 'Unit Price', 'Total', 'Purchase Date', 'Attachment'].map((heading) => (
                                <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${['Qty', 'Unit Price', 'Total'].includes(heading) ? 'text-right' : ''}`}>{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">Loading bills...</td>
                            </tr>
                        ) : itemRows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">No bills yet.</td>
                            </tr>
                        ) : itemRows.map((row, index) => (
                            <tr key={row.key} className="border-b border-slate-100 text-slate-700">
                                <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-500">{index + 1}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{row.showBill ? shown(row.bill.billNo) : ''}</td>
                                <td className="max-w-[200px] truncate px-4 py-3.5">{row.showBill ? shown(row.bill.vendorName) : ''}</td>
                                <td className="max-w-[280px] px-4 py-3.5">
                                    <p className="font-medium text-slate-800">{shown(row.line.itemName || row.line.description)}</p>
                                    {row.line.description && row.line.itemName && row.line.description !== row.line.itemName ? (
                                        <p className="text-xs text-slate-400">{row.line.description}</p>
                                    ) : null}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{row.line.quantity ?? 0}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{formatValue(row.line.unitPrice)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-medium text-slate-900">{formatValue(row.line.total || (Number(row.line.quantity) * Number(row.line.unitPrice)))}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.showBill ? shown(formatPurchaseDate(row.bill.purchaseDate)) : ''}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    {row.showBill && row.bill.attachment?.url ? (
                                        <a
                                            href={row.bill.attachment.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline"
                                        >
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {row.bill.attachment.name || 'Attachment'}
                                        </a>
                                    ) : row.showBill && row.bill.attachment?.name ? (
                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {row.bill.attachment.name}
                                        </span>
                                    ) : row.showBill ? 'N/A' : ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
