'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { ArrowDownAZ, ArrowLeft, ArrowUpAZ, ChevronDown, Plus, Calendar, CreditCard, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import {
    DETAIL_PAIR_COLUMN,
    DETAIL_PAIR_GRID,
    HEADER_PAIR_CARD_DASHBOARD,
    HEADER_PAIR_GRID,
} from '@/utils/headerPairLayout';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import {
    buildDetailFieldRows,
    clearUtilityBillDraft,
    entryLifecycleStatus,
    getMonthlyRentalAmount,
    isEntryActive,
    normalizeUtilityFields,
} from '../../utils/utilityBillsStorage';
import {
    deleteUtilityBillApi,
    deleteUtilityEntryApi,
    fetchUtilityEntry,
    updateUtilityEntryApi,
} from '../../utils/utilityBillsApi';
import FieldViewModal from '../../components/FieldViewModal';
import AddBillModal from '../../components/AddBillModal';
import ViewBillModal from '../../components/ViewBillModal';
import UtilityBillReviewModal from '../../components/UtilityBillReviewModal';
import ActivateDeactivateUtilityModal from '../../components/ActivateDeactivateUtilityModal';
import UtilityBillStatsCards from '../../components/UtilityBillStatsCards';
import { billDisplayStatus, formatBillMoney } from '../../utils/utilityBillStats';
import { openUtilityAttachment } from '../../utils/openUtilityAttachment';
import { loadUtilityBillPaymentInvoice } from '../../utils/utilityBillPaymentInvoice';
import PaymentInvoiceViewerModal from '@/app/Accounts/Payments/components/PaymentInvoiceViewerModal';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';

const MAX_INLINE_LEN = 48;

function paymentByLabel(mode) {
    if (mode === 'employee_balance' || mode === 'employee') return 'Pay by employee';
    if (mode === 'company') return 'Pay by company';
    if (mode === 'employee_and_company') return 'Pay by company / employee';
    return 'Awaiting workflow';
}

function statusBadgeClass(status) {
    const s = String(status || '');
    if (s === 'Pending Accounts') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (s === 'Pending HR') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s === 'Approved') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (s === 'Paid') return 'bg-teal-50 text-teal-800 border-teal-200';
    if (s === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
}

function billMonthKey(bill) {
    const raw = String(bill?.billMonth || '').trim();
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    if (bill?.createdAt) {
        const d = new Date(bill.createdAt);
        if (!Number.isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    }
    return '';
}

const MONTH_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

/** e.g. 2026-07 → "Jul 2026"; shortOnly → "Jul" */
function monthLabelFromKey(ym, { shortOnly = false } = {}) {
    if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return String(ym || 'Unknown');
    const [y, m] = String(ym).split('-').map(Number);
    const name = MONTH_SHORT[m - 1] || String(m);
    return shortOnly ? name : `${name} ${y}`;
}

function entryStatusBadgeClass(status) {
    return entryLifecycleStatus({ status }) === 'Active'
        ? 'bg-teal-50 text-teal-700 border-teal-200'
        : 'bg-gray-100 text-gray-500 border-gray-200';
}

function billSortTime(bill) {
    const t = bill?.createdAt ? new Date(bill.createdAt).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
}

/** Aggregate amounts / status counts for year or month browse rows. */
function summarizeBillGroup(list = []) {
    let contractTotal = 0;
    let actualTotal = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    const months = new Set();

    (list || []).forEach((bill) => {
        const contract = Number(bill?.monthlyRental) || 0;
        const actual = Number(bill?.amount) || 0;
        contractTotal += contract;
        actualTotal += actual;
        const ym = billMonthKey(bill);
        if (ym) months.add(ym);

        const status = String(bill?.status || '');
        if (status === 'Paid') paidCount += 1;
        else if (status === 'Rejected') rejectedCount += 1;
        else if (status === 'Approved') unpaidCount += 1;
        else if (status === 'Pending HR' || status === 'Pending Accounts') pendingCount += 1;
        else unpaidCount += 1;
    });

    return {
        billCount: (list || []).length,
        monthCount: months.size,
        contractTotal,
        actualTotal,
        difference: contractTotal - actualTotal,
        paidCount,
        unpaidCount,
        pendingCount,
        rejectedCount,
    };
}

function BillGroupSummaryStats({ summary, compact = false }) {
    if (!summary?.billCount) return null;

    const diffTone =
        summary.difference < 0
            ? 'text-red-600'
            : summary.difference > 0
              ? 'text-emerald-600'
              : 'text-gray-700';
    const labelCls = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
    const valueCls = compact
        ? 'text-sm font-semibold tabular-nums leading-tight'
        : 'text-sm sm:text-[15px] font-semibold tabular-nums leading-tight';

    const statusChips = [
        summary.paidCount > 0
            ? { key: 'paid', label: `${summary.paidCount} paid`, cls: 'bg-teal-50 text-teal-700' }
            : null,
        summary.unpaidCount > 0
            ? { key: 'due', label: `${summary.unpaidCount} due`, cls: 'bg-orange-50 text-orange-700' }
            : null,
        summary.pendingCount > 0
            ? {
                  key: 'pending',
                  label: `${summary.pendingCount} pending`,
                  cls: 'bg-amber-50 text-amber-700',
              }
            : null,
        summary.rejectedCount > 0
            ? {
                  key: 'rejected',
                  label: `${summary.rejectedCount} rejected`,
                  cls: 'bg-red-50 text-red-700',
              }
            : null,
    ].filter(Boolean);

    return (
        <div
            className={`flex flex-wrap items-center min-w-0 flex-1 justify-end gap-x-4 gap-y-2 sm:gap-x-6 ${
                compact ? '' : 'sm:justify-end'
            }`}
        >
            <div className="flex items-stretch gap-3 sm:gap-5">
                <div className="text-right min-w-[4.25rem]">
                    <p className={labelCls}>Total</p>
                    <p className={`${valueCls} text-teal-700`}>
                        {formatBillMoney(summary.actualTotal)}
                    </p>
                </div>
                <div
                    className="hidden sm:block w-px self-stretch bg-slate-200/80"
                    aria-hidden
                />
                <div className="hidden sm:block text-right min-w-[4.25rem]">
                    <p className={labelCls}>Contract</p>
                    <p className={`${valueCls} text-slate-800`}>
                        {formatBillMoney(summary.contractTotal)}
                    </p>
                </div>
                <div
                    className="hidden sm:block w-px self-stretch bg-slate-200/80"
                    aria-hidden
                />
                <div className="text-right min-w-[4.25rem]">
                    <p className={labelCls}>Diff</p>
                    <p className={`${valueCls} ${diffTone}`}>
                        {formatBillMoney(summary.difference)}
                    </p>
                </div>
            </div>

            {statusChips.length > 0 ? (
                <div className="hidden md:flex flex-wrap items-center justify-end gap-1.5">
                    {statusChips.map((chip) => (
                        <span
                            key={chip.key}
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${chip.cls}`}
                        >
                            {chip.label}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/**
 * Utility entry details — header cards, tabs, 1/2 type details + bills list with HR approval.
 */
function UtilityBillDetailsPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const canAdminDelete = isAdmin();
    const entryId = params?.id ? String(params.id) : '';

    const [entry, setEntry] = useState(null);
    const [utilityConfig, setUtilityConfig] = useState(null);
    const [bills, setBills] = useState([]);
    const [loadingBills, setLoadingBills] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewFields, setViewFields] = useState([]);
    const [addBillOpen, setAddBillOpen] = useState(false);
    const [viewBill, setViewBill] = useState(null);
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [savingBill, setSavingBill] = useState(false);
    const [reviewBatchId, setReviewBatchId] = useState('');
    const [statusChangeOpen, setStatusChangeOpen] = useState(false);
    const [statusChangeSaving, setStatusChangeSaving] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState(null);
    /** Bill card that should flash light green (2 on/off pulses). */
    const [pulseBillId, setPulseBillId] = useState('');
    const [pulseBillOn, setPulseBillOn] = useState(false);
    /** Bills tab accordion: open year keeps other years visible; open month keeps other months visible */
    const [billsBrowseYear, setBillsBrowseYear] = useState(null);
    const [billsBrowseMonth, setBillsBrowseMonth] = useState(null);
    /** Year list: 'desc' = newest first, 'asc' = oldest first */
    const [yearSort, setYearSort] = useState('desc');
    /** Month list within a year: 'asc' = Jan→Dec, 'desc' = Dec→Jan */
    const [monthSort, setMonthSort] = useState('asc');

    const focusBillId = searchParams?.get('billId') || '';

    const triggerBillPulse = useCallback((billId) => {
        const id = String(billId || '').trim();
        if (!id) return;
        setPulseBillId(id);
        setPulseBillOn(true);
    }, []);

    useEffect(() => {
        if (!pulseBillId) return undefined;
        let step = 0;
        const timer = window.setInterval(() => {
            step += 1;
            // Start ON; then off → on → off (2 light-green flashes)
            if (step >= 4) {
                window.clearInterval(timer);
                setPulseBillOn(false);
                setPulseBillId('');
                return;
            }
            setPulseBillOn(step % 2 === 0);
        }, 350);
        return () => window.clearInterval(timer);
    }, [pulseBillId]);

    const overviewBills = useMemo(
        () =>
            (bills || [])
                .slice()
                .sort((a, b) => billSortTime(b) - billSortTime(a))
                .slice(0, 5),
        [bills],
    );

    const billsByYear = useMemo(() => {
        const map = new Map();
        (bills || []).forEach((b) => {
            const ym = billMonthKey(b);
            if (!ym) return;
            const year = Number(ym.slice(0, 4));
            if (!map.has(year)) map.set(year, []);
            map.get(year).push(b);
        });
        return [...map.entries()].sort((a, b) =>
            yearSort === 'asc' ? a[0] - b[0] : b[0] - a[0],
        );
    }, [bills, yearSort]);

    /** year → [[YYYY-MM, bills[]], ...] sorted by monthSort */
    const monthsByYear = useMemo(() => {
        const byYear = new Map();
        (bills || []).forEach((b) => {
            const ym = billMonthKey(b);
            if (!ym) return;
            const year = Number(ym.slice(0, 4));
            if (!byYear.has(year)) byYear.set(year, new Map());
            const monthMap = byYear.get(year);
            if (!monthMap.has(ym)) monthMap.set(ym, []);
            monthMap.get(ym).push(b);
        });
        const result = new Map();
        byYear.forEach((monthMap, year) => {
            const entries = [...monthMap.entries()].sort((a, b) =>
                monthSort === 'asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]),
            );
            result.set(year, entries);
        });
        return result;
    }, [bills, monthSort]);

    const billsForBrowseMonth = useMemo(() => {
        if (!billsBrowseMonth) return [];
        return (bills || [])
            .filter((b) => billMonthKey(b) === billsBrowseMonth)
            .sort((a, b) => billSortTime(b) - billSortTime(a));
    }, [bills, billsBrowseMonth]);

    useEffect(() => {
        if (activeTab !== 'bills') {
            setBillsBrowseYear(null);
            setBillsBrowseMonth(null);
        }
    }, [activeTab]);

    useEffect(() => {
        if (!entryId) return;
        let cancelled = false;
        (async () => {
            try {
                const { entry: found, config } = await fetchUtilityEntry(entryId);
                if (cancelled) return;
                setEntry(found);
                if (config) {
                    setUtilityConfig({
                        ...config,
                        fields: normalizeUtilityFields(config.fields || {}),
                    });
                } else {
                    setUtilityConfig(null);
                }
            } catch {
                if (!cancelled) {
                    setEntry(null);
                    setUtilityConfig(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [entryId]);

    const loadBills = useCallback(async () => {
        if (!entryId) return;
        setLoadingBills(true);
        try {
            const res = await axiosInstance.get('/UtilityBill', {
                params: { entryId },
                skipToast: true,
            });
            setBills(Array.isArray(res.data?.bills) ? res.data.bills : []);
        } catch {
            setBills([]);
        } finally {
            setLoadingBills(false);
        }
    }, [entryId]);

    useEffect(() => {
        loadBills();
    }, [loadBills]);

    const loadPendingStatusChange = useCallback(async () => {
        if (!entryId) {
            setPendingStatusChange(null);
            return;
        }
        try {
            const res = await axiosInstance.get('/UtilityBill/status-change', {
                params: { entryId, status: 'Pending' },
                skipToast: true,
            });
            const list = Array.isArray(res.data?.requests) ? res.data.requests : [];
            const pending = list[0] || null;
            setPendingStatusChange(pending);

            if (pending) return;

            const approvedRes = await axiosInstance.get('/UtilityBill/status-change', {
                params: { entryId, status: 'Approved' },
                skipToast: true,
            });
            const approved = (approvedRes.data?.requests || [])[0];
            if (!approved?.requestedStatus) return;

            try {
                const { entry: local } = await fetchUtilityEntry(entryId);
                if (!local) return;
                if (entryLifecycleStatus(local) === approved.requestedStatus) return;

                const updated = await updateUtilityEntryApi(entryId, {
                    status: approved.requestedStatus,
                    pendingStatusChange: null,
                });
                if (updated) {
                    setEntry(updated);
                }
            } catch {
                /* ignore sync */
            }
        } catch {
            setPendingStatusChange(null);
        }
    }, [entryId]);

    useEffect(() => {
        loadPendingStatusChange();
    }, [loadPendingStatusChange]);

    useEffect(() => {
        if (!focusBillId || !bills.length) return;
        const bill = bills.find((b) => String(b._id) === String(focusBillId));
        if (!bill) return;
        const ym = billMonthKey(bill);
        const inLatestFive = overviewBills.some((b) => String(b._id) === String(focusBillId));
        if (inLatestFive) {
            setActiveTab('overview');
        } else if (ym) {
            setActiveTab('bills');
            setBillsBrowseYear(Number(ym.slice(0, 4)));
            setBillsBrowseMonth(ym);
        } else {
            setActiveTab('overview');
        }
        const t = window.setTimeout(() => {
            document
                .getElementById(`bill-${focusBillId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            triggerBillPulse(focusBillId);
        }, 80);
        return () => window.clearTimeout(t);
    }, [focusBillId, bills, overviewBills, triggerBillPulse]);

    const detailRows = useMemo(
        () => (entry ? buildDetailFieldRows(entry, utilityConfig) : []),
        [entry, utilityConfig],
    );

    const monthlyRental = getMonthlyRentalAmount(entry);

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'bills', label: 'Bills' },
    ];

    const handleAddBill = async (payload) => {
        if (!entry) return { ok: false };
        const rows = Array.isArray(payload?.rows) && payload.rows.length
            ? payload.rows
            : [
                  {
                      entryId: entry.id,
                      actualAmount: payload.amount,
                      contractAmount: monthlyRental,
                      accountNo: entry.values?.accountNumber || '',
                      difference: monthlyRental - Number(payload.amount),
                      attachment: payload.attachment || null,
                  },
              ];
        setSavingBill(true);
        try {
            const res = await axiosInstance.post('/UtilityBill/batch', {
                utilityType: entry.type,
                billMonth: payload.billMonth,
                notes: payload.notes || '',
                rows: rows.map((row) => ({
                    entryId: entry.id,
                    actualAmount: row.actualAmount,
                    contractAmount: row.contractAmount ?? monthlyRental,
                    accountNo: row.accountNo || entry.values?.accountNumber || '',
                    provider: row.provider || entry.values?.provider || '',
                    paymentDay: row.paymentDay ?? entry.values?.paymentDay ?? entry.values?.paymentDate,
                    billNumber: row.billNumber,
                    billDate: row.billDate || '',
                    expenseAccountId: row.expenseAccountId || payload.expenseAccountId,
                    expenseAccountName: row.expenseAccountName || payload.expenseAccountName,
                    partyAccountId: row.partyAccountId || '',
                    partyAccountName: row.partyAccountName || '',
                    partyAccountCode: row.partyAccountCode || '',
                    differenceAmount: row.difference,
                    payBy: row.payBy,
                    companyDiffAmount: row.companyDiffAmount,
                    employeeDiffAmount: row.employeeDiffAmount,
                    companyPayAmount: row.companyPayAmount,
                    employeePayAmount: row.employeePayAmount,
                    payByCompanyId: row.payByCompanyId,
                    payByCompanyName: row.payByCompanyName,
                    payByEmployeeId: row.payByEmployeeId,
                    payByEmployeeName: row.payByEmployeeName,
                    attachment: row.attachment || null,
                    lineItems: Array.isArray(row.lineItems) ? row.lineItems : [],
                })),
            });
            if (payload.clearDraftOnSuccess) {
                clearUtilityBillDraft(entry.type);
            }
            if (!payload.keepOpen) {
                setAddBillOpen(false);
            }
            invalidateAssetPendingInbox('tools');
            clearModuleNotificationFeedsCache();
            await loadBills();
            return { ok: true };
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not submit bill',
                description: err?.response?.data?.message || 'Please try again.',
            });
            return { ok: false };
        } finally {
            setSavingBill(false);
        }
    };

    const entryStatus = entryLifecycleStatus(entry);
    const entryIsActive = isEntryActive(entry);
    const targetStatus = entryIsActive ? 'Inactive' : 'Active';
    const hasPendingStatusChange = Boolean(pendingStatusChange?._id);

    const openStatusChangeModal = () => {
        if (!entry?.id) return;
        if (hasPendingStatusChange) {
            toast({
                title: 'Already pending HR',
                description: 'A status change request is waiting for HR approval.',
            });
            return;
        }
        setStatusChangeOpen(true);
    };

    const handleSubmitStatusChange = async ({ reason, attachment, requestedStatus }) => {
        if (!entry?.id) return;
        setStatusChangeSaving(true);
        try {
            const res = await axiosInstance.post('/UtilityBill/status-change', {
                entryId: entry.id,
                utilityType: entry.type || '',
                accountNo: entry.values?.accountNumber || '',
                provider: entry.values?.provider || '',
                currentStatus: entryStatus,
                requestedStatus,
                reason,
                attachment,
            });
            const request = res.data?.request || null;
            try {
                await updateUtilityEntryApi(entry.id, {
                    pendingStatusChange: request
                        ? {
                              requestId: request._id,
                              requestedStatus: request.requestedStatus,
                              reason: request.reason,
                              requestedAt: request.createdAt,
                          }
                        : null,
                });
            } catch {
                /* non-fatal */
            }
            setPendingStatusChange(request);
            setStatusChangeOpen(false);
            invalidateAssetPendingInbox('tools');
            clearModuleNotificationFeedsCache();
            toast({
                title: 'Sent to HR',
                description:
                    res.data?.message ||
                    'Activation/deactivation request emailed to HR with a dashboard task.',
            });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not submit request',
                description: err?.response?.data?.message || 'Please try again.',
            });
        } finally {
            setStatusChangeSaving(false);
        }
    };

    const openBillReview = (bill) => {
        const id = bill?.batchId || bill?._id;
        if (!id) return;
        setViewBill(null);
        setReviewBatchId(String(id));
    };

    const closeBillReview = () => {
        setReviewBatchId('');
    };

    const handleDeleteBill = async (bill) => {
        if (!canAdminDelete || !bill?._id) return;
        const label = monthLabelFromKey(bill.billMonth) || 'this bill';
        if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
        try {
            await deleteUtilityBillApi(bill._id);
            setBills((prev) => prev.filter((b) => String(b._id) !== String(bill._id)));
            if (viewBill && String(viewBill._id) === String(bill._id)) setViewBill(null);
            invalidateAssetPendingInbox();
            clearModuleNotificationFeedsCache();
            toast({ title: 'Bill deleted' });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not delete bill',
                description: err?.response?.data?.message || 'Please try again.',
            });
        }
    };

    const handleDeleteEntry = async () => {
        if (!canAdminDelete || !entry?.id) return;
        const label =
            entry.values?.accountNumber ||
            entry.values?.provider ||
            entry.type ||
            entry.id;
        if (
            !window.confirm(
                `Delete this ${entry.type || 'utility'} record (${label}) and all of its bills? This cannot be undone.`,
            )
        ) {
            return;
        }
        try {
            await deleteUtilityEntryApi(entry.id);
            invalidateAssetPendingInbox();
            clearModuleNotificationFeedsCache();
            toast({ title: 'Record deleted' });
            router.push('/HRM/Asset/UtilityBills');
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not delete record',
                description: err?.response?.data?.message || 'Please try again.',
            });
        }
    };

    const renderDetailFields = () => {
        if (detailRows.length === 0) {
            return <p className="text-xs sm:text-sm text-gray-500 px-4 sm:px-5 py-4">No fields configured for this utility.</p>;
        }

        return (
            <div className="px-4 sm:px-5 pb-4">
                {detailRows.map((row, idx, arr) => {
                    const text = String(row.value ?? '').trim();
                    const hasValue = text !== '' && text !== '—';
                    const display = hasValue ? text.replace(/\s+/g, ' ') : '';
                    const tooLong = hasValue && (display.length > MAX_INLINE_LEN || String(row.value).includes('\n'));
                    const attachmentFile = row.isAttachment ? row.attachment : null;

                    return (
                        <div
                            key={row.key}
                            className={`flex items-center justify-between gap-3 py-3 ${
                                idx !== arr.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                        >
                            <span className="text-xs sm:text-sm text-gray-500 shrink-0">{row.label}</span>
                            <span className="text-xs sm:text-sm font-medium text-gray-800 max-w-[62%] text-right flex items-center justify-end gap-2 min-w-0">
                                {attachmentFile?.name ? (
                                    <>
                                        <span className="truncate" title={attachmentFile.name}>
                                            {attachmentFile.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openUtilityAttachment(attachmentFile, {
                                                    onError: (message) =>
                                                        toast({
                                                            variant: 'destructive',
                                                            title: 'Attachment',
                                                            description: message,
                                                        }),
                                                })
                                            }
                                            className="shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700"
                                        >
                                            View
                                        </button>
                                    </>
                                ) : hasValue ? (
                                    <>
                                        <span className="truncate">{display}</span>
                                        {tooLong ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewFields([row]);
                                                    setViewModalOpen(true);
                                                }}
                                                className="shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700"
                                            >
                                                View
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderBillsHeader = (title = 'Bills') => (
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800">{title}</h3>
            <button
                type="button"
                onClick={() => {
                    if (!entryIsActive) {
                        toast({
                            variant: 'destructive',
                            title: 'Record inactive',
                            description: 'Activate this utility record before adding bills.',
                        });
                        return;
                    }
                    setAddBillOpen(true);
                }}
                className={`bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap ${
                    entryIsActive ? '' : 'opacity-50 cursor-not-allowed hover:bg-teal-500'
                }`}
            >
                <Plus size={18} strokeWidth={2} />
                Add Bills
            </button>
        </div>
    );

    const renderBillsList = (list, emptyMessage) => (
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            {loadingBills ? (
                <p className="text-xs sm:text-sm text-gray-500 py-6 text-center">Loading bills…</p>
            ) : list.length === 0 ? (
                <div className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                    {emptyMessage || 'No bills yet. Click Add Bills to create one.'}
                </div>
            ) : (
                <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 py-1">
                    {list.map((bill) => {
                        const contract = Number(bill.monthlyRental) || 0;
                        const actual = Number(bill.amount) || 0;
                        const difference = contract - actual;
                        const over = actual > contract;
                        const focused = String(bill._id) === String(focusBillId);
                        const pulsing =
                            String(bill._id) === String(pulseBillId) && pulseBillOn;
                        const isNotPaid = bill.status === 'Approved';
                        const isPaid = bill.status === 'Paid';
                        const canPay = Boolean(bill.canPay);
                        const canApproveReject = Boolean(bill.canApproveReject);
                        const actionBatchId = bill.batchId || bill._id;
                        const showApprove = Boolean(canApproveReject && actionBatchId);
                        const showPay = Boolean(canPay && actionBatchId);
                        const statusText = billDisplayStatus(bill);
                        const openBatchReview = () => openBillReview(bill);

                        // Subtle side border indicator class and glowing status dot
                        let statusLBorder = 'border-l-gray-300';
                        let statusGlowDot = 'bg-gray-400';
                        if (bill.status === 'Paid') {
                            statusLBorder = 'border-l-emerald-500';
                            statusGlowDot = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
                        } else if (bill.status === 'Approved') {
                            statusLBorder = 'border-l-sky-500';
                            statusGlowDot = 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]';
                        } else if (bill.status === 'Pending HR') {
                            statusLBorder = 'border-l-amber-500';
                            statusGlowDot = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse';
                        } else if (bill.status === 'Pending Accounts') {
                            statusLBorder = 'border-l-blue-500';
                            statusGlowDot = 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse';
                        } else if (bill.status === 'Rejected') {
                            statusLBorder = 'border-l-red-500';
                            statusGlowDot = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
                        }

                        return (
                            <div
                                key={bill._id}
                                id={`bill-${bill._id}`}
                                className={`rounded-xl border-t border-r border-b border-l-4 px-4 py-3.5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] hover:shadow-md transition-all duration-200 ${statusLBorder} ${
                                    pulsing
                                        ? 'bg-emerald-100 border-emerald-300 ring-2 ring-emerald-300/70 shadow-md'
                                        : focused
                                          ? 'bg-white ring-2 ring-teal-500/20 border-teal-500/60 shadow-md'
                                          : 'bg-white border-gray-200/80'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 bg-gray-50 rounded text-gray-500 border border-gray-100/60">
                                            <Calendar size={13} />
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs sm:text-sm font-bold text-gray-800 tracking-tight">
                                                {monthLabelFromKey(bill.billMonth)}
                                            </span>
                                            {bill.accountNo ? (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200/50">
                                                    Acc {bill.accountNo}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusGlowDot}`} />
                                        <span
                                            className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusBadgeClass(bill.status)}`}
                                        >
                                            {statusText}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 my-3">
                                    <div className="px-3 py-2 bg-gray-50/50 rounded-lg border border-gray-100/80">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                                            Contract
                                        </p>
                                        <p className="text-xs sm:text-sm font-semibold tabular-nums text-gray-700">
                                            {formatBillMoney(contract)}
                                        </p>
                                    </div>
                                    <div className="px-3 py-2 bg-gray-50/50 rounded-lg border border-gray-100/80">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                                            Actual
                                        </p>
                                        <p
                                            className={`text-xs sm:text-sm font-semibold tabular-nums ${
                                                over ? 'text-red-600' : 'text-gray-700'
                                            }`}
                                        >
                                            {formatBillMoney(actual)}
                                        </p>
                                    </div>
                                    <div className={`px-3 py-2 rounded-lg border ${
                                        difference < 0
                                            ? 'bg-red-50/30 border-red-100 text-red-700'
                                            : difference > 0
                                              ? 'bg-emerald-50/30 border-emerald-100 text-emerald-700'
                                              : 'bg-gray-50/50 border-gray-100 text-gray-500'
                                    }`}>
                                        <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5 opacity-80">
                                            Difference
                                        </p>
                                        <div className="flex items-center gap-1">
                                            {difference < 0 ? (
                                                <TrendingDown size={12} className="shrink-0" />
                                            ) : difference > 0 ? (
                                                <TrendingUp size={12} className="shrink-0" />
                                            ) : null}
                                            <p className="text-xs sm:text-sm font-semibold tabular-nums">
                                                {formatBillMoney(difference)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {(isNotPaid || isPaid) &&
                                (bill.paymentBy === 'employee_balance' ||
                                    bill.paymentBy === 'employee_and_company' ||
                                    bill.paymentBy === 'employee' ||
                                    bill.paymentBy === 'company') ? (
                                    <div className="mt-3 pt-2.5 border-t border-dashed border-gray-100 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                            <CreditCard size={12} />
                                            <span>Allocation Details</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                                                Company: {formatBillMoney(bill.companyPayAmount)}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">
                                                Employee: {formatBillMoney(bill.employeePayAmount)}
                                            </span>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="flex items-center justify-between gap-3 mt-3.5 pt-2.5 border-t border-gray-50">
                                    <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                                        {isNotPaid || isPaid
                                            ? paymentByLabel(bill.paymentBy)
                                            : bill.status === 'Pending HR'
                                              ? 'Awaiting HR Approval'
                                              : bill.status === 'Pending Accounts'
                                                ? 'Awaiting Accounts Review'
                                                : paymentByLabel(bill.paymentBy)}
                                        {bill.createdAt ? (
                                            <>
                                                <span className="text-gray-300 px-0.5">·</span>
                                                <span>{new Date(bill.createdAt).toLocaleDateString('en-GB')}</span>
                                            </>
                                        ) : ''}
                                    </span>
                                    <div className="inline-flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setViewBill(bill)}
                                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shadow-sm shadow-teal-100/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            View
                                        </button>
                                        {bill.attachment?.name ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openUtilityAttachment(bill.attachment, {
                                                        onError: (msg) =>
                                                            toast({
                                                                variant: 'destructive',
                                                                title: 'Invoice',
                                                                description:
                                                                    msg ||
                                                                    'Could not open bill attachment.',
                                                            }),
                                                    })
                                                }
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                title={
                                                    bill.attachment.name
                                                        ? `View bill invoice: ${bill.attachment.name}`
                                                        : 'View bill invoice attachment'
                                                }
                                            >
                                                Invoice
                                            </button>
                                        ) : null}
                                        {(isNotPaid || isPaid) ? (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const { payment, error } =
                                                        await loadUtilityBillPaymentInvoice(bill);
                                                    if (!payment) {
                                                        toast({
                                                            variant: 'destructive',
                                                            title: 'Payment receipt',
                                                            description:
                                                                error ||
                                                                'Could not open payment receipt.',
                                                        });
                                                        return;
                                                    }
                                                    setPaymentInvoice(payment);
                                                }}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                title="Open payment receipt from Accounts → Payments"
                                            >
                                                Receipt
                                            </button>
                                        ) : null}
                                        {showApprove ? (
                                            <button
                                                type="button"
                                                onClick={openBatchReview}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm shadow-sky-100/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                Approve
                                            </button>
                                        ) : null}
                                        {showPay ? (
                                            <button
                                                type="button"
                                                onClick={openBatchReview}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm shadow-amber-100/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                Pay
                                            </button>
                                        ) : null}
                                        {canAdminDelete ? (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteBill(bill)}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                title="Delete bill"
                                            >
                                                <Trash2 size={12} />
                                                Delete
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderSortToggle = (value, onChange, ascLabel, descLabel) => (
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
            <button
                type="button"
                onClick={() => onChange('asc')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    value === 'asc'
                        ? 'bg-teal-50 text-teal-700'
                        : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <ArrowUpAZ size={12} />
                {ascLabel}
            </button>
            <button
                type="button"
                onClick={() => onChange('desc')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    value === 'desc'
                        ? 'bg-teal-50 text-teal-700'
                        : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                <ArrowDownAZ size={12} />
                {descLabel}
            </button>
        </div>
    );

    const toggleBrowseYear = (year) => {
        if (Number(billsBrowseYear) === Number(year)) {
            setBillsBrowseYear(null);
            setBillsBrowseMonth(null);
            return;
        }
        setBillsBrowseYear(year);
        setBillsBrowseMonth(null);
    };

    const toggleBrowseMonth = (ym) => {
        if (billsBrowseMonth === ym) {
            setBillsBrowseMonth(null);
            return;
        }
        setBillsBrowseMonth(ym);
    };

    const renderBillsBrowse = () => {
        if (loadingBills) {
            return <p className="text-xs sm:text-sm text-gray-500 py-6 text-center">Loading bills…</p>;
        }

        if (bills.length === 0) {
            return (
                <div className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                    No bills yet. Click Add Bills to create one.
                </div>
            );
        }

        return (
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 shrink-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-500">
                        Years · expand to browse months
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {renderSortToggle(yearSort, setYearSort, 'ASC', 'DESC')}
                        {billsBrowseYear != null
                            ? renderSortToggle(monthSort, setMonthSort, 'Jan–Dec', 'Dec–Jan')
                            : null}
                    </div>
                </div>
                {billsByYear.length === 0 ? (
                    <div className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                        No bill months found.
                    </div>
                ) : (
                    <div className="space-y-2.5 overflow-y-auto flex-1 min-h-0 pr-1 overscroll-contain">
                        {billsByYear.map(([year, yearBills]) => {
                            const yearOpen = Number(billsBrowseYear) === Number(year);
                            const monthEntries = monthsByYear.get(year) || [];
                            const yearSummary = summarizeBillGroup(yearBills);
                            return (
                                <div
                                    key={year}
                                    className={`group/year rounded-2xl border bg-white overflow-hidden transition-[border-color,box-shadow,background-color] duration-300 ease-out ${
                                        yearOpen
                                            ? 'border-teal-300/80 shadow-[0_8px_24px_-12px_rgba(13,148,136,0.35)]'
                                            : 'border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-[0_6px_18px_-12px_rgba(15,23,42,0.18)]'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleBrowseYear(year)}
                                        className={`relative w-full flex items-center gap-3 sm:gap-5 px-4 sm:px-5 py-3.5 sm:py-4 text-left transition-colors duration-200 ${
                                            yearOpen
                                                ? 'bg-gradient-to-r from-teal-50/90 via-white to-white'
                                                : 'hover:bg-slate-50/80'
                                        }`}
                                    >
                                        <span
                                            className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-colors duration-300 ${
                                                yearOpen
                                                    ? 'bg-teal-500'
                                                    : 'bg-transparent group-hover/year:bg-slate-300'
                                            }`}
                                            aria-hidden
                                        />
                                        <div className="min-w-0 shrink-0 w-[6rem] sm:w-[8rem]">
                                            <p className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
                                                {year}
                                            </p>
                                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 tabular-nums">
                                                {yearSummary.billCount}{' '}
                                                {yearSummary.billCount === 1 ? 'bill' : 'bills'}
                                                {yearSummary.monthCount
                                                    ? ` · ${yearSummary.monthCount} mo`
                                                    : ''}
                                            </p>
                                        </div>
                                        <BillGroupSummaryStats summary={yearSummary} />
                                        <span
                                            className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 ${
                                                yearOpen
                                                    ? 'bg-teal-100 text-teal-700'
                                                    : 'bg-slate-100 text-slate-400 group-hover/year:bg-slate-200/80 group-hover/year:text-slate-600'
                                            }`}
                                        >
                                            <ChevronDown
                                                size={16}
                                                className={`transition-transform duration-300 ease-out ${
                                                    yearOpen ? 'rotate-0' : '-rotate-90'
                                                }`}
                                            />
                                        </span>
                                    </button>

                                    <div
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                            yearOpen
                                                ? 'grid-rows-[1fr] opacity-100'
                                                : 'grid-rows-[0fr] opacity-0'
                                        }`}
                                    >
                                        <div className="min-h-0 overflow-hidden">
                                            <div className="border-t border-slate-100/90 bg-slate-50/70 px-2.5 sm:px-3 py-2.5 space-y-2">
                                                {monthEntries.length === 0 ? (
                                                    <p className="text-xs sm:text-sm text-gray-500 px-2 py-3 text-center">
                                                        No months for this year.
                                                    </p>
                                                ) : (
                                                    monthEntries.map(([ym, monthBills]) => {
                                                        const monthOpen = billsBrowseMonth === ym;
                                                        const monthSummary =
                                                            summarizeBillGroup(monthBills);
                                                        const monthBillList = monthOpen
                                                            ? billsForBrowseMonth
                                                            : [...monthBills].sort(
                                                                  (a, b) =>
                                                                      billSortTime(b) -
                                                                      billSortTime(a),
                                                              );
                                                        return (
                                                            <div
                                                                key={ym}
                                                                className={`group/month rounded-xl border bg-white overflow-hidden transition-[border-color,box-shadow] duration-300 ease-out ${
                                                                    monthOpen
                                                                        ? 'border-teal-200 shadow-sm'
                                                                        : 'border-slate-200/80 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleBrowseMonth(ym)
                                                                    }
                                                                    className={`w-full flex items-center gap-3 sm:gap-4 px-3.5 sm:px-4 py-2.5 sm:py-3 text-left transition-colors duration-200 ${
                                                                        monthOpen
                                                                            ? 'bg-teal-50/40'
                                                                            : 'hover:bg-slate-50/90'
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0 shrink-0 w-[4.75rem] sm:w-[6rem]">
                                                                        <p className="text-sm font-semibold text-slate-900">
                                                                            {monthLabelFromKey(ym, {
                                                                                shortOnly: true,
                                                                            })}
                                                                        </p>
                                                                        <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                                                            {monthSummary.billCount}{' '}
                                                                            {monthSummary.billCount ===
                                                                            1
                                                                                ? 'bill'
                                                                                : 'bills'}
                                                                        </p>
                                                                    </div>
                                                                    <BillGroupSummaryStats
                                                                        summary={monthSummary}
                                                                        compact
                                                                    />
                                                                    <span
                                                                        className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200 ${
                                                                            monthOpen
                                                                                ? 'bg-teal-100 text-teal-700'
                                                                                : 'bg-slate-100 text-slate-400 group-hover/month:text-slate-600'
                                                                        }`}
                                                                    >
                                                                        <ChevronDown
                                                                            size={14}
                                                                            className={`transition-transform duration-300 ease-out ${
                                                                                monthOpen
                                                                                    ? 'rotate-0'
                                                                                    : '-rotate-90'
                                                                            }`}
                                                                        />
                                                                    </span>
                                                                </button>
                                                                <div
                                                                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                                                        monthOpen
                                                                            ? 'grid-rows-[1fr] opacity-100'
                                                                            : 'grid-rows-[0fr] opacity-0'
                                                                    }`}
                                                                >
                                                                    <div className="min-h-0 overflow-hidden">
                                                                        <div className="border-t border-slate-100 px-2 py-2 max-h-[320px] overflow-y-auto">
                                                                            {renderBillsList(
                                                                                monthBillList,
                                                                                'No bills for this month.',
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    if (!entry) {
        return (
            <div className="flex min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-6 text-center">
                        <p className="text-gray-600 mb-4">Utility record not found on this device.</p>
                        <button
                            type="button"
                            onClick={() => router.push('/HRM/Asset/UtilityBills')}
                            className="text-teal-600 font-semibold text-sm"
                        >
                            Back to Utility Bills
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
                        <div className="min-w-0">
                            <button
                                type="button"
                                onClick={() => router.push('/HRM/Asset/UtilityBills')}
                                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 mb-2"
                            >
                                <ArrowLeft size={14} />
                                Utility Bills
                            </button>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2 flex-wrap">
                                {entry.type} Details
                                <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${entryStatusBadgeClass(entryStatus)}`}
                                >
                                    {entryStatus}
                                </span>
                                {hasPendingStatusChange ? (
                                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-200">
                                        Pending{' '}
                                        {pendingStatusChange?.requestedStatus === 'Active'
                                            ? 'activation'
                                            : 'deactivation'}
                                    </span>
                                ) : null}
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600">
                                {entry.assignedTo
                                    ? `Assigned to ${entry.assignedToType === 'Company' ? 'company' : 'employee'}: ${entry.assignedTo}`
                                    : 'Utility account details and bills'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                            {canAdminDelete ? (
                                <button
                                    type="button"
                                    onClick={handleDeleteEntry}
                                    className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm border border-red-200 bg-white hover:bg-red-50 text-red-600 shadow-sm whitespace-nowrap"
                                >
                                    <Trash2 size={14} />
                                    Delete
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={openStatusChangeModal}
                                disabled={hasPendingStatusChange}
                                className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm border shadow-sm whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
                                    entryIsActive
                                        ? 'bg-white hover:bg-teal-50 text-teal-700 border-teal-200'
                                        : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500'
                                }`}
                            >
                                {hasPendingStatusChange
                                    ? `Pending ${
                                          pendingStatusChange?.requestedStatus === 'Active'
                                              ? 'activation'
                                              : 'deactivation'
                                      }`
                                    : entryIsActive
                                      ? 'Deactivate'
                                      : 'Activate'}
                            </button>
                        </div>
                    </div>

                    <div className={HEADER_PAIR_GRID}>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                           
                        </div>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                           
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5 lg:gap-8 mb-4 sm:mb-6 lg:mb-8 border-b border-gray-200 px-1 sm:px-2 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-2 sm:pb-3 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'text-blue-600'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {tab.label}
                                {activeTab === tab.id ? (
                                    <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                                ) : null}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' ? (
                        <div className={DETAIL_PAIR_GRID}>
                            <div className={DETAIL_PAIR_COLUMN}>
                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-full">
                                    <div className="px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3 border-b border-gray-100">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] truncate">
                                                {entry.type} Details
                                            </h3>
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${entryStatusBadgeClass(entryStatus)}`}
                                            >
                                                {entryStatus}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={openStatusChangeModal}
                                            disabled={hasPendingStatusChange}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
                                                entryIsActive
                                                    ? 'bg-white hover:bg-teal-50 text-teal-700 border-teal-200'
                                                    : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500'
                                            }`}
                                        >
                                            {hasPendingStatusChange
                                                ? 'Pending HR'
                                                : entryIsActive
                                                  ? 'Deactivate'
                                                  : 'Activate'}
                                        </button>
                                    </div>
                                    {renderDetailFields()}
                                </div>
                            </div>
                            {/* Absolute fill so bills match left card height and scroll instead of growing the page */}
                            <div className={`${DETAIL_PAIR_COLUMN} relative min-h-[320px] lg:min-h-0`}>
                                <div className="flex flex-col min-h-0 max-h-[420px] lg:max-h-none lg:absolute lg:inset-0">
                                    {renderBillsHeader('Latest Bills')}
                                    {renderBillsList(
                                        overviewBills,
                                        'No bills yet. Click Add Bills to create one.',
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col min-h-0 max-h-[min(70vh,640px)]">
                            {renderBillsHeader('All Bills')}
                            {renderBillsBrowse()}
                        </div>
                    )}
                </div>
            </div>

            <FieldViewModal
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                title={`${entry.type} Details`}
                fields={viewFields.length ? viewFields : detailRows}
            />

            <AddBillModal
                isOpen={addBillOpen}
                onClose={() => setAddBillOpen(false)}
                entries={entry && entryIsActive ? [entry] : []}
                existingBills={bills}
                utilityType={entry?.type || ''}
                utilityAttachment={utilityConfig?.attachment || null}
                monthlyRental={monthlyRental}
                onSubmit={handleAddBill}
                saving={savingBill}
            />

            <ViewBillModal
                isOpen={Boolean(viewBill)}
                onClose={() => {
                    const id = viewBill?._id;
                    setViewBill(null);
                    if (id) {
                        window.setTimeout(() => {
                            document
                                .getElementById(`bill-${id}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            triggerBillPulse(id);
                        }, 50);
                    }
                }}
                bill={viewBill}
                onEdit={(bill) => openBillReview(bill)}
            />

            <PaymentInvoiceViewerModal
                payment={paymentInvoice}
                onClose={() => setPaymentInvoice(null)}
            />

            <UtilityBillReviewModal
                isOpen={Boolean(reviewBatchId)}
                batchId={reviewBatchId}
                entries={entry ? [entry] : []}
                existingBills={bills}
                utilityAttachment={utilityConfig?.attachment || null}
                onClose={closeBillReview}
                onChanged={() => {
                    invalidateAssetPendingInbox('tools');
                    clearModuleNotificationFeedsCache();
                    loadBills();
                }}
            />

            <ActivateDeactivateUtilityModal
                isOpen={statusChangeOpen}
                onClose={() => setStatusChangeOpen(false)}
                entry={entry}
                targetStatus={targetStatus}
                onSubmit={handleSubmitStatusChange}
                saving={statusChangeSaving}
            />
        </div>
    );
}

export default function UtilityBillDetailsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen w-full bg-[#F2F6F9] items-center justify-center">
                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <UtilityBillDetailsPageContent />
        </Suspense>
    );
}
