'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import CatalogModal, { fieldClass, labelClass } from '../item-master/CatalogModal';
import { emailProblem, normalizePhone, phoneProblem } from './vendorFieldValidation';
import {
    createVendor,
    listZohoVendorOptions,
    nextVendorCode,
    previewZohoVendor,
    updateVendor,
    vendorApiMessage,
} from './vendorManagementApi';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), { ssr: false });

function formFromVendor(source, code) {
    const brands = Array.isArray(source?.brands) ? source.brands.filter(Boolean).join(', ') : '';
    const products = source?.products == null || source?.products === '' ? '' : String(source.products);
    return {
        code: code || source?.code || source?.vendorCode || '',
        name: source?.name || '',
        location: source?.location || '',
        contact: source?.contact || '',
        email: source?.email || '',
        phone: normalizePhone(source?.phone),
        paymentTerms: source?.paymentTerms || '',
        brands,
        products,
        status: source?.status === 'Inactive' ? 'Inactive' : 'Active',
    };
}

function TextField({ label, value, onChange, type = 'text' }) {
    return (
        <label className="block min-w-0">
            <span className={labelClass}>{label}</span>
            <input
                className={fieldClass}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
}

export default function AddVendorModal({ onClose, onSaved, vendor = null }) {
    const editing = Boolean(vendor?.id);
    const savedZohoId = String(vendor?.zohoContactId || '');
    const [options, setOptions] = useState([]);
    const [linkedIds, setLinkedIds] = useState([]);
    const [zohoContactId, setZohoContactId] = useState(savedZohoId);
    const [form, setForm] = useState(() => formFromVendor(vendor, vendor?.code || ''));
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState(() => emailProblem(vendor?.email));

    const setField = (key) => (value) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    useEffect(() => {
        let cancelled = false;
        setLoadingOptions(true);
        Promise.all([listZohoVendorOptions(), nextVendorCode()])
            .then(([vendors, code]) => {
                if (cancelled) return;
                setOptions(Array.isArray(vendors) ? vendors : []);
                setLinkedIds(Array.isArray(code?.linkedZohoIds) ? code.linkedZohoIds.map(String) : []);
                if (!editing && code?.vendorCode) {
                    setForm((current) => ({ ...current, code: current.code || code.vendorCode }));
                }
            })
            .catch((loadError) => {
                if (!cancelled) setError(vendorApiMessage(loadError, 'Could not load Zoho vendors.'));
            })
            .finally(() => {
                if (!cancelled) setLoadingOptions(false);
            });
        return () => {
            cancelled = true;
        };
    }, [editing]);

    useEffect(() => {
        if (!zohoContactId || (editing && zohoContactId === savedZohoId)) {
            setLoadingPreview(false);
            return undefined;
        }
        let cancelled = false;
        setLoadingPreview(true);
        setError('');
        previewZohoVendor(zohoContactId)
            .then((data) => {
                if (cancelled) return;
                setEmailError(emailProblem(data?.email));
                setForm((current) => formFromVendor(data, current.code || data?.code || data?.vendorCode || ''));
            })
            .catch((loadError) => {
                if (!cancelled) setError(vendorApiMessage(loadError, 'Could not read this Zoho vendor.'));
            })
            .finally(() => {
                if (!cancelled) setLoadingPreview(false);
            });
        return () => {
            cancelled = true;
        };
    }, [editing, savedZohoId, zohoContactId]);

    const choices = useMemo(() => {
        const taken = new Set(linkedIds);
        if (savedZohoId) taken.delete(savedZohoId);
        const rows = options
            .map((option) => {
                const id = String(option.contact_id || option.vendor_id || '').trim();
                const name = String(option.company_name || option.contact_name || option.vendor_name || '').trim();
                if (!id || !name || taken.has(id)) return null;
                return { id, name };
            })
            .filter(Boolean);
        if (savedZohoId && !rows.some((row) => row.id === savedZohoId)) {
            rows.push({ id: savedZohoId, name: vendor?.name || 'Current vendor' });
        }
        return rows.sort((left, right) => left.name.localeCompare(right.name));
    }, [linkedIds, options, savedZohoId, vendor?.name]);

    async function onSubmit(event) {
        event.preventDefault();
        if (!zohoContactId) {
            setError('Select a vendor.');
            return;
        }
        if (!form.code.trim()) {
            setError('Vendor code is required.');
            return;
        }
        if (!form.name.trim()) {
            setError('Vendor name is required.');
            return;
        }
        if (form.products.trim() !== '' && (!Number.isInteger(Number(form.products)) || Number(form.products) < 0)) {
            setError('Products must be a whole number of zero or more.');
            return;
        }
        const emailIssue = emailProblem(form.email);
        const phoneIssue = phoneProblem(form.phone);
        setEmailError(emailIssue);
        if (emailIssue || phoneIssue) {
            setError(emailIssue || phoneIssue);
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            zohoContactId,
            vendorCode: form.code.trim(),
            name: form.name.trim(),
            location: form.location.trim(),
            primaryContact: form.contact.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            paymentTerms: form.paymentTerms.trim(),
            brands: form.brands,
            products: form.products.trim(),
            status: form.status,
        };
        try {
            const saved = editing ? await updateVendor(vendor.id, payload) : await createVendor(payload);
            onSaved(saved);
        } catch (saveError) {
            setError(vendorApiMessage(saveError, 'Could not save this vendor.'));
            setSaving(false);
        }
    }

    return (
        <CatalogModal title={editing ? 'Edit Vendor' : 'Add Vendor'} onClose={onClose}>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
                <div className="max-h-[min(36rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    <label className="block">
                        <span className={labelClass}>Select vendor</span>
                        <select
                            className={fieldClass}
                            value={zohoContactId}
                            disabled={loadingOptions || saving}
                            onChange={(event) => setZohoContactId(event.target.value)}
                        >
                            <option value="">{loadingOptions ? 'Loading Zoho vendors...' : 'Select a Zoho vendor'}</option>
                            {choices.map((option) => (
                                <option key={option.id} value={option.id}>{option.name}</option>
                            ))}
                        </select>
                    </label>
                    {!loadingOptions && choices.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No Zoho vendors are available to add.</p>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <TextField label="Vendor code" value={form.code} onChange={setField('code')} />
                        <TextField label="Vendor name" value={form.name} onChange={setField('name')} />
                        <TextField label="Location" value={form.location} onChange={setField('location')} />
                        <TextField label="Primary contact" value={form.contact} onChange={setField('contact')} />
                        <label className="block min-w-0">
                            <span className={labelClass}>Email</span>
                            <input
                                className={`${fieldClass} ${emailError ? 'border-red-400' : ''}`}
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                value={form.email}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setField('email')(value);
                                    setEmailError(emailProblem(value));
                                }}
                            />
                            {emailError ? <p className="mt-1 text-xs text-red-600">{emailError}</p> : null}
                        </label>
                        <div className="min-w-0">
                            <span className={labelClass}>Phone</span>
                            <PhoneInputField
                                label=""
                                defaultCountry="AE"
                                value={form.phone}
                                required={false}
                                showValidatedBadge={false}
                                placeholder="Phone number"
                                onChange={(value) => setField('phone')(value || '')}
                            />
                        </div>
                        <TextField label="Payment terms" value={form.paymentTerms} onChange={setField('paymentTerms')} />
                        <TextField label="Brands" value={form.brands} onChange={setField('brands')} />
                        <TextField label="Products" value={form.products} onChange={setField('products')} type="number" />
                        <label className="block min-w-0">
                            <span className={labelClass}>Status</span>
                            <select className={fieldClass} value={form.status} onChange={(event) => setField('status')(event.target.value)}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </label>
                    </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E6EDF5] px-5 py-4">
                    <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || loadingOptions || loadingPreview || !zohoContactId}
                        className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}
