'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import { Loader2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import { mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';
import { mapZohoVendors } from '@/utils/zohoVendors';

const searchableSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 44,
        borderRadius: '0.75rem',
        borderColor: state.isFocused ? '#14b8a6' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(20, 184, 166, 0.2)' : 'none',
        backgroundColor: state.isDisabled ? '#f8fafc' : 'rgba(249, 250, 251, 0.5)',
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        '&:hover': {
            borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
        },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 100000 }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#0d9488' : state.isFocused ? '#f0fdfa' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: 'pointer',
    }),
};

function parseFineMonthStart(startMonth) {
    if (!startMonth) return null;
    const raw = String(startMonth).trim();
    if (!raw) return null;

    if (raw.includes('-')) {
        const parts = raw.split('-');
        if (parts[0].length === 4) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        }
        return new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1, 1);
    }
    if (raw.includes('/')) {
        const parts = raw.split('/');
        if (parts[0].length === 4) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        }
        return new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1, 1);
    }

    const monthNames = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
    ];
    const normalized = raw.toLowerCase();
    const monthIndex = monthNames.findIndex((m) => m.startsWith(normalized));
    if (monthIndex !== -1) {
        const d = new Date();
        d.setMonth(monthIndex);
        d.setDate(1);
        return d;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setDate(1);
    return parsed;
}

function buildVendorPaymentSchedule(fine, totalAmount) {
    const duration = Math.max(1, Number(fine?.payableDuration) || 1);
    const startDate = parseFineMonthStart(fine?.monthStart);
    if (!startDate || !(totalAmount > 0)) return [];

    const monthlyAmount = totalAmount / duration;
    const boxes = [];
    for (let i = 0; i < duration; i += 1) {
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + i);
        boxes.push({
            month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            monthlyAmount,
            paidAmount: 0,
            isPaid: false,
            isPartial: false,
            isNotPaid: true,
            remaining: monthlyAmount,
        });
    }
    return boxes;
}

/**
 * Payment to vendors for an employee fine.
 * Fields: Vendor + Paid Through → posts straight to Zoho Payments Made (list).
 */
export default function FineVendorPayModal({
    isOpen,
    onClose,
    fine = null,
    returnTo = '',
    onSuccess,
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loadingSupport, setLoadingSupport] = useState(false);
    const [saving, setSaving] = useState(false);
    const [vendorId, setVendorId] = useState('');
    const [paidThroughAccountId, setPaidThroughAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);

    const preferredOrgId = String(fine?.zohoOrganizationId || '').trim();
    const preferredCompanyId = String(fine?.company?._id || fine?.company || '').trim();

    const {
        options: zohoOrgOptions,
        organizationId,
        setOrganizationId,
        active: activeZohoOrg,
        showPicker: showZohoOrgPicker,
        loading: zohoOrgLoading,
    } = useZohoOrganizations({
        enabled: isOpen,
        preferredOrganizationId: preferredOrgId,
        preferredCompanyId,
    });

    const hasZohoBill = Boolean(String(fine?.zohoBillId || '').trim());

    const fineTotalAmount = useMemo(() => {
        const n = Number(fine?.fineAmount ?? fine?.totalFineAmount ?? fine?.balance ?? 0);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }, [fine]);

    const remainingAmount = useMemo(() => {
        if (fine?.balance != null && Number.isFinite(Number(fine.balance))) {
            return Math.max(0, Number(fine.balance));
        }
        return fineTotalAmount;
    }, [fine, fineTotalAmount]);

    const monthBoxes = useMemo(
        () => buildVendorPaymentSchedule(fine, remainingAmount > 0 ? remainingAmount : fineTotalAmount),
        [fine, remainingAmount, fineTotalAmount],
    );

    const vendorOptions = useMemo(
        () =>
            vendors.map((v) => ({
                value: v.id,
                label: v.label || v.name || v.id,
            })),
        [vendors],
    );

    const accountOptions = useMemo(
        () =>
            accounts.map((a) => ({
                value: a.id,
                label: a.label || a.name || a.id,
                name: a.name || a.label || '',
            })),
        [accounts],
    );

    const selectedVendorOption = vendorOptions.find((o) => o.value === vendorId) || null;
    const selectedAccountOption =
        accountOptions.find((o) => o.value === paidThroughAccountId) || null;

    useEffect(() => {
        if (!isOpen || !fine) return;
        setAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : '');
        setVendorId(String(fine.zohoVendorId || '').trim());
        setPaidThroughAccountId(
            String(fine.paidThroughAccountId || fine.expenseAccountId || '').trim(),
        );
        setSelectedCardIndex(null);
    }, [isOpen, fine, remainingAmount]);

    /** Local DB first; if empty for this org, pull from Zoho (same as Payments Made). */
    const loadVendorsForOrg = useCallback(async () => {
        const orgParams = { organizationId };
        const readLocal = async () => {
            const response = await axiosInstance.get('/zoho/vendors', {
                skipToast: true,
                timeout: 120000,
                params: { ...orgParams, sync: 'false' },
            });
            return mapZohoVendors(response?.data?.data);
        };

        let mapped = await readLocal();
        if (mapped.length) return mapped;

        let zohoPage = 1;
        for (let guard = 0; guard < 40; guard += 1) {
            const response = await axiosInstance.get('/zoho/vendors', {
                skipToast: true,
                timeout: 120000,
                params: {
                    ...orgParams,
                    sync: 'true',
                    zohoPage,
                    chunkLimit: 400,
                },
            });
            const meta = response?.data?.meta || {};
            if (!meta.hasMore) break;
            zohoPage = Number(meta.nextZohoPage) || zohoPage + 1;
        }

        mapped = await readLocal();
        return mapped;
    }, [organizationId]);

    useEffect(() => {
        if (!isOpen || !organizationId) return undefined;
        let cancelled = false;
        setLoadingSupport(true);
        (async () => {
            try {
                const [supportRes, mappedVendors] = await Promise.all([
                    axiosInstance.get('/zoho/vendorpayments/support', {
                        params: {
                            organizationId,
                            accountsOnly: 'true',
                            includeInactive: 'true',
                        },
                        skipToast: true,
                        timeout: 45000,
                    }),
                    loadVendorsForOrg(),
                ]);
                if (cancelled) return;
                const accountRows = supportRes?.data?.data?.accounts || [];
                setAccounts(mapZohoPaymentAccounts(accountRows));
                setVendors(mappedVendors);
                if (!mappedVendors.length) {
                    toast({
                        variant: 'destructive',
                        title: 'No vendors found',
                        description:
                            'Could not load Zoho vendors for this organization. Sync vendors from Accounts → Vendors, or check Zoho connection.',
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setAccounts([]);
                    setVendors([]);
                    toast({
                        variant: 'destructive',
                        title: 'Failed to load vendors',
                        description:
                            err?.response?.data?.message ||
                            err?.message ||
                            'Could not load vendors / Paid Through from Zoho.',
                    });
                }
            } finally {
                if (!cancelled) setLoadingSupport(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, organizationId, loadVendorsForOrg, toast]);

    if (!isOpen || !fine) return null;

    const handleCardClick = (index, box) => {
        if (box.isPaid) return;
        if (selectedCardIndex === index) {
            setSelectedCardIndex(null);
            setAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : '');
            return;
        }
        setSelectedCardIndex(index);
        setAmount(Number(box.remaining || 0).toFixed(2));
    };

    const handlePayToPaymentsMade = async () => {
        if (!vendorId) {
            toast({
                variant: 'destructive',
                title: 'Vendor required',
                description: 'Select a vendor for this payment.',
            });
            return;
        }
        if (!paidThroughAccountId) {
            toast({
                variant: 'destructive',
                title: 'Paid Through required',
                description: 'Select the Paid Through account.',
            });
            return;
        }
        const payAmt = Number(amount);
        if (!Number.isFinite(payAmt) || payAmt <= 0) {
            toast({
                variant: 'destructive',
                title: 'Amount required',
                description: 'Enter a valid fine amount.',
            });
            return;
        }
        if (!organizationId) {
            toast({
                variant: 'destructive',
                title: 'Organization required',
                description: 'Select VEGA or NNIT organization.',
            });
            return;
        }

        const zohoBillId = String(fine?.zohoBillId || '').trim();
        if (!zohoBillId) {
            toast({
                variant: 'destructive',
                title: 'Zoho bill missing',
                description:
                    'This fine has no Zoho vendor bill yet. Sync/open the bill first, then pay.',
            });
            return;
        }

        const paidThrough = accountOptions.find((o) => o.id === paidThroughAccountId);
        const fineId = String(fine?.fineId || fine?._id || '').trim();
        const fineMongoId = String(fine?._id || '').trim();
        const today = new Date().toISOString().slice(0, 10);
        const paymentDate = String(fine?.billDate || '').trim() || today;

        setSaving(true);
        try {
            await axiosInstance.post(
                '/zoho/vendorpayments',
                {
                    vendor_id: vendorId,
                    date: paymentDate,
                    amount: payAmt,
                    paid_through_account_id: paidThroughAccountId,
                    paid_through_account_name:
                        paidThrough?.name || paidThrough?.label || '',
                    payment_mode: 'Cash',
                    reference_number: fineId.slice(0, 100),
                    description: `Fine vendor payment · ${fineId} · ${String(fine?.fineType || '').trim()}`.trim(),
                    bills: [
                        {
                            bill_id: zohoBillId,
                            bill_number: String(
                                fine?.billNumber || fine?.zohoBillNumber || fineId || '',
                            ).trim(),
                            amount_applied: payAmt,
                        },
                    ],
                    vendor_name: String(
                        fine?.zohoVendorName || fine?.fineSource || '',
                    ).trim(),
                    expenses: [],
                    is_draft: false,
                    status: 'paid',
                    organizationId,
                    mode: 'fine_bills',
                    ...(fineMongoId ? { fineMongoIds: [fineMongoId], fineMongoId } : {}),
                },
                {
                    params: { organizationId },
                },
            );

            toast({
                title: 'Payment recorded',
                description: activeZohoOrg?.brand
                    ? `Listed in Zoho Payments Made (${activeZohoOrg.brand}).`
                    : 'Listed in Zoho Payments Made.',
            });
            onSuccess?.();
            onClose?.();
            const listParams = new URLSearchParams();
            if (organizationId) listParams.set('organizationId', organizationId);
            if (returnTo) {
                router.push(returnTo);
            } else {
                router.push(
                    listParams.toString()
                        ? `/Accounts/PaymentsMade?${listParams.toString()}`
                        : '/Accounts/PaymentsMade',
                );
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Payment failed',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Could not record vendor payment in Zoho Payments Made.',
            });
        } finally {
            setSaving(false);
        }
    };

    const inputClass =
        'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-60';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={onClose} aria-hidden />
            <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col">
                <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Add Payment</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Payment to vendors · {fine.fineId || 'Fine'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Remaining Amount
                        </span>
                        <p className="text-lg font-bold text-amber-600 mt-1">
                            {remainingAmount.toFixed(2)} AED
                        </p>
                    </div>

                    {monthBoxes.length > 0 && (
                        <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                Payment Schedule
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {monthBoxes.map((box, index) => (
                                    <div
                                        key={`${box.month}-${index}`}
                                        onClick={() => handleCardClick(index, box)}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                                            box.isPaid
                                                ? 'bg-green-50 border-green-500'
                                                : box.isPartial
                                                  ? 'bg-amber-50 border-amber-500'
                                                  : selectedCardIndex === index
                                                    ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20'
                                                    : 'bg-red-50 border-red-500'
                                        }`}
                                    >
                                        <div
                                            className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between ${
                                                box.isPaid
                                                    ? 'text-green-700'
                                                    : box.isPartial
                                                      ? 'text-amber-700'
                                                      : 'text-red-700'
                                            }`}
                                        >
                                            {box.month}
                                            {box.isNotPaid && (
                                                <span className="text-red-600 bg-red-100 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                                                    ✗
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className={`text-sm font-bold mb-1 ${
                                                box.isPaid
                                                    ? 'text-green-700'
                                                    : box.isPartial
                                                      ? 'text-amber-700'
                                                      : 'text-red-700'
                                            }`}
                                        >
                                            {box.paidAmount.toFixed(2)}{' '}
                                            <span className="text-xs font-normal text-gray-500">
                                                / {box.monthlyAmount.toFixed(2)} AED
                                            </span>
                                        </div>
                                        {!box.isPaid && (
                                            <div className="text-[10px] font-medium text-red-600/80 mt-2">
                                                Remaining: {box.remaining.toFixed(2)} AED
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-5 bg-white border border-indigo-100 shadow-sm rounded-2xl space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">
                                    Payment to vendors · Zoho Payments Made
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Saves directly to Zoho Payments Made (no add page).
                                </p>
                            </div>
                            {(showZohoOrgPicker || activeZohoOrg) && (
                                <ZohoOrganizationPicker
                                    options={zohoOrgOptions}
                                    value={organizationId}
                                    onChange={setOrganizationId}
                                    loading={zohoOrgLoading || loadingSupport}
                                    size="sm"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Vendor <span className="text-red-500">*</span>
                            </label>
                            <Select
                                classNamePrefix="fine-vendor-pay-vendor"
                                instanceId="fine-vendor-pay-vendor"
                                value={selectedVendorOption}
                                onChange={(option) => setVendorId(option?.value || '')}
                                options={vendorOptions}
                                isLoading={loadingSupport}
                                isDisabled={loadingSupport}
                                isClearable
                                isSearchable
                                placeholder={
                                    loadingSupport ? 'Loading vendors…' : 'Search vendor…'
                                }
                                noOptionsMessage={() =>
                                    loadingSupport ? 'Loading…' : 'No vendors found'
                                }
                                styles={searchableSelectStyles}
                                menuPortalTarget={
                                    typeof document !== 'undefined' ? document.body : null
                                }
                                menuPosition="fixed"
                                menuPlacement="auto"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Paid Through <span className="text-red-500">*</span>
                            </label>
                            <Select
                                classNamePrefix="fine-vendor-pay-paid-through"
                                instanceId="fine-vendor-pay-paid-through"
                                value={selectedAccountOption}
                                onChange={(option) =>
                                    setPaidThroughAccountId(option?.value || '')
                                }
                                options={accountOptions}
                                isLoading={loadingSupport}
                                isDisabled={loadingSupport}
                                isClearable
                                isSearchable
                                placeholder={
                                    loadingSupport
                                        ? 'Loading Chart of Accounts…'
                                        : 'Search Paid Through account…'
                                }
                                noOptionsMessage={() =>
                                    loadingSupport
                                        ? 'Loading…'
                                        : 'No Paid Through accounts found'
                                }
                                styles={searchableSelectStyles}
                                menuPortalTarget={
                                    typeof document !== 'undefined' ? document.body : null
                                }
                                menuPosition="fixed"
                                menuPlacement="auto"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                Fine amount <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                    AED
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => {
                                        setSelectedCardIndex(null);
                                        setAmount(e.target.value);
                                    }}
                                    className={`${inputClass} pl-12`}
                                />
                            </div>
                        </div>

                        {hasZohoBill ? (
                            <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                                Pay Now records this against the Zoho vendor bill and lists it in
                                Payments Made.
                            </p>
                        ) : (
                            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                No Zoho bill linked yet. Sync/open the vendor bill before paying.
                            </p>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving || loadingSupport || !hasZohoBill}
                        onClick={handlePayToPaymentsMade}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold"
                    >
                        {saving || loadingSupport ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : null}
                        {saving ? 'Saving…' : 'Pay Now'}
                    </button>
                </div>
            </div>
        </div>
    );
}
