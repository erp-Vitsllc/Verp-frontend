'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, Search } from 'lucide-react';
import CatalogModal, { fieldClass, labelClass } from '@/app/inventory/item-master/CatalogModal';
import { emailProblem, normalizePhone, phoneProblem } from '@/app/inventory/vendor-management/vendorFieldValidation';
import {
    createCustomer,
    customerApiMessage,
    isSavedCustomer,
    listZohoCustomerOptions,
    nextCustomerCode,
    normalizeZohoOption,
    previewZohoCustomer,
    updateCustomer,
} from './customerApi';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), { ssr: false });

function compactSearch(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[\u200b\ufeff\u00a0]/g, ' ')
        .replace(/[^a-z0-9]+/g, '');
}

function formFromCustomer(source, code) {
    return {
        code: code || source?.code || source?.customerCode || '',
        name: source?.name || '',
        location: source?.location || '',
        contact: source?.contact || '',
        email: source?.email || '',
        phone: normalizePhone(source?.phone),
        paymentTerms: source?.paymentTerms || '',
        status: source?.status === 'Inactive' ? 'Inactive' : 'Active',
    };
}

function CustomerPicker({ choices, value, disabled, loading, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);
    const selected = choices.find((option) => option.id === value) || null;
    const filtered = useMemo(() => {
        const needle = compactSearch(query);
        if (!needle) return choices;
        return choices.filter((option) => compactSearch(option.search || option.label || option.name).includes(needle));
    }, [choices, query]);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    function close() {
        setOpen(false);
        setQuery('');
    }

    function choose(option) {
        onChange(option.id);
        close();
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className={`${fieldClass} flex items-center justify-between gap-2 text-left`}
            >
                <span className={`min-w-0 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
                    {loading ? 'Loading customers...' : selected?.label || selected?.name || 'Select a customer'}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
                    <div className="border-b border-[#E6EDF5] p-2">
                        <label className="relative block">
                            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search customer"
                                aria-label="Search customer"
                                className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500"
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        close();
                                        return;
                                    }
                                    if (event.key === 'Enter' && filtered.length === 1 && !filtered[0].added) {
                                        event.preventDefault();
                                        choose(filtered[0]);
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <ul role="listbox" aria-label="Customers" className="max-h-60 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-slate-500">No customers match that search.</li>
                        ) : filtered.map((option) => (
                            <li key={option.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={option.id === value}
                                    disabled={option.added}
                                    onClick={() => {
                                        if (!option.added) choose(option);
                                    }}
                                    className={`block w-full truncate px-3 py-2 text-left text-sm ${option.added ? 'cursor-default text-slate-400' : option.id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800 hover:bg-slate-50'}`}
                                >
                                    {option.label || option.name}
                                    {option.added ? ' · Already added' : ''}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
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

export default function AddCustomerModal({ onClose, onSaved, customer = null, stacked = false }) {
    const editing = isSavedCustomer(customer);
    const savedZohoId = String(customer?.zohoContactId || '');
    const [options, setOptions] = useState([]);
    const [linkedIds, setLinkedIds] = useState([]);
    const [zohoContactId, setZohoContactId] = useState(savedZohoId);
    const [form, setForm] = useState(() => formFromCustomer(customer, customer?.code || ''));
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState(() => emailProblem(customer?.email));

    const setField = (key) => (value) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    useEffect(() => {
        let cancelled = false;
        setLoadingOptions(true);
        Promise.allSettled([listZohoCustomerOptions(), nextCustomerCode()])
            .then(([customersResult, codeResult]) => {
                if (cancelled) return;
                if (customersResult.status === 'fulfilled') {
                    setOptions((Array.isArray(customersResult.value) ? customersResult.value : []).map(normalizeZohoOption).filter(Boolean));
                } else {
                    setError(customerApiMessage(customersResult.reason, 'Could not load customers.'));
                }
                if (codeResult.status === 'fulfilled') {
                    const code = codeResult.value;
                    setLinkedIds(Array.isArray(code?.linkedZohoIds) ? code.linkedZohoIds.map(String) : []);
                    if (!editing && code?.customerCode) {
                        setForm((current) => ({ ...current, code: current.code || code.customerCode }));
                    }
                }
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
        previewZohoCustomer(zohoContactId)
            .then((data) => {
                if (cancelled) return;
                setEmailError(emailProblem(data?.email));
                setForm((current) => formFromCustomer(data, current.code || data?.code || data?.customerCode || ''));
            })
            .catch((loadError) => {
                if (cancelled) return;
                const status = loadError?.response?.status ?? loadError?.originalError?.response?.status;
                if (status === 404) return;
                setError(customerApiMessage(loadError, 'Could not read this customer.'));
            })
            .finally(() => {
                if (!cancelled) setLoadingPreview(false);
            });
        return () => {
            cancelled = true;
        };
    }, [editing, savedZohoId, zohoContactId]);

    function applyZoho(id) {
        setZohoContactId(id);
        const option = options.find((row) => row.id === id);
        if (!option) return;
        setEmailError(emailProblem(option.email));
        setForm((current) => ({
            ...formFromCustomer(option, current.code),
            code: current.code,
        }));
    }

    const choices = useMemo(() => {
        const taken = new Set(linkedIds);
        if (savedZohoId) taken.delete(savedZohoId);
        const rows = options
            .filter((option) => option.id && option.name)
            .map((option) => ({
                id: option.id,
                name: option.name,
                label: option.label || option.name,
                search: option.search || option.label || option.name,
                added: taken.has(option.id),
            }));
        if (savedZohoId && !rows.some((row) => row.id === savedZohoId)) {
            const currentName = customer?.name || 'Current customer';
            rows.push({ id: savedZohoId, name: currentName, label: currentName, search: currentName, added: false });
        }
        return rows.sort((left, right) => (left.label || left.name).localeCompare(right.label || right.name));
    }, [customer?.name, linkedIds, options, savedZohoId]);

    async function onSubmit(event) {
        event.preventDefault();
        if (!zohoContactId) {
            setError('Select a customer.');
            return;
        }
        if (!form.code.trim()) {
            setError('Customer code is required.');
            return;
        }
        if (!form.name.trim()) {
            setError('Customer name is required.');
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
            customerCode: form.code.trim(),
            name: form.name.trim(),
            location: form.location.trim(),
            primaryContact: form.contact.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            paymentTerms: form.paymentTerms.trim(),
            status: form.status,
        };
        try {
            const saved = editing ? await updateCustomer(customer.id, payload) : await createCustomer(payload);
            onSaved(saved);
        } catch (saveError) {
            setError(customerApiMessage(saveError, 'Could not save this customer.'));
            setSaving(false);
        }
    }

    return (
        <CatalogModal title={customer?.id ? 'Edit Customer' : 'Add Customer'} onClose={onClose} wide stacked={stacked}>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
                <div className="max-h-[min(36rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    <div className="block">
                        <span className={labelClass}>Select customer</span>
                        <CustomerPicker
                            choices={choices}
                            value={zohoContactId}
                            disabled={loadingOptions || saving}
                            loading={loadingOptions}
                            onChange={applyZoho}
                        />
                    </div>
                    {!loadingOptions && choices.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No customers yet. Refresh Customers under Accounts, then open this again.</p>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <TextField label="Customer code" value={form.code} onChange={setField('code')} />
                        <TextField label="Customer name" value={form.name} onChange={setField('name')} />
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
