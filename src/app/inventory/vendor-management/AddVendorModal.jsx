'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, Search } from 'lucide-react';
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
    return {
        code: code || source?.code || source?.vendorCode || '',
        name: source?.name || '',
        location: source?.location || '',
        contact: source?.contact || '',
        email: source?.email || '',
        phone: normalizePhone(source?.phone),
        paymentTerms: source?.paymentTerms || '',
        status: source?.status === 'Inactive' ? 'Inactive' : 'Active',
    };
}

function VendorPicker({ choices, value, disabled, loading, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);
    const selected = choices.find((option) => option.id === value) || null;
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return choices;
        return choices.filter((option) => option.name.toLowerCase().includes(needle));
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
                    {loading ? 'Loading Zoho vendors...' : selected?.name || 'Select a Zoho vendor'}
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
                                placeholder="Search vendor"
                                aria-label="Search vendor"
                                className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500"
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        close();
                                        return;
                                    }
                                    if (event.key === 'Enter' && filtered.length === 1) {
                                        event.preventDefault();
                                        choose(filtered[0]);
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <ul role="listbox" aria-label="Zoho vendors" className="max-h-60 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-slate-500">No vendors match that search.</li>
                        ) : filtered.map((option) => (
                            <li key={option.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={option.id === value}
                                    onClick={() => choose(option)}
                                    className={`block w-full truncate px-3 py-2 text-left text-sm ${option.id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800 hover:bg-slate-50'}`}
                                >
                                    {option.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

function TextField({ label, value, onChange, type = 'text', readOnly = false, placeholder = '' }) {
    return (
        <label className="block min-w-0">
            <span className={labelClass}>{label}</span>
            <input
                className={`${fieldClass}${readOnly ? ' read-only:cursor-default read-only:bg-slate-50 read-only:text-slate-700 read-only:focus:border-[#E2E8F0]' : ''}`}
                type={type}
                value={value}
                placeholder={placeholder}
                readOnly={readOnly}
                aria-readonly={readOnly || undefined}
                onChange={readOnly ? undefined : (event) => onChange(event.target.value)}
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
    const editedRef = useRef(new Set());
    const formRef = useRef(form);

    function writeForm(updater) {
        setForm((current) => {
            const next = typeof updater === 'function' ? updater(current) : updater;
            formRef.current = next;
            return next;
        });
    }

    const setField = (key) => (value) => {
        editedRef.current.add(key);
        writeForm((current) => ({ ...current, [key]: value }));
    };

    function selectVendor(id) {
        editedRef.current = new Set();
        setZohoContactId(id);
    }

    useEffect(() => {
        let cancelled = false;
        setLoadingOptions(true);
        Promise.all([listZohoVendorOptions(), nextVendorCode()])
            .then(([vendors, code]) => {
                if (cancelled) return;
                setOptions(Array.isArray(vendors) ? vendors : []);
                setLinkedIds(Array.isArray(code?.linkedZohoIds) ? code.linkedZohoIds.map(String) : []);
                if (!editing && code?.vendorCode) {
                    writeForm((current) => ({ ...current, code: code.vendorCode }));
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
                if (!editedRef.current.has('email')) setEmailError(emailProblem(data?.email));
                writeForm((current) => {
                    const incoming = formFromVendor(
                        data,
                        editing ? (current.code || data?.code || data?.vendorCode || '') : current.code,
                    );
                    const next = { ...incoming, code: current.code || incoming.code };
                    editedRef.current.forEach((key) => {
                        next[key] = current[key];
                    });
                    return next;
                });
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
        const current = formRef.current;
        if (!zohoContactId) {
            setError('Select a vendor.');
            return;
        }
        if (!current.code.trim()) {
            setError('Vendor code is required.');
            return;
        }
        if (!current.name.trim()) {
            setError('Vendor name is required.');
            return;
        }
        const emailIssue = emailProblem(current.email);
        const phoneIssue = phoneProblem(current.phone);
        setEmailError(emailIssue);
        if (emailIssue || phoneIssue) {
            setError(emailIssue || phoneIssue);
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            zohoContactId,
            vendorCode: current.code.trim(),
            name: current.name.trim(),
            location: current.location.trim(),
            primaryContact: current.contact.trim(),
            email: current.email.trim(),
            phone: current.phone.trim(),
            paymentTerms: current.paymentTerms.trim(),
            status: current.status,
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
                    <div className="block">
                        <span className={labelClass}>Select vendor</span>
                        <VendorPicker
                            choices={choices}
                            value={zohoContactId}
                            disabled={loadingOptions || saving}
                            loading={loadingOptions}
                            onChange={selectVendor}
                        />
                    </div>
                    {!loadingOptions && choices.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No Zoho vendors are available to add.</p>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <TextField
                            label="Vendor code"
                            value={form.code}
                            readOnly
                            placeholder={editing ? '' : 'Assigning...'}
                        />
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
