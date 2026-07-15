'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { ArrowDownAZ, ArrowLeft, ArrowUpAZ, ChevronDown, Plus } from 'lucide-react';
import {
    DETAIL_PAIR_COLUMN,
    DETAIL_PAIR_GRID,
    HEADER_PAIR_CARD_DASHBOARD,
    HEADER_PAIR_GRID,
} from '@/utils/headerPairLayout';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    buildDetailFieldRows,
    clearUtilityBillDraft,
    entryLifecycleStatus,
    getMonthlyRentalAmount,
    getUtilityConfigForType,
    getUtilityEntryById,
    isEntryActive,
    updateUtilityEntry,
} from '../../utils/utilityBillsStorage';
import FieldViewModal from '../../components/FieldViewModal';
import AddBillModal from '../../components/AddBillModal';
import HrApproveBillModal from '../../components/HrApproveBillModal';
import UtilityBillStatsCards from '../../components/UtilityBillStatsCards';
import { billDisplayStatus, formatBillMoney } from '../../utils/utilityBillStats';
import { openUtilityAttachment } from '../../utils/openUtilityAttachment';
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

/** Previous calendar month as YYYY-MM. */
function previousBillMonthKey(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
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

/**
 * Utility entry details — header cards, tabs, 1/2 type details + bills list with HR approval.
 */
export default function UtilityBillDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const entryId = params?.id ? String(params.id) : '';

    const [entry, setEntry] = useState(null);
    const [utilityConfig, setUtilityConfig] = useState(null);
    const [bills, setBills] = useState([]);
    const [loadingBills, setLoadingBills] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewFields, setViewFields] = useState([]);
    const [addBillOpen, setAddBillOpen] = useState(false);
    const [savingBill, setSavingBill] = useState(false);
    const [respondingId, setRespondingId] = useState('');
    const [approveBill, setApproveBill] = useState(null);
    /** Bills tab accordion: open year keeps other years visible; open month keeps other months visible */
    const [billsBrowseYear, setBillsBrowseYear] = useState(null);
    const [billsBrowseMonth, setBillsBrowseMonth] = useState(null);
    /** Year list: 'desc' = newest first, 'asc' = oldest first */
    const [yearSort, setYearSort] = useState('desc');
    /** Month list within a year: 'asc' = Jan→Dec, 'desc' = Dec→Jan */
    const [monthSort, setMonthSort] = useState('asc');

    const focusBillId = searchParams?.get('billId') || '';
    const previousMonthKey = useMemo(() => previousBillMonthKey(), []);

    const overviewBills = useMemo(
        () =>
            (bills || [])
                .filter((b) => billMonthKey(b) === previousMonthKey)
                .sort((a, b) => billSortTime(b) - billSortTime(a)),
        [bills, previousMonthKey],
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
        const found = getUtilityEntryById(entryId);
        setEntry(found);
        if (found) {
            setUtilityConfig(getUtilityConfigForType(found.type));
        }
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

    useEffect(() => {
        if (!focusBillId || !bills.length) return;
        const bill = bills.find((b) => String(b._id) === String(focusBillId));
        if (!bill) return;
        const ym = billMonthKey(bill);
        if (ym && ym === previousMonthKey) {
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
        }, 80);
        return () => window.clearTimeout(t);
    }, [focusBillId, bills, previousMonthKey]);

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
                    differenceAmount: row.difference,
                    payBy: row.payBy,
                    companyDiffAmount: row.companyDiffAmount,
                    employeeDiffAmount: row.employeeDiffAmount,
                    attachment: row.attachment || null,
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

    const handleToggleEntryStatus = () => {
        if (!entry?.id) return;
        const nextStatus = entryIsActive ? 'Inactive' : 'Active';
        const updated = updateUtilityEntry(entry.id, { status: nextStatus });
        if (!updated) {
            toast({
                variant: 'destructive',
                title: 'Could not update status',
                description: 'Please try again.',
            });
            return;
        }
        setEntry(updated);

        const paymentDay = Number(updated?.values?.paymentDay);
        if (Number.isInteger(paymentDay) && paymentDay >= 1 && paymentDay <= 31) {
            axiosInstance
                .post(
                    '/UtilityBill/payment-day',
                    {
                        entryId: entry.id,
                        paymentDay,
                        utilityType: updated.type || '',
                        accountNo: updated.values?.accountNumber || '',
                        provider: updated.values?.provider || '',
                        status: nextStatus,
                    },
                    { skipToast: true },
                )
                .catch(() => {
                    // local status still updated; reminder sync best-effort
                });
        }

        toast({
            title: nextStatus === 'Active' ? 'Activated' : 'Deactivated',
            description:
                nextStatus === 'Active'
                    ? 'This utility record is active again. Payment-day reminders resume for HR.'
                    : 'This utility record is inactive — excluded from Add Bills and payment reminders.',
        });
    };

    const handleRespond = async (billId, decision, paymentBy = null) => {
        setRespondingId(billId);
        try {
            const body = { decision };
            if (decision === 'approve') body.paymentBy = paymentBy;
            await axiosInstance.put(`/UtilityBill/${billId}/respond`, body);
            toast({
                title: decision === 'approve' ? 'Approved' : 'Rejected',
                description:
                    decision === 'approve'
                        ? 'Bill stored. Task completed on dashboard.'
                        : 'Bill deleted. Requester was emailed.',
            });
            setApproveBill(null);
            invalidateAssetPendingInbox('tools');
            clearModuleNotificationFeedsCache();
            await loadBills();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: err?.response?.data?.message || 'Please try again.',
            });
        } finally {
            setRespondingId('');
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
                <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
                    {list.map((bill) => {
                        const contract = Number(bill.monthlyRental) || 0;
                        const actual = Number(bill.amount) || 0;
                        const difference = contract - actual;
                        const over = actual > contract;
                        const focused = String(bill._id) === String(focusBillId);
                        const isNotPaid = bill.status === 'Approved';
                        const isPaid = bill.status === 'Paid';
                        const canPay = Boolean(bill.canPay);
                        const canApproveReject = Boolean(bill.canApproveReject);
                        const showBatchAction =
                            Boolean(bill.batchId) &&
                            (canPay ||
                                canApproveReject ||
                                [
                                    'Pending Accounts',
                                    'Pending HR',
                                    'Approved',
                                ].includes(String(bill.status)));
                        const statusText = billDisplayStatus(bill);
                        const actionLabel = canPay
                            ? 'Pay'
                            : canApproveReject
                              ? 'Review'
                              : 'View';

                        return (
                            <div
                                key={bill._id}
                                id={`bill-${bill._id}`}
                                className={`rounded-xl border shadow-sm bg-white px-3 sm:px-4 py-3 ${
                                    focused
                                        ? 'border-teal-300 ring-1 ring-teal-200'
                                        : isNotPaid
                                          ? 'border-orange-200'
                                          : isPaid
                                            ? 'border-teal-200'
                                            : 'border-gray-200'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <span className="text-xs sm:text-sm text-gray-600">
                                        {bill.billMonth || 'Bill'}
                                        {bill.accountNo ? ` · Acc ${bill.accountNo}` : ''}
                                    </span>
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadgeClass(bill.status)}`}
                                    >
                                        {statusText}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                                    <div>
                                        <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">
                                            Contract
                                        </p>
                                        <p className="text-xs sm:text-sm font-semibold tabular-nums text-gray-700">
                                            {formatBillMoney(contract)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">
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
                                    <div>
                                        <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">
                                            Diff
                                        </p>
                                        <p
                                            className={`text-xs sm:text-sm font-semibold tabular-nums ${
                                                difference < 0
                                                    ? 'text-red-600'
                                                    : difference > 0
                                                      ? 'text-emerald-600'
                                                      : 'text-gray-500'
                                            }`}
                                        >
                                            {formatBillMoney(difference)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 mt-2">
                                    <span className="text-xs text-gray-500">
                                        {isNotPaid || isPaid
                                            ? paymentByLabel(bill.paymentBy)
                                            : bill.status === 'Pending HR'
                                              ? 'Awaiting HR'
                                              : bill.status === 'Pending Accounts'
                                                ? 'Awaiting Accounts'
                                                : paymentByLabel(bill.paymentBy)}
                                        {bill.createdAt
                                            ? ` · ${new Date(bill.createdAt).toLocaleDateString('en-GB')}`
                                            : ''}
                                    </span>
                                </div>
                                {(isNotPaid || isPaid) &&
                                (bill.paymentBy === 'employee_balance' ||
                                    bill.paymentBy === 'employee_and_company' ||
                                    bill.paymentBy === 'employee' ||
                                    bill.paymentBy === 'company') ? (
                                    <p className="text-xs text-gray-500 mt-1.5 text-right">
                                        Company: {formatBillMoney(bill.companyPayAmount)} · Employee:{' '}
                                        {formatBillMoney(bill.employeePayAmount)}
                                    </p>
                                ) : null}
                                {showBatchAction ? (
                                    <div className="flex flex-wrap justify-end gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(
                                                    `/HRM/Asset/UtilityBills?batchId=${encodeURIComponent(String(bill.batchId))}&review=1`,
                                                )
                                            }
                                            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-white text-xs sm:text-sm font-medium shadow-sm ${
                                                canPay
                                                    ? 'bg-amber-500 hover:bg-amber-600'
                                                    : 'bg-teal-500 hover:bg-teal-600'
                                            }`}
                                        >
                                            {actionLabel}
                                        </button>
                                    </div>
                                ) : null}
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">
                        Years · expand one to see months
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
                    <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1 overscroll-contain">
                        {billsByYear.map(([year, yearBills]) => {
                            const yearOpen = Number(billsBrowseYear) === Number(year);
                            const monthEntries = monthsByYear.get(year) || [];
                            return (
                                <div
                                    key={year}
                                    className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-[border-color,box-shadow] duration-300 ease-out ${
                                        yearOpen
                                            ? 'border-teal-200 ring-1 ring-teal-100'
                                            : 'border-gray-200 ring-0'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleBrowseYear(year)}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-teal-50/40 transition-colors duration-200"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm sm:text-base font-bold text-gray-800">
                                                {year}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {yearBills.length}{' '}
                                                {yearBills.length === 1 ? 'bill' : 'bills'}
                                                {monthEntries.length
                                                    ? ` · ${monthEntries.length} mo`
                                                    : ''}
                                            </p>
                                        </div>
                                        <ChevronDown
                                            size={16}
                                            className={`shrink-0 transition-transform duration-300 ease-out ${
                                                yearOpen
                                                    ? 'rotate-0 text-teal-600'
                                                    : '-rotate-90 text-gray-400'
                                            }`}
                                        />
                                    </button>

                                    <div
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                            yearOpen
                                                ? 'grid-rows-[1fr] opacity-100'
                                                : 'grid-rows-[0fr] opacity-0'
                                        }`}
                                    >
                                        <div className="min-h-0 overflow-hidden">
                                            <div className="border-t border-gray-100 bg-gray-50/60 px-2 py-2 space-y-1.5">
                                                {monthEntries.length === 0 ? (
                                                    <p className="text-xs sm:text-sm text-gray-500 px-2 py-3 text-center">
                                                        No months for this year.
                                                    </p>
                                                ) : (
                                                    monthEntries.map(([ym, monthBills]) => {
                                                        const monthOpen = billsBrowseMonth === ym;
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
                                                                className={`rounded-lg border bg-white overflow-hidden transition-[border-color] duration-300 ease-out ${
                                                                    monthOpen
                                                                        ? 'border-teal-200'
                                                                        : 'border-gray-200'
                                                                }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleBrowseMonth(ym)
                                                                    }
                                                                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-teal-50/50 transition-colors duration-200"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-bold text-gray-800">
                                                                            {monthLabelFromKey(ym, {
                                                                                shortOnly: true,
                                                                            })}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                                            {monthBills.length}{' '}
                                                                            {monthBills.length ===
                                                                            1
                                                                                ? 'bill'
                                                                                : 'bills'}
                                                                        </p>
                                                                    </div>
                                                                    <ChevronDown
                                                                        size={14}
                                                                        className={`shrink-0 transition-transform duration-300 ease-out ${
                                                                            monthOpen
                                                                                ? 'rotate-0 text-teal-600'
                                                                                : '-rotate-90 text-gray-400'
                                                                        }`}
                                                                    />
                                                                </button>
                                                                <div
                                                                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                                                        monthOpen
                                                                            ? 'grid-rows-[1fr] opacity-100'
                                                                            : 'grid-rows-[0fr] opacity-0'
                                                                    }`}
                                                                >
                                                                    <div className="min-h-0 overflow-hidden">
                                                                        <div className="border-t border-gray-100 px-2 py-2 max-h-[320px] overflow-y-auto">
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
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600">
                                {entry.assignedTo
                                    ? `Assigned to ${entry.assignedToType === 'Company' ? 'company' : 'employee'}: ${entry.assignedTo}`
                                    : 'Utility account details and bills'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleToggleEntryStatus}
                            className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm border shadow-sm whitespace-nowrap shrink-0 ${
                                entryIsActive
                                    ? 'bg-white hover:bg-teal-50 text-teal-700 border-teal-200'
                                    : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500'
                            }`}
                        >
                            {entryIsActive ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>

                    <div className={HEADER_PAIR_GRID}>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                            <div className="flex items-center justify-between gap-2 shrink-0 mb-2 sm:mb-3">
                                <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest">
                                    Utility Overview
                                </h3>
                                <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${entryStatusBadgeClass(entryStatus)}`}
                                >
                                    {entryStatus}
                                </span>
                            </div>
                            <UtilityBillStatsCards
                                bills={bills}
                                emptyLabel="Bill status counts appear after you submit bills."
                            />
                        </div>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                            <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 shrink-0">
                                Amount Summary
                            </h3>
                            <UtilityBillStatsCards
                                bills={bills}
                                emptyLabel="Amount totals appear after you submit bills."
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 lg:gap-10 mb-4 sm:mb-6 lg:mb-8 border-b border-gray-200 px-1 sm:px-2 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'text-blue-600'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {tab.label}
                                {activeTab === tab.id ? (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.3)]" />
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
                                            <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest truncate">
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
                                            onClick={handleToggleEntryStatus}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm shrink-0 ${
                                                entryIsActive
                                                    ? 'bg-white hover:bg-teal-50 text-teal-700 border-teal-200'
                                                    : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500'
                                            }`}
                                        >
                                            {entryIsActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </div>
                                    {renderDetailFields()}
                                </div>
                            </div>
                            {/* Absolute fill so bills match left card height and scroll instead of growing the page */}
                            <div className={`${DETAIL_PAIR_COLUMN} relative min-h-[320px] lg:min-h-0`}>
                                <div className="flex flex-col min-h-0 max-h-[420px] lg:max-h-none lg:absolute lg:inset-0">
                                    {renderBillsHeader(
                                        `Bills · ${monthLabelFromKey(previousMonthKey)}`,
                                    )}
                                    {renderBillsList(
                                        overviewBills,
                                        `No bills for ${monthLabelFromKey(previousMonthKey)}. Open the Bills tab for earlier months.`,
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

            <HrApproveBillModal
                isOpen={Boolean(approveBill)}
                onClose={() => setApproveBill(null)}
                bill={approveBill}
                saving={Boolean(approveBill && respondingId === approveBill._id)}
                onConfirm={({ paymentBy }) =>
                    handleRespond(approveBill._id, 'approve', paymentBy)
                }
            />
        </div>
    );
}
