'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { mapZohoBillListRows } from '@/utils/zohoVendorPayments';
import { listInventoryBills } from '../bills/billsApi';
import { listVendorBills, vendorApiMessage } from './vendorManagementApi';

function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('overdue')) return 'bg-red-50 text-red-700';
    if (value.includes('partial') || value.includes('unpaid') || value.includes('pending')) return 'bg-amber-50 text-amber-700';
    if (value.includes('paid')) return 'bg-emerald-50 text-emerald-700';
    if (value.includes('open')) return 'bg-blue-50 text-blue-700';
    return 'bg-slate-100 text-slate-600';
}

export default function VendorBills({ vendorId, reloadKey = 0 }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!vendorId) return undefined;
        let cancelled = false;
        setLoading(true);
        setError('');
        Promise.all([
            listVendorBills(vendorId),
            listInventoryBills(vendorId).catch(() => ({ bills: [] })),
        ])
            .then(([data, inventory]) => {
                if (cancelled) return;
                const stockRows = (Array.isArray(inventory?.bills) ? inventory.bills : []).flatMap((bill) => {
                    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(bill.purchaseDate || ''));
                    const date = match
                        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
                        : null;
                    const dateLabel = date && !Number.isNaN(date.getTime())
                        ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'N/A';
                    const lines = Array.isArray(bill.lines) && bill.lines.length
                        ? bill.lines
                        : [{ itemName: '', description: '', quantity: 0, total: bill.value }];
                    return lines.map((line, index) => ({
                        id: `${bill.id}-${index}`,
                        date: index === 0 ? dateLabel : '',
                        billNumber: index === 0 ? (bill.billNo || 'N/A') : '',
                        itemName: line.itemName || line.description || 'Item',
                        quantity: line.quantity ?? 0,
                        erpSource: index === 0 ? 'Direct' : '',
                        referenceNumber: index === 0 ? (bill.lpoNo || 'N/A') : '',
                        status: index === 0 ? 'Posted' : '',
                        dueDate: index === 0 ? 'N/A' : '',
                        amount: Number(line.total || (Number(line.quantity) * Number(line.unitPrice)) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                        balanceAmount: index === 0 ? 'N/A' : '',
                        zohoUrl: '',
                    }));
                });
                setRows([
                    ...stockRows,
                    ...mapZohoBillListRows(Array.isArray(data?.bills) ? data.bills : []),
                ]);
            })
            .catch((loadError) => {
                if (cancelled) return;
                setRows([]);
                setError(vendorApiMessage(loadError, 'Could not load bills.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey, vendorId]);

    return (
        <div className="p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Bills</h2>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {['Date', 'Bill #', 'Item', 'Qty', 'Source', 'Reference #', 'Status', 'Due Date', 'Amount', 'Balance Due', 'Zoho'].map((heading) => (
                                <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${heading === 'Qty' ? 'text-right' : ''}`}>{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={11} className="px-4 py-10 text-center text-slate-500">Loading bills...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="px-4 py-10 text-center text-slate-500">No bills for this vendor.</td>
                            </tr>
                        ) : rows.map((row) => (
                            <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                                <td className="whitespace-nowrap px-4 py-3.5">{row.date}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{row.billNumber}</td>
                                <td className="max-w-[240px] px-4 py-3.5">{row.itemName || ''}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{row.quantity == null ? '' : row.quantity}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.erpSource || (row.itemName ? '' : 'ERP')}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.referenceNumber || 'N/A'}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    {row.status ? (
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(row.status)}`}>
                                            {String(row.status).replace(/_/g, ' ')}
                                        </span>
                                    ) : null}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.dueDate}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.amount}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.balanceAmount}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    {row.zohoUrl ? (
                                        <a
                                            href={row.zohoUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                                        >
                                            Open
                                            <ExternalLink size={13} />
                                        </a>
                                    ) : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
