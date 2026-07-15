'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { Bell, Pencil, Plus, Receipt, Trash2, UserPlus } from 'lucide-react';
import { HEADER_PAIR_CARD_FIXED, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import { AnimatedCounter } from '@/app/HRM/Asset/components/ListPageSummaryCards';
import AddUtilityModal, { UTILITY_TOGGLE_FIELDS } from './components/AddUtilityModal';
import CreateUtilityEntryModal from './components/CreateUtilityEntryModal';
import AssignUtilityEntryModal from './components/AssignUtilityEntryModal';
import FieldViewModal from './components/FieldViewModal';
import PendingAssetRequestsModal from '../components/PendingAssetRequestsModal';
import axiosInstance from '@/utils/axios';
import { fetchAssetPendingInbox } from '@/utils/pendingInboxFetch';
import { ASSET_PENDING_INBOX_CHANGED } from '../utils/assetPendingInboxCount';

const CELL_MAX_LEN = 42;
const LONG_TEXT_KEYS = new Set(['planDetails', 'location', 'paymentDetails']);

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
        fields: normalizeUtilityFields(u.fields || {}),
    }));
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
    if (key === 'paymentDate') {
        const typeLabel = v.billingType === 'usage' ? 'Usage' : v.billingType === 'fixed' ? 'Fixed (Package)' : '';
        if (v.billingType === 'usage') return typeLabel || 'Usage';
        if (v.paymentDate) return typeLabel ? `${typeLabel}: ${v.paymentDate}` : v.paymentDate;
        return typeLabel || '—';
    }
    if (key === 'assignment') return null;
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
        (row) => String(row?.requestType || '').trim() === 'Utility Bill Payment',
    ).length;
}

export default function UtilityBillsPage() {
    const router = useRouter();
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editingUtility, setEditingUtility] = useState(null);
    const [createEntryOpen, setCreateEntryOpen] = useState(false);
    const [assignEntry, setAssignEntry] = useState(null);
    const [viewFieldModal, setViewFieldModal] = useState(null);
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const [utilities, setUtilities] = useState([]);
    const [entries, setEntries] = useState([]);
    const [activeTypeTab, setActiveTypeTab] = useState('');

    useEffect(() => {
        const loaded = normalizeUtilities(loadJsonArray(UTILITIES_STORAGE_KEY));
        const loadedEntries = loadJsonArray(UTILITY_ENTRIES_STORAGE_KEY);
        setUtilities(loaded);
        setEntries(loadedEntries);
        saveJsonArray(UTILITIES_STORAGE_KEY, loaded);
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

    const tableColumns = useMemo(() => {
        if (!activeUtility?.fields) return [];
        return UTILITY_TOGGLE_FIELDS.filter(
            (f) => activeUtility.fields[f.key] === 'yes' && f.key !== 'assignment',
        );
    }, [activeUtility]);

    const showAssignColumn = activeUtility?.fields?.assignment === 'yes';

    /** One box per created utility type (not dropdown catalog) + row count. */
    const typeOverviewCards = useMemo(() => {
        return typeTabs.map((tab) => {
            const typeName = String(tab.type || '');
            const count = entries.filter(
                (e) => String(e.type || '').toLowerCase() === typeName.toLowerCase(),
            ).length;
            return {
                label: typeName,
                value: count,
                type: typeName,
            };
        });
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
                    ...payload,
                    fields: normalizeUtilityFields(payload.fields || {}),
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

    const handleSaveEntry = (payload) => {
        setEntries((prev) => {
            const next = [
                {
                    id: `${Date.now()}`,
                    type: payload.type,
                    values: payload.values || {},
                    assignedTo: '',
                    createdAt: new Date().toISOString(),
                },
                ...prev,
            ];
            saveJsonArray(UTILITY_ENTRIES_STORAGE_KEY, next);
            return next;
        });
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-1.5 sm:mb-2 break-words text-center leading-tight line-clamp-2 px-0.5">
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
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                                <Receipt className="shrink-0 text-slate-500" size={28} strokeWidth={1.75} />
                                Utility Bills
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600">
                                Manage utility bills and payment status
                            </p>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setPendingInboxModalOpen(true)}
                                className="relative p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800"
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
                                className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Plus size={18} strokeWidth={2} />
                                Add Utility
                            </button>
                        </div>
                    </div>

                    <div className={HEADER_PAIR_GRID}>
                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_FIXED}`}
                        >
                            <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 shrink-0">
                                Utility Overview
                            </h3>
                            {typeOverviewCards.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-3 py-6 min-h-[120px]">
                                    <p className="text-sm text-gray-400 text-center">
                                        Add a utility type to see counts here.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 flex-1 content-start overflow-y-auto min-h-[120px] pr-0.5">
                                    {typeOverviewCards.map((item) => renderTypeStatCard(item))}
                                </div>
                            )}
                        </div>

                        <div
                            className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_FIXED}`}
                        >
                            <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest shrink-0">
                                Amount Summary
                            </h3>
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
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="flex flex-wrap gap-2 p-2 sm:p-3 border-b border-gray-100 bg-gray-50/80">
                                    {typeTabs.map((tab) => {
                                        const active = tab.type === activeTypeTab;
                                        const tabUsed = isUtilityTabUsed(tab.type);
                                        return (
                                            <div
                                                key={tab.id || tab.type}
                                                className="relative group"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTypeTab(tab.type)}
                                                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                                                        active
                                                            ? 'bg-teal-500 text-white shadow-sm'
                                                            : 'bg-white text-gray-700 border border-gray-200 group-hover:border-teal-300 group-hover:text-teal-700'
                                                    }`}
                                                >
                                                    {tab.type}
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
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-teal-700 hover:bg-teal-50"
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
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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

                                <div className="p-3 sm:p-4">
                                    {activeUtility ? (
                                        <>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                                <p className="text-xs text-gray-500">
                                                    <span className="font-semibold text-gray-700">{activeEntries.length}</span>
                                                    {' '}
                                                    {activeEntries.length === 1 ? 'record' : 'records'}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setCreateEntryOpen(true)}
                                                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-4 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap self-start sm:self-auto"
                                                >
                                                    <Plus size={15} strokeWidth={2} />
                                                    Create {activeUtility.type}
                                                </button>
                                            </div>

                                            {activeEntries.length === 0 ? (
                                                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4 py-10 text-center">
                                                    <p className="text-sm text-gray-500">
                                                        No records yet. Create a {activeUtility.type} to get started.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto rounded-xl border border-gray-200/80">
                                                    <table className="min-w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-50/90 border-b border-gray-200">
                                                                {tableColumns.map((col) => (
                                                                    <th
                                                                        key={col.key}
                                                                        className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                                                                    >
                                                                        {col.label}
                                                                    </th>
                                                                ))}
                                                                {showAssignColumn ? (
                                                                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                                                                        Assignment
                                                                    </th>
                                                                ) : null}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {activeEntries.map((entry, idx) => (
                                                                <tr
                                                                    key={entry.id}
                                                                    className={`cursor-pointer transition-colors ${
                                                                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                                                                    } hover:bg-teal-50/60`}
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
                                                                                <td key={col.key} className="px-3 py-2.5 align-middle whitespace-nowrap">
                                                                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                                                                        {raw || '—'}
                                                                                    </span>
                                                                                </td>
                                                                            );
                                                                        }

                                                                        if (col.key === 'monthlyRental') {
                                                                            return (
                                                                                <td key={col.key} className="px-3 py-2.5 align-middle whitespace-nowrap text-xs font-semibold tabular-nums text-gray-800">
                                                                                    {raw}
                                                                                </td>
                                                                            );
                                                                        }

                                                                        if (col.key === 'contractPeriod') {
                                                                            return (
                                                                                <td key={col.key} className="px-3 py-2.5 align-middle whitespace-nowrap text-xs text-gray-600 tabular-nums">
                                                                                    {raw}
                                                                                </td>
                                                                            );
                                                                        }

                                                                        if (col.key === 'paymentDate') {
                                                                            const usage = entry.values?.billingType === 'usage';
                                                                            return (
                                                                                <td key={col.key} className="px-3 py-2.5 align-middle whitespace-nowrap">
                                                                                    <span
                                                                                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                                                                            usage
                                                                                                ? 'bg-violet-50 text-violet-700'
                                                                                                : 'bg-sky-50 text-sky-700'
                                                                                        }`}
                                                                                    >
                                                                                        {raw}
                                                                                    </span>
                                                                                </td>
                                                                            );
                                                                        }

                                                                        return (
                                                                            <td
                                                                                key={col.key}
                                                                                className="px-3 py-2.5 align-middle max-w-[180px]"
                                                                            >
                                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                                    <span className="text-xs text-gray-700 truncate">
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
                                                                                            className="shrink-0 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                                                                                        >
                                                                                            View
                                                                                        </button>
                                                                                    ) : null}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    {showAssignColumn ? (
                                                                        <td
                                                                            className="px-3 py-2.5 align-middle whitespace-nowrap"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                {entry.assignedTo ? (
                                                                                    <span
                                                                                        className="max-w-[140px] truncate text-xs text-gray-600"
                                                                                        title={entry.assignedTo}
                                                                                    >
                                                                                        {entry.assignedTo}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-xs text-gray-400">—</span>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setAssignEntry(entry)}
                                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-semibold"
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
