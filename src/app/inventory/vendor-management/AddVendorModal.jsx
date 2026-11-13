'use client';

import { useEffect, useMemo, useState } from 'react';
import CatalogModal, { fieldClass, labelClass } from '../item-master/CatalogModal';
import {
    createVendor,
    listZohoVendorOptions,
    nextVendorCode,
    previewZohoVendor,
    vendorApiMessage,
} from './vendorManagementApi';

function shown(value, ready) {
    if (!ready) return '';
    if (value == null || value === '') return 'N/A';
    return String(value);
}

function ReadField({ label, value, ready }) {
    return (
        <label className="block min-w-0">
            <span className={labelClass}>{label}</span>
            <input className={`${fieldClass} bg-slate-50`} value={shown(value, ready)} readOnly />
        </label>
    );
}

export default function AddVendorModal({ onClose, onSaved }) {
    const [options, setOptions] = useState([]);
    const [linkedIds, setLinkedIds] = useState([]);
    const [vendorCode, setVendorCode] = useState('');
    const [zohoContactId, setZohoContactId] = useState('');
    const [preview, setPreview] = useState(null);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoadingOptions(true);
        Promise.all([listZohoVendorOptions(), nextVendorCode()])
            .then(([vendors, code]) => {
                if (cancelled) return;
                setOptions(Array.isArray(vendors) ? vendors : []);
                setLinkedIds(Array.isArray(code?.linkedZohoIds) ? code.linkedZohoIds.map(String) : []);
                setVendorCode(code?.vendorCode || '');
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
    }, []);

    useEffect(() => {
        if (!zohoContactId) {
            setPreview(null);
            return undefined;
        }
        let cancelled = false;
        setLoadingPreview(true);
        setError('');
        previewZohoVendor(zohoContactId)
            .then((data) => {
                if (cancelled) return;
                setPreview(data);
                if (data?.code) setVendorCode(data.code);
            })
            .catch((loadError) => {
                if (cancelled) return;
                setPreview(null);
                setError(vendorApiMessage(loadError, 'Could not read this Zoho vendor.'));
            })
            .finally(() => {
                if (!cancelled) setLoadingPreview(false);
            });
        return () => {
            cancelled = true;
        };
    }, [zohoContactId]);

    const choices = useMemo(() => {
        const taken = new Set(linkedIds);
        return options
            .map((vendor) => {
                const id = String(vendor.contact_id || vendor.vendor_id || '').trim();
                const name = String(vendor.company_name || vendor.contact_name || vendor.vendor_name || '').trim();
                if (!id || !name || taken.has(id)) return null;
                return { id, name };
            })
            .filter(Boolean)
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [linkedIds, options]);

    async function onSubmit(event) {
        event.preventDefault();
        if (!zohoContactId) {
            setError('Select a vendor.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const saved = await createVendor(zohoContactId);
            onSaved(saved);
        } catch (saveError) {
            setError(vendorApiMessage(saveError, 'Could not save this vendor.'));
            setSaving(false);
        }
    }

    const details = preview || {};
    const filled = Boolean(preview) && !loadingPreview;

    return (
        <CatalogModal title="Add Vendor" onClose={onClose}>
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
                            {choices.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                            ))}
                        </select>
                    </label>
                    {!loadingOptions && choices.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No Zoho vendors are available to add.</p>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <ReadField label="Vendor code" value={vendorCode} ready={Boolean(vendorCode)} />
                        <ReadField label="Vendor name" value={details.name} ready={filled} />
                        <ReadField label="Location" value={details.location} ready={filled} />
                        <ReadField label="Primary contact" value={details.contact} ready={filled} />
                        <ReadField label="Email" value={details.email} ready={filled} />
                        <ReadField label="Phone" value={details.phone} ready={filled} />
                        <ReadField label="Payment terms" value={details.paymentTerms} ready={filled} />
                        <ReadField label="Brands" value={details.brands?.length ? details.brands.join(', ') : ''} ready={filled} />
                        <ReadField label="Products" value={details.products == null ? '' : details.products} ready={filled} />
                        <ReadField label="Status" value={details.status} ready={filled} />
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
