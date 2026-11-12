'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Country } from 'country-state-city';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fieldClass, labelClass } from './CatalogModal';
import {
    apiMessage,
    buildItemDescription,
    createItemOption,
    listBrands,
    listCategories,
    listItemOptions,
    listSubcategories,
} from './itemMasterApi';

const UNITS = ['Box', 'Metre', 'Quantity'];
const STATUSES = ['Active', 'Low Stock', 'Out of Stock'];

const emptyForm = {
    categoryId: '',
    subcategoryId: '',
    itemOptionId: '',
    brandId: '',
    description: '',
    modelNumber: '',
    unitOfMeasure: 'Box',
    manufacturerPartNumber: '',
    reservationQuantity: 0,
    hsCode: '',
    countryOfOrigin: '',
    status: 'Active',
};

function named(rows, id, fallback) {
    if (!id) return '';
    const found = (Array.isArray(rows) ? rows : []).find((row) => String(row._id) === String(id))?.name;
    return found || fallback || '';
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

export default function ItemForm({ initial, onSubmit, saving }) {
    const router = useRouter();
    const [form, setForm] = useState(() => ({ ...emptyForm, ...(initial || {}) }));
    const [autoGenerate, setAutoGenerate] = useState(!initial?.description);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [options, setOptions] = useState([]);
    const [brands, setBrands] = useState([]);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [error, setError] = useState('');
    const countries = useMemo(() => Country.getAllCountries().map((country) => country.name), []);

    useEffect(() => {
        if (initial) setForm((current) => ({ ...current, ...initial }));
    }, [initial]);

    useEffect(() => {
        let cancelled = false;
        if (!localStorage.getItem('token')) return undefined;
        Promise.all([listCategories(), listBrands(), listSubcategories()])
            .then(([categoryRows, brandRows, subcategoryRows]) => {
                if (cancelled) return;
                setCategories(categoryRows);
                setBrands(brandRows);
                setSubcategories(subcategoryRows);
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load categories and brands.'));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!form.subcategoryId) {
            setOptions([]);
            setOptionsLoading(false);
            return undefined;
        }
        let cancelled = false;
        setOptions([]);
        setOptionsLoading(true);
        listItemOptions(form.subcategoryId)
            .then((rows) => {
                if (!cancelled) setOptions(rows);
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load items.'));
            })
            .finally(() => {
                if (!cancelled) setOptionsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [form.subcategoryId]);

    const generated = buildItemDescription({
        brandName: brands.find((row) => row._id === form.brandId)?.name,
        subcategoryName: subcategories.find((row) => row._id === form.subcategoryId)?.name,
        itemName: options.find((row) => row._id === form.itemOptionId)?.name,
        modelNumber: form.modelNumber,
        manufacturerPartNumber: form.manufacturerPartNumber,
    });

    useEffect(() => {
        if (!autoGenerate) return;
        setForm((current) => (current.description === generated ? current : { ...current, description: generated }));
    }, [autoGenerate, generated]);

    const setField = (key, value) => {
        setForm((current) => {
            const next = { ...current, [key]: value };
            if (key === 'categoryId') {
                next.categoryName = '';
            }
            if (key === 'subcategoryId') {
                next.itemOptionId = '';
                next.subcategoryName = '';
                next.itemName = '';
            }
            return next;
        });
    };

    const saveOption = async (name) => {
        setError('');
        const saved = await createItemOption({ name, subcategoryId: form.subcategoryId });
        const rows = await listItemOptions(form.subcategoryId);
        setOptions(rows);
        setField('itemOptionId', saved._id);
        return saved;
    };

    const submit = (event) => {
        event.preventDefault();
        onSubmit({
            ...form,
            reservationQuantity: Number(form.reservationQuantity || 0),
            description: autoGenerate ? generated : form.description,
        });
    };

    return (
        <form onSubmit={submit} className="rounded-2xl border border-[#E6EDF5] bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Add / Edit Item</h1>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => router.push('/inventory/item-master')} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        Back
                    </button>
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => router.push('/inventory/item-master')} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                </div>
            </div>

            <p className="mb-4 border-b border-blue-600 pb-2 text-sm font-semibold text-blue-700">1. General Information</p>
            {error ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                <Field label="Description" required>
                    <textarea
                        className={`${fieldClass} min-h-[96px] py-2`}
                        value={form.description}
                        onChange={(event) => {
                            const value = event.target.value;
                            setAutoGenerate(false);
                            setField('description', value);
                        }}
                    />
                    <span className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <input
                            type="checkbox"
                            checked={autoGenerate}
                            onChange={(event) => setAutoGenerate(event.target.checked)}
                        />
                        Auto Generate
                    </span>
                </Field>

                <Field label="Category" required>
                    <CategoryPathField
                        categories={categories}
                        subcategories={subcategories}
                        options={options}
                        categoryId={form.categoryId}
                        subcategoryId={form.subcategoryId}
                        itemOptionId={form.itemOptionId}
                        categoryName={named(categories, form.categoryId, form.categoryName)}
                        subcategoryName={named(subcategories, form.subcategoryId, form.subcategoryName)}
                        itemName={named(options, form.itemOptionId, form.itemName)}
                        optionsLoading={optionsLoading}
                        onCategory={(id) => setField('categoryId', id)}
                        onSubcategory={(id) => setField('subcategoryId', id)}
                        onItem={(id) => setField('itemOptionId', id)}
                        onCreateOption={saveOption}
                        onError={(message) => setError(message)}
                    />
                </Field>

                <Field label="Brand" required>
                    <select className={fieldClass} value={form.brandId} onChange={(event) => setField('brandId', event.target.value)}>
                        <option value="">Select</option>
                        {brands.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                    </select>
                </Field>
                <Field label="Reservation Quantity">
                    <input
                        type="number"
                        min="0"
                        step="1"
                        className={fieldClass}
                        value={form.reservationQuantity}
                        onChange={(event) => setField('reservationQuantity', event.target.value)}
                    />
                </Field>
                <Field label="Model Number" required>
                    <input className={fieldClass} value={form.modelNumber} onChange={(event) => setField('modelNumber', event.target.value)} />
                </Field>
                <Field label="HS Code">
                    <input className={fieldClass} value={form.hsCode} onChange={(event) => setField('hsCode', event.target.value)} />
                </Field>
                <Field label="Unit of Measure" required>
                    <select className={fieldClass} value={form.unitOfMeasure} onChange={(event) => setField('unitOfMeasure', event.target.value)}>
                        {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                </Field>
                <Field label="Country of Origin">
                    <select className={fieldClass} value={form.countryOfOrigin} onChange={(event) => setField('countryOfOrigin', event.target.value)}>
                        <option value="">Select</option>
                        {countries.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                </Field>
                <Field label="Manufacturer Part Number">
                    <input className={fieldClass} value={form.manufacturerPartNumber} onChange={(event) => setField('manufacturerPartNumber', event.target.value)} />
                </Field>
                <Field label="Status">
                    <select className={fieldClass} value={form.status} onChange={(event) => setField('status', event.target.value)}>
                        {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                </Field>
            </div>
        </form>
    );
}

function CategoryPathField({
    categories,
    subcategories,
    options,
    categoryId,
    subcategoryId,
    itemOptionId,
    categoryName,
    subcategoryName,
    itemName,
    optionsLoading,
    onCategory,
    onSubcategory,
    onItem,
    onCreateOption,
    onError,
}) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState('category');
    const [adding, setAdding] = useState(false);
    const [optionName, setOptionName] = useState('');
    const [savingOption, setSavingOption] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const parts = [
        categoryId ? { key: 'category', name: categoryName } : null,
        subcategoryId ? { key: 'subcategory', name: subcategoryName } : null,
        itemOptionId ? { key: 'item', name: itemName } : null,
    ].filter((part) => part?.name);

    const openStep = (next) => {
        const allowed = next === 'item' && !subcategoryId ? 'subcategory' : next;
        setStep(allowed);
        setAdding(false);
        setOpen(true);
    };

    const toggle = (next) => {
        if (open && step === next) {
            setOpen(false);
            return;
        }
        openStep(next);
    };

    const defaultStep = !categoryId ? 'category' : !subcategoryId ? 'subcategory' : 'item';

    const chooseCategory = (id) => {
        onCategory(id);
        setStep('subcategory');
        setAdding(false);
    };
    const chooseSubcategory = (id) => {
        onSubcategory(id);
        setStep('item');
        setAdding(false);
    };
    const chooseItem = (id) => {
        onItem(id);
        setOpen(false);
        setAdding(false);
    };

    const saveNewOption = async () => {
        const name = optionName.trim();
        if (!name || savingOption) return;
        setSavingOption(true);
        try {
            await onCreateOption(name);
            setOptionName('');
            setAdding(false);
            setOpen(false);
        } catch (err) {
            onError(apiMessage(err, 'Could not add the item option.'));
        } finally {
            setSavingOption(false);
        }
    };

    const rows = step === 'category' ? categories : step === 'subcategory' ? subcategories : options;
    const selectedId = step === 'category' ? categoryId : step === 'subcategory' ? subcategoryId : itemOptionId;
    const loading = step === 'item' ? optionsLoading : false;
    const stepLabel = step === 'category' ? 'Category' : step === 'subcategory' ? 'Subcategory' : 'Item';

    return (
        <div ref={rootRef} className="relative">
            <div className={`flex h-10 w-full items-center rounded-lg border bg-white px-3 ${open ? 'border-blue-500' : 'border-[#E2E8F0]'}`}>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                    {parts.length ? parts.map((part, index) => (
                        <span key={part.key} className="flex min-w-0 items-center gap-1.5">
                            {index > 0 ? <ChevronRight size={14} className="shrink-0 text-slate-300" /> : null}
                            <button
                                type="button"
                                title={part.name}
                                onClick={() => toggle(part.key)}
                                className="truncate text-sm font-medium text-slate-800"
                            >
                                {part.name}
                            </button>
                        </span>
                    )) : (
                        <button type="button" onClick={() => toggle('category')} className="text-sm text-slate-400">
                            Select
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    aria-label="Choose category"
                    aria-expanded={open}
                    onClick={() => toggle(defaultStep)}
                    className="ml-2 shrink-0 text-slate-500"
                >
                    <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
                </button>
            </div>
            {open ? (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
                    <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-400">{stepLabel}</p>
                    <div className="max-h-56 overflow-auto py-1">
                        {loading ? <p className="px-3 py-2 text-sm text-slate-400">Loading...</p> : null}
                        {!loading && rows.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-400">
                                {step === 'item' ? 'No items yet' : `No ${stepLabel.toLowerCase()} yet`}
                            </p>
                        ) : null}
                        {!loading && rows.map((row) => {
                            const selected = String(row._id) === String(selectedId);
                            return (
                                <button
                                    key={row._id}
                                    type="button"
                                    onClick={() => {
                                        if (step === 'category') chooseCategory(row._id);
                                        else if (step === 'subcategory') chooseSubcategory(row._id);
                                        else chooseItem(row._id);
                                    }}
                                    className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50 ${selected ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800'}`}
                                >
                                    {row.name}
                                </button>
                            );
                        })}
                    </div>
                    {step === 'item' && subcategoryId ? (
                        adding ? (
                            <div className="flex gap-2 border-t border-slate-100 p-2">
                                <input
                                    className={fieldClass}
                                    value={optionName}
                                    placeholder="New item name"
                                    onChange={(event) => setOptionName(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            saveNewOption();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    disabled={savingOption || !optionName.trim()}
                                    onClick={saveNewOption}
                                    className="h-10 shrink-0 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {savingOption ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setAdding(true)}
                                className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-slate-50"
                            >
                                Add
                            </button>
                        )
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
