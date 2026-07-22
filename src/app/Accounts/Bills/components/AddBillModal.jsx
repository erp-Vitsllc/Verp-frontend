'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoVendors } from '@/utils/zohoVendors';
import {
    formatZohoPaymentMoney,
    mapZohoLocations,
    mapZohoPaymentAccounts,
} from '@/utils/zohoVendorPayments';
import VendorSidePanel from './VendorSidePanel';
import BillActivityPanel from './BillActivityPanel';

const selectStyles = {
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

const PAYMENT_TERMS = [
    { value: 'due_on_receipt', label: 'Due on Receipt', days: 0 },
    { value: 'net_15', label: 'Net 15', days: 15 },
    { value: 'net_30', label: 'Net 30', days: 30 },
    { value: 'net_45', label: 'Net 45', days: 45 },
    { value: 'net_60', label: 'Net 60', days: 60 },
];

function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDaysToDateKey(dateKey, days) {
    const raw = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + Number(days || 0));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function paymentTermsValueFromDays(days) {
    const n = Number(days);
    if (!Number.isFinite(n) || n <= 0) return 'due_on_receipt';
    const match = PAYMENT_TERMS.find((term) => term.days === n);
    return match?.value || 'due_on_receipt';
}

function emptyLine() {
    return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineItemId: '',
        accountId: '',
        description: '',
        quantity: '1',
        rate: '',
    };
}

function emptyForm() {
    return {
        vendorId: '',
        billNumber: '',
        referenceNumber: '',
        date: todayKey(),
        dueDate: todayKey(),
        paymentTerms: 'due_on_receipt',
        locationId: '',
        locationName: '',
        currencyCode: 'AED',
        notes: '',
    };
}

function amountValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
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

export default function AddBillModal({
    isOpen = true,
    onClose,
    onSuccess,
    variant = 'modal',
    billId = '',
}) {
    const isPage = variant === 'page';
    const isEdit = Boolean(String(billId || '').trim());
    const { toast } = useToast();
    const [form, setForm] = useState(emptyForm);
    const [lines, setLines] = useState([emptyLine()]);
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [vendorDetails, setVendorDetails] = useState(null);
    const [vendorPanelOpen, setVendorPanelOpen] = useState(false);
    const [loadingVendor, setLoadingVendor] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [attachmentName, setAttachmentName] = useState('');

    const setField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const loadVendorDetails = useCallback(async (vendorId, { openPanel = true } = {}) => {
        const id = String(vendorId || '').trim();
        if (!id) {
            setVendorDetails(null);
            setVendorPanelOpen(false);
            return;
        }

        setLoadingVendor(true);
        try {
            const response = await axiosInstance.get(`/zoho/vendors/${encodeURIComponent(id)}`, {
                skipToast: true,
                timeout: 60000,
            });
            setVendorDetails(response?.data?.data || null);
            if (openPanel) setVendorPanelOpen(true);
        } catch (err) {
            console.warn(
                '[AddBill] Vendor details load failed:',
                err?.response?.data?.message || err?.message || err,
            );
            setVendorDetails(null);
        } finally {
            setLoadingVendor(false);
        }
    }, []);

    useEffect(() => {
        if (!isPage && !isOpen) {
            setForm(emptyForm());
            setLines([emptyLine()]);
            setVendors([]);
            setAccounts([]);
            setLocations([]);
            setVendorDetails(null);
            setVendorPanelOpen(false);
            setLoading(false);
            setSaving(false);
            setError('');
            setAttachmentName('');
            return;
        }

        if (!isPage && !isOpen) return;

        let cancelled = false;
        setLoading(true);
        setError('');

        (async () => {
            try {
                const editId = String(billId || '').trim();
                const [vendorResponse, supportResponse, billResponse] = await Promise.all([
                    axiosInstance.get('/zoho/vendors', {
                        skipToast: true,
                        timeout: 120000,
                        params: { sync: 'false' },
                    }),
                    axiosInstance.get('/zoho/bills/support', {
                        skipToast: true,
                        timeout: 120000,
                    }),
                    editId
                        ? axiosInstance.get(`/zoho/bills/${encodeURIComponent(editId)}`, {
                              skipToast: true,
                              timeout: 120000,
                          })
                        : Promise.resolve(null),
                ]);

                if (cancelled) return;

                const mappedVendors = mapZohoVendors(vendorResponse?.data?.data);
                const support = supportResponse?.data?.data || {};
                const mappedAccounts = mapZohoPaymentAccounts(support.accounts);
                const mappedLocations = mapZohoLocations(support.locations);
                const primaryLocation =
                    mappedLocations.find((location) => location.isPrimary) || mappedLocations[0] || null;

                setVendors(mappedVendors);
                setAccounts(mappedAccounts);
                setLocations(mappedLocations);

                const bill = billResponse?.data?.data || null;
                if (bill) {
                    const termsValue = paymentTermsValueFromDays(bill.payment_terms);
                    const billLines = Array.isArray(bill.line_items) ? bill.line_items : [];
                    setForm({
                        vendorId: String(bill.vendor_id || '').trim(),
                        billNumber: String(bill.bill_number || '').trim(),
                        referenceNumber: String(bill.reference_number || '').trim(),
                        date: String(bill.date || todayKey()).trim() || todayKey(),
                        dueDate: String(bill.due_date || '').trim(),
                        paymentTerms: termsValue,
                        locationId: String(bill.location_id || primaryLocation?.id || '').trim(),
                        locationName: String(
                            bill.location_name || primaryLocation?.name || '',
                        ).trim(),
                        currencyCode: String(bill.currency_code || 'AED').trim() || 'AED',
                        notes: String(bill.notes || '').trim(),
                    });
                    setLines(
                        billLines.length
                            ? billLines.map((item, index) => ({
                                  key: `edit-${item.line_item_id || index}`,
                                  lineItemId: String(item.line_item_id || '').trim(),
                                  accountId: String(item.account_id || '').trim(),
                                  description: String(item.description || '').trim(),
                                  quantity:
                                      item.quantity != null && item.quantity !== ''
                                          ? String(item.quantity)
                                          : '1',
                                  rate:
                                      item.rate != null && item.rate !== ''
                                          ? String(item.rate)
                                          : '',
                              }))
                            : [emptyLine()],
                    );
                    if (bill.vendor_id) {
                        void loadVendorDetails(bill.vendor_id, { openPanel: true });
                    }
                } else {
                    setForm((prev) => ({
                        ...prev,
                        locationId: primaryLocation?.id || prev.locationId,
                        locationName: primaryLocation?.name || prev.locationName,
                        dueDate: addDaysToDateKey(prev.date, 0) || prev.dueDate,
                    }));
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err?.response?.data?.message ||
                            err?.message ||
                            'Failed to load Zoho bill form data',
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, isPage, billId, loadVendorDetails]);

    const vendorOptions = useMemo(
        () =>
            vendors.map((vendor) => ({
                value: vendor.id,
                label: vendor.label,
                email: vendor.email || '',
            })),
        [vendors],
    );

    const selectedVendor = useMemo(
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

    const accountOptions = useMemo(() => {
        const groups = new Map();
        accounts.forEach((account) => {
            const groupLabel = account.type || 'Other';
            if (!groups.has(groupLabel)) groups.set(groupLabel, []);
            groups.get(groupLabel).push({
                value: account.id,
                label: account.name,
            });
        });
        return [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, options]) => ({
                label,
                options: options.sort((a, b) => a.label.localeCompare(b.label)),
            }));
    }, [accounts]);

    const flatAccountOptions = useMemo(
        () => accountOptions.flatMap((group) => group.options || []),
        [accountOptions],
    );

    const paymentTermOptions = useMemo(
        () => PAYMENT_TERMS.map((term) => ({ value: term.value, label: term.label })),
        [],
    );

    const selectedPaymentTerm = useMemo(
        () => paymentTermOptions.find((option) => option.value === form.paymentTerms) || null,
        [form.paymentTerms, paymentTermOptions],
    );

    const lineTotals = useMemo(
        () =>
            lines.map((line) =>
                Number((amountValue(line.quantity) * amountValue(line.rate)).toFixed(2)),
            ),
        [lines],
    );

    const billTotal = useMemo(
        () => Number(lineTotals.reduce((sum, value) => sum + value, 0).toFixed(2)),
        [lineTotals],
    );

    const applyPaymentTerms = useCallback((termsValue, billDate) => {
        const term = PAYMENT_TERMS.find((item) => item.value === termsValue) || PAYMENT_TERMS[0];
        setForm((prev) => ({
            ...prev,
            paymentTerms: term.value,
            date: billDate || prev.date,
            dueDate: addDaysToDateKey(billDate || prev.date, term.days),
        }));
    }, []);

    const updateLine = useCallback((key, patch) => {
        setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    }, []);

    const removeLine = useCallback((key) => {
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
    }, []);

    const addLine = useCallback(() => {
        setLines((prev) => [...prev, emptyLine()]);
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;

        if (!form.vendorId) {
            setError('Select a vendor.');
            return;
        }
        if (!String(form.billNumber || '').trim()) {
            setError('Bill number is required.');
            return;
        }
        if (!form.date) {
            setError('Bill date is required.');
            return;
        }

        const lineItems = lines
            .map((line) => ({
                line_item_id: line.lineItemId || undefined,
                account_id: line.accountId,
                description: String(line.description || '').trim(),
                quantity: amountValue(line.quantity),
                rate: amountValue(line.rate),
            }))
            .filter((line) => line.account_id && line.quantity > 0);

        if (!lineItems.length) {
            setError('Add at least one line with an expense account, quantity, and rate.');
            return;
        }

        if (lineItems.some((line) => line.rate < 0)) {
            setError('Line rates cannot be negative.');
            return;
        }

        const selectedTerm = PAYMENT_TERMS.find((term) => term.value === form.paymentTerms);

        setSaving(true);
        setError('');

        const payload = {
            vendor_id: form.vendorId,
            bill_number: String(form.billNumber).trim(),
            date: form.date,
            due_date: form.dueDate || undefined,
            reference_number: form.referenceNumber,
            notes: form.notes,
            location_id: form.locationId,
            payment_terms: selectedTerm?.days,
            payment_terms_label: selectedTerm?.label,
            line_items: lineItems,
        };

        try {
            if (isEdit) {
                await axiosInstance.put(`/zoho/bills/${encodeURIComponent(billId)}`, payload);
                toast({
                    title: 'Bill updated',
                    description: 'The bill was updated in Zoho Books.',
                });
            } else {
                await axiosInstance.post('/zoho/bills', payload);
                toast({
                    title: 'Bill created',
                    description: 'The bill was created in Zoho Books.',
                });
            }
            onSuccess?.();
            onClose?.();
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    (isEdit
                        ? 'Failed to update bill in Zoho Books'
                        : 'Failed to create bill in Zoho Books'),
            );
        } finally {
            setSaving(false);
        }
    };

    if (!isPage && !isOpen) return null;

    const shellClass = isPage
        ? 'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
        : 'w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-2xl bg-white shadow-2xl';
    const formScrollClass = isPage
        ? ''
        : 'overflow-y-auto max-h-[calc(94vh-73px)]';

    const content = (
            <div className={shellClass}>
                <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-4">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                            {isEdit ? 'Edit Bill' : 'New Bill'}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500">
                            {isEdit
                                ? 'Update this vendor bill in Zoho Books.'
                                : 'Create a vendor bill in Zoho Books.'}
                        </p>
                    </div>
                    {!isPage ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    ) : null}
                </div>

                <form onSubmit={handleSubmit} className={formScrollClass}>
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
                                            <RequiredLabel>Vendor Name</RequiredLabel>
                                            <Select
                                                classNamePrefix="zoho-bill-vendor"
                                                instanceId="zoho-bill-vendor"
                                                styles={selectStyles}
                                                options={vendorOptions}
                                                value={selectedVendor}
                                                onChange={(option) => {
                                                    const nextId = option?.value || '';
                                                    setField('vendorId', nextId);
                                                    void loadVendorDetails(nextId, {
                                                        openPanel: Boolean(nextId),
                                                    });
                                                }}
                                                isClearable
                                                isSearchable
                                                isDisabled={loading || saving}
                                                placeholder={
                                                    vendors.length
                                                        ? `Select a Vendor (${vendors.length})`
                                                        : 'Select a Vendor'
                                                }
                                                noOptionsMessage={() =>
                                                    'No vendors found — refresh Accounts → Vendors'
                                                }
                                                menuPortalTarget={
                                                    typeof document !== 'undefined'
                                                        ? document.body
                                                        : null
                                                }
                                                menuPosition="fixed"
                                                filterOption={(option, inputValue) => {
                                                    const query = String(inputValue || '')
                                                        .trim()
                                                        .toLowerCase();
                                                    if (!query) return true;
                                                    const label = String(option?.label || '').toLowerCase();
                                                    const email = String(
                                                        option?.data?.email || option?.email || '',
                                                    ).toLowerCase();
                                                    return label.includes(query) || email.includes(query);
                                                }}
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <FieldLabel>Location</FieldLabel>
                                            <Select
                                                classNamePrefix="zoho-bill-location"
                                                instanceId="zoho-bill-location"
                                                styles={selectStyles}
                                                options={locationOptions}
                                                value={selectedLocation}
                                                onChange={(option) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        locationId: option?.value || '',
                                                        locationName: option?.label || '',
                                                    }))
                                                }
                                                isClearable
                                                isSearchable
                                                placeholder="Select location"
                                                noOptionsMessage={() =>
                                                    'No locations found — reconnect Zoho with settings.READ'
                                                }
                                                menuPortalTarget={
                                                    typeof document !== 'undefined'
                                                        ? document.body
                                                        : null
                                                }
                                                menuPosition="fixed"
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <RequiredLabel>Bill#</RequiredLabel>
                                            <input
                                                type="text"
                                                value={form.billNumber}
                                                onChange={(event) =>
                                                    setField('billNumber', event.target.value)
                                                }
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                placeholder="Enter bill number"
                                                required
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <FieldLabel>Order Number</FieldLabel>
                                            <input
                                                type="text"
                                                value={form.referenceNumber}
                                                onChange={(event) =>
                                                    setField('referenceNumber', event.target.value)
                                                }
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <RequiredLabel>Bill Date</RequiredLabel>
                                            <input
                                                type="date"
                                                value={form.date}
                                                onChange={(event) =>
                                                    applyPaymentTerms(
                                                        form.paymentTerms,
                                                        event.target.value,
                                                    )
                                                }
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                required
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <FieldLabel>Due Date</FieldLabel>
                                            <input
                                                type="date"
                                                value={form.dueDate}
                                                onChange={(event) =>
                                                    setField('dueDate', event.target.value)
                                                }
                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                            />
                                        </label>

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                            <FieldLabel>Payment Terms</FieldLabel>
                                            <Select
                                                classNamePrefix="zoho-bill-terms"
                                                instanceId="zoho-bill-terms"
                                                styles={selectStyles}
                                                options={paymentTermOptions}
                                                value={selectedPaymentTerm}
                                                onChange={(option) =>
                                                    applyPaymentTerms(
                                                        option?.value || 'due_on_receipt',
                                                        form.date,
                                                    )
                                                }
                                                isSearchable={false}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined'
                                                        ? document.body
                                                        : null
                                                }
                                                menuPosition="fixed"
                                            />
                                        </label>
                                    </div>

                                    <div className="flex flex-col items-stretch sm:items-end gap-2 min-w-0 lg:min-w-[220px]">
                                        <button
                                            type="button"
                                            disabled={!form.vendorId || loadingVendor}
                                            onClick={() => {
                                                if (!form.vendorId) return;
                                                if (vendorDetails) {
                                                    setVendorPanelOpen(true);
                                                    return;
                                                }
                                                void loadVendorDetails(form.vendorId, {
                                                    openPanel: true,
                                                });
                                            }}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={
                                                form.vendorId
                                                    ? 'Show vendor details'
                                                    : 'Select a vendor first'
                                            }
                                        >
                                            {loadingVendor ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : null}
                                            {loadingVendor
                                                ? 'Loading vendor…'
                                                : selectedVendor?.label
                                                  ? `View ${selectedVendor.label}`
                                                  : 'Select Vendor'}
                                        </button>
                                        {form.vendorId ? (
                                            <p className="text-[11px] text-slate-400 sm:text-right">
                                                Click to open vendor side panel
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5">
                                        <h3 className="text-sm font-semibold text-slate-800">
                                            Item Table
                                        </h3>
                                        <span className="text-[11px] font-medium text-slate-500">
                                            Tax Exclusive
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="min-w-[900px] w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                                                    <th className="px-3 py-2.5">Account</th>
                                                    <th className="px-3 py-2.5">Description</th>
                                                    <th className="px-3 py-2.5 w-24">Qty</th>
                                                    <th className="px-3 py-2.5 w-32">Rate</th>
                                                    <th className="px-3 py-2.5 w-32 text-right">
                                                        Amount
                                                    </th>
                                                    <th className="px-3 py-2.5 w-12" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lines.map((line, index) => {
                                                    const selectedAccount =
                                                        flatAccountOptions.find(
                                                            (option) =>
                                                                option.value === line.accountId,
                                                        ) || null;

                                                    return (
                                                        <tr
                                                            key={line.key}
                                                            className="border-b border-slate-100 last:border-0 align-top"
                                                        >
                                                            <td className="px-3 py-2 min-w-[240px]">
                                                                <Select
                                                                    classNamePrefix="zoho-bill-account"
                                                                    instanceId={`zoho-bill-account-${line.key}`}
                                                                    styles={selectStyles}
                                                                    options={accountOptions}
                                                                    value={selectedAccount}
                                                                    onChange={(option) =>
                                                                        updateLine(line.key, {
                                                                            accountId:
                                                                                option?.value || '',
                                                                        })
                                                                    }
                                                                    placeholder="Select an account"
                                                                    menuPortalTarget={
                                                                        typeof document !==
                                                                        'undefined'
                                                                            ? document.body
                                                                            : null
                                                                    }
                                                                    menuPosition="fixed"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 min-w-[220px]">
                                                                <input
                                                                    type="text"
                                                                    value={line.description}
                                                                    onChange={(event) =>
                                                                        updateLine(line.key, {
                                                                            description:
                                                                                event.target.value,
                                                                        })
                                                                    }
                                                                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                                    placeholder="Description"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    value={line.quantity}
                                                                    onChange={(event) =>
                                                                        updateLine(line.key, {
                                                                            quantity:
                                                                                event.target.value,
                                                                        })
                                                                    }
                                                                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex h-10 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
                                                                    <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600">
                                                                        {form.currencyCode || 'AED'}
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={line.rate}
                                                                        onChange={(event) =>
                                                                            updateLine(line.key, {
                                                                                rate: event.target
                                                                                    .value,
                                                                            })
                                                                        }
                                                                        className="min-w-0 flex-1 rounded-r-lg px-2 text-sm tabular-nums outline-none"
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-700 whitespace-nowrap">
                                                                {formatZohoPaymentMoney(
                                                                    lineTotals[index] || 0,
                                                                    form.currencyCode,
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        removeLine(line.key)
                                                                    }
                                                                    disabled={lines.length <= 1}
                                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                                                    aria-label="Remove line"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="border-t border-slate-200 bg-white px-3 sm:px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={addLine}
                                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
                                        >
                                            <Plus size={14} />
                                            Add New Row
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,320px)] gap-5 items-start">
                                    <div className="space-y-4">
                                        <label className="block space-y-1.5">
                                            <span className="text-xs font-semibold text-slate-600">
                                                Notes{' '}
                                                <span className="font-normal text-slate-400">
                                                    (Internal use. Not visible to vendor)
                                                </span>
                                            </span>
                                            <textarea
                                                value={form.notes}
                                                onChange={(event) =>
                                                    setField('notes', event.target.value)
                                                }
                                                rows={3}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                            />
                                        </label>

                                        <div className="space-y-1.5">
                                            <span className="text-xs font-semibold text-slate-600">
                                                Attachments
                                            </span>
                                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                                <Upload size={14} />
                                                Upload File
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(event) =>
                                                        setAttachmentName(
                                                            event.target.files?.[0]?.name || '',
                                                        )
                                                    }
                                                />
                                            </label>
                                            {attachmentName ? (
                                                <span className="ml-2 text-xs text-slate-500">
                                                    {attachmentName}
                                                </span>
                                            ) : null}
                                            <p className="text-[11px] text-slate-400">
                                                You can select a file here for reference. Zoho bill
                                                attachments are not uploaded by this form yet.
                                            </p>
                                        </div>

                                        <p className="text-[11px] text-slate-500">
                                            Additional Fields: Start adding custom fields for your
                                            bills by going to Settings - Accounts - Bills.
                                        </p>
                                    </div>

                                    <div className="w-full rounded-2xl bg-orange-50 px-4 py-3 text-xs text-slate-700">
                                        <div className="flex justify-between py-1">
                                            <span>Sub Total</span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(
                                                    billTotal,
                                                    form.currencyCode,
                                                )}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex justify-between border-t border-orange-100 py-2 text-sm font-bold text-slate-900">
                                            <span>Total</span>
                                            <span className="tabular-nums">
                                                {formatZohoPaymentMoney(
                                                    billTotal,
                                                    form.currencyCode,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-start gap-2 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-4">
                        <button
                            type="button"
                            disabled
                            title="Zoho draft save is not available for bills through this API yet."
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
                            {isEdit ? 'Save' : 'Save as Open'}
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

                {isEdit && isPage ? (
                    <div className="border-t border-slate-200 px-4 sm:px-6 py-5">
                        <BillActivityPanel billId={billId} />
                    </div>
                ) : null}

                <VendorSidePanel
                    open={Boolean(vendorPanelOpen && form.vendorId)}
                    onClose={() => setVendorPanelOpen(false)}
                    vendor={vendorDetails}
                    loading={loadingVendor}
                    fallbackName={selectedVendor?.label || ''}
                />
            </div>
    );

    if (isPage) return content;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-3 py-6">
            {content}
        </div>
    );
}
