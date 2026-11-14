'use client';

import { useEffect, useState } from 'react';
import { mapZohoBillListRows } from '@/utils/zohoVendorPayments';
import { listVendorBills, vendorApiMessage } from './vendorManagementApi';

function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('overdue')) return 'bg-red-50 text-red-700';
    if (value.includes('partial')) return 'bg-amber-50 text-amber-700';
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
        listVendorBills(vendorId)
            .then((data) => {
                if (cancelled) return;
                setRows(mapZohoBillListRows(Array.isArray(data?.bills) ? data.bills : []));
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
                            {['Date', 'Bill #', 'Reference #', 'Status', 'Due Date', 'Amount', 'Balance Due'].map((heading) => (
                                <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
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
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No bills yet. Use Sync from Zoho to load this vendor’s bills.</td>
                            </tr>
                        ) : rows.map((row) => (
                            <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                                <td className="whitespace-nowrap px-4 py-3.5">{row.date}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{row.billNumber}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.referenceNumber}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(row.status)}`}>
                                        {String(row.status || 'N/A').replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.dueDate}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.amount}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.balanceAmount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
