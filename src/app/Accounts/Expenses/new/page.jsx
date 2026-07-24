'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import { CloudUpload, ImageIcon, List, Loader2, Plus, Search, Tags, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoCustomerListRows } from '@/utils/zohoCustomers';
import { mapZohoVendors } from '@/utils/zohoVendors';
import {
    mapZohoLocations,
    mapZohoPaymentAccounts,
} from '@/utils/zohoVendorPayments';
import AssociateTagsModal from '../components/AssociateTagsModal';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 36,
        borderRadius: '0.25rem',
        borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.12)' : 'none',
        backgroundColor: '#fff',
        cursor: 'pointer',
        '&:hover': { borderColor: state.isFocused ? '#3b82f6' : '#94a3b8' },
    }),
    valueContainer: (base) => ({ ...base, padding: '0 8px' }),
    input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: '0.875rem' }),
    placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
    singleValue: (base) => ({ ...base, fontSize: '0.875rem', color: '#334155' }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '0.375rem',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 100000 }),
    menuList: (base) => ({ ...base, maxHeight: 280, paddingTop: 4, paddingBottom: 4 }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: 'pointer',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
};

const TAX_TREATMENT_OPTIONS = [
    { value: 'vat_registered', label: 'VAT Registered' },
    { value: 'vat_not_registered', label: 'VAT Not Registered' },
    { value: 'gcc_vat_registered', label: 'GCC VAT Registered' },
    { value: 'gcc_vat_not_registered', label: 'GCC VAT Not Registered' },
    { value: 'non_gcc', label: 'Non GCC' },
    { value: 'dz_vat_registered', label: 'Designated Zone - VAT Registered' },
    { value: 'dz_vat_not_registered', label: 'Designated Zone - VAT Not Registered' },
];

const PLACE_OF_SUPPLY_OPTIONS = [
    { value: 'AB', label: 'Abu Dhabi' },
    { value: 'AJ', label: 'Ajman' },
    { value: 'DU', label: 'Dubai' },
    { value: 'FU', label: 'Fujairah' },
    { value: 'RA', label: 'Ras al-Khaimah' },
    { value: 'SH', label: 'Sharjah' },
    { value: 'UM', label: 'Umm al-Quwain' },
    { value: 'AE', label: 'United Arab Emirates' },
    { value: 'SA', label: 'Saudi Arabia' },
    { value: 'BH', label: 'Bahrain' },
    { value: 'KW', label: 'Kuwait' },
    { value: 'OM', label: 'Oman' },
    { value: 'QA', label: 'Qatar' },
];

const CURRENCY_OPTIONS = [{ value: 'AED', label: 'AED' }];

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MAX_NOTES = 500;

function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function emptyForm(defaults = {}) {
    return {
        locationId: defaults.locationId || '',
        locationName: defaults.locationName || '',
        date: todayKey(),
        accountId: '',
        amount: '',
        currencyCode: 'AED',
        isInclusiveTax: false,
        paidThroughAccountId: '',
        vendorId: '',
        taxTreatment: 'vat_registered',
        placeOfSupply: 'DU',
        taxId: '',
        referenceNumber: '',
        notes: '',
        serialNo: '',
        customerId: '',
        ...defaults,
    };
}

function RequiredLabel({ children }) {
    return (
        <span className="text-[13px] text-slate-700">
            {children}
            <span className="ml-0.5 text-red-500">*</span>
        </span>
    );
}

function FieldLabel({ children }) {
    return <span className="text-[13px] text-slate-700">{children}</span>;
}

function FieldRow({ label, children, alignTop = false }) {
    return (
        <div
            className={`grid grid-cols-1 sm:grid-cols-[160px_minmax(0,420px)] gap-1.5 sm:gap-4 ${
                alignTop ? 'sm:items-start' : 'sm:items-center'
            }`}
        >
            <div className={alignTop ? 'sm:pt-2' : ''}>{label}</div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function mapZohoTaxes(taxes) {
    if (!Array.isArray(taxes)) return [];
    return taxes
        .map((tax) => {
            const id = String(tax?.tax_id || tax?.id || '').trim();
            if (!id) return null;
            const name = String(tax?.tax_name || tax?.name || '').trim() || id;
            const percent = tax?.tax_percentage ?? tax?.percentage;
            const label =
                percent != null && percent !== ''
                    ? `${name} [${Number(percent)}%]`
                    : name;
            return { id, label, raw: tax };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label));
}

function emptyLine(seed = {}) {
    return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        accountId: seed.accountId || '',
        notes: seed.notes || '',
        amount: seed.amount || '',
        taxId: seed.taxId || '',
    };
}

function mapReportingTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags
        .map((tag) => {
            const tagId = String(tag?.tag_id || tag?.id || '').trim();
            if (!tagId) return null;
            return {
                tag_id: tagId,
                tag_name: String(tag?.tag_name || tag?.name || tagId).trim(),
                is_mandatory: Boolean(tag?.is_mandatory),
                options: Array.isArray(tag?.options)
                    ? tag.options.map((opt) => ({
                          option_id: String(opt?.option_id || opt?.tag_option_id || '').trim(),
                          option_name: String(
                              opt?.option_name || opt?.tag_option_name || '',
                          ).trim(),
                          depth: Number(opt?.depth) || 0,
                      })).filter((opt) => opt.option_id)
                    : [],
            };
        })
        .filter(Boolean);
}

function groupAccountOptions(accounts) {
    const groups = new Map();
    accounts.forEach((account) => {
        const groupLabel = account.type || 'Other';
        if (!groups.has(groupLabel)) groups.set(groupLabel, []);
        groups.get(groupLabel).push({
            value: account.id,
            label: account.code ? `${account.name} (${account.code})` : account.name,
        });
    });
    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, options]) => ({
            label,
            options: options.sort((a, b) => a.label.localeCompare(b.label)),
        }));
}

export default function NewExpensePage() {
    const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [paidThroughAccounts, setPaidThroughAccounts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [taxes, setTaxes] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [reportingTags, setReportingTags] = useState([]);
    const [tagSelections, setTagSelections] = useState({});
    const [tagsModalOpen, setTagsModalOpen] = useState(false);
    const [isItemized, setIsItemized] = useState(false);
    const [lines, setLines] = useState(() => [emptyLine()]);
    const [receipts, setReceipts] = useState([]);
    const [form, setForm] = useState(() => emptyForm());

    const loadSupport = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [supportRes, vendorRes, customerRes] = await Promise.all([
                axiosInstance.get('/zoho/expenses/support', {
                    skipToast: true,
                    timeout: 120000,
                }),
                axiosInstance.get('/zoho/vendors', {
                    skipToast: true,
                    timeout: 120000,
                    params: { sync: 'false' },
                }),
                axiosInstance.get('/zoho/customers', {
                    skipToast: true,
                    timeout: 120000,
                    params: { sync: 'false' },
                }),
            ]);

            const support = supportRes?.data?.data || {};
            const mappedLocations = mapZohoLocations(support.locations);
            const primary = mappedLocations.find((l) => l.isPrimary) || mappedLocations[0];
            const mappedAccounts = mapZohoPaymentAccounts(support.accounts);
            const mappedPaidThrough = mapZohoPaymentAccounts(
                support.paidThroughAccounts || support.accounts,
            );
            const mappedTaxes = mapZohoTaxes(support.taxes);
            const mappedVendors = mapZohoVendors(vendorRes?.data?.data);
            const mappedCustomers = mapZohoCustomerListRows(customerRes?.data?.data).filter(
                (c) => c.id,
            );
            const mappedTags = mapReportingTags(
                support.reportingTags || support.reporting_tags,
            );

            setAccounts(mappedAccounts);
            setPaidThroughAccounts(mappedPaidThrough);
            setLocations(mappedLocations);
            setTaxes(mappedTaxes);
            setVendors(mappedVendors);
            setCustomers(mappedCustomers);
            setReportingTags(mappedTags);
            setForm((prev) =>
                emptyForm({
                    ...prev,
                    locationId: prev.locationId || primary?.id || '',
                    locationName: prev.locationName || primary?.name || '',
                    taxTreatment: prev.taxTreatment || 'vat_registered',
                    placeOfSupply: prev.placeOfSupply || 'DU',
                }),
            );
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load form data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSupport();
    }, [loadSupport]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (!(event.altKey || event.metaKey)) return;
            const key = String(event.key || '').toLowerCase();
            if (key === 's') {
                event.preventDefault();
                document.getElementById('expense-save-btn')?.click();
            }
            if (key === 'n') {
                event.preventDefault();
                document.getElementById('expense-save-new-btn')?.click();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const setField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const locationOptions = useMemo(
        () => locations.map((l) => ({ value: l.id, label: l.name })),
        [locations],
    );
    const accountOptions = useMemo(() => groupAccountOptions(accounts), [accounts]);
    const paidThroughOptions = useMemo(
        () => groupAccountOptions(paidThroughAccounts),
        [paidThroughAccounts],
    );
    const taxOptions = useMemo(
        () => taxes.map((t) => ({ value: t.id, label: t.label })),
        [taxes],
    );
    const vendorOptions = useMemo(
        () => vendors.map((v) => ({ value: v.id, label: v.label })),
        [vendors],
    );
    const customerOptions = useMemo(
        () =>
            customers.map((c) => ({
                value: c.id,
                label: c.companyName && c.companyName !== '—' ? `${c.name} (${c.companyName})` : c.name,
            })),
        [customers],
    );

    const flatAccountOptions = useMemo(
        () => accountOptions.flatMap((g) => g.options || []),
        [accountOptions],
    );
    const flatPaidThroughOptions = useMemo(
        () => paidThroughOptions.flatMap((g) => g.options || []),
        [paidThroughOptions],
    );

    const itemizedTotal = useMemo(
        () =>
            Number(
                lines
                    .reduce((sum, line) => {
                        const value = Number(line.amount);
                        return sum + (Number.isFinite(value) ? value : 0);
                    }, 0)
                    .toFixed(2),
            ),
        [lines],
    );

    const selectedTagChips = useMemo(() => {
        return reportingTags
            .map((tag) => {
                const optionId = tagSelections[tag.tag_id];
                if (!optionId) return null;
                const option = (tag.options || []).find((o) => o.option_id === optionId);
                if (!option) return null;
                return {
                    tagId: tag.tag_id,
                    tagName: tag.tag_name,
                    optionName: option.option_name,
                };
            })
            .filter(Boolean);
    }, [reportingTags, tagSelections]);

    const enableItemize = useCallback(() => {
        setLines([
            emptyLine({
                accountId: form.accountId || '',
                amount: form.amount || '',
                taxId: form.taxId || '',
                notes: '',
            }),
        ]);
        setIsItemized(true);
    }, [form.accountId, form.amount, form.taxId]);

    const removeItemization = useCallback(() => {
        const first = lines[0] || emptyLine();
        setForm((prev) => ({
            ...prev,
            accountId: first.accountId || prev.accountId,
            amount: first.amount || prev.amount,
            taxId: first.taxId || prev.taxId,
        }));
        setIsItemized(false);
        setLines([emptyLine()]);
    }, [lines]);

    const updateLine = useCallback((key, patch) => {
        setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    }, []);

    const removeLine = useCallback((key) => {
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
    }, []);

    const addLine = useCallback(() => {
        setLines((prev) => [...prev, emptyLine()]);
    }, []);

    const addReceiptFiles = useCallback(
        (fileList) => {
            const next = [];
            const rejected = [];
            Array.from(fileList || []).forEach((file) => {
                if (!file) return;
                if (file.size > MAX_RECEIPT_BYTES) {
                    rejected.push(file.name);
                    return;
                }
                next.push(file);
            });
            if (rejected.length) {
                toast({
                    title: 'File too large',
                    description: `${rejected.join(', ')} exceeds the 10MB limit.`,
                    variant: 'destructive',
                });
            }
            if (next.length) {
                setReceipts((prev) => [...prev, ...next]);
            }
        },
        [toast],
    );

    const resetForm = useCallback(() => {
        const primary = locations.find((l) => l.isPrimary) || locations[0];
        setForm(
            emptyForm({
                locationId: primary?.id || '',
                locationName: primary?.name || '',
            }),
        );
        setIsItemized(false);
        setLines([emptyLine()]);
        setTagSelections({});
        setReceipts([]);
        setError('');
    }, [locations]);

    const handleSubmit = async (event, { stay = false } = {}) => {
        event.preventDefault();
        if (saving) return;

        if (!form.paidThroughAccountId) {
            setError('Select a Paid Through account.');
            return;
        }
        if (!form.taxTreatment) {
            setError('Select a Tax Treatment.');
            return;
        }
        if (!form.placeOfSupply) {
            setError('Select a Place of Supply.');
            return;
        }

        const missingMandatoryTag = reportingTags.find(
            (tag) => tag.is_mandatory && !tagSelections[tag.tag_id],
        );
        if (missingMandatoryTag) {
            setError(`Select a value for reporting tag "${missingMandatoryTag.tag_name}".`);
            setTagsModalOpen(true);
            return;
        }

        const tagsPayload = Object.entries(tagSelections)
            .filter(([, optionId]) => optionId)
            .map(([tagId, optionId]) => ({
                tag_id: tagId,
                tag_option_id: optionId,
            }));

        let payload = {
            date: form.date,
            paid_through_account_id: form.paidThroughAccountId,
            vendor_id: form.vendorId || undefined,
            is_inclusive_tax: form.isInclusiveTax,
            tax_treatment: form.taxTreatment,
            place_of_supply: form.placeOfSupply,
            reference_number: form.referenceNumber,
            description: form.notes,
            location_id: form.locationId || undefined,
            customer_id: form.customerId || undefined,
            currency_code: form.currencyCode || 'AED',
            tags: tagsPayload.length ? tagsPayload : undefined,
        };

        if (isItemized) {
            const lineItems = lines
                .map((line) => ({
                    account_id: line.accountId,
                    description: String(line.notes || '').trim(),
                    amount: Number(line.amount),
                    tax_id: line.taxId || undefined,
                }))
                .filter((line) => line.account_id && Number.isFinite(line.amount) && line.amount > 0);

            if (!lineItems.length) {
                setError('Add at least one itemized line with an account and amount.');
                return;
            }
            payload = {
                ...payload,
                account_id: lineItems[0].account_id,
                amount: itemizedTotal,
                line_items: lineItems,
            };
        } else {
            if (!form.accountId) {
                setError('Select an expense account.');
                return;
            }
            const amount = Number(form.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                setError('Enter an amount greater than zero.');
                return;
            }
            payload = {
                ...payload,
                account_id: form.accountId,
                amount,
                tax_id: form.taxId || undefined,
            };
        }

        setSaving(true);
        setError('');
        try {
            await axiosInstance.post('/zoho/expenses', payload);

            toast({
                title: 'Expense created',
                description:
                    receipts.length > 0
                        ? 'Expense saved in Zoho Books. Attach receipts from Zoho if needed.'
                        : 'The expense was created in Zoho Books.',
            });

            if (stay) {
                resetForm();
            } else {
                router.push('/Accounts/Expenses');
            }
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
                        <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
                                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                                    Record Expense
                                </h2>
                            </div>

                            <form onSubmit={(e) => void handleSubmit(e, { stay: false })}>
                                <div className="px-4 sm:px-6 py-5">
                                    {error ? (
                                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            {error}
                                        </div>
                                    ) : null}

                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                                            <Loader2 size={18} className="animate-spin" />
                                            Loading Zoho data…
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-8">
                                            <div className="space-y-4 max-w-3xl">
                                                <FieldRow label={<FieldLabel>Location</FieldLabel>}>
                                                    <Select
                                                        instanceId="expense-location"
                                                        styles={selectStyles}
                                                        options={locationOptions}
                                                        value={
                                                            locationOptions.find(
                                                                (o) => o.value === form.locationId,
                                                            ) || null
                                                        }
                                                        onChange={(o) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                locationId: o?.value || '',
                                                                locationName: o?.label || '',
                                                            }))
                                                        }
                                                        isClearable
                                                        placeholder="Select location"
                                                        menuPortalTarget={
                                                            typeof document !== 'undefined'
                                                                ? document.body
                                                                : null
                                                        }
                                                    />
                                                </FieldRow>

                                                <FieldRow label={<RequiredLabel>Date</RequiredLabel>}>
                                                    <input
                                                        type="date"
                                                        value={form.date}
                                                        onChange={(e) => setField('date', e.target.value)}
                                                        className="h-9 w-full rounded border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                        required
                                                    />
                                                </FieldRow>

                                                {!isItemized ? (
                                                    <>
                                                        <FieldRow
                                                            alignTop
                                                            label={
                                                                <RequiredLabel>Expense Account</RequiredLabel>
                                                            }
                                                        >
                                                            <div className="space-y-1.5">
                                                                <Select
                                                                    instanceId="expense-account"
                                                                    styles={selectStyles}
                                                                    options={accountOptions}
                                                                    value={
                                                                        flatAccountOptions.find(
                                                                            (o) =>
                                                                                o.value ===
                                                                                form.accountId,
                                                                        ) || null
                                                                    }
                                                                    onChange={(o) =>
                                                                        setField(
                                                                            'accountId',
                                                                            o?.value || '',
                                                                        )
                                                                    }
                                                                    placeholder="Select an account"
                                                                    menuPortalTarget={
                                                                        typeof document !== 'undefined'
                                                                            ? document.body
                                                                            : null
                                                                    }
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                                                                    onClick={enableItemize}
                                                                >
                                                                    <List size={14} />
                                                                    Itemize
                                                                </button>
                                                            </div>
                                                        </FieldRow>

                                                        <FieldRow
                                                            label={<RequiredLabel>Amount</RequiredLabel>}
                                                        >
                                                            <div className="flex h-9 overflow-hidden rounded border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
                                                                <div className="w-[88px] border-r border-slate-300">
                                                                    <Select
                                                                        instanceId="expense-currency"
                                                                        styles={{
                                                                            ...selectStyles,
                                                                            control: (base) => ({
                                                                                ...selectStyles.control(
                                                                                    base,
                                                                                    {
                                                                                        isFocused: false,
                                                                                    },
                                                                                ),
                                                                                minHeight: 34,
                                                                                border: 'none',
                                                                                boxShadow: 'none',
                                                                                borderRadius: 0,
                                                                                backgroundColor:
                                                                                    '#f8fafc',
                                                                                '&:hover': {
                                                                                    border: 'none',
                                                                                },
                                                                            }),
                                                                            menuPortal: (base) => ({
                                                                                ...base,
                                                                                zIndex: 100000,
                                                                            }),
                                                                        }}
                                                                        options={CURRENCY_OPTIONS}
                                                                        value={
                                                                            CURRENCY_OPTIONS.find(
                                                                                (o) =>
                                                                                    o.value ===
                                                                                    form.currencyCode,
                                                                            ) || CURRENCY_OPTIONS[0]
                                                                        }
                                                                        onChange={(o) =>
                                                                            setField(
                                                                                'currencyCode',
                                                                                o?.value || 'AED',
                                                                            )
                                                                        }
                                                                        isSearchable={false}
                                                                        menuPortalTarget={
                                                                            typeof document !==
                                                                            'undefined'
                                                                                ? document.body
                                                                                : null
                                                                        }
                                                                    />
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    step="0.01"
                                                                    value={form.amount}
                                                                    onChange={(e) =>
                                                                        setField(
                                                                            'amount',
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                    className="min-w-0 flex-1 px-3 text-sm outline-none"
                                                                    required
                                                                />
                                                            </div>
                                                        </FieldRow>
                                                    </>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <RequiredLabel>Itemized Expenses</RequiredLabel>
                                                            <button
                                                                type="button"
                                                                className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                                                onClick={removeItemization}
                                                            >
                                                                Remove Itemization
                                                            </button>
                                                        </div>
                                                        <div className="overflow-x-auto rounded border border-slate-200">
                                                            <table className="min-w-[640px] w-full border-collapse text-sm">
                                                                <thead>
                                                                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                                        <th className="px-2 py-2">
                                                                            Expense Account
                                                                        </th>
                                                                        <th className="px-2 py-2">Notes</th>
                                                                        <th className="px-2 py-2 w-[120px]">
                                                                            Amount
                                                                        </th>
                                                                        <th className="px-2 py-2 w-[160px]">
                                                                            Tax
                                                                        </th>
                                                                        <th className="px-2 py-2 w-10" />
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {lines.map((line, index) => (
                                                                        <tr
                                                                            key={line.key}
                                                                            className="border-t border-slate-100"
                                                                        >
                                                                            <td className="px-2 py-2 align-top">
                                                                                <Select
                                                                                    instanceId={`expense-line-account-${line.key}`}
                                                                                    styles={selectStyles}
                                                                                    options={accountOptions}
                                                                                    value={
                                                                                        flatAccountOptions.find(
                                                                                            (o) =>
                                                                                                o.value ===
                                                                                                line.accountId,
                                                                                        ) || null
                                                                                    }
                                                                                    onChange={(o) =>
                                                                                        updateLine(
                                                                                            line.key,
                                                                                            {
                                                                                                accountId:
                                                                                                    o?.value ||
                                                                                                    '',
                                                                                            },
                                                                                        )
                                                                                    }
                                                                                    placeholder="Select an account"
                                                                                    menuPortalTarget={
                                                                                        typeof document !==
                                                                                        'undefined'
                                                                                            ? document.body
                                                                                            : null
                                                                                    }
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2 align-top">
                                                                                <input
                                                                                    type="text"
                                                                                    value={line.notes}
                                                                                    onChange={(e) =>
                                                                                        updateLine(
                                                                                            line.key,
                                                                                            {
                                                                                                notes: e
                                                                                                    .target
                                                                                                    .value,
                                                                                            },
                                                                                        )
                                                                                    }
                                                                                    placeholder="Notes"
                                                                                    className="h-9 w-full rounded border border-slate-300 px-2 text-sm outline-none focus:border-blue-500"
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2 align-top">
                                                                                <input
                                                                                    type="number"
                                                                                    min="0.01"
                                                                                    step="0.01"
                                                                                    value={line.amount}
                                                                                    onChange={(e) =>
                                                                                        updateLine(
                                                                                            line.key,
                                                                                            {
                                                                                                amount: e
                                                                                                    .target
                                                                                                    .value,
                                                                                            },
                                                                                        )
                                                                                    }
                                                                                    className="h-9 w-full rounded border border-slate-300 px-2 text-sm outline-none focus:border-blue-500"
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2 align-top">
                                                                                <Select
                                                                                    instanceId={`expense-line-tax-${line.key}`}
                                                                                    styles={selectStyles}
                                                                                    options={taxOptions}
                                                                                    value={
                                                                                        taxOptions.find(
                                                                                            (o) =>
                                                                                                o.value ===
                                                                                                line.taxId,
                                                                                        ) || null
                                                                                    }
                                                                                    onChange={(o) =>
                                                                                        updateLine(
                                                                                            line.key,
                                                                                            {
                                                                                                taxId:
                                                                                                    o?.value ||
                                                                                                    '',
                                                                                            },
                                                                                        )
                                                                                    }
                                                                                    isClearable
                                                                                    placeholder="Tax"
                                                                                    menuPortalTarget={
                                                                                        typeof document !==
                                                                                        'undefined'
                                                                                            ? document.body
                                                                                            : null
                                                                                    }
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2 align-top">
                                                                                <button
                                                                                    type="button"
                                                                                    className="inline-flex h-9 w-8 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                                                                    onClick={() =>
                                                                                        removeLine(line.key)
                                                                                    }
                                                                                    disabled={
                                                                                        lines.length <= 1
                                                                                    }
                                                                                    aria-label={`Remove line ${index + 1}`}
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={addLine}
                                                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                                            >
                                                                <Plus size={14} />
                                                                Add New Line
                                                            </button>
                                                            <div className="text-sm font-semibold text-slate-800 tabular-nums">
                                                                Total: {form.currencyCode || 'AED'}{' '}
                                                                {itemizedTotal.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <FieldRow label={<FieldLabel>Amount Is</FieldLabel>}>
                                                    <div className="flex flex-wrap items-center gap-5 text-sm text-slate-700">
                                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="amountIs"
                                                                checked={form.isInclusiveTax === true}
                                                                onChange={() =>
                                                                    setField('isInclusiveTax', true)
                                                                }
                                                                className="h-4 w-4 accent-blue-600"
                                                            />
                                                            Tax Inclusive
                                                        </label>
                                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="amountIs"
                                                                checked={form.isInclusiveTax === false}
                                                                onChange={() =>
                                                                    setField('isInclusiveTax', false)
                                                                }
                                                                className="h-4 w-4 accent-blue-600"
                                                            />
                                                            Tax Exclusive
                                                        </label>
                                                    </div>
                                                </FieldRow>

                                                <FieldRow
                                                    label={<RequiredLabel>Paid Through</RequiredLabel>}
                                                >
                                                    <Select
                                                        instanceId="expense-paid-through"
                                                        styles={selectStyles}
                                                        options={paidThroughOptions}
                                                        value={
                                                            flatPaidThroughOptions.find(
                                                                (o) =>
                                                                    o.value ===
                                                                    form.paidThroughAccountId,
                                                            ) || null
                                                        }
                                                        onChange={(o) =>
                                                            setField(
                                                                'paidThroughAccountId',
                                                                o?.value || '',
                                                            )
                                                        }
                                                        placeholder="Select an account"
                                                        menuPortalTarget={
                                                            typeof document !== 'undefined'
                                                                ? document.body
                                                                : null
                                                        }
                                                    />
                                                </FieldRow>

                                                <FieldRow label={<FieldLabel>Vendor</FieldLabel>}>
                                                    <Select
                                                        instanceId="expense-vendor"
                                                        styles={selectStyles}
                                                        options={vendorOptions}
                                                        value={
                                                            vendorOptions.find(
                                                                (o) => o.value === form.vendorId,
                                                            ) || null
                                                        }
                                                        onChange={(o) =>
                                                            setField('vendorId', o?.value || '')
                                                        }
                                                        isClearable
                                                        placeholder="Select a Vendor"
                                                        menuPortalTarget={
                                                            typeof document !== 'undefined'
                                                                ? document.body
                                                                : null
                                                        }
                                                    />
                                                </FieldRow>

                                                <FieldRow
                                                    label={<RequiredLabel>Tax Treatment</RequiredLabel>}
                                                >
                                                    <Select
                                                        instanceId="expense-tax-treatment"
                                                        styles={selectStyles}
                                                        options={TAX_TREATMENT_OPTIONS}
                                                        value={
                                                            TAX_TREATMENT_OPTIONS.find(
                                                                (o) => o.value === form.taxTreatment,
                                                            ) || null
                                                        }
                                                        onChange={(o) =>
                                                            setField('taxTreatment', o?.value || '')
                                                        }
                                                        placeholder="Select tax treatment"
                                                        menuPortalTarget={
                                                            typeof document !== 'undefined'
                                                                ? document.body
                                                                : null
                                                        }
                                                    />
                                                </FieldRow>

                                                <FieldRow
                                                    label={<RequiredLabel>Place of Supply</RequiredLabel>}
                                                >
                                                    <Select
                                                        instanceId="expense-place-of-supply"
                                                        styles={selectStyles}
                                                        options={PLACE_OF_SUPPLY_OPTIONS}
                                                        value={
                                                            PLACE_OF_SUPPLY_OPTIONS.find(
                                                                (o) => o.value === form.placeOfSupply,
                                                            ) || null
                                                        }
                                                        onChange={(o) =>
                                                            setField('placeOfSupply', o?.value || '')
                                                        }
                                                        placeholder="Select place of supply"
                                                        menuPortalTarget={
                                                            typeof document !== 'undefined'
                                                                ? document.body
                                                                : null
                                                        }
                                                    />
                                                </FieldRow>

                                                {!isItemized ? (
                                                    <FieldRow label={<FieldLabel>Tax</FieldLabel>}>
                                                        <Select
                                                            instanceId="expense-tax"
                                                            styles={selectStyles}
                                                            options={taxOptions}
                                                            value={
                                                                taxOptions.find(
                                                                    (o) => o.value === form.taxId,
                                                                ) || null
                                                            }
                                                            onChange={(o) =>
                                                                setField('taxId', o?.value || '')
                                                            }
                                                            isClearable
                                                            placeholder="Select a Tax"
                                                            menuPortalTarget={
                                                                typeof document !== 'undefined'
                                                                    ? document.body
                                                                    : null
                                                            }
                                                        />
                                                    </FieldRow>
                                                ) : null}

                                                <FieldRow label={<FieldLabel>Reference#</FieldLabel>}>
                                                    <input
                                                        type="text"
                                                        value={form.referenceNumber}
                                                        onChange={(e) =>
                                                            setField('referenceNumber', e.target.value)
                                                        }
                                                        className="h-9 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                    />
                                                </FieldRow>

                                                <FieldRow
                                                    alignTop
                                                    label={<FieldLabel>Notes</FieldLabel>}
                                                >
                                                    <div>
                                                        <textarea
                                                            value={form.notes}
                                                            maxLength={MAX_NOTES}
                                                            onChange={(e) =>
                                                                setField('notes', e.target.value)
                                                            }
                                                            rows={3}
                                                            placeholder="Max. 500 characters"
                                                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                        />
                                                        <div className="mt-1 text-right text-[11px] text-slate-400">
                                                            {form.notes.length}/{MAX_NOTES}
                                                        </div>
                                                    </div>
                                                </FieldRow>

                                                <FieldRow
                                                    label={<RequiredLabel>Serial No:</RequiredLabel>}
                                                >
                                                    <input
                                                        type="text"
                                                        value={form.serialNo}
                                                        readOnly
                                                        placeholder="Auto-generated on save"
                                                        className="h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 outline-none"
                                                    />
                                                </FieldRow>

                                                <FieldRow label={<FieldLabel>Customer Name</FieldLabel>}>
                                                    <div className="flex gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <Select
                                                                instanceId="expense-customer"
                                                                styles={selectStyles}
                                                                options={customerOptions}
                                                                value={
                                                                    customerOptions.find(
                                                                        (o) =>
                                                                            o.value === form.customerId,
                                                                    ) || null
                                                                }
                                                                onChange={(o) =>
                                                                    setField(
                                                                        'customerId',
                                                                        o?.value || '',
                                                                    )
                                                                }
                                                                isClearable
                                                                placeholder="Select or add a customer"
                                                                menuPortalTarget={
                                                                    typeof document !== 'undefined'
                                                                        ? document.body
                                                                        : null
                                                                }
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                                                            aria-label="Search customer"
                                                            onClick={() =>
                                                                toast({
                                                                    title: 'Customer search',
                                                                    description:
                                                                        'Use the customer dropdown to search and select.',
                                                                })
                                                            }
                                                        >
                                                            <Search size={16} />
                                                        </button>
                                                    </div>
                                                </FieldRow>

                                                <FieldRow
                                                    alignTop
                                                    label={<FieldLabel>Reporting Tags</FieldLabel>}
                                                >
                                                    <div className="space-y-2">
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                                                            onClick={() => setTagsModalOpen(true)}
                                                        >
                                                            <Tags size={14} />
                                                            Associate Tags
                                                        </button>
                                                        {selectedTagChips.length ? (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {selectedTagChips.map((chip) => (
                                                                    <span
                                                                        key={chip.tagId}
                                                                        className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                                                                    >
                                                                        {chip.tagName}: {chip.optionName}
                                                                        <button
                                                                            type="button"
                                                                            className="text-blue-500 hover:text-blue-700"
                                                                            aria-label={`Remove ${chip.tagName}`}
                                                                            onClick={() =>
                                                                                setTagSelections(
                                                                                    (prev) => {
                                                                                        const next = {
                                                                                            ...prev,
                                                                                        };
                                                                                        delete next[
                                                                                            chip.tagId
                                                                                        ];
                                                                                        return next;
                                                                                    },
                                                                                )
                                                                            }
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </FieldRow>
                                            </div>

                                            <div className="xl:pt-1">
                                                <div
                                                    className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center"
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        addReceiptFiles(e.dataTransfer.files);
                                                    }}
                                                >
                                                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                                        <ImageIcon size={36} strokeWidth={1.25} />
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-700">
                                                        Drag or Drop your Receipts
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Maximum file size allowed is 10MB
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="mt-5 inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                    >
                                                        <CloudUpload size={16} className="text-slate-500" />
                                                        Upload your Files
                                                    </button>
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        multiple
                                                        accept="image/*,.pdf"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            addReceiptFiles(e.target.files);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                    {receipts.length > 0 ? (
                                                        <ul className="mt-4 w-full space-y-1 text-left text-xs text-slate-600">
                                                            {receipts.map((file, index) => (
                                                                <li
                                                                    key={`${file.name}-${index}`}
                                                                    className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 border border-slate-200"
                                                                >
                                                                    <span className="truncate">
                                                                        {file.name}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="shrink-0 text-red-500 hover:text-red-600"
                                                                        onClick={() =>
                                                                            setReceipts((prev) =>
                                                                                prev.filter(
                                                                                    (_, i) =>
                                                                                        i !== index,
                                                                                ),
                                                                            )
                                                                        }
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-200 bg-white px-4 sm:px-6 py-4">
                                    <button
                                        id="expense-save-btn"
                                        type="submit"
                                        disabled={loading || saving}
                                        className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                        Save
                                        <span className="hidden sm:inline font-normal opacity-90">
                                            (Alt+S)
                                        </span>
                                    </button>
                                    <button
                                        id="expense-save-new-btn"
                                        type="button"
                                        disabled={loading || saving}
                                        onClick={(e) => void handleSubmit(e, { stay: true })}
                                        className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        Save and New
                                        <span className="hidden sm:inline font-normal text-slate-500">
                                            {' '}
                                            (Alt+N)
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push('/Accounts/Expenses')}
                                        className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

            <AssociateTagsModal
                open={tagsModalOpen}
                tags={reportingTags}
                selections={tagSelections}
                onClose={() => setTagsModalOpen(false)}
                onApply={(next) => {
                    setTagSelections(next || {});
                    setTagsModalOpen(false);
                }}
            />
        </PermissionGuard>
    );
}
