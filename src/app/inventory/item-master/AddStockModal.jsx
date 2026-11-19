'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boxes, Check, FileText, Pencil, Plus, RotateCcw, Store, Trash2, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useInventoryAccess } from './itemMasterAccess';
import { listVendors } from '../vendor-management/vendorManagementApi';
import {
    apiMessage,
    approveStockEntry,
    getStockApprovalContext,
    getStockEntry,
    listBrands,
    listCategories,
    listStockEntries,
    listStockOptions,
    listSubcategories,
    rejectStockEntry,
    saveStockEntry,
} from './itemMasterApi';

const fieldClass = 'h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500';
const MAX_BILL_BYTES = 10 * 1024 * 1024;

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

function modelOwners(model, rows) {
    const text = cleanText(model);
    if (!text) return [];
    return rows.filter((row) => namesEqual(row.modelNumber, text));
}

function ownedModel(model, rows) {
    return modelOwners(model, rows).find((row) => !row.pendingStock) || null;
}

function itemStillVisible(item, nextCategory, nextSub) {
    if (!item) return false;
    if (nextCategory && !sameId(item.categoryId, nextCategory)) return false;
    if (nextSub && !sameId(item.subcategoryId, nextSub)) return false;
    return true;
}

function requestId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `stock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0.00';
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineTotal(quantity, unitPrice) {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
    return Math.round(qty * price * 100) / 100;
}

function readBillFile(file) {
    if (!file) return Promise.resolve(null);
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) return Promise.reject(new Error('Upload a PDF, JPG, or PNG file.'));
    if (file.size > MAX_BILL_BYTES) return Promise.reject(new Error('File must be under 10 MB.'));
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name,
            mimeType: file.type,
            data: String(reader.result || ''),
        });
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.readAsDataURL(file);
    });
}

function TypeSuggest({ label, text, options, placeholder, onText, onPick, onCommit, showAll = false, required = false }) {
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const [active, setActive] = useState(0);
    const needle = cleanText(text).toLowerCase();
    const shown = !showAll && needle
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}
                {required ? <span className="text-red-500"> *</span> : null}
            </span>
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
                        event.stopPropagation();
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

export default function AddStockModal({ onClose, onSaved, reviewEntryId = '' }) {
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
    const [purchaseSource, setPurchaseSource] = useState('vendor');
    const [vendors, setVendors] = useState([]);
    const [vendorId, setVendorId] = useState('');
    const [vendorText, setVendorText] = useState('');
    const [purchaseDate, setPurchaseDate] = useState('');
    const [billNo, setBillNo] = useState('');
    const [lpoNo, setLpoNo] = useState('');
    const [note, setNote] = useState('');
    const [lines, setLines] = useState([]);
    const [attachment, setAttachment] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [drafts, setDrafts] = useState([]);
    const [entryId, setEntryId] = useState('');
    const [clientRequestId, setClientRequestId] = useState(requestId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [directPost, setDirectPost] = useState(false);
    const [approverName, setApproverName] = useState('');
    const [submittedByName, setSubmittedByName] = useState('');
    const locked = Boolean(reviewEntryId);
    const fileRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            listCategories(),
            listSubcategories(),
            listBrands(),
            listStockOptions(),
            listVendors({ limit: 0 }).catch(() => ({ vendors: [] })),
            listStockEntries('draft').catch(() => ({ entries: [] })),
        ])
            .then(async ([categoryResult, subcategoryResult, brandResult, stockResult, vendorResult, draftResult]) => {
                if (cancelled) return;
                const vendorRows = Array.isArray(vendorResult?.vendors) ? vendorResult.vendors : [];
                setCategories(Array.isArray(categoryResult) ? categoryResult : []);
                setSubcategories(Array.isArray(subcategoryResult) ? subcategoryResult : []);
                setBrands(Array.isArray(brandResult) ? brandResult : []);
                setItems(Array.isArray(stockResult?.items) ? stockResult.items : []);
                setVendors(vendorRows);
                setDrafts(Array.isArray(draftResult?.entries) ? draftResult.entries : []);
                const context = await getStockApprovalContext().catch(() => null);
                if (cancelled) return;
                setDirectPost(Boolean(context?.isPurchaseOfficer));
                if (!reviewEntryId) return;
                const entry = await getStockEntry(reviewEntryId);
                if (cancelled) return;
                const vendor = vendorRows.find((row) => sameId(row.id, entry.vendorId));
                setEntryId(String(entry._id || ''));
                setClientRequestId(entry.clientRequestId || requestId());
                setPurchaseSource(entry.purchaseSource === 'manual' ? 'manual' : 'vendor');
                setVendorId(entry.vendorId || '');
                setVendorText(vendor?.name || '');
                setPurchaseDate(entry.purchaseDate || '');
                setBillNo(entry.billNo || '');
                setLpoNo(entry.lpoNo || '');
                setNote(entry.note || '');
                setLines((entry.lines || []).map((line, index) => ({ ...line, key: `${entry._id}-${index}` })));
                setAttachment(entry.attachment?.name ? entry.attachment : null);
                setApproverName(entry.approverName || context?.officerName || '');
                setSubmittedByName(entry.submittedByName || '');
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
    }, [reviewEntryId]);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
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

    const scopedItems = useMemo(
        () => items.filter((item) => itemStillVisible(item, categoryId, subcategoryId)),
        [items, categoryId, subcategoryId],
    );

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
        scopedItems.forEach((item) => {
            if (brandId && !sameId(item.brandId, brandId)) return;
            const model = cleanText(item.modelNumber);
            if (model) values.add(model);
        });
        return [...values].sort((left, right) => left.localeCompare(right)).map((model) => ({ value: model, label: model }));
    }, [brandId, scopedItems]);

    const keepOrClearItem = (nextCategory, nextSub, nextBrand) => {
        const selected = items.find((row) => sameId(row._id, itemId));
        if (!itemStillVisible(selected, nextCategory, nextSub)) {
            setItemId('');
            if (selected) setItemText('');
        }
        const owner = ownedModel(modelNumber, items);
        if (!owner) return;
        const categoryChanged = String(nextCategory || '') !== String(categoryId || '');
        const subChanged = String(nextSub || '') !== String(subcategoryId || '');
        const brandChanged = String(nextBrand || '') !== String(brandId || '');
        if (categoryChanged || subChanged || brandChanged) setModelNumber('');
    };

    const chooseCategory = (nextId) => {
        const category = rowById(categories, nextId);
        const sub = rowById(subcategories, subcategoryId);
        const nextSub = sub && sameId(sub.categoryId, nextId) ? subcategoryId : '';
        setCategoryId(nextId);
        setCategoryText(category?.name || '');
        setSubcategoryId(nextSub);
        if (!nextSub) setSubcategoryText('');
        keepOrClearItem(nextId, nextSub, brandId);
    };

    const typeCategory = (text) => {
        setCategoryText(text);
        const selected = rowById(categories, categoryId);
        if (selected && namesEqual(selected.name, text)) return;
        setCategoryId('');
        setSubcategoryId('');
        setSubcategoryText('');
        keepOrClearItem('', '', brandId);
    };

    const commitCategory = (text) => {
        const name = cleanText(text);
        setCategoryText(name);
        const selected = rowById(categories, categoryId);
        if (selected && namesEqual(selected.name, name)) return;
        const matches = categories.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseCategory(String(matches[0]._id));
        else {
            setCategoryId('');
            if (ownedModel(modelNumber, items)) setModelNumber('');
        }
    };

    const chooseSubcategory = (nextId) => {
        const sub = rowById(subcategories, nextId);
        const nextCategory = sub?.categoryId ? String(sub.categoryId) : categoryId;
        const category = rowById(categories, nextCategory);
        setCategoryId(nextCategory);
        if (category?.name) setCategoryText(category.name);
        setSubcategoryId(nextId);
        setSubcategoryText(sub?.name || '');
        keepOrClearItem(nextCategory, nextId, brandId);
    };

    const typeSubcategory = (text) => {
        setSubcategoryText(text);
        const selected = rowById(subcategories, subcategoryId);
        if (selected && namesEqual(selected.name, text)) return;
        setSubcategoryId('');
        keepOrClearItem(categoryId, '', brandId);
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
        else {
            setSubcategoryId('');
            if (ownedModel(modelNumber, items)) setModelNumber('');
        }
    };

    const chooseBrand = (nextId) => {
        const brand = rowById(brands, nextId);
        setBrandId(nextId);
        setBrandText(brand?.name || '');
        keepOrClearItem(categoryId, subcategoryId, nextId);
    };

    const typeBrand = (text) => {
        setBrandText(text);
        const selected = rowById(brands, brandId);
        if (selected && namesEqual(selected.name, text)) return;
        if (ownedModel(modelNumber, items)) setModelNumber('');
        if (selected) setBrandId('');
    };

    const commitBrand = (text) => {
        const name = cleanText(text);
        setBrandText(name);
        const selected = rowById(brands, brandId);
        if (selected && namesEqual(selected.name, name)) return;
        const matches = brands.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseBrand(String(matches[0]._id));
        else {
            setBrandId('');
            if (ownedModel(modelNumber, items)) setModelNumber('');
        }
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
        const owner = ownedModel(modelNumber, items);
        if (owner && !sameId(owner._id, nextId)) setModelNumber('');
    };

    const typeItem = (text) => {
        setItemText(text);
        const selected = items.find((row) => sameId(row._id, itemId));
        if (selected && namesEqual(itemLabel(selected), text)) return;
        if (selected) setItemId('');
        const owner = ownedModel(modelNumber, items);
        if (owner && !namesEqual(itemLabel(owner), text)) setModelNumber('');
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

    const fillFromModel = (owner, model) => {
        const nextCategory = String(owner.categoryId || '');
        const nextSub = String(owner.subcategoryId || '');
        const nextBrand = String(owner.brandId || '');
        setCategoryId(nextCategory);
        setSubcategoryId(nextSub);
        setBrandId(nextBrand);
        setCategoryText(owner.categoryName || rowById(categories, nextCategory)?.name || '');
        setSubcategoryText(owner.subcategoryName || rowById(subcategories, nextSub)?.name || '');
        setBrandText(owner.brandName || rowById(brands, nextBrand)?.name || '');
        setItemId(String(owner._id));
        setItemText(itemLabel(owner));
        setModelNumber(cleanText(model));
    };

    const chooseModel = (nextModel) => {
        const model = cleanText(nextModel);
        const owners = modelOwners(model, items);
        const owner = owners.find((row) => !row.pendingStock) || owners[0];
        if (!owner) {
            setModelNumber(model);
            return;
        }
        fillFromModel(owner, model);
    };

    const typeModel = (text) => {
        setModelNumber(text);
        const model = cleanText(text);
        const owners = modelOwners(model, items);
        if (owners.length !== 1 || !namesEqual(owners[0].modelNumber, model)) return;
        fillFromModel(owners[0], model);
    };

    const commitModel = (text) => {
        const model = cleanText(text);
        const owners = modelOwners(model, items);
        const owner = owners.find((row) => !row.pendingStock) || (owners.length === 1 ? owners[0] : null);
        if (owner && namesEqual(owner.modelNumber, model)) fillFromModel(owner, model);
        else setModelNumber(model);
    };

    const vendorOptions = useMemo(
        () => vendors.map((row) => ({ value: String(row.id), label: row.name || row.code || 'Vendor' })),
        [vendors],
    );

    const resolveSelection = () => {
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
        let itemName = cleanText(selected ? (selected.itemName || selected.description) : typedName);
        const owner = typedModel ? ownedModel(typedModel, items) : null;
        if (owner) {
            const ownerMatches = (!useCategory || sameId(owner.categoryId, useCategory))
                && (!useSubcategory || sameId(owner.subcategoryId, useSubcategory))
                && (!useBrand || sameId(owner.brandId, useBrand))
                && (!itemName || namesEqual(itemLabel(owner), itemName));
            if (ownerMatches) {
                selected = owner;
                if (!useCategory) useCategory = String(owner.categoryId || '');
                if (!useSubcategory) useSubcategory = String(owner.subcategoryId || '');
                if (!useBrand) useBrand = String(owner.brandId || '');
                itemName = cleanText(owner.itemName || owner.description || itemName);
            } else {
                typedModel = '';
            }
        }
        const sameTarget = Boolean(selected)
            && sameId(selected.categoryId, useCategory)
            && sameId(selected.subcategoryId, useSubcategory)
            && sameId(selected.brandId, useBrand)
            && namesEqual(itemLabel(selected), itemName)
            && (!typedModel || !cleanText(selected.modelNumber) || namesEqual(selected.modelNumber, typedModel));
        const model = typedModel || (sameTarget ? cleanText(selected.modelNumber) : '') || itemName;
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
        if (!sameTarget && !access.canCreateItem) {
            setError('Item create permission is required to add an item.');
            return null;
        }
        const brandName = brandMatch?.name || rowById(brands, useBrand)?.name || '';
        const description = sameTarget && selected?.description
            ? selected.description
            : [brandName, itemName, model, sub.name].map((part) => cleanText(part)).filter(Boolean).join(' ');
        setError('');
        return {
            itemId: selected ? String(selected._id) : '',
            categoryId: useCategory,
            subcategoryId: useSubcategory,
            brandId: useBrand,
            modelNumber: model,
            itemName,
            description,
            quantity: '',
            unitPrice: '',
        };
    };

    const addMaterial = () => {
        const line = resolveSelection();
        if (!line) return;
        setLines((current) => [...current, { ...line, key: requestId() }]);
        setItemId('');
        setItemText('');
        setModelNumber('');
    };

    const chooseVendor = (nextId) => {
        const vendor = vendors.find((row) => sameId(row.id, nextId));
        setVendorId(nextId);
        setVendorText(vendor?.name || '');
    };

    const typeVendor = (text) => {
        setVendorText(text);
        const selected = vendors.find((row) => sameId(row.id, vendorId));
        if (selected && namesEqual(selected.name, text)) return;
        if (selected) setVendorId('');
    };

    const commitVendor = (text) => {
        const name = cleanText(text);
        setVendorText(name);
        const selected = vendors.find((row) => sameId(row.id, vendorId));
        if (selected && namesEqual(selected.name, name)) return;
        const matches = vendors.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseVendor(String(matches[0].id));
        else setVendorId('');
    };

    const updateLine = (key, patch) => {
        setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    };

    const removeLine = (key) => {
        setLines((current) => current.filter((line) => line.key !== key));
    };

    const clearEntry = () => {
        const dirty = lines.length || vendorText || purchaseDate || billNo || lpoNo || note || attachment || categoryText || itemText || modelNumber;
        if (dirty && !window.confirm('Clear everything entered in this form? Saved stock records will not be deleted.')) return;
        setPurchaseSource('vendor');
        setVendorId('');
        setVendorText('');
        setPurchaseDate('');
        setBillNo('');
        setLpoNo('');
        setNote('');
        setLines([]);
        setAttachment(null);
        setEntryId('');
        setClientRequestId(requestId());
        setCategoryId('');
        setCategoryText('');
        setSubcategoryId('');
        setSubcategoryText('');
        setBrandId('');
        setBrandText('');
        setItemId('');
        setItemText('');
        setModelNumber('');
        setError('');
    };

    const openDraft = async (id) => {
        if (!id) return;
        setSaving(true);
        setError('');
        try {
            const entry = await getStockEntry(id);
            const vendor = vendors.find((row) => sameId(row.id, entry.vendorId));
            setEntryId(String(entry._id || ''));
            setClientRequestId(entry.clientRequestId || requestId());
            setPurchaseSource(entry.purchaseSource === 'manual' ? 'manual' : 'vendor');
            setVendorId(entry.vendorId || '');
            setVendorText(vendor?.name || '');
            setPurchaseDate(entry.purchaseDate || '');
            setBillNo(entry.billNo || '');
            setLpoNo(entry.lpoNo || '');
            setNote(entry.note || '');
            setLines((entry.lines || []).map((line, index) => ({ ...line, key: `${entry._id}-${index}` })));
            setAttachment(entry.attachment?.name ? entry.attachment : null);
        } catch (err) {
            setError(apiMessage(err, 'Could not open the draft.'));
        } finally {
            setSaving(false);
        }
    };

    const useBill = async (file) => {
        try {
            const next = await readBillFile(file);
            if (next) setAttachment(next);
        } catch (err) {
            setError(err.message || 'Could not read the file.');
        }
    };

    const submit = async (status) => {
        if (status === 'posted' && purchaseSource === 'vendor') {
            if (!vendorId) {
                setError('Vendor name is required.');
                return;
            }
            if (!purchaseDate) {
                setError('Purchase date is required.');
                return;
            }
            if (!cleanText(billNo)) {
                setError('Bill no is required.');
                return;
            }
        }
        if (status === 'posted') {
            if (lines.length === 0) {
                setError('Add at least one item.');
                return;
            }
            for (let index = 0; index < lines.length; index += 1) {
                const line = lines[index];
                const amount = Number(line.quantity);
                const cost = line.unitPrice === '' ? NaN : Number(line.unitPrice);
                if (!Number.isFinite(amount) || amount <= 0) {
                    setError(`Enter a quantity greater than zero on row ${index + 1}.`);
                    return;
                }
                if (line.unitPrice === '' || !Number.isFinite(cost) || cost < 0) {
                    setError(`Enter a price on row ${index + 1}.`);
                    return;
                }
            }
        }
        setSaving(true);
        setError('');
        try {
            const saved = await saveStockEntry({
                id: entryId,
                clientRequestId,
                status,
                purchaseSource,
                vendorId: purchaseSource === 'vendor' ? vendorId : '',
                purchaseDate: purchaseSource === 'vendor' ? purchaseDate : '',
                billNo: purchaseSource === 'vendor' ? billNo : '',
                lpoNo: purchaseSource === 'vendor' ? lpoNo : '',
                note,
                lines: lines.map((line) => ({
                    itemId: line.itemId,
                    categoryId: line.categoryId,
                    subcategoryId: line.subcategoryId,
                    brandId: line.brandId,
                    modelNumber: line.modelNumber,
                    itemName: line.itemName,
                    description: line.description,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                })),
                attachment: attachment ? {
                    name: attachment.name,
                    mimeType: attachment.mimeType,
                    publicId: attachment.publicId || '',
                    url: attachment.url || '',
                    data: attachment.data || '',
                } : null,
            });
            if (status === 'posted') {
                if (saved.status === 'pending') {
                    toast({
                        title: 'Submitted',
                        description: `Waiting for ${saved.approverName || 'the purchase officer'}.`,
                    });
                } else {
                    toast({ title: 'Stock added', description: 'The stock entry was saved and inventory was updated.' });
                }
                onSaved?.();
                onClose();
                return;
            }
            setEntryId(String(saved._id || entryId));
            if (saved.clientRequestId) setClientRequestId(saved.clientRequestId);
            toast({ title: 'Draft saved', description: 'Inventory quantities were not changed.' });
            const draftResult = await listStockEntries('draft').catch(() => ({ entries: [] }));
            setDrafts(Array.isArray(draftResult?.entries) ? draftResult.entries : []);
        } catch (err) {
            const message = apiMessage(err, 'Could not save the stock entry.');
            setError(message);
            toast({ title: 'Could not save', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const decide = async (action) => {
        if (!reviewEntryId) return;
        setSaving(true);
        setError('');
        try {
            if (action === 'accept') {
                await approveStockEntry(reviewEntryId);
                toast({ title: 'Stock accepted', description: 'Inventory was updated.' });
            } else {
                await rejectStockEntry(reviewEntryId);
                toast({ title: 'Stock rejected', description: 'The waiting stock was removed.' });
            }
            onSaved?.();
            onClose();
        } catch (err) {
            const message = apiMessage(err, 'Could not update this stock entry.');
            setError(message);
            toast({ title: 'Could not update', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const grandTotal = lines.reduce((sum, line) => sum + lineTotal(line.quantity, line.unitPrice), 0);
    const actionLabel = directPost ? 'OK' : 'Submit';

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-3 sm:p-6">
            <form
                onSubmit={(event) => event.preventDefault()}
                className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Add Bill"
            >
                <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Boxes size={18} />
                        </span>
                        <h2 className="text-lg font-semibold text-slate-900">Add Bill</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {locked ? null : (
                            <button type="button" onClick={clearEntry} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-700">
                                <RotateCcw size={14} /> Reset
                            </button>
                        )}
                        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                            <X size={18} />
                        </button>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    {locked ? (
                        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Waiting for {approverName || 'the purchase officer'}.
                            {submittedByName ? ` Submitted by ${submittedByName}.` : ''}
                        </p>
                    ) : null}
                    {!locked && drafts.length ? (
                        <label className="mb-4 block text-sm text-slate-600">
                            <span className="mb-1 block font-medium">Saved drafts</span>
                            <select
                                className={fieldClass}
                                value={entryId}
                                onChange={(event) => openDraft(event.target.value)}
                            >
                                <option value="">Open a draft</option>
                                {drafts.map((draft) => (
                                    <option key={draft._id} value={draft._id}>
                                        {draft.purchaseSource === 'manual' ? 'Manual' : 'Vendor'}
                                        {draft.billNo ? ` · ${draft.billNo}` : ''}
                                        {` · ${draft.lineCount || 0} items`}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    {loading ? <p className="text-sm text-slate-500">Loading items...</p> : (
                        <div className="space-y-4">
                            {locked ? null : (
                            <>
                            <div>
                                <p className="mb-2 text-sm font-medium text-slate-700">Purchase Source</p>
                                <div className="inline-flex rounded-xl bg-[#F3F4F8] p-1">
                                    <button
                                        type="button"
                                        onClick={() => setPurchaseSource('vendor')}
                                        className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold ${purchaseSource === 'vendor' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                                    >
                                        <Store size={15} /> Vendor
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPurchaseSource('manual')}
                                        className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold ${purchaseSource === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                                    >
                                        <Pencil size={15} /> Manual
                                    </button>
                                </div>
                            </div>
                            {purchaseSource === 'vendor' ? (
                                <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#F5F7FB] p-4 sm:grid-cols-2 xl:grid-cols-4">
                                    <TypeSuggest
                                        label="Vendor Name"
                                        required
                                        text={vendorText}
                                        options={vendorOptions}
                                        placeholder="Select vendor"
                                        onText={typeVendor}
                                        onPick={chooseVendor}
                                        onCommit={commitVendor}
                                    />
                                    <label>
                                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Purchase Date <span className="text-red-500">*</span></span>
                                        <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className={fieldClass} />
                                    </label>
                                    <label>
                                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Bill No <span className="text-red-500">*</span></span>
                                        <input value={billNo} onChange={(event) => setBillNo(event.target.value)} placeholder="Enter bill no" className={fieldClass} />
                                    </label>
                                    <label>
                                        <span className="mb-1.5 block text-sm font-medium text-slate-700">LPO No</span>
                                        <input value={lpoNo} onChange={(event) => setLpoNo(event.target.value)} placeholder="Enter LPO no (optional)" className={fieldClass} />
                                    </label>
                                    <label className="sm:col-span-2 xl:col-span-4">
                                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Note</span>
                                        <textarea
                                            value={note}
                                            onChange={(event) => setNote(event.target.value)}
                                            placeholder="Enter note..."
                                            className={`${fieldClass} h-auto min-h-[88px] py-2`}
                                        />
                                    </label>
                                </div>
                            ) : (
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Note</span>
                                    <textarea
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                        placeholder="Enter note..."
                                        className={`${fieldClass} h-auto min-h-[88px] py-2`}
                                    />
                                </label>
                            )}
                            <div className="rounded-xl bg-[#F5F7FB] p-4">
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                    <TypeSuggest
                                        label="Category"
                                        required
                                        text={categoryText}
                                        options={categoryOptions}
                                        placeholder="Select category"
                                        onText={typeCategory}
                                        onPick={chooseCategory}
                                        onCommit={commitCategory}
                                    />
                                    <TypeSuggest
                                        label="Sub Category"
                                        required
                                        text={subcategoryText}
                                        options={subcategoryOptions}
                                        placeholder="Select sub category"
                                        onText={typeSubcategory}
                                        onPick={chooseSubcategory}
                                        onCommit={commitSubcategory}
                                    />
                                    <TypeSuggest
                                        label="Item"
                                        required
                                        text={itemText}
                                        options={itemOptions}
                                        placeholder="Select item"
                                        onText={typeItem}
                                        onPick={chooseItem}
                                        onCommit={commitItem}
                                    />
                                    <TypeSuggest
                                        label="Brand"
                                        required
                                        text={brandText}
                                        options={brandOptions}
                                        placeholder="Select brand"
                                        onText={typeBrand}
                                        onPick={chooseBrand}
                                        onCommit={commitBrand}
                                        showAll
                                    />
                                    <TypeSuggest
                                        label="Model No"
                                        text={modelNumber}
                                        options={modelOptions}
                                        placeholder="Enter model no"
                                        onText={typeModel}
                                        onPick={chooseModel}
                                        onCommit={commitModel}
                                    />
                                    <div className="flex items-end justify-end">
                                        <button type="button" onClick={addMaterial} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white">
                                            <Plus size={16} /> Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                            {locked && purchaseSource === 'vendor' ? (
                                <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#F5F7FB] p-4 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                                    <p><span className="block text-xs text-slate-400">Vendor</span>{vendorText || '—'}</p>
                                    <p><span className="block text-xs text-slate-400">Purchase date</span>{purchaseDate || '—'}</p>
                                    <p><span className="block text-xs text-slate-400">Bill no</span>{billNo || '—'}</p>
                                    <p><span className="block text-xs text-slate-400">LPO no</span>{lpoNo || '—'}</p>
                                    <p className="sm:col-span-2 xl:col-span-4 whitespace-pre-wrap"><span className="block text-xs text-slate-400">Note</span>{note || '—'}</p>
                                </div>
                            ) : locked ? (
                                <div className="rounded-xl bg-[#F5F7FB] p-4 text-sm text-slate-700">
                                    <p className="whitespace-pre-wrap"><span className="block text-xs text-slate-400">Note</span>{note || '—'}</p>
                                </div>
                            ) : null}
                            <div className="overflow-x-auto rounded-xl border border-[#EEF2F7]">
                                <table className="w-full min-w-[720px] text-left text-sm">
                                    <thead className="bg-[#EEF1F8] text-slate-500">
                                        <tr>
                                            {['Sl.No', 'Item', 'Qty', 'Unit Price', 'Total', ''].map((heading) => (
                                                <th key={heading || 'action'} className="px-3 py-3 font-medium">{heading}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">No items added yet.</td>
                                            </tr>
                                        ) : lines.map((line, index) => (
                                            <tr key={line.key} className="border-t border-[#EEF2F7]">
                                                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                                                <td className="px-3 py-3 text-slate-800">
                                                    <p className="font-medium">{line.itemName || line.description}</p>
                                                    {line.description && line.itemName && line.description !== line.itemName ? (
                                                        <p className="mt-0.5 text-xs text-slate-400">{line.description}</p>
                                                    ) : null}
                                                    {line.modelNumber ? <p className="mt-0.5 text-xs text-slate-400">Model {line.modelNumber}</p> : null}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.quantity}
                                                        readOnly={locked}
                                                        onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                                                        className="h-10 w-24 rounded-lg border border-[#E2E8F0] px-2 text-sm outline-none focus:border-indigo-500 read-only:bg-slate-50"
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.unitPrice}
                                                        readOnly={locked}
                                                        onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                                                        className="h-10 w-32 rounded-lg border border-[#E2E8F0] px-2 text-sm outline-none focus:border-indigo-500 read-only:bg-slate-50"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 font-semibold text-slate-900">{money(lineTotal(line.quantity, line.unitPrice))}</td>
                                                <td className="px-3 py-3">
                                                    {locked ? null : (
                                                        <button type="button" onClick={() => removeLine(line.key)} aria-label={`Remove row ${index + 1}`} className="text-red-500 hover:text-red-700">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {lines.length ? (
                                <p className="text-right text-sm font-semibold text-slate-800">Grand total {money(grandTotal)}</p>
                            ) : null}
                            <div>
                                <p className="mb-2 text-sm font-medium text-slate-800">Bill Attachment <span className="font-normal text-slate-400">(Optional)</span></p>
                                {locked ? (
                                    <p className="rounded-xl border border-[#D5DDEA] bg-[#F8FAFC] px-4 py-3 text-sm text-slate-600">{attachment?.name || 'No attachment'}</p>
                                ) : (
                                <div
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setDragOver(true);
                                    }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        setDragOver(false);
                                        useBill(event.dataTransfer.files?.[0]);
                                    }}
                                    className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-[#D5DDEA] bg-[#F8FAFC]'}`}
                                >
                                    <Upload size={18} className="text-indigo-500" />
                                    <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 text-sm font-semibold text-indigo-600">
                                        Choose File
                                    </button>
                                    <p className="text-xs text-slate-400">or drag and drop · PDF, JPG, PNG (max 10 MB)</p>
                                    {attachment?.name ? (
                                        <button type="button" onClick={() => setAttachment(null)} className="mt-2 text-xs text-slate-500 hover:text-red-600">
                                            {attachment.name} · Remove
                                        </button>
                                    ) : null}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                        className="hidden"
                                        onChange={(event) => {
                                            useBill(event.target.files?.[0]);
                                            event.target.value = '';
                                        }}
                                    />
                                </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#EEF2F7] px-5 py-4">
                    {error ? <p className="mr-auto min-w-[220px] text-sm text-red-600">{error}</p> : null}
                    <button type="button" onClick={onClose} className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-600">Cancel</button>
                    {locked ? (
                        directPost ? (
                            <>
                                <button type="button" onClick={() => decide('reject')} disabled={saving || loading} className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 disabled:opacity-60">
                                    {saving ? 'Saving...' : 'Reject'}
                                </button>
                                <button type="button" onClick={() => decide('accept')} disabled={saving || loading} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                                    <Check size={15} /> {saving ? 'Saving...' : 'Accept'}
                                </button>
                            </>
                        ) : null
                    ) : (
                        <>
                            <button type="button" onClick={() => submit('draft')} disabled={saving || loading} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-indigo-200 px-4 text-sm font-semibold text-indigo-700 disabled:opacity-60">
                                <FileText size={15} /> Draft
                            </button>
                            <button type="button" onClick={() => submit('posted')} disabled={saving || loading} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                                <Check size={15} /> {saving ? 'Saving...' : actionLabel}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}
