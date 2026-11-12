'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Country } from 'country-state-city';
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

function asRows(value) {
    return Array.isArray(value) ? value : [];
}

function sameId(row, id) {
    return String(row?._id || '') === String(id || '');
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
    const [subsLoading, setSubsLoading] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [addingItem, setAddingItem] = useState(false);
    const [optionName, setOptionName] = useState('');
    const [savingOption, setSavingOption] = useState(false);
    const [error, setError] = useState('');
    const countries = useMemo(() => Country.getAllCountries().map((country) => country.name), []);

    useEffect(() => {
        if (initial) setForm((current) => ({ ...current, ...initial }));
    }, [initial]);

    useEffect(() => {
        let cancelled = false;
        if (!localStorage.getItem('token')) return undefined;
        Promise.all([listCategories(), listBrands()])
            .then(([categoryRows, brandRows]) => {
                if (cancelled) return;
                setCategories(asRows(categoryRows));
                setBrands(asRows(brandRows));
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load categories and brands.'));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!form.categoryId) {
            setSubcategories([]);
            setSubsLoading(false);
            return undefined;
        }
        let cancelled = false;
        setSubcategories([]);
        setSubsLoading(true);
        listSubcategories(form.categoryId)
            .then((rows) => {
                if (!cancelled) setSubcategories(asRows(rows));
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load subcategories.'));
            })
            .finally(() => {
                if (!cancelled) setSubsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [form.categoryId]);

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
                if (!cancelled) setOptions(asRows(rows));
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

    useEffect(() => {
        setAddingItem(false);
        setOptionName('');
    }, [form.subcategoryId]);

    const generated = buildItemDescription({
        brandName: brands.find((row) => sameId(row, form.brandId))?.name || form.brandName,
        subcategoryName: subcategories.find((row) => sameId(row, form.subcategoryId))?.name || form.subcategoryName,
        itemName: options.find((row) => sameId(row, form.itemOptionId))?.name || form.itemName,
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
            if (key === 'categoryId' && value !== current.categoryId) {
                next.subcategoryId = '';
                next.itemOptionId = '';
                next.subcategoryName = '';
                next.itemName = '';
            }
            if (key === 'subcategoryId' && value !== current.subcategoryId) {
                next.itemOptionId = '';
                next.itemName = '';
            }
            return next;
        });
    };

    const saveNewOption = async () => {
        const name = optionName.trim();
        if (!name || !form.subcategoryId || savingOption) return;
        setSavingOption(true);
        setError('');
        try {
            const saved = await createItemOption({ name, subcategoryId: form.subcategoryId });
            const rows = asRows(await listItemOptions(form.subcategoryId));
            setOptions(rows);
            setField('itemOptionId', saved._id);
            setOptionName('');
            setAddingItem(false);
        } catch (err) {
            setError(apiMessage(err, 'Could not add the item.'));
        } finally {
            setSavingOption(false);
        }
    };

    const submit = (event) => {
        event.preventDefault();
        if (!form.categoryId || !form.subcategoryId || !form.itemOptionId || !form.brandId) {
            setError('Category, subcategory, item, and brand are required.');
            return;
        }
        const description = autoGenerate ? generated : String(form.description || '').trim();
        if (!description) {
            setError('Description is required.');
            return;
        }
        onSubmit({
            ...form,
            description,
            reservationQuantity: Number(form.reservationQuantity || 0),
            status: form.status || 'Active',
        });
    };

    const selectedSubcategoryMissing = form.subcategoryId
        && !subcategories.some((row) => String(row._id) === String(form.subcategoryId));
    const selectedItemMissing = form.itemOptionId
        && !options.some((row) => String(row._id) === String(form.itemOptionId));

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
                <Field label="Category" required>
                    <select className={fieldClass} value={form.categoryId} onChange={(event) => setField('categoryId', event.target.value)}>
                        <option value="">Select</option>
                        {categories.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                    </select>
                    {categories.length === 0 ? (
                        <p className="mt-1 text-xs text-amber-700">No category. Create a category first.</p>
                    ) : null}
                </Field>

                <Field label="Description" required>
                    <textarea
                        className={`${fieldClass} min-h-[96px] py-2`}
                        value={form.description}
                        onChange={(event) => {
                            setAutoGenerate(false);
                            setField('description', event.target.value);
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

                <Field label="Sub Category" required>
                    <select
                        className={fieldClass}
                        value={form.subcategoryId}
                        disabled={!form.categoryId || subsLoading}
                        onChange={(event) => setField('subcategoryId', event.target.value)}
                    >
                        <option value="">
                            {!form.categoryId ? 'Select a category first' : subsLoading ? 'Loading...' : 'Select'}
                        </option>
                        {selectedSubcategoryMissing ? (
                            <option value={form.subcategoryId}>{form.subcategoryName || 'Selected subcategory'}</option>
                        ) : null}
                        {subcategories.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                    </select>
                    {form.categoryId && !subsLoading && subcategories.length === 0 ? (
                        <p className="mt-1 text-xs text-amber-700">No subcategory. Create a subcategory first.</p>
                    ) : null}
                </Field>

                <Field label="Item" required>
                    <select
                        className={fieldClass}
                        value={form.itemOptionId}
                        disabled={!form.subcategoryId || optionsLoading}
                        onChange={(event) => setField('itemOptionId', event.target.value)}
                    >
                        <option value="">
                            {!form.subcategoryId ? 'Select a subcategory first' : optionsLoading ? 'Loading...' : 'Select'}
                        </option>
                        {selectedItemMissing ? (
                            <option value={form.itemOptionId}>{form.itemName || 'Selected item'}</option>
                        ) : null}
                        {options.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                    </select>
                    {form.subcategoryId && !optionsLoading ? (
                        addingItem ? (
                            <div className="mt-2 flex gap-2">
                                <input
                                    className={fieldClass}
                                    value={optionName}
                                    maxLength={120}
                                    placeholder="New item name"
                                    autoComplete="off"
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
                                onClick={() => setAddingItem(true)}
                                className="mt-1 text-sm font-semibold text-blue-700"
                            >
                                Add item
                            </button>
                        )
                    ) : null}
                </Field>

                <Field label="Brand" required>
                    <select className={fieldClass} value={form.brandId} onChange={(event) => setField('brandId', event.target.value)}>
                        <option value="">Select</option>
                        {brands.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                    </select>
                    {brands.length === 0 ? (
                        <p className="mt-1 text-xs text-amber-700">No brand. Create a brand first.</p>
                    ) : null}
                </Field>

                <Field label="Model Number">
                    <input className={fieldClass} value={form.modelNumber} autoComplete="off" placeholder="Optional" onChange={(event) => setField('modelNumber', event.target.value)} />
                </Field>

                <Field label="Unit of Measure" required>
                    <select className={fieldClass} value={form.unitOfMeasure} onChange={(event) => setField('unitOfMeasure', event.target.value)}>
                        {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                </Field>

                <Field label="HS Code">
                    <input className={fieldClass} value={form.hsCode} autoComplete="off" onChange={(event) => setField('hsCode', event.target.value)} />
                </Field>

                <Field label="Manufacturer Part Number">
                    <input className={fieldClass} value={form.manufacturerPartNumber} autoComplete="off" onChange={(event) => setField('manufacturerPartNumber', event.target.value)} />
                </Field>

                <Field label="Country of Origin">
                    <select className={fieldClass} value={form.countryOfOrigin} onChange={(event) => setField('countryOfOrigin', event.target.value)}>
                        <option value="">Select</option>
                        {countries.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                </Field>
            </div>
        </form>
    );
}
