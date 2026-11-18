'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function namesEqual(left, right) {
    return cleanText(left).toLowerCase() === cleanText(right).toLowerCase();
}

function rowById(rows, id) {
    return rows.find((row) => sameId(row._id, id));
}

function itemLabel(item) {
    return item.itemName || item.description || 'Item';
}

function sameStockIdentity(item, categoryId, subcategoryId, brandId, modelNumber) {
    return sameId(item.categoryId, categoryId)
        && sameId(item.subcategoryId, subcategoryId)
        && sameId(item.brandId, brandId)
        && namesEqual(item.modelNumber, modelNumber);
}

function modelOwners(model, rows) {
    const text = cleanText(model);
    if (!text) return [];
    return rows.filter((row) => sameText(row.modelNumber, text));
}

const MODEL_FIXED = 'This model no belongs to the selected item and cannot be changed.';

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
    if (nextCategory && !sameId(item.categoryId, nextCategory)) return false;
    if (nextSub && !sameId(item.subcategoryId, nextSub)) return false;
    return true;
}

function TypeSuggest({ label, text, options, placeholder, onText, onPick, onCommit }) {
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const [active, setActive] = useState(0);
    const needle = cleanText(text).toLowerCase();
    const shown = needle
        ? options.filter((option) => cleanText(option.label).toLowerCase().includes(needle))
        : options;

    useEffect(() => {
        setActive(0);
    }, [needle, shown.length]);

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
    }, [open, text]);

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

    const pick = (option) => {
        onPick(option.value);
        setOpen(false);
    };

    const menu = open && menuStyle && shown.length ? createPortal(
        <ul
            ref={menuRef}
            style={menuStyle}
            className="max-h-56 overflow-y-auto rounded-lg border border-[#E6EDF5] bg-white py-1 shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
        >
            {shown.map((option, index) => (
                <li key={`${option.label}:${option.value}`}>
                    <button
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => pick(option)}
                        className={`w-full px-3 py-2 text-left text-sm ${index === active ? 'bg-blue-600 text-white' : 'text-slate-700'}`}
                    >
                        {option.label}
                    </button>
                </li>
            ))}
        </ul>,
        document.body,
    ) : null;

    return (
        <label ref={rootRef} className="relative block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
            <input
                value={text}
                placeholder={placeholder}
                autoComplete="off"
                aria-expanded={open}
                aria-autocomplete="list"
                onChange={(event) => {
                    onText(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    setOpen(false);
                    onCommit?.(text);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        setOpen(false);
                        return;
                    }
                    if (!open || shown.length === 0) return;
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActive((current) => (current + 1) % shown.length);
                    } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActive((current) => (current - 1 + shown.length) % shown.length);
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        pick(shown[Math.min(active, shown.length - 1)]);
                    }
                }}
                className={fieldClass}
            />
            {menu}
        </label>
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
    const [categoryText, setCategoryText] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [subcategoryText, setSubcategoryText] = useState('');
    const [brandId, setBrandId] = useState('');
    const [brandText, setBrandText] = useState('');
    const [itemId, setItemId] = useState('');
    const [itemText, setItemText] = useState('');
    const [modelNumber, setModelNumber] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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

    const keepOrClearItem = (nextCategory, nextSub) => {
        const selected = items.find((row) => sameId(row._id, itemId));
        if (itemStillVisible(selected, nextCategory, nextSub)) return;
        setItemId('');
        if (selected) setItemText('');
    };

    const chooseCategory = (nextId) => {
        const category = rowById(categories, nextId);
        const sub = rowById(subcategories, subcategoryId);
        const nextSub = sub && sameId(sub.categoryId, nextId) ? subcategoryId : '';
        setCategoryId(nextId);
        setCategoryText(category?.name || '');
        setSubcategoryId(nextSub);
        if (!nextSub) setSubcategoryText('');
        keepOrClearItem(nextId, nextSub);
    };

    const typeCategory = (text) => {
        setCategoryText(text);
        const selected = rowById(categories, categoryId);
        if (selected && namesEqual(selected.name, text)) return;
        setCategoryId('');
        setSubcategoryId('');
        setSubcategoryText('');
        keepOrClearItem('', '');
    };

    const commitCategory = (text) => {
        const name = cleanText(text);
        setCategoryText(name);
        const selected = rowById(categories, categoryId);
        if (selected && namesEqual(selected.name, name)) return;
        const matches = categories.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseCategory(String(matches[0]._id));
        else setCategoryId('');
    };

    const chooseSubcategory = (nextId) => {
        const sub = rowById(subcategories, nextId);
        const nextCategory = sub?.categoryId ? String(sub.categoryId) : categoryId;
        const category = rowById(categories, nextCategory);
        setCategoryId(nextCategory);
        if (category?.name) setCategoryText(category.name);
        setSubcategoryId(nextId);
        setSubcategoryText(sub?.name || '');
        keepOrClearItem(nextCategory, nextId);
    };

    const typeSubcategory = (text) => {
        setSubcategoryText(text);
        const selected = rowById(subcategories, subcategoryId);
        if (selected && namesEqual(selected.name, text)) return;
        setSubcategoryId('');
        keepOrClearItem(categoryId, '');
    };

    const commitSubcategory = (text) => {
        const name = cleanText(text);
        setSubcategoryText(name);
        const selected = rowById(subcategories, subcategoryId);
        if (selected && namesEqual(selected.name, name)) return;
        const pool = categoryId
            ? subcategories.filter((row) => sameId(row.categoryId, categoryId))
            : subcategories;
        const matches = pool.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseSubcategory(String(matches[0]._id));
        else setSubcategoryId('');
    };

    const chooseBrand = (nextId) => {
        const brand = rowById(brands, nextId);
        setBrandId(nextId);
        setBrandText(brand?.name || '');
    };

    const typeBrand = (text) => {
        setBrandText(text);
        const selected = rowById(brands, brandId);
        if (selected && !namesEqual(selected.name, text)) setBrandId('');
    };

    const commitBrand = (text) => {
        const name = cleanText(text);
        setBrandText(name);
        const selected = rowById(brands, brandId);
        if (selected && namesEqual(selected.name, name)) return;
        const matches = brands.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseBrand(String(matches[0]._id));
        else setBrandId('');
    };

    const chooseItem = (nextId) => {
        const item = items.find((row) => sameId(row._id, nextId));
        if (!item) {
            setItemId('');
            return;
        }
        const nextCategory = String(item.categoryId || '');
        const nextSub = String(item.subcategoryId || '');
        setCategoryId(nextCategory);
        setSubcategoryId(nextSub);
        setCategoryText(item.categoryName || rowById(categories, nextCategory)?.name || '');
        setSubcategoryText(item.subcategoryName || rowById(subcategories, nextSub)?.name || '');
        setItemId(nextId);
        setItemText(itemLabel(item));
    };

    const typeItem = (text) => {
        setItemText(text);
        const selected = items.find((row) => sameId(row._id, itemId));
        if (selected && !namesEqual(itemLabel(selected), text)) setItemId('');
    };

    const commitItem = (text) => {
        const name = cleanText(text);
        setItemText(name);
        const selected = items.find((row) => sameId(row._id, itemId));
        if (selected && namesEqual(itemLabel(selected), name)) return;
        const matches = scopedItems.filter((item) => namesEqual(itemLabel(item), name));
        if (matches.length === 1) chooseItem(String(matches[0]._id));
        else setItemId('');
    };

    const chooseModel = (nextModel) => {
        setModelNumber(cleanText(nextModel));
    };

    const commitModel = (text) => {
        setModelNumber(cleanText(text));
    };

    const save = async (event) => {
        event.preventDefault();
        const amount = Number(quantity);
        const cost = Number(price);
        const typedName = cleanText(itemText);
        const held = items.find((row) => sameId(row._id, itemId));
        let selected = held && namesEqual(itemLabel(held), typedName) ? held : null;
        const categoryMatch = (() => {
            const typed = cleanText(categoryText);
            const heldCategory = rowById(categories, categoryId);
            if (heldCategory && namesEqual(heldCategory.name, typed)) return heldCategory;
            const matches = categories.filter((row) => namesEqual(row.name, typed));
            return matches.length === 1 ? matches[0] : null;
        })();
        const brandMatch = (() => {
            const typed = cleanText(brandText);
            const heldBrand = rowById(brands, brandId);
            if (heldBrand && namesEqual(heldBrand.name, typed)) return heldBrand;
            const matches = brands.filter((row) => namesEqual(row.name, typed));
            return matches.length === 1 ? matches[0] : null;
        })();
        let useCategory = categoryMatch ? String(categoryMatch._id) : '';
        let useBrand = brandMatch ? String(brandMatch._id) : '';
        const subTyped = cleanText(subcategoryText);
        const subPool = useCategory
            ? subcategories.filter((row) => sameId(row.categoryId, useCategory))
            : subcategories;
        let subMatch = rowById(subPool, subcategoryId);
        if (!subMatch || !namesEqual(subMatch.name, subTyped)) {
            const matches = subPool.filter((row) => namesEqual(row.name, subTyped));
            subMatch = matches.length === 1 ? matches[0] : null;
        }
        let useSubcategory = subMatch ? String(subMatch._id) : '';
        if (!useCategory && subMatch?.categoryId) useCategory = String(subMatch.categoryId);
        let typedModel = cleanText(modelNumber);
        if (!selected && typedName) {
            const matches = scopedItems.filter((item) => namesEqual(itemLabel(item), typedName));
            if (matches.length > 1) {
                setError('More than one item has this name. Select it from the list.');
                return;
            }
            if (matches.length === 1) {
                selected = matches[0];
                if (!useCategory) useCategory = String(selected.categoryId || '');
                if (!useSubcategory) useSubcategory = String(selected.subcategoryId || '');
            }
        }
        const itemName = cleanText(selected ? (selected.itemName || selected.description) : typedName);
        if (!typedModel && selected) typedModel = cleanText(selected.modelNumber);
        const model = typedModel || itemName;
        const sub = subcategories.find((row) => sameId(row._id, useSubcategory));
        if (!useCategory || !useSubcategory || !useBrand) {
            setError('Category, sub category, and brand are required.');
            return;
        }
        if (!sub || !sameId(sub.categoryId, useCategory)) {
            setError('Sub category does not belong to the selected category.');
            return;
        }
        if (!itemName) {
            setError('Enter an item.');
            return;
        }
        if (!selected && !access.canCreateItem) {
            setError('Item create permission is required to add an item.');
            return;
        }
        const owner = model ? modelOwners(model, items)[0] : null;
        if (owner && (!selected || !sameId(owner._id, selected._id)) && !owner.pendingStock && !selected?.pendingStock) {
            setError(MODEL_FIXED);
            return;
        }
        if (selected && !selected.pendingStock && cleanText(selected.modelNumber) && !namesEqual(selected.modelNumber, model)) {
            setError(MODEL_FIXED);
            return;
        }
        if (selected && !selected.pendingStock && cleanText(selected.modelNumber) && !sameStockIdentity(selected, useCategory, useSubcategory, useBrand, model)) {
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
            let stockItem = selected;
            if (!stockItem) {
                const created = await createPendingItem({
                    categoryId: useCategory,
                    subcategoryId: useSubcategory,
                    brandId: useBrand,
                    itemName,
                    modelNumber: typedModel,
                });
                stockItem = stockRow(created);
            }
            const saved = await addItemStock(stockItem._id, {
                quantity: amount,
                price: cost,
                categoryId: useCategory,
                subcategoryId: useSubcategory,
                brandId: useBrand,
                modelNumber: model,
            });
            const createdItem = Boolean(stockItem.pendingStock) || Boolean(saved.created);
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
                            <TypeSuggest
                                label="Sub category"
                                text={subcategoryText}
                                options={subcategoryOptions}
                                placeholder="Type sub category"
                                onText={typeSubcategory}
                                onPick={chooseSubcategory}
                                onCommit={commitSubcategory}
                            />
                            <TypeSuggest
                                label="Category"
                                text={categoryText}
                                options={categoryOptions}
                                placeholder="Type category"
                                onText={typeCategory}
                                onPick={chooseCategory}
                                onCommit={commitCategory}
                            />
                            <TypeSuggest
                                label="Item"
                                text={itemText}
                                options={itemOptions}
                                placeholder="Type item"
                                onText={typeItem}
                                onPick={chooseItem}
                                onCommit={commitItem}
                            />
                            <TypeSuggest
                                label="Brand"
                                text={brandText}
                                options={brandOptions}
                                placeholder="Type brand"
                                onText={typeBrand}
                                onPick={chooseBrand}
                                onCommit={commitBrand}
                            />
                            <TypeSuggest
                                label="Model no"
                                text={modelNumber}
                                options={modelOptions}
                                placeholder="Type model no"
                                onText={setModelNumber}
                                onPick={chooseModel}
                                onCommit={commitModel}
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
