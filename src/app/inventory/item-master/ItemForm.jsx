'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import { Country } from 'country-state-city';
import { fieldClass, labelClass } from './CatalogModal';
import {
    apiMessage,
    listBrands,
    listCategories,
    listItemOptions,
    listSubcategories,
} from './itemMasterApi';

const UNITS = ['None', 'Box', 'Metre', 'Quantity'];

const emptyForm = {
    categoryId: '',
    categoryName: '',
    subcategoryId: '',
    subcategoryName: '',
    itemOptionId: '',
    itemName: '',
    brandId: '',
    brandName: '',
    modelNumber: '',
    unitOfMeasure: 'None',
    manufacturerPartNumber: '',
    reservationQuantity: 0,
    hsCode: '',
    countryOfOrigin: '',
    status: 'Active',
};

function asRows(value) {
    return Array.isArray(value) ? value : [];
}

function cleanText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function namesEqual(left, right) {
    return cleanText(left).toLowerCase() === cleanText(right).toLowerCase();
}

function sameId(row, id) {
    return String(row?._id || '') === String(id || '');
}

function rowById(rows, id) {
    return rows.find((row) => sameId(row, id));
}

function copySnapshot(form) {
    return JSON.stringify({
        categoryName: cleanText(form?.categoryName),
        subcategoryName: cleanText(form?.subcategoryName),
        itemName: cleanText(form?.itemName),
        brandName: cleanText(form?.brandName),
        modelNumber: cleanText(form?.modelNumber),
        unitOfMeasure: String(form?.unitOfMeasure || ''),
        manufacturerPartNumber: cleanText(form?.manufacturerPartNumber),
        hsCode: cleanText(form?.hsCode),
        countryOfOrigin: String(form?.countryOfOrigin || ''),
    });
}

function Field({ label, required, children }) {
    return (
        <div>
            <span className={labelClass}>
                {label}
                {required ? <span className="text-red-500"> *</span> : null}
            </span>
            {children}
        </div>
    );
}

function NameSuggest({ label, text, options, placeholder, onText, onPick, onCommit, required = false, note = '' }) {
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const [active, setActive] = useState(0);
    const needle = cleanText(text).toLowerCase();
    const shown = needle
        ? options.filter((option) => {
            const labelText = cleanText(option.label).toLowerCase();
            const extra = cleanText(option.searchText).toLowerCase();
            return labelText.includes(needle) || (extra && extra.includes(needle));
        })
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
                <li key={`${option.value}:${option.label}`}>
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
            <span className={labelClass}>
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
            {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
        </label>
    );
}

export default function ItemForm({ initial, onSubmit, onCancel, saving, requireChange = false }) {
    const router = useRouter();
    const [form, setForm] = useState(() => ({ ...emptyForm, ...(initial || {}) }));
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [itemOptions, setItemOptions] = useState([]);
    const [error, setError] = useState('');
    const countries = useMemo(() => Country.getAllCountries().map((country) => country.name), []);

    useEffect(() => {
        if (initial) setForm((current) => ({ ...current, ...initial }));
    }, [initial]);

    useEffect(() => {
        setForm((current) => {
            const category = rowById(categories, current.categoryId);
            const sub = rowById(subcategories, current.subcategoryId);
            const brand = rowById(brands, current.brandId);
            const option = itemOptions.find((row) => sameId(row, current.itemOptionId));
            const next = { ...current };
            let changed = false;
            if (category && !cleanText(current.categoryName)) {
                next.categoryName = category.name || '';
                changed = true;
            }
            if (sub && !cleanText(current.subcategoryName)) {
                next.subcategoryName = sub.name || '';
                changed = true;
            }
            if (brand && !cleanText(current.brandName)) {
                next.brandName = brand.name || '';
                changed = true;
            }
            if (option && !cleanText(current.itemName)) {
                next.itemName = option.name || '';
                changed = true;
            }
            return changed ? next : current;
        });
    }, [categories, subcategories, brands, itemOptions]);

    useEffect(() => {
        let cancelled = false;
        if (!localStorage.getItem('token')) return undefined;
        Promise.all([listCategories(), listSubcategories(), listBrands(), listItemOptions()])
            .then(([categoryRows, subcategoryRows, brandRows, optionRows]) => {
                if (cancelled) return;
                setCategories(asRows(categoryRows));
                setSubcategories(asRows(subcategoryRows));
                setBrands(asRows(brandRows));
                setItemOptions(asRows(optionRows));
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load categories, subcategories, and brands.'));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const categoryOptions = useMemo(
        () => categories.map((row) => ({ value: String(row._id), label: row.name || 'Category', searchText: row.name || '' })),
        [categories],
    );
    const subcategoryOptions = useMemo(() => {
        const rows = form.categoryId
            ? subcategories.filter((row) => sameId({ _id: row.categoryId }, form.categoryId))
            : subcategories;
        return rows.map((row) => ({ value: String(row._id), label: row.name || 'Sub category', searchText: row.name || '' }));
    }, [subcategories, form.categoryId]);
    const brandOptions = useMemo(
        () => brands.map((row) => ({ value: String(row._id), label: row.name || 'Brand', searchText: row.name || '' })),
        [brands],
    );
    const itemChoices = useMemo(() => {
        const pool = form.subcategoryId
            ? itemOptions.filter((row) => sameId({ _id: row.subcategoryId }, form.subcategoryId))
            : itemOptions;
        const counts = new Map();
        pool.forEach((row) => {
            const key = cleanText(row.name).toLowerCase();
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return pool.map((row) => {
            const subName = rowById(subcategories, row.subcategoryId)?.name || '';
            const crowded = (counts.get(cleanText(row.name).toLowerCase()) || 0) > 1;
            return {
                value: String(row._id),
                label: crowded && subName ? `${row.name} — ${subName}` : (row.name || 'Item'),
                searchText: row.name || '',
            };
        });
    }, [itemOptions, form.subcategoryId, subcategories]);

    const namedNote = (rows, name, fresh) => {
        const typed = cleanText(name);
        if (!typed) return '';
        if (rows.some((row) => namesEqual(row.name, typed))) return '';
        return fresh;
    };
    const knownSubcategory = subcategories.find((row) => namesEqual(row.name, form.subcategoryName));
    const subcategoryOwner = knownSubcategory ? rowById(categories, knownSubcategory.categoryId) : null;
    const subcategoryNote = !cleanText(form.subcategoryName)
        ? ''
        : knownSubcategory && form.categoryName && subcategoryOwner && !namesEqual(subcategoryOwner.name, form.categoryName)
            ? 'This sub category belongs to another category.'
            : namedNote(subcategories, form.subcategoryName, 'New sub category. It will be added when you save.');

    const chooseCategory = (nextId) => {
        const category = rowById(categories, nextId);
        setForm((current) => {
            const next = { ...current, categoryId: String(nextId), categoryName: category?.name || '' };
            const sub = rowById(subcategories, current.subcategoryId);
            if (!sub || String(sub.categoryId) !== String(nextId)) {
                next.subcategoryId = '';
                next.subcategoryName = '';
                next.itemOptionId = '';
                next.itemName = '';
            }
            return next;
        });
    };

    const typeCategory = (text) => {
        setForm((current) => {
            const next = { ...current, categoryName: text };
            const selected = rowById(categories, current.categoryId);
            if (selected && namesEqual(selected.name, text)) return next;
            next.categoryId = '';
            next.subcategoryId = '';
            next.subcategoryName = '';
            next.itemOptionId = '';
            next.itemName = '';
            return next;
        });
    };

    const commitCategory = (text) => {
        const name = cleanText(text);
        const matches = categories.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseCategory(String(matches[0]._id));
        else setForm((current) => ({ ...current, categoryName: name, categoryId: '' }));
    };

    const chooseSubcategory = (nextId) => {
        const sub = rowById(subcategories, nextId);
        const category = sub ? rowById(categories, sub.categoryId) : null;
        setForm((current) => {
            const next = {
                ...current,
                subcategoryId: String(nextId),
                subcategoryName: sub?.name || '',
                categoryId: category ? String(category._id) : current.categoryId,
                categoryName: category?.name || current.categoryName,
            };
            const option = itemOptions.find((row) => sameId(row, current.itemOptionId));
            if (!option || String(option.subcategoryId) !== String(nextId)) {
                next.itemOptionId = '';
                next.itemName = '';
            }
            return next;
        });
    };

    const typeSubcategory = (text) => {
        setForm((current) => {
            const next = { ...current, subcategoryName: text };
            const selected = rowById(subcategories, current.subcategoryId);
            if (selected && namesEqual(selected.name, text)) return next;
            next.subcategoryId = '';
            next.itemOptionId = '';
            next.itemName = '';
            return next;
        });
    };

    const commitSubcategory = (text) => {
        const name = cleanText(text);
        const pool = form.categoryId
            ? subcategories.filter((row) => sameId({ _id: row.categoryId }, form.categoryId))
            : subcategories;
        const matches = pool.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseSubcategory(String(matches[0]._id));
        else setForm((current) => ({ ...current, subcategoryName: name, subcategoryId: '' }));
    };

    const chooseBrand = (nextId) => {
        const brand = rowById(brands, nextId);
        setForm((current) => ({ ...current, brandId: String(nextId), brandName: brand?.name || '' }));
    };

    const typeBrand = (text) => {
        setForm((current) => {
            const selected = rowById(brands, current.brandId);
            if (selected && namesEqual(selected.name, text)) return { ...current, brandName: text };
            return { ...current, brandName: text, brandId: '' };
        });
    };

    const commitBrand = (text) => {
        const name = cleanText(text);
        const matches = brands.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseBrand(String(matches[0]._id));
        else setForm((current) => ({ ...current, brandName: name, brandId: '' }));
    };

    const chooseItem = (nextId) => {
        const option = itemOptions.find((row) => sameId(row, nextId));
        if (!option) return;
        const sub = rowById(subcategories, option.subcategoryId);
        const category = sub ? rowById(categories, sub.categoryId) : null;
        setForm((current) => ({
            ...current,
            itemOptionId: String(option._id),
            itemName: option.name || '',
            subcategoryId: sub ? String(sub._id) : current.subcategoryId,
            subcategoryName: sub?.name || current.subcategoryName,
            categoryId: category ? String(category._id) : current.categoryId,
            categoryName: category?.name || current.categoryName,
        }));
    };

    const typeItem = (text) => {
        setForm((current) => {
            const selected = itemOptions.find((row) => sameId(row, current.itemOptionId));
            if (selected && namesEqual(selected.name, text)) return { ...current, itemName: text };
            return { ...current, itemName: text, itemOptionId: '' };
        });
    };

    const commitItem = (text) => {
        const name = cleanText(text);
        const pool = form.subcategoryId
            ? itemOptions.filter((row) => sameId({ _id: row.subcategoryId }, form.subcategoryId))
            : itemOptions;
        const matches = pool.filter((row) => namesEqual(row.name, name));
        if (matches.length === 1) chooseItem(String(matches[0]._id));
        else setForm((current) => ({ ...current, itemName: name, itemOptionId: '' }));
    };

    const submit = (event) => {
        event.preventDefault();
        const categoryName = cleanText(form.categoryName);
        const subcategoryName = cleanText(form.subcategoryName);
        const itemName = cleanText(form.itemName);
        const brandName = cleanText(form.brandName);
        if (!categoryName || !subcategoryName || !itemName || !brandName) {
            setError('Category, sub category, item, and brand are required.');
            return;
        }
        if (knownSubcategory && subcategoryOwner && !namesEqual(subcategoryOwner.name, categoryName)) {
            setError('This sub category belongs to another category.');
            return;
        }
        if (!form.unitOfMeasure || form.unitOfMeasure === 'None') {
            setError('Choose a unit of measure.');
            return;
        }
        if (requireChange && copySnapshot(form) === copySnapshot(initial || emptyForm)) {
            setError('Change something before saving. The original item is not changed.');
            return;
        }
        setError('');
        onSubmit({
            categoryId: form.categoryId,
            categoryName,
            subcategoryId: form.subcategoryId,
            subcategoryName,
            itemOptionId: form.itemOptionId,
            itemName,
            brandId: form.brandId,
            brandName,
            modelNumber: form.modelNumber,
            unitOfMeasure: form.unitOfMeasure,
            manufacturerPartNumber: form.manufacturerPartNumber,
            reservationQuantity: Number(form.reservationQuantity || 0),
            hsCode: form.hsCode,
            countryOfOrigin: form.countryOfOrigin,
        });
    };

    const unchanged = requireChange && copySnapshot(form) === copySnapshot(initial || emptyForm);
    const leave = () => {
        if (onCancel) {
            onCancel();
            return;
        }
        if (!tryNavigateListReturn(router)) router.push('/inventory/item-master');
    };

    return (
        <form onSubmit={submit} className="rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Add / Edit Item</h1>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={leave} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        Back
                    </button>
                    <button type="submit" disabled={saving || unchanged} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={leave} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                </div>
            </div>

            {requireChange ? (
                <p className="mb-4 text-sm text-slate-500">
                    This is a copy. Change at least one field to save a new item. The model number cannot match another item.
                </p>
            ) : null}
            <p className="mb-4 border-b border-blue-600 pb-2 text-sm font-semibold text-blue-700">1. General Information</p>
            {error ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

            <div className="grid grid-cols-1 items-start gap-x-8 gap-y-4 md:grid-cols-2">
                <div className="flex flex-col gap-4">
                    <NameSuggest
                        label="Category"
                        required
                        text={form.categoryName}
                        options={categoryOptions}
                        placeholder="Select or type category"
                        onText={typeCategory}
                        onPick={chooseCategory}
                        onCommit={commitCategory}
                        note={namedNote(categories, form.categoryName, 'New category. It will be added when you save.')}
                    />
                    <NameSuggest
                        label="Sub Category"
                        required
                        text={form.subcategoryName}
                        options={subcategoryOptions}
                        placeholder="Select or type sub category"
                        onText={typeSubcategory}
                        onPick={chooseSubcategory}
                        onCommit={commitSubcategory}
                        note={subcategoryNote}
                    />
                    <NameSuggest
                        label="Item"
                        required
                        text={form.itemName}
                        options={itemChoices}
                        placeholder="Select or type item"
                        onText={typeItem}
                        onPick={chooseItem}
                        onCommit={commitItem}
                        note={namedNote(
                            form.subcategoryId
                                ? itemOptions.filter((row) => sameId({ _id: row.subcategoryId }, form.subcategoryId))
                                : itemOptions,
                            form.itemName,
                            'New item. It will be added when you save.',
                        )}
                    />
                    <NameSuggest
                        label="Brand"
                        required
                        text={form.brandName}
                        options={brandOptions}
                        placeholder="Select or type brand"
                        onText={typeBrand}
                        onPick={chooseBrand}
                        onCommit={commitBrand}
                        note={namedNote(brands, form.brandName, 'New brand. It will be added when you save.')}
                    />
                    <Field label="Unit of Measure" required>
                        <select className={fieldClass} value={form.unitOfMeasure} onChange={(event) => setForm((current) => ({ ...current, unitOfMeasure: event.target.value }))}>
                            {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                    </Field>
                    <Field label="Manufacturer Part Number">
                        <input className={fieldClass} value={form.manufacturerPartNumber} autoComplete="off" onChange={(event) => setForm((current) => ({ ...current, manufacturerPartNumber: event.target.value }))} />
                    </Field>
                </div>

                <div className="flex flex-col gap-4">
                    <Field label="Model Number">
                        <input
                            className={fieldClass}
                            value={form.modelNumber}
                            autoComplete="off"
                            placeholder="Enter model no"
                            onChange={(event) => setForm((current) => ({ ...current, modelNumber: event.target.value }))}
                        />
                        <p className="mt-1 text-xs text-slate-500">A model number cannot match another item. This item can keep its own.</p>
                    </Field>
                    <Field label="HS Code">
                        <input className={fieldClass} value={form.hsCode} autoComplete="off" onChange={(event) => setForm((current) => ({ ...current, hsCode: event.target.value }))} />
                    </Field>
                    <Field label="Country of Origin">
                        <select className={fieldClass} value={form.countryOfOrigin} onChange={(event) => setForm((current) => ({ ...current, countryOfOrigin: event.target.value }))}>
                            <option value="">Select</option>
                            {countries.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </Field>
                </div>
            </div>
        </form>
    );
}
