'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import CatalogModal, { fieldClass, labelClass } from '../item-master/CatalogModal';
import { listBrands, listCategories, listItems } from '../item-master/itemMasterApi';
import { createVendorContact, updateVendorContact, vendorApiMessage } from './vendorManagementApi';

const EMPTY_ENTRY = { email: '', phone: '', itemId: '', categoryId: '', brandId: '' };

function itemLabel(item) {
    const description = String(item?.description || '');
    const short = description.length > 48 ? `${description.slice(0, 48)}...` : description;
    return [item?.itemCode, short].filter(Boolean).join(' — ');
}

async function loadItems() {
    const first = await listItems({ page: 1, limit: 100 });
    const items = Array.isArray(first?.items) ? [...first.items] : [];
    const total = Number(first?.total) || items.length;
    let page = 2;
    while (items.length < total && page <= 20) {
        const next = await listItems({ page, limit: 100 });
        const rows = Array.isArray(next?.items) ? next.items : [];
        if (!rows.length) break;
        items.push(...rows);
        page += 1;
    }
    return items;
}

function entriesFromContact(contact) {
    if (!contact) return [{ ...EMPTY_ENTRY }];
    const count = Math.max(contact.emails?.length || 0, contact.phones?.length || 0, contact.lines?.length || 0, 1);
    return Array.from({ length: count }, (_, index) => ({
        email: contact.emails?.[index] || '',
        phone: contact.phones?.[index] || '',
        itemId: contact.lines?.[index]?.itemId || '',
        categoryId: contact.lines?.[index]?.categoryId || '',
        brandId: contact.lines?.[index]?.brandId || '',
    }));
}

export default function AddContactModal({ vendorId, contact, onClose, onSaved }) {
    const [name, setName] = useState(contact?.name || '');
    const [designation, setDesignation] = useState(contact?.designation || '');
    const [isPrimary, setIsPrimary] = useState(Boolean(contact?.isPrimary));
    const [entries, setEntries] = useState(() => entriesFromContact(contact));
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        Promise.all([loadItems(), listCategories(), listBrands()])
            .then(([itemRows, categoryRows, brandRows]) => {
                if (cancelled) return;
                setItems(itemRows);
                setCategories(Array.isArray(categoryRows) ? categoryRows : []);
                setBrands(Array.isArray(brandRows) ? brandRows : []);
            })
            .catch((loadError) => {
                if (!cancelled) setError(vendorApiMessage(loadError, 'Could not load items.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function updateEntry(index, patch) {
        setEntries((current) => current.map((entry, entryIndex) => (
            entryIndex === index ? { ...entry, ...patch } : entry
        )));
    }

    function chooseItem(index, itemId) {
        const item = items.find((row) => String(row._id) === itemId);
        updateEntry(index, {
            itemId,
            categoryId: item?.categoryId || '',
            brandId: item?.brandId || '',
        });
    }

    async function onSubmit(event) {
        event.preventDefault();
        if (!name.trim()) {
            setError('Name is required.');
            return;
        }
        setSaving(true);
        setError('');
        const payload = { name: name.trim(), designation: designation.trim(), isPrimary, entries };
        try {
            if (contact?.id) await updateVendorContact(vendorId, contact.id, payload);
            else await createVendorContact(vendorId, payload);
            onSaved();
        } catch (saveError) {
            setError(vendorApiMessage(saveError, 'Could not save this contact.'));
            setSaving(false);
        }
    }

    return (
        <CatalogModal title={contact ? 'Edit Contact' : 'Add Contact'} onClose={onClose} wide>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
                <div className="max-h-[min(40rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className={labelClass}>Name</span>
                            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
                        </label>
                        <label className="block">
                            <span className={labelClass}>Designation</span>
                            <input className={fieldClass} value={designation} onChange={(event) => setDesignation(event.target.value)} />
                        </label>
                    </div>

                    <div className="mt-4 space-y-4">
                        {entries.map((entry, index) => (
                            <div key={index} className="rounded-xl border border-[#E6EDF5] p-3">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-700">Contact details {entries.length > 1 ? index + 1 : ''}</p>
                                    {entries.length > 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                            aria-label="Remove"
                                        >
                                            <X size={14} />
                                        </button>
                                    ) : null}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                        <span className={labelClass}>Email</span>
                                        <input className={fieldClass} value={entry.email} onChange={(event) => updateEntry(index, { email: event.target.value })} />
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Phone</span>
                                        <input className={fieldClass} value={entry.phone} onChange={(event) => updateEntry(index, { phone: event.target.value })} />
                                    </label>
                                    <label className="block sm:col-span-2">
                                        <span className={labelClass}>Product handling</span>
                                        <select className={fieldClass} value={entry.itemId} disabled={loading} onChange={(event) => chooseItem(index, event.target.value)}>
                                            <option value="">{loading ? 'Loading items...' : 'Select an item'}</option>
                                            {items.map((item) => (
                                                <option key={item._id} value={item._id}>{itemLabel(item)}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Category</span>
                                        <select className={fieldClass} value={entry.categoryId} disabled={loading} onChange={(event) => updateEntry(index, { categoryId: event.target.value })}>
                                            <option value="">Select a category</option>
                                            {categories.map((category) => (
                                                <option key={category._id} value={category._id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Brand</span>
                                        <select className={fieldClass} value={entry.brandId} disabled={loading} onChange={(event) => updateEntry(index, { brandId: event.target.value })}>
                                            <option value="">Select a brand</option>
                                            {brands.map((brand) => (
                                                <option key={brand._id} value={brand._id}>{brand.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => setEntries((current) => [...current, { ...EMPTY_ENTRY }])}
                        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 text-sm font-medium text-slate-700"
                    >
                        <Plus size={14} />
                        Add more
                    </button>

                    <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={isPrimary}
                            onChange={(event) => setIsPrimary(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        Make as primary contact
                    </label>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E6EDF5] px-5 py-4">
                    <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'OK'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}
