'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import { useToast } from '@/hooks/use-toast';
import ItemMasterShell from '../ItemMasterShell';
import { useInventoryAccess } from '../itemMasterAccess';
import { addItemStock, apiMessage, listCategories, listStockOptions, listSubcategories } from '../itemMasterApi';

const fieldClass = 'h-11 w-full rounded-lg border border-[#E6EDF5] bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500';

function sameId(left, right) {
    return String(left || '') === String(right || '');
}

function itemLabel(item) {
    const name = item.itemName || item.description || 'Item';
    return item.itemCode ? `${item.itemCode} — ${name}` : name;
}

function SearchSelect({ label, value, options, placeholder, onChange }) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const selected = options.find((option) => option.value === value);
    const needle = query.trim().toLowerCase();
    const shown = needle
        ? options.filter((option) => option.label.toLowerCase().includes(needle))
        : options;

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
            <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                    setOpen((current) => !current);
                    setQuery('');
                }}
                className={`${fieldClass} flex items-center justify-between text-left`}
            >
                <span className={selected ? 'truncate text-slate-800' : 'truncate text-slate-400'}>
                    {selected?.label || placeholder}
                </span>
                <ChevronDown size={16} className="shrink-0 text-slate-400" />
            </button>
            {open ? (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[#E6EDF5] bg-white shadow-lg">
                    <input
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search"
                        className="h-10 w-full border-b border-[#E6EDF5] px-3 text-sm outline-none"
                    />
                    <ul className="max-h-56 overflow-y-auto py-1">
                        {shown.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
                        ) : shown.map((option) => (
                            <li key={option.value}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
                                >
                                    {option.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

export default function AddStockPage() {
    const router = useRouter();
    const { toast } = useToast();
    const access = useInventoryAccess();
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [items, setItems] = useState([]);
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [itemId, setItemId] = useState('');
    const [modelNumber, setModelNumber] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        Promise.all([listCategories(), listSubcategories(), listStockOptions()])
            .then(([categoryResult, subcategoryResult, stockResult]) => {
                if (cancelled) return;
                setCategories(Array.isArray(categoryResult) ? categoryResult : []);
                setSubcategories(Array.isArray(subcategoryResult) ? subcategoryResult : []);
                setItems(Array.isArray(stockResult?.items) ? stockResult.items : []);
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load stock options.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const categoryOptions = useMemo(() => (
        categories.map((row) => ({ value: String(row._id), label: row.name || 'Category' }))
    ), [categories]);

    const subcategoryOptions = useMemo(() => (
        subcategories
            .filter((row) => !categoryId || sameId(row.categoryId, categoryId))
            .map((row) => ({ value: String(row._id), label: row.name || 'Sub category' }))
    ), [subcategories, categoryId]);

    const filteredItems = useMemo(() => items.filter((item) => {
        if (categoryId && !sameId(item.categoryId, categoryId)) return false;
        if (subcategoryId && !sameId(item.subcategoryId, subcategoryId)) return false;
        if (modelNumber && item.modelNumber !== modelNumber) return false;
        return true;
    }), [items, categoryId, subcategoryId, modelNumber]);

    const itemOptions = useMemo(() => (
        filteredItems.map((item) => ({ value: String(item._id), label: itemLabel(item) }))
    ), [filteredItems]);

    const modelOptions = useMemo(() => {
        const pool = items.filter((item) => {
            if (categoryId && !sameId(item.categoryId, categoryId)) return false;
            if (subcategoryId && !sameId(item.subcategoryId, subcategoryId)) return false;
            if (itemId && !sameId(item._id, itemId)) return false;
            return Boolean(item.modelNumber);
        });
        return [...new Set(pool.map((item) => item.modelNumber))].sort().map((model) => ({
            value: model,
            label: model,
        }));
    }, [items, categoryId, subcategoryId, itemId]);

    const chooseCategory = (nextId) => {
        const currentSub = subcategories.find((row) => sameId(row._id, subcategoryId));
        const currentItem = items.find((row) => sameId(row._id, itemId));
        const keepSub = currentSub && sameId(currentSub.categoryId, nextId);
        const keepItem = currentItem && sameId(currentItem.categoryId, nextId) && (!keepSub || sameId(currentItem.subcategoryId, subcategoryId));
        setCategoryId(nextId);
        setSubcategoryId(keepSub ? subcategoryId : '');
        setItemId(keepItem ? itemId : '');
        setModelNumber(keepItem ? (currentItem.modelNumber || '') : '');
    };

    const chooseSubcategory = (nextId) => {
        const sub = subcategories.find((row) => sameId(row._id, nextId));
        const currentItem = items.find((row) => sameId(row._id, itemId));
        const keepItem = currentItem && sameId(currentItem.subcategoryId, nextId);
        const modelStillThere = items.some((row) => sameId(row.subcategoryId, nextId) && row.modelNumber === modelNumber);
        setSubcategoryId(nextId);
        if (sub?.categoryId) setCategoryId(String(sub.categoryId));
        setItemId(keepItem ? itemId : '');
        setModelNumber(keepItem ? (currentItem.modelNumber || '') : (modelStillThere ? modelNumber : ''));
    };

    const chooseItem = (nextId) => {
        const item = items.find((row) => sameId(row._id, nextId));
        if (!item) return;
        setItemId(String(item._id));
        setCategoryId(String(item.categoryId || ''));
        setSubcategoryId(String(item.subcategoryId || ''));
        setModelNumber(item.modelNumber || '');
    };

    const chooseModel = (nextModel) => {
        const pool = items.filter((item) => (
            item.modelNumber === nextModel
            && (!categoryId || sameId(item.categoryId, categoryId))
            && (!subcategoryId || sameId(item.subcategoryId, subcategoryId))
        ));
        if (pool.length === 1) {
            chooseItem(pool[0]._id);
            return;
        }
        setModelNumber(nextModel);
        if (!pool.some((item) => sameId(item._id, itemId))) setItemId('');
    };

    const leave = () => {
        if (!tryNavigateListReturn(router)) router.push('/inventory/item-master');
    };

    const save = async (event) => {
        event.preventDefault();
        const amount = Number(quantity);
        const cost = Number(price);
        if (!itemId) {
            setError('Select an item.');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setError('Enter a quantity greater than zero.');
            return;
        }
        if (price === '' || !Number.isFinite(cost) || cost < 0) {
            setError('Enter a price.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const saved = await addItemStock(itemId, { quantity: amount, price: cost });
            toast({
                title: 'Stock added',
                description: `${saved.itemCode || 'Item'} available is now ${saved.availableQuantity}.`,
            });
            leave();
        } catch (err) {
            const message = apiMessage(err, 'Could not add stock.');
            setError(message);
            toast({ title: 'Could not add stock', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const allowed = access.canCreateItem || access.canEditItem;

    return (
        <ItemMasterShell>
            {access.ready && !allowed ? (
                <p className="rounded-2xl border border-[#E6EDF5] bg-white p-5 text-sm text-slate-500">You do not have permission to add stock.</p>
            ) : null}
            {allowed ? (
                <form onSubmit={save} className="mx-auto max-w-3xl rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
                    <h1 className="text-2xl font-bold text-slate-900">Add Stock</h1>
                    <p className="mt-1 text-sm text-slate-500">The quantity is added to the selected item’s available stock.</p>
                    {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    {loading ? <p className="mt-4 text-sm text-slate-500">Loading items...</p> : (
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <SearchSelect label="Sub category" value={subcategoryId} options={subcategoryOptions} placeholder="Select sub category" onChange={chooseSubcategory} />
                            <SearchSelect label="Category" value={categoryId} options={categoryOptions} placeholder="Select category" onChange={chooseCategory} />
                            <SearchSelect label="Item" value={itemId} options={itemOptions} placeholder="Select item" onChange={chooseItem} />
                            <SearchSelect label="Model no" value={modelNumber} options={modelOptions} placeholder="Select model no" onChange={chooseModel} />
                            <label>
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</span>
                                <input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={fieldClass} />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Price</span>
                                <input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className={fieldClass} />
                            </label>
                        </div>
                    )}
                    <div className="mt-5 flex justify-end gap-2">
                        <button type="button" onClick={leave} className="h-10 rounded-lg border border-[#E6EDF5] px-4 text-sm font-semibold text-slate-600">Cancel</button>
                        <button type="submit" disabled={saving || loading} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                            {saving ? 'Saving…' : 'Add Stock'}
                        </button>
                    </div>
                </form>
            ) : null}
        </ItemMasterShell>
    );
}
