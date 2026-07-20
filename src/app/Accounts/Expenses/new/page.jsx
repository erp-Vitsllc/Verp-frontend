'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import { Loader2, Upload } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoVendors } from '@/utils/zohoVendors';
import {
    formatZohoPaymentMoney,
    mapZohoLocations,
    mapZohoPaymentAccounts,
} from '@/utils/zohoVendorPayments';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: '0.5rem',
        borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
        '&:hover': { borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1' },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 100000 }),
    indicatorSeparator: () => ({ display: 'none' }),
};

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function RequiredLabel({ children }) {
    return (
        <span className="text-xs font-bold text-red-600">
            {children} <span className="text-blue-600">*</span>
        </span>
    );
}

function FieldLabel({ children }) {
    return <span className="text-xs font-semibold text-slate-600">{children}</span>;
}

export default function NewExpensePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [form, setForm] = useState({
        date: todayKey(),
        accountId: '',
        vendorId: '',
        amount: '',
        referenceNumber: '',
        locationId: '',
        locationName: '',
        notes: '',
        currencyCode: 'AED',
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [vendorRes, supportRes] = await Promise.all([
                    axiosInstance.get('/zoho/vendors', {
                        skipToast: true,
                        timeout: 120000,
                        params: { sync: 'false' },
                    }),
                    axiosInstance.get('/zoho/bills/support', {
                        skipToast: true,
                        timeout: 120000,
                    }),
                ]);
                if (cancelled) return;
                const mappedLocations = mapZohoLocations(supportRes?.data?.data?.locations);
                const primary = mappedLocations.find((l) => l.isPrimary) || mappedLocations[0];
                setVendors(mapZohoVendors(vendorRes?.data?.data));
                setAccounts(mapZohoPaymentAccounts(supportRes?.data?.data?.accounts));
                setLocations(mappedLocations);
                setForm((prev) => ({
                    ...prev,
                    locationId: primary?.id || '',
                    locationName: primary?.name || '',
                }));
            } catch (err) {
                if (!cancelled) {
                    setError(err?.response?.data?.message || err?.message || 'Failed to load form data');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const setField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const vendorOptions = useMemo(
        () => vendors.map((v) => ({ value: v.id, label: v.label })),
        [vendors],
    );
    const accountOptions = useMemo(
        () =>
            accounts.map((a) => ({
                value: a.id,
                label: a.type ? `${a.name} (${a.type})` : a.name,
            })),
        [accounts],
    );
    const locationOptions = useMemo(
        () => locations.map((l) => ({ value: l.id, label: l.name })),
        [locations],
    );

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!form.accountId) {
            setError('Select an expense account.');
            return;
        }
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setError('Enter an amount greater than zero.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            await axiosInstance.post('/zoho/expenses', {
                date: form.date,
                account_id: form.accountId,
                vendor_id: form.vendorId || undefined,
                amount,
                reference_number: form.referenceNumber,
                description: form.notes,
                location_id: form.locationId || undefined,
            });
            toast({ title: 'Expense created', description: 'The expense was created in Zoho Books.' });
            router.push('/Accounts/Expenses');
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to create expense');
        } finally {
            setSaving(false);
        }
    };

    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden overflow-y-auto">
                        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900">New Expense</h2>
                                <p className="text-xs sm:text-sm text-slate-500">
                                    Create an expense in Zoho Books.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="space-y-5 px-4 sm:px-6 py-5">
                                    {error ? (
                                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            {error}
                                        </div>
                                    ) : null}

                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                                            <Loader2 size={18} className="animate-spin" />
                                            Loading Zoho data...
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,520px)_1fr] gap-5">
                                                <div className="space-y-3">
                                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                                        <RequiredLabel>Date</RequiredLabel>
                                                        <input
                                                            type="date"
                                                            value={form.date}
                                                            onChange={(e) => setField('date', e.target.value)}
                                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                            required
                                                        />
                                                    </label>
                                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                                        <RequiredLabel>Expense Account</RequiredLabel>
                                                        <Select
                                                            instanceId="zoho-expense-account"
                                                            styles={selectStyles}
                                                            options={accountOptions}
                                                            value={accountOptions.find((o) => o.value === form.accountId) || null}
                                                            onChange={(o) => setField('accountId', o?.value || '')}
                                                            placeholder="Select an account"
                                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                        />
                                                    </label>
                                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                                        <RequiredLabel>Amount</RequiredLabel>
                                                        <div className="flex h-10 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
                                                            <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                                                                {form.currencyCode}
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min="0.01"
                                                                step="0.01"
                                                                value={form.amount}
                                                                onChange={(e) => setField('amount', e.target.value)}
                                                                className="min-w-0 flex-1 rounded-r-lg px-3 text-sm outline-none"
                                                                required
                                                            />
                                                        </div>
                                                    </label>
                                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                                        <FieldLabel>Vendor</FieldLabel>
                                                        <Select
                                                            instanceId="zoho-expense-vendor"
                                                            styles={selectStyles}
                                                            options={vendorOptions}
                                                            value={vendorOptions.find((o) => o.value === form.vendorId) || null}
                                                            onChange={(o) => setField('vendorId', o?.value || '')}
                                                            isClearable
                                                            placeholder="Select a Vendor"
                                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                        />
                                                    </label>
                                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                                        <FieldLabel>Location</FieldLabel>
                                                        <Select
                                                            instanceId="zoho-expense-location"
                                                            styles={selectStyles}
                                                            options={locationOptions}
                                                            value={locationOptions.find((o) => o.value === form.locationId) || null}
                                                            onChange={(o) =>
                                                                setForm((prev) => ({
                                                                    ...prev,
                                                                    locationId: o?.value || '',
                                                                    locationName: o?.label || '',
                                                                }))
                                                            }
                                                            isClearable
                                                            placeholder="Select location"
                                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                        />
                                                    </label>
                                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                                        <FieldLabel>Reference#</FieldLabel>
                                                        <input
                                                            type="text"
                                                            value={form.referenceNumber}
                                                            onChange={(e) => setField('referenceNumber', e.target.value)}
                                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                        />
                                                    </label>
                                                </div>
                                                <div className="hidden lg:flex justify-end">
                                                    <div className="h-fit rounded-2xl bg-orange-50 px-4 py-3 text-xs text-slate-700">
                                                        <div className="flex justify-between gap-8 py-1">
                                                            <span>Total</span>
                                                            <span className="font-bold tabular-nums">
                                                                {formatZohoPaymentMoney(Number(form.amount) || 0, form.currencyCode)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <label className="block space-y-1.5">
                                                <span className="text-xs font-semibold text-slate-600">Notes</span>
                                                <textarea
                                                    value={form.notes}
                                                    onChange={(e) => setField('notes', e.target.value)}
                                                    rows={3}
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                />
                                            </label>

                                            <div className="space-y-1.5">
                                                <span className="text-xs font-semibold text-slate-600">Attachments</span>
                                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                                    <Upload size={14} />
                                                    Upload File
                                                    <input type="file" className="hidden" />
                                                </label>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-4">
                                    <button
                                        type="submit"
                                        disabled={loading || saving}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push('/Accounts/Expenses')}
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
