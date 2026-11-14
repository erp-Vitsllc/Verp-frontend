'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, X } from 'lucide-react';
import CatalogModal, { fieldClass, labelClass } from '../item-master/CatalogModal';
import { listBrands, listCategories } from '../item-master/itemMasterApi';
import { emailProblem, normalizePhone, phoneProblem } from './vendorFieldValidation';
import { createVendorContact, updateVendorContact, vendorApiMessage } from './vendorManagementApi';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), { ssr: false });

const EMPTY_PRODUCT = { categoryId: '', brandId: '' };

function productRows(contact) {
    const lines = Array.isArray(contact?.lines) ? contact.lines : [];
    const rows = lines
        .filter((line) => line?.categoryId || line?.brandId)
        .map((line) => ({
            categoryId: line.categoryId || '',
            brandId: line.brandId || '',
        }));
    return rows.length ? rows : [{ ...EMPTY_PRODUCT }];
}

export default function AddContactModal({ vendorId, contact, onClose, onSaved }) {
    const [name, setName] = useState(contact?.name || '');
    const [designation, setDesignation] = useState(contact?.designation || '');
    const [email, setEmail] = useState(contact?.emails?.[0] || '');
    const [phone, setPhone] = useState(() => normalizePhone(contact?.phones?.[0] || ''));
    const [products, setProducts] = useState(() => productRows(contact));
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showRequired, setShowRequired] = useState(false);
    const emailError = !email.trim()
        ? (showRequired ? 'Email is required.' : '')
        : emailProblem(email);
    const phoneError = !phone.trim()
        ? (showRequired ? 'Phone number is required.' : '')
        : phoneProblem(phone);

    useEffect(() => {
        let cancelled = false;
        Promise.all([listCategories(), listBrands()])
            .then(([categoryRows, brandRows]) => {
                if (cancelled) return;
                setCategories(Array.isArray(categoryRows) ? categoryRows : []);
                setBrands(Array.isArray(brandRows) ? brandRows : []);
            })
            .catch((loadError) => {
                if (!cancelled) setError(vendorApiMessage(loadError, 'Could not load categories.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function updateProduct(index, patch) {
        setProducts((current) => current.map((row, rowIndex) => (
            rowIndex === index ? { ...row, ...patch } : row
        )));
    }

    async function onSubmit(event) {
        event.preventDefault();
        const missingEmail = !email.trim() ? 'Email is required.' : emailProblem(email);
        const missingPhone = !phone.trim() ? 'Phone number is required.' : phoneProblem(phone);
        if (!name.trim() || missingEmail || missingPhone) {
            setShowRequired(true);
            setError(!name.trim() ? 'Name is required.' : (missingEmail || missingPhone));
            return;
        }
        const entries = products.map((row, index) => ({
            email: index === 0 ? email.trim() : '',
            phone: index === 0 ? phone.trim() : '',
            categoryId: row.categoryId,
            brandId: row.brandId,
        }));
        setSaving(true);
        setError('');
        const payload = { name: name.trim(), designation: designation.trim(), entries };
        try {
            if (contact?.id) await updateVendorContact(vendorId, contact.id, payload);
            else await createVendorContact(vendorId, payload);
            onSaved();
        } catch (saveError) {
            setError(vendorApiMessage(saveError, 'Could not save this contact.'));
            setSaving(false);
        }
    }

    return (
        <CatalogModal title={contact ? 'Edit Contact' : 'Add Contact'} onClose={onClose} wide>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
                <div className="max-h-[min(40rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className={labelClass}>Name</span>
                            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
                        </label>
                        <label className="block">
                            <span className={labelClass}>Designation</span>
                            <input className={fieldClass} value={designation} onChange={(event) => setDesignation(event.target.value)} />
                        </label>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#E6EDF5] p-3">
                        <p className="mb-3 text-sm font-medium text-slate-700">Contact details</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className={labelClass}>Email <span className="text-red-500">*</span></span>
                                <input
                                    className={`${fieldClass} ${emailError ? 'border-red-400' : ''}`}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                />
                                {emailError ? <p className="mt-1 text-xs text-red-600">{emailError}</p> : null}
                            </label>
                            <div className="min-w-0">
                                <span className={labelClass}>Phone <span className="text-red-500">*</span></span>
                                <PhoneInputField
                                    label=""
                                    defaultCountry="AE"
                                    value={phone}
                                    required={false}
                                    showValidatedBadge={false}
                                    placeholder="Phone number"
                                    onChange={(value) => setPhone(value || '')}
                                />
                                {phoneError ? <p className="mt-1 text-xs text-red-600">{phoneError}</p> : null}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-700">Product handling</p>
                        <div className="mt-3 space-y-3">
                            {products.map((row, index) => (
                                <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                    <label className="block">
                                        <span className={labelClass}>Category</span>
                                        <select className={fieldClass} value={row.categoryId} disabled={loading} onChange={(event) => updateProduct(index, { categoryId: event.target.value })}>
                                            <option value="">Select a category</option>
                                            {categories.map((category) => (
                                                <option key={category._id} value={category._id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Brand</span>
                                        <select className={fieldClass} value={row.brandId} disabled={loading} onChange={(event) => updateProduct(index, { brandId: event.target.value })}>
                                            <option value="">Select a brand</option>
                                            {brands.map((brand) => (
                                                <option key={brand._id} value={brand._id}>{brand.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    {products.length > 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => setProducts((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                            aria-label="Remove product handling"
                                        >
                                            <X size={14} />
                                        </button>
                                    ) : <span className="hidden sm:block" />}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setProducts((current) => [...current, { ...EMPTY_PRODUCT }])}
                            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 text-sm font-medium text-slate-700"
                        >
                            <Plus size={14} />
                            Add more
                        </button>
                    </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E6EDF5] px-5 py-4">
                    <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'OK'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}
