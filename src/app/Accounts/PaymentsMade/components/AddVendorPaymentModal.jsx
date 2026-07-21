'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { AlertTriangle, Loader2, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoVendors } from '@/utils/zohoVendors';
import {
    buildSelectedBillAmounts,
    formatZohoPaymentMoney,
    mapZohoLocations,
    mapZohoPaymentAccounts,
    mapZohoPaymentModes,
    mapZohoVendorPayableOptions,
    mergeLocationOptions,
} from '@/utils/zohoVendorPayments';
import ZohoPaymentModeSelect from './ZohoPaymentModeSelect';
import VendorSidePanel from '../../Bills/components/VendorSidePanel';
import ZohoOrganizationPicker from '@/components/ZohoOrganizationPicker';
import { useZohoOrganizations } from '@/hooks/useZohoOrganizations';
import { rememberZohoOrganizationId } from '@/utils/zohoOrganizations';

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

const COMPANY_PARTY_ID = 'VEGA-HR-0000';

/** Prefer Chart of Accounts row whose name matches the employee (Accounts Payable / liability). */
function findEmployeePaidThroughAccount(accounts = [], employeeName = '') {
    const needle = String(employeeName || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    if (!needle || !Array.isArray(accounts) || !accounts.length) return null;

    const scored = accounts
        .map((account) => {
            const name = String(account?.name || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, ' ');
            const type = String(account?.type || '').toLowerCase();
            if (!name.includes(needle) && !needle.includes(name)) return null;
            let score = 1;
            if (/payable|liability|employee|staff|advance/.test(type) || /payable|liability|employee/.test(name)) {
                score += 3;
            }
            if (name === needle) score += 2;
            return { account, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

    return scored[0]?.account || null;
}

function normalizePrefillPayBy(value) {
    const v = String(value || '')
        .trim()
        .toLowerCase();
    if (v === 'employee_balance') return 'employee';
    if (v === 'company' || v === 'employee' || v === 'employee_and_company') return v;
    return '';
}

/** Build party_expenses[] only for Pay difference / balance (not full vendor bill pay). */
function buildPartyExpensesPayloadForZoho({ utilityPrefill, paymentAmount }) {
    if (!utilityPrefill) return [];
    // Vendor "Pay bills" must NOT mark profile balance Paid or post balance debit/credit.
    const mode = String(utilityPrefill.mode || '').trim().toLowerCase();
    if (mode && mode !== 'difference') return [];

    const partyRows = Array.isArray(utilityPrefill.partyRows) ? utilityPrefill.partyRows : [];
    const rows = [...partyRows];
    const linkByBill = new Map(
        (Array.isArray(utilityPrefill.utilityBillLinks) ? utilityPrefill.utilityBillLinks : []).map(
            (link) => [String(link.utilityBillId || ''), link],
        ),
    );

    if (!rows.length) {
        const payBy = normalizePrefillPayBy(utilityPrefill.payBy);
        const companyAmt = amountValue(utilityPrefill.companyPayAmount);
        const employeeAmt = amountValue(utilityPrefill.employeePayAmount);
        const totalAmt = amountValue(utilityPrefill.amount) || amountValue(paymentAmount);
        if (payBy === 'company' || (companyAmt > 0 && !payBy)) {
            rows.push({
                payBy: 'company',
                amount: companyAmt > 0 ? companyAmt : totalAmt,
                payByCompanyId: utilityPrefill.payByCompanyId || utilityPrefill.companyId,
                payByCompanyName: utilityPrefill.payByCompanyName || 'VEGA Digital',
                utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
            });
        } else if (payBy === 'employee' || employeeAmt > 0) {
            rows.push({
                payBy: 'employee',
                amount: employeeAmt > 0 ? employeeAmt : totalAmt,
                payByEmployeeId: utilityPrefill.payByEmployeeId || '',
                payByEmployeeName: utilityPrefill.payByEmployeeName || '',
                utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
            });
        } else if (payBy === 'employee_and_company') {
            if (companyAmt > 0) {
                rows.push({
                    payBy: 'company',
                    amount: companyAmt,
                    payByCompanyId: utilityPrefill.payByCompanyId || utilityPrefill.companyId,
                    payByCompanyName: utilityPrefill.payByCompanyName || 'VEGA Digital',
                    utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                });
            }
            if (employeeAmt > 0) {
                rows.push({
                    payBy: 'employee',
                    amount: employeeAmt,
                    payByEmployeeId: utilityPrefill.payByEmployeeId || '',
                    payByEmployeeName: utilityPrefill.payByEmployeeName || '',
                    utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                });
            }
        }
    }

    return rows
        .map((row) => {
            const amount = amountValue(row.amount || row.employeePayAmount || row.companyPayAmount);
            if (amount <= 0) return null;
            const payBy = normalizePrefillPayBy(row.payBy);
            const isCompany = payBy === 'company';
            const link = linkByBill.get(String(row.utilityBillId || '')) || {};
            return {
                kind: 'balance',
                payBy: isCompany ? 'company' : 'employee',
                partyType: isCompany ? 'company' : 'employee',
                amount,
                employeeId: isCompany
                    ? COMPANY_PARTY_ID
                    : row.payByEmployeeId || utilityPrefill.payByEmployeeId || '',
                employeeName: isCompany
                    ? row.payByCompanyName || 'VEGA Digital'
                    : row.payByEmployeeName || utilityPrefill.payByEmployeeName || '',
                companyId: row.payByCompanyId || utilityPrefill.companyId || '',
                companyName:
                    row.payByCompanyName || utilityPrefill.payByCompanyName || 'VEGA Digital',
                utilityBillId: row.utilityBillId || '',
                accountNo: row.accountNo || '',
                zohoBillId: link.zohoBillId || '',
            };
        })
        .filter(Boolean);
}

export default function AddVendorPaymentModal({
    isOpen = true,
    onClose,
    onSuccess,
    prefill = null,
    variant = 'modal',
    paymentId = '',
}) {
    const isPage = variant === 'page';
    const editPaymentId = String(paymentId || '').trim();
    const isEdit = Boolean(editPaymentId);
    const { toast } = useToast();
    const [form, setForm] = useState(emptyForm);
    const [vendors, setVendors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [paymentModes, setPaymentModes] = useState(() => mapZohoPaymentModes([]));
    const [payables, setPayables] = useState([]);
    const [billAmounts, setBillAmounts] = useState({});
    const [selectedPayableIds, setSelectedPayableIds] = useState(() => new Set());
    const utilityPrefillRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [loadingBills, setLoadingBills] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [attachmentName, setAttachmentName] = useState('');
    const [vendorDetails, setVendorDetails] = useState(null);
    const [vendorPanelOpen, setVendorPanelOpen] = useState(false);
    const [loadingVendor, setLoadingVendor] = useState(false);
    /** Paid Through can come from the other Zoho org (e.g. NNIT employee pays a VEGA bill). */
    const [paidThroughOrgId, setPaidThroughOrgId] = useState('');
    const [crossOrgAccounts, setCrossOrgAccounts] = useState([]);
    const [loadingCrossOrgAccounts, setLoadingCrossOrgAccounts] = useState(false);

    const preferredOrganizationId = String(
        prefill?.organizationId || prefill?.zohoOrganizationId || '',
    ).trim();
    const preferredCompanyId = String(prefill?.companyId || prefill?.payByCompanyId || '').trim();

    const {
        loading: loadingOrgs,
        options: zohoOrgOptions,
        organizationId,
        setOrganizationId,
        active: activeZohoOrg,
    } = useZohoOrganizations({
        enabled: isPage || isOpen,
        preferredOrganizationId,
        preferredCompanyId,
    });

    const orgQuery = useCallback(
        (extra = {}) => {
            const params = { ...extra };
            if (organizationId) params.organizationId = organizationId;
            return params;
        },
        [organizationId],
    );

    /** Local DB first; if empty for this org (e.g. NNIT never synced), pull from Zoho. */
    const loadVendorsForOrg = useCallback(async () => {
        const readLocal = async () => {
            const response = await axiosInstance.get('/zoho/vendors', {
                skipToast: true,
                timeout: 120000,
                params: orgQuery({ sync: 'false' }),
            });
            return mapZohoVendors(response?.data?.data);
        };

        let mapped = await readLocal();
        if (mapped.length) return mapped;

        // Auto-sync from Zoho Books for the active org (VEGA / NNIT).
        let zohoPage = 1;
        for (let guard = 0; guard < 40; guard += 1) {
            const response = await axiosInstance.get('/zoho/vendors', {
                skipToast: true,
                timeout: 120000,
                params: orgQuery({
                    sync: 'true',
                    zohoPage,
                    chunkLimit: 400,
                }),
            });
            const meta = response?.data?.meta || {};
            if (!meta.hasMore) break;
            zohoPage = Number(meta.nextZohoPage) || zohoPage + 1;
        }

        mapped = await readLocal();
        return mapped;
    }, [orgQuery]);

    const fetchSupport = useCallback(
        async (vendorId = '') => {
            const response = await axiosInstance.get('/zoho/vendorpayments/support', {
                skipToast: true,
                timeout: 120000,
                params: orgQuery(vendorId ? { vendorId } : {}),
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
        },
        [orgQuery],
    );

    const loadVendorDetails = useCallback(
        async (vendorId, { openPanel = true } = {}) => {
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
                    params: orgQuery(),
                });
                setVendorDetails(response?.data?.data || null);
                if (openPanel) setVendorPanelOpen(true);
            } catch (err) {
                console.warn(
                    '[AddVendorPayment] Vendor details load failed:',
                    err?.response?.data?.message || err?.message || err,
                );
                setVendorDetails(null);
            } finally {
                setLoadingVendor(false);
            }
        },
        [orgQuery],
    );

    useEffect(() => {
        if (!isPage && !isOpen) {
            setForm(emptyForm());
            setVendors([]);
            setAccounts([]);
            setLocations([]);
            setPaymentModes(mapZohoPaymentModes([]));
            setPayables([]);
            setBillAmounts({});
            setSelectedPayableIds(new Set());
            utilityPrefillRef.current = null;
            setLoading(false);
            setLoadingBills(false);
            setSaving(false);
            setError('');
            setAttachmentName('');
            setVendorDetails(null);
            setVendorPanelOpen(false);
            setLoadingVendor(false);
            return;
        }

        if (!isPage && !isOpen) return;
        // Wait until VEGA / NNIT org is resolved so Payment Mode + Paid Through match that books org.
        if (loadingOrgs || !organizationId) return;

        let cancelled = false;
        setLoading(true);
        setError('');

        (async () => {
            try {
                const vendorPromise = loadVendorsForOrg().catch((err) => {
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

                let existingPayment = null;
                if (isEdit) {
                    const paymentResponse = await axiosInstance.get(
                        `/zoho/vendorpayments/${encodeURIComponent(editPaymentId)}`,
                        {
                            skipToast: true,
                            timeout: 60000,
                            params: orgQuery(),
                        },
                    );
                    existingPayment = paymentResponse?.data?.data || null;
                    if (!existingPayment) {
                        throw new Error('Payment not found.');
                    }
                }

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

                if (existingPayment) {
                    const vendorId = String(existingPayment.vendor_id || '').trim();
                    const appliedAmounts = {};
                    const appliedPayables = [];

                    for (const bill of Array.isArray(existingPayment.bills)
                        ? existingPayment.bills
                        : []) {
                        const billId = String(bill?.bill_id || bill?.id || '').trim();
                        if (!billId) continue;
                        const applied = Number(
                            bill?.amount_applied ?? bill?.applied_amount ?? bill?.payment_amount,
                        );
                        if (Number.isFinite(applied) && applied > 0) {
                            appliedAmounts[billId] = String(applied);
                        }
                        appliedPayables.push({
                            id: billId,
                            recordType: 'bill',
                            billNumber: String(bill?.bill_number || bill?.ref_number || billId).trim(),
                            poNumber:
                                String(bill?.purchaseorder_number || bill?.po_number || '—').trim() ||
                                '—',
                            locationId: String(bill?.location_id || '').trim(),
                            location: String(
                                bill?.location_name || existingPayment.location_name || '—',
                            ).trim(),
                            date: String(bill?.date || bill?.bill_date || '').trim() || '—',
                            dueDate: '—',
                            balance: Number(bill?.balance ?? bill?.amount_due) || 0,
                            total: Number(bill?.total ?? bill?.bill_amount ?? bill?.amount) || 0,
                            currencyCode: String(
                                bill?.currency_code || existingPayment.currency_code || 'AED',
                            ).trim(),
                            vendorId,
                            description: '',
                            accountName: '',
                            raw: bill,
                        });
                    }

                    let mergedPayables = appliedPayables;
                    if (vendorId) {
                        try {
                            const vendorSupport = await fetchSupport(vendorId);
                            const openPayables = (vendorSupport.payables || []).filter(
                                (row) => row.recordType === 'bill',
                            );
                            const seen = new Set(appliedPayables.map((row) => row.id));
                            mergedPayables = [
                                ...appliedPayables,
                                ...openPayables.filter((row) => !seen.has(row.id)),
                            ];
                        } catch (supportErr) {
                            console.warn(
                                '[AddVendorPayment] Edit support load failed:',
                                supportErr?.message || supportErr,
                            );
                        }
                    }

                    if (cancelled) return;
                    setPayables(mergedPayables);
                    setBillAmounts(appliedAmounts);
                    setSelectedPayableIds(new Set(Object.keys(appliedAmounts)));
                    setForm({
                        vendorId,
                        locationId: String(
                            existingPayment.location_id ||
                                support.vendorDefaults?.location_id ||
                                primaryLocation?.id ||
                                '',
                        ).trim(),
                        locationName: String(
                            existingPayment.location_name ||
                                support.vendorDefaults?.location_name ||
                                primaryLocation?.name ||
                                '',
                        ).trim(),
                        currencyCode:
                            String(existingPayment.currency_code || 'AED').trim() || 'AED',
                        paymentNumber: String(
                            existingPayment.payment_number || existingPayment.payment_no || '',
                        ).trim(),
                        date: String(existingPayment.date || todayKey()).trim() || todayKey(),
                        amount: String(existingPayment.amount ?? ''),
                        paidThroughAccountId: String(
                            existingPayment.paid_through_account_id ||
                                existingPayment.account_id ||
                                '',
                        ).trim(),
                        paymentMode:
                            String(existingPayment.payment_mode || '').trim() || defaultPaymentMode,
                        referenceNumber: String(existingPayment.reference_number || '').trim(),
                        notes: String(
                            existingPayment.description || existingPayment.notes || '',
                        ).trim(),
                    });
                    if (vendorId) {
                        void loadVendorDetails(vendorId, { openPanel: true });
                    }
                } else {
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
                }

                if (!mappedVendors.length) {
                    setError(
                        `No vendors found in ${activeZohoOrg?.brand || 'this'} Zoho Books. Check vendors in Zoho, then try Switch again.`,
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
    }, [
        editPaymentId,
        fetchSupport,
        isEdit,
        isOpen,
        isPage,
        loadVendorDetails,
        loadVendorsForOrg,
        loadingOrgs,
        orgQuery,
        organizationId,
        activeZohoOrg?.brand,
    ]);

    const selectedVendor = useMemo(
        () => vendors.find((vendor) => vendor.id === form.vendorId) || null,
        [form.vendorId, vendors],
    );

    const paymentAmount = amountValue(form.amount);
    const billRows = useMemo(
        () => payables.filter((row) => row.recordType === 'bill'),
        [payables],
    );
    // Bills only — Expenses tab is not used on Payment Made.
    const visiblePayables = billRows;
    const appliedTotal = useMemo(
        () =>
            Object.entries(billAmounts).reduce((sum, [id, value]) => {
                if (!selectedPayableIds.has(id)) return sum;
                return sum + amountValue(value);
            }, 0),
        [billAmounts, selectedPayableIds],
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
            setSelectedPayableIds(new Set());

            try {
                const {
                    accounts: mappedAccounts,
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

                // Only bills (no expenses). Prefill may pre-check specific Zoho bill ids / numbers.
                const billPayables = mappedPayables.filter((row) => row.recordType === 'bill');
                const selectedBillIds = Array.isArray(overrides.selectedBillIds)
                    ? overrides.selectedBillIds
                    : [];
                const selectedBillNumbers = Array.isArray(overrides.selectedBillNumbers)
                    ? overrides.selectedBillNumbers
                    : [];
                const hasPrefillBills =
                    selectedBillIds.length > 0 || selectedBillNumbers.length > 0;
                const { billAmounts: nextBillAmounts, suggestedPaymentAmount } = hasPrefillBills
                    ? buildSelectedBillAmounts(
                          billPayables,
                          selectedBillIds,
                          selectedBillNumbers,
                      )
                    : { billAmounts: {}, suggestedPaymentAmount: '' };

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

                const payBy = normalizePrefillPayBy(
                    overrides.payBy || utilityPrefillRef.current?.payBy,
                );
                const employeeName = String(
                    overrides.payByEmployeeName ||
                        utilityPrefillRef.current?.payByEmployeeName ||
                        '',
                ).trim();
                let paidThroughAccountId = String(overrides.paidThroughAccountId || '').trim();
                if (!paidThroughAccountId && payBy === 'employee' && employeeName) {
                    const matched = findEmployeePaidThroughAccount(mappedAccounts, employeeName);
                    if (matched?.id) paidThroughAccountId = matched.id;
                }

                setPayables(billPayables);
                setForm((prev) => ({
                    ...prev,
                    vendorId,
                    locationId: nextLocationId,
                    locationName: nextLocationName,
                    currencyCode: String(defaults.currency_code || 'AED').trim() || 'AED',
                    paymentNumber: nextPaymentNumber || prev.paymentNumber,
                    date: String(overrides.date || '').trim() || todayKey(),
                    amount: hasAmountOverride
                        ? String(overrides.amount)
                        : suggestedPaymentAmount || '',
                    referenceNumber: overrides.referenceNumber ?? '',
                    notes: overrides.notes ?? '',
                    ...(paidThroughAccountId ? { paidThroughAccountId } : {}),
                }));
                setBillAmounts(nextBillAmounts);
                setSelectedPayableIds(new Set(Object.keys(nextBillAmounts)));

                // If Zoho bill ids/numbers were requested but none matched open unpaid bills, surface that.
                if (hasPrefillBills && !Object.keys(nextBillAmounts).length) {
                    setError(
                        'No matching unpaid Zoho bills found for the selected utility bill(s). Check Zoho sync, then select bills manually.',
                    );
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
            setSelectedPayableIds(new Set());
            setVendorDetails(null);
            setVendorPanelOpen(false);
            return;
        }

        void loadVendorDetails(vendorId, { openPanel: true });
        await applyVendorSelection(vendorId, vendors);
    };

    // Prefill (e.g. redirected from Utility Bills "Pay"): auto-select the matching
    // vendor by id or provider name and pre-check matching Zoho bills once vendors load.
    const prefillAppliedRef = useRef('');
    useEffect(() => {
        if (!isPage && !isOpen) {
            prefillAppliedRef.current = '';
            utilityPrefillRef.current = null;
            return;
        }
        if (!prefill || !vendors.length || isEdit) return;

        const selectedBillIds = Array.isArray(prefill.selectedBillIds)
            ? prefill.selectedBillIds
            : Array.isArray(prefill.zohoBillIds)
              ? prefill.zohoBillIds
              : [];
        const selectedBillNumbers = Array.isArray(prefill.utilityBillLinks)
            ? prefill.utilityBillLinks
                  .map((link) => String(link?.billNumber || '').trim())
                  .filter(Boolean)
            : Array.isArray(prefill.fineBillLinks)
              ? prefill.fineBillLinks
                    .map((link) => String(link?.billNumber || '').trim())
                    .filter(Boolean)
              : [];

        const key = JSON.stringify({
            v: prefill.vendorId || '',
            n: prefill.vendorName || '',
            a: prefill.amount || '',
            d: prefill.date || '',
            b: selectedBillIds,
            bn: selectedBillNumbers,
            u: prefill.utilityBatchId || '',
            f: prefill.fineMongoId || '',
            o: organizationId || prefill.organizationId || '',
        });
        if (prefillAppliedRef.current === key) return;
        prefillAppliedRef.current = key;
        utilityPrefillRef.current = prefill;

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
            void loadVendorDetails(match.id, { openPanel: true });
            void applyVendorSelection(match.id, vendors, {
                amount: prefill.amount,
                date: prefill.date,
                referenceNumber: prefill.referenceNumber,
                notes: prefill.notes,
                selectedBillIds,
                selectedBillNumbers,
                payBy: prefill.payBy,
                payByEmployeeName: prefill.payByEmployeeName,
                paidThroughAccountId: prefill.paidThroughAccountId,
            });
            return;
        }

        setForm((prev) => ({
            ...prev,
            amount:
                prefill.amount != null && prefill.amount !== ''
                    ? String(prefill.amount)
                    : prev.amount,
            date: String(prefill.date || '').trim() || prev.date,
            referenceNumber: prefill.referenceNumber || prev.referenceNumber,
            notes: prefill.notes || prev.notes,
        }));
        if (wantedName || wantedId) {
            setError(
                `Could not auto-match vendor "${prefill.vendorName || prefill.vendorId}". Please select the vendor manually.`,
            );
        }
    }, [applyVendorSelection, isEdit, isOpen, isPage, loadVendorDetails, organizationId, prefill, vendors]);

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

    const effectivePaidThroughOrgId = paidThroughOrgId || organizationId;
    const isCrossOrgPaidThrough = Boolean(
        paidThroughOrgId && organizationId && paidThroughOrgId !== organizationId,
    );
    const paidThroughOrgOption = useMemo(
        () =>
            zohoOrgOptions.find((opt) => opt.organizationId === effectivePaidThroughOrgId) || null,
        [zohoOrgOptions, effectivePaidThroughOrgId],
    );

    // When Paid Through points at the other org (e.g. NNIT employee pays a VEGA bill),
    // pull that org's Chart of Accounts for the dropdown.
    useEffect(() => {
        if (!isCrossOrgPaidThrough) {
            setCrossOrgAccounts([]);
            return undefined;
        }
        let cancelled = false;
        setLoadingCrossOrgAccounts(true);
        axiosInstance
            .get('/zoho/vendorpayments/support', {
                skipToast: true,
                timeout: 120000,
                params: { organizationId: paidThroughOrgId, accountsOnly: 'true' },
            })
            .then((response) => {
                if (cancelled) return;
                setCrossOrgAccounts(mapZohoPaymentAccounts(response?.data?.data?.accounts));
            })
            .catch((err) => {
                if (cancelled) return;
                console.warn(
                    '[AddVendorPayment] Cross-org accounts load failed:',
                    err?.response?.data?.message || err?.message || err,
                );
                setCrossOrgAccounts([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingCrossOrgAccounts(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isCrossOrgPaidThrough, paidThroughOrgId]);

    // New payment org context → Paid Through defaults back to that org's accounts.
    useEffect(() => {
        setPaidThroughOrgId('');
        setCrossOrgAccounts([]);
    }, [organizationId]);

    const handlePaidThroughOrgSwitch = (nextOrgId) => {
        const id = String(nextOrgId || '').trim();
        if (!id || id === effectivePaidThroughOrgId) return;
        setPaidThroughOrgId(id === organizationId ? '' : id);
        setField('paidThroughAccountId', '');
    };

    const paidThroughOptions = useMemo(() => {
        const groups = new Map();
        const sourceAccounts = isCrossOrgPaidThrough ? crossOrgAccounts : accounts;

        sourceAccounts.forEach((account) => {
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
    }, [accounts, crossOrgAccounts, isCrossOrgPaidThrough]);

    const flatPaidThroughOptions = useMemo(
        () => paidThroughOptions.flatMap((group) => group.options || []),
        [paidThroughOptions],
    );

    const selectedPaidThrough = useMemo(
        () =>
            flatPaidThroughOptions.find((option) => option.value === form.paidThroughAccountId) ||
            null,
        [form.paidThroughAccountId, flatPaidThroughOptions],
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
        setSelectedPayableIds((prev) => {
            const next = new Set(prev);
            if (amountValue(value) > 0) {
                next.add(billId);
            }
            return next;
        });
    };

    const appliedOutsideVisible = useMemo(() => {
        const visibleIds = new Set(visiblePayables.map((row) => row.id));
        return Object.entries(billAmounts).reduce((sum, [id, value]) => {
            if (visibleIds.has(id) || !selectedPayableIds.has(id)) return sum;
            return sum + amountValue(value);
        }, 0);
    }, [billAmounts, selectedPayableIds, visiblePayables]);

    const allVisibleChecked =
        visiblePayables.length > 0 &&
        visiblePayables.every((row) => selectedPayableIds.has(row.id));

    const applyAmountToRow = useCallback(
        (row, checked, currentAmounts, paymentTotal) => {
            if (!checked) {
                return { ...currentAmounts, [row.id]: '' };
            }

            const currentApplied = Object.entries(currentAmounts).reduce(
                (sum, [id, value]) => {
                    if (id === row.id) return sum;
                    return sum + amountValue(value);
                },
                0,
            );
            const available = Math.max(paymentTotal - currentApplied, 0);
            const apply = Math.min(Number(row.balance) || 0, available);
            return {
                ...currentAmounts,
                [row.id]: apply > 0 ? apply.toFixed(2) : (Number(row.balance) || 0).toFixed(2),
            };
        },
        [],
    );

    const handleRowCheck = (row, checked) => {
        let nextPayment = paymentAmount;

        if (checked && nextPayment <= 0) {
            nextPayment = Number(row.balance) || 0;
            if (nextPayment > 0) {
                setField('amount', nextPayment.toFixed(2));
            }
        }

        setSelectedPayableIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(row.id);
            else next.delete(row.id);
            return next;
        });

        setBillAmounts((prev) =>
            applyAmountToRow(
                row,
                checked,
                prev,
                nextPayment > 0 ? nextPayment : Number(row.balance) || 0,
            ),
        );
    };

    const handleSelectAllVisible = (checked) => {
        if (!checked) {
            setSelectedPayableIds((prev) => {
                const next = new Set(prev);
                visiblePayables.forEach((row) => next.delete(row.id));
                return next;
            });
            setBillAmounts((prev) => {
                const next = { ...prev };
                visiblePayables.forEach((row) => {
                    next[row.id] = '';
                });
                return next;
            });
            return;
        }

        const otherApplied = appliedOutsideVisible;
        const dueTotal = visiblePayables.reduce(
            (sum, row) => sum + (Number(row.balance) || 0),
            0,
        );
        let pool = paymentAmount;
        if (pool <= 0) {
            pool = otherApplied + dueTotal;
            if (pool > 0) {
                setField('amount', pool.toFixed(2));
            }
        }

        let remaining = Math.max(pool - otherApplied, 0);
        setSelectedPayableIds((prev) => {
            const next = new Set(prev);
            visiblePayables.forEach((row) => next.add(row.id));
            return next;
        });
        setBillAmounts((prev) => {
            const next = { ...prev };
            for (const row of visiblePayables) {
                const apply = Math.min(Number(row.balance) || 0, remaining);
                next[row.id] =
                    apply > 0
                        ? apply.toFixed(2)
                        : (Number(row.balance) || 0) > 0
                          ? (Number(row.balance) || 0).toFixed(2)
                          : '';
                remaining = Math.max(remaining - apply, 0);
            }
            return next;
        });
    };

    const handleClearApplied = () => {
        setBillAmounts({});
        setSelectedPayableIds(new Set());
    };

    const handleSubmit = async (event, saveMode = 'paid') => {
        event?.preventDefault?.();
        if (saving) return;

        const asDraft = saveMode === 'draft';

        if (!form.vendorId) {
            setError('Select a vendor.');
            return;
        }
        if (paymentAmount <= 0) {
            setError('Enter a payment amount greater than zero.');
            return;
        }
        if (!String(form.paymentMode || '').trim()) {
            setError('Select a payment mode.');
            return;
        }
        if (!form.paidThroughAccountId) {
            setError('Select the paid through account from Chart of Accounts.');
            return;
        }
        if (appliedTotal - paymentAmount > 0.01) {
            setError('Bill allocations cannot exceed the payment amount.');
            return;
        }

        const appliedBills = payables
            .filter((row) => row.recordType === 'bill' && selectedPayableIds.has(row.id))
            .map((bill) => ({
                bill_id: bill.id,
                amount_applied: amountValue(billAmounts[bill.id]),
            }))
            .filter((bill) => bill.amount_applied > 0);

        if (!appliedBills.length) {
            setError('Select at least one bill and enter a payment amount.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const partyExpensesPayload = buildPartyExpensesPayloadForZoho({
                utilityPrefill: utilityPrefillRef.current,
                paymentAmount,
            });

            const prefillRef = utilityPrefillRef.current;
            const fineMongoIds = []
                .concat(prefillRef?.fineMongoIds || prefillRef?.fineMongoId || [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);

            const payload = {
                vendor_id: form.vendorId,
                date: form.date,
                amount: paymentAmount,
                paid_through_account_id: form.paidThroughAccountId,
                paid_through_account_name: selectedPaidThrough?.label || '',
                payment_mode: form.paymentMode,
                reference_number: form.referenceNumber,
                description: form.notes,
                location_id: form.locationId,
                bills: appliedBills,
                expenses: [],
                is_draft: asDraft,
                status: asDraft ? 'draft' : 'paid',
                ...(organizationId ? { organizationId } : {}),
                ...(isCrossOrgPaidThrough
                    ? {
                          paid_through_organization_id: paidThroughOrgId,
                          paid_through_org_brand: paidThroughOrgOption?.brand || '',
                          payment_org_brand: activeZohoOrg?.brand || '',
                      }
                    : {}),
                ...(fineMongoIds.length
                    ? { fineMongoIds, mode: prefillRef?.mode || 'fine_bills' }
                    : {}),
                ...(!asDraft && partyExpensesPayload.length
                    ? {
                          party_expenses: partyExpensesPayload,
                          mode: utilityPrefillRef.current?.mode || 'difference',
                          utilityType: utilityPrefillRef.current?.utilityType || '',
                          billMonth: utilityPrefillRef.current?.billMonth || '',
                          utilityBatchId: utilityPrefillRef.current?.utilityBatchId || '',
                      }
                    : {}),
            };

            if (isEdit) {
                await axiosInstance.put(
                    `/zoho/vendorpayments/${encodeURIComponent(editPaymentId)}`,
                    payload,
                    { params: orgQuery() },
                );
                toast({
                    title: asDraft ? 'Draft updated' : 'Payment updated',
                    description: asDraft
                        ? 'The vendor payment draft was updated in Zoho Books.'
                        : 'The vendor payment was updated as paid in Zoho Books.',
                });
            } else {
                const createRes = await axiosInstance.post('/zoho/vendorpayments', payload, {
                    params: orgQuery(),
                });
                const zohoPayment =
                    createRes?.data?.data || createRes?.data?.vendorpayment || createRes?.data || {};
                const zohoPaymentId = String(
                    zohoPayment.payment_id ||
                        zohoPayment.vendorpayment_id ||
                        zohoPayment.id ||
                        '',
                ).trim();
                const zohoPaymentNumber = String(
                    zohoPayment.payment_number || zohoPayment.payment_no || '',
                ).trim();

                toast({
                    title: asDraft ? 'Saved as draft' : 'Saved as paid',
                    description: activeZohoOrg?.brand
                        ? asDraft
                            ? `Draft payment saved in ${activeZohoOrg.brand} Zoho Books (status: Draft).`
                            : `Payment recorded as Paid in ${activeZohoOrg.brand} Zoho Books.`
                        : asDraft
                          ? 'Draft payment saved in Zoho Books (status: Draft).'
                          : 'Payment recorded as Paid in Zoho Books.',
                });

                // Paid only: settle utility bills + post ERP Accounts / party expense ledger.
                if (!asDraft) {
                    const utilityPrefill = utilityPrefillRef.current;
                    const isFinePay =
                        String(utilityPrefill?.mode || '').toLowerCase() === 'fine_bills' ||
                        Boolean(utilityPrefill?.fineMongoId);
                    const utilityBatchId = String(utilityPrefill?.utilityBatchId || '').trim();
                    if (!isFinePay && (utilityBatchId || utilityPrefill?.partyRows?.length)) {
                        const appliedZohoIds = new Set(
                            appliedBills.map((bill) => String(bill.bill_id)),
                        );
                        const links = Array.isArray(utilityPrefill?.utilityBillLinks)
                            ? utilityPrefill.utilityBillLinks
                            : [];
                        let billIdsToPay = [];
                        if (links.length) {
                            const hasAnyZohoLink = links.some((link) =>
                                String(link?.zohoBillId || '').trim(),
                            );
                            billIdsToPay = links
                                .filter((link) => {
                                    const zohoId = String(link?.zohoBillId || '').trim();
                                    if (zohoId) return appliedZohoIds.has(zohoId);
                                    return !hasAnyZohoLink;
                                })
                                .map((link) => String(link.utilityBillId || '').trim())
                                .filter(Boolean);
                        } else if (Array.isArray(utilityPrefill?.utilityBillIds)) {
                            billIdsToPay = utilityPrefill.utilityBillIds
                                .map((id) => String(id || '').trim())
                                .filter(Boolean);
                        }

                        if (
                            utilityBatchId &&
                            billIdsToPay.length &&
                            String(utilityPrefill?.mode || '').toLowerCase() === 'bills'
                        ) {
                            try {
                                await axiosInstance.put(
                                    `/UtilityBill/batch/${utilityBatchId}/pay`,
                                    {
                                        billIds: billIdsToPay,
                                    },
                                );
                            } catch (payErr) {
                                console.error(
                                    '[AddVendorPayment] Utility bill mark-paid failed:',
                                    payErr,
                                );
                                toast({
                                    variant: 'destructive',
                                    title: 'Zoho payment saved',
                                    description:
                                        payErr?.response?.data?.message ||
                                        'Could not mark utility bills as Paid. Update them from Utility Bills.',
                                });
                            }
                        }

                        // Extra / difference payment → ERP Accounts (+ company party) or employee payable.
                        await postErpPartyPaymentsFromUtilityPrefill({
                            utilityPrefill,
                            billIdsToPay,
                            paidThroughAccountName: selectedPaidThrough?.label || '',
                            paymentDate: form.date,
                            notes: form.notes,
                        });

                        // Backend already marks Expenses Paid + Zoho debit/credit on create.
                        // Fallback only if party_expenses was not processed server-side.
                        const serverExpenseRows = Array.isArray(createRes?.data?.partyExpenses)
                            ? createRes.data.partyExpenses
                            : [];
                        const serverOk = serverExpenseRows.some((r) => r?.ok);
                        if (!serverOk) {
                            await storePartyExpensesFromVendorPayment({
                                utilityPrefill,
                                billIdsToPay,
                                zohoPaymentId,
                                zohoPaymentNumber,
                                paidThroughAccountId: form.paidThroughAccountId,
                                paidThroughAccountName: selectedPaidThrough?.label || '',
                                paymentMode: form.paymentMode,
                                paymentDate: form.date,
                                notes: form.notes,
                                organizationId,
                            });
                        }
                    }
                }
            }
            onSuccess?.();
            onClose?.();
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    (isEdit
                        ? 'Failed to update payment made in Zoho Books'
                        : 'Failed to create payment made in Zoho Books'),
            );
        } finally {
            setSaving(false);
        }
    };

    /** When Save as Paid: company share → Accounts Payments (company party); employee → Accounts with employee id. */
    const postErpPartyPaymentsFromUtilityPrefill = async ({
        utilityPrefill,
        billIdsToPay = [],
        paidThroughAccountName = '',
        paymentDate,
        notes,
    }) => {
        const partyRows = Array.isArray(utilityPrefill?.partyRows)
            ? utilityPrefill.partyRows
            : [];
        const rows =
            partyRows.length > 0
                ? partyRows.filter((row) =>
                      billIdsToPay.length
                          ? billIdsToPay.includes(String(row.utilityBillId || ''))
                          : true,
                  )
                : [];

        // Fallback: single party from prefill header fields (difference pay flow).
        if (!rows.length && utilityPrefill) {
            const payBy = normalizePrefillPayBy(utilityPrefill.payBy);
            const companyAmt = amountValue(utilityPrefill.companyPayAmount);
            const employeeAmt = amountValue(utilityPrefill.employeePayAmount);
            const totalAmt = amountValue(utilityPrefill.amount) || paymentAmount;
            if (payBy === 'company' || (companyAmt > 0 && !payBy)) {
                rows.push({
                    payBy: 'company',
                    amount: companyAmt > 0 ? companyAmt : totalAmt,
                    payByCompanyId: utilityPrefill.payByCompanyId || utilityPrefill.companyId,
                    payByCompanyName: utilityPrefill.payByCompanyName || '',
                    utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    accountNo: '',
                });
            } else if (payBy === 'employee' || employeeAmt > 0) {
                rows.push({
                    payBy: 'employee',
                    amount: employeeAmt > 0 ? employeeAmt : totalAmt,
                    payByEmployeeId: utilityPrefill.payByEmployeeId || '',
                    payByEmployeeName: utilityPrefill.payByEmployeeName || '',
                    utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    accountNo: '',
                });
            } else if (payBy === 'employee_and_company') {
                if (companyAmt > 0) {
                    rows.push({
                        payBy: 'company',
                        amount: companyAmt,
                        payByCompanyId: utilityPrefill.payByCompanyId || utilityPrefill.companyId,
                        payByCompanyName: utilityPrefill.payByCompanyName || '',
                        utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    });
                }
                if (employeeAmt > 0) {
                    rows.push({
                        payBy: 'employee',
                        amount: employeeAmt,
                        payByEmployeeId: utilityPrefill.payByEmployeeId || '',
                        payByEmployeeName: utilityPrefill.payByEmployeeName || '',
                        utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    });
                }
            }
        }

        if (!rows.length) return;

        const paidThroughLabel = String(paidThroughAccountName || '').trim();
        const posts = [];

        for (const row of rows) {
            const payBy = normalizePrefillPayBy(row.payBy);
            const companyAmt = amountValue(row.companyPayAmount);
            const employeeAmt = amountValue(row.employeePayAmount);
            const fallbackAmt = amountValue(row.amount);

            if (payBy === 'employee_and_company' || (companyAmt > 0 && employeeAmt > 0)) {
                if (companyAmt > 0) {
                    posts.push({ ...row, payBy: 'company', amount: companyAmt });
                }
                if (employeeAmt > 0) {
                    posts.push({ ...row, payBy: 'employee', amount: employeeAmt });
                }
                continue;
            }
            if (payBy === 'company' || (companyAmt > 0 && payBy !== 'employee')) {
                posts.push({
                    ...row,
                    payBy: 'company',
                    amount: companyAmt > 0 ? companyAmt : fallbackAmt,
                });
                continue;
            }
            if (payBy === 'employee' || employeeAmt > 0) {
                posts.push({
                    ...row,
                    payBy: 'employee',
                    amount: employeeAmt > 0 ? employeeAmt : fallbackAmt,
                });
            }
        }

        for (const row of posts) {
            const amount = amountValue(row.amount);
            if (amount <= 0) continue;
            const payBy = normalizePrefillPayBy(row.payBy);
            const isCompany = payBy === 'company';
            const paidBy = isCompany
                ? COMPANY_PARTY_ID
                : String(row.payByEmployeeId || utilityPrefill?.payByEmployeeId || '').trim();
            if (!paidBy) {
                console.warn(
                    '[AddVendorPayment] Skip ERP party payment — missing paidBy for',
                    row,
                );
                continue;
            }

            const partyLabel = isCompany
                ? String(row.payByCompanyName || 'Company').trim()
                : String(row.payByEmployeeName || paidThroughLabel || 'Employee').trim();

            try {
                await axiosInstance.post('/Payment', {
                    paymentType: 'UtilityBill',
                    paidBy,
                    amount,
                    status: 'Completed',
                    paymentDate: paymentDate || todayKey(),
                    description: [
                        'Zoho Payments Made ·',
                        isCompany ? 'Company share (Accounts / penalties)' : 'Employee share',
                        partyLabel ? `(${partyLabel})` : '',
                        paidThroughLabel && !isCompany
                            ? `· Paid Through: ${paidThroughLabel}`
                            : '',
                        notes ? `· ${notes}` : '',
                        row.accountNo ? `· Acc ${row.accountNo}` : '',
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .trim(),
                    referenceId:
                        row.accountNo ||
                        row.utilityBillId ||
                        utilityPrefill?.utilityBatchId ||
                        null,
                    relatedEntityType: 'UtilityBill',
                    relatedEntityId: row.utilityBillId || null,
                    paymentSource: 'Salary',
                });
            } catch (erpErr) {
                console.error('[AddVendorPayment] ERP Accounts payment failed:', erpErr);
                toast({
                    variant: 'destructive',
                    title: 'Zoho payment saved',
                    description:
                        erpErr?.response?.data?.message ||
                        `Could not store ${isCompany ? 'company' : 'employee'} share in Accounts Payments.`,
                });
            }
        }
    };

    /** After Save as Paid on Pay difference only: write balance Expense Paid + debit/credit. */
    const storePartyExpensesFromVendorPayment = async ({
        utilityPrefill,
        billIdsToPay = [],
        zohoPaymentId = '',
        zohoPaymentNumber = '',
        paidThroughAccountId = '',
        paidThroughAccountName = '',
        paymentMode = '',
        paymentDate,
        notes,
        organizationId: orgId,
    }) => {
        if (!paidThroughAccountId) return;
        const mode = String(utilityPrefill?.mode || '').trim().toLowerCase();
        if (mode && mode !== 'difference') return;

        const partyRows = Array.isArray(utilityPrefill?.partyRows)
            ? utilityPrefill.partyRows
            : [];
        const rows =
            partyRows.length > 0
                ? partyRows.filter((row) =>
                      billIdsToPay.length
                          ? billIdsToPay.includes(String(row.utilityBillId || ''))
                          : true,
                  )
                : [];

        if (!rows.length && utilityPrefill) {
            const payBy = normalizePrefillPayBy(utilityPrefill.payBy);
            const companyAmt = amountValue(utilityPrefill.companyPayAmount);
            const employeeAmt = amountValue(utilityPrefill.employeePayAmount);
            const totalAmt = amountValue(utilityPrefill.amount) || paymentAmount;
            if (payBy === 'company' || (companyAmt > 0 && !payBy)) {
                rows.push({
                    payBy: 'company',
                    amount: companyAmt > 0 ? companyAmt : totalAmt,
                    payByCompanyId: utilityPrefill.payByCompanyId || utilityPrefill.companyId,
                    payByCompanyName: utilityPrefill.payByCompanyName || 'VEGA Digital',
                    utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    accountNo: '',
                });
            } else if (payBy === 'employee' || employeeAmt > 0) {
                rows.push({
                    payBy: 'employee',
                    amount: employeeAmt > 0 ? employeeAmt : totalAmt,
                    payByEmployeeId: utilityPrefill.payByEmployeeId || '',
                    payByEmployeeName: utilityPrefill.payByEmployeeName || '',
                    utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    accountNo: '',
                });
            } else if (payBy === 'employee_and_company') {
                if (companyAmt > 0) {
                    rows.push({
                        payBy: 'company',
                        amount: companyAmt,
                        payByCompanyId: utilityPrefill.payByCompanyId || utilityPrefill.companyId,
                        payByCompanyName: utilityPrefill.payByCompanyName || 'VEGA Digital',
                        utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    });
                }
                if (employeeAmt > 0) {
                    rows.push({
                        payBy: 'employee',
                        amount: employeeAmt,
                        payByEmployeeId: utilityPrefill.payByEmployeeId || '',
                        payByEmployeeName: utilityPrefill.payByEmployeeName || '',
                        utilityBillId: utilityPrefill.utilityBillIds?.[0] || '',
                    });
                }
            }
        }

        const linkByBill = new Map(
            (Array.isArray(utilityPrefill?.utilityBillLinks)
                ? utilityPrefill.utilityBillLinks
                : []
            ).map((link) => [String(link.utilityBillId || ''), link]),
        );

        for (const row of rows) {
            const amount = amountValue(row.amount || row.employeePayAmount || row.companyPayAmount);
            if (amount <= 0) continue;
            const payBy = normalizePrefillPayBy(row.payBy);
            const isCompany = payBy === 'company';
            const link = linkByBill.get(String(row.utilityBillId || '')) || {};

            try {
                await axiosInstance.post('/Expense/from-vendor-payment', {
                    payBy: isCompany ? 'company' : 'employee',
                    partyType: isCompany ? 'company' : 'employee',
                    amount,
                    date: paymentDate || todayKey(),
                    employeeId: isCompany
                        ? COMPANY_PARTY_ID
                        : row.payByEmployeeId || utilityPrefill?.payByEmployeeId,
                    employeeName: isCompany
                        ? row.payByCompanyName || 'VEGA Digital'
                        : row.payByEmployeeName || utilityPrefill?.payByEmployeeName,
                    companyId: row.payByCompanyId || utilityPrefill?.companyId || '',
                    companyName:
                        row.payByCompanyName || utilityPrefill?.payByCompanyName || 'VEGA Digital',
                    utilityBillId: row.utilityBillId || '',
                    utilityBatchId: utilityPrefill?.utilityBatchId || '',
                    accountNo: row.accountNo || '',
                    utilityType: utilityPrefill?.utilityType || '',
                    billMonth: utilityPrefill?.billMonth || '',
                    zohoBillId: link.zohoBillId || '',
                    zohoPaymentId,
                    zohoPaymentNumber,
                    organizationId: orgId || utilityPrefill?.organizationId || '',
                    paidThroughAccountId,
                    paidThroughAccountName,
                    paymentMode,
                    description: notes || utilityPrefill?.notes || '',
                    notes,
                });
            } catch (expErr) {
                console.error('[AddVendorPayment] Party expense store failed:', expErr);
                toast({
                    variant: 'destructive',
                    title: 'Zoho payment saved',
                    description:
                        expErr?.response?.data?.message ||
                        'Could not store Expenses ledger (debit/credit) for this party.',
                });
            }
        }
    };

    if (!isPage && !isOpen) return null;

    const shellClass = isPage
        ? 'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
        : 'w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-2xl bg-white shadow-2xl';
    const formScrollClass = isPage ? '' : 'overflow-y-auto max-h-[calc(94vh-73px)]';

    const content = (
            <div className={shellClass}>
                <div className="flex flex-col gap-3 border-b border-slate-200 px-4 sm:px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                            {isEdit ? 'Edit Payment' : 'Record Payment'}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500">
                            {isEdit
                                ? 'Update this vendor payment in Zoho Books.'
                                : 'Add a payment made to a vendor in Zoho Books.'}
                            {activeZohoOrg?.brand ? (
                                <span className="ml-1 font-semibold text-slate-700">
                                    ({activeZohoOrg.brand})
                                </span>
                            ) : null}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        {zohoOrgOptions.length > 1 ? (
                            <ZohoOrganizationPicker
                                options={zohoOrgOptions}
                                value={organizationId}
                                onChange={(nextOrgId) => {
                                    if (nextOrgId === organizationId) return;
                                    rememberZohoOrganizationId(nextOrgId);
                                    setOrganizationId(nextOrgId);
                                    setForm((prev) => ({
                                        ...prev,
                                        vendorId: '',
                                        paidThroughAccountId: '',
                                        paymentMode: 'Cash',
                                        paymentNumber: '',
                                        amount: '',
                                        referenceNumber: '',
                                        notes: '',
                                    }));
                                    setVendors([]);
                                    setAccounts([]);
                                    setPaymentModes([]);
                                    setPayables([]);
                                    setBillAmounts({});
                                    setSelectedPayableIds(new Set());
                                    setVendorDetails(null);
                                    setVendorPanelOpen(false);
                                    utilityPrefillRef.current = null;
                                    setError('');
                                }}
                                disabled={saving || isEdit}
                                loading={loadingOrgs || loading}
                                size="sm"
                            />
                        ) : null}
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
                </div>

                <form
                    onSubmit={(event) => handleSubmit(event, 'paid')}
                    className={formScrollClass}
                >
                    <div className="space-y-5 px-4 sm:px-6 py-5">
                        {error ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        ) : null}

                        {loading || loadingOrgs || !organizationId ? (
                            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                                <Loader2 size={18} className="animate-spin" />
                                {loadingOrgs || !organizationId
                                    ? 'Loading Zoho organization...'
                                    : `Loading ${activeZohoOrg?.brand || 'Zoho'} vendors & accounts...`}
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
                                                instanceId="zoho-vendor-payment"
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
                                                    'No vendors found — refresh Accounts → Vendors'
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
                                                instanceId="zoho-payment-location"
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
                                            <span className="text-xs font-bold text-red-600">
                                                Payment Mode <span className="text-blue-600">*</span>
                                            </span>
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

                                        <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-start gap-1.5 sm:gap-3">
                                            <span className="text-xs font-bold text-red-600 sm:pt-2.5">
                                                Paid Through <span className="text-blue-600">*</span>
                                            </span>
                                            <div className="space-y-1.5">
                                                {zohoOrgOptions.length > 1 && (
                                                    <div className="flex items-center gap-1.5">
                                                        {zohoOrgOptions.map((opt) => {
                                                            const isActiveTab =
                                                                opt.organizationId ===
                                                                effectivePaidThroughOrgId;
                                                            return (
                                                                <button
                                                                    key={opt.organizationId}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handlePaidThroughOrgSwitch(
                                                                            opt.organizationId,
                                                                        )
                                                                    }
                                                                    disabled={saving}
                                                                    className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                                                                        isActiveTab
                                                                            ? 'border-blue-600 bg-blue-600 text-white'
                                                                            : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600'
                                                                    }`}
                                                                    title={`Show ${opt.brand || opt.label} Chart of Accounts`}
                                                                >
                                                                    {opt.brand || opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                        {isCrossOrgPaidThrough && (
                                                            <span className="text-[10px] text-amber-600">
                                                                Payment stays in{' '}
                                                                {activeZohoOrg?.brand || 'this org'};
                                                                credit posts in{' '}
                                                                {paidThroughOrgOption?.brand || 'other org'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <Select
                                                classNamePrefix="zoho-paid-through"
                                                instanceId="zoho-paid-through"
                                                value={selectedPaidThrough}
                                                onChange={(option) =>
                                                    setField('paidThroughAccountId', option?.value || '')
                                                }
                                                options={paidThroughOptions}
                                                isLoading={loadingCrossOrgAccounts}
                                                isClearable
                                                isSearchable
                                                placeholder={
                                                    loadingCrossOrgAccounts
                                                        ? `Loading ${paidThroughOrgOption?.brand || ''} accounts…`
                                                        : paidThroughOrgOption?.brand
                                                          ? `Select ${paidThroughOrgOption.brand} Chart of Accounts`
                                                          : 'Select Chart of Accounts'
                                                }
                                                noOptionsMessage={() =>
                                                    'No accounts found in Zoho Chart of Accounts'
                                                }
                                                formatGroupLabel={(group) => (
                                                    <div className="flex items-center justify-between py-0.5">
                                                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                                            {group.label}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {group.options?.length || 0}
                                                        </span>
                                                    </div>
                                                )}
                                                styles={locationSelectStyles}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined' ? document.body : null
                                                }
                                                menuPosition="fixed"
                                                menuPlacement="auto"
                                                />
                                            </div>
                                        </label>
                                    </div>

                                    <div className="flex items-start justify-end">
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
                                            className="inline-flex max-w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            title={
                                                form.vendorId
                                                    ? 'Show vendor details'
                                                    : 'Select a vendor first'
                                            }
                                        >
                                            {loadingVendor ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : null}
                                            <span className="truncate">
                                                {loadingVendor
                                                    ? 'Loading vendor…'
                                                    : selectedVendor?.label || 'Select Vendor'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    <div className="flex flex-col gap-2 border-b border-slate-200 px-3 sm:px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <label className="flex min-w-0 flex-1 items-center gap-2">
                                            <span className="shrink-0 text-xs font-semibold text-slate-600">
                                                Reference#
                                            </span>
                                            <input
                                                type="text"
                                                value={form.referenceNumber}
                                                onChange={(event) =>
                                                    setField('referenceNumber', event.target.value)
                                                }
                                                placeholder="Enter reference"
                                                className="h-9 w-full max-w-md rounded-md border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                            />
                                        </label>
                                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={handleClearApplied}
                                                className="text-xs font-semibold text-blue-600 hover:underline"
                                            >
                                                Clear Applied Amount
                                            </button>
                                            <div className="text-xs font-semibold text-slate-600">
                                                Remaining:{' '}
                                                <span className="tabular-nums text-slate-800">
                                                    {formatZohoPaymentMoney(
                                                        remainingAmount,
                                                        form.currencyCode,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex min-h-[320px] flex-col">
                                        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-blue-700">
                                                    Bills
                                                </span>
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] tabular-nums text-blue-700">
                                                    {billRows.length}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500">
                                                Check a bill to include it in this payment.
                                            </p>
                                        </div>

                                        <div className="flex min-w-0 flex-1 flex-col">
                                            {loadingBills ? (
                                                <div className="flex flex-1 items-center justify-center gap-2 px-3 py-10 text-sm text-slate-500">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Loading bills...
                                                </div>
                                            ) : null}

                                            {!loadingBills && !selectedVendor ? (
                                                <div className="flex flex-1 items-center justify-center px-3 py-10 text-center text-sm text-slate-500">
                                                    Select a vendor to load unpaid bills.
                                                </div>
                                            ) : null}

                                            {!loadingBills &&
                                            selectedVendor &&
                                            !visiblePayables.length ? (
                                                <div className="flex flex-1 items-center justify-center px-3 py-10 text-center text-sm text-slate-500">
                                                    No open bills found for this vendor.
                                                </div>
                                            ) : null}

                                            {!loadingBills && visiblePayables.length ? (
                                                <>
                                                    <div className="min-h-0 flex-1 overflow-x-auto">
                                                        <table className="min-w-[1000px] w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b border-slate-200 bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                                    <th className="w-10 px-3 py-2.5">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={allVisibleChecked}
                                                                            onChange={(event) =>
                                                                                handleSelectAllVisible(
                                                                                    event.target
                                                                                        .checked,
                                                                                )
                                                                            }
                                                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                                                                            aria-label="Select all bills"
                                                                        />
                                                                    </th>
                                                                    <th className="px-3 py-2.5">
                                                                        Date
                                                                    </th>
                                                                    <th className="px-3 py-2.5">
                                                                        Bill#
                                                                    </th>
                                                                    <th className="px-3 py-2.5">
                                                                        PO#
                                                                    </th>
                                                                    <th className="px-3 py-2.5">
                                                                        Location
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-right">
                                                                        Bill Amount
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-right">
                                                                        Amount Due
                                                                    </th>
                                                                    <th className="px-3 py-2.5">
                                                                        Payment Made On
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-right">
                                                                        Payment
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {visiblePayables.map((row) => {
                                                                    const checked =
                                                                        selectedPayableIds.has(
                                                                            row.id,
                                                                        );
                                                                    return (
                                                                        <tr
                                                                            key={`${row.recordType}-${row.id}`}
                                                                            className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/70 ${
                                                                                checked
                                                                                    ? 'bg-blue-50/40'
                                                                                    : ''
                                                                            }`}
                                                                        >
                                                                            <td className="px-3 py-2.5">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={checked}
                                                                                    onChange={(
                                                                                        event,
                                                                                    ) =>
                                                                                        handleRowCheck(
                                                                                            row,
                                                                                            event
                                                                                                .target
                                                                                                .checked,
                                                                                        )
                                                                                    }
                                                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                                                                                    aria-label={`Pay ${row.billNumber}`}
                                                                                />
                                                                            </td>
                                                                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                                                                                {row.date}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 font-medium text-slate-800">
                                                                                {row.billNumber}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-slate-600">
                                                                                {row.poNumber}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-slate-600">
                                                                                {row.location}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                                                                                {formatZohoPaymentMoney(
                                                                                    row.total,
                                                                                    row.currencyCode,
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-right">
                                                                                <button
                                                                                    type="button"
                                                                                    title="Apply amount due"
                                                                                    onClick={() =>
                                                                                        handleRowCheck(
                                                                                            row,
                                                                                            true,
                                                                                        )
                                                                                    }
                                                                                    className="tabular-nums text-blue-600 hover:underline"
                                                                                >
                                                                                    {formatZohoPaymentMoney(
                                                                                        row.balance,
                                                                                        row.currencyCode,
                                                                                    )}
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                                                                                {form.date || '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-right">
                                                                                {checked ? (
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        max={
                                                                                            row.balance
                                                                                        }
                                                                                        step="0.01"
                                                                                        value={
                                                                                            billAmounts[
                                                                                                row
                                                                                                    .id
                                                                                            ] || ''
                                                                                        }
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            handleBillAmountChange(
                                                                                                row.id,
                                                                                                event
                                                                                                    .target
                                                                                                    .value,
                                                                                            )
                                                                                        }
                                                                                        className="ml-auto h-9 w-28 rounded-md border border-slate-200 px-2 text-right text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                                                                    />
                                                                                ) : (
                                                                                    <span className="tabular-nums text-slate-300">
                                                                                        —
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="flex justify-end border-t border-slate-200 bg-[#fafbfc] px-4 py-2.5 text-sm font-semibold text-slate-700">
                                                        Total :{' '}
                                                        <span className="ml-2 tabular-nums">
                                                            {visiblePayables
                                                                .reduce((sum, row) => {
                                                                    if (
                                                                        !selectedPayableIds.has(
                                                                            row.id,
                                                                        )
                                                                    ) {
                                                                        return sum;
                                                                    }
                                                                    return (
                                                                        sum +
                                                                        amountValue(
                                                                            billAmounts[row.id],
                                                                        )
                                                                    );
                                                                }, 0)
                                                                .toFixed(2)}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <div className="w-full max-w-sm rounded-xl border border-amber-100 bg-[#fff8ef] px-4 py-3 text-sm text-slate-700">
                                        <div className="flex justify-between gap-4 py-1">
                                            <span>Amount Paid:</span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(
                                                    paymentAmount,
                                                    form.currencyCode,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-4 py-1">
                                            <span>Amount used for Payments:</span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(
                                                    appliedTotal,
                                                    form.currencyCode,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-4 py-1">
                                            <span>Amount Refunded:</span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(0, form.currencyCode)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-4 py-1 text-amber-800">
                                            <span className="inline-flex items-center gap-1.5">
                                                <AlertTriangle size={14} className="text-amber-600" />
                                                Amount in Excess:
                                            </span>
                                            <span className="font-semibold tabular-nums">
                                                {formatZohoPaymentMoney(
                                                    remainingAmount,
                                                    form.currencyCode,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <label className="block space-y-1.5">
                                    <span className="text-xs font-semibold text-slate-600">
                                        Notes{' '}
                                        <span className="font-normal text-slate-400">
                                            (Internal use. Not visible to vendor)
                                        </span>
                                    </span>
                                    <textarea
                                        value={form.notes}
                                        onChange={(event) => setField('notes', event.target.value)}
                                        rows={4}
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
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-start gap-2 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-4">
                        <button
                            type="button"
                            disabled={loading || saving || isEdit}
                            title={
                                isEdit
                                    ? 'Draft save applies when creating a new payment.'
                                    : 'Save payment as Draft in Zoho Books'
                            }
                            onClick={(event) => handleSubmit(event, 'draft')}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : null}
                            Save as Draft
                        </button>
                        <button
                            type="submit"
                            disabled={loading || saving}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            {isEdit ? 'Update Payment' : 'Save as Paid'}
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
