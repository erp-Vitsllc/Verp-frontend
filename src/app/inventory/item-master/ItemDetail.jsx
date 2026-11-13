'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Package, Pencil } from 'lucide-react';
import { useInventoryAccess } from './itemMasterAccess';
import { saveItemDuplicateDraft } from './itemDuplicateDraft';

const TABS = ['Overview', 'Stock', 'Vendors', 'Price History', 'Purchases', 'Transactions', 'Documents'];

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

export default function ItemDetail({ item }) {
    const router = useRouter();
    const access = useInventoryAccess();
    const [tab, setTab] = useState('Overview');
    const available = Number(item.availableQuantity) || 0;
    const reserved = Number(item.reservationQuantity) || 0;
    const current = available + reserved;
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
                        onClick={() => router.push('/inventory/item-master')}
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
                            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${statusClass[item.status] || 'bg-slate-100 text-slate-600'}`}>
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
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{unitWord(current, item.unitOfMeasure)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#F1F5F9] pt-3">
                        <div>
                            <p className="text-xs text-slate-400">Available</p>
                            <p className="font-semibold text-slate-800">{unitWord(available, item.unitOfMeasure)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Reserved</p>
                            <p className="font-semibold text-slate-800">{unitWord(reserved, item.unitOfMeasure)}</p>
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
                        note={(
                            <div className="flex-1 border-t border-[#F1F5F9] px-4 py-3">
                                <p className="text-sm font-medium text-slate-500">More Description</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{item.moreDescription || '—'}</p>
                            </div>
                        )}
                    />
                </div>
            ) : (
                <p className="px-1 py-10 text-center text-sm text-slate-400">No {tab.toLowerCase()} records yet.</p>
            )}
        </div>
    );
}
