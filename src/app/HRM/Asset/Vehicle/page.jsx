'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { Search, RotateCcw, Truck, Plus, LayoutDashboard, Bell, ClipboardList, Trash2, Filter } from 'lucide-react';
import { isAdmin } from '@/utils/permissions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { navigateFromList, rememberListFilterStep } from '@/utils/listReturnNavigation';
import ListTableRowLink from '@/components/ListTableRowLink';
import Link from 'next/link';
import AddVehicleModal from '@/app/HRM/Asset/Vehicle/components/AddVehicleModal';
import VehiclePlateThumbnail from '@/app/HRM/Asset/Vehicle/components/VehiclePlateThumbnail';
import {
    vehicleAssetStatusBadgeClass,
    vehicleDispositionStatusBadgeClass,
} from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';
import PendingAssetRequestsModal from '@/app/HRM/Asset/components/PendingAssetRequestsModal';
import {
    countVisibleAssetPendingInbox,
    notifyAssetPendingInboxChanged,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { AssetListSummaryPanels } from '@/app/HRM/Asset/components/ListPageSummaryCards';

const VEHICLE_STATUS_FILTERS = [
    'All',
    'MyVehicle',
    'MyDraft',
    'Assigned',
    'Unassigned',
    'AwaitingApproval',
    'AwaitingActivation',
    'OnService',
    'Returned',
    'Disposed',
];

const SOLD_TOTAL_LOSS_VIEW = 'sold-total-loss';

const VEHICLE_STATUS_LABELS = {
    All: 'All Status',
    MyVehicle: 'My Vehicle',
    MyDraft: 'My Draft',
    Assigned: 'Assigned',
    Unassigned: 'Unassigned',
    AwaitingApproval: 'Awaiting Approval',
    AwaitingActivation: 'Awaiting Activation',
    OnService: 'On Service',
    Returned: 'Returned',
    Disposed: 'Disposed',
};

function normalizeVehicleStatusFilter(raw) {
    if (!raw || raw === 'null' || raw === 'undefined') return 'All';
    return VEHICLE_STATUS_FILTERS.includes(raw) ? raw : 'All';
}

function isVehicleAwaitingCreation(v) {
    const s = String(v?.status || '').trim();
    if (s === 'Submitted for Approval') return true;
    return !!v?.actionRequiredBy && s === 'Pending';
}

function isVehicleDraft(v) {
    return String(v?.status || '').trim() === 'Draft';
}

function vehicleDispositionKey(v) {
    return String(v?.vehicleDispositionStatus || 'active')
        .toLowerCase()
        .trim();
}

function isSoldOrTotalLossDisposition(v) {
    const d = vehicleDispositionKey(v);
    return d === 'sold' || d === 'total loss';
}

function vehiclePassesDraftVisibilityForFleetList(v, ctx) {
    if (!isVehicleDraft(v)) return true;
    const creatorRef = v?.createdBy && typeof v.createdBy === 'object' ? v.createdBy._id : v?.createdBy;
    const creatorId = creatorRef ? String(creatorRef) : '';
    if (creatorId && ctx.loggedInEmployeeIds.size > 0 && !ctx.loggedInEmployeeIds.has(creatorId)) {
        return false;
    }
    return true;
}

function isVehicleAwaitingActivation(v) {
    const a = String(v?.vehicleProfileActivationStatus || '').toLowerCase();
    return a === 'inactive' || a === 'pending';
}

function matchesVehicleStatusFilter(v, filter, ctx) {
    const status = String(v?.status || '').toLowerCase();

    // Drafts are private to their creator. The backend (`buildDraftVisibilityQuery`) already
    // enforces this, so anything that reaches us with status='Draft' is implicitly the viewer's
    // own draft. If `createdBy` is present we additionally verify ownership; if it is missing we
    // trust the server filter (don't hide the row from its own creator just because the payload
    // omits the field).
    if (isVehicleDraft(v)) {
        if (!vehiclePassesDraftVisibilityForFleetList(v, ctx)) return false;
        if (filter !== 'All' && filter !== 'MyDraft') return false;
    }

    if (filter === 'All') return true;

    if (filter === 'MyVehicle') {
        const assignedToIdRaw =
            v?.assignedTo && typeof v.assignedTo === 'object'
                ? v.assignedTo._id || v.assignedTo.id || v.assignedTo.employeeObjectId || v.assignedTo.employeeId || ''
                : v?.assignedTo || '';
        const assignedToId = String(assignedToIdRaw || '');
        return (
            ctx.loggedInEmployeeIds.size > 0 &&
            !!assignedToId &&
            ctx.loggedInEmployeeIds.has(assignedToId) &&
            !v.assignedCompany
        );
    }
    if (filter === 'MyDraft') {
        // The Draft guard above already restricted to my drafts (or trusted the server filter).
        return isVehicleDraft(v);
    }
    if (filter === 'Assigned') return status === 'assigned';
    if (filter === 'Unassigned') {
        return status === 'unassigned' || status === 'available';
    }
    if (filter === 'AwaitingApproval') return isVehicleAwaitingCreation(v);
    if (filter === 'AwaitingActivation') return isVehicleAwaitingActivation(v);
    if (filter === 'OnService') return status === 'service' || status === 'on service';
    if (filter === 'Returned') return status === 'returned';
    if (filter === 'Disposed') {
        const d = String(v?.vehicleDispositionStatus || '').toLowerCase();
        return d === 'sold' || d === 'total loss' || d === 'disposed' || status === 'disposed';
    }
    return false;
}

function VehicleAssetPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(() => {
        if (typeof window === 'undefined') return 'All';
        const fromUrl = new URLSearchParams(window.location.search).get('status');
        return normalizeVehicleStatusFilter(fromUrl);
    });
    const [showFilters, setShowFilters] = useState(true);
    const { toast } = useToast();
    const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
    const [vehicleInboxOpen, setVehicleInboxOpen] = useState(false);
    const [vehicleInboxCount, setVehicleInboxCount] = useState(0);
    const vehicleInboxWarmRef = useRef(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, vehicle: null });

    const fleetListTab = searchParams.get('view') === SOLD_TOTAL_LOSS_VIEW ? 'sold_total_loss' : 'active';

    const setFleetListTab = useCallback(
        (next) => {
            const p = new URLSearchParams(searchParams.toString());
            if (next === 'sold_total_loss') p.set('view', SOLD_TOTAL_LOSS_VIEW);
            else p.delete('view');
            const qs = p.toString();
            const base = pathname || '/HRM/Asset/Vehicle';
            router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
        },
        [pathname, router, searchParams],
    );

    const fetchVehicleInboxCount = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/AssetItem/dashboard/pending-inbox', { params: { scope: 'vehicle' } });
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const n = countVisibleAssetPendingInbox(items);
            setVehicleInboxCount(n);
            notifyAssetPendingInboxChanged();
        } catch {
            setVehicleInboxCount(0);
            notifyAssetPendingInboxChanged();
        }
    }, []);

    const warmVehicleInboxBadge = useCallback(() => {
        if (vehicleInboxWarmRef.current) return;
        vehicleInboxWarmRef.current = true;
        fetchVehicleInboxCount();
    }, [fetchVehicleInboxCount]);

    const fetchVehicles = useCallback(async () => {
        try {
            setLoading(true);
            const fleetRes = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard');
            const fleetVehicles = Array.isArray(fleetRes.data?.vehicles) ? fleetRes.data.vehicles : [];
            setVehicles(fleetVehicles);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch vehicle assets."
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const handleDeleteVehicle = useCallback(async () => {
        if (!deleteConfirm.vehicle?._id) return;
        try {
            await axiosInstance.delete(`/AssetItem/${deleteConfirm.vehicle._id}`);
            toast({ title: 'Deleted', description: 'Vehicle deleted successfully.' });
            setDeleteConfirm({ isOpen: false, vehicle: null });
            fetchVehicles();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: error.response?.data?.message || 'Could not delete vehicle.',
            });
        }
    }, [deleteConfirm.vehicle, fetchVehicles, toast]);

    const tableColSpan = mounted && isAdmin() ? 8 : 7;

    useEffect(() => {
        setMounted(true);
        fetchVehicles();
    }, [fetchVehicles]);

    useEffect(() => {
        if (!mounted) return;
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (statusFilter && statusFilter !== 'All') params.set('status', statusFilter);
        if (fleetListTab === 'sold_total_loss') params.set('view', SOLD_TOTAL_LOSS_VIEW);
        const qs = params.toString();
        rememberListFilterStep(qs ? `/HRM/Asset/Vehicle?${qs}` : '/HRM/Asset/Vehicle');
    }, [mounted, searchQuery, statusFilter, fleetListTab]);

    useEffect(() => {
        if (!mounted || typeof window === 'undefined') return;
        const fromUrl = new URLSearchParams(window.location.search).get('search');
        if (fromUrl) setSearchQuery(fromUrl);
    }, [mounted]);

    useEffect(() => {
        if (!mounted) return;
        let cancelled = false;
        const run = () => {
            if (!cancelled) warmVehicleInboxBadge();
        };
        if (typeof window !== 'undefined' && typeof requestIdleCallback !== 'undefined') {
            const id = requestIdleCallback(run, { timeout: 12000 });
            return () => {
                cancelled = true;
                cancelIdleCallback(id);
            };
        }
        const t = setTimeout(run, 8000);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [mounted, warmVehicleInboxBadge]);

    const filteredVehicles = useMemo(() => {
        const q = (searchQuery || '').toLowerCase().trim();

        const ctx = (() => {
            if (typeof window === 'undefined') {
                return { primaryLoggedInUserId: '', loggedInEmployeeIds: new Set() };
            }
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const ids = [user._id, user.id, user.employeeObjectId, user.employeeId]
                    .filter(Boolean)
                    .map((v) => String(v));
                return {
                    primaryLoggedInUserId: ids[0] || '',
                    loggedInEmployeeIds: new Set(ids),
                };
            } catch {
                return { primaryLoggedInUserId: '', loggedInEmployeeIds: new Set() };
            }
        })();

        return vehicles.filter((v) => {
            if (!vehiclePassesDraftVisibilityForFleetList(v, ctx)) return false;
            const matchesSearch =
                !q ||
                v.vehicleCode?.toLowerCase().includes(q) ||
                v.plateNumber?.toLowerCase().includes(q) ||
                v.assetId?.toLowerCase().includes(q) ||
                (v.assignedTo?.firstName?.toLowerCase() || '').includes(q) ||
                (v.assignedTo?.lastName?.toLowerCase() || '').includes(q);
            if (!matchesSearch) return false;
            if (fleetListTab === 'sold_total_loss') {
                return isSoldOrTotalLossDisposition(v);
            }
            // Active fleet: sold / total loss live only under the Sold & total loss tab.
            if (isSoldOrTotalLossDisposition(v)) return false;
            return matchesVehicleStatusFilter(v, statusFilter, ctx);
        });
    }, [vehicles, searchQuery, statusFilter, fleetListTab]);

    const vehicleListStats = useMemo(() => {
        const rows = vehicles;
        const st = (v) => String(v?.status || '').trim().toLowerCase();

        const assignedRows = rows.filter((v) => st(v) === 'assigned');
        const unassignedRows = rows.filter((v) => ['unassigned', 'available'].includes(st(v)));
        const ldRows = rows.filter((v) => {
            const s = st(v);
            if (s === 'lost' || s === 'rejected') return true;
            return isSoldOrTotalLossDisposition(v);
        });

        const sumVal = (arr) => arr.reduce((acc, v) => acc + (Number(v.assetValue) || 0), 0);

        const parkingRows = rows.filter(
            (v) =>
                v.assignmentType === 'Temporary' ||
                Number(v.parkingExtendedDays) > 0 ||
                !!v.parkingReminderSentAt ||
                !!v.parkingDurationCompleteSentAt,
        );
        const accRows = rows.filter((v) => Array.isArray(v.accessories) && v.accessories.length > 0);
        const warRows = rows.filter(
            (v) =>
                v.warrantyEnabled === true ||
                !!v.warrantyExpiryDate ||
                Number(v.warrantyYears) > 0,
        );
        const typeLabels = rows
            .map((v) =>
                v.typeId && typeof v.typeId === 'object' && v.typeId.name ? String(v.typeId.name).trim() : '',
            )
            .filter(Boolean);
        const distinctTypes = new Set(typeLabels).size;

        const inServiceRows = rows.filter((v) => {
            const low = st(v);
            return low === 'service' || low === 'on service';
        });
        const pendingRows = rows.filter((v) => isVehicleAwaitingCreation(v));

        const assigneeIds = new Set();
        assignedRows.forEach((v) => {
            const raw =
                v.assignedTo && typeof v.assignedTo === 'object'
                    ? v.assignedTo._id || v.assignedTo.employeeObjectId || v.assignedTo.employeeId
                    : v.assignedTo;
            if (raw) assigneeIds.add(String(raw));
        });

        const emirateSet = new Set(rows.map((v) => String(v.plateEmirate || '').trim()).filter(Boolean));
        const modelYearSet = new Set(rows.map((v) => String(v.modelYear ?? '').trim()).filter(Boolean));
        const categoriesDistinct = emirateSet.size > 0 ? emirateSet.size : modelYearSet.size;

        return {
            total: rows.length,
            totalVal: sumVal(rows),
            assigned: assignedRows.length,
            assignedVal: sumVal(assignedRows),
            unassigned: unassignedRows.length,
            unassignedVal: sumVal(unassignedRows),
            lossDamage: ldRows.length,
            lossDamageVal: sumVal(ldRows),
            parking: parkingRows.length,
            accessories: accRows.length,
            warranty: warRows.length,
            assetTypesDistinct: distinctTypes,
            inService: inServiceRows.length,
            pendingApproval: pendingRows.length,
            assignedPeople: assigneeIds.size,
            categoriesDistinct,
        };
    }, [vehicles]);

    const vehicleSummaryLeftCards = useMemo(
        () => [
            { label: 'Total Asset', value: vehicleListStats.total },
            { label: 'Assigned Asset', value: vehicleListStats.assigned },
            { label: 'Unassigned Asset', value: vehicleListStats.unassigned },
            { label: 'Loss & Damage Asset', value: vehicleListStats.lossDamage },
            { label: 'Total Asset Value', value: vehicleListStats.totalVal, suffix: 'AED' },
            { label: 'Assigned Asset Value', value: vehicleListStats.assignedVal, suffix: 'AED' },
            { label: 'Unassigned Value', value: vehicleListStats.unassignedVal, suffix: 'AED' },
            { label: 'Loss & Damage Value', value: vehicleListStats.lossDamageVal, suffix: 'AED' },
        ],
        [vehicleListStats],
    );

    const vehicleSummaryRightCards = useMemo(
        () => [
            { label: 'Parking', value: vehicleListStats.parking },
            { label: 'Accessories', value: vehicleListStats.accessories },
            { label: 'Warranty', value: vehicleListStats.warranty },
            { label: 'Asset type', value: vehicleListStats.assetTypesDistinct },
            { label: 'In Service', value: vehicleListStats.inService },
            { label: 'Pending for approval', value: vehicleListStats.pendingApproval },
            { label: 'Assigned People', value: vehicleListStats.assignedPeople },
            { label: 'Asset Category', value: vehicleListStats.categoriesDistinct },
        ],
        [vehicleListStats],
    );

    const formatDate = (value) => {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString();
    };

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset_vehicle" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Navbar />
                    <div className="p-8">

                        <AssetListSummaryPanels
                            leftCards={vehicleSummaryLeftCards}
                            rightCards={vehicleSummaryRightCards}
                        />

                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-2xl font-bold text-gray-800">Vehicle Assets</h1>
                                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                        {vehicles.length}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-sm">Manage company fleet and transport assets</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setVehicleInboxOpen(true)}
                                    onMouseEnter={warmVehicleInboxBadge}
                                    onFocus={warmVehicleInboxBadge}
                                    className="relative inline-flex items-center justify-center p-2 rounded-lg bg-white border border-teal-200 text-teal-800 hover:bg-teal-50 shadow-sm transition-colors"
                                    title="Vehicle service workflow — pending inbox"
                                >
                                    <Bell size={20} />
                                    {vehicleInboxCount > 0 ? (
                                        <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                            {vehicleInboxCount > 99 ? '99+' : vehicleInboxCount}
                                        </span>
                                    ) : null}
                                </button>

                                <Link
                                    href="/HRM/Asset/Vehicle/dashboard"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                                >
                                    <LayoutDashboard size={18} />
                                    Fleet dashboard
                                </Link>
                                <Link
                                    href="/HRM/Asset/Vehicle/service-requests"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                                >
                                    <ClipboardList size={18} />
                                    Service requests
                                </Link>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search vehicles..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 shadow-sm"
                                    />
                                </div>

                                <button
                                    onClick={() => setShowFilters((s) => !s)}
                                    className={`relative p-2 rounded-lg transition-colors border bg-white shadow-sm ${
                                        statusFilter !== 'All' || fleetListTab === 'sold_total_loss'
                                            ? 'text-blue-600 border-blue-200 hover:bg-blue-50'
                                            : 'text-gray-500 border-gray-200 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                                    title="Filter vehicles by status"
                                >
                                    <Filter size={18} />
                                    {(statusFilter !== 'All' || fleetListTab === 'sold_total_loss') && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white" />
                                    )}
                                </button>

                                <button
                                    onClick={fetchVehicles}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm"
                                    title="Refresh list"
                                >
                                    <RotateCcw size={18} />
                                </button>

                                <button
                                    onClick={() => setIsAddVehicleModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors shadow-sm"
                                >
                                    <Plus size={18} />
                                    <span className="text-sm font-medium">Add Vehicle</span>
                                </button>
                            </div>
                        </div>

                        {showFilters && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div
                                        className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm"
                                        role="tablist"
                                        aria-label="Fleet list scope"
                                    >
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={fleetListTab === 'active'}
                                            onClick={() => setFleetListTab('active')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${
                                                fleetListTab === 'active'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Active fleet
                                        </button>
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={fleetListTab === 'sold_total_loss'}
                                            onClick={() => setFleetListTab('sold_total_loss')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${
                                                fleetListTab === 'sold_total_loss'
                                                    ? 'bg-amber-600 text-white shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Sold &amp; total loss
                                        </button>
                                    </div>
                                    {fleetListTab === 'active' ? (
                                        <>
                                            <span className="text-sm font-medium text-gray-700">Filter by</span>
                                            <div className="relative">
                                                <select
                                                    value={statusFilter}
                                                    onChange={(e) => setStatusFilter(e.target.value)}
                                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                                                >
                                                    {VEHICLE_STATUS_FILTERS.map((value) => (
                                                        <option key={value} value={value}>
                                                            {VEHICLE_STATUS_LABELS[value]}
                                                        </option>
                                                    ))}
                                                </select>
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                                >
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-600 max-w-md">
                                            Vehicles recorded as <strong className="text-gray-800">Sold</strong> or{' '}
                                            <strong className="text-gray-800">Total loss</strong> (fleet disposition).
                                            These are not listed under Active fleet. Use search to narrow the list.
                                        </span>
                                    )}
                                    {(statusFilter !== 'All' || fleetListTab === 'sold_total_loss') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter('All');
                                                setFleetListTab('active');
                                            }}
                                            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                    <span className="ml-auto text-xs text-gray-500 font-medium tabular-nums">
                                        {filteredVehicles.length} of {vehicles.length}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                            <th className="px-6 py-4">Id</th>
                                            <th className="px-6 py-4">Plate No</th>
                                            <th className="px-6 py-4">Model Year</th>
                                            <th className="px-6 py-4">Current KM</th>
                                            <th className="px-6 py-4">Registration Expiry</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Assigned To</th>
                                            {isAdmin() && <th className="px-6 py-4 text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={tableColSpan} className="px-6 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                        <p className="text-sm">Loading vehicles...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : vehicles.length === 0 ? (
                                            <tr>
                                                <td colSpan={tableColSpan} className="px-6 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                            <Truck size={24} />
                                                        </div>
                                                        <p className="font-medium">No vehicles found</p>
                                                        <p className="text-xs text-gray-400">Add assets with type "Vehicle" to see them here.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredVehicles.length === 0 ? (
                                            <tr>
                                                <td colSpan={tableColSpan} className="px-6 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                            <Filter size={22} />
                                                        </div>
                                                        <p className="font-medium">No vehicles match the current filter</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSearchQuery('');
                                                                setStatusFilter('All');
                                                                setFleetListTab('active');
                                                            }}
                                                            className="text-xs font-bold text-blue-600 hover:underline"
                                                        >
                                                            Clear filters
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredVehicles.map((vehicle) => {
                                                const params = new URLSearchParams();
                                                if (searchQuery) params.set('search', searchQuery);
                                                if (statusFilter !== 'All') params.set('status', statusFilter);
                                                if (fleetListTab === 'sold_total_loss') {
                                                    params.set('view', SOLD_TOTAL_LOSS_VIEW);
                                                }
                                                const qs = params.toString();
                                                const vehicleHref = `/HRM/Asset/Vehicle/details/${vehicle._id}`;
                                                const listReturn = qs ? `/HRM/Asset/Vehicle?${qs}` : '/HRM/Asset/Vehicle';

                                                return (
                                                    <ListTableRowLink
                                                        key={vehicle._id}
                                                        href={vehicleHref}
                                                        router={router}
                                                        listReturnHref={listReturn}
                                                    >
                                                    <tr
                                                        className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-gray-800 text-sm">
                                                                    {vehicle.assetId || '-'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                                            <VehiclePlateThumbnail
                                                                plateEmirate={vehicle.plateEmirate}
                                                                plateNumber={vehicle.plateNumber}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            {vehicle.modelYear || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                                            {vehicle.currentKilometer ? `${vehicle.currentKilometer.toLocaleString()} km` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            {formatDate(vehicle.registrationExpiryDate || vehicle.registrationExpiry)}
                                                        </td>

                                                        <td className="px-6 py-4">
                                                            {isSoldOrTotalLossDisposition(vehicle) ? (
                                                                <span
                                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${vehicleDispositionStatusBadgeClass(
                                                                        vehicle.vehicleDispositionStatus,
                                                                    )}`}
                                                                >
                                                                    {vehicleDispositionKey(vehicle) === 'sold'
                                                                        ? 'Sold'
                                                                        : 'Total loss'}
                                                                </span>
                                                            ) : vehicle.status ? (
                                                                <span
                                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${vehicleAssetStatusBadgeClass(vehicle.status)}`}
                                                                >
                                                                    {vehicle.status}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 text-sm">—</span>
                                                            )}
                                                        </td>

                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            {vehicle.assignedTo ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                                                                        {vehicle.assignedTo.firstName?.[0]}{vehicle.assignedTo.lastName?.[0]}
                                                                    </div>
                                                                    <span>{vehicle.assignedTo.firstName} {vehicle.assignedTo.lastName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Unassigned</span>
                                                            )}
                                                        </td>
                                                        {mounted && isAdmin() && (
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeleteConfirm({ isOpen: true, vehicle });
                                                                    }}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                    title="Delete vehicle (admin)"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                    </ListTableRowLink>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <PendingAssetRequestsModal
                isOpen={vehicleInboxOpen}
                inboxScope="vehicle"
                onPendingInboxCount={setVehicleInboxCount}
                onClose={() => {
                    setVehicleInboxOpen(false);
                    fetchVehicleInboxCount();
                }}
                onRefreshParent={() => {
                    fetchVehicles();
                    fetchVehicleInboxCount();
                }}
            />

            {isAddVehicleModalOpen && (
                <AddVehicleModal
                    isOpen={isAddVehicleModalOpen}
                    onClose={() => setIsAddVehicleModalOpen(false)}
                    onSuccess={() => {
                        fetchVehicles();
                        toast({ title: "Success", description: "Vehicle added successfully." });
                    }}
                />
            )}

            <AlertDialog
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, vehicle: null })}
            >
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Delete vehicle</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500">
                            Permanently delete{' '}
                            <span className="font-bold text-gray-900">
                                {deleteConfirm.vehicle?.assetId || deleteConfirm.vehicle?.plateNumber || 'this vehicle'}
                            </span>
                            ? Management will be notified by email. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteVehicle();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGuard>
    );
}

export default function VehicleAssetPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <VehicleAssetPageContent />
        </Suspense>
    );
}
