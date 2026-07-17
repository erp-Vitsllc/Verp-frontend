'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { AlertTriangle, Loader2, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoVendors } from '@/utils/zohoVendors';
import {
    buildAutoBillAmounts,
    formatZohoPaymentMoney,
    mapZohoLocations,
    mapZohoPaymentAccounts,
    mapZohoPaymentModes,
    mapZohoVendorPayableOptions,
    mergeLocationOptions,
} from '@/utils/zohoVendorPayments';
import ZohoPaymentModeSelect from './ZohoPaymentModeSelect';

const locationSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: '0.5rem',
        borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
        backgroundColor: '#fff',
        cursor: 'pointer',
        '&:hover': {
            borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
        },
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '2px 12px',
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        fontSize: '0.875rem',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#94a3b8',
        fontSize: '0.875rem',
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: '0.875rem',
        color: '#334155',
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 100000,
    }),
    menuList: (base) => ({
        ...base,
        maxHeight: 280,
        paddingTop: 4,
        paddingBottom: 4,
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: 'pointer',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
};

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
    return {
        vendorId: '',
        locationId: '',
        locationName: '',
        currencyCode: 'AED',
        paymentNumber: '',
        date: todayKey(),
        amount: '',
        paidThroughAccountId: '',
        paymentMode: 'Cash',
        referenceNumber: '',
        notes: '',
    };
}

function amountValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export default function AddVendorPaymentModal({ isOpen, onClose, onSuccess, prefill = null }) {
    const { toast } = useToast();
    const [form, setForm] = useState(emptyForm);
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [paymentModes, setPaymentModes] = useState(() => mapZohoPaymentModes([]));
    const [payables, setPayables] = useState([]);
    const [billAmounts, setBillAmounts] = useState({});
    const [payableTab, setPayableTab] = useState('bills');
    const [loading, setLoading] = useState(false);
    const [loadingBills, setLoadingBills] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [attachmentName, setAttachmentName] = useState('');

    const fetchSupport = useCallback(async (vendorId = '') => {
        const response = await axiosInstance.get('/zoho/vendorpayments/support', {
            skipToast: true,
            timeout: 120000,
            params: vendorId ? { vendorId } : undefined,
        });

        const data = response?.data?.data || {};
        const mappedAccounts = mapZohoPaymentAccounts(data.accounts);
        const mappedPayables = mapZohoVendorPayableOptions({
            bills: data.bills,
            expenses: data.expenses,
        });
        const mappedLocations = mergeLocationOptions(
            mapZohoLocations(data.locations),
            mappedPayables,
        );
        const mappedPaymentModes = mapZohoPaymentModes(data.paymentModes);

        setAccounts(mappedAccounts);
        setLocations(mappedLocations);
        setPaymentModes(mappedPaymentModes);

        return {
            accounts: mappedAccounts,
            payables: mappedPayables,
            locations: mappedLocations,
            paymentModes: mappedPaymentModes,
            vendorDefaults: data.vendorDefaults || null,
            nextPaymentNumber: String(data.nextPaymentNumber || '').trim(),
            expenseCount: Number(response?.data?.meta?.expenseCount) || 0,
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setForm(emptyForm());
            setVendors([]);
            setAccounts([]);
            setLocations([]);
            setPaymentModes(mapZohoPaymentModes([]));
            setPayables([]);
            setBillAmounts({});
            setPayableTab('bills');
            setLoading(false);
            setLoadingBills(false);
            setSaving(false);
            setError('');
            setAttachmentName('');
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError('');

        (async () => {
            try {
                const vendorPromise = axiosInstance
                    .get('/zoho/vendors', {
                        skipToast: true,
                        timeout: 120000,
                        params: { sync: 'false' },
                    })
                    .then((response) => mapZohoVendors(response?.data?.data))
                    .catch((err) => {
                        throw new Error(
                            err?.response?.data?.message ||
                                err?.message ||
                                'Failed to load vendors',
                        );
                    });

                const supportPromise = fetchSupport().catch((err) => {
                    console.warn(
                        '[AddVendorPayment] Support load failed:',
                        err?.response?.data?.message || err?.message || err,
                    );
                    return {
                        accounts: [],
                        payables: [],
                        locations: [],
                        paymentModes: mapZohoPaymentModes([]),
                        vendorDefaults: null,
                        nextPaymentNumber: '',
                    };
                });

                const [mappedVendors, support] = await Promise.all([vendorPromise, supportPromise]);

                if (cancelled) return;
                setVendors(mappedVendors);

                const primaryLocation =
                    support.locations.find((location) => location.isPrimary) ||
                    support.locations[0] ||
                    null;
                const defaultPaymentMode =
                    support.paymentModes.find(
                        (mode) => String(mode).toLowerCase() === 'cash',
                    ) ||
                    support.paymentModes[0] ||
                    'Cash';

                setForm((prev) => ({
                    ...prev,
                    paymentNumber: support.nextPaymentNumber || prev.paymentNumber,
                    paymentMode: prev.paymentMode || defaultPaymentMode,
                    locationId:
                        prev.locationId ||
                        support.vendorDefaults?.location_id ||
                        primaryLocation?.id ||
                        '',
                    locationName:
                        prev.locationName ||
                        support.vendorDefaults?.location_name ||
                        primaryLocation?.name ||
                        '',
                }));

                if (!mappedVendors.length) {
                    setError(
                        'No vendors found. Open Purchases → Vendors and click Refresh to sync from Zoho.',
                    );
                }
            } catch (err) {
                if (cancelled) return;
                setError(
                    err?.response?.data?.message ||
                        err?.message ||
                        'Failed to load Zoho payment form data',
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [fetchSupport, isOpen]);

    const selectedVendor = useMemo(
        () => vendors.find((vendor) => vendor.id === form.vendorId) || null,
        [form.vendorId, vendors],
    );

    const paymentAmount = amountValue(form.amount);
    const billRows = useMemo(
        () => payables.filter((row) => row.recordType === 'bill'),
        [payables],
    );
    const expenseRows = useMemo(
        () => payables.filter((row) => row.recordType === 'expense'),
        [payables],
    );
    const visiblePayables = payableTab === 'expenses' ? expenseRows : billRows;
    const appliedTotal = useMemo(
        () =>
            Object.values(billAmounts).reduce(
                (sum, value) => sum + amountValue(value),
                0,
            ),
        [billAmounts],
    );
    const remainingAmount = Math.max(paymentAmount - appliedTotal, 0);

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const applyVendorSelection = useCallback(
        async (vendorId, vendorList, overrides = {}) => {
            const vendor = vendorList.find((item) => item.id === vendorId);

            setLoadingBills(true);
            setError('');
            setPayables([]);
            setBillAmounts({});
            setPayableTab('bills');

            try {
                const {
                    payables: mappedPayables,
                    vendorDefaults,
                    nextPaymentNumber,
                    locations: mappedLocations,
                } = await fetchSupport(vendorId);
                const defaults = vendorDefaults || {
                    location_id: vendor?.locationId || '',
                    location_name: vendor?.locationName || '',
                    currency_code: vendor?.currencyCode || 'AED',
                    outstanding_payable_amount: vendor?.outstandingPayableAmount || 0,
                };
                const { billAmounts: autoBillAmounts, suggestedPaymentAmount } =
                    buildAutoBillAmounts(mappedPayables);

                const fallbackAmount =
                    defaults.outstanding_payable_amount > 0
                        ? Number(defaults.outstanding_payable_amount).toFixed(2)
                        : '';

                const primaryLocation =
                    mappedLocations.find((location) => location.isPrimary) ||
                    mappedLocations[0] ||
                    null;

                const nextLocationId =
                    String(defaults.location_id || '').trim() || primaryLocation?.id || '';
                const nextLocationName =
                    String(defaults.location_name || '').trim() ||
                    mappedLocations.find((location) => location.id === nextLocationId)?.name ||
                    primaryLocation?.name ||
                    '';

                const hasAmountOverride =
                    overrides.amount !== undefined &&
                    overrides.amount !== null &&
                    overrides.amount !== '';

                setPayables(mappedPayables);
                setForm((prev) => ({
                    ...prev,
                    vendorId,
                    locationId: nextLocationId,
                    locationName: nextLocationName,
                    currencyCode: String(defaults.currency_code || 'AED').trim() || 'AED',
                    paymentNumber: nextPaymentNumber || prev.paymentNumber,
                    date: todayKey(),
                    amount: hasAmountOverride
                        ? String(overrides.amount)
                        : suggestedPaymentAmount || fallbackAmount,
                    referenceNumber: overrides.referenceNumber ?? '',
                    notes: overrides.notes ?? '',
                }));
                setBillAmounts(autoBillAmounts);

                if (!mappedPayables.length) {
                    setPayableTab('bills');
                } else if (!mappedPayables.some((row) => row.recordType === 'bill')) {
                    setPayableTab('expenses');
                }
            } catch (err) {
                setError(
                    err?.response?.data?.message ||
                        err?.message ||
                        'Failed to load vendor payment details from Zoho Books',
                );
            } finally {
                setLoadingBills(false);
            }
        },
        [fetchSupport],
    );

    const handleVendorChange = async (option) => {
        const vendorId = String(option?.value || '').trim();

        if (!vendorId) {
            setForm((prev) => ({
                ...emptyForm(),
                paymentNumber: prev.paymentNumber,
            }));
            setPayables([]);
            setBillAmounts({});
            return;
        }

        await applyVendorSelection(vendorId, vendors);
    };

    // Prefill (e.g. redirected from Utility Bills "Pay"): auto-select the matching
    // vendor by id or provider name and set the payment amount once vendors load.
    const prefillAppliedRef = useRef('');
    useEffect(() => {
        if (!isOpen) {
            prefillAppliedRef.current = '';
            return;
        }
        if (!prefill || !vendors.length) return;

        const key = JSON.stringify({
            v: prefill.vendorId || '',
            n: prefill.vendorName || '',
            a: prefill.amount || '',
        });
        if (prefillAppliedRef.current === key) return;
        prefillAppliedRef.current = key;

        const wantedId = String(prefill.vendorId || '').trim();
        const wantedName = String(prefill.vendorName || '').trim().toLowerCase();
        const match =
            (wantedId && vendors.find((item) => item.id === wantedId)) ||
            (wantedName &&
                vendors.find(
                    (item) => String(item.label || '').trim().toLowerCase() === wantedName,
                )) ||
            null;

        if (match) {
            void applyVendorSelection(match.id, vendors, {
                amount: prefill.amount,
                referenceNumber: prefill.referenceNumber,
                notes: prefill.notes,
            });
            return;
        }

        setForm((prev) => ({
            ...prev,
            amount:
                prefill.amount != null && prefill.amount !== ''
                    ? String(prefill.amount)
                    : prev.amount,
            referenceNumber: prefill.referenceNumber || prev.referenceNumber,
            notes: prefill.notes || prev.notes,
        }));
        if (wantedName || wantedId) {
            setError(
                `Could not auto-match vendor "${prefill.vendorName || prefill.vendorId}". Please select the vendor manually.`,
            );
        }
    }, [isOpen, prefill, vendors, applyVendorSelection]);

    const vendorOptions = useMemo(
        () =>
            vendors.map((vendor) => ({
                value: vendor.id,
                label: vendor.label,
                email: vendor.email || '',
            })),
        [vendors],
    );

    const selectedVendorOption = useMemo(
        () => vendorOptions.find((option) => option.value === form.vendorId) || null,
        [form.vendorId, vendorOptions],
    );

    const locationOptions = useMemo(() => {
        const options = locations.map((location) => ({
            value: location.id,
            label: location.name,
        }));

        if (
            form.locationId &&
            !options.some((option) => option.value === form.locationId) &&
            form.locationName
        ) {
            options.unshift({
                value: form.locationId,
                label: form.locationName,
            });
        }

        return options;
    }, [form.locationId, form.locationName, locations]);

    const selectedLocation = useMemo(
        () => locationOptions.find((option) => option.value === form.locationId) || null,
        [form.locationId, locationOptions],
    );

    const paidThroughOptions = useMemo(
        () =>
            accounts.map((account) => ({
                value: account.id,
                label: account.type ? `${account.name} - ${account.type}` : account.name,
            })),
        [accounts],
    );

    const selectedPaidThrough = useMemo(
        () =>
            paidThroughOptions.find((option) => option.value === form.paidThroughAccountId) ||
            null,
        [form.paidThroughAccountId, paidThroughOptions],
    );

    const handleLocationChange = (option) => {
        setForm((prev) => ({
            ...prev,
            locationId: option?.value || '',
            locationName: option?.label || '',
        }));
    };

    const handleBillAmountChange = (billId, value) => {
        setBillAmounts((prev) => ({
            ...prev,
            [billId]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;

        if (!form.vendorId) {
            setError('Select a vendor.');
            return;
        }
        if (paymentAmount <= 0) {
            setError('Enter a payment amount greater than zero.');
            return;
        }
        if (!form.paidThroughAccountId) {
            setError('Select the paid through account.');
            return;
        }
        if (appliedTotal - paymentAmount > 0.01) {
            setError('Bill and expense allocations cannot exceed the payment amount.');
            return;
        }

        const appliedBills = payables
            .filter((row) => row.recordType === 'bill')
            .map((bill) => ({
                bill_id: bill.id,
                amount_applied: amountValue(billAmounts[bill.id]),
            }))
            .filter((bill) => bill.amount_applied > 0);

        const appliedExpenses = payables
            .filter((row) => row.recordType === 'expense')
            .map((expense) => ({
                expense_id: expense.id,
                amount_applied: amountValue(billAmounts[expense.id]),
            }))
            .filter((expense) => expense.amount_applied > 0);

        setSaving(true);
        setError('');

        try {
            await axiosInstance.post('/zoho/vendorpayments', {
                vendor_id: form.vendorId,
                date: form.date,
                amount: paymentAmount,
                paid_through_account_id: form.paidThroughAccountId,
                payment_mode: form.paymentMode,
                reference_number: form.referenceNumber,
                description: form.notes,
                location_id: form.locationId,
                bills: appliedBills,
                expenses: appliedExpenses,
            });

            toast({
                title: 'Payment recorded',
                description: 'The vendor payment was created in Zoho Books.',
            });
            onSuccess?.();
            onClose?.();
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    'Failed to create payment made in Zoho Books',
            );
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-3 py-6">
            <div className="w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-4">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">Record Payment</h2>
                        <p className="text-xs sm:text-sm text-slate-500">
                            Add a payment made to a vendor in Zoho Books.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(94vh-73px)]">
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
                                            <span className="text-xs font-bold text-red-600">
                                                Vendor Name <span className="text-blue-600">*</span>
                                            </span>
                                            <Select
                                                classNamePrefix="zoho-vendor-payment"
                                                value={selectedVendorOption}
                                                onChange={handleVendorChange}
                                                options={vendorOptions}
                                                isClearable
                                                isSearchable
                                                isDisabled={loading || saving}
                                                placeholder={
                                                    vendors.length
                                                        ? `Select vendor (${vendors.length})`
                                                        : 'Select vendor'
                                                }
                                                noOptionsMessage={() =>
                                                    'No vendors found — refresh Purchases → Vendors'
                                                }
                                                styles={locationSelectStyles}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined' ? document.body : null
                                                }
                                                menuPosition="fixed"
                                                filterOption={(option, inputValue) => {
                                                    const query = String(inputValue || '')
                                                        .trim()
                                                        .toLowerCase();
                                                    if (!query) return true;
                                                    const label = String(option?.label || '').toLowerCase();
                                                    const email = String(option?.data?.email || option?.email || '').toLowerCase();
                                                    return label.includes(query) || email.includes(query);
                                                }}
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <span className="text-xs font-semibold text-slate-600">Location</span>
                                            <Select
                                                classNamePrefix="zoho-location"
                                                value={selectedLocation}
                                                onChange={handleLocationChange}
                                                options={locationOptions}
                                                isClearable
                                                isSearchable
                                                placeholder="Select location"
                                                noOptionsMessage={() =>
                                                    'No locations found — reconnect Zoho with settings.READ'
                                                }
                                                styles={locationSelectStyles}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined' ? document.body : null
                                                }
                                                menuPosition="fixed"
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <span className="text-xs font-bold text-red-600">
                                                Payment # <span className="text-blue-600">*</span>
                                            </span>
                                            <input
                                                type="text"
                                                value={
                                                    loading || loadingBills
                                                        ? 'Loading...'
                                                        : form.paymentNumber || '—'
                                                }
                                                readOnly
                                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 tabular-nums"
                                                title="Next payment number fetched from Zoho Books"
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <span className="text-xs font-bold text-red-600">
                                                Payment Made <span className="text-blue-600">*</span>
                                            </span>
                                            <div className="flex h-10 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
                                                <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                                                    {form.currencyCode || 'AED'}
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={form.amount}
                                                    onChange={(event) => setField('amount', event.target.value)}
                                                    className="min-w-0 flex-1 rounded-r-lg px-3 text-sm text-slate-700 outline-none"
                                                    required
                                                />
                                            </div>
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <span className="text-xs font-bold text-red-600">
                                                Payment Date <span className="text-blue-600">*</span>
                                            </span>
                                            <input
                                                type="date"
                                                value={form.date}
                                                onChange={(event) => setField('date', event.target.value)}
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                required
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <span className="text-xs font-semibold text-slate-600">Payment Mode</span>
                                            <ZohoPaymentModeSelect
                                                value={form.paymentMode}
                                                options={paymentModes}
                                                defaultMode={
                                                    paymentModes.find(
                                                        (mode) =>
                                                            String(mode).toLowerCase() === 'cash',
                                                    ) ||
                                                    paymentModes[0] ||
                                                    'Cash'
                                                }
                                                onChange={(mode) => setField('paymentMode', mode)}
                                                onOptionsChange={setPaymentModes}
                                                disabled={loading || saving}
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <span className="text-xs font-bold text-red-600">
                                                Paid Through <span className="text-blue-600">*</span>
                                            </span>
                                            <Select
                                                classNamePrefix="zoho-paid-through"
                                                value={selectedPaidThrough}
                                                onChange={(option) =>
                                                    setField('paidThroughAccountId', option?.value || '')
                                                }
                                                options={paidThroughOptions}
                                                isClearable
                                                isSearchable
                                                placeholder="Select account"
                                                noOptionsMessage={() => 'No paid-through accounts found'}
                                                styles={locationSelectStyles}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined' ? document.body : null
                                                }
                                                menuPosition="fixed"
                                                menuPlacement="auto"
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <span className="text-xs font-semibold text-slate-600">Reference#</span>
                                            <input
                                                type="text"
                                                value={form.referenceNumber}
                                                onChange={(event) => setField('referenceNumber', event.target.value)}
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                            />
                                        </label>
                                    </div>

                                    <div className="hidden lg:flex items-start justify-end">
                                        <div className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white shadow">
                                            {selectedVendor?.label || 'Select Vendor'}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setBillAmounts({})}
                                            className="self-start sm:self-auto text-xs font-semibold text-blue-600 hover:underline"
                                        >
                                            Clear Applied Amount
                                        </button>
                                        <div className="text-xs font-semibold text-slate-600">
                                            Remaining: {formatZohoPaymentMoney(remainingAmount, form.currencyCode)}
                                        </div>
                                    </div>

                                    <div className="flex min-h-[280px] flex-col md:flex-row">
                                        <aside className="flex shrink-0 border-b border-slate-200 bg-slate-50 md:w-44 md:flex-col md:border-b-0 md:border-r">
                                            <button
                                                type="button"
                                                onClick={() => setPayableTab('bills')}
                                                className={`flex flex-1 items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold transition md:flex-none ${
                                                    payableTab === 'bills'
                                                        ? 'border-b-2 border-blue-600 bg-white text-blue-700 md:border-b-0 md:border-l-2'
                                                        : 'text-slate-600 hover:bg-white/70'
                                                }`}
                                            >
                                                <span>Bills</span>
                                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] tabular-nums text-slate-700">
                                                    {billRows.length}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPayableTab('expenses')}
                                                className={`flex flex-1 items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold transition md:flex-none ${
                                                    payableTab === 'expenses'
                                                        ? 'border-b-2 border-blue-600 bg-white text-blue-700 md:border-b-0 md:border-l-2'
                                                        : 'text-slate-600 hover:bg-white/70'
                                                }`}
                                            >
                                                <span>Expenses</span>
                                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] tabular-nums text-slate-700">
                                                    {expenseRows.length}
                                                </span>
                                            </button>
                                        </aside>

                                        <div className="min-w-0 flex-1">
                                            {loadingBills ? (
                                                <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-slate-500">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Loading {payableTab === 'expenses' ? 'expenses' : 'bills'}...
                                                </div>
                                            ) : null}

                                            {!loadingBills && !selectedVendor ? (
                                                <div className="px-3 py-8 text-center text-sm text-slate-500">
                                                    Select a vendor to load {payableTab === 'expenses' ? 'expenses' : 'bills'}.
                                                </div>
                                            ) : null}

                                            {!loadingBills && selectedVendor && !visiblePayables.length ? (
                                                <div className="px-3 py-8 text-center text-sm text-slate-500">
                                                    {payableTab === 'expenses'
                                                        ? 'No open expenses found for this vendor.'
                                                        : 'No open bills found for this vendor.'}
                                                </div>
                                            ) : null}

                                            {!loadingBills && visiblePayables.length ? (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-[900px] w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                                                                <th className="px-3 py-2">Date</th>
                                                                <th className="px-3 py-2">
                                                                    {payableTab === 'expenses' ? 'Expense#' : 'Bill#'}
                                                                </th>
                                                                <th className="px-3 py-2">
                                                                    {payableTab === 'expenses' ? 'Account' : 'PO#'}
                                                                </th>
                                                                <th className="px-3 py-2">Location</th>
                                                                <th className="px-3 py-2 text-right">
                                                                    {payableTab === 'expenses' ? 'Expense Amount' : 'Bill Amount'}
                                                                </th>
                                                                <th className="px-3 py-2 text-right">Amount Due</th>
                                                                <th className="px-3 py-2">Payment Made On</th>
                                                                <th className="px-3 py-2 text-right">Payment</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {visiblePayables.map((row) => (
                                                                <tr
                                                                    key={`${row.recordType}-${row.id}`}
                                                                    className="border-b border-slate-100 last:border-0"
                                                                >
                                                                    <td className="px-3 py-2 text-slate-600">{row.date}</td>
                                                                    <td className="px-3 py-2 font-medium text-slate-800">
                                                                        {row.billNumber}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-600">
                                                                        {payableTab === 'expenses'
                                                                            ? row.accountName || row.description || '—'
                                                                            : row.poNumber}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-600">{row.location}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                                                        {formatZohoPaymentMoney(row.total, row.currencyCode)}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                                                        {formatZohoPaymentMoney(row.balance, row.currencyCode)}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-600">
                                                                        {form.date || '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max={row.balance}
                                                                            step="0.01"
                                                                            value={billAmounts[row.id] || ''}
                                                                            onChange={(event) =>
                                                                                handleBillAmountChange(
                                                                                    row.id,
                                                                                    event.target.value,
                                                                                )
                                                                            }
                                                                            className="ml-auto h-9 w-32 rounded-lg border border-slate-200 px-2 text-right text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <div className="w-full max-w-sm rounded-2xl bg-orange-50 px-4 py-3 text-xs text-slate-700">
                                        <div className="flex justify-between py-1">
                                            <span>Amount Paid:</span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(paymentAmount, form.currencyCode)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span>Amount used for Payments:</span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(appliedTotal, form.currencyCode)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span>Amount Refunded:</span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(0, form.currencyCode)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1 text-amber-700">
                                            <span className="inline-flex items-center gap-1">
                                                <AlertTriangle size={13} />
                                                Amount in Excess:
                                            </span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(remainingAmount, form.currencyCode)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <label className="block space-y-1.5">
                                    <span className="text-xs font-semibold text-slate-600">
                                        Notes <span className="font-normal text-slate-400">(Internal use. Not visible to vendor)</span>
                                    </span>
                                    <textarea
                                        value={form.notes}
                                        onChange={(event) => setField('notes', event.target.value)}
                                        rows={3}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                    />
                                </label>

                                <div className="space-y-1.5">
                                    <span className="text-xs font-semibold text-slate-600">Attachments</span>
                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                        <Upload size={14} />
                                        Upload File
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={(event) =>
                                                setAttachmentName(event.target.files?.[0]?.name || '')
                                            }
                                        />
                                    </label>
                                    {attachmentName ? (
                                        <span className="ml-2 text-xs text-slate-500">{attachmentName}</span>
                                    ) : null}
                                    <p className="text-[11px] text-slate-400">
                                        You can select a file here for reference. Zoho vendor payment attachments are not uploaded by this form yet.
                                    </p>
                                </div>

                                <p className="text-[11px] text-slate-500">
                                    Additional Fields: Start adding custom fields for your payments made by going to Settings - Purchases - Payments Made.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-start gap-2 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-4">
                        <button
                            type="button"
                            disabled
                            title="Zoho draft save is not available for vendor payments through this API."
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400"
                        >
                            Save as Draft
                        </button>
                        <button
                            type="submit"
                            disabled={loading || saving}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            Save as Paid
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
