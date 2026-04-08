'use client';



import { useState, useEffect, useLayoutEffect, useCallback, Suspense, useMemo, useDeferredValue, useRef, Fragment } from 'react';

import Sidebar from '@/components/Sidebar';

import Navbar from '@/components/Navbar';

import PermissionGuard from '@/components/PermissionGuard';

import { isAdmin } from '@/utils/permissions';

import { Package, Search, Plus, Filter, MoreVertical, LayoutGrid, List as ListIcon, Shield, Laptop, Truck, Armchair, Briefcase, Download, Trash2, X, FileText, Eye, History, Undo2, ArrowRightLeft, Pencil, Bell, ExternalLink, AlertCircle } from 'lucide-react';

import AddAssetTypeModal from './components/AddAssetTypeModal';

import AddAccessoryCatalogModal from './components/AddAccessoryCatalogModal';
import AttachCatalogAccessoryModal from './components/AttachCatalogAccessoryModal';

import AccessoriesModal from './components/AccessoriesModal';

import axiosInstance from '@/utils/axios';

import { useToast } from '@/hooks/use-toast';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { UserPlus, Square, CheckSquare, User, Users } from 'lucide-react';

import { sanitizeUrl } from '@/utils/security';

import AssignAssetModal from './components/AssignAssetModal';

import BulkAssignAssetModal from './components/BulkAssignAssetModal';
import BulkHolderActionModal from './components/BulkHolderActionModal';
import PendingAssetRequestsModal from './components/PendingAssetRequestsModal';
import BulkAssignmentAcknowledgeModal from './components/BulkAssignmentAcknowledgeModal';

import {

    AlertDialog,

    AlertDialogAction,

    AlertDialogCancel,

    AlertDialogContent,

    AlertDialogDescription,

    AlertDialogFooter,

    AlertDialogHeader,

    AlertDialogTitle,

} from "@/components/ui/alert-dialog";



// Helper to get icon based on name (just for visual flair)

const getIconForType = (name) => {

    const lower = name.toLowerCase();

    if (lower.includes('laptop') || lower.includes('computer') || lower.includes('it')) return Laptop;

    if (lower.includes('vehicle') || lower.includes('car')) return Truck;

    if (lower.includes('furniture') || lower.includes('chair') || lower.includes('desk')) return Armchair;

    return Package; // Default

};

const ASSET_LIST_STATUS_FILTERS = ['All', 'Assigned', 'Unassigned', 'OnService', 'Draft'];

const LEGACY_ASSET_LIST_STATUS = {
    Pending: 'Draft',
    PendingUnassigned: 'Unassigned',
    'On Leave': 'All',
    Maintenance: 'All',
    Returned: 'All',
    Service: 'OnService',
};

function normalizeAssetListStatusFilter(raw) {
    if (!raw || raw === 'null' || raw === 'undefined') return 'Unassigned';
    const mapped = LEGACY_ASSET_LIST_STATUS[raw] ?? raw;
    return ASSET_LIST_STATUS_FILTERS.includes(mapped) ? mapped : 'Unassigned';
}

/** Mirrors asset detail API: assignment-acceptance pending vs creation approval (see assetItemController getAssetItemDetail). */
function isAssignmentAcknowledgmentOnly(t) {
    if ((t.acceptanceStatus || '') !== 'Pending') return false;
    if (t.pendingAction) return false;
    const s = t.status || '';
    if (s !== 'Pending' && s !== 'Assigned') return false;
    return !!(t.assignedTo || t.assignedCompany);
}

function isAwaitingCreationApproval(t) {
    if (t.status === 'Submitted for Approval') return true;
    if (t.status === 'Draft') return true;
    return (
        t.actionRequiredBy != null &&
        t.status === 'Pending' &&
        !isAssignmentAcknowledgmentOnly(t)
    );
}

/** Catalog row status helpers (AssetAccessoryCatalog list). */
function catalogRowStatus(row) {
    if (row?.status != null && String(row.status).trim() !== '') {
        return String(row.status).trim();
    }
    if (row?.recordType === 'instance' && row?.assetItemId) {
        return 'Attached';
    }
    return 'Unattached';
}
function isCatalogTerminalStatus(row) {
    const s = catalogRowStatus(row);
    return s === 'Lost' || s === 'EndOfLife' || s === 'End of Life';
}
function canAttachCatalogRow(row) {
    if (isCatalogTerminalStatus(row)) return false;
    const s = catalogRowStatus(row);
    if (s === 'Attached' || s === 'Pending') return false;
    return true;
}

const ACCESSORY_CATALOG_STATUS_FILTER_OPTIONS = [
    { value: 'pool', label: 'Unattached & pending' },
    { value: 'all', label: 'All statuses' },
    { value: 'Unattached', label: 'Unattached' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Attached', label: 'Attached' },
];

function matchesAccessoryCatalogStatusFilter(row, filter) {
    const s = catalogRowStatus(row);
    const normalized = s === 'End of Life' ? 'EndOfLife' : s;
    if (filter === 'pool') return normalized === 'Unattached' || normalized === 'Pending';
    if (filter === 'all') return true;
    if (filter === 'EndOfLife') return normalized === 'EndOfLife' || s === 'End of Life';
    return normalized === filter;
}

function matchesAssetListStatusFilter(t, statusFilter) {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Assigned') return t.status === 'Assigned';
    if (statusFilter === 'Unassigned') {
        const low = (t.status || '').toLowerCase();
        if (['unassigned', 'returned', 'available'].includes(low)) return true;
        return isAssignmentAcknowledgmentOnly(t);
    }
    if (statusFilter === 'OnService') {
        const low = (t.status || '').toLowerCase();
        return low === 'service' || low === 'on service';
    }
    if (statusFilter === 'Draft') return isAwaitingCreationApproval(t);
    return false;
}

function isIndividualAssetRow(item) {
    const id = item?.assetId;
    return typeof id === 'string' && (id.startsWith('VEGA-ASSET-') || id.startsWith('A-ASSET-'));
}

function itemHasPendingLossDamage(item) {
    if (item?.pendingAction === 'Loss and Damage') return true;
    return Array.isArray(item?.accessories) && item.accessories.some((a) => a?.pendingAction === 'Loss and Damage');
}

function itemHasAnyLossDamage(item) {
    if (!item) return false;
    if (itemHasPendingLossDamage(item)) return true;
    const mainStatus = String(item.status || '').trim().toLowerCase();
    if (['lost', 'rejected', 'end of life', 'endoflife'].includes(mainStatus)) return true;
    if (Array.isArray(item?.lostDetachedAccessories) && item.lostDetachedAccessories.length > 0) return true;
    return Array.isArray(item?.accessories) && item.accessories.some((a) => {
        const s = String(a?.status || '').trim().toLowerCase();
        return ['lost', 'rejected', 'end of life', 'endoflife'].includes(s);
    });
}

function buildLossDamagePendingSummary(item) {
    const parts = [];
    const mainLost = String(item?.status || '').trim() === 'Lost';
    if (item?.pendingAction === 'Loss and Damage') parts.push('Main asset — pending');
    else if (mainLost) parts.push('Main asset — lost');
    (item?.accessories || []).forEach((a) => {
        const accLost = String(a?.status || '').trim() === 'Lost';
        if (a?.pendingAction === 'Loss and Damage') {
            parts.push(a.name ? `Accessory: ${a.name} — pending` : `Accessory (${a.accessoryId || '—'}) — pending`);
        } else if (accLost) {
            parts.push(a.name ? `Accessory: ${a.name} — lost` : `Accessory (${a.accessoryId || '—'}) — lost`);
        }
    });
    (item?.lostDetachedAccessories || []).forEach((d) => {
        parts.push(
            d?.name
                ? `Accessory: ${d.name} — lost (detached)`
                : `Accessory (${d?.accessoryId || '—'}) — lost (detached)`
        );
    });
    return parts.length ? parts.join(' · ') : '';
}

/** Shown in Loss & Damage tab: main asset id, or accessory id when only accessory rows are pending. */
function getLossDamageTableDisplayId(item) {
    const mainLost = String(item?.status || '').trim() === 'Lost';
    if (item?.pendingAction === 'Loss and Damage' || mainLost) {
        return item.assetId || '—';
    }
    const acc = (item?.accessories || []).find((a) => a?.pendingAction === 'Loss and Damage' || String(a?.status || '').trim() === 'Lost');
    if (acc) return acc.accessoryId || '—';
    const detached = (item?.lostDetachedAccessories || [])[0];
    if (detached?.accessoryId) return detached.accessoryId;
    return item?.assetId || '—';
}

/** Draft / pending-approval rows should show Waiting, not only when actionRequiredBy is populated in the list payload */
function assetListShouldShowWaitingBadge(item) {
    if (!isIndividualAssetRow(item)) return false;
    const st = String(item.status || '').toLowerCase();
    if (st === 'submitted for approval') return true;
    if (item.actionRequiredBy != null && item.actionRequiredBy !== '') return true;
    if (st === 'draft' && item.actionRequiredBy) return true;
    return false;
}

function getAssetListWaitingLabel(item) {
    const ar = item.actionRequiredBy;
    const fromAr =
        ar && typeof ar === 'object'
            ? `${ar.firstName || ''} ${ar.lastName || ''}`.trim() || (ar.employeeId ? String(ar.employeeId) : '')
            : '';
    const flow = item.designatedAssetController;
    const fromFlow = flow
        ? `${flow.firstName || ''} ${flow.lastName || ''}`.trim() || (flow.employeeId ? String(flow.employeeId) : '')
        : '';
    if (fromAr) return fromAr;
    if (fromFlow) return fromFlow;
    const st = String(item.status || '').toLowerCase();
    if (st === 'submitted for approval') return 'Asset controller approval';
    if (st === 'draft') return 'Asset controller approval';
    if (st === 'pending') return 'Acknowledgment';
    return 'Action required';
}

function AssetPageContent() {

    const router = useRouter();

    const searchParams = useSearchParams();

    const [mounted, setMounted] = useState(false);

    const [viewMode, setViewMode] = useState('grid');

    const [activeTab, setActiveTab] = useState('asset');

    const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);

    const [assetTypes, setAssetTypes] = useState([]);

    const [loading, setLoading] = useState(true);

    const [accessoryCatalog, setAccessoryCatalog] = useState([]);

    const [loadingAccessoryCatalog, setLoadingAccessoryCatalog] = useState(false);
    /** Default: pool (Unattached + Pending). Use filter for Attached, Lost, End of life, etc. */
    const [accessoryCatalogStatusFilter, setAccessoryCatalogStatusFilter] = useState('pool');
    const [lossDamageStatusFilter, setLossDamageStatusFilter] = useState('All');
    const [expandedAccessoryCatalogId, setExpandedAccessoryCatalogId] = useState(null);

    const [isAddAccessoryModalOpen, setIsAddAccessoryModalOpen] = useState(false);
    const [attachCatalogModal, setAttachCatalogModal] = useState({ isOpen: false, item: null });
    const [catalogHistoryModal, setCatalogHistoryModal] = useState({
        isOpen: false,
        catalogId: null,
        title: '',
        accessoryCatalogId: '',
        events: [],
        loading: false
    });

    const { toast } = useToast();



    // Initialize from URL params (persists filters through back-navigation)

    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

    // Default: Unassigned pool + assignment pending (awaiting employee acceptance); creation approval appears under Draft
    const [statusFilter, setStatusFilter] = useState(() => normalizeAssetListStatusFilter(searchParams.get('status')));

    const [showFilters, setShowFilters] = useState(false);

    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

    const [currentInvoiceUrl, setCurrentInvoiceUrl] = useState('');



    // Accessories Modal State

    const [accessoriesModalOpen, setAccessoriesModalOpen] = useState(false);

    const [selectedAssetForAccessories, setSelectedAssetForAccessories] = useState(null);



    // Bulk Assignment State

    const [selectionMode, setSelectionMode] = useState(false);

    const [selectedAssetIds, setSelectedAssetIds] = useState([]);

    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);

    const [bulkHolderModal, setBulkHolderModal] = useState({ open: false, mode: null }); // mode: 'return' | 'transfer'

    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);

    const [pendingInboxCount, setPendingInboxCount] = useState(0);

    const [bulkInitialAssetIds, setBulkInitialAssetIds] = useState(null);

    const bulkAssignmentGroupParam = searchParams.get('bulkAssignmentGroup');

    const clearBulkAssignmentQuery = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('bulkAssignmentGroup');
        const qs = params.toString();
        router.replace(qs ? `/HRM/Asset?${qs}` : '/HRM/Asset');
    }, [router, searchParams]);



    // New Choice Modal States

    const [showAssignChoiceModal, setShowAssignChoiceModal] = useState(false);

    const [assignmentMode, setAssignmentMode] = useState(null); // 'individual' or 'bulk'

    const [isIndividualAssignModalOpen, setIsIndividualAssignModalOpen] = useState(false);

    const [selectedAssetForAssign, setSelectedAssetForAssign] = useState(null);

    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, assetId: null, assetName: '' });

    const [assetRoleMeta, setAssetRoleMeta] = useState({ isAdmin: false, isAssetController: false });

    /** When set, AddAssetTypeModal opens in edit mode for a type or category row */
    const [typeCategoryEditInitial, setTypeCategoryEditInitial] = useState(null);

    const canAddTypeCategory = assetRoleMeta.isAdmin === true;
    const canEditTypeCategory = assetRoleMeta.isAdmin === true || assetRoleMeta.isAssetController === true;
    const canDeleteTypeCategory = assetRoleMeta.isAdmin === true;
    const canAssignUnassignedAssets = assetRoleMeta.isAdmin === true || assetRoleMeta.isAssetController === true;

    // Keep latest query string without listing `searchParams` as an effect dep — including it caused
    // replaceState → Next invalidates searchParams → effect again → main-thread flood + Chrome violations.

    const searchParamsRef = useRef(searchParams);

    searchParamsRef.current = searchParams;



    // Sync state from URL when navigating back/forward (layout phase so stale state cannot clobber URL in the follow-up effect)

    useLayoutEffect(() => {

        const getParam = (key, fallback = '') => {

            const val = searchParams.get(key);

            if (!val || val === 'null' || val === 'undefined') return fallback;

            return val;

        };

        const nextSearch = getParam('search');

        const urlStatus = normalizeAssetListStatusFilter(getParam('status', ''));

        setSearchQuery((prev) => (prev === nextSearch ? prev : nextSearch));

        setStatusFilter((prev) => (prev === urlStatus ? prev : urlStatus));

        if (urlStatus && urlStatus !== 'All') {

            setShowFilters(true);

        }

    }, [searchParams]);



    // Write filters to URL so back-button preserves them (other params e.g. bulkAssignmentGroup preserved)

    useEffect(() => {

        const params = new URLSearchParams(searchParamsRef.current.toString());

        if (searchQuery) params.set('search', searchQuery);
        else params.delete('search');

        if (statusFilter) params.set('status', statusFilter);
        else params.delete('status');

        const queryString = params.toString();

        const newUrl = queryString ? `/HRM/Asset?${queryString}` : '/HRM/Asset';

        const currentFull = `${window.location.pathname}${window.location.search}`;

        if (newUrl === currentFull) return;

        window.history.replaceState(null, '', newUrl);

    }, [searchQuery, statusFilter]);



    useEffect(() => {

        setMounted(true);

        fetchAssetTypes();

    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await axiosInstance.get('/AssetType/meta/role');
                if (!cancelled && r?.data) setAssetRoleMeta(r.data);
            } catch {
                /* non-fatal */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchPendingInboxCount = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/AssetItem/dashboard/pending-inbox');
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const n = items.filter((row) => row.asset || (row.isBulk && row.bulkAssetIds?.length)).length;
            setPendingInboxCount(n);
        } catch {
            setPendingInboxCount(0);
        }
    }, []);

    useEffect(() => {
        if (!mounted || activeTab !== 'asset') return;
        fetchPendingInboxCount();
    }, [mounted, activeTab, fetchPendingInboxCount]);



    const fetchAssetTypes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/AssetType');
            setAssetTypes(response.data);
        } catch (error) {
            console.error("Error fetching asset types", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const deferredSearchQuery = useDeferredValue(searchQuery);

    const nonVehicleAssetRows = useMemo(
        () =>
            assetTypes.filter(
                (t) =>
                    t.assetId?.startsWith('VEGA-ASSET-') &&
                    !['lost', 'rejected', 'end of life', 'endoflife'].includes(String(t?.status || '').trim().toLowerCase()) &&
                    !(
                        t.type?.toLowerCase().includes('vehicle') ||
                        t.type?.toLowerCase().includes('car') ||
                        t.type?.toLowerCase().includes('van') ||
                        t.type?.toLowerCase().includes('pickup') ||
                        t.category?.toLowerCase().includes('vehicle')
                    )
            ),
        [assetTypes]
    );

    const filteredAssetTableRows = useMemo(() => {
        const q = (deferredSearchQuery || '').toLowerCase().trim();
        return nonVehicleAssetRows.filter((t) => {
            const matchesSearch =
                !q ||
                t.name?.toLowerCase().includes(q) ||
                t.assetId?.toLowerCase().includes(q) ||
                t.category?.toLowerCase().includes(q) ||
                t.type?.toLowerCase().includes(q);
            return matchesSearch && matchesAssetListStatusFilter(t, statusFilter);
        });
    }, [nonVehicleAssetRows, deferredSearchQuery, statusFilter]);

    const bulkSelectableAssetRows = useMemo(
        () => nonVehicleAssetRows.filter((t) => ['Unassigned', 'Returned'].includes(t.status)),
        [nonVehicleAssetRows]
    );

    const lossDamageListRows = useMemo(() => {
        const q = (searchQuery || '').toLowerCase().trim();

        /** Build rows so Lost accessories show as their own lines. */
        const rows = [];

        assetTypes.forEach((t) => {
            if (!t?.assetId?.startsWith('VEGA-ASSET-')) return;
            if (!itemHasAnyLossDamage(t)) return;

            const mainStatus = String(t?.status || '').trim();
            const mainStatusNorm = mainStatus.toLowerCase();
            const mainDamageStatus = ['lost', 'rejected', 'end of life', 'endoflife'].includes(mainStatusNorm);
            const mainPending = t?.pendingAction === 'Loss and Damage';

            // Row for main asset (pending or loss/damage statuses)
            if (mainPending || mainDamageStatus) {
                rows.push({ kind: 'asset', item: t });
            }

            // Rows for each accessory (pending or loss/damage statuses)
            (t.accessories || []).forEach((acc) => {
                const accStatus = String(acc?.status || '').trim();
                const accStatusNorm = accStatus.toLowerCase();
                const accDamageStatus = ['lost', 'rejected', 'end of life', 'endoflife'].includes(accStatusNorm);
                const accPending = acc?.pendingAction === 'Loss and Damage';
                if (accDamageStatus || accPending) {
                    rows.push({ kind: 'accessory', item: t, accessory: acc });
                }
            });

            // Rows for accessories already detached after L&D finalization (no longer in accessories[])
            (t.lostDetachedAccessories || []).forEach((log, li) => {
                rows.push({
                    kind: 'accessory',
                    item: t,
                    accessory: {
                        _id: `detached-${String(log?.accessoryId || li)}-${String(log?.detachedAt || li)}`,
                        accessoryId: log?.accessoryId,
                        name: log?.name,
                        status: log?.status || 'Lost',
                        pendingAction: null,
                        fineId: log?.fineId
                    }
                });
            });
        });

        return rows.filter((row) => {
            const t = row.item;
            const summary = buildLossDamagePendingSummary(t).toLowerCase();
            const statusRaw =
                row.kind === 'accessory'
                    ? (row.accessory?.pendingAction === 'Loss and Damage' ? 'Pending' : (row.accessory?.status || ''))
                    : (t?.pendingAction === 'Loss and Damage' ? 'Pending' : (t?.status || ''));
            const statusNorm = String(statusRaw).trim().toLowerCase();

            const matchesStatus =
                lossDamageStatusFilter === 'All' ||
                (lossDamageStatusFilter === 'Lost' && statusNorm === 'lost') ||
                (lossDamageStatusFilter === 'Rejected' && statusNorm === 'rejected') ||
                (lossDamageStatusFilter === 'EndOfLife' && (statusNorm === 'end of life' || statusNorm === 'endoflife'));

            if (!matchesStatus) return false;

            if (!q) return true;

            const baseHit =
                t?.name?.toLowerCase().includes(q) ||
                t?.assetId?.toLowerCase().includes(q) ||
                t?.type?.toLowerCase().includes(q) ||
                t?.category?.toLowerCase().includes(q) ||
                summary.includes(q);
            if (baseHit) return true;

            if (row.kind === 'accessory') {
                const acc = row.accessory;
                return (
                    String(acc?.name || '').toLowerCase().includes(q) ||
                    String(acc?.accessoryId || '').toLowerCase().includes(q) ||
                    String(acc?.fineId || '').toLowerCase().includes(q)
                );
            }
            return false;
        });
    }, [assetTypes, searchQuery, lossDamageStatusFilter]);

    const handleDeleteAsset = useCallback(async () => {
        if (!deleteConfirm.assetId) return;
        try {
            await axiosInstance.delete(`/AssetType/${deleteConfirm.assetId}`);
            toast({ title: 'Deleted', description: 'Item removed.' });
            setDeleteConfirm({ isOpen: false, assetId: null, assetName: '' });
            fetchAssetTypes();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: e?.response?.data?.message || e?.message || 'Could not delete.'
            });
        }
    }, [deleteConfirm.assetId, fetchAssetTypes, toast]);



    const fetchAccessoryCatalog = useCallback(async () => {

        try {

            setLoadingAccessoryCatalog(true);

            const response = await axiosInstance.get('/AssetAccessoryCatalog');

            setAccessoryCatalog(Array.isArray(response.data) ? response.data : []);

        } catch (error) {

            console.error('Error fetching accessory catalog', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load accessories catalog' });

        } finally {

            setLoadingAccessoryCatalog(false);

        }

    }, [toast]);

    useEffect(() => {

        if (activeTab === 'accessories') {

            fetchAccessoryCatalog();

        }

    }, [activeTab, fetchAccessoryCatalog]);

    const accessoryCatalogFiltered = useMemo(() => {
        const q = (searchQuery || '').toLowerCase().trim();
        return accessoryCatalog.filter((row) => {
            const s = String(catalogRowStatus(row) || '').trim().toLowerCase();
            if (activeTab === 'accessories' && ['lost', 'rejected', 'end of life', 'endoflife'].includes(s)) return false;
            if (!matchesAccessoryCatalogStatusFilter(row, accessoryCatalogStatusFilter)) return false;
            if (!q) return true;
            const name = (row.name || '').toLowerCase();
            const desc = (row.description || '').toLowerCase();
            const id = (row.accessoryCatalogId || '').toLowerCase();
            return name.includes(q) || desc.includes(q) || id.includes(q);
        });
    }, [accessoryCatalog, accessoryCatalogStatusFilter, searchQuery, activeTab]);






    const chartData = useMemo(() => {

        const catMap = {};

        assetTypes.filter(t => t.assetId?.startsWith('VEGA-ASSET-')).forEach(a => {

            const cat = a.category || 'Other';

            catMap[cat] = (catMap[cat] || 0) + 1;

        });

        return Object.entries(catMap)

            .map(([name, value]) => ({ name, value }))

            .sort((a, b) => b.value - a.value)

            .slice(0, 5);

    }, [assetTypes]);



    if (!mounted) return null;



    return (

        <PermissionGuard moduleId="hrm_asset" redirectTo="/dashboard">

            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                <Sidebar />

                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">

                    <Navbar />

                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>



                        {/* Header and Actions in Single Row Matching Employee Page */}

                        <div className="flex items-center justify-between mb-6">

                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-bold text-gray-800">Asset Management</h1>
                                <Link
                                    href="/HRM/Asset/Vehicle"
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-200 shadow-sm transition-colors"
                                >
                                    <Truck className="shrink-0" size={18} />
                                    Vehicle assets
                                </Link>
                            </div>



                            {/* Right Side - Actions Bar */}

                            <div className="flex items-center gap-4">

                                {/* Filter Toggle Icon */}

                                {activeTab === 'asset' && (

                                    <button

                                        onClick={() => setShowFilters(!showFilters)}

                                        className={`p-2 hover:bg-gray-100 rounded-lg transition-colors bg-white shadow-sm border border-gray-800/20 ${showFilters ? 'bg-gray-100' : ''}`}

                                        title="Toggle Filters"

                                    >

                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">

                                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>

                                        </svg>

                                    </button>

                                )}

                                {activeTab === 'asset' && (

                                    <button

                                        type="button"

                                        onClick={() => setPendingInboxModalOpen(true)}

                                        className="relative p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800"

                                        title="Pending requests (assets & accessories)"

                                    >

                                        <Bell size={20} />

                                        {pendingInboxCount > 0 ? (
                                            <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                                {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
                                            </span>
                                        ) : null}

                                    </button>

                                )}

                                {/* Search */}

                                <div className="relative flex-1 max-w-md w-64 group">

                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />

                                    <input

                                        type="text"

                                        placeholder="Search"

                                        value={searchQuery}

                                        onChange={(e) => setSearchQuery(e.target.value)}

                                        className="w-full pl-10 pr-10 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"

                                    />

                                    {searchQuery && (

                                        <button

                                            onClick={() => setSearchQuery('')}

                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-rose-500 transition-colors"

                                        >

                                            <X size={14} />

                                        </button>

                                    )}

                                </div>

                                {activeTab === 'asset' && (

                                    <div className="flex items-center gap-2">

                                        {!selectionMode ? (

                                            <>

                                                {canAssignUnassignedAssets && (

                                                    <button

                                                        onClick={() => setShowAssignChoiceModal(true)}

                                                        className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"

                                                    >

                                                        <UserPlus size={18} />

                                                        <span>Assign</span>

                                                    </button>

                                                )}

                                                <button

                                                    type="button"

                                                    onClick={() => setBulkHolderModal({ open: true, mode: 'return' })}

                                                    className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"

                                                    title="Bulk return by holder"

                                                >

                                                    <Undo2 size={18} />

                                                    <span className="hidden sm:inline">Bulk return</span>

                                                </button>

                                                <button

                                                    type="button"

                                                    onClick={() => setBulkHolderModal({ open: true, mode: 'transfer' })}

                                                    className="bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"

                                                    title="Bulk transfer (Leave / End of Services)"

                                                >

                                                    <ArrowRightLeft size={18} />

                                                    <span className="hidden sm:inline">Bulk transfer</span>

                                                </button>

                                            </>

                                        ) : (

                                            <>

                                                <button

                                                    onClick={() => {

                                                        setSelectionMode(false);

                                                        setAssignmentMode(null);

                                                        setSelectedAssetIds([]);

                                                    }}

                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all active:scale-95"

                                                >

                                                    <X size={16} />

                                                    <span>Cancel</span>

                                                </button>

                                                <button

                                                    onClick={() => {

                                                        if (selectedAssetIds.length === 0) {

                                                            toast({ variant: "destructive", title: "Wait!", description: "Please select at least one asset first." });

                                                            return;

                                                        }

                                                        setIsBulkAssignModalOpen(true);

                                                    }}

                                                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95 ${selectedAssetIds.length > 0

                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white animate-in zoom-in-95 duration-200'

                                                        : 'bg-blue-300 text-white cursor-not-allowed'}`}

                                                >

                                                    <UserPlus size={18} />

                                                    <span>Confirm Assign ({selectedAssetIds.length})</span>

                                                </button>

                                            </>

                                        )}

                                    </div>

                                )}



                                {((activeTab === 'asset') ||
                                    (activeTab === 'accessories') ||
                                    ((activeTab === 'type' || activeTab === 'category') && canAddTypeCategory)) &&
                                    !selectionMode && (

                                        <button

                                            onClick={() => {

                                                if (activeTab === 'accessories') {

                                                    setIsAddAccessoryModalOpen(true);

                                                } else {

                                                    setTypeCategoryEditInitial(null);
                                                    setIsAddTypeModalOpen(true);

                                                }

                                            }}

                                            className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"

                                        >

                                            <Plus size={18} />

                                            <span>

                                                {activeTab === 'asset'

                                                    ? 'Add Asset'

                                                    : activeTab === 'category'

                                                        ? 'Add Category'

                                                        : activeTab === 'accessories'

                                                            ? 'Add Accessory'

                                                            : 'Add Asset Type'}

                                            </span>

                                        </button>

                                    )}

                            </div>

                        </div>








                        {/* Tabs */}

                        <div className="flex border-b border-gray-200 mb-6">

                            <button

                                onClick={() => {

                                    setActiveTab('asset');

                                    setSearchQuery('');

                                }}

                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'asset'

                                    ? 'text-blue-600'

                                    : 'text-gray-500 hover:text-gray-700'

                                    }`}

                            >

                                Assets

                                {activeTab === 'asset' && (

                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />

                                )}

                            </button>

                            <button

                                onClick={() => {

                                    setActiveTab('type');

                                    setSearchQuery('');

                                }}

                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'type'

                                    ? 'text-blue-600'

                                    : 'text-gray-500 hover:text-gray-700'

                                    }`}

                            >

                                Asset Type

                                {activeTab === 'type' && (

                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />

                                )}

                            </button>

                            <button

                                onClick={() => {

                                    setActiveTab('category');

                                    setSearchQuery('');

                                }}

                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'category'

                                    ? 'text-blue-600'

                                    : 'text-gray-500 hover:text-gray-700'

                                    }`}

                            >

                                Category

                                {activeTab === 'category' && (

                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />

                                )}

                            </button>

                            <button

                                onClick={() => {

                                    setActiveTab('accessories');

                                    setSearchQuery('');

                                    setAccessoryCatalogStatusFilter('pool');

                                }}

                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'accessories'

                                    ? 'text-blue-600'

                                    : 'text-gray-500 hover:text-gray-700'

                                    }`}

                            >

                                Accessories

                                {activeTab === 'accessories' && (

                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />

                                )}

                            </button>

                            <button

                                onClick={() => {

                                    setActiveTab('lossDamage');

                                    setSearchQuery('');
                                    setLossDamageStatusFilter('All');

                                }}

                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'lossDamage'

                                    ? 'text-blue-600'

                                    : 'text-gray-500 hover:text-gray-700'

                                    }`}

                                type="button"

                            >

                                <span className="inline-flex items-center gap-1.5">

                                    <AlertCircle size={16} className={activeTab === 'lossDamage' ? 'text-rose-600' : 'text-gray-400'} />

                                    Loss &amp; Damage

                                </span>

                                {activeTab === 'lossDamage' && (

                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />

                                )}

                            </button>

                        </div>



                        {/* Filter Panel (Employee List Style) */}

                        {activeTab === 'asset' && showFilters && (

                            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">

                                <div className="flex items-center gap-4 flex-wrap">

                                    <span className="text-sm font-medium text-gray-700">Filter by</span>



                                    {/* Status Dropdown */}

                                    <div className="relative">

                                        <select

                                            value={statusFilter}

                                            onChange={(e) => setStatusFilter(e.target.value)}

                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"

                                        >

                                            <option value="All">All Status</option>
                                            <option value="Assigned">Assigned</option>
                                            <option value="Unassigned">Unassigned</option>
                                            <option value="OnService">On service</option>
                                            <option value="Draft">Draft</option>

                                        </select>

                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">

                                            <polyline points="6 9 12 15 18 9"></polyline>

                                        </svg>

                                    </div>



                                    {/* Clear Filters */}

                                    {statusFilter !== 'All' && (

                                        <button

                                            onClick={() => setStatusFilter('All')}

                                            className="text-sm text-gray-600 hover:text-gray-800 font-medium"

                                        >

                                            Clear Filters

                                        </button>

                                    )}

                                </div>

                            </div>

                        )}

                        {activeTab === 'accessories' && (

                            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">

                                <div className="flex items-center gap-4 flex-wrap">

                                    <span className="text-sm font-medium text-gray-700">Filter by</span>

                                    <div className="relative">

                                        <select

                                            value={accessoryCatalogStatusFilter}

                                            onChange={(e) => setAccessoryCatalogStatusFilter(e.target.value)}

                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer min-w-[13rem]"

                                            aria-label="Filter accessories by status"

                                        >

                                            {ACCESSORY_CATALOG_STATUS_FILTER_OPTIONS.map((opt) => (

                                                <option key={opt.value} value={opt.value}>

                                                    {opt.label}

                                                </option>

                                            ))}

                                        </select>

                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">

                                            <polyline points="6 9 12 15 18 9"></polyline>

                                        </svg>

                                    </div>

                                    {accessoryCatalogStatusFilter !== 'pool' && (

                                        <button

                                            type="button"

                                            onClick={() => setAccessoryCatalogStatusFilter('pool')}

                                            className="text-sm text-gray-600 hover:text-gray-800 font-medium"

                                        >

                                            Clear Filters

                                        </button>

                                    )}

                                </div>

                            </div>

                        )}

                        {activeTab === 'lossDamage' && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="text-sm font-medium text-gray-700">Filter by</span>
                                    <div className="relative">
                                        <select
                                            value={lossDamageStatusFilter}
                                            onChange={(e) => setLossDamageStatusFilter(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer min-w-[13rem]"
                                            aria-label="Filter loss and damage by status"
                                        >
                                            <option value="All">All</option>
                                            <option value="Lost">Lost</option>
                                            <option value="Rejected">Rejected</option>
                                            <option value="EndOfLife">End of life</option>
                                        </select>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>
                                    {lossDamageStatusFilter !== 'All' && (
                                        <button
                                            type="button"
                                            onClick={() => setLossDamageStatusFilter('All')}
                                            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}



                        {/* Asset Types Table */}

                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">

                            <div className="overflow-x-auto w-full max-w-full">

                                <table className="w-full min-w-0 table-auto">

                                    {activeTab === 'asset' ? (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    {selectionMode && (

                                                        <th className="px-6 py-4 text-left">

                                                            <button

                                                                onClick={() => {

                                                                    if (selectedAssetIds.length === bulkSelectableAssetRows.length && bulkSelectableAssetRows.length > 0) {

                                                                        setSelectedAssetIds([]);

                                                                    } else {

                                                                        setSelectedAssetIds(bulkSelectableAssetRows.map((a) => a._id));

                                                                    }

                                                                }}

                                                                className="text-gray-400 hover:text-blue-500 transition-colors"

                                                            >

                                                                {selectedAssetIds.length > 0 && bulkSelectableAssetRows.length > 0 && selectedAssetIds.length === bulkSelectableAssetRows.length ? (

                                                                    <CheckSquare size={18} className="text-blue-600" />

                                                                ) : (

                                                                    <Square size={18} className="text-gray-300" />

                                                                )}

                                                            </button>

                                                        </th>

                                                    )}

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">VALUE</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">PURCHASE DATE</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">WARRANTY</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ATTACHMENT</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">INVOICE NO</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">INVOICE</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ACCESSORIES</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"> </th>

                                                </tr>

                                            </thead>

                                            <tbody className="bg-white divide-y divide-gray-200">

                                                {loading ? (

                                                    <tr><td colSpan={selectionMode ? "15" : "14"} className="px-6 py-8 text-center text-gray-500">Loading assets...</td></tr>

                                                ) : filteredAssetTableRows.length === 0 ? (

                                                    <tr><td colSpan={selectionMode ? "15" : "14"} className="px-6 py-8 text-center text-gray-500">No Assets Found.</td></tr>

                                                ) : (

                                                    filteredAssetTableRows.map((item, index) => (

                                                        <tr

                                                            key={item._id}

                                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedAssetIds.includes(item._id) ? 'bg-blue-50/20' : ''}`}

                                                            onClick={() => {

                                                                if (selectionMode) {

                                                                    if (assignmentMode === 'individual') {

                                                                        if (item.status === 'Unassigned') {

                                                                            setSelectedAssetForAssign(item);

                                                                            setIsIndividualAssignModalOpen(true);

                                                                        }

                                                                    } else if (['Unassigned', 'Returned'].includes(item.status)) {

                                                                        if (selectedAssetIds.includes(item._id)) {

                                                                            setSelectedAssetIds(selectedAssetIds.filter((id) => id !== item._id));

                                                                        } else {

                                                                            setSelectedAssetIds([...selectedAssetIds, item._id]);

                                                                        }

                                                                    }

                                                                } else {

                                                                    const isVehicle = item.type?.toLowerCase().includes('vehicle') || item.type?.toLowerCase().includes('car') || item.type?.toLowerCase().includes('van') || item.type?.toLowerCase().includes('pickup') || item.category?.toLowerCase().includes('vehicle');

                                                                    router.push(isVehicle ? `/HRM/Asset/Vehicle/details/${item._id}` : `/HRM/Asset/details/${item._id}`);

                                                                }

                                                            }}

                                                        >

                                                            {selectionMode && (

                                                                <td className="px-6 py-4 whitespace-nowrap">

                                                                    {assignmentMode === 'bulk' && ['Unassigned', 'Returned'].includes(item.status) ? (

                                                                        <div className="text-gray-400">

                                                                            {selectedAssetIds.includes(item._id) ? (

                                                                                <CheckSquare size={18} className="text-blue-600" />

                                                                            ) : (

                                                                                <Square size={18} className="text-gray-300" />

                                                                            )}

                                                                        </div>

                                                                    ) : assignmentMode === 'individual' && item.status === 'Unassigned' ? (

                                                                        <div className="text-gray-400">

                                                                            <Square size={18} className="text-gray-300" />

                                                                        </div>

                                                                    ) : (

                                                                        <div className="text-gray-200 opacity-50 cursor-not-allowed">

                                                                            <Square size={18} />

                                                                        </div>

                                                                    )}

                                                                </td>

                                                            )}

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-blue-600 hover:underline">{item.assetId}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.type}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.category}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">{item.name || '-'}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">

                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(item.assetValue || 0)}

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">

                                                                {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-GB') : '-'}

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">

                                                                {item.warrantyYears ? `${item.warrantyYears} Years` : 'Nil'}

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap">

                                                                {item.warrantyAttachment ? (

                                                                    <button

                                                                        onClick={(e) => {

                                                                            e.stopPropagation();

                                                                            setCurrentInvoiceUrl(item.warrantyAttachment);

                                                                            setInvoiceModalOpen(true);

                                                                        }}

                                                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-xs font-semibold hover:bg-teal-100 transition-colors"

                                                                    >

                                                                        <Download size={12} />

                                                                        View

                                                                    </button>

                                                                ) : (

                                                                    <span className="text-xs text-gray-400 font-medium">Nil</span>

                                                                )}

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.invoiceNumber || '-'}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap">

                                                                {item.invoiceFile ? (

                                                                    <button

                                                                        onClick={(e) => {

                                                                            e.stopPropagation();

                                                                            setCurrentInvoiceUrl(item.invoiceFile);

                                                                            setInvoiceModalOpen(true);

                                                                        }}

                                                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors"

                                                                    >

                                                                        <Download size={12} />

                                                                        View

                                                                    </button>

                                                                ) : (

                                                                    <span className="text-xs text-gray-400">Not Uploaded</span>

                                                                )}

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">

                                                                <button

                                                                    onClick={(e) => {

                                                                        e.stopPropagation();

                                                                        setSelectedAssetForAccessories(item);

                                                                        setAccessoriesModalOpen(true);

                                                                    }}

                                                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors border border-blue-100"

                                                                    title="View Accessories"

                                                                >

                                                                    <Eye size={12} />

                                                                    View

                                                                </button>

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap">

                                                                <div className="flex flex-col items-start gap-1">

                                                                    {assetListShouldShowWaitingBadge(item) ? (

                                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 whitespace-nowrap" title={`Waiting for: ${getAssetListWaitingLabel(item)}`}>

                                                                            Waiting: {getAssetListWaitingLabel(item)}

                                                                        </span>

                                                                    ) : (

                                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${item.status === 'Assigned' ? 'bg-indigo-100 text-indigo-700' :

                                                                            item.status === 'Unassigned' ? 'bg-green-100 text-green-700' :

                                                                                item.status === 'Pending' ? 'bg-amber-100 text-amber-700' :

                                                                                    item.status === 'Submitted for Approval' ? 'bg-amber-100 text-amber-800' :

                                                                                        item.status === 'Service' ? 'bg-rose-100 text-rose-700' :
                                                                                            item.status?.toLowerCase() === 'on leave' ? 'bg-purple-100 text-purple-700' :
                                                                                                item.status === 'Returned' ? 'bg-blue-100 text-blue-700' :

                                                                                                    'bg-gray-100 text-gray-700'}`}>

                                                                            {item.status === 'Assigned' &&
                                                                            item?.assignedTo &&
                                                                            typeof item.assignedTo === 'object' &&
                                                                            `${item.assignedTo.firstName || ''} ${item.assignedTo.lastName || ''}`.trim()
                                                                                ? `Assigned - ${`${item.assignedTo.firstName || ''} ${item.assignedTo.lastName || ''}`.trim()}`
                                                                                : item.status === 'Assigned' &&
                                                                                    item?.assignedCompany &&
                                                                                    typeof item.assignedCompany === 'object' &&
                                                                                    String(item.assignedCompany.name || item.assignedCompany.companyName || '').trim()
                                                                                    ? `Assigned - ${String(item.assignedCompany.name || item.assignedCompany.companyName).trim()}`
                                                                                    : item.status}

                                                                        </span>

                                                                    )}

                                                                </div>

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-right">

                                                                <div className="flex items-center justify-end gap-2">



                                                                    {isAdmin() && (

                                                                        <button

                                                                            onClick={(e) => {

                                                                                e.stopPropagation();

                                                                                setDeleteConfirm({ isOpen: true, assetId: item._id, assetName: item.name || item.assetId });

                                                                            }}

                                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"

                                                                            title="Delete asset"

                                                                        >

                                                                            <Trash2 size={16} />

                                                                        </button>

                                                                    )}

                                                                </div>

                                                            </td>

                                                        </tr>

                                                    ))

                                                )}

                                            </tbody>

                                        </>

                                    ) : activeTab === 'category' ? (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSET</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSIGN</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UNASSIGN</th>

                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>

                                                </tr>

                                            </thead>

                                            <tbody className="bg-white divide-y divide-gray-200">

                                                {(() => {

                                                    // Map out official categories first

                                                    const officialCats = assetTypes.filter(t => t.assetId?.startsWith('asset-cat-'));



                                                    // Accumulate types and asset stats for these categories

                                                    const categories = officialCats.reduce((acc, cat) => {

                                                        acc[cat.category] = {

                                                            name: cat.category,

                                                            categoryId: cat.assetId,

                                                            _id: cat._id,

                                                            typeNames: cat.type ? [cat.type] : [],

                                                            parentType: cat.type || '',

                                                            assetCount: 0,

                                                            assignedTotal: 0,

                                                            unassignedTotal: 0,

                                                            imagePreview: cat.imagePreview

                                                        };

                                                        return acc;

                                                    }, {});



                                                    // Fill data from the flat list

                                                    assetTypes.forEach(curr => {

                                                        const cat = categories[curr.category];

                                                        if (!cat) return;



                                                        if (curr.assetId?.startsWith('VEGA-ASSET-')) {

                                                            cat.assetCount += 1;

                                                            cat.assignedTotal += (curr.assigned || 0);

                                                            cat.unassignedTotal += (curr.unassigned || 0);



                                                            // Collect type names from assets in this category

                                                            if (curr.type && curr.type !== '-' && !cat.typeNames.includes(curr.type)) {

                                                                cat.typeNames.push(curr.type);

                                                            }

                                                        }

                                                    });



                                                    const categoryList = Object.values(categories).filter(c =>

                                                        !searchQuery ||

                                                        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||

                                                        (c.typeNames && c.typeNames.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))

                                                    );



                                                    if (loading) return <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>;

                                                    if (categoryList.length === 0) return <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No Categories Found.</td></tr>;



                                                    return categoryList.map((cat, index) => (

                                                        <tr

                                                            key={cat._id}

                                                            onClick={(e) => {

                                                                e.stopPropagation();

                                                                setActiveTab('asset');

                                                                setSearchQuery(cat.name);

                                                            }}

                                                            className="hover:bg-gray-50 transition-colors cursor-pointer"

                                                        >

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm">

                                                                <div className="flex items-center gap-3">

                                                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">

                                                                        {cat.imagePreview ? (

                                                                            <img src={sanitizeUrl(cat.imagePreview, false)} alt={cat.name} className="w-full h-full object-cover" />

                                                                        ) : (

                                                                            <div className="w-full h-full flex items-center justify-center text-gray-300">

                                                                                <Package size={16} />

                                                                            </div>

                                                                        )}

                                                                    </div>

                                                                    <span className="font-bold text-gray-900">{cat.name}</span>

                                                                </div>

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{cat.categoryId || '-'}</td>

                                                            <td className="px-6 py-4 text-sm text-gray-600 font-normal">

                                                                {cat.typeNames.length > 0 ? cat.typeNames.join(', ') : '-'}

                                                            </td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{cat.assetCount}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cat.assignedTotal}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cat.unassignedTotal}</td>

                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">

                                                                <div
                                                                    className="flex items-center justify-end gap-1"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {canEditTypeCategory && (
                                                                        <button
                                                                            type="button"
                                                                            title="Edit category"
                                                                            onClick={() => {
                                                                                setTypeCategoryEditInitial({
                                                                                    _id: cat._id,
                                                                                    category: cat.name,
                                                                                    type: cat.parentType || cat.typeNames?.[0] || '',
                                                                                    imagePreview: cat.imagePreview,
                                                                                    assetId: cat.categoryId
                                                                                });
                                                                                setIsAddTypeModalOpen(true);
                                                                            }}
                                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                        >
                                                                            <Pencil size={16} />
                                                                        </button>
                                                                    )}
                                                                    {canDeleteTypeCategory && (
                                                                        <button
                                                                            type="button"
                                                                            title={
                                                                                cat.assetCount > 0
                                                                                    ? 'Cannot delete while assets use this category'
                                                                                    : 'Delete category'
                                                                            }
                                                                            disabled={cat.assetCount > 0}
                                                                            onClick={() =>
                                                                                setDeleteConfirm({
                                                                                    isOpen: true,
                                                                                    assetId: cat._id,
                                                                                    assetName: cat.name
                                                                                })
                                                                            }
                                                                            className={`p-1.5 rounded-lg transition-colors ${cat.assetCount > 0
                                                                                    ? 'text-gray-300 cursor-not-allowed opacity-50'
                                                                                    : 'text-red-600 hover:bg-red-50'
                                                                                }`}
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                            </td>

                                                        </tr>

                                                    ));

                                                })()}

                                            </tbody>

                                        </>

                                    ) : activeTab === 'accessories' ? (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Accessories ID</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">PRICE</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSET ID</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Owned by</th>



                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>

                                                </tr>

                                            </thead>

                                            <tbody className="bg-white divide-y divide-gray-200">

                                                {(() => {

                                                    if (loadingAccessoryCatalog) {

                                                        return <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>;

                                                    }

                                                    if (accessoryCatalogFiltered.length === 0) {

                                                        return <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No accessories match this view.</td></tr>;

                                                    }

                                                    return accessoryCatalogFiltered.map((row, index) => (
                                                        <Fragment key={row._id}>
                                                            <tr
                                                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                                onClick={() => setExpandedAccessoryCatalogId((prev) => prev === row._id ? null : row._id)}
                                                            >

                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{row.accessoryCatalogId || '—'}</td>


                                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.name}</td>

                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">

                                                                    {Number(row.price || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}

                                                                </td>

                                                                <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                                                                    {catalogRowStatus(row) === 'Attached'
                                                                        ? (() => {
                                                                            const directAssetId = row?.assetItemId?.assetId || row?.assetId;
                                                                            if (directAssetId) return directAssetId;
                                                                            const attachedAssetObjId = row?.assetItemId?._id || row?.assetItemId;
                                                                            if (!attachedAssetObjId) return '';
                                                                            const matchedAsset = (assetTypes || []).find(
                                                                                (a) => String(a?._id || a?.id) === String(attachedAssetObjId)
                                                                            );
                                                                            return matchedAsset?.assetId || '';
                                                                        })()
                                                                        : ''}
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                                    <span
                                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${catalogRowStatus(row) === 'Pending'
                                                                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                                                : catalogRowStatus(row) === 'Attached'
                                                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                                    : catalogRowStatus(row) === 'Lost'
                                                                                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                                                                        : catalogRowStatus(row) === 'EndOfLife' || catalogRowStatus(row) === 'End of Life'
                                                                                            ? 'bg-violet-50 text-violet-800 border border-violet-100'
                                                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                                            }`}
                                                                    >
                                                                        {catalogRowStatus(row) === 'EndOfLife' || catalogRowStatus(row) === 'End of Life'
                                                                            ? 'End of life'
                                                                            : catalogRowStatus(row)}
                                                                    </span>
                                                                </td>

                                                                <td className="px-6 py-4 text-sm text-gray-700 max-w-[14rem]">
                                                                    {isCatalogTerminalStatus(row)
                                                                        ? ''
                                                                        : (row.ownedByDisplay || '').trim() || '—'}
                                                                </td>


                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">

                                                                    {isAdmin() && !isCatalogTerminalStatus(row) && (

                                                                        <button

                                                                            type="button"

                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();

                                                                                if (!window.confirm(`Remove "${row.name}" from the catalog?`)) return;

                                                                                try {
                                                                                    await axiosInstance.delete(`/AssetAccessoryCatalog/${row._id}`);
                                                                                    toast({ title: 'Removed', description: 'Accessory removed from catalog' });
                                                                                    fetchAccessoryCatalog();

                                                                                } catch (err) {

                                                                                    toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Delete failed' });

                                                                                }

                                                                            }}

                                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"

                                                                            title="Remove"

                                                                        >

                                                                            <Trash2 size={16} />

                                                                        </button>

                                                                    )}

                                                                </td>

                                                            </tr>
                                                            {expandedAccessoryCatalogId === row._id && (
                                                                <tr className="bg-slate-50/60">
                                                                    <td colSpan="8" className="px-6 py-4">
                                                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                                            <p className="text-xs font-semibold text-slate-500 mb-3">
                                                                                <span className="text-slate-700">Details: </span>
                                                                                {row.description || 'No description'}
                                                                            </p>
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                {catalogRowStatus(row) === 'Attached' && row.assetItemId && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const aid = row.assetItemId?._id || row.assetItemId;
                                                                                            if (!aid) return;
                                                                                            router.push(`/HRM/Asset/details/${String(aid)}?tab=accessories`);
                                                                                        }}
                                                                                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wide border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all inline-flex items-center gap-1.5"
                                                                                    >
                                                                                        <ExternalLink size={14} />
                                                                                        View asset
                                                                                    </button>
                                                                                )}
                                                                                {canAttachCatalogRow(row) && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setAttachCatalogModal({ isOpen: true, item: row });
                                                                                        }}
                                                                                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wide border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                                                                                    >
                                                                                        Attach to Asset
                                                                                    </button>
                                                                                )}
                                                                                {catalogRowStatus(row) === 'Pending' && (
                                                                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide px-2 py-1 rounded-lg bg-amber-50 border border-amber-100">
                                                                                        Awaiting approval
                                                                                    </span>
                                                                                )}
                                                                                {isCatalogTerminalStatus(row) && (
                                                                                    <span className="text-[10px] font-semibold text-slate-500">
                                                                                        Read-only — use History for details.
                                                                                    </span>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={async (e) => {
                                                                                        e.stopPropagation();
                                                                                        if (!row?._id) return;
                                                                                        setCatalogHistoryModal({
                                                                                            isOpen: true,
                                                                                            catalogId: row._id,
                                                                                            title: row.name || 'Accessory',
                                                                                            accessoryCatalogId: row.accessoryCatalogId || '',
                                                                                            events: [],
                                                                                            loading: true
                                                                                        });
                                                                                        try {
                                                                                            const res = await axiosInstance.get(`/AssetAccessoryCatalog/${row._id}/history`);
                                                                                            const ev = Array.isArray(res.data?.events) ? res.data.events : [];
                                                                                            setCatalogHistoryModal((p) => ({
                                                                                                ...p,
                                                                                                events: ev,
                                                                                                loading: false
                                                                                            }));
                                                                                        } catch (err) {
                                                                                            toast({
                                                                                                variant: 'destructive',
                                                                                                title: 'Error',
                                                                                                description: err.response?.data?.message || 'Could not load history.'
                                                                                            });
                                                                                            setCatalogHistoryModal((p) => ({ ...p, isOpen: false, loading: false }));
                                                                                        }
                                                                                    }}
                                                                                    className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-wide border border-slate-200 hover:bg-slate-700 hover:text-white transition-all inline-flex items-center gap-1.5"
                                                                                >
                                                                                    <History size={14} />
                                                                                    History
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    ));

                                                })()}

                                            </tbody>

                                        </>

                                    ) : activeTab === 'lossDamage' ? (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSET/ACC ID</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>

                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"> </th>

                                                </tr>

                                            </thead>

                                            <tbody className="bg-white divide-y divide-gray-200">

                                                {loading ? (

                                                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>

                                                ) : lossDamageListRows.length === 0 ? (

                                                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No records found for the selected Loss &amp; Damage status.</td></tr>

                                                ) : (

                                                    lossDamageListRows.map((row, index) => {
                                                        const item = row.item;
                                                        const acc = row.kind === 'accessory' ? row.accessory : null;

                                                        const isVehicle =
                                                            item.type?.toLowerCase().includes('vehicle') ||
                                                            item.type?.toLowerCase().includes('car') ||
                                                            item.type?.toLowerCase().includes('van') ||
                                                            item.type?.toLowerCase().includes('pickup') ||
                                                            item.category?.toLowerCase().includes('vehicle');

                                                        const base = isVehicle
                                                            ? `/HRM/Asset/Vehicle/details/${item._id}`
                                                            : `/HRM/Asset/details/${item._id}`;

                                                        const fineIdForRow =
                                                            row.kind === 'accessory'
                                                                ? (
                                                                    acc?.fineId ||
                                                                    (item?.lostDetachedAccessories || []).find((x) => x?.accessoryId === acc?.accessoryId)?.fineId ||
                                                                    ''
                                                                )
                                                                : (item?.lossDamageFineId || item?.pendingActionDetails?.fineId || '');

                                                        const go = () => {
                                                            if (fineIdForRow) {
                                                                router.push(`/HRM/Fine/${encodeURIComponent(String(fineIdForRow))}`);
                                                                return;
                                                            }
                                                            // Accessory rows should always open the Accessories tab
                                                            router.push(row.kind === 'accessory' ? `${base}?tab=accessories` : base);
                                                        };

                                                        const displayId =
                                                            row.kind === 'accessory'
                                                                ? (acc?.accessoryId || '—')
                                                                : getLossDamageTableDisplayId(item);

                                                        const displayName =
                                                            row.kind === 'accessory'
                                                                ? (acc?.name || 'Accessory')
                                                                : (item.name || '—');

                                                        const displayStatus =
                                                            row.kind === 'accessory'
                                                                ? (acc?.pendingAction === 'Loss and Damage' ? 'Pending' : (acc?.status || '—'))
                                                                : (item.pendingAction === 'Loss and Damage' ? 'Pending' : (item.status || '—'));

                                                        return (
                                                            <tr
                                                                key={`${row.kind}-${item._id}-${row.kind === 'accessory' ? (acc?._id || acc?.accessoryId || index) : 'main'}`}
                                                                onClick={go}
                                                                className="hover:bg-rose-50/40 transition-colors cursor-pointer"
                                                            >
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{displayId}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                                    <div className="flex flex-col">
                                                                        <span>{displayName}</span>
                                                                        {row.kind === 'accessory' ? (
                                                                            <span className="text-[11px] text-slate-500 font-medium">
                                                                                {item.assetId} — {item.name || ''}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-100">
                                                                        {displayStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right">

                                                                    <button

                                                                        type="button"

                                                                        onClick={(e) => {

                                                                            e.stopPropagation();

                                                                            go();

                                                                        }}

                                                                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"

                                                                    >

                                                                        <ExternalLink size={14} />

                                                                        {fineIdForRow ? 'Open Fine' : 'Open'}

                                                                    </button>

                                                                </td>

                                                            </tr>

                                                        );

                                                    })

                                                )}

                                            </tbody>

                                        </>

                                    ) : (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSETS</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSIGNED</th>

                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UNASSIGNED</th>

                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>

                                                </tr>

                                            </thead>

                                            <tbody className="bg-white divide-y divide-gray-200">

                                                {loading ? (

                                                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">Loading assets...</td></tr>

                                                ) : assetTypes.filter(t => t.assetId?.startsWith('asset-type-')).length === 0 ? (

                                                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No Asset Types Found.</td></tr>

                                                ) : (() => {

                                                    // Dynamic counters for asset types

                                                    const typeStats = assetTypes.filter(t => t.assetId?.startsWith('VEGA-ASSET-')).reduce((acc, curr) => {

                                                        if (!acc[curr.type]) acc[curr.type] = { count: 0, assigned: 0, unassigned: 0, categories: new Set() };

                                                        acc[curr.type].count++;

                                                        acc[curr.type].assigned += (curr.assigned || 0);

                                                        acc[curr.type].unassigned += (curr.unassigned || 0);

                                                        if (curr.category) acc[curr.type].categories.add(curr.category);

                                                        return acc;

                                                    }, {});



                                                    return assetTypes

                                                        .filter(t => t.assetId?.startsWith('asset-type-'))

                                                        .filter(type => !searchQuery || type.type.toLowerCase().includes(searchQuery.toLowerCase()) || (type.category && type.category.toLowerCase().includes(searchQuery.toLowerCase())) || type.assetId.toLowerCase().includes(searchQuery.toLowerCase()))

                                                        .map((type, index) => {

                                                            const Icon = getIconForType(type.type);

                                                            const stats = typeStats[type.type] || { count: 0, assigned: 0, unassigned: 0, categories: new Set() };



                                                            return (

                                                                <tr

                                                                    key={type._id}

                                                                    onClick={(e) => {

                                                                        e.stopPropagation();

                                                                        setActiveTab('category');

                                                                        setSearchQuery(type.type);

                                                                    }}

                                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"

                                                                >

                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>

                                                                    <td className="px-6 py-4 whitespace-nowrap">

                                                                        <div className="flex items-center gap-3">

                                                                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">

                                                                                {type.imagePreview ? (

                                                                                    <img src={sanitizeUrl(type.imagePreview, false)} alt={type.type} className="w-full h-full object-cover" />

                                                                                ) : (

                                                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">

                                                                                        <Icon size={16} />

                                                                                    </div>

                                                                                )}

                                                                            </div>

                                                                            <span className="font-bold text-gray-900">{type.type}</span>

                                                                        </div>

                                                                    </td>

                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{type.assetId}</td>

                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{type.categoryCount || 0}</td>

                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{stats.count}</td>

                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{stats.assigned}</td>

                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{stats.unassigned}</td>

                                                                    <td className="px-6 py-4 whitespace-nowrap text-right">

                                                                        <div
                                                                            className="flex items-center justify-end gap-1"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            {canEditTypeCategory && (
                                                                                <button
                                                                                    type="button"
                                                                                    title="Edit asset type"
                                                                                    onClick={() => {
                                                                                        setTypeCategoryEditInitial({
                                                                                            _id: type._id,
                                                                                            type: type.type,
                                                                                            assetId: type.assetId,
                                                                                            imagePreview: type.imagePreview,
                                                                                            description: type.description
                                                                                        });
                                                                                        setIsAddTypeModalOpen(true);
                                                                                    }}
                                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                                >
                                                                                    <Pencil size={16} />
                                                                                </button>
                                                                            )}
                                                                            {canDeleteTypeCategory && (
                                                                                <button
                                                                                    type="button"
                                                                                    title={
                                                                                        stats.count > 0
                                                                                            ? 'Cannot delete while assets use this type'
                                                                                            : 'Delete type'
                                                                                    }
                                                                                    disabled={stats.count > 0}
                                                                                    onClick={() =>
                                                                                        setDeleteConfirm({
                                                                                            isOpen: true,
                                                                                            assetId: type._id,
                                                                                            assetName: type.type
                                                                                        })
                                                                                    }
                                                                                    className={`p-1.5 rounded-lg transition-colors ${stats.count > 0
                                                                                            ? 'text-gray-300 cursor-not-allowed opacity-50'
                                                                                            : 'text-red-600 hover:bg-red-50'
                                                                                        }`}
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                    </td>

                                                                </tr>

                                                            );

                                                        });

                                                })()}

                                            </tbody>

                                        </>

                                    )}

                                </table>

                            </div>



                            {/* Simple Pagination Footer (Placeholder) */}

                            {((activeTab === 'accessories'
                                ? accessoryCatalog.length
                                : activeTab === 'lossDamage'
                                    ? lossDamageListRows.length
                                    : assetTypes.length) > 0) && (

                                    <div className="px-6 py-4 border-t border-gray-200">

                                        <p className="text-sm text-gray-500">

                                            Showing{' '}
                                            {activeTab === 'accessories'
                                                ? accessoryCatalogFiltered.length
                                                : activeTab === 'lossDamage'
                                                    ? lossDamageListRows.length
                                                    : assetTypes.length}
                                            {activeTab === 'accessories' && accessoryCatalogFiltered.length !== accessoryCatalog.length
                                                ? ` of ${accessoryCatalog.length}`
                                                : ''}{' '}
                                            entries

                                        </p>

                                    </div>

                                )}

                        </div>

                    </div >

                </div >



                <AddAssetTypeModal

                    isOpen={isAddTypeModalOpen}

                    onClose={() => {
                        setIsAddTypeModalOpen(false);
                        setTypeCategoryEditInitial(null);
                    }}

                    onSuccess={fetchAssetTypes}

                    mode={(activeTab === 'asset' || activeTab === 'type' || activeTab === 'category') ? activeTab : 'type'}

                    preSelectedType={activeTab === 'category' ? searchQuery : ''}

                    preSelectedCategory={activeTab === 'asset' ? searchQuery : ''}

                    initialData={typeCategoryEditInitial}

                    roleMeta={assetRoleMeta}

                />



                <AddAccessoryCatalogModal

                    isOpen={isAddAccessoryModalOpen}

                    onClose={() => setIsAddAccessoryModalOpen(false)}

                    onSuccess={fetchAccessoryCatalog}

                />

                <AttachCatalogAccessoryModal
                    isOpen={attachCatalogModal.isOpen}
                    onClose={() => setAttachCatalogModal({ isOpen: false, item: null })}
                    accessory={attachCatalogModal.item}
                    onAttached={fetchAccessoryCatalog}
                />

                <AlertDialog
                    open={catalogHistoryModal.isOpen}
                    onOpenChange={(open) => !open && setCatalogHistoryModal((p) => ({ ...p, isOpen: false, events: [] }))}
                >
                    <AlertDialogContent className="max-w-lg max-h-[85vh] flex flex-col rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
                        <AlertDialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
                            <AlertDialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-slate-200/80 flex items-center justify-center text-slate-700">
                                    <History size={18} />
                                </span>
                                Accessory history
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-slate-500 mt-1 text-left">
                                {catalogHistoryModal.accessoryCatalogId && (
                                    <span className="font-mono text-slate-600">{catalogHistoryModal.accessoryCatalogId}</span>
                                )}
                                {catalogHistoryModal.title && (
                                    <span className="block mt-0.5 font-semibold text-slate-700">{catalogHistoryModal.title}</span>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
                            {catalogHistoryModal.loading ? (
                                <p className="text-sm text-slate-500 text-center py-8">Loading…</p>
                            ) : catalogHistoryModal.events.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">No history entries yet.</p>
                            ) : (
                                <ul className="space-y-0 border-l-2 border-slate-200 ml-2 pl-4">
                                    {catalogHistoryModal.events.map((ev, idx) => {
                                        const dt = ev.at ? new Date(ev.at) : null;
                                        const dateStr = dt && !Number.isNaN(dt.getTime())
                                            ? dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                                            : '—';
                                        const actionLabel = {
                                            created: 'Created',
                                            attach_requested: 'Attach requested',
                                            attach_rejected: 'Attach rejected',
                                            attached: 'Attached to asset',
                                            unattached: 'Returned to catalog',
                                            updated: 'Updated',
                                            removed: 'Removed'
                                        }[ev.action] || ev.action || 'Event';
                                        return (
                                            <li key={`${idx}-${ev.at}`} className="relative pb-5 last:pb-0">
                                                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{dateStr}</p>
                                                <p className="text-[11px] font-bold text-blue-700 mt-0.5">{actionLabel}</p>
                                                <p className="text-sm text-slate-700 mt-1 leading-snug">{ev.message}</p>
                                                {(ev.assetId || ev.assetName) && (
                                                    <p className="text-xs text-slate-500 mt-1 font-mono">
                                                        {ev.assetId}
                                                        {ev.assetName ? ` · ${ev.assetName}` : ''}
                                                    </p>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        <AlertDialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                            <AlertDialogCancel
                                className="w-full rounded-xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest"
                                onClick={() => setCatalogHistoryModal((p) => ({ ...p, isOpen: false, events: [] }))}
                            >
                                Close
                            </AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>



                <AccessoriesModal

                    isOpen={accessoriesModalOpen}

                    onClose={() => setAccessoriesModalOpen(false)}

                    asset={selectedAssetForAccessories}

                    onUpdate={fetchAssetTypes}

                />



                {/* Invoice Viewer Modal */}

                {

                    invoiceModalOpen && (

                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">

                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">

                                {/* Header */}

                                <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">

                                    <div className="flex items-center gap-3">

                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">

                                            <FileText size={20} className="text-blue-600" />

                                        </div>

                                        <div>

                                            <h3 className="text-lg font-bold text-gray-900 leading-none">Document Preview</h3>

                                            <p className="text-xs text-gray-500 mt-1">Viewing attached file</p>

                                        </div>

                                    </div>

                                    <div className="flex items-center gap-3">

                                        <a

                                            href={sanitizeUrl(currentInvoiceUrl)}

                                            target="_blank"

                                            rel="noopener noreferrer"

                                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all active:scale-95"

                                            title="Download Document"

                                            download

                                        >

                                            <Download size={18} />

                                            Download

                                        </a>

                                        <button

                                            onClick={() => setInvoiceModalOpen(false)}

                                            className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all active:scale-95"

                                        >

                                            <X size={24} />

                                        </button>

                                    </div>

                                </div>



                                {/* Content */}

                                <div className="flex-1 bg-gray-50/50 relative overflow-hidden flex items-center justify-center">

                                    {currentInvoiceUrl ? (

                                        currentInvoiceUrl.toLowerCase().includes('pdf') || !currentInvoiceUrl.match(/\.(jpeg|jpg|png|gif|webp)/i) ? (

                                            <iframe

                                                src={`${sanitizeUrl(currentInvoiceUrl)}#toolbar=0&navpanes=0&scrollbar=0`}

                                                className="w-full h-full border-0 rounded-b-2xl shadow-inner bg-white"

                                                title="Document Preview"

                                            />

                                        ) : (

                                            <div className="w-full h-full p-8 flex items-center justify-center overflow-auto">

                                                <img

                                                    src={currentInvoiceUrl}

                                                    alt="Document"

                                                    className="max-w-full max-h-full object-contain rounded-lg shadow-xl ring-1 ring-black/5"

                                                />

                                            </div>

                                        )

                                    ) : (

                                        <div className="text-gray-400 flex flex-col items-center gap-4 py-20">

                                            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">

                                                <FileText size={40} className="text-gray-300" />

                                            </div>

                                            <p className="font-medium text-gray-500">No document to display</p>

                                        </div>

                                    )}

                                </div>

                            </div>

                        </div>

                    )

                }



                <AssignAssetModal

                    isOpen={isIndividualAssignModalOpen}

                    onClose={() => {

                        setIsIndividualAssignModalOpen(false);

                        setSelectedAssetForAssign(null);

                    }}

                    asset={selectedAssetForAssign}

                    availableAssets={assetTypes.filter((a) => a.status === 'Unassigned' && isIndividualAssetRow(a))}

                    onUpdate={fetchAssetTypes}

                />



                <BulkAssignAssetModal

                    isOpen={isBulkAssignModalOpen}

                    onClose={() => {

                        setIsBulkAssignModalOpen(false);

                        setSelectedAssetIds([]);

                    }}

                    selectedAssets={assetTypes.filter(a => selectedAssetIds.includes(a._id))}

                    allAvailableAssets={assetTypes.filter((a) => {
                        const st = String(a?.status ?? '').trim().toLowerCase();
                        return (st === 'unassigned' || st === 'returned') && isIndividualAssetRow(a);
                    })}

                    onUpdate={fetchAssetTypes}

                />

                <BulkHolderActionModal

                    isOpen={bulkHolderModal.open}

                    mode={bulkHolderModal.mode}

                    initialAssetIds={bulkInitialAssetIds}

                    onClose={() => {

                        setBulkHolderModal({ open: false, mode: null });

                        setBulkInitialAssetIds(null);

                    }}

                    onSuccess={() => {

                        fetchAssetTypes();

                    }}

                />

                <PendingAssetRequestsModal

                    isOpen={pendingInboxModalOpen}

                    onClose={() => {

                        setPendingInboxModalOpen(false);

                        fetchPendingInboxCount();

                    }}

                    onRefreshParent={() => {

                        fetchAssetTypes();

                        fetchPendingInboxCount();

                    }}

                />

                <BulkAssignmentAcknowledgeModal

                    isOpen={!!bulkAssignmentGroupParam}

                    groupId={bulkAssignmentGroupParam || ''}

                    onClose={clearBulkAssignmentQuery}

                    onSuccess={() => {

                        fetchAssetTypes();

                        fetchPendingInboxCount();

                    }}

                />



                {/* Assignment Choice Modal */}

                {

                    showAssignChoiceModal && (

                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">

                            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 p-8">

                                <div className="flex items-center justify-between mb-8">

                                    <div>

                                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Assign Assets</h2>

                                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Choose Assignment Method</p>

                                    </div>

                                    <button

                                        onClick={() => setShowAssignChoiceModal(false)}

                                        className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"

                                    >

                                        <X size={24} />

                                    </button>

                                </div>



                                <div className="grid grid-cols-2 gap-6">

                                    {/* Individual Option */}

                                    <button

                                        onClick={() => {

                                            setShowAssignChoiceModal(false);

                                            setIsIndividualAssignModalOpen(true);

                                        }}

                                        className="group flex flex-col items-center gap-6 p-8 rounded-[24px] border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all hover:scale-[1.02] active:scale-95"

                                    >

                                        <div className="w-20 h-20 rounded-[28px] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-200 transition-all duration-300">

                                            <User size={36} strokeWidth={2.5} />

                                        </div>

                                        <div className="text-center">

                                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2">Individual</h3>

                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Assign a single asset directly</p>

                                        </div>

                                    </button>



                                    {/* Bulk Option */}

                                    <button

                                        onClick={() => {

                                            setShowAssignChoiceModal(false);

                                            setIsBulkAssignModalOpen(true);

                                        }}

                                        className="group flex flex-col items-center gap-6 p-8 rounded-[24px] border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all hover:scale-[1.02] active:scale-95"

                                    >

                                        <div className="w-20 h-20 rounded-[28px] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-200 transition-all duration-300">

                                            <Users size={36} strokeWidth={2.5} />

                                        </div>

                                        <div className="text-center">

                                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2">Bulk</h3>

                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Build a batch assignment list</p>

                                        </div>

                                    </button>

                                </div>

                            </div>

                        </div>

                    )

                }



                <AlertDialog

                    open={deleteConfirm.isOpen}

                    onOpenChange={(open) => !open && setDeleteConfirm({ ...deleteConfirm, isOpen: false })}

                >

                    <AlertDialogContent className="bg-white rounded-[24px]">

                        <AlertDialogHeader>

                            <AlertDialogTitle className="text-xl font-bold">Delete Asset</AlertDialogTitle>

                            <AlertDialogDescription className="text-sm text-gray-500">

                                Are you sure you want to delete <span className="font-bold text-gray-900">"{deleteConfirm.assetName}"</span>? This action is permanent and cannot be undone.

                            </AlertDialogDescription>

                        </AlertDialogHeader>



                        <AlertDialogFooter className="gap-2">

                            <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={(e) => {

                                    e.preventDefault();

                                    handleDeleteAsset();

                                }}

                                className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-red-100"

                            >

                                Confirm Delete

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>

            </div>

        </PermissionGuard>
    );
}

export default function AssetPage() {
    return (
        <Suspense fallback={null}>
            <AssetPageContent />
        </Suspense>
    );
}
