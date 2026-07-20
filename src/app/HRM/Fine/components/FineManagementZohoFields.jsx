'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';
import { mapZohoVendors } from '@/utils/zohoVendors';

function SelectField({ label, required, value, onChange, options, placeholder, disabled }) {
    return (
        <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-gray-700">
                {label}
                {required ? <span className="text-red-500"> *</span> : null}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

/**
 * Zoho vendor + expense account required at management approval (creates vendor bill).
 */
export default function FineManagementZohoFields({
    organizationId = '',
    value,
    onChange,
    disabled = false,
}) {
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const orgParams = organizationId ? { organizationId } : {};
                const [vendorRes, supportRes] = await Promise.all([
                    axiosInstance.get('/zoho/vendors', {
                        params: { ...orgParams, sync: 'true', limit: 500 },
                        skipToast: true,
                        timeout: 45000,
                    }),
                    axiosInstance.get('/zoho/bills/support', {
                        params: orgParams,
                        skipToast: true,
                        timeout: 45000,
                    }),
                ]);
                if (cancelled) return;
                setVendors(mapZohoVendors(vendorRes.data?.data));
                setAccounts(mapZohoPaymentAccounts(supportRes?.data?.data?.accounts));
            } catch {
                if (!cancelled) {
                    setVendors([]);
                    setAccounts([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [organizationId]);

    const vendorOptions = useMemo(
        () =>
            vendors.map((v) => ({
                id: v.id,
                label: v.name || v.companyName || v.id,
            })),
        [vendors],
    );

    const accountOptions = useMemo(
        () =>
            accounts.map((a) => ({
                id: a.id,
                label: a.label || a.name || a.id,
            })),
        [accounts],
    );

    const patch = (partial) => {
        onChange?.({ ...value, ...partial });
    };

    const onVendorChange = (vendorId) => {
        const match = vendors.find((v) => v.id === vendorId);
        patch({
            zohoVendorId: vendorId,
            zohoVendorName: match?.name || match?.companyName || '',
        });
    };

    const onAccountChange = (expenseAccountId) => {
        const match = accounts.find((a) => a.id === expenseAccountId);
        patch({
            expenseAccountId,
            expenseAccountName: match?.name || match?.label || '',
        });
    };

    return (
        <div className="mt-4 space-y-3 rounded-lg border border-green-100 bg-green-50/50 p-3">
            <p className="text-xs font-semibold text-green-800">
                Zoho vendor bill (saved to vendor&apos;s bills in Books)
            </p>
            {loading ? (
                <p className="text-xs text-gray-500">Loading vendors and Chart of Accounts…</p>
            ) : null}
            <SelectField
                label="Vendor"
                required
                value={value?.zohoVendorId || ''}
                onChange={onVendorChange}
                options={vendorOptions}
                placeholder="Select Zoho vendor"
                disabled={disabled || loading}
            />
            <SelectField
                label="Expense account (Chart of Accounts)"
                required
                value={value?.expenseAccountId || ''}
                onChange={onAccountChange}
                options={accountOptions}
                placeholder="Select expense account"
                disabled={disabled || loading}
            />
        </div>
    );
}
