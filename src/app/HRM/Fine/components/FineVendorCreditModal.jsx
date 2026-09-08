'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import { mapZohoVendors } from '@/utils/zohoVendors';
import { mapZohoLocations, mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 36,
        borderRadius: 4,
        borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
        boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
        backgroundColor: '#fff',
        fontSize: '13px',
        '&:hover': { borderColor: state.isFocused ? '#3b82f6' : '#9ca3af' },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 100000 }),
    option: (base, state) => ({
        ...base,
        fontSize: '13px',
        backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : '#fff',
        color: state.isSelected ? '#fff' : '#111827',
    }),
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
];

function mapZohoTaxes(taxes) {
    if (!Array.isArray(taxes)) return [];
    return taxes
        .map((tax) => {
            const id = String(tax?.tax_id || tax?.id || '').trim();
            if (!id) return null;
            const name = String(tax?.tax_name || tax?.name || '').trim() || id;
            const percent = Number(tax?.tax_percentage ?? tax?.percentage);
            const safePercent = Number.isFinite(percent) ? percent : 0;
            return {
                value: id,
                label: `${name} [${safePercent}%]`,
                percent: safePercent,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label));
}

function groupAccountOptions(accounts) {
    const groups = new Map();
    (Array.isArray(accounts) ? accounts : []).forEach((account) => {
        const groupLabel = account.type || 'Other';
        if (!groups.has(groupLabel)) groups.set(groupLabel, []);
        groups.get(groupLabel).push({
            value: account.id,
            label: account.code
                ? `${account.name || account.label || account.id} (${account.code})`
                : account.name || account.label || account.id,
            name: account.name || account.label || '',
        });
    });
    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, options]) => ({
            label,
            options: options.sort((a, b) => a.label.localeCompare(b.label)),
        }));
}

function flattenAccountOptions(grouped) {
    return (Array.isArray(grouped) ? grouped : []).flatMap((g) => g.options || []);
}

function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function money(value) {
    return (Number(value) || 0).toFixed(2);
}

function taxPercentOf(taxes, taxId) {
    const match = (Array.isArray(taxes) ? taxes : []).find((t) => t.value === taxId);
    return Number(match?.percent) || 0;
}

function lineBase(row) {
    return (Number(row?.quantity) || 0) * (Number(row?.rate) || 0);
}

function computeTotals({ lines, taxes, taxLevel, isInclusive, discountPercent, transactionTaxId }) {
    const subTotal = (Array.isArray(lines) ? lines : []).reduce((sum, row) => sum + lineBase(row), 0);
    const discount = subTotal * ((Number(discountPercent) || 0) / 100);
    const afterDiscount = Math.max(0, subTotal - discount);

    let tax = 0;
    if (taxLevel === 'transaction') {
        const percent = taxPercentOf(taxes, transactionTaxId);
        tax = isInclusive
            ? afterDiscount - afterDiscount / (1 + percent / 100)
            : afterDiscount * (percent / 100);
    } else {
        (Array.isArray(lines) ? lines : []).forEach((row) => {
            const base = lineBase(row);
            const share = subTotal > 0 ? base / subTotal : 0;
            const rowAfterDiscount = Math.max(0, base - discount * share);
            const percent = taxPercentOf(taxes, row.taxId);
            tax += isInclusive
                ? rowAfterDiscount - rowAfterDiscount / (1 + percent / 100)
                : rowAfterDiscount * (percent / 100);
        });
    }

    return {
        subTotal,
        discount,
        tax,
        total: isInclusive ? afterDiscount : afterDiscount + tax,
    };
}

function newLine({ description = '', accountId = '', rate = '', taxId = '' } = {}) {
    return {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description,
        accountId,
        quantity: '1.00',
        rate: rate === '' ? '' : money(rate),
        taxId,
    };
}

const defaultGetFineBalance = (fine) =>
    Math.max(0, Number(fine?.balance || fine?.fineAmount || 0) - (Number(fine?.paidAmount) || 0));

export default function FineVendorCreditModal({
    isOpen,
    onClose,
    onSuccess,
    fine = null,
    employeeId = '',
    getFineBalance = defaultGetFineBalance,
}) {
    const { toast } = useToast();
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

    const [date, setDate] = useState(todayInputValue());
    const [vendorId, setVendorId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [warehouseLocationId, setWarehouseLocationId] = useState('');
    const [creditNoteNumber, setCreditNoteNumber] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [taxTreatment, setTaxTreatment] = useState('vat_registered');
    const [placeOfSupply, setPlaceOfSupply] = useState('DU');
    const [isInclusiveTax, setIsInclusiveTax] = useState(false);
    const [taxLevel, setTaxLevel] = useState('transaction');
    const [transactionTaxId, setTransactionTaxId] = useState('');
    const [discountPercent, setDiscountPercent] = useState('0');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState(() => [newLine()]);
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [taxes, setTaxes] = useState([]);
    const [loadingLists, setLoadingLists] = useState(false);
    const [saving, setSaving] = useState(false);

    const balance = fine ? Math.max(0, Number(getFineBalance(fine)) || 0) : 0;

    useEffect(() => {
        if (!isOpen || !fine) return;
        const description = `Fine ${fine.fineId || ''} · ${fine.fineType || ''}`.trim();
        setDate(todayInputValue());
        setVendorId(String(fine.zohoVendorId || '').trim());
        setCreditNoteNumber('');
        setOrderNumber(String(fine.fineId || '').trim());
        setTaxTreatment('vat_registered');
        setPlaceOfSupply('DU');
        setIsInclusiveTax(false);
        setTaxLevel('transaction');
        setTransactionTaxId('');
        setDiscountPercent('0');
        setNotes('');
        setLines([
            newLine({
                description,
                accountId: String(fine.expenseAccountId || '').trim(),
                rate: balance,
            }),
        ]);
    }, [isOpen, fine, balance]);

    const loadLists = useCallback(async () => {
        if (!organizationId) return;
        setLoadingLists(true);
        try {
            const [accountsRes, taxRes, localVendorsRes] = await Promise.all([
                axiosInstance.get('/zoho/vendorpayments/support', {
                    params: { organizationId, accountsOnly: 'true', includeInactive: 'true' },
                    skipToast: true,
                    timeout: 120000,
                }),
                axiosInstance.get('/zoho/expenses/support', {
                    params: { organizationId },
                    skipToast: true,
                    timeout: 90000,
                }),
                axiosInstance.get('/zoho/vendors', {
                    params: { organizationId, sync: 'false' },
                    skipToast: true,
                    timeout: 120000,
                }),
            ]);

            setAccounts(mapZohoPaymentAccounts(accountsRes?.data?.data?.accounts));
            const taxSupport = taxRes?.data?.data || {};
            const mappedLocations = mapZohoLocations(taxSupport.locations);
            setLocations(mappedLocations);
            setTaxes(mapZohoTaxes(taxSupport.taxes));

            const preferredLocation =
                mappedLocations.find((l) => /vega\s*dxb/i.test(l.name)) ||
                mappedLocations.find((l) => l.isPrimary) ||
                mappedLocations[0];
            setLocationId((prev) => prev || preferredLocation?.id || '');
            setWarehouseLocationId((prev) => prev || preferredLocation?.id || '');

            let mappedVendors = mapZohoVendors(localVendorsRes?.data?.data);
            let zohoPage = 1;
            for (let guard = 0; guard < 40; guard += 1) {
                const response = await axiosInstance.get('/zoho/vendors', {
                    params: { organizationId, sync: 'true', zohoPage, chunkLimit: 400 },
                    skipToast: true,
                    timeout: 120000,
                });
                const meta = response?.data?.meta || {};
                if (!meta.hasMore) break;
                zohoPage = Number(meta.nextZohoPage) || zohoPage + 1;
            }
            const refreshed = await axiosInstance.get('/zoho/vendors', {
                params: { organizationId, sync: 'false' },
                skipToast: true,
                timeout: 120000,
            });
            mappedVendors = mapZohoVendors(refreshed?.data?.data);
            setVendors(mappedVendors);

            const preferredVendorId = String(fine?.zohoVendorId || '').trim();
            const preferredVendorName = String(fine?.zohoVendorName || fine?.fineSource || '').trim();
            const matched =
                mappedVendors.find((v) => v.id === preferredVendorId) ||
                mappedVendors.find(
                    (v) =>
                        preferredVendorName &&
                        String(v.label || '').toLowerCase() === preferredVendorName.toLowerCase(),
                );
            if (matched?.id) setVendorId(matched.id);
        } catch (err) {
            setAccounts([]);
            setLocations([]);
            setTaxes([]);
            setVendors([]);
            toast({
                variant: 'destructive',
                title: 'Zoho lists failed',
                description: err?.response?.data?.message || err?.message || 'Could not load Zoho data.',
            });
        } finally {
            setLoadingLists(false);
        }
    }, [organizationId, fine?.zohoVendorId, fine?.zohoVendorName, fine?.fineSource, toast]);

    useEffect(() => {
        if (!isOpen || !organizationId) return undefined;
        void loadLists();
        return undefined;
    }, [isOpen, organizationId, loadLists]);

    const vendorOptions = useMemo(
        () => vendors.map((v) => ({ value: v.id, label: v.label })),
        [vendors],
    );
    const locationOptions = useMemo(
        () => locations.map((l) => ({ value: l.id, label: l.name })),
        [locations],
    );
    const accountOptions = useMemo(() => groupAccountOptions(accounts), [accounts]);
    const flatAccounts = useMemo(() => flattenAccountOptions(accountOptions), [accountOptions]);
    const selectedVendor = vendorOptions.find((o) => o.value === vendorId) || null;
    const selectedLocation = locationOptions.find((o) => o.value === locationId) || null;
    const selectedWarehouse =
        locationOptions.find((o) => o.value === warehouseLocationId) || selectedLocation;
    const selectedTransactionTax = taxes.find((t) => t.value === transactionTaxId) || null;

    const totals = useMemo(
        () =>
            computeTotals({
                lines,
                taxes,
                taxLevel,
                isInclusive: isInclusiveTax,
                discountPercent,
                transactionTaxId,
            }),
        [lines, taxes, taxLevel, isInclusiveTax, discountPercent, transactionTaxId],
    );

    const updateLine = (key, patch) => {
        setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    };

    const handleSave = async () => {
        if (!fine?._id && !fine?.fineId) {
            toast({ variant: 'destructive', title: 'Fine missing', description: 'Open a fine first.' });
            return;
        }
        if (!vendorId) {
            toast({ variant: 'destructive', title: 'Vendor required', description: 'Select a Zoho vendor.' });
            return;
        }
        if (!date) {
            toast({ variant: 'destructive', title: 'Date required', description: 'Vendor Credit Date is required.' });
            return;
        }
        if (!locationId) {
            toast({ variant: 'destructive', title: 'Location required', description: 'Select Location.' });
            return;
        }
        const incomplete = lines.filter(
            (row) => !String(row.accountId || '').trim() || !(Number(row.rate) >= 0) || !(Number(row.quantity) > 0),
        );
        if (incomplete.length > 0 || lines.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Line items required',
                description: 'Each row needs Account, Quantity, and Rate.',
            });
            return;
        }
        if (taxLevel === 'transaction' && !transactionTaxId) {
            toast({ variant: 'destructive', title: 'Tax required', description: 'Select a Tax.' });
            return;
        }
        if (taxLevel === 'line' && lines.some((row) => !row.taxId)) {
            toast({ variant: 'destructive', title: 'Tax required', description: 'Select a Tax on every line.' });
            return;
        }
        if (!organizationId) {
            toast({
                variant: 'destructive',
                title: 'Organization required',
                description: 'Select VEGA or NNIT Zoho organization.',
            });
            return;
        }

        const firstAccount = flatAccounts.find((a) => a.value === lines[0].accountId);
        const lineItems = lines.map((row) => ({
            account_id: row.accountId,
            name: row.description || `Fine ${fine.fineId || ''}`,
            description: row.description || `Fine ${fine.fineId || ''}`,
            quantity: Number(row.quantity) || 1,
            rate: Number(row.rate) || 0,
            tax_id: taxLevel === 'transaction' ? transactionTaxId : row.taxId,
        }));

        setSaving(true);
        try {
            const targetId = fine._id || fine.fineId;
            const res = await axiosInstance.post(`/Fine/${targetId}/vendor-credit`, {
                zohoOrganizationId: organizationId,
                employeeId,
                vendor_id: vendorId,
                vendorId,
                vendorName: selectedVendor?.label || '',
                date,
                location_id: locationId,
                locationId,
                reference_number: orderNumber,
                vendor_credit_number: creditNoteNumber,
                notes,
                tax_treatment: taxTreatment,
                taxTreatment,
                place_of_supply: placeOfSupply,
                placeOfSupply,
                is_inclusive_tax: isInclusiveTax,
                isInclusiveTax,
                tax_id: taxLevel === 'transaction' ? transactionTaxId : lines[0].taxId,
                discount_percent: Number(discountPercent) || 0,
                discount: totals.discount,
                amount: totals.total,
                expenseAccountId: lines[0].accountId,
                expenseAccountName: firstAccount?.name || firstAccount?.label || '',
                line_items: lineItems,
            });

            toast({
                title: 'Vendor credit created',
                description:
                    res?.data?.message ||
                    `Zoho Vendor Credit ${res?.data?.zohoSync?.vendorCreditNumber || ''} is Open.`,
            });
            onSuccess?.();
            onClose?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Vendor credit failed',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Could not create the Zoho vendor credit. Reconnect Zoho if vendorcredits scope is missing.',
            });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const labelClass = 'block text-[12px] font-semibold text-red-600 mb-1';
    const labelMuted = 'block text-[12px] font-semibold text-gray-600 mb-1';
    const inputClass =
        'w-full h-9 px-3 border border-gray-300 rounded text-[13px] text-gray-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-black/45">
            <div className="absolute inset-0" onClick={() => !saving && onClose?.()} aria-hidden />
            <div className="relative w-full max-w-[980px] max-h-[94vh] bg-white rounded-md shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
                    <h2 className="text-[16px] font-semibold text-gray-800">New Vendor Credits</h2>
                    <button
                        type="button"
                        onClick={() => !saving && onClose?.()}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
                    {(showZohoOrgPicker || activeZohoOrg) && (
                        <div className="flex justify-end">
                            <ZohoOrganizationPicker
                                options={zohoOrgOptions}
                                value={organizationId}
                                onChange={setOrganizationId}
                                loading={zohoOrgLoading || loadingLists}
                                size="sm"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                        <div>
                            <label className={labelClass}>Vendor Name*</label>
                            <Select
                                instanceId="vc-vendor"
                                value={selectedVendor}
                                onChange={(opt) => setVendorId(opt?.value ? String(opt.value) : '')}
                                options={vendorOptions}
                                isLoading={loadingLists}
                                isSearchable
                                placeholder={loadingLists ? 'Loading vendors…' : 'Select a Vendor'}
                                styles={selectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Credit Note#</label>
                            <input
                                value={creditNoteNumber}
                                onChange={(e) => setCreditNoteNumber(e.target.value)}
                                className={inputClass}
                                placeholder="Auto from Zoho"
                            />
                        </div>
                        <div>
                            <label className={labelMuted}>Location</label>
                            <Select
                                instanceId="vc-location"
                                value={selectedLocation}
                                onChange={(opt) => {
                                    const next = opt?.value ? String(opt.value) : '';
                                    setLocationId(next);
                                    setWarehouseLocationId((prev) => prev || next);
                                }}
                                options={locationOptions}
                                isLoading={loadingLists}
                                isSearchable
                                placeholder="Select location"
                                styles={selectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                            />
                        </div>
                        <div>
                            <label className={labelMuted}>Order Number</label>
                            <input
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelMuted}>Warehouse Location</label>
                            <Select
                                instanceId="vc-warehouse"
                                value={selectedWarehouse}
                                onChange={(opt) =>
                                    setWarehouseLocationId(opt?.value ? String(opt.value) : '')
                                }
                                options={locationOptions}
                                isLoading={loadingLists}
                                isSearchable
                                placeholder="Select warehouse"
                                styles={selectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Vendor Credit Date*</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={inputClass}
                            />
                            <p className="text-[11px] text-gray-400 mt-1">{formatDisplayDate(date)}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[12px]">
                        <select
                            value={isInclusiveTax ? 'inclusive' : 'exclusive'}
                            onChange={(e) => setIsInclusiveTax(e.target.value === 'inclusive')}
                            className="h-8 border border-gray-300 rounded px-2 bg-white"
                        >
                            <option value="exclusive">Tax Exclusive</option>
                            <option value="inclusive">Tax Inclusive</option>
                        </select>
                        <select
                            value={taxLevel}
                            onChange={(e) => setTaxLevel(e.target.value)}
                            className="h-8 border border-gray-300 rounded px-2 bg-white"
                        >
                            <option value="transaction">At Transaction Level</option>
                            <option value="line">At Line Item Level</option>
                        </select>
                        <Select
                            className="min-w-[220px]"
                            instanceId="vc-vat-treatment"
                            value={TAX_TREATMENT_OPTIONS.find((o) => o.value === taxTreatment)}
                            onChange={(opt) => setTaxTreatment(opt?.value || 'vat_registered')}
                            options={TAX_TREATMENT_OPTIONS}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                        <Select
                            className="min-w-[180px]"
                            instanceId="vc-pos"
                            value={PLACE_OF_SUPPLY_OPTIONS.find((o) => o.value === placeOfSupply)}
                            onChange={(opt) => setPlaceOfSupply(opt?.value || 'DU')}
                            options={PLACE_OF_SUPPLY_OPTIONS}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                    </div>

                    <div className="overflow-x-auto border border-gray-200 rounded">
                        <table className="w-full min-w-[820px] text-[12px]">
                            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="text-left px-2 py-2 font-semibold">Item Details</th>
                                    <th className="text-left px-2 py-2 font-semibold">Account</th>
                                    <th className="text-right px-2 py-2 font-semibold w-[90px]">Quantity</th>
                                    <th className="text-right px-2 py-2 font-semibold w-[110px]">Rate</th>
                                    <th className="text-left px-2 py-2 font-semibold w-[180px]">Tax</th>
                                    <th className="text-right px-2 py-2 font-semibold w-[100px]">Amount</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((row) => {
                                    const accountValue =
                                        flatAccounts.find((a) => a.value === row.accountId) || null;
                                    const taxValue =
                                        taxLevel === 'transaction'
                                            ? selectedTransactionTax
                                            : taxes.find((t) => t.value === row.taxId) || null;
                                    return (
                                        <tr key={row.key} className="border-t border-gray-100 align-top">
                                            <td className="p-2">
                                                <input
                                                    value={row.description}
                                                    onChange={(e) =>
                                                        updateLine(row.key, { description: e.target.value })
                                                    }
                                                    className={inputClass}
                                                    placeholder="Type item details"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <Select
                                                    instanceId={`vc-account-${row.key}`}
                                                    value={accountValue}
                                                    onChange={(opt) =>
                                                        updateLine(row.key, {
                                                            accountId: opt?.value ? String(opt.value) : '',
                                                        })
                                                    }
                                                    options={accountOptions}
                                                    isLoading={loadingLists}
                                                    isSearchable
                                                    placeholder="Select an account"
                                                    styles={selectStyles}
                                                    menuPortalTarget={
                                                        typeof document !== 'undefined' ? document.body : null
                                                    }
                                                    menuPosition="fixed"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={row.quantity}
                                                    onChange={(e) =>
                                                        updateLine(row.key, { quantity: e.target.value })
                                                    }
                                                    className={`${inputClass} text-right`}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={row.rate}
                                                    onChange={(e) =>
                                                        updateLine(row.key, { rate: e.target.value })
                                                    }
                                                    className={`${inputClass} text-right`}
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <Select
                                                    instanceId={`vc-tax-${row.key}`}
                                                    value={taxValue}
                                                    onChange={(opt) => {
                                                        const id = opt?.value ? String(opt.value) : '';
                                                        if (taxLevel === 'transaction') {
                                                            setTransactionTaxId(id);
                                                        } else {
                                                            updateLine(row.key, { taxId: id });
                                                        }
                                                    }}
                                                    options={taxes}
                                                    isLoading={loadingLists}
                                                    isSearchable
                                                    placeholder="Select a Tax"
                                                    styles={selectStyles}
                                                    menuPortalTarget={
                                                        typeof document !== 'undefined' ? document.body : null
                                                    }
                                                    menuPosition="fixed"
                                                />
                                            </td>
                                            <td className="p-2 text-right font-medium pt-3">
                                                {money(lineBase(row))}
                                            </td>
                                            <td className="p-2 pt-3">
                                                {lines.length > 1 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setLines((prev) =>
                                                                prev.filter((r) => r.key !== row.key),
                                                            )
                                                        }
                                                        className="text-gray-400 hover:text-red-600"
                                                        title="Remove row"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            setLines((prev) => [
                                ...prev,
                                newLine({
                                    description: prev[0]?.description || '',
                                    taxId: taxLevel === 'line' ? '' : transactionTaxId,
                                }),
                            ])
                        }
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                        <Plus size={14} /> Add New Row
                    </button>

                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <label className={labelMuted}>Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="w-full md:w-[280px] text-[13px] space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Sub Total</span>
                                <span>{money(totals.subTotal)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-500">Discount</span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(e.target.value)}
                                        className="w-16 h-8 px-2 border border-gray-300 rounded text-right"
                                    />
                                    <span className="text-gray-400">%</span>
                                    <span className="w-16 text-right">{money(totals.discount)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Tax</span>
                                <span>{money(totals.tax)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                                <span>Total</span>
                                <span>AED {money(totals.total)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 shrink-0 bg-gray-50">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => onClose?.()}
                        className="h-9 px-4 rounded border border-gray-300 text-[13px] font-semibold text-gray-600 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving || loadingLists}
                        onClick={() => void handleSave()}
                        className="h-9 px-4 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Send to Zoho
                    </button>
                </div>
            </div>
        </div>
    );
}
