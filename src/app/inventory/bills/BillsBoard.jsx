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

    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-6">
            <h1 className="text-2xl font-bold text-slate-900">Bills</h1>
            <p className="mt-1 text-sm text-slate-500">Inventory bills.</p>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {['Sl.No', 'Bill No', 'Vendor', 'Purchase Date', 'Purchase Type', 'Value', 'Attachment'].map((heading) => (
                                <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${heading === 'Value' ? 'text-right' : ''}`}>{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading bills...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No bills yet.</td>
                            </tr>
                        ) : rows.map((row, index) => (
                            <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                                <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-500">{index + 1}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{shown(row.billNo)}</td>
                                <td className="max-w-[240px] truncate px-4 py-3.5">{shown(row.vendorName)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{shown(formatPurchaseDate(row.purchaseDate))}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{shown(row.purchaseType)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-medium text-slate-900">{formatValue(row.value)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    {row.attachment?.url ? (
                                        <a
                                            href={row.attachment.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline"
                                        >
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {row.attachment.name || 'Attachment'}
                                        </a>
                                    ) : row.attachment?.name ? (
                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {row.attachment.name}
                                        </span>
                                    ) : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
