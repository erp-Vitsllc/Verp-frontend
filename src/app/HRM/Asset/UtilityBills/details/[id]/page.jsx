'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import {
    ArrowLeft,
    ChevronDown,
    Plus,
    Calendar,
    CreditCard,
    TrendingUp,
    TrendingDown,
    Trash2,
    Check,
    X,
    LockKeyhole,
    History,
    Pencil,
} from 'lucide-react';
import {
    DETAIL_PAIR_COLUMN,
    DETAIL_PAIR_GRID,
    HEADER_PAIR_CARD_DASHBOARD,
    HEADER_PAIR_GRID,
} from '@/utils/headerPairLayout';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { isAdmin, parseStoredSessionUser } from '@/utils/permissions';
import { isCurrentUserFlowchartAccounts } from '@/app/HRM/Asset/Vehicle/utils/vehicleOilServiceAccess';
import {
    buildDetailFieldRows,
    clearUtilityBillDraft,
    entryLifecycleStatus,
    getMonthlyRentalAmount,
    isEntryActive,
    normalizePaymentDay,
    normalizeUtilityEntry,
    normalizeUtilityFields,
} from '../../utils/utilityBillsStorage';
import {
    deleteUtilityBillApi,
    deleteUtilityEntryApi,
    fetchUtilityEntry,
    fetchUtilityEntryAssignmentHistory,
    updateUtilityEntryApi,
} from '../../utils/utilityBillsApi';
import FieldViewModal from '../../components/FieldViewModal';
import CreateUtilityEntryModal from '../../components/CreateUtilityEntryModal';
import AddBillModal from '../../components/AddBillModal';
import UtilityBillReviewModal from '../../components/UtilityBillReviewModal';
import ActivateDeactivateUtilityModal from '../../components/ActivateDeactivateUtilityModal';
import UtilityBillStatsCards from '../../components/UtilityBillStatsCards';
import { billDisplayStatus, formatBillMoney, entryAvailableFromMonth } from '../../utils/utilityBillStats';
import {
    getBillAllocationParties,
    getBillTotalAmount,
} from '../../components/UtilityBillTotalsBar';
import { openUtilityAttachment } from '../../utils/openUtilityAttachment';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';
import EmployeeNameLink from '@/components/EmployeeNameLink';
import { normalizeUtilityNotificationBillMonth } from '@/utils/assetNotificationRouting';
import { formatZohoDocumentNumber } from '@/utils/zohoDocumentNumber';

const MAX_INLINE_LEN = 48;

function formatHistoryDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function assignmentActionLabel(action) {
    const key = String(action || '').toLowerCase();
    if (key === 'reassign') return 'Reassign';
    if (key === 'return') return 'Return';
    return 'Assign';
}

function assignmentActionBadgeClass(action) {
    const key = String(action || '').toLowerCase();
    if (key === 'reassign') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
    if (key === 'return') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200';
}

function formatAssigneeCell(name, type) {
    const label = String(name || '').trim();
    if (!label) return 'Unassigned';
    const kind = String(type || '').trim();
    return kind ? `${label} (${kind})` : label;
}

function paymentByLabel(billOrMode) {
    const bill =
        billOrMode && typeof billOrMode === 'object' ? billOrMode : null;
    const mode = bill ? bill.paymentBy : billOrMode;
    const companyName = String(bill?.payByCompanyName || '').trim();
    const employeeName = String(bill?.payByEmployeeName || '').trim();

    if (bill) {
        const parties = getBillAllocationParties(bill);
        if (parties.length >= 2) {
            return `Pay by ${parties.map((p) => p.fullName || p.name).join(' / ')}`;
        }
        if (parties.length === 1) {
            return `Pay by ${parties[0].fullName || parties[0].name}`;
        }
    }

    if (mode === 'employee_balance' || mode === 'employee') {
        return employeeName ? `Pay by ${employeeName}` : 'Pay by employee';
    }
    if (mode === 'company') {
        return companyName ? `Pay by ${companyName}` : 'Pay by company';
    }
    if (mode === 'employee_and_company') {
        if (companyName && employeeName) return `Pay by ${companyName} / ${employeeName}`;
        if (companyName) return `Pay by ${companyName} / employee`;
        if (employeeName) return `Pay by company / ${employeeName}`;
        return 'Pay by company / employee';
    }
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

/** Current calendar month + previous N−1 months (newest first). */
function getRecentMonthKeys(count = 6) {
    const keys = [];
    const now = new Date();
    for (let i = 0; i < count; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
}

/** Drop months before the account was created / contract started (YYYY-MM). */
function filterMonthKeysFromAccountStart(keys = [], availableFromYm = '') {
    const from = String(availableFromYm || '').trim();
    if (!/^\d{4}-\d{2}$/.test(from)) return Array.isArray(keys) ? [...keys] : [];
    return (keys || []).filter((ym) => String(ym) >= from);
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
        const actual = getBillTotalAmount(bill);
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
    const canEditEntryDetails = canAdminDelete;
    const entryId = params?.id ? String(params.id) : '';

    const [entry, setEntry] = useState(null);
    const [utilityConfig, setUtilityConfig] = useState(null);
    const [bills, setBills] = useState([]);
    const [loadingBills, setLoadingBills] = useState(false);
    const [assignmentHistory, setAssignmentHistory] = useState([]);
    const [loadingAssignmentHistory, setLoadingAssignmentHistory] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewFields, setViewFields] = useState([]);
    const [addBillOpen, setAddBillOpen] = useState(false);
    const [viewBill, setViewBill] = useState(null);
    const [savingBill, setSavingBill] = useState(false);
    const [savingLineAccounts, setSavingLineAccounts] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [flowchartRows, setFlowchartRows] = useState([]);
    const [reviewBatchId, setReviewBatchId] = useState('');
    const [approvalActing, setApprovalActing] = useState(false);
    const [statusChangeOpen, setStatusChangeOpen] = useState(false);
    const [statusChangeSaving, setStatusChangeSaving] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState(null);
    /** Bill card that should flash light green (2 on/off pulses). */
    const [pulseBillId, setPulseBillId] = useState('');
    const [pulseBillOn, setPulseBillOn] = useState(false);
    /** Bills tab / Latest Bills: open month expands bill cards below (height grows, no scroll). */
    const [billsBrowseMonth, setBillsBrowseMonth] = useState(null);
    /** YYYY-MM from payment-day notification click. */
    const [addBillPrefillMonth, setAddBillPrefillMonth] = useState('');
    const [editEntryOpen, setEditEntryOpen] = useState(false);

    const focusBillId = searchParams?.get('billId') || '';
    const addBillFromQuery = String(searchParams?.get('addBill') || '') === '1';
    const queryBillMonth = normalizeUtilityNotificationBillMonth(searchParams?.get('billMonth') || '');

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

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setCurrentUser(parseStoredSessionUser());
        axiosInstance
            .get('/Flowchart')
            .then(({ data }) => setFlowchartRows(Array.isArray(data) ? data : []))
            .catch(() => setFlowchartRows([]));
    }, []);

    const isFlowchartAccounts = useMemo(
        () => isCurrentUserFlowchartAccounts(currentUser, flowchartRows),
        [currentUser, flowchartRows],
    );

    const viewBillAllowsAccountsLineEdit = useMemo(() => {
        if (!viewBill || !(isFlowchartAccounts || canAdminDelete)) return false;
        const status = String(viewBill.status || '').trim();
        return ['Pending Accounts', 'Pending HR', 'Approved'].includes(status);
    }, [viewBill, isFlowchartAccounts, canAdminDelete]);

    const accountFromMonth = useMemo(() => entryAvailableFromMonth(entry), [entry]);

    const recentMonthKeys = useMemo(
        () => filterMonthKeysFromAccountStart(getRecentMonthKeys(6), accountFromMonth),
        [accountFromMonth],
    );

    /** Last 12 months ending this month — only from account create / contract start month. */
    const twelveMonthBillSeries = useMemo(() => {
        const keys = filterMonthKeysFromAccountStart(getRecentMonthKeys(12), accountFromMonth);
        const byMonth = new Map();
        (bills || []).forEach((b) => {
            const ym = billMonthKey(b);
            if (!ym) return;
            if (!byMonth.has(ym)) byMonth.set(ym, []);
            byMonth.get(ym).push(b);
        });
        return keys.map((ym) => {
            const list = byMonth.get(ym) || [];
            const amount = list.reduce((sum, bill) => sum + getBillTotalAmount(bill), 0);
            return {
                ym,
                label: monthLabelFromKey(ym, { shortOnly: true }),
                year: String(ym).slice(0, 4),
                amount,
                billCount: list.length,
            };
        });
    }, [bills, accountFromMonth]);

    /** Months where any bill has contract − actual !== 0 (deduction months). */
    const deductionMonths = useMemo(() => {
        const byMonth = new Map();
        (bills || []).forEach((bill) => {
            const ym = billMonthKey(bill);
            if (!ym) return;
            if (accountFromMonth && ym < accountFromMonth) return;
            const contract = Number(bill?.monthlyRental) || 0;
            const actual = getBillTotalAmount(bill);
            const difference = contract - actual;
            if (Math.abs(difference) < 0.01) return;
            const prev = byMonth.get(ym) || { ym, difference: 0, billCount: 0 };
            prev.difference += difference;
            prev.billCount += 1;
            byMonth.set(ym, prev);
        });
        return Array.from(byMonth.values())
            .sort((a, b) => String(b.ym).localeCompare(String(a.ym)))
            .map((row) => ({
                ...row,
                label: monthLabelFromKey(row.ym),
            }));
    }, [bills, accountFromMonth]);

    /** Bills grouped for months from account start through current (up to 6 slots). */
    const recentMonthBillGroups = useMemo(() => {
        const byMonth = new Map();
        (bills || []).forEach((b) => {
            const ym = billMonthKey(b);
            if (!ym) return;
            if (!byMonth.has(ym)) byMonth.set(ym, []);
            byMonth.get(ym).push(b);
        });
        return recentMonthKeys.map((ym) => {
            const list = (byMonth.get(ym) || [])
                .slice()
                .sort((a, b) => billSortTime(b) - billSortTime(a));
            return { ym, bills: list, summary: summarizeBillGroup(list) };
        });
    }, [bills, recentMonthKeys]);

    const billsForBrowseMonth = useMemo(() => {
        if (!billsBrowseMonth) return [];
        return (bills || [])
            .filter((b) => billMonthKey(b) === billsBrowseMonth)
            .sort((a, b) => billSortTime(b) - billSortTime(a));
    }, [bills, billsBrowseMonth]);

    const latestApprovalRequest = useMemo(() => {
        const sortedBills = (bills || [])
            .slice()
            .sort((a, b) => billSortTime(b) - billSortTime(a));
        const focused = focusBillId
            ? sortedBills.find((bill) => String(bill._id) === String(focusBillId))
            : null;
        if (
            focused &&
            ['Pending Accounts', 'Pending HR', 'Approved', 'Paid', 'Rejected'].includes(
                String(focused.status),
            )
        ) {
            return focused;
        }
        return (
            sortedBills.find((bill) =>
                ['Pending Accounts', 'Pending HR'].includes(String(bill.status)),
            ) ||
            sortedBills.find((bill) =>
                ['Approved', 'Paid', 'Rejected'].includes(String(bill.status)),
            ) ||
            null
        );
    }, [bills, focusBillId]);

    const approvalIsPending = ['Pending Accounts', 'Pending HR'].includes(
        String(latestApprovalRequest?.status || ''),
    );
    const approvalCanAct = Boolean(
        approvalIsPending && latestApprovalRequest?.canApproveReject,
    );
    const approvalCanPay = Boolean(
        String(latestApprovalRequest?.status || '') === 'Approved' &&
            latestApprovalRequest?.canPay,
    );
    const approvalCanEdit = approvalCanAct || approvalCanPay;
    const approvalRequesterName =
        String(latestApprovalRequest?.requestedByName || '').trim() || '—';
    const approvalEmployeeName = approvalIsPending
        ? String(latestApprovalRequest?.pendingWithName || '').trim() || '—'
        : String(
              latestApprovalRequest?.approvedByName ||
                  latestApprovalRequest?.actionedByName ||
                  '',
          ).trim() || '—';

    useEffect(() => {
        if (activeTab !== 'bills' && activeTab !== 'overview') {
            setBillsBrowseMonth(null);
        }
    }, [activeTab]);

    useEffect(() => {
        if (!billsBrowseMonth) return;
        if (!recentMonthKeys.includes(billsBrowseMonth)) {
            setBillsBrowseMonth(null);
        }
    }, [billsBrowseMonth, recentMonthKeys]);

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

    const loadAssignmentHistory = useCallback(async () => {
        if (!entryId) return;
        setLoadingAssignmentHistory(true);
        try {
            const rows = await fetchUtilityEntryAssignmentHistory(entryId);
            setAssignmentHistory(rows);
        } catch {
            setAssignmentHistory([]);
        } finally {
            setLoadingAssignmentHistory(false);
        }
    }, [entryId]);

    const handleAccountsSaveLines = useCallback(
        async ({ billId, batchId, lines, patch }) => {
            const id = String(batchId || viewBill?.batchId || '').trim();
            const bid = String(billId || viewBill?._id || '').trim();
            if (!id || !bid) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot save',
                    description: 'Missing batch or bill id.',
                });
                return false;
            }
            setSavingLineAccounts(true);
            try {
                await axiosInstance.put(`/UtilityBill/batch/${id}`, {
                    rows: [
                        {
                            billId: bid,
                            lineItems: Array.isArray(lines) ? lines : [],
                            expenseAccountId: patch?.expenseAccountId || '',
                            expenseAccountName: patch?.expenseAccountName || '',
                            payBy: patch?.payBy || '',
                            payByCompanyId: patch?.payByCompanyId || '',
                            payByCompanyName: patch?.payByCompanyName || '',
                            payByEmployeeId: patch?.payByEmployeeId || '',
                            payByEmployeeName: patch?.payByEmployeeName || '',
                        },
                    ],
                });
                toast({
                    title: 'Account / Payable saved',
                    description: 'Zoho will use the updated accounts on Retry / Pay.',
                });
                setViewBill((prev) =>
                    prev && String(prev._id) === bid
                        ? {
                              ...prev,
                              lineItems: lines,
                              expenseAccountId: patch?.expenseAccountId || prev.expenseAccountId,
                              expenseAccountName:
                                  patch?.expenseAccountName || prev.expenseAccountName,
                              payBy: patch?.payBy || prev.payBy,
                              payByCompanyId: patch?.payByCompanyId || prev.payByCompanyId,
                              payByCompanyName: patch?.payByCompanyName || prev.payByCompanyName,
                              payByEmployeeId: patch?.payByEmployeeId || prev.payByEmployeeId,
                              payByEmployeeName:
                                  patch?.payByEmployeeName || prev.payByEmployeeName,
                          }
                        : prev,
                );
                await loadBills();
                return true;
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Save failed',
                    description: error.response?.data?.message || 'Could not update line accounts.',
                });
                return false;
            } finally {
                setSavingLineAccounts(false);
            }
        },
        [loadBills, toast, viewBill],
    );

    useEffect(() => {
        loadBills();
    }, [loadBills]);

    useEffect(() => {
        loadAssignmentHistory();
    }, [loadAssignmentHistory]);

    useEffect(() => {
        if (activeTab === 'history') {
            loadAssignmentHistory();
        }
    }, [activeTab, loadAssignmentHistory]);

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
        if (ym && recentMonthKeys.includes(ym)) {
            setActiveTab('overview');
            setBillsBrowseMonth(ym);
        } else if (ym) {
            setActiveTab('bills');
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
    }, [focusBillId, bills, recentMonthKeys, triggerBillPulse]);

    const detailRows = useMemo(
        () => (entry ? buildDetailFieldRows(entry, utilityConfig) : []),
        [entry, utilityConfig],
    );

    const monthlyRental = getMonthlyRentalAmount(entry);

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'bills', label: 'Bills' },
        { id: 'history', label: 'History' },
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
            if (payload.billMonth) {
                setBillsBrowseMonth(payload.billMonth);
            }
            loadBills();
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

    useEffect(() => {
        if (!addBillFromQuery || !entry) return;

        if (!entryIsActive) {
            toast({
                variant: 'destructive',
                title: 'Record inactive',
                description: 'Activate this utility record before adding bills.',
            });
        } else {
            if (queryBillMonth) {
                setAddBillPrefillMonth(queryBillMonth);
                setBillsBrowseMonth(queryBillMonth);
            }
            setAddBillOpen(true);
        }

        const next = new URLSearchParams(searchParams?.toString?.() || '');
        next.delete('addBill');
        next.delete('billMonth');
        const qs = next.toString();
        const base = `/HRM/Asset/UtilityBills/details/${encodeURIComponent(entryId)}`;
        router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
    }, [
        addBillFromQuery,
        queryBillMonth,
        entry,
        entryIsActive,
        entryId,
        router,
        searchParams,
        toast,
    ]);

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

    const handleHeaderApproval = async (decision) => {
        const id = latestApprovalRequest?.batchId || latestApprovalRequest?._id;
        if (!id || !approvalCanAct || approvalActing) return;
        if (decision === 'reject') {
            const ok = window.confirm('Reject this bill request?');
            if (!ok) return;
        }
        setApprovalActing(true);
        try {
            const res = await axiosInstance.put(`/UtilityBill/batch/${id}/respond`, { decision });
            const label = String(res.data?.statusLabel || res.data?.status || '');
            const returnedTo = String(res.data?.returnedTo || '').toLowerCase();
            const zohoSync = Array.isArray(res.data?.zohoSync) ? res.data.zohoSync : [];
            const zohoFailed = zohoSync.filter((row) => row && row.ok === false && !row.skipped);
            const zohoCreated = zohoSync.filter((row) => row && row.ok && !row.skipped);
            const differenceFailed = Boolean(res.data?.differenceJournalFailed);

            if (decision === 'approve' && zohoFailed.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Approved — Zoho sync failed',
                    description:
                        zohoFailed[0]?.message ||
                        'Zoho bill was not created. Use Edit to fix vendor / expense account, then retry.',
                });
            } else if (decision === 'approve' && differenceFailed) {
                toast({
                    variant: 'destructive',
                    title: 'Bill approved — Chart of Accounts Debit failed',
                    description:
                        String(res.data?.message || '').trim() ||
                        'Use Edit to retry Zoho sync after reconnecting Zoho Books.',
                });
            } else if (decision === 'reject') {
                const rejectTitle =
                    returnedTo === 'accounts'
                        ? 'Returned to Accounts'
                        : returnedTo === 'creator'
                          ? 'Returned to creator'
                          : 'Rejected';
                toast({
                    title: rejectTitle,
                    description:
                        returnedTo === 'accounts'
                            ? 'HR rejected — sent back to Accounts for re-review.'
                            : returnedTo === 'creator'
                              ? 'Accounts rejected — returned to the creator for correction.'
                              : label,
                });
            } else {
                toast({
                    title: label.toLowerCase() === 'not paid' ? 'Not paid' : 'Approved',
                    description:
                        label.toLowerCase() === 'not paid'
                            ? zohoCreated.length > 0
                                ? `Awaiting Accounts payment. ${zohoCreated.length} bill(s) Open in Zoho.`
                                : 'Awaiting Accounts payment.'
                            : label || 'Bill approved.',
                });
            }
            invalidateAssetPendingInbox('all');
            clearModuleNotificationFeedsCache();
            await loadBills();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: decision === 'reject' ? 'Could not reject' : 'Could not approve',
                description: err?.response?.data?.message || 'Please try again, or use Edit to change details.',
            });
        } finally {
            setApprovalActing(false);
        }
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

    const handleSaveEntryDetails = async (payload) => {
        if (!canEditEntryDetails || !entry?.id) return;
        try {
            const values = normalizePaymentDay(payload.values || {});
            const updated = await updateUtilityEntryApi(entry.id, {
                type: payload.type,
                values,
            });
            if (!updated) throw new Error('No entry returned');
            setEntry(normalizeUtilityEntry(updated));
            invalidateAssetPendingInbox('tools');
            clearModuleNotificationFeedsCache();
            toast({ title: 'Record updated' });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not update utility record',
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
        <div className="flex flex-col">
            {loadingBills ? (
                <p className="text-xs sm:text-sm text-gray-500 py-6 text-center">Loading bills…</p>
            ) : list.length === 0 ? (
                <div className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                    {emptyMessage || 'No bills yet. Click Add Bills to create one.'}
                </div>
            ) : (
                <div className="space-y-4 py-1">
                    {list.map((bill) => {
                        const contract = Number(bill.monthlyRental) || 0;
                        const total = getBillTotalAmount(bill);
                        const difference = contract - total;
                        const over = total > contract;
                        const focused = String(bill._id) === String(focusBillId);
                        const pulsing =
                            String(bill._id) === String(pulseBillId) && pulseBillOn;
                        const isNotPaid = bill.status === 'Approved';
                        const isPaid = bill.status === 'Paid';
                        const canApproveReject = Boolean(bill.canApproveReject);
                        const actionBatchId = bill.batchId || bill._id;
                        const showEdit = Boolean(canApproveReject && actionBatchId);
                        const vendorPayLabel = isPaid
                            ? 'Paid'
                            : isNotPaid
                              ? 'Not Paid'
                              : null;
                        const statusText = vendorPayLabel
                            ? `Vendor Payment: ${formatBillMoney(total)} · ${vendorPayLabel}`
                            : billDisplayStatus(bill);
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
                                            {formatZohoDocumentNumber(bill) !== '—' ? (
                                                <span
                                                    className="text-[10px] font-semibold px-2 py-0.5 bg-teal-50 text-teal-700 rounded border border-teal-100/70"
                                                    title="Zoho Books Serial No."
                                                >
                                                    Zoho {formatZohoDocumentNumber(bill)}
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
                                            Total
                                        </p>
                                        <p
                                            className={`text-xs sm:text-sm font-semibold tabular-nums ${
                                                over ? 'text-red-600' : 'text-gray-700'
                                            }`}
                                        >
                                            {formatBillMoney(total)}
                                        </p>
                                    </div>
                                    <div className="px-3 py-2 bg-gray-50/50 rounded-lg border border-gray-100/80">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                                            Contract
                                        </p>
                                        <p className="text-xs sm:text-sm font-semibold tabular-nums text-gray-700">
                                            {formatBillMoney(contract)}
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

                                {(() => {
                                    const parties = getBillAllocationParties(bill);
                                    if (!parties.length) return null;
                                    return (
                                    <div className="mt-3 pt-2.5 border-t border-dashed border-gray-100 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                            <CreditCard size={12} />
                                            <span>Payment by</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 justify-end">
                                            {parties.map((party) => (
                                                <span
                                                    key={party.key}
                                                    title={`${party.fullName || party.name}: ${formatBillMoney(party.amount)}`}
                                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border max-w-[14rem] truncate ${
                                                        party.type === 'employee'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                            : 'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}
                                                >
                                                    {party.name}: {formatBillMoney(party.amount)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    );
                                })()}

                                <div className="flex items-center justify-between gap-3 mt-3.5 pt-2.5 border-t border-gray-50">
                                    <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                                        {isNotPaid || isPaid
                                            ? paymentByLabel(bill)
                                            : bill.status === 'Pending HR'
                                              ? 'Awaiting HR Approval'
                                              : bill.status === 'Pending Accounts'
                                                ? 'Awaiting Accounts Review'
                                                : paymentByLabel(bill)}
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
                                        {showEdit ? (
                                            <button
                                                type="button"
                                                onClick={openBatchReview}
                                                title="Edit bill details"
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <Pencil size={12} />
                                                Edit
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

    const toggleBrowseMonth = (ym) => {
        if (billsBrowseMonth === ym) {
            setBillsBrowseMonth(null);
            return;
        }
        setBillsBrowseMonth(ym);
    };

    /** Current month + 5 previous — click a month to expand its bills (height grows, no scrollbar). */
    const renderRecentMonthsBrowse = () => {
        if (loadingBills) {
            return <p className="text-xs sm:text-sm text-gray-500 py-6 text-center">Loading bills…</p>;
        }

        return (
            <div className="space-y-2.5">
                <p className="text-xs sm:text-sm font-medium text-slate-500 px-0.5">
                    From account start · click a month to open bills
                </p>
                {recentMonthBillGroups.map(({ ym, bills: monthBills, summary }) => {
                    const monthOpen = billsBrowseMonth === ym;
                    const monthBillList = monthOpen ? billsForBrowseMonth : monthBills;
                    const isCurrent = ym === recentMonthKeys[0];
                    return (
                        <div
                            key={ym}
                            className={`rounded-xl border bg-white overflow-hidden transition-[border-color,box-shadow] duration-200 ${
                                monthOpen
                                    ? 'border-teal-200 shadow-sm'
                                    : 'border-slate-200/80 hover:border-slate-300'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => toggleBrowseMonth(ym)}
                                className={`w-full flex items-center gap-3 sm:gap-4 px-3.5 sm:px-4 py-2.5 sm:py-3 text-left transition-colors ${
                                    monthOpen ? 'bg-teal-50/40' : 'hover:bg-slate-50/90'
                                }`}
                            >
                                <div className="min-w-0 shrink-0 w-[5.5rem] sm:w-[7rem]">
                                    <p className="text-sm sm:text-base font-semibold text-slate-900">
                                        {monthLabelFromKey(ym)}
                                        {isCurrent ? (
                                            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-teal-600">
                                                Now
                                            </span>
                                        ) : null}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                        {summary.billCount}{' '}
                                        {summary.billCount === 1 ? 'bill' : 'bills'}
                                    </p>
                                </div>
                                <BillGroupSummaryStats summary={summary} compact />
                                <span
                                    className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                                        monthOpen
                                            ? 'bg-teal-100 text-teal-700'
                                            : 'bg-slate-100 text-slate-400'
                                    }`}
                                >
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200 ${
                                            monthOpen ? 'rotate-0' : '-rotate-90'
                                        }`}
                                    />
                                </span>
                            </button>
                            {monthOpen ? (
                                <div className="border-t border-slate-100 px-2 py-2">
                                    {renderBillsList(
                                        monthBillList,
                                        'No bills for this month.',
                                    )}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
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
                                {entry.assignedTo ? (
                                    <>
                                        Assigned to{' '}
                                        {entry.assignedToType === 'Company' ? 'company' : 'employee'}:{' '}
                                        {entry.assignedToType === 'Employee' && entry.assignedToId ? (
                                            <EmployeeNameLink
                                                employeeId={entry.assignedToId}
                                                name={entry.assignedTo}
                                                className="font-medium"
                                            />
                                        ) : (
                                            entry.assignedTo
                                        )}
                                    </>
                                ) : (
                                    'Utility account details and bills'
                                )}
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
                        {/* Card 1 — this month + previous 12 months bill amounts */}
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                            <div className="h-full flex flex-col min-h-0">
                                <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 shrink-0">
                                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-[0.18em]">
                                        Bill Amounts
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                        {accountFromMonth
                                            ? `From ${monthLabelFromKey(accountFromMonth, { shortOnly: true })}`
                                            : 'Last 12 months'}
                                    </p>
                                </div>
                                <div className="flex-1 min-h-0 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-2.5 auto-rows-fr content-stretch overflow-hidden">
                                    {twelveMonthBillSeries.map((m, idx) => (
                                        <div
                                            key={m.ym}
                                            title={`${monthLabelFromKey(m.ym)} · ${m.billCount} bill(s)`}
                                            className={`rounded-xl border px-2 py-3 sm:px-3 sm:py-4 flex flex-col items-center justify-center min-w-0 min-h-[72px] sm:min-h-[88px] ${
                                                idx === 0
                                                    ? 'bg-teal-50 border-teal-200'
                                                    : 'bg-gray-50/80 border-gray-100'
                                            }`}
                                        >
                                            <span
                                                className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide truncate w-full text-center ${
                                                    idx === 0 ? 'text-teal-700' : 'text-gray-400'
                                                }`}
                                            >
                                                {m.label}
                                            </span>
                                            <span
                                                className={`mt-1.5 text-sm sm:text-base font-bold tabular-nums truncate w-full text-center ${
                                                    m.amount > 0 ? 'text-gray-800' : 'text-gray-300'
                                                }`}
                                            >
                                                {formatBillMoney(m.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Card 2 — 1/2 deduction months | 1/2 approval */}
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                            <div className="h-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-h-0">
                                <div className="min-w-0 flex flex-col min-h-0 border-b sm:border-b-0 sm:border-r border-gray-100 pb-3 sm:pb-0 sm:pr-3">
                                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-3 shrink-0">
                                        Deduction Months
                                    </p>
                                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
                                        {deductionMonths.length ? (
                                            deductionMonths.map((m) => (
                                                <div
                                                    key={m.ym}
                                                    className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-3 sm:px-3.5 sm:py-3.5 flex items-center justify-between gap-2 min-h-[64px]"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 truncate">
                                                            {m.label}
                                                        </p>
                                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                                            {m.billCount} bill
                                                            {m.billCount === 1 ? '' : 's'}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`text-sm sm:text-base font-bold tabular-nums shrink-0 ${
                                                            m.difference < 0
                                                                ? 'text-red-600'
                                                                : 'text-emerald-600'
                                                        }`}
                                                    >
                                                        {formatBillMoney(m.difference)}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-1 items-center justify-center text-xs text-gray-400 py-6">
                                                No deduction months
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0 flex flex-col justify-between gap-2 sm:pl-1">
                                    {latestApprovalRequest ? (
                                        <>
                                            <div className="grid grid-cols-1 gap-2 flex-1 content-center">
                                                <div className="bg-blue-50 p-2 sm:p-2.5 rounded-lg border border-blue-100 min-w-0">
                                                    <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                                                        Requested by
                                                    </span>
                                                    <p
                                                        title={approvalRequesterName}
                                                        className="mt-0.5 text-xs sm:text-sm font-bold text-blue-800 truncate"
                                                    >
                                                        {approvalRequesterName}
                                                    </p>
                                                </div>
                                                <div
                                                    className={`p-2 sm:p-2.5 rounded-lg border min-w-0 ${
                                                        latestApprovalRequest.status === 'Rejected'
                                                            ? 'bg-red-50 border-red-100'
                                                            : approvalIsPending
                                                              ? 'bg-amber-50 border-amber-100'
                                                              : 'bg-emerald-50 border-emerald-100'
                                                    }`}
                                                >
                                                    <span
                                                        className={`text-[10px] font-medium uppercase tracking-wide ${
                                                            latestApprovalRequest.status === 'Rejected'
                                                                ? 'text-red-600'
                                                                : approvalIsPending
                                                                  ? 'text-amber-600'
                                                                  : 'text-emerald-600'
                                                        }`}
                                                    >
                                                        {approvalIsPending
                                                            ? 'Approves by'
                                                            : latestApprovalRequest.status ===
                                                                'Rejected'
                                                              ? 'Rejected by'
                                                              : 'Approved by'}
                                                    </span>
                                                    <p
                                                        title={approvalEmployeeName}
                                                        className={`mt-0.5 text-xs sm:text-sm font-bold truncate ${
                                                            latestApprovalRequest.status === 'Rejected'
                                                                ? 'text-red-800'
                                                                : approvalIsPending
                                                                  ? 'text-amber-800'
                                                                  : 'text-emerald-800'
                                                        }`}
                                                    >
                                                        {approvalEmployeeName}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 shrink-0">
                                                {approvalCanEdit ? (
                                                    <button
                                                        type="button"
                                                        disabled={approvalActing}
                                                        onClick={() =>
                                                            openBillReview(latestApprovalRequest)
                                                        }
                                                        title={
                                                            approvalCanPay
                                                                ? 'Edit bill details before paying'
                                                                : 'Edit bill details before approving'
                                                        }
                                                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Pencil size={12} />
                                                        Edit
                                                    </button>
                                                ) : (
                                                    <span />
                                                )}
                                                {approvalCanPay ? (
                                                    <button
                                                        type="button"
                                                        disabled={approvalActing}
                                                        onClick={() =>
                                                            openBillReview(latestApprovalRequest)
                                                        }
                                                        title="Pay this approved bill"
                                                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-teal-200 bg-teal-500 px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <CreditCard size={13} />
                                                        Pay
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={!approvalCanAct || approvalActing}
                                                        onClick={() => handleHeaderApproval('reject')}
                                                        title={
                                                            approvalCanAct
                                                                ? 'Reject this request'
                                                                : 'Only the assigned approver can reject this request'
                                                        }
                                                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                                                    >
                                                        {approvalCanAct ? (
                                                            <X size={13} />
                                                        ) : (
                                                            <LockKeyhole size={12} />
                                                        )}
                                                        {approvalActing ? 'Saving…' : 'Reject'}
                                                    </button>
                                                )}
                                                {approvalCanPay ? null : (
                                                    <button
                                                        type="button"
                                                        disabled={!approvalCanAct || approvalActing}
                                                        onClick={() => handleHeaderApproval('approve')}
                                                        title={
                                                            approvalCanAct
                                                                ? 'Approve this request'
                                                                : 'Only the assigned approver can approve this request'
                                                        }
                                                        className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-teal-200 bg-teal-500 px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                                                    >
                                                        {approvalCanAct ? (
                                                            <Check size={13} />
                                                        ) : (
                                                            <LockKeyhole size={12} />
                                                        )}
                                                        {approvalActing ? 'Saving…' : 'Approve'}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-1 items-center justify-center text-xs text-gray-400">
                                            No bill approval request
                                        </div>
                                    )}
                                </div>
                            </div>
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
                        <div className={`${DETAIL_PAIR_GRID} !items-start`}>
                            <div className={DETAIL_PAIR_COLUMN}>
                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3 border-b border-gray-100">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="text-lg sm:text-xl font-bold text-gray-800 truncate">
                                                {entry.type} Details
                                            </h3>
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${entryStatusBadgeClass(entryStatus)}`}
                                            >
                                                {entryStatus}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {canEditEntryDetails ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditEntryOpen(true)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm"
                                                >
                                                    <Pencil size={14} />
                                                    Edit
                                                </button>
                                            ) : null}
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
                                    </div>
                                    {renderDetailFields()}
                                </div>
                            </div>
                            {/* Latest Bills — this month + 5 previous; expands without inner scrollbar */}
                            <div className={DETAIL_PAIR_COLUMN}>
                                <div className="flex flex-col">
                                    {renderBillsHeader('Latest Bills')}
                                    {renderRecentMonthsBrowse()}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'history' ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <History size={18} className="text-teal-600 shrink-0" />
                                    <div className="min-w-0">
                                        <h3 className="text-base sm:text-lg font-bold text-gray-800">
                                            Assignment History
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            Assign, reassign, and return events for this account
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-gray-500 tabular-nums shrink-0">
                                    {assignmentHistory.length} record
                                    {assignmentHistory.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            {loadingAssignmentHistory ? (
                                <div className="px-4 sm:px-6 py-10 text-center text-sm text-gray-500">
                                    Loading assignment history…
                                </div>
                            ) : assignmentHistory.length === 0 ? (
                                <div className="px-4 sm:px-6 py-10 text-center text-sm text-gray-500">
                                    No assignment history yet. Assign, reassign, or return this
                                    account to start the timeline.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] table-auto text-left text-xs sm:text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] sm:text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                                <th className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                                                    Date
                                                </th>
                                                <th className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                                                    Action
                                                </th>
                                                <th className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                                                    From
                                                </th>
                                                <th className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                                                    To
                                                </th>
                                                <th className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                                                    By
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {assignmentHistory.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    className="hover:bg-blue-50/40 transition-colors"
                                                >
                                                    <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap text-gray-700 tabular-nums">
                                                        {formatHistoryDateTime(row.occurredAt)}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${assignmentActionBadgeClass(row.action)}`}
                                                        >
                                                            {assignmentActionLabel(row.action)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-2.5 text-gray-700">
                                                        {row.fromAssignedToType === 'Employee' &&
                                                        row.fromAssignedToId ? (
                                                            <EmployeeNameLink
                                                                employeeId={row.fromAssignedToId}
                                                                name={row.fromAssignedTo}
                                                            />
                                                        ) : (
                                                            formatAssigneeCell(
                                                                row.fromAssignedTo,
                                                                row.fromAssignedToType,
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-2.5 text-gray-700">
                                                        {row.toAssignedToType === 'Employee' &&
                                                        row.toAssignedToId ? (
                                                            <EmployeeNameLink
                                                                employeeId={row.toAssignedToId}
                                                                name={row.toAssignedTo}
                                                            />
                                                        ) : (
                                                            formatAssigneeCell(
                                                                row.toAssignedTo,
                                                                row.toAssignedToType,
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap text-gray-700">
                                                        {row.performedByName || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {renderBillsHeader('All Bills')}
                            {renderRecentMonthsBrowse()}
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

            <CreateUtilityEntryModal
                isOpen={editEntryOpen}
                onClose={() => setEditEntryOpen(false)}
                utilityType={entry?.type || ''}
                enabledFields={utilityConfig?.fields || {}}
                initialEntry={entry}
                onSave={handleSaveEntryDetails}
            />

            <AddBillModal
                isOpen={addBillOpen || Boolean(viewBill)}
                onClose={() => {
                    const id = viewBill?._id;
                    setAddBillOpen(false);
                    setViewBill(null);
                    setAddBillPrefillMonth('');
                    if (id) {
                        window.setTimeout(() => {
                            document
                                .getElementById(`bill-${id}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            triggerBillPulse(id);
                        }, 50);
                    }
                }}
                entries={
                    viewBill
                        ? entry
                            ? [entry]
                            : []
                        : entry && entryIsActive
                          ? [entry]
                          : []
                }
                existingBills={bills}
                utilityType={entry?.type || ''}
                utilityAttachment={utilityConfig?.attachment || null}
                monthlyRental={monthlyRental}
                onSubmit={handleAddBill}
                saving={savingBill || savingLineAccounts}
                viewBill={viewBill}
                accountsCanEditLines={viewBillAllowsAccountsLineEdit}
                onAccountsSaveLines={handleAccountsSaveLines}
                initialBillMonth={addBillPrefillMonth}
            />

            <UtilityBillReviewModal
                isOpen={Boolean(reviewBatchId)}
                batchId={reviewBatchId}
                entries={entry ? [entry] : []}
                existingBills={bills}
                utilityAttachment={utilityConfig?.attachment || null}
                onClose={closeBillReview}
                onChanged={() => {
                    invalidateAssetPendingInbox('all');
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
