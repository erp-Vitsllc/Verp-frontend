'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { Search, RotateCcw, Truck, Plus, LayoutDashboard, Bell, ClipboardList, Trash2, Filter, Pencil, Wrench } from 'lucide-react';
import { isAdmin, hasPermission } from '@/utils/permissions';
import {
    canAdminDeleteActivatedVehicleRecord,
    isVehicleProfileActivationActive,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAdminDeleteAccess';
import { canAccessAddVehicle, canAccessActiveFleet, canAccessSoldFleet, canAccessCreateService, canEditVehicleAsset } from '@/app/HRM/Asset/Vehicle/utils/vehiclePermissionAccess';

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
import { useRouter, usePathname } from 'next/navigation';
import { navigateFromList, rememberListFilterStep } from '@/utils/listReturnNavigation';
import ListTableRowLink from '@/components/ListTableRowLink';
import Link from 'next/link';
import AddVehicleModal from '@/app/HRM/Asset/Vehicle/components/AddVehicleModal';
import VehiclePlateThumbnail from '@/app/HRM/Asset/Vehicle/components/VehiclePlateThumbnail';
import {
    getVehicleProfileStatusLabel,
    vehicleProfileStatusBadgeClass,
} from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';
import VehicleListAssignmentStatusCell from '@/app/HRM/Asset/Vehicle/components/VehicleListAssignmentStatusCell';
import VehicleLocatorAddPlateModal from '@/app/HRM/Asset/Vehicle/components/VehicleLocatorAddPlateModal';
import VehicleCreateServiceModal from '@/app/HRM/Asset/Vehicle/components/VehicleCreateServiceModal';
import PendingAssetRequestsModal from '@/app/HRM/Asset/components/PendingAssetRequestsModal';
import {
    countVisibleAssetPendingInbox,
    invalidateAssetPendingInbox,
    ASSET_PENDING_INBOX_CHANGED,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { fetchAssetPendingInbox } from '@/utils/pendingInboxFetch';
import { AssetListSummaryPanels } from '@/app/HRM/Asset/components/ListPageSummaryCards';
import {
    isVehicleAssetRequestApproved,
    isVehicleAssetRequestPending,
    isVehicleHandoverAccepted,
    isVehicleHandoverPending,
    isVehicleRegistrationDue,
    isVehicleRegistrationDueSoon,
    isVehicleServiceDue,
    isVehicleServiceDueSoon,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleReminderMatch';
import { vehicleDashboardKpiHref } from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetDashboardNavigation';

const VEHICLE_STATUS_FILTERS = [
    'All',
    'MyVehicle',
    'MyDraft',
    'Assigned',
    'Unassigned',
    'AwaitingApproval',
    'AwaitingActivation',
    'OnService',
    'ServiceDue',
    'ServiceDueSoon',
    'RegistrationDue',
    'RegistrationDueSoon',
    'AssetRequestPending',
    'AssetRequestApproved',
    'HandoverPending',
    'HandoverAccepted',
    'Returned',
    'Sold',
    'TotalLoss',
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
    ServiceDue: 'Service overdue',
    ServiceDueSoon: 'Service due (30 days)',
    RegistrationDue: 'Registration overdue',
    RegistrationDueSoon: 'Registration due (30 days)',
    AssetRequestPending: 'Pending asset requests',
    AssetRequestApproved: 'Approved asset requests',
    HandoverPending: 'Handover pending acceptance',
    HandoverAccepted: 'Handover accepted',
    Returned: 'Returned',
    Sold: 'Sold',
    TotalLoss: 'Total loss',
    Disposed: 'Sold / Total loss',
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

/** Tools assets (VEGA-ASSET-*) must not appear on the Vehicle fleet list. */
function isToolsAssetNotFleetVehicle(v) {
    const id = String(v?.assetId || '').trim().toUpperCase();
    if (!id.startsWith('VEGA-ASSET-')) return false;
    if (String(v?.plateNumber || '').trim()) return false;
    if (v?.locatorDeviceId != null && v.locatorDeviceId !== '') return false;
    if (v?.locator?.deviceId != null && v.locator.deviceId !== '') return false;
    if (String(v?.plateEmirate || '').trim()) return false;
    if (String(v?.vehicleBrand || '').trim()) return false;
    if (String(v?.vehicleCode || '').trim()) return false;
    const typeName = String(v?.typeId?.name || v?.type || '').toLowerCase();
    if (
        typeName.includes('vehicle') ||
        typeName.includes('car') ||
        typeName.includes('fleet') ||
        typeName.includes('truck')
    ) {
        return false;
    }
    return true;
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

function isVehicleProfileInactiveForListEdit(vehicle) {
    return getVehicleProfileStatusLabel(vehicle) === 'Inactive';
}

function isVehicleGpsConnected(vehicle) {
    return vehicle?.locator?.deviceId != null || vehicle?.locatorDeviceId != null;
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
    if (filter === 'ServiceDue') return isVehicleServiceDue(v);
    if (filter === 'ServiceDueSoon') return isVehicleServiceDueSoon(v);
    if (filter === 'RegistrationDue') return isVehicleRegistrationDue(v);
    if (filter === 'RegistrationDueSoon') return isVehicleRegistrationDueSoon(v);
    if (filter === 'AssetRequestPending') return isVehicleAssetRequestPending(v);
    if (filter === 'AssetRequestApproved') return isVehicleAssetRequestApproved(v);
    if (filter === 'HandoverPending') return isVehicleHandoverPending(v);
    if (filter === 'HandoverAccepted') return isVehicleHandoverAccepted(v);
    if (filter === 'Returned') return status === 'returned';
    if (filter === 'Sold') return vehicleDispositionKey(v) === 'sold';
    if (filter === 'TotalLoss') return vehicleDispositionKey(v) === 'total loss';
    if (filter === 'Disposed') {
        const d = String(v?.vehicleDispositionStatus || '').toLowerCase();
        return d === 'sold' || d === 'total loss' || d === 'disposed' || status === 'disposed';
    }
    return false;
}

function readFleetListTabFromUrl() {
    if (typeof window === 'undefined') return 'active';
    const view = new URLSearchParams(window.location.search).get('view');
    return view === SOLD_TOTAL_LOSS_VIEW ? 'sold_total_loss' : 'active';
}

export default function VehicleAssetPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(true);
    const { toast } = useToast();
    const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
    const [addVehicleEditId, setAddVehicleEditId] = useState(null);
    const [addVehicleModalTitle, setAddVehicleModalTitle] = useState(undefined);
    const [vehicleInboxOpen, setVehicleInboxOpen] = useState(false);
    const [vehicleInboxCount, setVehicleInboxCount] = useState(0);
    const vehicleInboxWarmRef = useRef(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, vehicle: null });
    const [plateModalVehicle, setPlateModalVehicle] = useState(null);
    const [createServiceModalOpen, setCreateServiceModalOpen] = useState(false);

    const openInactiveVehicleEdit = useCallback(async (vehicle, e) => {
        e?.stopPropagation();
        try {
            let editId = vehicle._id;
            if (vehicle.isLocatorOnly || String(vehicle._id).startsWith('locator-')) {
                const res = await axiosInstance.post(
                    '/locator/ensure-vehicle',
                    {
                        deviceId: vehicle.locator?.deviceId,
                        deviceName: vehicle.locator?.deviceName || vehicle.name || '',
                        plateEmirate: vehicle.plateEmirate,
                        plateNumber: vehicle.plateNumber,
                    },
                    { skipToast: true },
                );
                editId = res.data?.data?._id;
            }
            if (!editId) {
                throw new Error('Vehicle record not found');
            }
            setAddVehicleEditId(String(editId));
            setAddVehicleModalTitle(vehicle.needsLocatorSetup ? 'Setup Locator vehicle' : undefined);
            setIsAddVehicleModalOpen(true);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Edit failed',
                description: error?.response?.data?.message || 'Could not open vehicle editor.',
            });
        }
    }, [toast]);

    const [fleetListTab, setFleetListTab] = useState('active');
    const canViewActiveFleet = mounted && canAccessActiveFleet();
    const canViewSoldFleet = mounted && canAccessSoldFleet();
    const canCreateService = mounted && canAccessCreateService();

    const setFleetListTabAndUrl = useCallback(
        (next) => {
            const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
            if (next === 'sold_total_loss') p.set('view', SOLD_TOTAL_LOSS_VIEW);
            else p.delete('view');
            const qs = p.toString();
            const base = pathname || '/HRM/Asset/Vehicle';
            router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
            setFleetListTab(next);
        },
        [pathname, router],
    );

    const fetchVehicleInboxCount = useCallback(async ({ force = false, sync = false } = {}) => {
        try {
            const items = await fetchAssetPendingInbox(axiosInstance, {
                inboxScope: 'vehicle',
                skipSync: !(sync || force),
                skipToast: true,
                force,
            });
            setVehicleInboxCount(countVisibleAssetPendingInbox(items));
        } catch {
            setVehicleInboxCount(0);
        }
    }, []);

    const warmVehicleInboxBadge = useCallback(() => {
        if (vehicleInboxWarmRef.current) return;
        vehicleInboxWarmRef.current = true;
        fetchVehicleInboxCount();
    }, [fetchVehicleInboxCount]);

    const fetchVehicles = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            try {
                const locatorRes = await axiosInstance.get('/locator/vehicle-list', {
                    skipToast: true,
                    timeout: silent ? 20000 : 45000,
                });
                const payload = locatorRes.data?.data;
                if (payload?.configured && Array.isArray(payload.vehicles) && payload.vehicles.length > 0) {
                    setVehicles(payload.vehicles.filter((row) => !isToolsAssetNotFleetVehicle(row)));
                    return;
                }
            } catch {
                // Fall back to ERP fleet list when Locator is unavailable.
            }

            const fleetRes = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard', {
                params: { scope: 'list' },
                timeout: 30000,
            });
            const fleetVehicles = Array.isArray(fleetRes.data?.vehicles) ? fleetRes.data.vehicles : [];
            setVehicles(fleetVehicles.filter((row) => !isToolsAssetNotFleetVehicle(row)));
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch vehicle assets."
            });
        } finally {
            if (!silent) setLoading(false);
        }
    }, [toast]);

    const patchVehiclePlateInList = useCallback((deviceId, plateData) => {
        if (!deviceId || !plateData) return;
        setVehicles((prev) =>
            prev.map((row) => {
                if (String(row.locator?.deviceId) !== String(deviceId)) return row;
                return {
                    ...row,
                    _id: plateData._id || row._id,
                    assetId: plateData.assetId || row.assetId,
                    plateEmirate: plateData.plateEmirate || row.plateEmirate,
                    plateNumber: plateData.plateNumber || row.plateNumber,
                    needsPlate: false,
                    isLocatorOnly: false,
                };
            }),
        );
    }, []);

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

    const isFleetAdmin = mounted && isAdmin();
    const canEditInactiveVehicleFromList =
        mounted && (isAdmin() || canEditVehicleAsset());
    const showVehicleRowActions = canEditInactiveVehicleFromList || isFleetAdmin;
    const tableColSpan = showVehicleRowActions ? 9 : 8;

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
        setFleetListTab(readFleetListTabFromUrl());
        const fromUrl = normalizeVehicleStatusFilter(
            new URLSearchParams(window.location.search).get('status'),
        );
        setStatusFilter(fromUrl);
        if (fromUrl !== 'All') setShowFilters(true);
    }, [mounted, pathname]);

    useEffect(() => {
        if (!mounted) return;
        if (fleetListTab === 'sold_total_loss' && !canViewSoldFleet && canViewActiveFleet) {
            setFleetListTabAndUrl('active');
            return;
        }
        if (fleetListTab === 'active' && !canViewActiveFleet && canViewSoldFleet) {
            setFleetListTabAndUrl('sold_total_loss');
        }
    }, [
        mounted,
        fleetListTab,
        canViewActiveFleet,
        canViewSoldFleet,
        setFleetListTabAndUrl,
    ]);

    useEffect(() => {
        if (!mounted || typeof window === 'undefined') return;
        const fromUrl = new URLSearchParams(window.location.search).get('search');
        if (fromUrl) setSearchQuery(fromUrl);
    }, [mounted]);

    useEffect(() => {
        if (!mounted) return;
        const t = setTimeout(() => warmVehicleInboxBadge(), 400);
        return () => clearTimeout(t);
    }, [mounted, warmVehicleInboxBadge]);

    useEffect(() => {
        if (!mounted || typeof window === 'undefined') return;
        const onInboxChanged = () => {
            fetchVehicleInboxCount({ force: true });
        };
        window.addEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
        return () => window.removeEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
    }, [mounted, fetchVehicleInboxCount]);

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
                v.locator?.deviceName?.toLowerCase().includes(q) ||
                v.locator?.driverName?.toLowerCase().includes(q) ||
                v.locatorOwnerName?.toLowerCase().includes(q) ||
                (v.assignedTo?.firstName?.toLowerCase() || '').includes(q) ||
                (v.assignedTo?.lastName?.toLowerCase() || '').includes(q);
            if (!matchesSearch) return false;
            if (fleetListTab === 'sold_total_loss') {
                return isSoldOrTotalLossDisposition(v);
            }
            return matchesVehicleStatusFilter(v, statusFilter, ctx);
        });
    }, [vehicles, searchQuery, statusFilter, fleetListTab]);

    const vehicleListStats = useMemo(() => {
        const rows = vehicles;
        const st = (v) => String(v?.status || '').trim().toLowerCase();

        const assignedRows = rows.filter((v) => st(v) === 'assigned');
        const unassignedRows = rows.filter((v) => ['unassigned', 'available'].includes(st(v)));
        const soldRows = rows.filter(isSoldOrTotalLossDisposition);

        const sumVal = (arr) => arr.reduce((acc, v) => acc + (Number(v.assetValue) || 0), 0);

        const warRows = rows.filter(
            (v) =>
                v.warrantyEnabled === true ||
                !!v.warrantyExpiryDate ||
                Number(v.warrantyYears) > 0,
        );

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

        return {
            total: rows.length,
            totalVal: sumVal(rows),
            assigned: assignedRows.length,
            assignedVal: sumVal(assignedRows),
            unassigned: unassignedRows.length,
            unassignedVal: sumVal(unassignedRows),
            lossDamage: soldRows.length,
            lossDamageVal: sumVal(soldRows),
            warranty: warRows.length,
            inService: inServiceRows.length,
            pendingApproval: pendingRows.length,
            assignedPeople: assigneeIds.size,
        };
    }, [vehicles]);

    const handleSummaryCardClick = useCallback(
        (filterKey) => {
            setShowFilters(true);
            setSearchQuery('');
            setFleetListTabAndUrl('active');

            switch (filterKey) {
                case 'total':
                    setStatusFilter('All');
                    router.push('/HRM/Asset/Vehicle');
                    break;
                case 'assigned':
                    setStatusFilter('Assigned');
                    router.push(vehicleDashboardKpiHref('assigned'));
                    break;
                case 'unassigned':
                    setStatusFilter('Unassigned');
                    router.push(vehicleDashboardKpiHref('unassigned'));
                    break;
                case 'inService':
                    setStatusFilter('OnService');
                    router.push(vehicleDashboardKpiHref('inService'));
                    break;
                case 'pendingApproval':
                    setStatusFilter('AwaitingApproval');
                    router.push('/HRM/Asset/Vehicle?status=AwaitingApproval');
                    break;
                default:
                    break;
            }
        },
        [router, setFleetListTabAndUrl],
    );

    const isSummaryCardActive = useCallback(
        (filterKey) => {
            switch (filterKey) {
                case 'total':
                    return statusFilter === 'All' && fleetListTab === 'active';
                case 'assigned':
                    return statusFilter === 'Assigned';
                case 'unassigned':
                    return statusFilter === 'Unassigned';
                case 'inService':
                    return statusFilter === 'OnService';
                case 'pendingApproval':
                    return statusFilter === 'AwaitingApproval';
                default:
                    return false;
            }
        },
        [statusFilter, fleetListTab],
    );

    const vehicleSummaryLeftCards = useMemo(
        () => [
            { label: 'Total Vehicle', value: vehicleListStats.total, filterKey: 'total' },
            { label: 'Assigned Vehicle', value: vehicleListStats.assigned, filterKey: 'assigned' },
            { label: 'Unassigned Vehicle', value: vehicleListStats.unassigned, filterKey: 'unassigned' },
            { label: 'Sold Vehicle', value: vehicleListStats.lossDamage },
            { label: 'Total Vehicle Value', value: vehicleListStats.totalVal, suffix: 'AED' },
            { label: 'Assigned Vehicle Value', value: vehicleListStats.assignedVal, suffix: 'AED' },
            { label: 'Unassigned Vehicle Value', value: vehicleListStats.unassignedVal, suffix: 'AED' },
            { label: 'Sold Vehicle Value', value: vehicleListStats.lossDamageVal, suffix: 'AED' },
        ],
        [vehicleListStats],
    );

    const vehicleSummaryRightCards = useMemo(
        () => [
            { label: 'Warranty', value: vehicleListStats.warranty },
            { label: 'In Service', value: vehicleListStats.inService, filterKey: 'inService' },
            { label: 'Pending for approval', value: vehicleListStats.pendingApproval, filterKey: 'pendingApproval' },
            { label: 'Assigned People', value: vehicleListStats.assignedPeople },
        ],
        [vehicleListStats],
    );

    const formatDate = (value) => {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

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
                            onCardClick={handleSummaryCardClick}
                            isCardActive={isSummaryCardActive}
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
                                {canCreateService ? (
                                <button
                                    type="button"
                                    onClick={() => setCreateServiceModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 shadow-sm transition-colors"
                                >
                                    <Wrench size={18} />
                                    Create service
                                </button>
                                ) : null}
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

                                {mounted && canAccessAddVehicle() && (
                                <button
                                    onClick={() => {
                                        setAddVehicleEditId(null);
                                        setIsAddVehicleModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors shadow-sm"
                                >
                                    <Plus size={18} />
                                    <span className="text-sm font-medium">Add Vehicle</span>
                                </button>
                                )}
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
                                        {canViewActiveFleet ? (
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={fleetListTab === 'active'}
                                            onClick={() => setFleetListTabAndUrl('active')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${
                                                fleetListTab === 'active'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Active fleet
                                        </button>
                                        ) : null}
                                        {canViewSoldFleet ? (
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={fleetListTab === 'sold_total_loss'}
                                            onClick={() => setFleetListTabAndUrl('sold_total_loss')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${
                                                fleetListTab === 'sold_total_loss'
                                                    ? 'bg-amber-600 text-white shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            Sold &amp; total loss
                                        </button>
                                        ) : null}
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
                                            Quick view: only <strong className="text-gray-800">Sold</strong> and{' '}
                                            <strong className="text-gray-800">Total loss</strong> vehicles. They also
                                            appear on Active fleet (use the Sold / Total loss filters).
                                        </span>
                                    )}
                                    {(statusFilter !== 'All' || fleetListTab === 'sold_total_loss') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter('All');
                                                setFleetListTabAndUrl('active');
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
                                            <th className="px-6 py-4">GPS Status</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Assigned To</th>
                                            {showVehicleRowActions && <th className="px-6 py-4 text-right w-24" />}
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
                                                                setFleetListTabAndUrl('active');
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
                                                const isLocatorOnly = vehicle.isLocatorOnly === true;
                                                const locatorDeviceId = vehicle.locator?.deviceId;
                                                const locatorNameParam = vehicle.locator?.deviceName
                                                    ? `?locatorName=${encodeURIComponent(vehicle.locator.deviceName)}`
                                                    : '';
                                                const vehicleHref =
                                                    isLocatorOnly && locatorDeviceId != null
                                                        ? `/HRM/Asset/Vehicle/details/locator-${locatorDeviceId}${locatorNameParam}`
                                                        : `/HRM/Asset/Vehicle/details/${vehicle._id}`;
                                                const listReturn = qs ? `/HRM/Asset/Vehicle?${qs}` : '/HRM/Asset/Vehicle';
                                                const showRowDelete = !isLocatorOnly && canAdminDeleteActivatedVehicleRecord({
                                                    isAdminUser: isFleetAdmin,
                                                    profileActive: isVehicleProfileActivationActive(vehicle),
                                                });
                                                const displayKm =
                                                    vehicle.locator?.currentKilometer != null
                                                        ? vehicle.locator.currentKilometer
                                                        : vehicle.currentKilometer;
                                                const gpsStatus = vehicle.locator?.gpsStatus || '';
                                                const gpsConnected = isVehicleGpsConnected(vehicle);

                                                const row = (
                                                    <tr
                                                        className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <span className="font-semibold text-gray-800 text-sm">
                                                                {vehicle.assetId || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                                            {vehicle.plateEmirate || vehicle.plateNumber ? (
                                                                <VehiclePlateThumbnail
                                                                    plateEmirate={vehicle.plateEmirate}
                                                                    plateNumber={vehicle.plateNumber}
                                                                />
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPlateModalVehicle(vehicle);
                                                                    }}
                                                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 bg-gray-50 ring-1 ring-gray-200 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                                                >
                                                                    No plate
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                            {vehicle.modelYear || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                                            {displayKm != null && displayKm !== '' ? (
                                                                <span title={gpsStatus ? `GPS: ${gpsStatus}` : undefined}>
                                                                    {Number(displayKm).toLocaleString()} km
                                                                </span>
                                                            ) : (
                                                                '-'
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                            {formatDate(
                                                                vehicle.registrationExpiryDate ||
                                                                    vehicle.registrationExpiry ||
                                                                    vehicle.documents?.find?.(
                                                                        (d) =>
                                                                            String(d?.type || '')
                                                                                .toLowerCase()
                                                                                .includes('registration'),
                                                                    )?.expiryDate,
                                                            )}
                                                        </td>

                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span
                                                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
                                                                    gpsConnected
                                                                        ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                                                                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                                                                }`}
                                                                title={gpsConnected && gpsStatus ? gpsStatus : undefined}
                                                            >
                                                                {gpsConnected ? 'Connected' : 'Not connected'}
                                                            </span>
                                                        </td>

                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span
                                                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${vehicleProfileStatusBadgeClass(vehicle)}`}
                                                            >
                                                                {getVehicleProfileStatusLabel(vehicle)}
                                                            </span>
                                                        </td>

                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <VehicleListAssignmentStatusCell vehicle={vehicle} />
                                                        </td>
                                                        {showVehicleRowActions && (
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-3">
                                                                    {canEditInactiveVehicleFromList &&
                                                                        isVehicleProfileInactiveForListEdit(vehicle) && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => openInactiveVehicleEdit(vehicle, e)}
                                                                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                                                title="Edit vehicle profile"
                                                                            >
                                                                                <Pencil size={18} />
                                                                            </button>
                                                                        )}
                                                                    {isFleetAdmin && showRowDelete && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeleteConfirm({ isOpen: true, vehicle });
                                                                            }}
                                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                            title="Delete vehicle (admin, profile active)"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );

                                                return (
                                                    <ListTableRowLink
                                                        key={vehicle._id}
                                                        href={vehicleHref}
                                                        enabled
                                                        router={router}
                                                        listReturnHref={listReturn}
                                                    >
                                                        {row}
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
                    fetchVehicleInboxCount({ force: true });
                }}
            />

            {isAddVehicleModalOpen && (
                <AddVehicleModal
                    isOpen={isAddVehicleModalOpen}
                    editAssetId={addVehicleEditId}
                    modalTitle={addVehicleModalTitle}
                    onClose={() => {
                        setIsAddVehicleModalOpen(false);
                        setAddVehicleEditId(null);
                        setAddVehicleModalTitle(undefined);
                    }}
                    onSuccess={() => {
                        fetchVehicles();
                        setAddVehicleEditId(null);
                        setAddVehicleModalTitle(undefined);
                        toast({
                            title: 'Success',
                            description: addVehicleEditId
                                ? 'Vehicle details saved.'
                                : 'Vehicle added successfully.',
                        });
                    }}
                />
            )}

            <VehicleLocatorAddPlateModal
                isOpen={Boolean(plateModalVehicle)}
                vehicle={plateModalVehicle}
                onClose={() => setPlateModalVehicle(null)}
                onSuccess={(plateData) => {
                    patchVehiclePlateInList(plateModalVehicle?.locator?.deviceId, plateData);
                    setPlateModalVehicle(null);
                    void fetchVehicles({ silent: true });
                }}
            />

            <VehicleCreateServiceModal
                isOpen={createServiceModalOpen}
                vehicles={vehicles}
                onClose={() => setCreateServiceModalOpen(false)}
                onSuccess={() => {
                    void fetchVehicleInboxCount({ force: true });
                }}
            />

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
