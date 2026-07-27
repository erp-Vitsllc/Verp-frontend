'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { CloudUpload, Loader2, Link2, RefreshCw, Trash2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import { mapZohoVendors } from '@/utils/zohoVendors';
import {
    mapZohoBankAccounts,
    mapZohoLocations,
    mapZohoPaymentAccounts,
    mapZohoPaymentModes,
} from '@/utils/zohoVendorPayments';

import {
    ERP_ATTACHMENT_ACCEPT,
    validateErpUploadFile,
} from '@/utils/uploadFileTypes';

const MAX_ATTACHMENTS = 5;
/** Base64 data URLs above this size freeze the tab on JSON.stringify. */
const MAX_INLINE_ATTACHMENT_CHARS = 350_000;

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 38,
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

/** Fallback if Zoho payment modes fail to load. */
const FALLBACK_RECEIVED_VIA = [
    'Cash',
    'Cheque',
    'Bank Transfer',
    'Credit Card',
    'Bank Remittance',
    'Others',
    'Salary',
    'End of Benefits',
];

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
            const percent = tax?.tax_percentage ?? tax?.percentage;
            const label =
                percent != null && percent !== ''
                    ? `${name} [${Number(percent)}%]`
                    : name;
            return { value: id, label };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label));
}

/** Full Chart of Accounts options grouped by Zoho account type (same as Expenses / Payments Made). */
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
            type: account.type || '',
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

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function attachmentForApi(attachment, { includeData = true } = {}) {
    if (!attachment) return null;
    const payload = {
        name: attachment.name || '',
        mimeType: attachment.mimeType || '',
    };
    if (
        includeData &&
        typeof attachment.data === 'string' &&
        attachment.data.length > 0 &&
        attachment.data.length <= MAX_INLINE_ATTACHMENT_CHARS
    ) {
        payload.data = attachment.data;
    }
    return payload;
}

/**
 * Pay to company — Zoho Banking Expense Refund (Money In), not Payment Refund.
 * Supports Fine recovery and Utility Bill difference recovery.
 */
export default function FineCompanyRefundModal({
    isOpen,
    onClose,
    onSuccess,
    employee = null,
    employeeId = '',
    fines = [],
    utilityBills = [],
    getFineBalance = (f) => Number(f?.balance || f?.fineAmount || 0),
    getUtilityBalance = (b) => {
        const fromField = Number(b?.differenceAmount);
        if (Number.isFinite(fromField) && Math.abs(fromField) > 0.009) {
            return Math.abs(fromField);
        }
        const contract = Number(b?.monthlyRental) || 0;
        const actual = Number(b?.amount) || 0;
        return Math.abs(contract - actual);
    },
}) {
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [date, setDate] = useState(todayInputValue());
    const [reference, setReference] = useState('');
    const [receivedVia, setReceivedVia] = useState('Cash');
    const [description, setDescription] = useState('');
    const [selectedFineKey, setSelectedFineKey] = useState('');
    const [amount, setAmount] = useState('');
    const [bankAccountId, setBankAccountId] = useState('');
    const [expenseAccountId, setExpenseAccountId] = useState('');
    const [vendorId, setVendorId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [taxTreatment, setTaxTreatment] = useState('vat_registered');
    const [placeOfSupply, setPlaceOfSupply] = useState('DU');
    const [taxId, setTaxId] = useState('');
    const [isInclusiveTax, setIsInclusiveTax] = useState(true);
    const [attachments, setAttachments] = useState([]);
    const [banks, setBanks] = useState([]);
    const [coaAccounts, setCoaAccounts] = useState([]);
    const [receivedViaModes, setReceivedViaModes] = useState(() => [...FALLBACK_RECEIVED_VIA]);
    const [vendors, setVendors] = useState([]);
    const [locations, setLocations] = useState([]);
    const [taxes, setTaxes] = useState([]);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [loadingSupport, setLoadingSupport] = useState(false);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [bankingNeedsReconnect, setBankingNeedsReconnect] = useState(false);
    const [reconnectLoading, setReconnectLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const isUtilityMode = Array.isArray(utilityBills) && utilityBills.length > 0;
    const sourceList = isUtilityMode ? utilityBills : fines;
    const preferredOrgId = String(sourceList[0]?.zohoOrganizationId || '').trim();
    const preferredCompanyId = String(
        sourceList[0]?.company?._id || sourceList[0]?.company || '',
    ).trim();

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

    const fineRows = useMemo(() => {
        if (isUtilityMode) {
            return (Array.isArray(utilityBills) ? utilityBills : []).map((b) => {
                const key = String(b._id || b.billNumber || b.accountNo || '');
                const balance = Math.max(0, Number(getUtilityBalance(b)) || 0);
                const paymentNo =
                    String(b.billNumber || '').trim() ||
                    String(b.accountNo || '').trim() ||
                    key;
                return {
                    key,
                    fine: null,
                    utilityBill: b,
                    paymentNo,
                    amount: balance,
                    balance,
                };
            });
        }
        return (Array.isArray(fines) ? fines : []).map((f) => {
            const key = String(f.fineId || f._id);
            const balance = Math.max(0, Number(getFineBalance(f)) || 0);
            return {
                key,
                fine: f,
                utilityBill: null,
                paymentNo: f.fineId || key,
                amount: Number(f.fineAmount || f.employeeShare || balance) || 0,
                balance,
            };
        });
    }, [fines, utilityBills, isUtilityMode, getFineBalance, getUtilityBalance]);

    const selectedRow = fineRows.find((r) => r.key === selectedFineKey) || null;

    const bankOptions = useMemo(
        () =>
            banks.map((a) => ({
                value: a.id,
                label: a.type
                    ? `${a.label || a.name || a.id} · ${a.type}`
                    : a.label || a.name || a.id,
                name: a.name || a.label || '',
            })),
        [banks],
    );

    const fromAccountGroupedOptions = useMemo(
        () => groupAccountOptions(coaAccounts),
        [coaAccounts],
    );

    const flatFromAccounts = useMemo(
        () => flattenAccountOptions(fromAccountGroupedOptions),
        [fromAccountGroupedOptions],
    );

    const receivedViaOptions = useMemo(
        () =>
            (receivedViaModes.length ? receivedViaModes : FALLBACK_RECEIVED_VIA).map((mode) => ({
                value: mode,
                label: mode,
            })),
        [receivedViaModes],
    );

    const locationOptions = useMemo(
        () =>
            locations.map((l) => ({
                value: l.id,
                label: l.name || l.id,
            })),
        [locations],
    );

    const vendorOptions = useMemo(
        () =>
            vendors.map((v) => ({
                value: v.id,
                label: v.label || v.id,
                name: v.label || '',
            })),
        [vendors],
    );

    const selectedBank = bankOptions.find((o) => o.value === bankAccountId) || null;
    const selectedExpense = flatFromAccounts.find((o) => o.value === expenseAccountId) || null;
    const selectedVendor = vendorOptions.find((o) => o.value === vendorId) || null;
    const selectedLocation = locationOptions.find((o) => o.value === locationId) || null;
    const selectedReceivedVia = receivedViaOptions.find((o) => o.value === receivedVia) || null;
    const selectedTaxTreatment = TAX_TREATMENT_OPTIONS.find((o) => o.value === taxTreatment) || null;
    const selectedPlaceOfSupply =
        PLACE_OF_SUPPLY_OPTIONS.find((o) => o.value === placeOfSupply) || null;
    const selectedTax = taxes.find((o) => o.value === taxId) || null;

    useEffect(() => {
        if (!isOpen) return;
        setDate(todayInputValue());
        setReference(fineRows[0]?.paymentNo || '');
        setReceivedVia('Cash');
        setDescription('');
        setBankAccountId('');
        setExpenseAccountId('');
        const firstVendor = String(
            fineRows[0]?.utilityBill?.zohoVendorId || fineRows[0]?.fine?.zohoVendorId || '',
        ).trim();
        setVendorId(firstVendor);
        setTaxTreatment('vat_registered');
        setPlaceOfSupply('DU');
        setTaxId('');
        setIsInclusiveTax(true);
        setAttachments([]);
        setBankingNeedsReconnect(false);
        const firstWithBalance = fineRows.find((r) => r.balance > 0.01) || fineRows[0];
        if (firstWithBalance) {
            setSelectedFineKey(firstWithBalance.key);
            setAmount(firstWithBalance.balance.toFixed(2));
        } else {
            setSelectedFineKey('');
            setAmount('');
        }
    }, [isOpen, fineRows]);

    const loadBanks = useCallback(async () => {
        if (!organizationId) return;
        setLoadingBanks(true);
        setBankingNeedsReconnect(false);
        try {
            const response = await axiosInstance.get('/zoho/bankaccounts', {
                params: { organizationId, includeInactive: 'true' },
                skipToast: true,
                timeout: 90000,
            });
            const mapped = mapZohoBankAccounts(response?.data?.data?.accounts);
            setBanks(mapped);
            if (!mapped.length) {
                toast({
                    variant: 'destructive',
                    title: 'No banks found',
                    description: 'Zoho Banking returned no accounts. Reconnect Zoho with banking.READ.',
                });
            }
        } catch (err) {
            setBanks([]);
            const msg = err?.response?.data?.message || err?.message || '';
            const needsReconnect = /banking\.READ|not authorized|unauthorized/i.test(msg);
            setBankingNeedsReconnect(needsReconnect);
            toast({
                variant: 'destructive',
                title: needsReconnect ? 'Zoho Banking permission missing' : 'Bank list failed',
                description: needsReconnect
                    ? 'Click Reconnect Zoho, Accept banking.READ / banking.CREATE, then Refresh.'
                    : msg,
            });
        } finally {
            setLoadingBanks(false);
        }
    }, [organizationId, toast]);

    const loadZohoLists = useCallback(async () => {
        if (!organizationId) return;
        setLoadingSupport(true);
        try {
            const [supportRes, taxRes] = await Promise.all([
                // Full Chart of Accounts + Zoho Payment Modes (same source as Payments Made)
                axiosInstance.get('/zoho/vendorpayments/support', {
                    params: { organizationId },
                    skipToast: true,
                    timeout: 120000,
                }),
                axiosInstance.get('/zoho/expenses/support', {
                    params: { organizationId },
                    skipToast: true,
                    timeout: 90000,
                }),
            ]);

            const support = supportRes?.data?.data || {};
            setCoaAccounts(mapZohoPaymentAccounts(support.accounts));

            const modes = mapZohoPaymentModes(support.paymentModes);
            setReceivedViaModes(modes.length ? modes : [...FALLBACK_RECEIVED_VIA]);
            setReceivedVia((prev) => {
                const list = modes.length ? modes : FALLBACK_RECEIVED_VIA;
                if (prev && list.includes(prev)) return prev;
                return list.includes('Cash') ? 'Cash' : list[0] || 'Cash';
            });

            const taxSupport = taxRes?.data?.data || {};
            const mappedLocations = mapZohoLocations(taxSupport.locations || support.locations);
            setLocations(mappedLocations);
            setTaxes(mapZohoTaxes(taxSupport.taxes));
            const preferred =
                mappedLocations.find((l) => /vega\s*dxb/i.test(l.name)) ||
                mappedLocations.find((l) => l.isPrimary) ||
                mappedLocations[0];
            setLocationId((prev) => prev || preferred?.id || '');
        } catch (err) {
            setCoaAccounts([]);
            setReceivedViaModes([...FALLBACK_RECEIVED_VIA]);
            setLocations([]);
            setTaxes([]);
            toast({
                variant: 'destructive',
                title: 'Zoho lists failed',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Could not load Chart of Accounts / Received Via from Zoho.',
            });
        } finally {
            setLoadingSupport(false);
        }
    }, [organizationId, toast]);

    const loadVendors = useCallback(async () => {
        if (!organizationId) return;
        setLoadingVendors(true);
        try {
            const readLocal = async () => {
                const response = await axiosInstance.get('/zoho/vendors', {
                    params: { organizationId, sync: 'false' },
                    skipToast: true,
                    timeout: 120000,
                });
                return mapZohoVendors(response?.data?.data);
            };

            let mapped = await readLocal();
            // Always refresh from Zoho so Vendor dropdown is complete (same as Payments Made).
            let zohoPage = 1;
            for (let guard = 0; guard < 40; guard += 1) {
                const response = await axiosInstance.get('/zoho/vendors', {
                    params: {
                        organizationId,
                        sync: 'true',
                        zohoPage,
                        chunkLimit: 400,
                    },
                    skipToast: true,
                    timeout: 120000,
                });
                const meta = response?.data?.meta || {};
                if (!meta.hasMore) break;
                zohoPage = Number(meta.nextZohoPage) || zohoPage + 1;
            }
            mapped = await readLocal();
            setVendors(mapped);
        } catch (err) {
            setVendors([]);
            toast({
                variant: 'destructive',
                title: 'Vendors failed',
                description:
                    err?.response?.data?.message || err?.message || 'Could not load Zoho vendors.',
            });
        } finally {
            setLoadingVendors(false);
        }
    }, [organizationId, toast]);

    const reconnectZoho = useCallback(async () => {
        if (!organizationId) return;
        setReconnectLoading(true);
        try {
            const response = await axiosInstance.get('/zoho/auth-url', {
                params: { organizationId },
                skipToast: true,
            });
            const url = response?.data?.data?.authorizationUrl;
            if (!url) throw new Error('Authorization URL was not returned');
            const popup = window.open(url, '_blank', 'noopener,noreferrer');
            if (!popup) window.location.assign(url);
            toast({
                title: 'Approve Zoho access',
                description: 'Accept Banking READ + CREATE, then click Refresh.',
            });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Reconnect failed',
                description: err?.response?.data?.message || err?.message || 'Could not open Zoho auth.',
            });
        } finally {
            setReconnectLoading(false);
        }
    }, [organizationId, toast]);

    useEffect(() => {
        if (!isOpen || !organizationId) return undefined;
        void loadBanks();
        void loadZohoLists();
        void loadVendors();
        return undefined;
    }, [isOpen, organizationId, loadBanks, loadZohoLists, loadVendors]);

    if (!isOpen) return null;

    const handleSelectFine = (row) => {
        setSelectedFineKey(row.key);
        setAmount(row.balance > 0 ? row.balance.toFixed(2) : '');
        setReference((prev) => prev || row.paymentNo);
    };

    const addAttachmentFiles = async (fileList) => {
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;

        const room = MAX_ATTACHMENTS - attachments.length;
        if (room <= 0) {
            toast({
                variant: 'destructive',
                title: 'Attachment limit',
                description: `You can upload a maximum of ${MAX_ATTACHMENTS} files (PDF max 5 MB or JPEG max 2 MB each).`,
            });
            return;
        }

        const next = [];
        for (const file of incoming.slice(0, room)) {
            const check = validateErpUploadFile(file);
            if (!check.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid attachment',
                    description: check.message,
                });
                continue;
            }
            try {
                let data;
                if (file.size <= 250 * 1024) {
                    const raw = await readFileAsDataUrl(file);
                    if (
                        typeof raw === 'string' &&
                        raw.length > 0 &&
                        raw.length <= MAX_INLINE_ATTACHMENT_CHARS
                    ) {
                        data = raw;
                    }
                }
                next.push({
                    key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    name: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    size: file.size,
                    data,
                });
            } catch {
                toast({
                    variant: 'destructive',
                    title: 'Upload failed',
                    description: `Could not read ${file.name}.`,
                });
            }
        }

        if (next.length) {
            setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
        }
        if (incoming.length > room) {
            toast({
                title: 'Attachment limit',
                description: `Only ${room} more file(s) added (max ${MAX_ATTACHMENTS}).`,
            });
        }
    };

    const handleSave = async () => {
        const entity = isUtilityMode ? selectedRow?.utilityBill : selectedRow?.fine;
        if (!entity) {
            toast({
                variant: 'destructive',
                title: 'Select a payment',
                description: isUtilityMode
                    ? 'Choose a utility bill row to record as Expense Refund.'
                    : 'Choose a fine payment row to record as Expense Refund.',
            });
            return;
        }
        const payAmt = parseFloat(amount);
        if (!Number.isFinite(payAmt) || payAmt <= 0) {
            toast({
                variant: 'destructive',
                title: 'Invalid amount',
                description: 'Enter a valid Expense Refund amount.',
            });
            return;
        }
        if (payAmt > selectedRow.balance + 0.01) {
            toast({
                variant: 'destructive',
                title: 'Amount too high',
                description: `Amount cannot exceed balance (${selectedRow.balance.toFixed(2)} AED).`,
            });
            return;
        }
        if (!bankAccountId) {
            toast({
                variant: 'destructive',
                title: 'Bank required',
                description: 'Choose the bank that receives this Expense Refund (Money In).',
            });
            return;
        }
        if (!expenseAccountId) {
            toast({
                variant: 'destructive',
                title: 'From Account required',
                description: 'Pick any account from Zoho Chart of Accounts.',
            });
            return;
        }
        if (!taxTreatment) {
            toast({
                variant: 'destructive',
                title: 'Tax Treatment required',
                description: 'Select Tax Treatment.',
            });
            return;
        }
        if (!placeOfSupply) {
            toast({
                variant: 'destructive',
                title: 'Place of Supply required',
                description: 'Select Place of Supply.',
            });
            return;
        }
        if (!taxId) {
            toast({
                variant: 'destructive',
                title: 'Tax required',
                description: 'Select a Tax.',
            });
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

        setSaving(true);
        try {
            const paymentSourceMap = {
                Cash: 'Cash',
                Cheque: 'Cash',
                Check: 'Cash',
                'Bank Transfer': 'Cash',
                'Credit Card': 'Cash',
                'Bank Remittance': 'Cash',
                Others: 'Cash',
                Salary: 'Salary',
                'End of Benefits': 'End of Benefits',
            };

            const primaryAttachment = attachments[0]
                ? attachmentForApi(attachments[0], { includeData: true })
                : null;

            const defaultDescription = isUtilityMode
                ? `Expense Refund · Utility ${
                      entity.utilityType || ''
                  } ${entity.billMonth || ''} · Acc ${entity.accountNo || selectedRow.paymentNo}`.trim()
                : `Expense Refund · Fine ${entity.fineId || selectedRow.paymentNo}`;

            const res = await axiosInstance.post('/Payment', {
                paymentType: isUtilityMode ? 'UtilityBill' : 'Fine',
                paidBy: employeeId,
                amount: payAmt,
                status: 'Completed',
                description: description || defaultDescription,
                remarks: `Expense Refund · Received Via: ${receivedVia}${
                    reference ? ` · Ref: ${reference}` : ''
                }${selectedVendor ? ` · Vendor: ${selectedVendor.label}` : ''}`,
                referenceId: isUtilityMode
                    ? String(entity._id || selectedRow.paymentNo)
                    : entity.fineId,
                relatedEntityType: isUtilityMode ? 'UtilityBill' : 'Fine',
                relatedEntityId: entity._id,
                paymentSource: paymentSourceMap[receivedVia] || 'Cash',
                paymentDate: date,
                zohoOrganizationId: organizationId,
                expenseAccountId,
                expenseAccountName: selectedExpense?.name || selectedExpense?.label || '',
                paidThroughAccountId: bankAccountId,
                paidThroughAccountName: selectedBank?.name || selectedBank?.label || '',
                locationId,
                taxTreatment,
                placeOfSupply,
                taxId,
                isInclusiveTax,
                paymentMode: receivedVia,
                receivedVia,
                vendorId,
                vendorName: selectedVendor?.label || '',
                attachment: primaryAttachment || undefined,
                attachments: attachments
                    .map((a) => attachmentForApi(a, { includeData: true }))
                    .filter(Boolean),
            });

            const zohoSync = res?.data?.zohoSync;
            if (zohoSync && zohoSync.ok === false) {
                toast({
                    variant: 'destructive',
                    title: 'Saved in ERP — not in Zoho',
                    description: res?.data?.message || zohoSync.message,
                });
            } else {
                toast({
                    title: 'Expense Refund saved',
                    description:
                        res?.data?.message ||
                        (zohoSync?.expenseId
                            ? `Zoho Expense Refund ${zohoSync.expenseNumber || zohoSync.expenseId} created.`
                            : 'Expense Refund recorded successfully.'),
                });
            }
            onSuccess?.();
            onClose?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Expense Refund failed',
                description: err?.response?.data?.message || err?.message || 'Could not save.',
            });
        } finally {
            setSaving(false);
        }
    };

    const labelClass = 'block text-[13px] font-semibold text-red-600 mb-1.5';
    const labelMuted = 'block text-[13px] font-semibold text-gray-700 mb-1.5';
    const inputClass =
        'w-full h-[38px] px-3 border border-gray-300 rounded text-[13px] text-gray-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45">
            <div
                className="absolute inset-0"
                onClick={() => !saving && onClose?.()}
                aria-hidden
            />
            <div className="relative w-full max-w-[560px] max-h-[92vh] bg-white rounded-md shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 shrink-0">
                    <h2 className="text-[16px] font-semibold text-gray-800">Expense Refund</h2>
                    <button
                        type="button"
                        onClick={() => !saving && onClose?.()}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                    {(showZohoOrgPicker || activeZohoOrg) && (
                        <div className="flex justify-end">
                            <ZohoOrganizationPicker
                                options={zohoOrgOptions}
                                value={organizationId}
                                onChange={setOrganizationId}
                                loading={zohoOrgLoading || loadingBanks || loadingSupport || loadingVendors}
                                size="sm"
                            />
                        </div>
                    )}

                    <div>
                        <label className={labelMuted}>Location</label>
                        <Select
                            classNamePrefix="refund-location"
                            instanceId="refund-location"
                            value={selectedLocation}
                            onChange={(opt) => setLocationId(opt?.value || '')}
                            options={locationOptions}
                            isLoading={loadingSupport}
                            isClearable
                            isSearchable
                            placeholder={loadingSupport ? 'Loading…' : 'Select location'}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>From Account*</label>
                        <Select
                            classNamePrefix="refund-from-account"
                            instanceId="refund-from-account"
                            value={selectedExpense}
                            onChange={(opt) => setExpenseAccountId(opt?.value || '')}
                            options={fromAccountGroupedOptions}
                            isLoading={loadingSupport}
                            isClearable
                            isSearchable
                            placeholder={
                                loadingSupport
                                    ? 'Loading Chart of Accounts…'
                                    : 'Search Chart of Accounts…'
                            }
                            noOptionsMessage={() => 'No accounts found in Zoho Chart of Accounts'}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                            Full Zoho Chart of Accounts
                            {flatFromAccounts.length ? ` · ${flatFromAccounts.length} accounts` : ''}.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Date*</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={inputClass}
                        />
                        <p className="text-[11px] text-gray-400 mt-1">{formatDisplayDate(date)}</p>
                    </div>

                    <div>
                        <label className={labelClass}>Amount*</label>
                        <div className="flex gap-2">
                            <div className="w-[88px] shrink-0 h-[38px] px-2 border border-gray-300 rounded text-[13px] text-gray-700 bg-gray-50 flex items-center justify-center font-medium">
                                AED
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className={inputClass}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelMuted}>Received Via</label>
                        <Select
                            classNamePrefix="refund-received-via"
                            instanceId="refund-received-via"
                            value={selectedReceivedVia}
                            onChange={(opt) => setReceivedVia(opt?.value || 'Cash')}
                            options={receivedViaOptions}
                            isLoading={loadingSupport}
                            isSearchable
                            placeholder={
                                loadingSupport ? 'Loading payment modes…' : 'Select received via'
                            }
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                            From Zoho Books → Payment Modes
                            {receivedViaOptions.length
                                ? ` · ${receivedViaOptions.length} modes`
                                : ''}
                            .
                        </p>
                    </div>

                    <div>
                        <label className={labelMuted}>Vendor</label>
                        <Select
                            classNamePrefix="refund-vendor"
                            instanceId="refund-vendor"
                            value={selectedVendor}
                            onChange={(opt) => setVendorId(opt?.value || '')}
                            options={vendorOptions}
                            isLoading={loadingVendors}
                            isClearable
                            isSearchable
                            placeholder={
                                loadingVendors ? 'Loading Zoho vendors…' : 'Select a vendor'
                            }
                            noOptionsMessage={() => 'No Zoho vendors found'}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                            Full Zoho Vendors list
                            {vendorOptions.length ? ` · ${vendorOptions.length} vendors` : ''}.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Bank*</label>
                        {(bankingNeedsReconnect || (!loadingBanks && !bankOptions.length)) && (
                            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                                Reconnect Zoho with <strong>banking.READ</strong> +{' '}
                                <strong>banking.CREATE</strong>, then Refresh.
                            </div>
                        )}
                        <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <Select
                                    classNamePrefix="refund-bank"
                                    instanceId="refund-bank"
                                    value={selectedBank}
                                    onChange={(opt) => setBankAccountId(opt?.value || '')}
                                    options={bankOptions}
                                    isLoading={loadingBanks}
                                    isClearable
                                    isSearchable
                                    placeholder={
                                        loadingBanks ? 'Loading banks…' : 'Choose bank (Money In)…'
                                    }
                                    noOptionsMessage={() =>
                                        bankingNeedsReconnect
                                            ? 'Reconnect Zoho first'
                                            : 'No banks found'
                                    }
                                    styles={selectStyles}
                                    menuPortalTarget={
                                        typeof document !== 'undefined' ? document.body : null
                                    }
                                    menuPosition="fixed"
                                />
                            </div>
                            <button
                                type="button"
                                disabled={reconnectLoading || !organizationId}
                                onClick={() => void reconnectZoho()}
                                title="Reconnect Zoho"
                                className="shrink-0 h-[38px] px-2.5 rounded border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                            >
                                {reconnectLoading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Link2 size={14} />
                                )}
                                Reconnect
                            </button>
                            <button
                                type="button"
                                disabled={loadingBanks || !organizationId}
                                onClick={() => void loadBanks()}
                                title="Refresh banks"
                                className="shrink-0 h-[38px] w-[38px] rounded border border-gray-300 bg-white text-gray-600 inline-flex items-center justify-center disabled:opacity-50"
                            >
                                {loadingBanks ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={14} />
                                )}
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                            Full Zoho Banking list
                            {bankOptions.length ? ` · ${bankOptions.length} accounts` : ''}.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Tax Treatment*</label>
                        <Select
                            classNamePrefix="refund-tax-treatment"
                            instanceId="refund-tax-treatment"
                            value={selectedTaxTreatment}
                            onChange={(opt) => setTaxTreatment(opt?.value || '')}
                            options={TAX_TREATMENT_OPTIONS}
                            isClearable
                            isSearchable
                            placeholder="Select tax treatment"
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Place of Supply*</label>
                        <Select
                            classNamePrefix="refund-place-of-supply"
                            instanceId="refund-place-of-supply"
                            value={selectedPlaceOfSupply}
                            onChange={(opt) => setPlaceOfSupply(opt?.value || '')}
                            options={PLACE_OF_SUPPLY_OPTIONS}
                            isClearable
                            isSearchable
                            placeholder="Select place of supply"
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Tax*</label>
                        <Select
                            classNamePrefix="refund-tax"
                            instanceId="refund-tax"
                            value={selectedTax}
                            onChange={(opt) => setTaxId(opt?.value || '')}
                            options={taxes}
                            isLoading={loadingSupport}
                            isClearable
                            isSearchable
                            placeholder={loadingSupport ? 'Loading…' : 'Select a Tax'}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                        />
                    </div>

                    <div>
                        <label className={labelMuted}>Amount Is</label>
                        <div className="flex items-center gap-5 h-[38px]">
                            <label className="inline-flex items-center gap-2 text-[13px] text-gray-800 cursor-pointer">
                                <input
                                    type="radio"
                                    name="refund-tax-mode"
                                    checked={isInclusiveTax}
                                    onChange={() => setIsInclusiveTax(true)}
                                    className="accent-blue-600"
                                />
                                Tax Inclusive
                            </label>
                            <label className="inline-flex items-center gap-2 text-[13px] text-gray-800 cursor-pointer">
                                <input
                                    type="radio"
                                    name="refund-tax-mode"
                                    checked={!isInclusiveTax}
                                    onChange={() => setIsInclusiveTax(false)}
                                    className="accent-blue-600"
                                />
                                Tax Exclusive
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className={labelMuted}>Reference#</label>
                        <input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className={inputClass}
                            placeholder="Optional reference"
                        />
                    </div>

                    <div>
                        <label className={labelMuted}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                            rows={3}
                            maxLength={500}
                            placeholder="Max. 500 characters"
                            className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] text-gray-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y min-h-[72px]"
                        />
                    </div>

                    <div>
                        <label className={labelMuted}>Attachments</label>
                        <div className="rounded border border-dashed border-gray-300 bg-gray-50/80 px-3 py-3">
                            <button
                                type="button"
                                disabled={saving || attachments.length >= MAX_ATTACHMENTS}
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-2 h-[36px] px-3 rounded border border-gray-300 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                <CloudUpload size={15} className="text-gray-500" />
                                Upload File
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept={ERP_ATTACHMENT_ACCEPT}
                                className="hidden"
                                onChange={(e) => {
                                    void addAttachmentFiles(e.target.files);
                                    e.target.value = '';
                                }}
                            />
                            <p className="mt-2 text-[11px] text-gray-500">
                                Up to {MAX_ATTACHMENTS} files — PDF max 5 MB or JPEG max 2 MB each
                            </p>
                            {attachments.length > 0 ? (
                                <ul className="mt-3 space-y-1.5">
                                    {attachments.map((file) => (
                                        <li
                                            key={file.key}
                                            className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700"
                                        >
                                            <span className="truncate" title={file.name}>
                                                {file.name}
                                                {file.size
                                                    ? ` · ${(file.size / 1024).toFixed(0)} KB`
                                                    : ''}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={saving}
                                                onClick={() =>
                                                    setAttachments((prev) =>
                                                        prev.filter((a) => a.key !== file.key),
                                                    )
                                                }
                                                className="shrink-0 p-1 text-red-500 hover:text-red-600 disabled:opacity-50"
                                                title="Remove"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Select a payment*</label>
                        <div className="border border-gray-200 rounded overflow-hidden">
                            <table className="w-full text-[12px]">
                                <thead>
                                    <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
                                        <th className="px-3 py-2 font-semibold w-8" />
                                        <th className="px-3 py-2 font-semibold">Payment #</th>
                                        <th className="px-3 py-2 font-semibold text-right">Amount</th>
                                        <th className="px-3 py-2 font-semibold text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fineRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-3 py-8 text-center text-gray-400 italic"
                                            >
                                                There are no payments with credits for this customer.
                                            </td>
                                        </tr>
                                    ) : (
                                        fineRows.map((row) => {
                                            const selected = row.key === selectedFineKey;
                                            return (
                                                <tr
                                                    key={row.key}
                                                    onClick={() => handleSelectFine(row)}
                                                    className={`border-t border-gray-100 cursor-pointer ${
                                                        selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <td className="px-3 py-2.5">
                                                        <input
                                                            type="radio"
                                                            name="refund-fine"
                                                            checked={selected}
                                                            onChange={() => handleSelectFine(row)}
                                                            className="accent-blue-600"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2.5 font-medium text-gray-800">
                                                        {row.paymentNo}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-gray-700">
                                                        {row.amount.toFixed(2)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                                                        {row.balance.toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-center gap-3 shrink-0 bg-gray-50/80">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="min-w-[88px] h-9 px-5 rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[13px] font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                        Save
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => onClose?.()}
                        className="min-w-[88px] h-9 px-5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-[13px] font-semibold disabled:opacity-60"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
