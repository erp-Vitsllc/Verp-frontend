'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Country } from 'country-state-city';
import { fieldClass, labelClass } from './CatalogModal';
import {
    apiMessage,
    buildItemDescription,
    listBrands,
    listCategories,
    listSubcategories,
} from './itemMasterApi';

const UNITS = ['None', 'Box', 'Metre', 'Quantity'];

const emptyForm = {
    categoryId: '',
    subcategoryId: '',
    brandId: '',
    description: '',
    moreDescription: '',
    copyToDescription: false,
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

function sameId(row, id) {
    return String(row?._id || '') === String(id || '');
}

function copySnapshot(form) {
    return JSON.stringify({
        categoryId: String(form?.categoryId || ''),
        subcategoryId: String(form?.subcategoryId || ''),
        brandId: String(form?.brandId || ''),
        moreDescription: String(form?.moreDescription || '').trim(),
        copyToDescription: Boolean(form?.copyToDescription),
        modelNumber: String(form?.modelNumber || '').trim(),
        unitOfMeasure: String(form?.unitOfMeasure || ''),
        manufacturerPartNumber: String(form?.manufacturerPartNumber || '').trim(),
        hsCode: String(form?.hsCode || '').trim(),
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

export default function ItemForm({ initial, onSubmit, onCancel, saving, requireChange = false }) {
    const router = useRouter();
    const [form, setForm] = useState(() => ({ ...emptyForm, ...(initial || {}) }));
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [subsLoading, setSubsLoading] = useState(false);
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

    const moreDescription = String(form.moreDescription || '').trim();
    const generated = [
        buildItemDescription({
            brandName: brands.find((row) => sameId(row, form.brandId))?.name || form.brandName,
            subcategoryName: subcategories.find((row) => sameId(row, form.subcategoryId))?.name || form.subcategoryName,
            modelNumber: form.modelNumber,
            manufacturerPartNumber: form.manufacturerPartNumber,
        }),
        form.copyToDescription ? moreDescription : '',
    ].filter(Boolean).join(' ');

    const setField = (key, value) => {
        setForm((current) => {
            const next = { ...current, [key]: value };
            if (key === 'categoryId' && value !== current.categoryId) {
                next.subcategoryId = '';
                next.subcategoryName = '';
            }
            return next;
        });
    };

    const submit = (event) => {
        event.preventDefault();
        if (!form.categoryId || !form.subcategoryId || !form.brandId) {
            setError('Category, subcategory, and brand are required.');
            return;
        }
        if (!form.unitOfMeasure || form.unitOfMeasure === 'None') {
            setError('Choose a unit of measure.');
            return;
        }
        if (!generated) {
            setError('Description is required.');
            return;
        }
        if (requireChange && copySnapshot(form) === copySnapshot(initial || emptyForm)) {
            setError('Change something before saving. The original item is not changed.');
            return;
        }
        onSubmit({
            categoryId: form.categoryId,
            subcategoryId: form.subcategoryId,
            brandId: form.brandId,
            description: generated,
            moreDescription,
            copyToDescription: Boolean(form.copyToDescription),
            modelNumber: form.modelNumber,
            unitOfMeasure: form.unitOfMeasure,
            manufacturerPartNumber: form.manufacturerPartNumber,
            reservationQuantity: Number(form.reservationQuantity || 0),
            hsCode: form.hsCode,
            countryOfOrigin: form.countryOfOrigin,
            status: form.status || 'Active',
        });
    };

    const selectedSubcategoryMissing = form.subcategoryId
        && !subcategories.some((row) => String(row._id) === String(form.subcategoryId));
    const unchanged = requireChange && copySnapshot(form) === copySnapshot(initial || emptyForm);
    const leave = () => {
        if (onCancel) {
            onCancel();
            return;
        }
        router.push('/inventory/item-master');
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
                    This is a copy. Change at least one field to save a new item. The original item stays the same.
                </p>
            ) : null}
            <p className="mb-4 border-b border-blue-600 pb-2 text-sm font-semibold text-blue-700">1. General Information</p>
            {error ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

            <div className="grid grid-cols-1 items-start gap-x-8 gap-y-4 md:grid-cols-2">
                <div className="flex flex-col gap-4">
                    <Field label="Category" required>
                        <select className={fieldClass} value={form.categoryId} onChange={(event) => setField('categoryId', event.target.value)}>
                            <option value="">Select</option>
                            {categories.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                        </select>
                        {categories.length === 0 ? (
                            <p className="mt-1 text-xs text-amber-700">No category. Create a category first.</p>
                        ) : null}
                    </Field>

                    <Field label="More Description">
                        <textarea
                            className={`${fieldClass} min-h-[72px] py-2`}
                            value={form.moreDescription}
                            maxLength={500}
                            onChange={(event) => setField('moreDescription', event.target.value)}
                        />
                        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={Boolean(form.copyToDescription)}
                                onChange={(event) => setField('copyToDescription', event.target.checked)}
                            />
                            Copy to description
                        </label>
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

                    <Field label="Brand" required>
                        <select className={fieldClass} value={form.brandId} onChange={(event) => setField('brandId', event.target.value)}>
                            <option value="">Select</option>
                            {brands.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                        </select>
                        {brands.length === 0 ? (
                            <p className="mt-1 text-xs text-amber-700">No brand. Create a brand first.</p>
                        ) : null}
                    </Field>

                    <Field label="Unit of Measure" required>
                        <select className={fieldClass} value={form.unitOfMeasure} onChange={(event) => setField('unitOfMeasure', event.target.value)}>
                            {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                    </Field>

                    <Field label="Manufacturer Part Number">
                        <input className={fieldClass} value={form.manufacturerPartNumber} autoComplete="off" onChange={(event) => setField('manufacturerPartNumber', event.target.value)} />
                    </Field>
                </div>

                <div className="flex flex-col gap-4">
                    <Field label="Description" required>
                        <textarea
                            className={`${fieldClass} min-h-[96px] bg-slate-50 py-2`}
                            value={generated}
                            readOnly
                            aria-readonly="true"
                        />
                    </Field>

                    <Field label="Model Number">
                        <input className={fieldClass} value={form.modelNumber} autoComplete="off" placeholder="Optional" onChange={(event) => setField('modelNumber', event.target.value)} />
                    </Field>

                    <Field label="HS Code">
                        <input className={fieldClass} value={form.hsCode} autoComplete="off" onChange={(event) => setField('hsCode', event.target.value)} />
                    </Field>

                    <Field label="Country of Origin">
                        <select className={fieldClass} value={form.countryOfOrigin} onChange={(event) => setField('countryOfOrigin', event.target.value)}>
                            <option value="">Select</option>
                            {countries.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </Field>
                </div>
            </div>
        </form>
    );
}
