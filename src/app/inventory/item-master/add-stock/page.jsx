'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus } from 'lucide-react';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import { useToast } from '@/hooks/use-toast';
import CatalogModal from '../CatalogModal';
import { AddBrandModal, AddCategoryModal, AddSubcategoryModal } from '../CatalogForms';
import ItemForm from '../ItemForm';
import ItemMasterShell from '../ItemMasterShell';
import { useInventoryAccess } from '../itemMasterAccess';
import {
    addItemStock,
    apiMessage,
    createItem,
    listBrands,
    listCategories,
    listStockOptions,
    listSubcategories,
} from '../itemMasterApi';

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

function upsertById(rows, saved) {
    const id = String(saved?._id || '');
    if (!id) return rows;
    const next = rows.filter((row) => !sameId(row._id, id));
    next.push(saved);
    next.sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
    return next;
}

function stockItemFrom(saved) {
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
    };
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

function modelAllowed(model, rows, categoryId, subcategoryId, brandId, itemId) {
    const text = cleanText(model);
    if (!text) return true;
    const owners = modelOwners(text, rows);
    if (owners.length === 0) return true;
    if (owners.length > 1) return false;
    const owner = owners[0];
    return sameId(owner.categoryId, categoryId)
        && sameId(owner.subcategoryId, subcategoryId)
        && sameId(owner.brandId, brandId)
        && (!itemId || sameId(owner._id, itemId));
}

const MODEL_TAKEN = 'This model no is already used. It cannot be used when the item, category, sub category, or brand is different.';

function SearchSelect({ label, value, options, placeholder, onChange, createLabel, onCreate }) {
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
            <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
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
                    {createLabel && onCreate ? (
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setQuery('');
                                onCreate();
                            }}
                            className="flex w-full items-center gap-2 border-t border-[#E6EDF5] px-3 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
                        >
                            <Plus size={15} /> {createLabel}
                        </button>
                    ) : null}
                </div>
            ) : null}
            </div>
            {onCreate ? (
                <button
                    type="button"
                    aria-label={createLabel || `Add ${label}`}
                    onClick={() => {
                        setOpen(false);
                        setQuery('');
                        onCreate();
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#E6EDF5] bg-white text-slate-700 hover:bg-blue-50"
                >
                    <Plus size={16} />
                </button>
            ) : null}
            </div>
        </div>
    );
}

export default function AddStockPage() {
    const router = useRouter();
    const { toast } = useToast();
    const access = useInventoryAccess();
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [items, setItems] = useState([]);
    const [extraModels, setExtraModels] = useState([]);
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [itemId, setItemId] = useState('');
    const [modelNumber, setModelNumber] = useState('');
    const [modelDraft, setModelDraft] = useState('');
    const [addingModel, setAddingModel] = useState(false);
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [itemSaving, setItemSaving] = useState(false);
    const [error, setError] = useState('');
    const [modal, setModal] = useState('');
    const [returnToSubcategory, setReturnToSubcategory] = useState(false);

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
        if (categoryId && !sameId(item.categoryId, categoryId)) return false;
        if (subcategoryId && !sameId(item.subcategoryId, subcategoryId)) return false;
        return true;
    }), [items, categoryId, subcategoryId]);

    const itemOptions = useMemo(
        () => scopedItems.map((item) => ({ value: String(item._id), label: itemLabel(item) })),
        [scopedItems],
    );

    const modelOptions = useMemo(() => {
        const values = new Set();
        items.forEach((item) => {
            const model = cleanText(item.modelNumber);
            if (model && modelAllowed(model, items, categoryId, subcategoryId, brandId, itemId)) values.add(model);
        });
        extraModels.forEach((model) => {
            if (modelAllowed(model, items, categoryId, subcategoryId, brandId, itemId)) values.add(model);
        });
        const choices = [...values].sort((left, right) => left.localeCompare(right)).map((model) => ({ value: model, label: model }));
        if (cleanText(modelNumber)) choices.unshift({ value: '', label: 'No model no' });
        return choices;
    }, [items, extraModels, categoryId, subcategoryId, brandId, itemId, modelNumber]);

    const itemInitial = useMemo(() => ({
        categoryId,
        subcategoryId,
        brandId,
        modelNumber,
    }), [categoryId, subcategoryId, brandId, modelNumber]);

    const chooseCategory = (nextId) => {
        const sub = subcategories.find((row) => sameId(row._id, subcategoryId));
        const nextSub = sub && sameId(sub.categoryId, nextId) ? subcategoryId : '';
        const selected = items.find((row) => sameId(row._id, itemId));
        const nextItem = selected && sameId(selected.categoryId, nextId) && (!nextSub || sameId(selected.subcategoryId, nextSub))
            ? itemId
            : '';
        const nextModel = modelAllowed(modelNumber, items, nextId, nextSub, brandId, nextItem) ? modelNumber : '';
        setCategoryId(nextId);
        setSubcategoryId(nextSub);
        setItemId(nextItem);
        setModelNumber(nextModel);
    };

    const chooseSubcategory = (nextId) => {
        const sub = subcategories.find((row) => sameId(row._id, nextId));
        const nextCategory = sub?.categoryId ? String(sub.categoryId) : categoryId;
        const selected = items.find((row) => sameId(row._id, itemId));
        const nextItem = selected && sameId(selected.subcategoryId, nextId) ? itemId : '';
        const nextModel = modelAllowed(modelNumber, items, nextCategory, nextId, brandId, nextItem) ? modelNumber : '';
        setCategoryId(nextCategory);
        setSubcategoryId(nextId);
        setItemId(nextItem);
        setModelNumber(nextModel);
    };

    const chooseBrand = (nextId) => {
        const selected = items.find((row) => sameId(row._id, itemId));
        let nextModel = modelNumber;
        if (selected && sameId(selected.brandId, nextId) && !cleanText(nextModel)) {
            nextModel = cleanText(selected.modelNumber);
        }
        if (!modelAllowed(nextModel, items, categoryId, subcategoryId, nextId, itemId)) nextModel = '';
        setBrandId(nextId);
        setModelNumber(nextModel);
    };

    const chooseItem = (nextId) => {
        const item = items.find((row) => sameId(row._id, nextId));
        if (!item) {
            setItemId('');
            return;
        }
        const nextCategory = String(item.categoryId || '');
        const nextSub = String(item.subcategoryId || '');
        let nextModel = modelNumber;
        if (brandId && sameId(brandId, item.brandId)) nextModel = cleanText(item.modelNumber);
        else if (!modelAllowed(nextModel, items, nextCategory, nextSub, brandId, nextId)) nextModel = '';
        setCategoryId(nextCategory);
        setSubcategoryId(nextSub);
        setItemId(nextId);
        setModelNumber(nextModel);
    };

    const addModel = () => {
        const next = cleanText(modelDraft);
        if (!next) return;
        if (!modelAllowed(next, items, categoryId, subcategoryId, brandId, itemId)) {
            setError(MODEL_TAKEN);
            return;
        }
        setError('');
        setExtraModels((current) => (current.some((model) => sameText(model, next)) ? current : [...current, next]));
        setModelNumber(next);
        setModelDraft('');
        setAddingModel(false);
    };

    const leave = () => {
        if (!tryNavigateListReturn(router)) router.push('/inventory/item-master');
    };

    const saveNewItem = async (payload) => {
        setItemSaving(true);
        setError('');
        try {
            const saved = await createItem(payload);
            const row = stockItemFrom(saved);
            setItems((current) => (current.some((item) => sameId(item._id, row._id)) ? current : [...current, row]));
            setCategoryId(row.categoryId);
            setSubcategoryId(row.subcategoryId);
            setBrandId(row.brandId);
            setItemId(String(row._id));
            setModelNumber(cleanText(row.modelNumber));
            setModal('');
            toast({
                title: 'Item added',
                description: `${saved.itemCode || 'Item'} is in the item list. Add Stock puts the quantity on it when the details match.`,
            });
        } catch (err) {
            const message = apiMessage(err, 'Could not save the item.');
            setError(message);
            toast({ title: 'Could not save', description: message, variant: 'destructive' });
        } finally {
            setItemSaving(false);
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
        if (model && !modelAllowed(model, items, categoryId, subcategoryId, brandId, itemId)) {
            setError(MODEL_TAKEN);
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
        const matches = items.filter((row) => sameStockIdentity(row, categoryId, subcategoryId, brandId, model));
        const selectedMatches = Boolean(selected && matches.some((row) => sameId(row._id, selected._id)));
        let targetId = '';
        let createNew = false;
        if (matches.length > 1 && !selectedMatches) {
            setError('More than one item has these details. Select the item.');
            return;
        }
        if (matches.length > 0) {
            targetId = String((selectedMatches ? selected : matches[0])._id);
        } else if (selected) {
            if (!access.canCreateItem) {
                setError('Item create permission is required when category, sub category, brand, or model no differs from the selected item.');
                return;
            }
            targetId = String(selected._id);
            createNew = true;
        } else {
            if (!access.canCreateItem) {
                setError('Item create permission is required to add stock for a new item.');
                return;
            }
            createNew = true;
        }
        setSaving(true);
        setError('');
        try {
            let saved;
            if (!targetId) {
                const brandName = brands.find((row) => sameId(row._id, brandId))?.name || '';
                const subcategoryName = sub.name || '';
                const description = [brandName, itemName, model, subcategoryName].map((part) => cleanText(part)).filter(Boolean).join(' ');
                const created = await createItem({
                    categoryId,
                    subcategoryId,
                    brandId,
                    modelNumber: model,
                    description,
                    unitOfMeasure: 'Quantity',
                    status: 'Active',
                });
                saved = await addItemStock(created._id, {
                    quantity: amount,
                    price: cost,
                    categoryId,
                    subcategoryId,
                    brandId,
                    modelNumber: model,
                });
            } else {
                saved = await addItemStock(targetId, {
                    quantity: amount,
                    price: cost,
                    categoryId,
                    subcategoryId,
                    brandId,
                    modelNumber: model,
                });
            }
            const createdItem = createNew || Boolean(saved.created);
            toast({
                title: createdItem ? 'New item created' : 'Stock added',
                description: createdItem
                    ? `${saved.itemCode || 'Item'} was created with ${saved.availableQuantity} in stock.`
                    : `${saved.itemCode || 'Item'} available is now ${saved.availableQuantity}.`,
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
                    <p className="mt-1 text-sm text-slate-500">
                        A sub category fills its category. Item follows that category and sub category, and each list can add a new record. Brand can be any brand. Model no is optional. If it is left empty, the item name is saved as the model no. A model no already saved on an item cannot be used when the item, category, sub category, or brand is different. Matching details add this quantity to that item. Any other combination creates a new item, with the description set to brand, item, model no, and sub category.
                    </p>
                    {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    {loading ? <p className="mt-4 text-sm text-slate-500">Loading items...</p> : (
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <SearchSelect
                                label="Sub category"
                                value={subcategoryId}
                                options={subcategoryOptions}
                                placeholder="Select sub category"
                                onChange={chooseSubcategory}
                                createLabel={access.canCreateSubcategory ? 'Add Sub Category' : ''}
                                onCreate={access.canCreateSubcategory ? () => setModal('subcategory') : undefined}
                            />
                            <SearchSelect
                                label="Category"
                                value={categoryId}
                                options={categoryOptions}
                                placeholder="Select category"
                                onChange={chooseCategory}
                                createLabel={access.canCreateCategory ? 'Add Category' : ''}
                                onCreate={access.canCreateCategory ? () => setModal('category') : undefined}
                            />
                            <SearchSelect
                                label="Item"
                                value={itemId}
                                options={itemOptions}
                                placeholder="Select item"
                                onChange={chooseItem}
                                createLabel={access.canCreateItem ? 'Add Item' : ''}
                                onCreate={access.canCreateItem ? () => setModal('item') : undefined}
                            />
                            <SearchSelect
                                label="Brand"
                                value={brandId}
                                options={brandOptions}
                                placeholder="Select brand"
                                onChange={chooseBrand}
                                createLabel={access.canCreateBrand ? 'Add Brand' : ''}
                                onCreate={access.canCreateBrand ? () => setModal('brand') : undefined}
                            />
                            <div>
                                <SearchSelect
                                    label="Model no"
                                    value={modelNumber}
                                    options={modelOptions}
                                    placeholder="Select model no (optional)"
                                    onChange={setModelNumber}
                                    createLabel="Add model no"
                                    onCreate={() => {
                                        setModelDraft('');
                                        setAddingModel(true);
                                    }}
                                />
                                {addingModel ? (
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            value={modelDraft}
                                            onChange={(event) => setModelDraft(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    addModel();
                                                }
                                            }}
                                            placeholder="New model no"
                                            className={fieldClass}
                                            autoFocus
                                        />
                                        <button type="button" onClick={addModel} className="h-11 shrink-0 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">
                                            Add
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                            <div className="hidden sm:block" aria-hidden="true" />
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
            {modal === 'category' ? (
                <AddCategoryModal
                    onClose={() => {
                        setModal(returnToSubcategory ? 'subcategory' : '');
                        setReturnToSubcategory(false);
                    }}
                    onSaved={(saved) => {
                        const nextCategory = String(saved._id);
                        setCategories((rows) => upsertById(rows, saved));
                        setCategoryId(nextCategory);
                        setSubcategoryId('');
                        setItemId('');
                        setModelNumber((current) => (modelAllowed(current, items, nextCategory, '', brandId, '') ? current : ''));
                        setModal(returnToSubcategory ? 'subcategory' : '');
                        setReturnToSubcategory(false);
                    }}
                />
            ) : null}
            {modal === 'subcategory' ? (
                <AddSubcategoryModal
                    key={categoryId || 'subcategory'}
                    categories={categories}
                    canCreateCategory={access.canCreateCategory}
                    record={categoryId ? { categoryId } : null}
                    onClose={() => setModal('')}
                    onCreateCategory={() => {
                        setReturnToSubcategory(true);
                        setModal('category');
                    }}
                    onSaved={(saved) => {
                        const nextCategory = saved.categoryId ? String(saved.categoryId) : categoryId;
                        const nextSub = String(saved._id);
                        setSubcategories((rows) => upsertById(rows, saved));
                        setCategoryId(nextCategory);
                        setSubcategoryId(nextSub);
                        setItemId('');
                        setModelNumber((current) => (modelAllowed(current, items, nextCategory, nextSub, brandId, '') ? current : ''));
                        setModal('');
                    }}
                />
            ) : null}
            {modal === 'brand' ? (
                <AddBrandModal
                    onClose={() => setModal('')}
                    onSaved={(saved) => {
                        const nextBrand = String(saved._id);
                        setBrands((rows) => upsertById(rows, saved));
                        setBrandId(nextBrand);
                        setModelNumber((current) => (
                            modelAllowed(current, items, categoryId, subcategoryId, nextBrand, itemId) ? current : ''
                        ));
                        setModal('');
                    }}
                />
            ) : null}
            {modal === 'item' ? (
                <CatalogModal title="Add Item" onClose={() => setModal('')} wide>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                        <ItemForm initial={itemInitial} onSubmit={saveNewItem} onCancel={() => setModal('')} saving={itemSaving} />
                    </div>
                </CatalogModal>
            ) : null}
        </ItemMasterShell>
    );
}
