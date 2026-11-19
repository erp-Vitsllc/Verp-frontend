'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import AddDeliveryModal, { formatDoDate } from './AddDeliveryModal';
import { approveDelivery, deleteDelivery, deliveryApiMessage, listDeliveries, rejectDelivery } from './deliveryApi';

const STATUS_CLASS = {
    Draft: 'bg-slate-100 text-slate-600',
    Submitted: 'bg-violet-50 text-violet-700',
    Confirming: 'bg-violet-50 text-violet-700',
    Confirmed: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-red-50 text-red-600',
};

export default function DeliveryBoard() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [decidingId, setDecidingId] = useState('');
    const [purchasingOfficer, setPurchasingOfficer] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        return listDeliveries()
            .then((data) => {
                setRows(Array.isArray(data?.deliveries) ? data.deliveries : []);
                setPurchasingOfficer(Boolean(data?.purchasingOfficer));
                setError('');
            })
            .catch((loadError) => {
                setRows([]);
                setError(deliveryApiMessage(loadError, 'Could not load delivery orders.'));
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function removeDelivery(row) {
        const label = row.deliveryNo || 'this delivery order';
        const stockNote = row.status === 'Confirmed' ? ' Delivered quantity will go back into stock.' : '';
        if (!window.confirm(`Delete ${label}?${stockNote}`)) return;
        setDeletingId(row.id);
        setError('');
        try {
            await deleteDelivery(row.id);
            await load();
        } catch (deleteError) {
            setError(deliveryApiMessage(deleteError, 'Could not delete this delivery order.'));
        } finally {
            setDeletingId('');
        }
    }

    async function decide(row, action) {
        const label = row.deliveryNo || 'this delivery';
        if (action === 'reject' && !window.confirm(`Reject ${label}? Stock will not change.`)) return;
        setDecidingId(row.id);
        setError('');
        try {
            if (action === 'approve') await approveDelivery(row.id);
            else await rejectDelivery(row.id);
            await load();
        } catch (decideError) {
            setError(deliveryApiMessage(decideError, action === 'approve' ? 'Could not approve this delivery.' : 'Could not reject this delivery.'));
        } finally {
            setDecidingId('');
        }
    }

    const waiting = purchasingOfficer ? rows.filter((row) => row.status === 'Submitted') : [];

    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Delivery</h1>
                    <p className="mt-1 text-sm text-slate-500">Inventory deliveries.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9]"
                >
                    <Plus className="h-4 w-4" />
                    Add DO
                </button>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            {waiting.length ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    {waiting.length} delivery {waiting.length === 1 ? 'order is' : 'orders are'} waiting for your approval. Approving reduces the delivered quantity from each item.
                </div>
            ) : null}

            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {['DO No', 'Date', 'Type', 'Project', 'Customer', 'Items', 'Status', 'Action'].map((heading) => (
                                <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${heading === 'Items' ? 'text-right' : ''}`}>{heading}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading delivery orders...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">No delivery orders yet.</td>
                            </tr>
                        ) : rows.map((row) => (
                            <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{row.deliveryNo}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{formatDoDate(row.doDate)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.deliveryType}</td>
                                <td className="max-w-[220px] truncate px-4 py-3.5">{row.projectName || '—'}</td>
                                <td className="max-w-[220px] truncate px-4 py-3.5">{row.customerName || '—'}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{Array.isArray(row.lines) ? row.lines.length : 0}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[row.status] || STATUS_CLASS.Draft}`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                        {purchasingOfficer && row.status === 'Submitted' ? (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={decidingId === row.id}
                                                    onClick={() => decide(row, 'approve')}
                                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#7C3AED] px-2.5 text-xs font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-40"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={decidingId === row.id}
                                                    onClick={() => decide(row, 'reject')}
                                                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    Reject
                                                </button>
                                            </>
                                        ) : null}
                                        <button
                                            type="button"
                                            disabled={deletingId === row.id}
                                            onClick={() => removeDelivery(row)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40"
                                            aria-label={`Delete ${row.deliveryNo}`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {open ? (
                <AddDeliveryModal
                    purchasingOfficer={purchasingOfficer}
                    onClose={() => setOpen(false)}
                    onSaved={() => {
                        setOpen(false);
                        load();
                    }}
                />
            ) : null}
        </section>
    );
}
