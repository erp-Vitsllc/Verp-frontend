'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { Bell, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import { AnimatedCounter } from '@/app/HRM/Asset/components/ListPageSummaryCards';
import AddUtilityModal, { UTILITY_TOGGLE_FIELDS } from './components/AddUtilityModal';
import CreateUtilityEntryModal from './components/CreateUtilityEntryModal';
import AssignUtilityEntryModal from './components/AssignUtilityEntryModal';
import AddBillModal from './components/AddBillModal';
import UtilityBillReviewModal from './components/UtilityBillReviewModal';
import UtilityBillStatsCards from './components/UtilityBillStatsCards';
import FieldViewModal from './components/FieldViewModal';
import PendingAssetRequestsModal from '../components/PendingAssetRequestsModal';
import axiosInstance from '@/utils/axios';
import { fetchAssetPendingInbox } from '@/utils/pendingInboxFetch';
import { ASSET_PENDING_INBOX_CHANGED } from '../utils/assetPendingInboxCount';
import { useToast } from '@/hooks/use-toast';
import { invalidateAssetPendingInbox } from '../utils/assetPendingInboxCount';
import {
    clearUtilityBillDraft,
    entryLifecycleStatus,
    isEntryActive,
    normalizePaymentDay,
    normalizeUtilityEntries,
} from './utils/utilityBillsStorage';
import { openUtilityAttachment } from './utils/openUtilityAttachment';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';

const CELL_MAX_LEN = 42;
const LONG_TEXT_KEYS = new Set(['planDetails', 'location', 'paymentDetails']);

/** Match Fine / Loan primary & secondary action buttons. */
const ERP_PRIMARY_BTN =
    'bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap';
const ERP_SECONDARY_BTN =
    'bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap';

const UTILITIES_STORAGE_KEY = 'verp_utility_bills_created';
const UTILITY_ENTRIES_STORAGE_KEY = 'verp_utility_bill_entries';

function loadJsonArray(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveJsonArray(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
}

/** Migrate older Payment Details toggle key → Payment Date. */
function normalizeUtilityFields(fields = {}) {
    const next = { ...fields };
    if (next.paymentDetails != null && next.paymentDate == null) {
        next.paymentDate = next.paymentDetails;
    }
    delete next.paymentDetails;
    return next;
}

function normalizeUtilities(list) {
    return list.map((u) => ({
        ...u,
        status: entryLifecycleStatus(u),
        fields: normalizeUtilityFields(u.fields || {}),
    }));
}

function entryStatusBadgeClass(status) {
    return entryLifecycleStatus({ status }) === 'Active'
        ? 'bg-teal-50 text-teal-700 border-teal-200'
        : 'bg-gray-100 text-gray-500 border-gray-200';
}

function formatCellValue(key, values) {
    const v = values || {};
    if (key === 'contractPeriod') {
        const start = v.contractStart || '—';
        const end = v.contractEnd || '—';
        return `${start} → ${end}`;
    }
    if (key === 'monthlyRental') {
        if (v.monthlyRental === '' || v.monthlyRental == null) return '—';
        const n = Number(v.monthlyRental);
        return Number.isFinite(n) ? `${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED` : String(v.monthlyRental);
    }
    if (key === 'paymentDate' || key === 'paymentDay') {
        const n = Number(v.paymentDay ?? v.paymentDate);
        if (Number.isInteger(n) && n >= 1 && n <= 31) return `Day ${n} every month`;
        return '—';
    }
    if (key === 'assignment') return null;
    if (key === 'attachment') {
        const file = v.attachment;
        if (file && typeof file === 'object' && file.name) return String(file.name);
        return '—';
    }
    return v[key] || '—';
}

function isLongCellValue(key, text) {
    const t = String(text ?? '');
    if (LONG_TEXT_KEYS.has(key)) return t.length > 28 || t.includes('\n');
    return t.length > CELL_MAX_LEN || t.includes('\n');
}

function truncateCellText(text) {
    const t = String(text ?? '—').replace(/\s+/g, ' ').trim();
    if (t.length <= CELL_MAX_LEN) return t;
    return `${t.slice(0, CELL_MAX_LEN - 1)}…`;
}

/**
 * Utility Bills list — header cards + type tabs for each created utility.
 */
function countUtilityBillPending(items = []) {
    return (Array.isArray(items) ? items : []).filter(
        (row) => {
            const t = String(row?.requestType || '').trim();
            return t === 'Utility Bill Payment' || t === 'Utility Bill Payment Reminder';
        },
    ).length;
}

function UtilityBillsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editingUtility, setEditingUtility] = useState(null);
    const [createEntryOpen, setCreateEntryOpen] = useState(false);
    const [assignEntry, setAssignEntry] = useState(null);
    const [addBillsOpen, setAddBillsOpen] = useState(false);
    const [savingBill, setSavingBill] = useState(false);
    const [reviewBatchId, setReviewBatchId] = useState('');
    const [viewFieldModal, setViewFieldModal] = useState(null);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const [utilities, setUtilities] = useState([]);
    const [entries, setEntries] = useState([]);
    const [activeTypeTab, setActiveTypeTab] = useState('');
    /** Sub-tabs under type tabs: Active | Deactivated */
    const [listStatusTab, setListStatusTab] = useState('active');
    const [typeBills, setTypeBills] = useState([]);

    useEffect(() => {
        const batchId = String(searchParams?.get('batchId') || '').trim();
        const review = String(searchParams?.get('review') || '') === '1';
        if (batchId && review) {
            setReviewBatchId(batchId);
            const type = String(searchParams?.get('type') || '').trim();
            if (type) setActiveTypeTab(type);
        }
    }, [searchParams]);

    const loadTypeBills = useCallback(async (typeName) => {
        if (!typeName) {
            setTypeBills([]);
            return;
        }
        try {
            const res = await axiosInstance.get('/UtilityBill', {
                params: { utilityType: typeName },
                skipToast: true,
            });
            setTypeBills(Array.isArray(res.data?.bills) ? res.data.bills : []);
        } catch {
            setTypeBills([]);
        }
    }, []);

    useEffect(() => {
        loadTypeBills(activeTypeTab);
    }, [activeTypeTab, loadTypeBills]);

    useEffect(() => {
        const loaded = normalizeUtilities(loadJsonArray(UTILITIES_STORAGE_KEY));
        const loadedEntries = normalizeUtilityEntries(loadJsonArray(UTILITY_ENTRIES_STORAGE_KEY));
        setUtilities(loaded);
        setEntries(loadedEntries);
        saveJsonArray(UTILITIES_STORAGE_KEY, loaded);
        saveJsonArray(UTILITY_ENTRIES_STORAGE_KEY, loadedEntries);
        if (loaded.length > 0) {
            setActiveTypeTab(loaded[0].type);
        }
    }, []);

    const fetchPendingInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchAssetPendingInbox(axiosInstance, {
                inboxScope: 'tools',
                skipSync: !force,
                skipToast: true,
                force,
            });
            setPendingInboxCount(countUtilityBillPending(items));
        } catch {
            setPendingInboxCount(0);
        }
    }, []);

    useEffect(() => {
        fetchPendingInboxCount();
        const intervalId = setInterval(() => fetchPendingInboxCount(), 5 * 60 * 1000);
        const onInboxChanged = () => fetchPendingInboxCount({ force: true });
        window.addEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
        };
    }, [fetchPendingInboxCount]);

    const typeTabs = useMemo(() => {
        const map = new Map();
        utilities.forEach((u) => {
            if (!u?.type) return;
            map.set(u.type, u);
        });
        return Array.from(map.values());
    }, [utilities]);

    useEffect(() => {
        if (typeTabs.length === 0) {
            setActiveTypeTab('');
            return;
        }
        if (!typeTabs.some((t) => t.type === activeTypeTab)) {
            setActiveTypeTab(typeTabs[0].type);
        }
    }, [typeTabs, activeTypeTab]);

    const activeUtility = useMemo(
        () => typeTabs.find((t) => t.type === activeTypeTab) || null,
        [typeTabs, activeTypeTab],
    );

    const activeEntries = useMemo(
        () => entries.filter((e) => e.type === activeTypeTab),
        [entries, activeTypeTab],
    );

    const statusFilteredEntries = useMemo(() => {
        if (listStatusTab === 'deactivated') {
            return activeEntries.filter((e) => !isEntryActive(e));
        }
        return activeEntries.filter((e) => isEntryActive(e));
    }, [activeEntries, listStatusTab]);

    const activeStatusCount = useMemo(
        () => activeEntries.filter((e) => isEntryActive(e)).length,
        [activeEntries],
    );

    const deactivatedStatusCount = useMemo(
        () => activeEntries.filter((e) => !isEntryActive(e)).length,
        [activeEntries],
    );

    const tableColumns = useMemo(() => {
        if (!activeUtility?.fields) return [];
        const cols = UTILITY_TOGGLE_FIELDS.filter(
            (f) => activeUtility.fields[f.key] === 'yes' && f.key !== 'assignment',
        );
        if (activeUtility.fields.attachment === 'yes') {
            cols.push({ key: 'attachment', label: 'Attachment' });
        }
        return cols;
    }, [activeUtility]);

    const showAssignColumn = activeUtility?.fields?.assignment === 'yes';

    /** Overview boxes: only types that are in use (count > 0). Zero-count types stay hidden. */
    const typeOverviewCards = useMemo(() => {
        return typeTabs
            .map((tab) => {
                const typeName = String(tab.type || '');
                const count = entries.filter(
                    (e) => String(e.type || '').toLowerCase() === typeName.toLowerCase(),
                ).length;
                return {
                    label: typeName,
                    value: count,
                    type: typeName,
                };
            })
            .filter((item) => Number(item.value) > 0);
    }, [typeTabs, entries]);

    const openAddUtility = () => {
        setEditingUtility(null);
        setAddModalOpen(true);
    };

    const openEditUtility = (utility) => {
        setEditingUtility(utility);
        setActiveTypeTab(utility.type);
        setAddModalOpen(true);
    };

    const isUtilityTabUsed = (typeName) =>
        entries.some((e) => String(e.type || '').toLowerCase() === String(typeName || '').toLowerCase());

    const handleDeleteUtility = (utility) => {
        const typeName = utility?.type || '';
        if (!typeName) return;
        if (isUtilityTabUsed(typeName)) {
            window.alert(`“${typeName}” has records, so Delete is disabled until those records are removed.`);
            return;
        }
        if (!window.confirm(`Delete “${typeName}” tab? The type will stay in the dropdown for reuse.`)) return;

        setUtilities((prev) => {
            const next = prev.filter(
                (u) => String(u.type || '').toLowerCase() !== String(typeName).toLowerCase(),
            );
            saveJsonArray(UTILITIES_STORAGE_KEY, next);
            return next;
        });
        if (String(activeTypeTab).toLowerCase() === String(typeName).toLowerCase()) {
            setActiveTypeTab('');
        }
    };

    const usedTypeNames = useMemo(
        () => typeTabs.map((t) => t.type).filter(Boolean),
        [typeTabs],
    );

    const handleSaveUtility = (payload) => {
        setUtilities((prev) => {
            const typeKey = String(payload.type || '').toLowerCase();
            const existing = prev.find((u) => String(u.type || '').toLowerCase() === typeKey);
            const withoutSameType = prev.filter((u) => String(u.type || '').toLowerCase() !== typeKey);
            const next = [
                {
                    id: existing?.id || `${Date.now()}`,
                    type: payload.type,
                    status: existing?.status || 'Active',
                    fields: normalizeUtilityFields(payload.fields || {}),
                    attachment: payload.attachment || null,
                    createdAt: existing?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                ...withoutSameType,
            ];
            saveJsonArray(UTILITIES_STORAGE_KEY, next);
            return next;
        });
        setActiveTypeTab(payload.type);
        setEditingUtility(null);
    };

    const billableEntries = useMemo(
        () => activeEntries.filter((e) => isEntryActive(e)),
        [activeEntries],
    );

    const openAddBills = () => {
        if (!billableEntries.length) {
            window.alert(
                activeEntries.length
                    ? `All ${activeUtility?.type || 'utility'} records are inactive. Activate one to add bills.`
                    : `Create a ${activeUtility?.type || 'utility'} record first, then add bills.`,
            );
            return;
        }
        setAddBillsOpen(true);
    };

    const handleAddBills = async (payload) => {
        const rows = Array.isArray(payload?.rows) ? payload.rows : [];
        if (!rows.length) return { ok: false };
        setSavingBill(true);
        try {
            const res = await axiosInstance.post('/UtilityBill/batch', {
                utilityType: payload.utilityType || activeUtility?.type || '',
                billMonth: payload.billMonth,
                notes: payload.notes || '',
                rows: rows.map((row) => ({
                    entryId: row.entryId,
                    actualAmount: row.actualAmount,
                    contractAmount: row.contractAmount,
                    accountNo: row.accountNo,
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
                })),
            });
            if (payload.clearDraftOnSuccess) {
                clearUtilityBillDraft(payload.utilityType || activeUtility?.type || '');
            }
            if (!payload.keepOpen) {
                setAddBillsOpen(false);
            }
            invalidateAssetPendingInbox('tools');
            clearModuleNotificationFeedsCache();
            fetchPendingInboxCount({ force: true });
            await loadTypeBills(activeTypeTab);
            return { ok: true };
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not submit bills',
                description: err?.response?.data?.message || 'Please try again.',
            });
            return { ok: false };
        } finally {
            setSavingBill(false);
        }
    };

    const closeReviewModal = () => {
        setReviewBatchId('');
        const next = new URLSearchParams(searchParams?.toString?.() || '');
        next.delete('batchId');
        next.delete('review');
        next.delete('billMonth');
        const qs = next.toString();
        router.replace(qs ? `/HRM/Asset/UtilityBills?${qs}` : '/HRM/Asset/UtilityBills');
    };

    const handleSaveEntry = (payload) => {
        const entryId = `${Date.now()}`;
        const values = normalizePaymentDay(payload.values || {});
        const entry = {
            id: entryId,
            type: payload.type,
            status: 'Active',
            values,
            assignedTo: '',
            createdAt: new Date().toISOString(),
        };
        setEntries((prev) => {
            const next = [entry, ...prev];
            saveJsonArray(UTILITY_ENTRIES_STORAGE_KEY, next);
            return next;
        });

        // Register monthly payment day so HR gets T-10 / T-5 / due reminders + bell
        const paymentDay = Number(values.paymentDay);
        if (Number.isInteger(paymentDay) && paymentDay >= 1 && paymentDay <= 31) {
            axiosInstance
                .post(
                    '/UtilityBill/payment-day',
                    {
                        entryId,
                        paymentDay,
                        utilityType: payload.type || '',
                        accountNo: values.accountNumber || '',
                        provider: values.provider || '',
                        status: 'Active',
                    },
                    { skipToast: true },
                )
                .then(() => {
                    invalidateAssetPendingInbox('tools');
                    clearModuleNotificationFeedsCache();
                    fetchPendingInboxCount({ force: true });
                })
                .catch((err) => {
                    console.warn(
                        '[UtilityBills] payment-day register failed',
                        err?.response?.data?.message || err?.message,
                    );
                });
        }
    };

    const handleAssignSave = (payload) => {
        if (!assignEntry?.id) return;
        const assignedTo = payload?.assignedTo || payload?.assignedToName || '';
        const assignedToType = payload?.assignedToType || 'Employee';
        const assignedToId = payload?.assignedToId || '';
        setEntries((prev) => {
            const next = prev.map((e) =>
                e.id === assignEntry.id
                    ? {
                          ...e,
                          assignedTo,
                          assignedToType,
                          assignedToId,
                          assignedAt: new Date().toISOString(),
                      }
                    : e,
            );
            saveJsonArray(UTILITY_ENTRIES_STORAGE_KEY, next);
            return next;
        });
    };

    const renderTypeStatCard = (item) => {
        const isActive =
            String(activeTypeTab || '').toLowerCase() === String(item.type || '').toLowerCase();

        return (
            <button
                key={item.type}
                type="button"
                onClick={() => setActiveTypeTab(item.type)}
                className={`p-2 sm:p-3 rounded-xl flex flex-col items-center justify-center text-center transition-all border min-h-[72px] sm:min-h-[88px] ${
                    isActive
                        ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200'
                        : 'bg-gray-50 border-transparent hover:bg-white hover:shadow-md hover:border-gray-200'
                }`}
                title={`${item.label}: ${item.value} record${item.value === 1 ? '' : 's'}`}
            >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 break-words text-center leading-tight line-clamp-2 px-0.5">
                    {item.label}
                </span>
                <span
                    className="text-xl sm:text-2xl lg:text-3xl font-black tabular-nums"
                    style={{ color: '#dc2626' }}
                >
                    <AnimatedCounter value={item.value} />
                </span>
            </button>
        );
    };

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
                                Utility Bills
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600">
                                Manage utility bills and payment status
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setPendingInboxModalOpen(true)}
                                className="relative p-1.5 sm:p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800 shrink-0"
                                title="Pending utility bill HR approvals"
                            >
                                <Bell size={20} />
                                {pendingInboxCount > 0 ? (
                                    <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                        {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
                                    </span>
                                ) : null}
                            </button>
                            <button
                                type="button"
                                onClick={openAddUtility}
                                className={ERP_PRIMARY_BTN}
                            >
                                <Plus size={18} strokeWidth={2} />
                                Add Utility
                            </button>
                        </div>
                    </div>

                    <div className={HEADER_PAIR_GRID}>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                            <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 shrink-0">
                                Utility Overview
                            </h3>
                            {typeOverviewCards.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 min-h-0">
                                    <p className="text-xs sm:text-sm text-gray-500 text-center">
                                        Type boxes appear here once a type has records (count &gt; 0).
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 flex-1 content-start overflow-y-auto min-h-0 pr-0.5">
                                    {typeOverviewCards.map((item) => renderTypeStatCard(item))}
                                </div>
                            )}
                        </div>

                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                        >
                            
                        </div>
                    </div>

                    <div className="mb-4 sm:mb-6">
                        {typeTabs.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-200 px-4 py-5 text-center">
                                <p className="text-sm text-gray-500">
                                    Created utility types will appear here as tabs. Click “Add Utility” to create one.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                                <div className="flex items-center gap-4 sm:gap-6 lg:gap-10 border-b border-gray-200 px-3 sm:px-4 overflow-x-auto">
                                    {typeTabs.map((tab) => {
                                        const active = tab.type === activeTypeTab;
                                        const tabUsed = isUtilityTabUsed(tab.type);
                                        return (
                                            <div
                                                key={tab.id || tab.type}
                                                className="relative group shrink-0"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveTypeTab(tab.type);
                                                        setListStatusTab('active');
                                                    }}
                                                    className={`pb-4 pt-3 text-sm font-bold uppercase tracking-widest transition-all relative ${
                                                        active
                                                            ? 'text-blue-600'
                                                            : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                                >
                                                    {tab.type}
                                                    {active ? (
                                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.3)]" />
                                                    ) : null}
                                                </button>

                                                <div
                                                    className="absolute left-1/2 top-full z-20 hidden -translate-x-1/2 group-hover:flex flex-col items-center pt-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-md whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            title="Edit"
                                                            onClick={() => openEditUtility(tab)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-teal-700 hover:bg-teal-50"
                                                        >
                                                            <Pencil size={12} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title={
                                                                tabUsed
                                                                    ? 'Has records — delete disabled'
                                                                    : 'Delete tab'
                                                            }
                                                            disabled={tabUsed}
                                                            onClick={() => handleDeleteUtility(tab)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                                        >
                                                            <Trash2 size={12} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-3 sm:p-4 lg:p-5">
                                    {activeUtility ? (
                                        <>
                                            <div className="flex items-center gap-4 sm:gap-6 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
                                                {[
                                                    {
                                                        id: 'active',
                                                        label: 'Active',
                                                        count: activeStatusCount,
                                                    },
                                                    {
                                                        id: 'deactivated',
                                                        label: 'Deactivated',
                                                        count: deactivatedStatusCount,
                                                    },
                                                ].map((tab) => (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        onClick={() => setListStatusTab(tab.id)}
                                                        className={`pb-3 text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${
                                                            listStatusTab === tab.id
                                                                ? 'text-blue-600'
                                                                : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            {tab.label}
                                                            <span
                                                                className={`px-2 py-0.5 rounded-full text-[10px] ${
                                                                    listStatusTab === tab.id
                                                                        ? 'bg-blue-100 text-blue-600'
                                                                        : 'bg-gray-100 text-gray-500'
                                                                }`}
                                                            >
                                                                {tab.count}
                                                            </span>
                                                        </span>
                                                        {listStatusTab === tab.id ? (
                                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.3)]" />
                                                        ) : null}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
                                                <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                                                    {activeUtility.type} Directory
                                                </h2>
                                                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                                                    {listStatusTab === 'active' ? (
                                                        <button
                                                            type="button"
                                                            onClick={openAddBills}
                                                            className={ERP_SECONDARY_BTN}
                                                        >
                                                            <Plus size={18} strokeWidth={2} />
                                                            Add Bills
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCreateEntryOpen(true)}
                                                        className={ERP_PRIMARY_BTN}
                                                    >
                                                        <Plus size={18} strokeWidth={2} />
                                                        Create {activeUtility.type}
                                                    </button>
                                                </div>
                                            </div>

                                            {statusFilteredEntries.length === 0 ? (
                                                <div className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                                                    {listStatusTab === 'deactivated'
                                                        ? `No deactivated ${activeUtility.type} records.`
                                                        : `No active records yet. Create a ${activeUtility.type} to get started.`}
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                    <table className="w-full min-w-[640px] sm:min-w-[780px] lg:min-w-0 table-auto text-xs sm:text-sm">
                                                        <thead>
                                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                                {tableColumns.map((col) => (
                                                                    <th
                                                                        key={col.key}
                                                                        className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                                                                    >
                                                                        {col.label}
                                                                    </th>
                                                                ))}
                                                                <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                                                    Status
                                                                </th>
                                                                {showAssignColumn ? (
                                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                                                        Assignment
                                                                    </th>
                                                                ) : null}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {statusFilteredEntries.map((entry, idx) => (
                                                                <tr
                                                                    key={entry.id}
                                                                    className="cursor-pointer transition-colors bg-white hover:bg-blue-50/50"
                                                                    onClick={() =>
                                                                        router.push(
                                                                            `/HRM/Asset/UtilityBills/details/${encodeURIComponent(entry.id)}`,
                                                                        )
                                                                    }
                                                                >
                                                                    {tableColumns.map((col) => {
                                                                        const raw = formatCellValue(col.key, entry.values);
                                                                        const long = isLongCellValue(col.key, raw);
                                                                        const display = truncateCellText(raw);

                                                                        if (col.key === 'provider') {
                                                                            return (
                                                                                <td key={col.key} className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 align-middle whitespace-nowrap">
                                                                                    <span className="text-xs sm:text-sm font-medium text-gray-900">
                                                                                        {raw || '—'}
                                                                                    </span>
                                                                                </td>
                                                                            );
                                                                        }

                                                                        if (col.key === 'monthlyRental') {
                                                                            return (
                                                                                <td key={col.key} className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-700 tabular-nums">
                                                                                    {raw}
                                                                                </td>
                                                                            );
                                                                        }

                                                                        if (col.key === 'contractPeriod') {
                                                                            return (
                                                                                <td key={col.key} className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 tabular-nums">
                                                                                    {raw}
                                                                                </td>
                                                                            );
                                                                        }

                                                                        if (col.key === 'paymentDate') {
                                                                            return (
                                                                                <td key={col.key} className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 tabular-nums">
                                                                                    {raw}
                                                                                </td>
                                                                            );
                                                                        }

                                                                        if (col.key === 'attachment') {
                                                                            const file = entry.values?.attachment;
                                                                            const hasFile =
                                                                                file &&
                                                                                typeof file === 'object' &&
                                                                                file.name;
                                                                            return (
                                                                                <td
                                                                                    key={col.key}
                                                                                    className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 align-middle whitespace-nowrap"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    {hasFile ? (
                                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                                            <span
                                                                                                className="text-xs sm:text-sm text-gray-700 truncate max-w-[120px]"
                                                                                                title={file.name}
                                                                                            >
                                                                                                {file.name}
                                                                                            </span>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    openUtilityAttachment(
                                                                                                        file,
                                                                                                        {
                                                                                                            onError: (
                                                                                                                message,
                                                                                                            ) =>
                                                                                                                toast({
                                                                                                                    variant:
                                                                                                                        'destructive',
                                                                                                                    title: 'Attachment',
                                                                                                                    description:
                                                                                                                        message,
                                                                                                                }),
                                                                                                        },
                                                                                                    )
                                                                                                }
                                                                                                className="shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700"
                                                                                            >
                                                                                                View
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="text-xs sm:text-sm text-gray-400">
                                                                                            —
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                            );
                                                                        }

                                                                        return (
                                                                            <td
                                                                                key={col.key}
                                                                                className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 align-middle max-w-[180px]"
                                                                            >
                                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                                    <span className="text-xs sm:text-sm text-gray-700 truncate">
                                                                                        {display}
                                                                                    </span>
                                                                                    {long ? (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setViewFieldModal({
                                                                                                    title: col.label,
                                                                                                    fields: [
                                                                                                        {
                                                                                                            key: col.key,
                                                                                                            label: col.label,
                                                                                                            value: raw,
                                                                                                        },
                                                                                                    ],
                                                                                                });
                                                                                            }}
                                                                                            className="shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700"
                                                                                        >
                                                                                            View
                                                                                        </button>
                                                                                    ) : null}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 align-middle whitespace-nowrap">
                                                                        <span
                                                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${entryStatusBadgeClass(entry.status)}`}
                                                                        >
                                                                            {entryLifecycleStatus(entry)}
                                                                        </span>
                                                                    </td>
                                                                    {showAssignColumn ? (
                                                                        <td
                                                                            className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 align-middle whitespace-nowrap"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                {entry.assignedTo ? (
                                                                                    <span
                                                                                        className="max-w-[140px] truncate text-xs sm:text-sm text-gray-700"
                                                                                        title={entry.assignedTo}
                                                                                    >
                                                                                        {entry.assignedTo}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-xs sm:text-sm text-gray-400">—</span>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setAssignEntry(entry)}
                                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-teal-200 bg-white hover:bg-teal-50 text-teal-700 text-xs font-medium"
                                                                                >
                                                                                    <UserPlus size={12} />
                                                                                    {entry.assignedTo ? 'Reassign' : 'Assign'}
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    ) : null}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center py-6">
                                            Select a utility tab above.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AddUtilityModal
                isOpen={addModalOpen}
                onClose={() => {
                    setAddModalOpen(false);
                    setEditingUtility(null);
                }}
                onSave={handleSaveUtility}
                utilityType={editingUtility?.type || ''}
                initialFields={editingUtility?.fields || null}
                usedTypes={usedTypeNames}
            />

            <CreateUtilityEntryModal
                isOpen={createEntryOpen}
                onClose={() => setCreateEntryOpen(false)}
                utilityType={activeUtility?.type || ''}
                enabledFields={activeUtility?.fields || {}}
                onSave={handleSaveEntry}
            />

            <AssignUtilityEntryModal
                isOpen={Boolean(assignEntry)}
                onClose={() => setAssignEntry(null)}
                entry={assignEntry}
                onSave={handleAssignSave}
            />

            <AddBillModal
                isOpen={addBillsOpen}
                onClose={() => setAddBillsOpen(false)}
                entries={billableEntries}
                existingBills={typeBills}
                utilityType={activeUtility?.type || ''}
                utilityAttachment={activeUtility?.attachment || null}
                onSubmit={handleAddBills}
                saving={savingBill}
            />

            <UtilityBillReviewModal
                isOpen={Boolean(reviewBatchId)}
                batchId={reviewBatchId}
                entries={billableEntries}
                utilityAttachment={activeUtility?.attachment || null}
                onClose={closeReviewModal}
                onChanged={() => {
                    // Clear Accounts/HR utility notification + pending inbox after they act
                    invalidateAssetPendingInbox('all');
                    clearModuleNotificationFeedsCache();
                    fetchPendingInboxCount({ force: true });
                    loadTypeBills(activeTypeTab);
                }}
            />

            <FieldViewModal
                isOpen={Boolean(viewFieldModal)}
                onClose={() => setViewFieldModal(null)}
                title={viewFieldModal?.title || 'Details'}
                fields={viewFieldModal?.fields || []}
            />

            <PendingAssetRequestsModal
                isOpen={pendingInboxModalOpen}
                onClose={() => setPendingInboxModalOpen(false)}
                inboxScope="utility"
                onRefreshParent={() => fetchPendingInboxCount({ force: true })}
                onPendingInboxCount={() => fetchPendingInboxCount({ force: true })}
            />
        </div>
    );
}

export default function UtilityBillsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen w-full bg-[#F2F6F9] items-center justify-center">
                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <UtilityBillsPageContent />
        </Suspense>
    );
}
