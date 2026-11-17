'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CatalogModal from './CatalogModal';
import { useInventoryAccess } from './itemMasterAccess';
import {
    addItemStock,
    apiMessage,
    createPendingItem,
    listBrands,
    listCategories,
    listStockOptions,
    listSubcategories,
} from './itemMasterApi';

const fieldClass = 'h-11 w-full rounded-lg border border-[#E6EDF5] bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500';

function sameId(left, right) {
    return String(left || '') === String(right || '');
}

function cleanText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function sameText(left, right) {
    return cleanText(left) === cleanText(right);
}

function itemLabel(item) {
    const name = item.itemName || item.description || 'Item';
    return item.itemCode ? `${item.itemCode} — ${name}` : name;
}

function sameStockIdentity(item, categoryId, subcategoryId, brandId, modelNumber) {
    return sameId(item.categoryId, categoryId)
        && sameId(item.subcategoryId, subcategoryId)
        && sameId(item.brandId, brandId)
        && sameText(item.modelNumber, modelNumber);
}

function modelOwners(model, rows) {
    const text = cleanText(model);
    if (!text) return [];
    return rows.filter((row) => sameText(row.modelNumber, text));
}

const MODEL_FIXED = 'This model no belongs to the selected item and cannot be changed.';

function optionMatches(option, needle) {
    const haystack = cleanText(option.searchText || option.label).toLowerCase();
    return haystack.includes(needle);
}

function stockRow(saved) {
    return {
        _id: saved._id,
        itemCode: saved.itemCode || '',
        description: saved.description || '',
        modelNumber: saved.modelNumber || '',
        availableQuantity: saved.availableQuantity || 0,
        categoryId: String(saved.categoryId || ''),
        subcategoryId: String(saved.subcategoryId || ''),
        brandId: String(saved.brandId || ''),
        itemName: saved.itemName || saved.description || '',
        brandName: saved.brandName || '',
        pendingStock: Boolean(saved.pendingStock),
    };
}

function itemStillVisible(item, nextCategory, nextSub) {
    if (!item) return false;
    if (item.pendingStock) return true;
    if (nextCategory && !sameId(item.categoryId, nextCategory)) return false;
    if (nextSub && !sameId(item.subcategoryId, nextSub)) return false;
    return true;
}

function SearchSelect({ label, value, options, placeholder, onChange, onCreate, creating }) {
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [menuStyle, setMenuStyle] = useState(null);
    const selected = options.find((option) => option.value === value);
    const needle = query.trim().toLowerCase();
    const shown = needle ? options.filter((option) => optionMatches(option, needle)) : options;
    const canCreate = Boolean(onCreate) && Boolean(needle) && shown.length === 0;

    useLayoutEffect(() => {
        if (!open) return undefined;
        const place = () => {
            const rect = rootRef.current?.getBoundingClientRect();
            if (!rect) return;
            setMenuStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                zIndex: 80,
            });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            if (menuRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const menu = open && menuStyle ? createPortal(
        <div
            ref={menuRef}
            style={menuStyle}
            className="overflow-hidden rounded-lg border border-[#E6EDF5] bg-white shadow-lg"
        >
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
                    <li key={`${option.label}:${option.value}`}>
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
            {canCreate ? (
                <button
                    type="button"
                    disabled={creating}
                    onClick={() => {
                        const text = query.trim();
                        setOpen(false);
                        setQuery('');
                        onCreate(text);
                    }}
                    className="flex w-full items-center gap-2 border-t border-[#E6EDF5] px-3 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                    <Plus size={15} /> Add {query.trim()}
                </button>
            ) : null}
        </div>,
        document.body,
    ) : null;

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
            {menu}
        </div>
    );
}

export default function AddStockModal({ onClose, onSaved }) {
    const { toast } = useToast();
    const access = useInventoryAccess();
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [items, setItems] = useState([]);
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [itemId, setItemId] = useState('');
    const [modelNumber, setModelNumber] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        Promise.all([listCategories(), listSubcategories(), listBrands(), listStockOptions()])
            .then(([categoryResult, subcategoryResult, brandResult, stockResult]) => {
                if (cancelled) return;
                setCategories(Array.isArray(categoryResult) ? categoryResult : []);
                setSubcategories(Array.isArray(subcategoryResult) ? subcategoryResult : []);
                setBrands(Array.isArray(brandResult) ? brandResult : []);
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

    const subcategoryOptions = useMemo(() => {
        const rows = categoryId
            ? subcategories.filter((row) => sameId(row.categoryId, categoryId))
            : subcategories;
        return rows.map((row) => ({ value: String(row._id), label: row.name || 'Sub category' }));
    }, [subcategories, categoryId]);

    const brandOptions = useMemo(() => (
        brands.map((row) => ({ value: String(row._id), label: row.name || 'Brand' }))
    ), [brands]);

    const scopedItems = useMemo(() => items.filter((item) => {
        if (item.pendingStock) return true;
        if (categoryId && !sameId(item.categoryId, categoryId)) return false;
        if (subcategoryId && !sameId(item.subcategoryId, subcategoryId)) return false;
        return true;
    }), [items, categoryId, subcategoryId]);

    const itemOptions = useMemo(
        () => scopedItems.map((item) => ({
            value: String(item._id),
            label: itemLabel(item),
            searchText: item.itemName || item.description || itemLabel(item),
        })),
        [scopedItems],
    );

    const modelOptions = useMemo(() => {
        const values = new Set();
        items.forEach((item) => {
            const model = cleanText(item.modelNumber);
            if (model) values.add(model);
        });
        return [...values].sort((left, right) => left.localeCompare(right)).map((model) => ({ value: model, label: model }));
    }, [items]);

    const rememberItem = (saved, nextModel) => {
        const row = stockRow(saved);
        setItems((current) => {
            const next = current.filter((item) => !sameId(item._id, row._id));
            next.push(row);
            return next;
        });
        setCategoryId(row.categoryId);
        setSubcategoryId(row.subcategoryId);
        setBrandId(row.brandId);
        setItemId(String(row._id));
        if (nextModel !== undefined) setModelNumber(cleanText(nextModel));
    };

    const chooseCategory = (nextId) => {
        const sub = subcategories.find((row) => sameId(row._id, subcategoryId));
        const nextSub = sub && sameId(sub.categoryId, nextId) ? subcategoryId : '';
        const selected = items.find((row) => sameId(row._id, itemId));
        setCategoryId(nextId);
        setSubcategoryId(nextSub);
        setItemId(itemStillVisible(selected, nextId, nextSub) ? itemId : '');
    };

    const chooseSubcategory = (nextId) => {
        const sub = subcategories.find((row) => sameId(row._id, nextId));
        const nextCategory = sub?.categoryId ? String(sub.categoryId) : categoryId;
        const selected = items.find((row) => sameId(row._id, itemId));
        setCategoryId(nextCategory);
        setSubcategoryId(nextId);
        setItemId(itemStillVisible(selected, nextCategory, nextId) ? itemId : '');
    };

    const chooseBrand = (nextId) => {
        setBrandId(nextId);
    };

    const chooseItem = (nextId) => {
        const item = items.find((row) => sameId(row._id, nextId));
        if (!item) {
            setItemId('');
            return;
        }
        setCategoryId(String(item.categoryId || ''));
        setSubcategoryId(String(item.subcategoryId || ''));
        setBrandId(String(item.brandId || ''));
        setItemId(nextId);
        setModelNumber(cleanText(item.modelNumber));
    };

    const chooseModel = (nextModel) => {
        const model = cleanText(nextModel);
        const owner = modelOwners(model, items)[0];
        setModelNumber(model);
        if (!owner) return;
        setCategoryId(String(owner.categoryId || ''));
        setSubcategoryId(String(owner.subcategoryId || ''));
        setBrandId(String(owner.brandId || ''));
        setItemId(String(owner._id));
    };

    const addTemporaryItem = async (name) => {
        if (!access.canCreateItem) {
            setError('Item create permission is required to add an item.');
            return;
        }
        if (!categoryId || !subcategoryId || !brandId) {
            setError('Select category, sub category, and brand before adding an item.');
            return;
        }
        setCreating('item');
        setError('');
        try {
            const saved = await createPendingItem({
                categoryId,
                subcategoryId,
                brandId,
                itemName: name,
            });
            rememberItem(saved);
            setModelNumber('');
        } catch (err) {
            setError(apiMessage(err, 'Could not save the item.'));
        } finally {
            setCreating('');
        }
    };

    const addTemporaryModel = async (model) => {
        if (!access.canCreateItem) {
            setError('Item create permission is required to add a model no.');
            return;
        }
        const selected = items.find((row) => sameId(row._id, itemId));
        const itemName = cleanText(selected?.itemName || selected?.description);
        if (!categoryId || !subcategoryId || !brandId || !itemName) {
            setError('Select category, sub category, brand, and item before adding a model no.');
            return;
        }
        setCreating('model');
        setError('');
        try {
            const saved = await createPendingItem({
                categoryId,
                subcategoryId,
                brandId,
                itemName,
                modelNumber: model,
                itemId,
            });
            rememberItem(saved, model);
        } catch (err) {
            setError(apiMessage(err, 'Could not save the model no.'));
        } finally {
            setCreating('');
        }
    };

    const save = async (event) => {
        event.preventDefault();
        const amount = Number(quantity);
        const cost = Number(price);
        const selected = items.find((row) => sameId(row._id, itemId));
        const itemName = cleanText(selected?.itemName || selected?.description);
        const model = cleanText(modelNumber) || itemName;
        const sub = subcategories.find((row) => sameId(row._id, subcategoryId));
        if (!categoryId || !subcategoryId || !brandId) {
            setError('Category, sub category, and brand are required.');
            return;
        }
        if (!sub || !sameId(sub.categoryId, categoryId)) {
            setError('Sub category does not belong to the selected category.');
            return;
        }
        if (!selected) {
            setError('Select an item.');
            return;
        }
        const owner = model ? modelOwners(model, items)[0] : null;
        if (owner && !sameId(owner._id, selected._id) && !selected.pendingStock) {
            setError(MODEL_FIXED);
            return;
        }
        if (!selected.pendingStock && cleanText(selected.modelNumber) && !sameText(selected.modelNumber, model)) {
            setError(MODEL_FIXED);
            return;
        }
        if (!selected.pendingStock && cleanText(selected.modelNumber) && !sameStockIdentity(selected, categoryId, subcategoryId, brandId, model)) {
            setError(MODEL_FIXED);
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
            const saved = await addItemStock(selected._id, {
                quantity: amount,
                price: cost,
                categoryId,
                subcategoryId,
                brandId,
                modelNumber: model,
            });
            const createdItem = Boolean(selected.pendingStock) || Boolean(saved.created);
            toast({
                title: createdItem ? 'New item created' : 'Stock added',
                description: createdItem
                    ? `${saved.itemCode || 'Item'} was created with ${saved.availableQuantity} in stock.`
                    : `${saved.itemCode || 'Item'} available is now ${saved.availableQuantity}.`,
            });
            onSaved?.();
            onClose();
        } catch (err) {
            const message = apiMessage(err, 'Could not add stock.');
            setError(message);
            toast({ title: 'Could not add stock', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <CatalogModal title="Add Stock" onClose={onClose} wide>
            <form onSubmit={save} className="flex min-h-0 flex-col">
                <div className="max-h-[min(36rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    {loading ? <p className="text-sm text-slate-500">Loading items...</p> : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <SearchSelect
                                label="Sub category"
                                value={subcategoryId}
                                options={subcategoryOptions}
                                placeholder="Select sub category"
                                onChange={chooseSubcategory}
                            />
                            <SearchSelect
                                label="Category"
                                value={categoryId}
                                options={categoryOptions}
                                placeholder="Select category"
                                onChange={chooseCategory}
                            />
                            <SearchSelect
                                label="Item"
                                value={itemId}
                                options={itemOptions}
                                placeholder="Select item"
                                onChange={chooseItem}
                                onCreate={access.canCreateItem ? addTemporaryItem : undefined}
                                creating={creating === 'item'}
                            />
                            <SearchSelect
                                label="Brand"
                                value={brandId}
                                options={brandOptions}
                                placeholder="Select brand"
                                onChange={chooseBrand}
                            />
                            <SearchSelect
                                label="Model no"
                                value={modelNumber}
                                options={modelOptions}
                                placeholder="Select model no (optional)"
                                onChange={chooseModel}
                                onCreate={access.canCreateItem ? addTemporaryModel : undefined}
                                creating={creating === 'model'}
                            />
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
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E6EDF5] px-5 py-4">
                    <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving || loading} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'Add Stock'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}
