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
    const [addingOption, setAddingOption] = useState(false);
    const [optionName, setOptionName] = useState('');
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
                setCategories(categoryRows);
                setBrands(brandRows);
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
            return undefined;
        }
        let cancelled = false;
        listSubcategories(form.categoryId)
            .then((rows) => {
                if (!cancelled) setSubcategories(rows);
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load subcategories.'));
            });
        return () => {
            cancelled = true;
        };
    }, [form.categoryId]);

    useEffect(() => {
        if (!form.subcategoryId) {
            setOptions([]);
            return undefined;
        }
        let cancelled = false;
        listItemOptions(form.subcategoryId)
            .then((rows) => {
                if (!cancelled) setOptions(rows);
            })
            .catch((err) => {
                if (!cancelled) setError(apiMessage(err, 'Could not load items.'));
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
                next.subcategoryId = '';
                next.itemOptionId = '';
            }
            if (key === 'subcategoryId') next.itemOptionId = '';
            return next;
        });
    };

    const saveOption = async () => {
        setError('');
        try {
            const saved = await createItemOption({ name: optionName, subcategoryId: form.subcategoryId });
            const rows = await listItemOptions(form.subcategoryId);
            setOptions(rows);
            setField('itemOptionId', saved._id);
            setOptionName('');
            setAddingOption(false);
        } catch (err) {
            setError(apiMessage(err, 'Could not add the item option.'));
        }
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

                <div className="space-y-4">
                    <Field label="Category" required>
                        <select className={fieldClass} value={form.categoryId} onChange={(event) => setField('categoryId', event.target.value)}>
                            <option value="">Select</option>
                            {categories.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Subcategory" required>
                        <select className={fieldClass} value={form.subcategoryId} onChange={(event) => setField('subcategoryId', event.target.value)}>
                            <option value="">Select</option>
                            {subcategories.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Item" required>
                        <span className="flex gap-2">
                            <select className={fieldClass} value={form.itemOptionId} onChange={(event) => setField('itemOptionId', event.target.value)}>
                                <option value="">Select</option>
                                {options.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                            </select>
                            <button
                                type="button"
                                disabled={!form.subcategoryId}
                                onClick={() => setAddingOption((open) => !open)}
                                className="h-10 shrink-0 rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 disabled:opacity-40"
                            >
                                Add
                            </button>
                        </span>
                        {addingOption ? (
                            <span className="mt-2 flex gap-2">
                                <input className={fieldClass} value={optionName} placeholder="New item name" onChange={(event) => setOptionName(event.target.value)} />
                                <button type="button" onClick={saveOption} className="h-10 shrink-0 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">
                                    Save
                                </button>
                            </span>
                        ) : null}
                    </Field>
                </div>

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
