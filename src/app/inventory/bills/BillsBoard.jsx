'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, MoreVertical, Paperclip, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import NotificationInboxModal from '@/components/notifications/NotificationInboxModal';
import { mapDashboardNotificationToRow } from '@/utils/notificationInboxPresentation';
import AddStockModal from '../item-master/AddStockModal';
import { useInventoryAccess } from '../item-master/itemMasterAccess';
import { billsApiMessage, deleteInventoryBill, listInventoryBills } from './billsApi';

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

function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value === 'draft') return 'bg-amber-50 text-amber-700';
    if (value === 'approved') return 'bg-emerald-50 text-emerald-700';
    return 'bg-slate-100 text-slate-600';
}

const COLUMNS = [
    { key: 'order', label: 'Sl.No' },
    { key: 'billNo', label: 'Bill No' },
    { key: 'vendorName', label: 'Vendor Name' },
    { key: 'paymentTerms', label: 'Payment Terms' },
    { key: 'purchaseDate', label: 'Purchase Date' },
    { key: 'lpoNo', label: 'LPO No' },
    { key: 'status', label: 'Status' },
    { key: 'attachment', label: 'Attachment' },
    { key: '', label: 'Action' },
];

function billSortValue(bill, key, index) {
    if (key === 'order') return index;
    if (key === 'attachment') return bill.attachment?.name || '';
    return bill[key] || '';
}

function SortHeading({ label, columnKey, sortKey, sortDir, onSort }) {
    if (!columnKey) {
        return <th className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>;
    }
    const active = sortKey === columnKey;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
        <th className="whitespace-nowrap px-4 py-3 font-medium">
            <button
                type="button"
                onClick={() => onSort(columnKey)}
                className="inline-flex items-center gap-1 hover:text-slate-800"
            >
                {label}
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-slate-700' : 'text-slate-300'}`} />
            </button>
        </th>
    );
}

export default function BillsBoard() {
    const { toast } = useToast();
    const router = useRouter();
    const access = useInventoryAccess();
    const canAddBill = access.canCreateItem || access.canEditItem;
    const [canManage, setCanManage] = useState(false);
    const [rows, setRows] = useState([]);
    const [notices, setNotices] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editEntryId, setEditEntryId] = useState('');
    const [viewEntryId, setViewEntryId] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [menuId, setMenuId] = useState('');
    const [menuPos, setMenuPos] = useState(null);
    const [deletingId, setDeletingId] = useState('');
    const [sortKey, setSortKey] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const menuRef = useRef(null);

    const load = useCallback(() => {
        setLoading(true);
        return listInventoryBills()
            .then((data) => {
                setRows(Array.isArray(data?.bills) ? data.bills : []);
                setNotices(Array.isArray(data?.myDrafts) ? data.myDrafts : []);
                setCanManage(Boolean(data?.isManagement));
                setError('');
            })
            .catch((loadError) => {
                setRows([]);
                setNotices([]);
                setError(billsApiMessage(loadError, 'Could not load bills.'));
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!menuId) return undefined;
        const close = (event) => {
            if (!menuRef.current?.contains(event.target)) setMenuId('');
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [menuId]);

    useEffect(() => {
        const billId = new URLSearchParams(window.location.search).get('bill');
        if (billId) setEditEntryId(billId);
    }, []);

    const removeBill = async (bill) => {
        if (bill.deleteDisabled || deletingId) return;
        const label = bill.billNo || 'this bill';
        const warning = bill.status === 'Draft'
            ? `Delete draft bill ${label}?`
            : bill.stockApplied
                ? `Delete approved bill ${label}? Stock added by this bill will be removed, and management will be notified.`
                : `Delete bill ${label}? Management will be notified.`;
        if (!window.confirm(warning)) return;
        setDeletingId(bill.id);
        setMenuId('');
        try {
            await deleteInventoryBill(bill.id);
            toast({
                title: 'Bill deleted',
                description: bill.status === 'Draft'
                    ? 'The draft was removed.'
                    : bill.stockApplied
                        ? 'The bill was removed and its stock was taken off the items.'
                        : 'The bill was removed.',
            });
            await load();
        } catch (deleteError) {
            toast({
                title: 'Could not delete',
                description: billsApiMessage(deleteError, 'Could not delete this bill.'),
                variant: 'destructive',
            });
        } finally {
            setDeletingId('');
        }
    };

    const notificationRows = useMemo(
        () => notices.map((notice, index) => mapDashboardNotificationToRow({
            id: notice.id,
            requestType: 'Inventory Bill Draft',
            type: 'Inventory Bill Draft',
            extra1: notice.billNo || 'Draft bill',
            extra2: notice.message,
            subjectName: 'Bills',
            status: 'Pending',
            requestedDate: notice.updatedAt,
        }, index)),
        [notices],
    );

    const sortedRows = useMemo(() => {
        const indexed = rows.map((bill, index) => ({ bill, index }));
        if (!sortKey) return indexed;
        const factor = sortDir === 'desc' ? -1 : 1;
        return [...indexed].sort((left, right) => {
            const a = billSortValue(left.bill, sortKey, left.index);
            const b = billSortValue(right.bill, sortKey, right.index);
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
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Bills</h1>
                    <p className="mt-1 text-sm text-slate-500">Each bill is listed once.</p>
                </div>
                <div className="flex items-center gap-2">
                    {canAddBill ? (
                        <button
                            type="button"
                            onClick={() => {
                                setEditEntryId('');
                                setAddOpen(true);
                            }}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <Receipt size={15} />
                            Add Bill
                        </button>
                    ) : null}
                    <button
                        type="button"
                        aria-label="Draft bill notifications"
                        aria-expanded={showNotifications}
                        onClick={() => setShowNotifications(true)}
                        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6EDF5] bg-white text-slate-600 hover:bg-slate-50"
                    >
                        <Bell size={18} />
                        {notices.length ? (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {notices.length > 99 ? '99+' : notices.length}
                            </span>
                        ) : null}
                    </button>
                </div>
            </div>
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                            {COLUMNS.map((column) => (
                                <SortHeading
                                    key={column.label}
                                    label={column.label}
                                    columnKey={column.key}
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSort={toggleSort}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">Loading bills...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">No bills yet.</td>
                            </tr>
                        ) : sortedRows.map(({ bill }, index) => (
                            <tr
                                key={bill.id}
                                onClick={() => {
                                    setEditEntryId('');
                                    setViewEntryId(bill.id);
                                }}
                                className="cursor-pointer border-b border-slate-100 text-slate-700 hover:bg-slate-50"
                            >
                                <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-500">{index + 1}</td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">{shown(bill.billNo)}</td>
                                <td className="max-w-[220px] truncate px-4 py-3.5">
                                    {bill.vendorId ? (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                router.push(`/inventory/vendor-management/${bill.vendorId}`);
                                            }}
                                            className="max-w-full truncate font-medium text-indigo-600 hover:underline"
                                        >
                                            {shown(bill.vendorName)}
                                        </button>
                                    ) : shown(bill.vendorName)}
                                </td>
                                <td className="max-w-[180px] truncate px-4 py-3.5">{shown(bill.paymentTerms)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{shown(formatPurchaseDate(bill.purchaseDate))}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">{shown(bill.lpoNo)}</td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(bill.status)}`}>
                                        {shown(bill.status)}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                    {bill.attachment?.url ? (
                                        <a
                                            href={bill.attachment.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(event) => event.stopPropagation()}
                                            className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline"
                                        >
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {bill.attachment.name || 'Attachment'}
                                        </a>
                                    ) : bill.attachment?.name ? (
                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {bill.attachment.name}
                                        </span>
                                    ) : 'N/A'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                                    <div className="relative" ref={menuId === bill.id ? menuRef : null}>
                                        <button
                                            type="button"
                                            aria-label={`Actions for ${bill.billNo || 'bill'}`}
                                            aria-expanded={menuId === bill.id}
                                            onClick={(event) => {
                                                const rect = event.currentTarget.getBoundingClientRect();
                                                const openUp = rect.bottom + 96 > window.innerHeight;
                                                setMenuPos({
                                                    top: openUp ? rect.top - 4 : rect.bottom + 4,
                                                    left: rect.right,
                                                    openUp,
                                                });
                                                setMenuId((current) => (current === bill.id ? '' : bill.id));
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                        {menuId === bill.id && menuPos ? (
                                            <div
                                                className="fixed z-50 w-36 overflow-hidden rounded-xl border border-[#E6EDF5] bg-white py-1 shadow-xl"
                                                style={{
                                                    top: menuPos.top,
                                                    left: menuPos.left,
                                                    transform: menuPos.openUp ? 'translate(-100%, -100%)' : 'translateX(-100%)',
                                                }}
                                            >
                                                {canManage ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setViewEntryId('');
                                                        setEditEntryId(bill.id);
                                                        setMenuId('');
                                                    }}
                                                    className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                >
                                                    Edit
                                                </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    disabled={bill.deleteDisabled || deletingId === bill.id}
                                                    title={bill.deleteDisabled ? bill.deleteReason : undefined}
                                                    onClick={() => removeBill(bill)}
                                                    className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {addOpen ? (
                <AddStockModal
                    onClose={() => {
                        setAddOpen(false);
                        load();
                    }}
                    onSaved={() => {
                        setAddOpen(false);
                        load();
                    }}
                />
            ) : null}
            {viewEntryId ? (
                <AddStockModal
                    key={`view-${viewEntryId}`}
                    editEntryId={viewEntryId}
                    viewOnly
                    onClose={() => setViewEntryId('')}
                />
            ) : null}
            <NotificationInboxModal
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                title="Draft bills"
                subtitle="Bills you saved as a draft."
                items={notificationRows}
                loading={loading && notices.length === 0}
                emptyMessage="No draft bills."
                getItemHref={(item) => (item?.id ? `/inventory/bills?bill=${item.id}` : '')}
                onItemClick={(item) => {
                    if (!item?.id) return;
                    setEditEntryId(item.id);
                    setShowNotifications(false);
                }}
            />
            {editEntryId ? (
                <AddStockModal
                    key={editEntryId}
                    editEntryId={editEntryId}
                    allowEdit={canManage}
                    onClose={() => {
                        setEditEntryId('');
                        load();
                    }}
                    onSaved={load}
                />
            ) : null}
        </section>
    );
}
