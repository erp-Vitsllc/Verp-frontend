'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Package, Paperclip, Pencil } from 'lucide-react';
import { useInventoryAccess } from './itemMasterAccess';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import { apiMessage, listItemDeliveryHistory, listItemDocuments, listItemPurchaseHistory } from './itemMasterApi';
import { saveItemDuplicateDraft } from './itemDuplicateDraft';
import AddStockModal from './AddStockModal';
import AddDeliveryModal from '../delivery/AddDeliveryModal';

const TABS = ['Overview', 'Purchase History', 'Delivery History', 'Documents'];

const statusClass = {
    'Stock In': 'bg-emerald-50 text-emerald-600',
    Active: 'bg-emerald-50 text-emerald-600',
    'Low Stock': 'bg-orange-50 text-orange-600',
    'Out of Stock': 'bg-red-50 text-red-600',
};

function unitWord(quantity, unit) {
    const plural = { Box: 'Boxes', Metre: 'Metres', Quantity: 'Quantity' };
    const single = { Box: 'Box', Metre: 'Metre', Quantity: 'Quantity' };
    return `${quantity} ${Number(quantity) === 1 ? (single[unit] || unit) : (plural[unit] || unit)}`;
}

function formatPurchaseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '—';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InfoTable({ title, rows, action, note }) {
    return (
        <section className="flex h-full flex-col rounded-xl border border-[#E6EDF5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E6EDF5] px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
                {action || null}
            </div>
            <table className="w-full text-sm">
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.label} className="border-t border-[#F1F5F9]">
                            <th className="w-[42%] px-4 py-2.5 text-left font-medium text-slate-500">{row.label}</th>
                            <td className="px-4 py-2.5 text-slate-800">{row.value || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {note || null}
        </section>
    );
}

function PurchaseHistory({ itemId }) {
    const router = useRouter();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [billId, setBillId] = useState('');

    useEffect(() => {
        if (!itemId) return undefined;
        let cancelled = false;
        setLoading(true);
        listItemPurchaseHistory(itemId)
            .then((data) => {
                if (cancelled) return;
                setRows(Array.isArray(data?.purchases) ? data.purchases : []);
                setError('');
            })
            .catch((loadError) => {
                if (cancelled) return;
                setRows([]);
                setError(apiMessage(loadError, 'Could not load purchase history.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [itemId]);

    return (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E6EDF5]">
            {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-[#E6EDF5] bg-[#F8FAFC] text-slate-500">
                        {['Purchase Date', 'Vendor Name', 'Bill No', 'Qty Added', 'Unit Price'].map((heading) => (
                            <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${['Qty Added', 'Unit Price'].includes(heading) ? 'text-right' : ''}`}>{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading purchase history...</td>
                        </tr>
                    ) : rows.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-400">No purchase history yet.</td>
                        </tr>
                    ) : rows.map((row) => (
                        <tr
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => row.entryId && setBillId(String(row.entryId))}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    if (row.entryId) setBillId(String(row.entryId));
                                }
                            }}
                            className="cursor-pointer border-t border-[#F1F5F9] text-slate-700 hover:bg-[#F8FAFC]"
                        >
                            <td className="whitespace-nowrap px-4 py-3">{formatPurchaseDate(row.purchaseDate)}</td>
                            <td className="max-w-[240px] truncate px-4 py-3">
                                {row.vendorId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            router.push(`/inventory/vendor-management/${row.vendorId}`);
                                        }}
                                        className="max-w-full truncate font-medium text-indigo-600 hover:underline"
                                    >
                                        {row.vendorName || 'Vendor'}
                                    </button>
                                ) : (row.vendorName || '—')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.billNo || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{row.quantity ?? 0}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPrice(row.unitPrice)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {billId ? (
                <AddStockModal
                    viewOnly
                    editEntryId={billId}
                    onClose={() => setBillId('')}
                />
            ) : null}
        </div>
    );
}

function DeliveryHistory({ itemId }) {
    const router = useRouter();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [delivery, setDelivery] = useState(null);

    useEffect(() => {
        if (!itemId) return undefined;
        let cancelled = false;
        setLoading(true);
        listItemDeliveryHistory(itemId)
            .then((data) => {
                if (cancelled) return;
                setRows(Array.isArray(data?.deliveries) ? data.deliveries : []);
                setError('');
            })
            .catch((loadError) => {
                if (cancelled) return;
                setRows([]);
                setError(apiMessage(loadError, 'Could not load delivery history.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [itemId]);

    const openDelivery = (row) => {
        if (row?.delivery) setDelivery(row.delivery);
    };

    return (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E6EDF5]">
            {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-[#E6EDF5] bg-[#F8FAFC] text-slate-500">
                        {['Delivery Date', 'Customer Name', 'DO No', 'Qty', 'Unit Price'].map((heading) => (
                            <th key={heading} className={`whitespace-nowrap px-4 py-3 font-medium ${['Qty', 'Unit Price'].includes(heading) ? 'text-right' : ''}`}>{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading delivery history...</td>
                        </tr>
                    ) : rows.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-400">No delivery history yet.</td>
                        </tr>
                    ) : rows.map((row) => (
                        <tr
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openDelivery(row)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    openDelivery(row);
                                }
                            }}
                            className="cursor-pointer border-t border-[#F1F5F9] text-slate-700 hover:bg-[#F8FAFC]"
                        >
                            <td className="whitespace-nowrap px-4 py-3">{formatPurchaseDate(row.deliveryDate)}</td>
                            <td className="max-w-[240px] truncate px-4 py-3">
                                {row.customerId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            router.push(`/CRM/Customer/${row.customerId}`);
                                        }}
                                        className="max-w-full truncate font-medium text-indigo-600 hover:underline"
                                    >
                                        {row.customerName || 'Customer'}
                                    </button>
                                ) : (row.customerName || '—')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        openDelivery(row);
                                    }}
                                    className="font-medium text-indigo-600 hover:underline"
                                >
                                    {row.deliveryNo || '—'}
                                </button>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{row.quantity ?? 0}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPrice(row.unitPrice)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {delivery ? (
                <AddDeliveryModal
                    readOnly
                    delivery={delivery}
                    onClose={() => setDelivery(null)}
                    onSaved={() => setDelivery(null)}
                />
            ) : null}
        </div>
    );
}

function Documents({ itemId }) {
    const router = useRouter();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [billId, setBillId] = useState('');

    useEffect(() => {
        if (!itemId) return undefined;
        let cancelled = false;
        setLoading(true);
        listItemDocuments(itemId)
            .then((data) => {
                if (cancelled) return;
                setRows(Array.isArray(data?.documents) ? data.documents : []);
                setError('');
            })
            .catch((loadError) => {
                if (cancelled) return;
                setRows([]);
                setError(apiMessage(loadError, 'Could not load documents.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [itemId]);

    return (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E6EDF5]">
            {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
            <table className="min-w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-[#E6EDF5] bg-[#F8FAFC] text-slate-500">
                        {['Purchase Date', 'Vendor Name', 'Bill No', 'Attachment'].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-slate-500">Loading documents...</td>
                        </tr>
                    ) : rows.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-slate-400">No bill attachments yet.</td>
                        </tr>
                    ) : rows.map((row) => (
                        <tr
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => row.entryId && setBillId(String(row.entryId))}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    if (row.entryId) setBillId(String(row.entryId));
                                }
                            }}
                            className="cursor-pointer border-t border-[#F1F5F9] text-slate-700 hover:bg-[#F8FAFC]"
                        >
                            <td className="whitespace-nowrap px-4 py-3">{formatPurchaseDate(row.purchaseDate)}</td>
                            <td className="max-w-[240px] truncate px-4 py-3">
                                {row.vendorId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            router.push(`/inventory/vendor-management/${row.vendorId}`);
                                        }}
                                        className="max-w-full truncate font-medium text-indigo-600 hover:underline"
                                    >
                                        {row.vendorName || 'Vendor'}
                                    </button>
                                ) : (row.vendorName || '—')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.billNo || '—'}</td>
                            <td className="max-w-[280px] truncate px-4 py-3">
                                {row.fileUrl ? (
                                    <a
                                        href={row.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        className="inline-flex max-w-full items-center gap-1.5 font-medium text-indigo-600 hover:underline"
                                    >
                                        <Paperclip size={14} className="shrink-0" />
                                        <span className="truncate">{row.fileName || 'Attachment'}</span>
                                    </a>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                                        <Paperclip size={14} />
                                        {row.fileName || 'Attachment'}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {billId ? (
                <AddStockModal
                    viewOnly
                    editEntryId={billId}
                    onClose={() => setBillId('')}
                />
            ) : null}
        </div>
    );
}

export default function ItemDetail({ item }) {
    const router = useRouter();
    const access = useInventoryAccess();
    const [tab, setTab] = useState('Overview');
    const onHand = Number(item.availableQuantity) || 0;
    const brought = Number(item.broughtQuantity) || 0;
    const sold = Number(item.soldQuantity) || 0;
    const reserved = Number(item.reservationQuantity) || 0;
    const categoryPath = [item.categoryName, item.subcategoryName, item.itemName].filter(Boolean).join(' > ');

    const duplicate = () => {
        if (!saveItemDuplicateDraft(item)) return;
        router.push('/inventory/item-master/duplicate');
    };

    return (
        <div className="rounded-2xl border border-[#E6EDF5] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (!tryNavigateListReturn(router)) router.push('/inventory/item-master');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                    >
                        Back
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">Item Detail</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {access.canEditItem ? (
                        <button
                            type="button"
                            onClick={() => router.push(`/inventory/item-master/${item._id}/edit`)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                        >
                            <Pencil size={14} /> Edit
                        </button>
                    ) : null}
                    {access.canCreateItem ? (
                        <button
                            type="button"
                            onClick={duplicate}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                        >
                            <Copy size={14} /> Duplicate
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]">
                <div className="flex gap-4 rounded-xl border border-[#E6EDF5] p-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E6EDF5] bg-[#F8FAFC]">
                        {item.subcategoryImage ? (
                            <img src={item.subcategoryImage} alt={item.subcategoryName || 'Subcategory'} className="h-full w-full object-contain" />
                        ) : (
                            <Package className="text-slate-300" size={36} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold leading-snug text-slate-900">{item.description}</h2>
                        <p className="mt-1 text-sm text-slate-500">Model: {item.modelNumber}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${String(item.status || '').startsWith('Waiting for ') ? 'bg-amber-50 text-amber-700' : (statusClass[item.status] || 'bg-slate-100 text-slate-600')}`}>
                                {item.status}
                            </span>
                            {item.itemName ? (
                                <span className="rounded-md border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">{item.itemName}</span>
                            ) : null}
                            {item.brandName ? (
                                <span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">{item.brandName}</span>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-[#E6EDF5] p-4">
                    <p className="text-xs text-slate-500">Current Stock</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{unitWord(onHand, item.unitOfMeasure)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#F1F5F9] pt-3">
                        <div>
                            <p className="text-xs text-slate-400">Brought</p>
                            <p className="font-semibold text-slate-800">{unitWord(brought, item.unitOfMeasure)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Sold</p>
                            <p className="font-semibold text-slate-800">{unitWord(sold, item.unitOfMeasure)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex gap-4 overflow-x-auto border-b border-[#E6EDF5]">
                {TABS.map((name) => (
                    <button
                        key={name}
                        type="button"
                        onClick={() => setTab(name)}
                        className={`shrink-0 border-b-2 px-1 pb-2 text-sm font-medium ${tab === name ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
                    >
                        {name}
                    </button>
                ))}
            </div>

            {tab === 'Overview' ? (
                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <InfoTable
                        title="Item Information"
                        rows={[
                            { label: 'Item Code', value: item.itemCode },
                            { label: 'Item Name', value: item.itemName },
                            { label: 'Brand', value: item.brandName },
                            { label: 'Category', value: categoryPath },
                            { label: 'Model Number', value: item.modelNumber },
                            { label: 'Unit of Measure', value: item.unitOfMeasure },
                        ]}
                    />
                    <InfoTable
                        title="Details"
                        action={access.canEditItem ? (
                            <button
                                type="button"
                                onClick={() => router.push(`/inventory/item-master/${item._id}/edit`)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500"
                            >
                                <Pencil size={12} /> Edit
                            </button>
                        ) : null}
                        rows={[
                            { label: 'Manufacturer Part Number', value: item.manufacturerPartNumber },
                            { label: 'HS Code', value: item.hsCode },
                            { label: 'Country of Origin', value: item.countryOfOrigin },
                            { label: 'Reservation Quantity', value: unitWord(reserved, item.unitOfMeasure) },
                        ]}
                    />
                </div>
            ) : tab === 'Purchase History' ? (
                <PurchaseHistory itemId={item._id} />
            ) : tab === 'Delivery History' ? (
                <DeliveryHistory itemId={item._id} />
            ) : (
                <Documents itemId={item._id} />
            )}
        </div>
    );
}
