'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, Check, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { isSystemSuperUser } from '@/utils/permissions';
import AddDeliveryModal, { formatDoDate } from './AddDeliveryModal';
import { approveDelivery, deleteDelivery, deliveryApiMessage, listDeliveries, rejectDelivery } from './deliveryApi';

const DELIVERY_COLUMNS = [
    { key: 'deliveryNo', label: 'DO No' },
    { key: 'doDate', label: 'Date' },
    { key: 'deliveryType', label: 'Type' },
    { key: 'projectName', label: 'Project' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'createdByName', label: 'Delivered Person' },
    { key: 'contactPersonName', label: 'Received Person' },
    { key: 'status', label: 'Status' },
    { key: '', label: 'Action' },
];

function money(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function deliveryStatusLabel(row) {
    if (row?.status === 'Draft') return 'Draft';
    if (row?.stockApplied || row?.status === 'Confirmed') return 'Delivered';
    if (row?.status === 'Rejected') return 'Rejected';
    return 'Pending for delivery';
}

function deliverySortValue(row, key) {
    if (key === 'amount') return Number(row.amount) || 0;
    if (key === 'status') return deliveryStatusLabel(row);
    return row[key] || '';
}

function SortHeading({ label, columnKey, sortKey, sortDir, onSort, align }) {
    const className = `whitespace-nowrap px-4 py-3 font-medium ${align === 'right' ? 'text-right' : ''}`;
    if (!columnKey) return <th className={className}>{label}</th>;
    const active = sortKey === columnKey;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
        <th className={className}>
            <button
                type="button"
                onClick={() => onSort(columnKey)}
                className={`inline-flex items-center gap-1 hover:text-slate-800 ${align === 'right' ? 'ml-auto' : ''}`}
            >
                {label}
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-slate-700' : 'text-slate-300'}`} />
            </button>
        </th>
    );
}

const STATUS_CLASS = {
    Draft: 'bg-slate-100 text-slate-600',
    'Pending for delivery': 'bg-amber-50 text-amber-700',
    Delivered: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-red-50 text-red-600',
};

export default function DeliveryBoard() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [readOnly, setReadOnly] = useState(false);
    const [menuId, setMenuId] = useState('');
    const [menuPos, setMenuPos] = useState(null);
    const [deletingId, setDeletingId] = useState('');
    const menuRef = useRef(null);
    const [decidingId, setDecidingId] = useState('');
    const [purchasingOfficer, setPurchasingOfficer] = useState(false);
    const [viewerId, setViewerId] = useState('');
    const [canDelete, setCanDelete] = useState(false);
    const [bellOpen, setBellOpen] = useState(false);
    const [savedNote, setSavedNote] = useState('');
    const bellRef = useRef(null);
    const [sortKey, setSortKey] = useState('');
    const [sortDir, setSortDir] = useState('asc');

    const load = useCallback(() => {
        setLoading(true);
        return listDeliveries()
            .then((data) => {
                setRows(Array.isArray(data?.deliveries) ? data.deliveries : []);
                setPurchasingOfficer(Boolean(data?.purchasingOfficer));
                setViewerId(String(data?.viewerId || ''));
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

    useEffect(() => {
        setCanDelete(isSystemSuperUser());
    }, []);

    useEffect(() => {
        if (!menuId && !bellOpen) return undefined;
        const close = (event) => {
            if (menuId && !menuRef.current?.contains(event.target)) setMenuId('');
            if (bellOpen && !bellRef.current?.contains(event.target)) setBellOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [menuId, bellOpen]);

    function deliveryForEdit(row) {
        if (!row?.pendingEdit) return row;
        return {
            ...row,
            ...row.pendingEdit,
            id: row.id,
            deliveryNo: row.deliveryNo,
            status: row.status,
            stockApplied: Boolean(row.stockApplied),
            stockLines: row.lines,
        };
    }

    async function removeDelivery(row) {
        if (!canDelete) return;
        const label = row.deliveryNo || 'this delivery order';
        const stockNote = row.stockApplied
            ? ' The quantity taken from each item will be added back to that item.'
            : '';
        const notice = row.status === 'Draft' ? '' : ' Management will be notified and the delivery will be stored in Deleted Records.';
        if (!window.confirm(`Delete ${label}?${stockNote}${notice} It will also be removed from the customer.`)) return;
        setMenuId('');
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
        if (action === 'reject' && !window.confirm(row.editPending ? `Reject the edit to ${label}? The delivery stays as it is.` : `Reject ${label}? Stock will not change.`)) return;
        setBellOpen(false);
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

    const waiting = purchasingOfficer ? rows.filter((row) => row.status === 'Submitted' || row.editPending) : [];
    const myDrafts = viewerId
        ? rows.filter((row) => row.status === 'Draft' && String(row.createdBy || '') === viewerId)
        : [];
    const notices = [
        ...waiting.map((row) => ({ ...row, notice: 'approval' })),
        ...myDrafts.map((row) => ({ ...row, notice: 'draft' })),
    ];
    const sortedRows = useMemo(() => {
        if (!sortKey) return rows;
        const factor = sortDir === 'desc' ? -1 : 1;
        return [...rows].sort((left, right) => {
            const a = deliverySortValue(left, sortKey);
            const b = deliverySortValue(right, sortKey);
            if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * factor;
        });
    }, [rows, sortKey, sortDir]);

    function toggleSort(key) {
        if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        else {
            setSortKey(key);
            setSortDir('asc');
        }
    }

    return (
        <section className="rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Delivery</h1>
                    <p className="mt-1 text-sm text-slate-500">Inventory deliveries.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setEditing(null);
                            setReadOnly(false);
                            setOpen(true);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7C3AED] px-4 text-sm font-semibold text-white hover:bg-[#6D28D9]"
                    >
                        <Plus className="h-4 w-4" />
                        Add DO
                    </button>
                    <div className="relative" ref={bellRef}>
                        <button
                            type="button"
                            aria-label="Delivery notifications"
                            aria-expanded={bellOpen}
                            onClick={() => setBellOpen((current) => !current)}
                            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6EDF5] bg-white text-slate-600 hover:bg-slate-50"
                        >
                            <Bell className="h-4 w-4" />
                            {notices.length ? (
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                    {notices.length}
                                </span>
                            ) : null}
                        </button>
                        {bellOpen ? (
                            <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-[#E6EDF5] bg-white shadow-xl">
                                <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Delivery notifications</p>
                                {notices.length === 0 ? (
                                    <p className="px-4 py-6 text-sm text-slate-500">No delivery notifications.</p>
                                ) : (
                                    <ul className="max-h-80 overflow-y-auto">
                                        {notices.map((row) => (
                                            <li key={`${row.notice}-${row.id}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditing(row.notice === 'draft' ? row : deliveryForEdit(row));
                                                        setReadOnly(row.notice !== 'draft');
                                                        setOpen(true);
                                                        setBellOpen(false);
                                                    }}
                                                    className="block w-full text-left"
                                                >
                                                    <p className="text-sm font-semibold text-slate-800">{row.deliveryNo}</p>
                                                    <p className="mt-0.5 text-sm text-slate-600">
                                                        {row.notice === 'draft'
                                                            ? 'This delivery is still a draft.'
                                                            : row.editPending
                                                                ? `${row.editSubmittedBy || 'Someone'} edited this delivery.`
                                                                : `${row.customerName || 'A customer'} delivery is waiting.`}
                                                    </p>
                                                </button>
                                                {row.notice === 'approval' ? (
                                                <div className="mt-2 flex gap-2">
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
                                                </div>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            {savedNote ? <p className="mt-4 text-sm text-emerald-700">{savedNote}</p> : null}

            {waiting.length ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    {waiting.length} delivery {waiting.length === 1 ? 'change is' : 'changes are'} waiting for your approval.
                </div>
            ) : null}

            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {DELIVERY_COLUMNS.map((column) => (
                                <SortHeading
                                    key={column.label}
                                    label={column.label}
                                    columnKey={column.key}
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSort={toggleSort}
                                    align={column.align}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-10 text-center text-slate-500">Loading delivery orders...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-10 text-center text-slate-500">No delivery orders yet.</td>
                            </tr>
                        ) : sortedRows.map((row) => (
                            <tr
                                key={row.id}
                                onClick={() => {
                                    setEditing(row);
                                    setReadOnly(true);
                                    setOpen(true);
                                }}
                                className="cursor-pointer border-b border-slate-100 text-slate-700 hover:bg-slate-50"
                            >
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{row.deliveryNo}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{formatDoDate(row.doDate)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{row.deliveryType}</td>
                                <td className="max-w-[220px] truncate px-4 py-3.5">{row.projectName || '—'}</td>
                                <td className="max-w-[220px] truncate px-4 py-3.5">
                                    {row.customerId ? (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                router.push(`/CRM/Customer/${row.customerId}`);
                                            }}
                                            className="max-w-full truncate font-medium text-[#7C3AED] hover:underline"
                                        >
                                            {row.customerName || '—'}
                                        </button>
                                    ) : (row.customerName || '—')}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{money(row.amount)}</td>
                                <td className="max-w-[180px] truncate px-4 py-3.5">{row.createdByName || '—'}</td>
                                <td className="max-w-[180px] truncate px-4 py-3.5">{row.contactPersonName || '—'}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[deliveryStatusLabel(row)] || STATUS_CLASS['Pending for delivery']}`}>
                                        {deliveryStatusLabel(row)}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        {purchasingOfficer && (row.status === 'Submitted' || row.editPending) ? (
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
                                        <div className="relative" ref={menuId === row.id ? menuRef : null}>
                                            <button
                                                type="button"
                                                aria-label={`Actions for ${row.deliveryNo}`}
                                                onClick={(event) => {
                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                    const openUp = rect.bottom + 96 > window.innerHeight;
                                                    setMenuPos({
                                                        top: openUp ? rect.top - 4 : rect.bottom + 4,
                                                        left: rect.right,
                                                        openUp,
                                                    });
                                                    setMenuId((current) => (current === row.id ? '' : row.id));
                                                }}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                            {menuId === row.id && menuPos ? (
                                                <div
                                                    className="fixed z-50 w-36 overflow-hidden rounded-xl border border-[#E6EDF5] bg-white py-1 shadow-xl"
                                                    style={{
                                                        top: menuPos.top,
                                                        left: menuPos.left,
                                                        transform: menuPos.openUp ? 'translate(-100%, -100%)' : 'translateX(-100%)',
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditing(deliveryForEdit(row));
                                                            setReadOnly(false);
                                                            setOpen(true);
                                                            setMenuId('');
                                                        }}
                                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Edit
                                                    </button>
                                                    {canDelete ? (
                                                    <button
                                                        type="button"
                                                        disabled={deletingId === row.id}
                                                        onClick={() => removeDelivery(row)}
                                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Delete
                                                    </button>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {open ? (
                <AddDeliveryModal
                    key={`${editing?.id || 'new-delivery'}-${readOnly ? 'view' : 'edit'}`}
                    delivery={editing}
                    readOnly={readOnly}
                    purchasingOfficer={purchasingOfficer}
                    onClose={() => {
                        setOpen(false);
                        setEditing(null);
                    }}
                    onSaved={(result) => {
                        setOpen(false);
                        setEditing(null);
                        setSavedNote(result?.pendingApproval ? 'This edit was sent to the purchase officer for approval.' : '');
                        load();
                    }}
                />
            ) : null}
        </section>
    );
}
